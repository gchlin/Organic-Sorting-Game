// game-v2.js — data-driven core (rewrite of game.js per README spec)
//
// Responsibilities (per README "重寫工程藍圖 → game.js — 重寫後該長什麼樣"):
//   1. Boot & DOM binding
//   2. Two-stage menu navigation (UI-only state, outside game-state)
//   3. dispatch(action) → reducer → state diff → effects → render
//   4. Run effects via EffectManager (timer/sound/anim/dynamic), saveWrong/fixWrong
//      via direct Save calls
//   5. Wire AIController for Duel PvE
//   6. Settings UI (devQuickWin overlay, dev options)
//   7. 錯題本 / 結算「本輪錯題」/ 圖鑑 / 教學 modal
//
// Invariants (README):
//   I-1 phase is the source of truth (handled by reducer table; we drop ghost actions
//       by checking blacklist before reduce)
//   I-2 globalInputLocked derived from phase in applyAction; never set elsewhere
//   I-3 EFFECT_COMPLETE with blacklisted effectId is dropped before reducer
//   I-4 next question dispatched only via EFFECT_COMPLETE → reducer → LOAD_NEXT_QUESTION
//   I-5 dynamic elapsedMs handled by EffectManager.runDynamicEffect
//   I-6 revealing waits for completeStateReached — handled by reducer rules
//   I-7 cleanup phase calls EffectManager.cancelAllEffects + clearTransientUI
//   I-8 AI is just a dispatcher; reducer does not know about AI

(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    // Mark v2 active so legacy game.js short-circuits its init.
    window.__GAME_V2_ENABLED__ = true;

    // -----------------------------------------------------------------------
    // 0. Effective rules helper — devQuickWin overlay (README §設定與開發者選項)
    // -----------------------------------------------------------------------
    function getEffectiveRules(baseRules, settings) {
        const out = Object.assign({}, baseRules);
        // Apply user-configured scoring overrides
        if (settings && settings.scoring && typeof settings.scoring === 'object') {
            const sc = settings.scoring;
            if (sc.practiceBaseScore    != null) out.practiceBaseScore    = sc.practiceBaseScore;
            if (sc.practiceWrongPenalty != null) out.practiceWrongPenalty = sc.practiceWrongPenalty;
            if (sc.practiceCombo3Score  != null) out.practiceCombo3Score  = sc.practiceCombo3Score;
            if (sc.practiceCombo5Score  != null) out.practiceCombo5Score  = sc.practiceCombo5Score;
            if (sc.practiceCombo7Score  != null) out.practiceCombo7Score  = sc.practiceCombo7Score;
            if (sc.duelBaseScore        != null) out.duelBaseScore        = sc.duelBaseScore;
            if (sc.duelTimingDecay      != null) out.duelTimingDecay      = sc.duelTimingDecay;
            if (sc.duelMinScore         != null) out.duelMinScore         = sc.duelMinScore;
            if (sc.duelWrongPenalty     != null) out.duelWrongPenalty     = sc.duelWrongPenalty;
            if (sc.duelScoreTarget      != null) out.scoreTarget          = sc.duelScoreTarget;
            if (sc.dynamicFastForwardMs != null) out.dynamicFastForwardMs = sc.dynamicFastForwardMs;
        }
        if (settings && settings.devQuickWin && settings.devQuickWin.enabled) {
            const winAfter = Math.max(1, settings.devQuickWin.winAfter || 2);
            out.winTarget = winAfter;
            out.practiceClearAfterN = winAfter;
            out.scoreTarget = winAfter * (out.duelBaseScore || 100); // scale for duel
        } else {
            out.practiceClearAfterN = null;
        }
        return out;
    }

    // -----------------------------------------------------------------------
    // 1. State + dispatch loop
    // -----------------------------------------------------------------------
    let state = null;
    let aiController = null;
    let inputController = null;
    let _pendingDispatch = [];
    let _dispatching = false;
    let _currentScreen = 'main-menu';
    let _subMenuContext = null; // { kind: 'difficulty'|'duel', difficulty?, opponent? }
    let _pendingConfirm = null; // { onYes, onNo, text }
    let _quickHintOpen = false;
    let _wrongHintFlashSeq = 0;
    let _activeWrongHintKey = '';       // 最近一次答錯的閃爍識別碼（''＝目前沒有答錯）
    let _lastFlashedWrongKey = null;    // 已閃爍過的識別碼，避免 render 重複播放
    let _wrongChosenMap = {};   // { compoundKey or compoundKey|questionIndex: chosenWrongAnswerKey } — per round
    let _lastAnswerPlayer = null;

    function dispatch(action) {
        if (action && typeof action === 'object' && typeof action.now !== 'number') {
            action.now = Date.now();
        }
        _pendingDispatch.push(action);
        if (_dispatching) return;
        _dispatching = true;
        try {
            while (_pendingDispatch.length) {
                applyAction(_pendingDispatch.shift());
            }
        } finally {
            _dispatching = false;
        }
    }

    function applyAction(action) {
        if (!state) return;

        const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
        if (settings && settings.devLogActions) {
            console.log('[action]', action.type, action);
        }

        // I-3: drop ghost EFFECT_COMPLETE
        if (action.type === 'EFFECT_COMPLETE' && typeof action.effectId !== 'undefined') {
            if (typeof EffectManager !== 'undefined' && EffectManager.isEffectBlacklisted
                && EffectManager.isEffectBlacklisted(action.effectId)) {
                return;
            }
            if (state.effects && state.effects.activeIds && state.effects.activeIds.has) {
                state.effects.activeIds.delete(action.effectId);
            }
        }

        // Settings → effective rules (devQuickWin overlay applies to BOTH practice
        // clearAfterN and duel winTarget — see README §設定與開發者選項).
        const _baseDuelRules = (typeof DuelDynamicRules !== 'undefined') ? DuelDynamicRules : {};
        const dynRules = getEffectiveRules(_baseDuelRules, settings);

        // Pre-action side effects: capture question identity BEFORE the reducer
        // mutates state.question (e.g. LOAD_NEXT_QUESTION rewrites it).
        const preCompoundKey = (state.question && state.question.current)
            ? state.question.current.compoundKey : null;
        const preCorrectKey = state.question ? state.question.correctKey : null;

        const beforePhase = state.phase;
        const result = reduce(state, action, dynRules);
        if (!result) return;

        if (result.nextPhase && result.nextPhase !== state.phase) {
            state.phase = result.nextPhase;
        }
        if (result.stateDiff) {
            for (const path in result.stateDiff) {
                _setByPath(state, path, result.stateDiff[path]);
            }
        }

        // I-2: derive globalInputLocked from phase. Never set elsewhere.
        state.globalInputLocked = GameState.isInputLockedPhase(state.phase);

        // SUBMIT_ANSWER side effects — must happen BEFORE chained effects could shift state.
        // NOTE: We intentionally do NOT auto-call markFixedV2 here. The 錯題本 keeps
        // entries until the player explicitly deletes them (or uses "刪除已克服"
        // bulk action). This matches the "鞋盒記憶法" spirit: a wrong card stays
        // in the box even after one correct review — repeated correct reviews promote
        // it to a higher box, and only the player decides when to retire it.
        if (action.type === 'SUBMIT_ANSWER' && preCompoundKey) {
            _lastAnswerPlayer = action.player || null;
            const wasCorrect = (action.key === preCorrectKey);
            // 每次答錯都產生新的識別碼；render() 會據此讓「看教學」文字閃爍 4 次。
            _activeWrongHintKey = wasCorrect
                ? ''
                : 'wrong:' + (++_wrongHintFlashSeq);
            if (wasCorrect) _clearHintFlash();
            if (state.mode === 'practice' && wasCorrect) {
                if (typeof Save !== 'undefined') {
                    if (Save.recordMoleculeAnsweredV2) Save.recordMoleculeAnsweredV2(preCompoundKey, state.difficulty);
                    if (Save.addCorrect) Save.addCorrect(1);
                    // Track molecule as unlocked in codex (README §3 isMolUnlocked).
                    if (Save.markMolUnlocked) Save.markMolUnlocked(preCompoundKey);
                    // If this compound is in the wrong-book, count this correct
                    // re-answer toward its mastery streak (Leitner-spirit promote).
                    if (Save.promoteWrongV2) Save.promoteWrongV2(state.family, state.difficulty, preCompoundKey);
                }
            } else if (state.mode === 'practice' && !wasCorrect) {
                state.wrongInRound.add(preCompoundKey);
                // Track the latest wrong pick for settle display, plus an indexed
                // key so repeated compounds in a round do not collide for future UI.
                _wrongChosenMap[preCompoundKey] = action.key;
                _wrongChosenMap[preCompoundKey + '|' + (state.round && state.round.index || 0)] = action.key;
                if (typeof Save !== 'undefined') {
                    if (Save.recordWrongV2) Save.recordWrongV2(state.family, state.difficulty, preCompoundKey);
                    // A wrong answer also demotes (back to box 1) if already tracked.
                    if (Save.demoteWrongV2) Save.demoteWrongV2(state.family, state.difficulty, preCompoundKey);
                }
            }
        }
        if (action.type === 'ANSWER_TIMEOUT' || action.type === 'GIVE_UP') {
            _lastAnswerPlayer = action.player || null;
        }
        if (action.type === 'LOAD_NEXT_QUESTION' || action.type === 'BUZZ') {
            _lastAnswerPlayer = null;
            _activeWrongHintKey = '';
            _clearHintFlash();
        }

        // LOAD_NEXT_QUESTION side effects — enrich the freshly-loaded question.
        if (action.type === 'LOAD_NEXT_QUESTION'
            && (state.phase === 'canAnswer' || state.phase === 'buzzOpen')) {
            _enrichQuestionState();
        }

        // Effects (must come AFTER state mutations so the reducer's transitions hold).
        if (Array.isArray(result.effects)) {
            for (const eff of result.effects) {
                runEffectAndChain(eff);
            }
        }

        // Practice dev-shortcut: if dev says clear after N corrects, short-circuit
        // the queue so the next LOAD_NEXT_QUESTION → settling.
        if (state.mode === 'practice'
            && action.type === 'SUBMIT_ANSWER'
            && typeof dynRules.practiceClearAfterN === 'number'
            && state.players.p1.correctCount >= dynRules.practiceClearAfterN) {
            state.queue = [];
        }

        // Switch screen first if entering settling, then render once on the correct screen.
        if (beforePhase !== 'settling' && state.phase === 'settling') {
            _onEnterSettling();
        }
        render();
    }

    function _setByPath(obj, path, value) {
        const parts = path.split('.');
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === undefined || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    }

    // -----------------------------------------------------------------------
    // Effect dispatch
    // -----------------------------------------------------------------------
    function runEffectAndChain(effect) {
        if (!effect || !effect.type) return;
        const type = effect.type;

        // I-7: cleanup (DOM + timer blacklist).
        // Two flavours:
        //   - 'cleanupAndDispatch' is emitted when the reducer also transitioned us
        //     into the `cleanup` phase; we drive it forward with CLEANUP_DONE and
        //     then dispatch the chained next action (typically LOAD_NEXT_QUESTION).
        //   - Plain 'cleanup' is emitted by Practice wrong-answer flow to wipe
        //     transient class but stay in `canAnswer` (no phase transition).
        if (type === 'cleanupAndDispatch') {
            try { EffectManager.cancelAllEffects('cleanup'); } catch (e) {}
            if (state && state.effects && state.effects.activeIds) state.effects.activeIds.clear();
            clearTransientUI();
            dispatch({ type: 'CLEANUP_DONE' });
            if (effect.next) dispatch(effect.next);
            return;
        }
        if (type === 'cleanup') {
            try { EffectManager.cancelAllEffects('cleanup-transient'); } catch (e) {}
            if (state && state.effects && state.effects.activeIds) state.effects.activeIds.clear();
            clearTransientUI();
            // No CLEANUP_DONE: phase did not transition into 'cleanup'.
            return;
        }

        // saveWrong / fixWrong — fire-and-forget into Save
        if (type === 'saveWrong') {
            if (typeof Save !== 'undefined' && Save.recordWrongV2) {
                Save.recordWrongV2(effect.family, effect.difficulty, effect.compoundKey);
            }
            return;
        }
        if (type === 'fixWrong') {
            if (typeof Save !== 'undefined' && Save.markFixedV2) {
                Save.markFixedV2(effect.family, effect.difficulty, effect.compoundKey);
            }
            return;
        }
        if (type === 'recordAsked') {
            if (typeof Save !== 'undefined' && Save.recordAskedV2) {
                Save.recordAskedV2(effect.family, effect.difficulty, effect.compoundKey);
            }
            return;
        }

        if (type === 'render') {
            // Render-only — handled by post-action render(); avoid no-op effect plumbing.
            return;
        }

        if (type === 'timer.clear') {
            // Cancel every in-flight effect (including the 5s buzzed answer-timer)
            // so its onTimeout / EFFECT_COMPLETE callbacks don't leak into the
            // resolving phase. Without this, the leftover timer was driving phase
            // transitions on a hardcoded 5-second beat regardless of anim length.
            try { EffectManager.cancelAllEffects('timer.clear'); } catch (e) {}
            if (state && state.effects && state.effects.activeIds) state.effects.activeIds.clear();
            return;
        }

        if (type === 'sound') {
            // Play synthesized beep immediately. Doesn't block phase advancement
            // (anim effect emits the EFFECT_COMPLETE that drives the next phase).
            _beep(effect.name);
            return;
        }

        // Translate the reducer's named anim effects into dynamic-state updates +
        // EffectManager dynamic ticks (I-5). Anim/sound that aren't dynamic-related
        // still complete via the generic path below.
        if (type === 'anim' && state) {
            if (effect.name === 'startDynamic') {
                state.dynamic.phase = 'playing';
                state.dynamic.elapsedMs = 0;
                state.dynamic.completeStateReached = false;
                const variantDef = (typeof DynamicVariants !== 'undefined' && DynamicVariants[effect.variant]) || null;
                const durationMs = variantDef ? variantDef.durationMs : 8000;
                EffectManager.runDynamicEffect(
                    { op: 'play', variant: effect.variant, durationMs: durationMs,
                      onTick: function (ms) { if (state && state.dynamic) { state.dynamic.elapsedMs = ms; _updateDynamicVisual(); } },
                      onCompleteStateReached: function () { dispatch({ type: 'DYNAMIC_COMPLETE' }); } },
                    function (completedId) { dispatch({ type: 'EFFECT_COMPLETE', effectId: completedId }); }
                );
                return;
            }
            if (effect.name === 'pauseDynamic') {
                if (state.dynamic) state.dynamic.phase = 'paused';
                EffectManager.cancelAllEffects('dynamic-pause');
                return;
            }
            if (effect.name === 'resumeDynamic') {
                if (state.dynamic) state.dynamic.phase = 'playing';
                const variant = state.dynamic.variant;
                const variantDef = (typeof DynamicVariants !== 'undefined' && DynamicVariants[variant]) || null;
                const durationMs = variantDef ? variantDef.durationMs : 8000;
                EffectManager.runDynamicEffect(
                    { op: 'resume', variant: variant, durationMs: durationMs,
                      startElapsedMs: state.dynamic.elapsedMs || 0,
                      onTick: function (ms) { if (state && state.dynamic) { state.dynamic.elapsedMs = ms; _updateDynamicVisual(); } },
                      onCompleteStateReached: function () { dispatch({ type: 'DYNAMIC_COMPLETE' }); } },
                    function (completedId) { dispatch({ type: 'EFFECT_COMPLETE', effectId: completedId }); }
                );
                return;
            }
            if (effect.name === 'playDynamicToCompleteState') {
                if (state.dynamic) state.dynamic.phase = 'playingToComplete';
                const variant = state.dynamic.variant;
                const variantDef = (typeof DynamicVariants !== 'undefined' && DynamicVariants[variant]) || null;
                const fullDurationMs = variantDef ? variantDef.durationMs : 8000;
                let durationMs = fullDurationMs;
                let fastForwardFromMs = null;
                let fastForwardWindowMs = null;
                if (typeof effect.fastForwardMs === 'number' && state.dynamic) {
                    const elapsed = state.dynamic.elapsedMs || 0;
                    fastForwardFromMs = elapsed;
                    fastForwardWindowMs = Math.max(1, effect.fastForwardMs);
                    durationMs = Math.min(durationMs, elapsed + Math.max(0, effect.fastForwardMs));
                }
                EffectManager.runDynamicEffect(
                    { op: 'playToComplete', variant: variant, durationMs: durationMs,
                      startElapsedMs: state.dynamic.elapsedMs || 0,
                      onTick: function (ms) {
                          if (state && state.dynamic) {
                              if (fastForwardFromMs !== null && fastForwardWindowMs !== null) {
                                  const p = Math.min(1, Math.max(0, (ms - fastForwardFromMs) / fastForwardWindowMs));
                                  state.dynamic.elapsedMs = fastForwardFromMs + (fullDurationMs - fastForwardFromMs) * p;
                              } else {
                                  state.dynamic.elapsedMs = ms;
                              }
                              _updateDynamicVisual();
                          }
                      },
                      onCompleteStateReached: function () {
                          if (state && state.dynamic) {
                              state.dynamic.elapsedMs = fullDurationMs;
                              state.dynamic.completeStateReached = true;
                              state.dynamic.phase = 'completed';
                              _updateDynamicVisual();
                          }
                      } },
                    function (completedId) { dispatch({ type: 'EFFECT_COMPLETE', effectId: completedId }); }
                );
                return;
            }
            if (effect.name === 'freezeAtCompleteState') {
                if (state.dynamic) { state.dynamic.phase = 'completed'; state.dynamic.completeStateReached = true; }
                return;
            }
            // Other anim names (markChosen, correctHighlight, revealCorrect, lockoutLoser):
            // CSS already paints them via state→class rules. Use the generic timer path.
        }

        // For everything else (sound / anim / timer / dynamic) → EffectManager.
        let runId;
        try {
            runId = EffectManager.runEffect(effect, function (completedId) {
                // Timer effect: synthesise the chosen onTimeout action.
                if (type === 'timer' && effect.onTimeout) {
                    dispatch(effect.onTimeout);
                }
                dispatch({ type: 'EFFECT_COMPLETE', effectId: completedId });
            });
        } catch (e) {
            if (typeof console !== 'undefined') console.warn('[game-v2] effect run failed', effect, e);
            // Synthesise immediate completion to avoid stuck phase.
            dispatch({ type: 'EFFECT_COMPLETE', effectId: -1 });
            return;
        }
        if (typeof runId === 'number' && state && state.effects && state.effects.activeIds) {
            state.effects.activeIds.add(runId);
        }
    }

    function clearTransientUI() {
        // Per state→class table: clear all .eliminated/.wrong-chosen/.correct-reveal/.correct-chosen on options;
        // hide hint bubble; remove buzz-owner-* classes from #game-buzz; clear feedback overlay.
        const opts = document.querySelectorAll('#game-options .option-btn, #game-options-p2 .option-btn');
        for (let i = 0; i < opts.length; i++) {
            opts[i].classList.remove('eliminated', 'wrong-chosen', 'correct-reveal', 'correct-chosen');
        }
        const buzz = document.getElementById('game-buzz');
        if (buzz) buzz.classList.remove('buzz-open', 'buzz-owner-p1', 'buzz-owner-p2');
        const hint = document.getElementById('game-hint-bubble');
        _quickHintOpen = false;
        _clearHintFlash();
        if (hint) { hint.classList.remove('visible', 'quick-hint'); hint.textContent = ''; }
        const img = document.getElementById('game-image');
        if (img) {
            img.classList.remove('dyn-zoom', 'dyn-blur', 'dyn-rotate-zoom', 'dyn-playing', 'dyn-paused', 'dyn-completing', 'dyn-complete');
            img.style.transform = '';
            img.style.filter = '';
        }
        const pct = document.getElementById('dynamic-score-pct');
        if (pct) {
            pct.textContent = '';
            pct.removeAttribute('aria-label');
            pct.classList.remove('visible', 'urgent');
        }
        const fb = document.getElementById('feedback-overlay');
        if (fb) { fb.classList.remove('show-correct', 'show-wrong'); fb.textContent = ''; }
        // Stop buzz countdown + clear handoff overlay
        _stopBuzzedTickLoop();
        if (state && state.buzz) { state.buzz.timerStartedAt = 0; state.buzz._isHandoff = false; }
    }

    function resetRuntimeAfterLeavingGame() {
        if (!state) return;
        state.phase = 'idle';
        state.globalInputLocked = false;
        if (state.effects && state.effects.activeIds) state.effects.activeIds.clear();
        if (state.buzz) {
            state.buzz.owner = null;
            state.buzz.eligible = new Set(['p1', 'p2']);
            state.buzz.timerId = null;
            state.buzz.timerStartedAt = 0;
            state.buzz._isHandoff = false;
        }
        if (state.dynamic) {
            state.dynamic.phase = 'inactive';
            state.dynamic.elapsedMs = 0;
            state.dynamic.completeStateReached = false;
        }
        if (state.question) {
            _activeWrongHintKey = '';
            state.question.lastChosenWrongKey = null;
            if (state.question.eliminatedWrongKeys) state.question.eliminatedWrongKeys.clear();
            if (state.question.failedPlayersThisCycle) state.question.failedPlayersThisCycle.clear();
        }
    }

    // -----------------------------------------------------------------------
    // 2. Render
    // -----------------------------------------------------------------------
    function render() {
        if (typeof document === 'undefined') return;
        document.body.classList.add('v2-active');
        if (document.documentElement) document.documentElement.classList.add('v2-active');

        // Show only the active screen.
        const screens = document.querySelectorAll('#v2-root .screen');
        for (let i = 0; i < screens.length; i++) {
            const id = screens[i].id;
            const wanted = 'screen-' + _currentScreen;
            screens[i].classList.toggle('is-active', id === wanted);
        }

        // Body phase classes (state → class)
        document.body.classList.remove(
            'phase-resolving-correct', 'phase-resolving-wrong',
            'phase-revealing', 'phase-revealed', 'phase-cleanup',
            'phase-buzzed', 'buzz-owner-p1', 'buzz-owner-p2', 'input-locked'
        );
        if (state) {
            if (state.phase === 'resolvingCorrect') document.body.classList.add('phase-resolving-correct');
            if (state.phase === 'resolvingWrong') document.body.classList.add('phase-resolving-wrong');
            if (state.phase === 'revealing') document.body.classList.add('phase-revealing');
            if (state.phase === 'revealed') document.body.classList.add('phase-revealed');
            if (state.phase === 'cleanup') document.body.classList.add('phase-cleanup');
            if (state.phase === 'buzzed') {
                document.body.classList.add('phase-buzzed');
                if (state.buzz && state.buzz.owner === 'p1') document.body.classList.add('buzz-owner-p1');
                if (state.buzz && state.buzz.owner === 'p2') document.body.classList.add('buzz-owner-p2');
            }
            if (state.globalInputLocked) document.body.classList.add('input-locked');
        }

        switch (_currentScreen) {
            case 'main-menu': renderMainMenu(); break;
            case 'sub-menu': renderSubMenu(); break;
            case 'game': renderGameScreen(); break;
            case 'settle': UISettle.render(); break;
            case 'codex': UICodex.render(); break;
            case 'wrong-book': UIWrongBook.render(); break;
            case 'settings': UISettings.render(); break;
            case 'story': UIStory.renderStory(); break;
        }
        UIStory.renderTutorialModal();
        renderConfirmModal();
        renderDevBanner();
        syncHatChars();  // 依皮膚設定同步所有 .hat-char（切換 hat/grimoire 後重繪）
    }

    function renderMainMenu() {
        const molEl = document.getElementById('main-menu-mol-progress');
        const correctEl = document.getElementById('main-menu-correct-total');
        const save = (typeof Save !== 'undefined' && Save.get) ? Save.get() : {};

        if (correctEl) {
            correctEl.textContent = String(save.totalCorrect || save.correctTotal || 0);
        }

        if (molEl && typeof Families !== 'undefined' && typeof QuestionImages !== 'undefined' && typeof AnswerBank !== 'undefined') {
            const unlocked = save.unlockedMols || [];
            let total = 0;
            let seen = 0;
            const famKeys = Object.keys(Families);
            for (let i = 0; i < famKeys.length; i++) {
                const items = _famCompoundKeys(Families[famKeys[i]]);
                total += items.length;
                for (let j = 0; j < items.length; j++) {
                    if (unlocked.indexOf(items[j].ck) !== -1) seen++;
                }
            }
            molEl.textContent = seen + ' / ' + total;
        }
    }

    // Sub-menu kinds:
    //   'difficulty'           { difficulty }   → family list, click starts practice
    //   'duelFamily'           { difficulty }   → family list, with opponent picker, click starts duel
    //   'tutorialModules'      {}               → tutorial module picker
    //   'duelOpponentSetting'  {}               → PvP / PvE 易/中/難 picker, saves to
    //                                             settings.duelOpponent. NOT in the start-game flow.
    function renderSubMenu() {
        const titleEl = document.getElementById('sub-menu-title');
        const listEl = document.getElementById('sub-menu-list');
        if (!titleEl || !listEl) return;
        listEl.innerHTML = '';
        if (!_subMenuContext) return;

        const diffName = function (d) {
            return { beginner: '初級', intermediate: '中級', advanced: '高級' }[d] || d;
        };

        function setMenuButtonContent(btn, tag, label) {
            btn.innerHTML = '';
            if (tag) {
                const tagEl = document.createElement('span');
                tagEl.className = 'level-tag';
                tagEl.textContent = tag;
                btn.appendChild(tagEl);
            }
            const nameEl = document.createElement('span');
            nameEl.className = 'level-name';
            nameEl.textContent = label;
            btn.appendChild(nameEl);
        }

        function appendFamilyButton(fk, diff, tag, onClick) {
            const btn = document.createElement('button');
            let label = Families[fk].nameZh;
            if (typeof QuestionEngine !== 'undefined' && QuestionEngine.getQuestionSet) {
                const totalQs = QuestionEngine.getQuestionSet(fk, diff).length;
                const askedSize = (typeof Save !== 'undefined' && Save.getAskedHistory)
                    ? Save.getAskedHistory(fk, diff).size : 0;
                if (totalQs > 0) {
                    label += '  （' + Math.min(askedSize, totalQs) + ' / ' + totalQs + ' 題）';
                }
            }
            setMenuButtonContent(btn, tag, label);
            if (typeof Save !== 'undefined' && Save.isSubLevelCleared && Save.isSubLevelCleared(fk, diff)) {
                btn.classList.add('sub-cleared');
            }
            btn.addEventListener('click', onClick);
            return btn;
        }

        function appendDifficultyButton(diff, tag, onClick) {
            const btn = document.createElement('button');
            setMenuButtonContent(btn, tag, diffName(diff));
            btn.addEventListener('click', onClick);
            listEl.appendChild(btn);
        }

        if (_subMenuContext.kind === 'difficulty') {
            const diff = _subMenuContext.difficulty;
            titleEl.textContent = diffName(diff) + ' 練習 — 選擇主題子關';
            const familyKeys = Object.keys(Families).filter(k => Families[k].difficulties.indexOf(diff) !== -1);
            for (let i = 0; i < familyKeys.length; i++) {
                const fk = familyKeys[i];
                const btn = appendFamilyButton(fk, diff, '', function () {
                    startMode({ mode: 'practice', family: fk, difficulty: diff, opponent: 'human' });
                });
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duelFamily') {
            const diff = _subMenuContext.difficulty;
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            let opponent = settings.duelOpponent || 'aiMedium';
            titleEl.textContent = diffName(diff) + ' 巫師對決 — 選擇主題子關';

            const opponents = [
                { key: 'human', label: 'PvP' },
                { key: 'aiEasy', label: 'PvE 易' },
                { key: 'aiMedium', label: 'PvE 中' },
                { key: 'aiHard', label: 'PvE 難' },
            ];
            const modeToggle = document.createElement('div');
            modeToggle.className = 'v2-duel-mode-toggle';
            modeToggle.setAttribute('role', 'group');
            modeToggle.setAttribute('aria-label', '對決對手模式');
            for (let i = 0; i < opponents.length; i++) {
                const op = opponents[i];
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'v2-duel-mode-option';
                btn.textContent = op.label;
                btn.setAttribute('aria-pressed', op.key === opponent ? 'true' : 'false');
                if (op.key === opponent) btn.classList.add('is-active');
                btn.addEventListener('click', function () {
                    opponent = op.key;
                    if (typeof Save !== 'undefined' && Save.writeSettings) {
                        Save.writeSettings({ duelOpponent: op.key });
                    }
                    renderSubMenu();
                });
                modeToggle.appendChild(btn);
            }
            listEl.appendChild(modeToggle);

            const familyKeys = Object.keys(Families).filter(k => Families[k].difficulties.indexOf(diff) !== -1);
            for (let i = 0; i < familyKeys.length; i++) {
                const fk = familyKeys[i];
                const btn = appendFamilyButton(fk, diff, '', function () {
                    startMode({ mode: 'duel', family: fk, difficulty: diff, opponent: opponent });
                });
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duelOpponentSetting') {
            titleEl.textContent = '對決 — 選擇對手模式（會記住下次自動使用）';
            const opponents = [
                { key: 'human', label: '1. PvP（雙人）' },
                { key: 'aiEasy', label: '2. PvE 易' },
                { key: 'aiMedium', label: '3. PvE 中' },
                { key: 'aiHard', label: '4. PvE 難' },
            ];
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const current = settings.duelOpponent || 'aiMedium';
            for (let i = 0; i < opponents.length; i++) {
                const op = opponents[i];
                const btn = document.createElement('button');
                setMenuButtonContent(btn, '', op.label.replace(/^\d+\.\s*/, '') + (op.key === current ? '  ✓' : ''));
                if (op.key === current) btn.classList.add('sub-cleared');
                btn.addEventListener('click', function () {
                    if (typeof Save !== 'undefined' && Save.writeSettings) {
                        Save.writeSettings({ duelOpponent: op.key });
                    }
                    goToScreen('main-menu');
                });
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'tutorialModules') {
            titleEl.textContent = '新手導覽 — 選擇教學關卡';
            const modules = (typeof TutorialModules !== 'undefined') ? TutorialModules : {};
            const order = ['hydrocarbon', 'oxygen', 'nitrogenHalide', 'aromatic', 'practiceControls', 'duelControls', 'wizardDuel'];
            for (let i = 0; i < order.length; i++) {
                const key = order[i];
                const mod = modules[key];
                if (!mod || !Array.isArray(mod.pages) || !mod.pages.length) continue;
                const btn = document.createElement('button');
                setMenuButtonContent(btn, '', mod.title || key);
                btn.addEventListener('click', function () {
                    UIStory.openTutorialPages(mod.pages, 'module:' + key, function () { goToScreen('sub-menu'); });
                });
                listEl.appendChild(btn);
            }
        }
    }

    function renderGameScreen() {
        if (!state) return;
        const game = document.getElementById('screen-game');
        if (!game) return;

        // Mode classes
        game.classList.remove('mode-practice', 'mode-duel', 'mode-duel-pvp', 'mode-duel-pve');
        if (state.mode === 'practice') {
            game.classList.add('mode-practice');
        } else if (state.mode === 'duel') {
            game.classList.add('mode-duel');
            game.classList.add(state.opponent === 'human' ? 'mode-duel-pvp' : 'mode-duel-pve');
        }

        // HUD scores / streak / combo
        ['p1', 'p2'].forEach(function (p) {
            const area = game.querySelector('.player-area[data-player="' + p + '"]');
            if (!area) return;
            const player = state.players && state.players[p];
            if (!player) return;
            const scoreEl = area.querySelector('[data-field="score"]');
            const streakEl = area.querySelector('[data-field="streak"]');
            const comboEl = area.querySelector('[data-field="combo-level"]');
            const score = player.score || 0;
            const target = state.mode === 'duel'
                ? ((typeof DuelDynamicRules !== 'undefined' && DuelDynamicRules.scoreTarget) ? DuelDynamicRules.scoreTarget : 300)
                : ((state.round && state.round.size) ? state.round.size * 10 : 100);
            const fill = target > 0 ? Math.max(0, Math.min(1, score / target)) : 0;
            if (scoreEl) scoreEl.textContent = String(score);
            area.style.setProperty('--score-fill', String(fill));
            if (streakEl) streakEl.textContent = (player.correctStreak > 0) ? ('連對 ' + player.correctStreak) : '';
            if (comboEl) comboEl.textContent = _comboLevel(player.correctStreak);
            area.classList.toggle('locked-area', !!player.isLocked);
        });

        const oppEl = document.getElementById('opponent-label');
        if (oppEl) {
            if (state.mode === 'duel' && state.opponent && state.opponent !== 'human') {
                const map = { aiEasy: '易', aiMedium: '中', aiHard: '難' };
                oppEl.textContent = 'AI: ' + (map[state.opponent] || state.opponent);
            } else {
                oppEl.textContent = '';
            }
        }

        const modeLabel = document.getElementById('game-mode-label');
        const questionLabel = document.getElementById('game-question-label');
        const progressEl = document.getElementById('game-question-progress');
        if (modeLabel) modeLabel.textContent = state.mode === 'duel' ? '雙人決鬥' : '自我修煉';
        if (questionLabel) {
            const diff = (typeof Difficulties !== 'undefined') ? Difficulties[state.difficulty] : null;
            const answerType = diff ? diff.answerType : 'categoryZh';
            questionLabel.textContent = answerType === 'compound'
                ? '這個有機分子的化學式是甚麼?'
                : '這是甚麼類別的有機分子?';
        }
        if (progressEl) {
            const asked = Math.max(1, state.players && state.players.p1 ? (state.players.p1.totalAsked || 1) : 1);
            const total = state.round && state.round.size ? state.round.size : Math.max(asked, asked + (state.queue ? state.queue.length : 0));
            progressEl.textContent = Math.min(asked, total) + ' / ' + total;
        }
        _renderQuickHint();

        // Question image
        const imgEl = document.getElementById('game-image');
        if (imgEl) {
            const q = state.question && state.question.current;
            if (q && q.qContent) {
                if (imgEl.getAttribute('src') !== q.qContent) imgEl.setAttribute('src', q.qContent);
            }
            // Dynamic variant classes
            if (state.dynamic) {
                imgEl.classList.remove('dyn-zoom', 'dyn-blur', 'dyn-rotate-zoom');
                if (state.dynamic.variant === 'zoom') imgEl.classList.add('dyn-zoom');
                else if (state.dynamic.variant === 'blur') imgEl.classList.add('dyn-blur');
                else if (state.dynamic.variant === 'rotateZoom') imgEl.classList.add('dyn-rotate-zoom');
                imgEl.classList.toggle('dyn-playing', state.dynamic.phase === 'playing');
                imgEl.classList.toggle('dyn-paused', state.dynamic.phase === 'paused');
                imgEl.classList.toggle('dyn-completing', state.dynamic.phase === 'playingToComplete');
                imgEl.classList.toggle('dyn-complete', !!state.dynamic.completeStateReached);
            }
            _updateDynamicVisual();
        }

        // Options: render only when phase indicates options should be visible.
        // Practice: visible whenever question exists. Duel: visible only while phase===buzzed (and shown to owner only) or revealing.
        const optContainers = Array.from(document.querySelectorAll('#screen-game .v2-options'));
        if (optContainers.length && state.question && state.question.options) {
            const showOptions = (state.mode === 'practice')
                || (state.mode === 'duel'
                    && (state.phase === 'buzzed' || state.phase === 'revealing' || state.phase === 'revealed'
                        || state.phase === 'resolvingCorrect' || state.phase === 'resolvingWrong'));
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const keybindings = settings.keybindings || {};

            for (let c = 0; c < optContainers.length; c++) {
                const container = optContainers[c];
                const isP2 = container.classList.contains('v2-options-p2');
                const isDuel = state.mode === 'duel';
                const owner = state.buzz && state.buzz.owner;
                const ownerSideVisible = !isDuel
                    || ((isP2 && owner === 'p2') || (!isP2 && owner === 'p1'));
                const containerPlayer = isP2 ? 'p2' : 'p1';
                const feedbackApplies = !isDuel || !_lastAnswerPlayer || _lastAnswerPlayer === containerPlayer;
                container.style.visibility = (showOptions && ownerSideVisible) ? 'visible' : 'hidden';
                container.setAttribute('aria-hidden', (!showOptions || !ownerSideVisible) ? 'true' : 'false');
                const btns = container.querySelectorAll('.option-btn');
                for (let i = 0; i < btns.length; i++) {
                    const opt = state.question.options[i];
                    if (opt) {
                        btns[i].setAttribute('data-option-key', opt.key);
                        const leftKey = _formatKeyCode(keybindings['optionLeft' + i]);
                        const rightKey = _formatKeyCode(keybindings['optionRight' + i]);
                        const keyHtml = isDuel && isP2
                            ? '<span class="option-label">' + _escapeHtml(opt.content || '') + '</span><span class="option-key-hint">[' + _escapeHtml(rightKey) + ']</span>'
                            : isDuel
                                ? '<span class="option-key-hint">[' + _escapeHtml(leftKey) + ']</span><span class="option-label">' + _escapeHtml(opt.content || '') + '</span>'
                                : '<span class="option-key-hint">[' + _escapeHtml(leftKey) + ']</span><span class="option-label">' + _escapeHtml(opt.content || '') + '</span><span class="option-key-hint">[' + _escapeHtml(rightKey) + ']</span>';
                        btns[i].innerHTML = keyHtml;
                        btns[i].classList.toggle('eliminated',
                            feedbackApplies &&
                            state.question.eliminatedWrongKeys && state.question.eliminatedWrongKeys.has
                                && state.question.eliminatedWrongKeys.has(opt.key)
                                && opt.key !== state.question.lastChosenWrongKey);
                        btns[i].classList.toggle('wrong-chosen',
                            feedbackApplies && opt.key === state.question.lastChosenWrongKey);
                        btns[i].classList.toggle('correct-reveal',
                            (state.phase === 'revealing' || state.phase === 'revealed')
                            && opt.key === state.question.correctKey);
                        btns[i].classList.toggle('correct-chosen',
                            feedbackApplies && state.phase === 'resolvingCorrect' && opt.key === state.question.correctKey);
                    } else {
                        btns[i].setAttribute('data-option-key', '');
                        btns[i].innerHTML = '';
                        btns[i].classList.remove('eliminated', 'wrong-chosen', 'correct-reveal');
                    }
                }
            }
        }

        // Buzz visibility / state. Per the reducer truth table:
        //   state.phase === 'buzzOpen' → both players eligible to buzz
        //   state.phase === 'buzzed'   → one owner (state.buzz.owner) acts
        const buzz = document.getElementById('game-buzz');
        if (buzz) {
            const isDuel = state.mode === 'duel';
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const keybindings = settings.keybindings || {};
            const p1BuzzKey = _formatKeyCode(keybindings.buzzP1 || 'Space');
            const p2BuzzKey = _formatKeyCode(keybindings.buzzP2 || 'Enter');
            const p1BuzzBtn = document.getElementById('buzz-p1');
            if (p1BuzzBtn) p1BuzzBtn.textContent = 'P1 搶答 [' + p1BuzzKey + ']';
            buzz.style.display = isDuel ? 'flex' : 'none';
            buzz.classList.toggle('buzz-open', state.phase === 'buzzOpen');
            buzz.classList.toggle('buzz-owner-p1', state.phase === 'buzzed' && state.buzz && state.buzz.owner === 'p1');
            buzz.classList.toggle('buzz-owner-p2', state.phase === 'buzzed' && state.buzz && state.buzz.owner === 'p2');
            // PvE: hide the P2 buzz button (AI owns p2; human shouldn't be able
            // to steal it via mouse click). PvP: show both.
            const p2Btn = document.getElementById('buzz-p2');
            if (p2Btn) {
                p2Btn.textContent = 'P2 搶答 [' + p2BuzzKey + ']';
                p2Btn.style.display = (isDuel && state.opponent === 'human') ? '' : 'none';
            }
        }

        // Spin up / tear down the buzzed-phase rAF loop based on current phase.
        if (state.phase === 'buzzed') {
            _startBuzzedTickLoop();
        } else {
            _stopBuzzedTickLoop();
        }

        _syncTutorialBtn();
        _updateFeedbackOverlay();
        _checkComboPopup();
    }

    // ---- Audio feedback ---------------------------------------------------
    // Thin compatibility wrappers while gameplay migrates to AudioManager.
    function _beep(name) {
        if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
            AudioManager.playSound(name);
        }
    }
    function _teardownAudio() {
        if (typeof AudioManager !== 'undefined' && AudioManager.teardown) {
            AudioManager.teardown();
        }
    }
    function _syncMusicForScreen(screenId) {
        if (typeof AudioManager !== 'undefined' && AudioManager.syncMusicForScreen) {
            AudioManager.syncMusicForScreen(screenId);
        }
    }
    function _armMusicUnlock() {
        if (typeof AudioManager !== 'undefined' && AudioManager.armUnlock) {
            AudioManager.armUnlock(function () { return _currentScreen; });
        }
    }

    // Show/hide the big center "答對 / 答錯 / 逾時 / 放棄" overlay based on phase.
    // For resolvingWrong, distinguish wrong-pick vs timeout vs give-up via
    // state.question.lastResolveReason (set by the reducer).
    function _updateFeedbackOverlay() {
        const el = document.getElementById('feedback-overlay');
        if (!el) return;
        el.classList.remove('show-correct', 'show-wrong');
        if (!state) { el.textContent = ''; return; }
        if (state.phase === 'resolvingCorrect') {
            el.innerHTML = '<span>Correct</span><strong>答對</strong><small>繼續保持</small>';
            el.classList.add('show-correct');
        } else if (state.phase === 'resolvingWrong') {
            const reason = state.question && state.question.lastResolveReason;
            const label = reason === 'timeout' ? 'Timeout'
                        : reason === 'giveup' ? 'Give Up'
                        : 'Wrong';
            const text = reason === 'timeout' ? '逾時'
                       : reason === 'giveup' ? '放棄'
                       : '答錯';
            el.innerHTML = '<span>' + label + '</span><strong>' + text + '</strong><small>再觀察一次</small>';
            el.classList.add('show-wrong');
        } else {
            el.textContent = '';
        }
    }

    // 提示泡泡內容（由「看教學」按鈕切換）。一律顯示當題正解類別的
    // 「辨識重點＋常見陷阱＋官能基小圖」；查無對應提示才用通用提示。
    // 回傳 HTML 字串（動態文字均已跳脫）。
    function _quickHintText() {
        const q = state && state.question ? state.question.current : null;
        if (q && typeof AnswerBank !== 'undefined' && AnswerBank[q.compoundKey]
            && typeof WhyHints !== 'undefined' && WhyHints[AnswerBank[q.compoundKey].category]) {
            const wh = WhyHints[AnswerBank[q.compoundKey].category];
            const img = wh.fg ? '<img class="why-hint-img" src="' + _escapeHtml(wh.fg) + '" alt="">' : '';
            const trap = wh.trap ? '<span class="why-hint-trap">⚠ ' + _escapeHtml(wh.trap) + '</span>' : '';
            return '<div class="why-hint-row">' + img +
                '<div class="why-hint-text"><strong>「' + _escapeHtml(wh.zh) + '」怎麼認：</strong>' +
                _escapeHtml(wh.key) + trap + '</div></div>';
        }
        return _escapeHtml(state && state.mode === 'duel'
            ? '看清楚分子特徵後再搶答；搶答後只有目前搶答方可以作答。'
            : '先找最明顯的官能基，再比對選項；答錯可以再觀察一次。');
    }
    function _renderQuickHint() {
        const hint = document.getElementById('game-hint-bubble');
        if (!hint) return;
        const html = _quickHintOpen ? _quickHintText() : '';
        hint.classList.toggle('visible', !!html);
        hint.classList.toggle('quick-hint', !!html);
        hint.setAttribute('aria-live', 'polite');
        if (html) hint.innerHTML = html; else hint.textContent = '';
    }
    function _toggleQuickHint() {
        _quickHintOpen = !_quickHintOpen;
        if (_quickHintOpen) {
            // 按開提示：立刻停止閃爍，並記住已看過這次答錯（關閉後不再重閃）。
            _lastFlashedWrongKey = _activeWrongHintKey || null;
            const btn = document.querySelector('[data-action="show-tutorial"]');
            if (btn) {
                const label = btn.querySelector('.v2-game-tutorial-label');
                if (label) label.classList.remove('hint-flash-text');
            }
        }
        _renderQuickHint();
    }

    // 移除「看教學」按鈕的閃爍狀態，並重置閃爍追蹤（下次答錯可重新閃）。
    function _clearHintFlash() {
        _lastFlashedWrongKey = null;
        const btn = document.querySelector('[data-action="show-tutorial"]');
        if (btn) {
            const label = btn.querySelector('.v2-game-tutorial-label');
            if (label) label.classList.remove('hint-flash-text');
        }
    }

    // 同步「看教學」按鈕：沒有教學就隱藏；答錯後讓文字閃爍 4 次，
    // 提醒學生可以按提示看辨識重點。遊戲畫面與結算畫面共用。
    function _syncTutorialBtn() {
        const tutBtn = document.querySelector('[data-action="show-tutorial"]');
        if (!tutBtn) return;
        const pages = (state && state.family && state.difficulty)
            ? UIStory.pagesFor(state.family, state.difficulty) : null;
        const hasTut = !!(pages && pages.length > 0);
        tutBtn.style.display = hasTut ? '' : 'none';

        const wrongKey = _activeWrongHintKey || '';
        const label = tutBtn.querySelector('.v2-game-tutorial-label');
        if (!label) return;
        if (_quickHintOpen || !hasTut || !wrongKey) {
            label.classList.remove('hint-flash-text');
        } else if (wrongKey !== _lastFlashedWrongKey) {
            label.classList.remove('hint-flash-text');
            void tutBtn.offsetWidth;  // 強制 reflow 以重播動畫
            label.classList.add('hint-flash-text');
        }
        _lastFlashedWrongKey = wrongKey || null;
    }

    // ---- Buzz countdown + handoff overlay (rAF loop) --------------------
    // render() only fires on dispatch, so a per-second countdown would tick
    // jerkily. We run a lightweight rAF loop while phase===buzzed that updates
    // #buzz-countdown (7→1, big red number) and fades #handoff-overlay.
    // Loop self-terminates when phase leaves 'buzzed'.
    let _buzzedTickRafId = null;
    let _lastBuzzCountdownSoundKey = '';
    function _startBuzzedTickLoop() {
        if (_buzzedTickRafId !== null) return;
        function tick() {
            if (!state || state.phase !== 'buzzed' || !state.buzz || !state.buzz.timerStartedAt) {
                _buzzedTickRafId = null;
                _lastBuzzCountdownSoundKey = '';
                _hideBuzzedUI();
                return;
            }
            const elapsed = Date.now() - state.buzz.timerStartedAt;
            const remaining = Math.max(0, 7000 - elapsed);
            const sec = Math.ceil(remaining / 1000);
            const countdownSoundKey = state.buzz.timerStartedAt + ':' + sec;
            if (sec > 0 && sec <= 3 && countdownSoundKey !== _lastBuzzCountdownSoundKey) {
                _lastBuzzCountdownSoundKey = countdownSoundKey;
                _beep('timeout');
            }
            const cd = document.getElementById('buzz-countdown');
            const side = state.buzz.owner === 'p1' ? 'left' : 'right';
            if (cd) {
                cd.textContent = String(sec);
                cd.classList.toggle('urgent', sec <= 2);
                cd.classList.add('visible');
                // P1/P2 對等：倒數顯示在當前 owner 那一側
                cd.setAttribute('data-side', side);
            }
            const giveup = document.getElementById('btn-giveup');
            if (giveup) {
                // PvE: don't let human give up on AI's behalf when AI owns buzz.
                const ownerIsAI = state.opponent !== 'human' && state.buzz.owner === 'p2';
                if (ownerIsAI) {
                    giveup.classList.remove('visible');
                } else {
                    const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
                    const keybindings = settings.keybindings || {};
                    const key = state.buzz.owner === 'p1'
                        ? _formatKeyCode(keybindings.giveUpP1 || 'KeyV')
                        : _formatKeyCode(keybindings.giveUpP2 || 'Backslash');
                    giveup.textContent = '取消[' + key + ']';
                    giveup.classList.add('visible');
                    giveup.setAttribute('data-side', side);
                }
            }
            const handoff = document.getElementById('handoff-overlay');
            if (handoff) {
                if (state.buzz._isHandoff && elapsed < 1000) {
                    handoff.textContent = '換 ' + (state.buzz.owner === 'p1' ? '左方' : '右方') + ' 答';
                    handoff.setAttribute('data-side', side);
                    handoff.style.opacity = String(Math.max(0, 1 - elapsed / 800));
                    handoff.classList.add('visible');
                } else {
                    handoff.classList.remove('visible');
                    handoff.removeAttribute('data-side');
                    handoff.style.opacity = '0';
                    if (state.buzz._isHandoff) state.buzz._isHandoff = false;
                }
            }
            _buzzedTickRafId = requestAnimationFrame(tick);
        }
        _buzzedTickRafId = requestAnimationFrame(tick);
    }
    function _stopBuzzedTickLoop() {
        if (_buzzedTickRafId !== null) {
            cancelAnimationFrame(_buzzedTickRafId);
            _buzzedTickRafId = null;
        }
        _hideBuzzedUI();
    }
    function _hideBuzzedUI() {
        const cd = document.getElementById('buzz-countdown');
        if (cd) { cd.classList.remove('visible', 'urgent'); cd.textContent = ''; }
        const handoff = document.getElementById('handoff-overlay');
        if (handoff) { handoff.classList.remove('visible'); handoff.removeAttribute('data-side'); handoff.style.opacity = '0'; handoff.textContent = ''; }
        const giveup = document.getElementById('btn-giveup');
        if (giveup) {
            if (document.activeElement === giveup) giveup.blur();
            giveup.classList.remove('visible');
            giveup.removeAttribute('data-side');
        }
    }

    // Update inline transform/filter on #game-image based on state.dynamic.elapsedMs.
    // Called from render() AND from onTick callbacks (so animation is smooth between dispatches).
    function _updateDynamicVisual() {
        const imgEl = document.getElementById('game-image');
        const pctEl = document.getElementById('dynamic-score-pct');
        if (!imgEl) return;
        if (state && state.dynamic && state.dynamic.variant && state.mode === 'duel') {
            const variant = state.dynamic.variant;
            const v = (typeof DynamicVariants !== 'undefined' && DynamicVariants[variant]) || {};
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const rules = getEffectiveRules(
                (typeof DuelDynamicRules !== 'undefined') ? DuelDynamicRules : {},
                settings
            );
            const dur = rules.dynamicDurationMs || v.durationMs || 8000;
            const t = state.dynamic.completeStateReached
                ? 1
                : Math.min(1, Math.max(0, (state.dynamic.elapsedMs || 0) / dur));
            let transform = '';
            let filter = '';
            if (variant === 'zoom') {
                const initialScale = v.initialScale || 5;
                const finalScale = v.finalScale || 1;
                const scale = initialScale - (initialScale - finalScale) * t;
                transform = 'scale(' + scale + ')';
            } else if (variant === 'blur') {
                const initialBlur = typeof v.initialBlurPx === 'number' ? v.initialBlurPx : 18;
                const finalBlur = typeof v.finalBlurPx === 'number' ? v.finalBlurPx : 0;
                const blur = initialBlur - (initialBlur - finalBlur) * t;
                filter = 'blur(' + blur.toFixed(2) + 'px)';
            } else if (variant === 'rotateZoom') {
                const initialScale = v.initialScale || 2.8;
                const finalScale = v.finalScale || 1;
                const initialRotate = typeof v.initialRotateDeg === 'number' ? v.initialRotateDeg : -18;
                const finalRotate = typeof v.finalRotateDeg === 'number' ? v.finalRotateDeg : 0;
                const scale = initialScale - (initialScale - finalScale) * t;
                const rotate = initialRotate - (initialRotate - finalRotate) * t;
                transform = 'scale(' + scale + ') rotate(' + rotate + 'deg)';
            }
            imgEl.style.transform = transform;
            imgEl.style.filter = filter;
            if (pctEl) {
                const pct = Math.round(t * 100);
                pctEl.textContent = pct + '%';
                pctEl.setAttribute('aria-label', 'Dynamic 效果進度 ' + pct + '%。越早搶答，答對分數越高；答錯扣分也越多。');
                pctEl.classList.toggle('visible', true);
                pctEl.classList.toggle('urgent', pct >= 70);
            }
        } else {
            imgEl.style.transform = '';
            imgEl.style.filter = '';
            if (pctEl) {
                pctEl.textContent = '';
                pctEl.removeAttribute('aria-label');
                pctEl.classList.remove('visible', 'urgent');
            }
        }
    }

    function _comboLevel(streak) {
        if (streak >= 7) return '無敵';
        if (streak >= 5) return '天才';
        if (streak >= 3) return '厲害';
        return '';
    }
    function _comboTier(label) {
        if (label === '無敵') return 'brilliant';
        if (label === '天才') return 'great';
        if (label === '厲害') return 'good';
        return '';
    }
    const _comboSoundByTier = {
        good: 'comboGood',
        great: 'comboGreat',
        brilliant: 'comboBrilliant'
    };

    // Combo popup: large floating text near the player when combo level crosses
    // a threshold upward. Tracks previous combo per player so a sustained streak
    // doesn't re-trigger every frame; resets to '' on cleanup/wrong/new question.
    const _prevCombo = { p1: '', p2: '' };
    function _spawnComboPopup(label, player) {
        if (typeof document === 'undefined') return;
        const tier = _comboTier(label);
        if (!tier) return;
        const el = document.createElement('div');
        el.className = 'combo-popup tier-' + tier;
        if (label === '厲害') {
            el.innerHTML = '<span class="combo-big">厲</span><span class="combo-mid">答對</span><span class="combo-big">害</span>';
        } else {
            el.innerHTML = '<span class="combo-big">' + _escapeHtml(label.charAt(0)) + '</span><span class="combo-mid">答對</span><span class="combo-big">' + _escapeHtml(label.charAt(1)) + '</span>';
        }
        el.setAttribute('aria-label', label + ' 答對');
        const feedback = document.getElementById('feedback-overlay');
        if (feedback) feedback.classList.add('combo-suppressed');
        document.body.appendChild(el);
        // Auto-remove after the CSS animation finishes (1.4s). Doubled timer so
        // late removal doesn't clip the fade-out.
        setTimeout(function () {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            const latestFeedback = document.getElementById('feedback-overlay');
            if (latestFeedback) latestFeedback.classList.remove('combo-suppressed');
        }, 1600);
    }
    function _checkComboPopup() {
        if (!state || !state.players) return;
        ['p1', 'p2'].forEach(function (p) {
            const player = state.players[p];
            if (!player) return;
            const newLabel = _comboLevel(player.correctStreak || 0);
            // Only animate on upward crossing (Good→Great→Brilliant); avoid
            // re-firing when streak holds steady or resets back to 0.
            if (newLabel && newLabel !== _prevCombo[p]) {
                const prevTier = _comboTier(_prevCombo[p]);
                const newTier = _comboTier(newLabel);
                const tierOrder = { good: 1, great: 2, brilliant: 3 };
                if ((tierOrder[newTier] || 0) > (tierOrder[prevTier] || 0)) {
                    _beep(_comboSoundByTier[newTier]);
                    _spawnComboPopup(newLabel, p);
                }
            }
            _prevCombo[p] = newLabel;
        });
    }

    function _findImageFor(compoundKey) {
        if (typeof QuestionImages === 'undefined') return '';
        for (let i = 0; i < QuestionImages.length; i++) {
            if (QuestionImages[i].compoundKey === compoundKey) return QuestionImages[i].src;
        }
        return '';
    }

    // Collect compound keys belonging to a family, based on imageFilter.
    function _famCompoundKeys(fam) {
        const filter = fam.imageFilter || {};
        const out = [];
        for (let i = 0; i < QuestionImages.length; i++) {
            const img = QuestionImages[i];
            const ck = img.compoundKey;
            let inc = false;
            if (filter.type === 'all') inc = true;
            else if (filter.type === 'byCategory') {
                const e = AnswerBank[ck];
                inc = e && filter.categories && filter.categories.includes(e.category);
            } else if (filter.type === 'byCompoundKeys') {
                inc = filter.keys && filter.keys.includes(ck);
            }
            if (inc) out.push({ ck: ck, src: img.src });
        }
        return out;
    }

    // 將 KeyboardEvent.code 轉成顯示文字
    function _formatKeyCode(code) {
        if (!code) return '—';
        if (code.indexOf('Key') === 0)    return code.slice(3);              // KeyA → A
        if (code.indexOf('Digit') === 0)  return code.slice(5);              // Digit4 → 4
        if (code.indexOf('Numpad') === 0) return 'Num ' + code.slice(6);     // Numpad4 → Num 4
        if (code.indexOf('Arrow') === 0)  return '↑↓←→ '.charAt(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(code)) || code;
        if (code === 'Backslash')         return '\\';
        return code;                                                          // Space, Enter, Tab, …
    }

    function _escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Advance to next family/difficulty after settle.
    // Order: iterate Families in declaration order, for each difficulty in
    // [beginner, intermediate, advanced]; after the last → show "all done" alert.
    // Duel mode: "再來一場" (same family+difficulty, same opponent).
    function renderConfirmModal() {
        const modal = document.getElementById('modal-confirm');
        if (!modal) return;
        if (!_pendingConfirm) { modal.classList.remove('is-open'); return; }
        modal.classList.add('is-open');
        const t = document.getElementById('modal-confirm-text');
        if (t) t.textContent = _pendingConfirm.text || '確定？';
    }

    function requestConfirm(text, onYes, onNo) {
        _pendingConfirm = { text: text, onYes: onYes, onNo: onNo || function () {} };
        render();
    }

    function renderDevBanner() {
        const banner = document.getElementById('dev-quickwin-banner');
        if (!banner) return;
        const s = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
        const inGame = (_currentScreen === 'game');
        const show = inGame && s && s.devQuickWin && s.devQuickWin.enabled && s.devQuickWin.showIndicator;
        banner.classList.toggle('visible', !!show);
        if (show) {
            banner.textContent = '🔧 測試模式：答對 ' + s.devQuickWin.winAfter + ' 題即結算';
        }
    }

    // -----------------------------------------------------------------------
    // 3. Mode start
    // -----------------------------------------------------------------------
    function startMode(opts) {
        // Tutorial gate
        if (typeof Save !== 'undefined' && Save.isTutorialSeenV2 && !Save.isTutorialSeenV2(opts.family, opts.difficulty)) {
            if (UIStory.openLevelTutorial(opts.family, opts.difficulty, function () { beginMode(opts); })) {
                return;
            }
        }
        beginMode(opts);
    }

    function _dynamicVariantFor(opts) {
        if (!opts || opts.mode !== 'duel') return null;
        if (opts.dynamicVariant && typeof DynamicVariants !== 'undefined' && DynamicVariants[opts.dynamicVariant]) {
            return opts.dynamicVariant;
        }
        if (opts.difficulty === 'advanced') return 'rotateZoom';
        if (opts.difficulty === 'intermediate') return 'blur';
        return 'zoom';
    }

    function beginMode(opts) {
        // Tear down any prior AI
        if (aiController) { try { aiController.stop(); } catch (e) {} aiController = null; }
        _teardownAudio();

        _wrongChosenMap = {};
        _prevCombo.p1 = '';
        _prevCombo.p2 = '';
        state = GameState.createStateV2();
        state.mode = opts.mode;
        state.family = opts.family;
        state.difficulty = opts.difficulty;
        state.opponent = opts.opponent || 'human';
        state.queueSource = opts.queueSource || 'fresh';

        // Build queue
        if (opts.queueSource === 'wrongOnly') {
            state.queue = _buildQueueFromWrongBook(opts.family, opts.difficulty, opts.wrongKeys);
        } else {
            const asked = (typeof Save !== 'undefined' && Save.getAskedHistory)
                ? Save.getAskedHistory(opts.family, opts.difficulty) : new Set();
            state.queue = QuestionEngine.buildRoundQueueV2({
                family: opts.family, difficulty: opts.difficulty,
                seenSet: asked, wrongSet: new Set(),
                includeUnseen: true, includeWrong: false, limit: 10
            });
            if (!state.queue || state.queue.length === 0) {
                // Fallback: all questions already asked → just shuffle full set.
                state.queue = QuestionEngine.buildRoundQueueV2({
                    family: opts.family, difficulty: opts.difficulty,
                    seenSet: new Set(), wrongSet: new Set(),
                    includeUnseen: true, includeWrong: false, limit: 10
                });
            }
        }
        state.round.size = state.queue ? state.queue.length : 0;

        state.dynamic.variant = _dynamicVariantFor(opts);

        if (opts.mode === 'duel' && opts.opponent && opts.opponent !== 'human') {
            const diffName = opts.opponent.replace('ai', '').toLowerCase(); // aiEasy → easy
            try {
                aiController = new AIController({
                    difficulty: diffName, player: 'p2',
                    dispatch: dispatch, getState: function () { return state; }
                });
                aiController.start();
            } catch (e) {
                if (typeof console !== 'undefined') console.warn('[game-v2] AI start failed', e);
            }
        }

        goToScreen('game');
        // Auto-load first question on enter (applyAction's LOAD_NEXT_QUESTION
        // side-effect will enrich the question and call render).
        dispatch({ type: 'LOAD_NEXT_QUESTION' });
    }

    function _enrichQuestionState() {
        if (!state || !state.question || !state.question.current) return;
        const q = state.question.current;
        state.question.correctKey = q.aKey;
        const diff = (typeof Difficulties !== 'undefined') ? Difficulties[state.difficulty] : null;
        const answerType = diff ? diff.answerType : 'compound';
        const family = state.family;
        state.question.options = QuestionEngine.generateOptions({
            correctAKey: q.aKey,
            answerType: answerType,
            familyScope: family,
            optionCount: 4,
            preferredDistractorCount: (state.difficulty === 'intermediate' || state.difficulty === 'advanced') ? 2 : null
        });
        state.question.eliminatedWrongKeys = new Set();
        state.question.lastChosenWrongKey = null;
        state.question.lastResolveReason = null;
        state.question.failedPlayersThisCycle = new Set();
        // Bookkeeping
        state.players.p1.totalAsked = (state.players.p1.totalAsked || 0) + 1;
        if (state.mode === 'duel') state.players.p2.totalAsked = (state.players.p2.totalAsked || 0) + 1;
        if (state.mode === 'practice') {
            // Practice records "asked" for the clear condition
            if (typeof Save !== 'undefined' && Save.recordAskedV2) {
                Save.recordAskedV2(state.family, state.difficulty, q.compoundKey);
            }
        }
        // Wrong-in-round will be added by SUBMIT_ANSWER handler (we wrap dispatch below).
    }

    function _buildQueueFromWrongBook(family, difficulty, overrideKeys) {
        const active = Array.isArray(overrideKeys) && overrideKeys.length
            ? overrideKeys
            : (typeof Save !== 'undefined' && Save.getActiveWrongs)
            ? Save.getActiveWrongs(family, difficulty) : [];
        if (!active.length) return [];
        const all = QuestionEngine.getQuestionSet(family, difficulty);
        const set = new Set(active);
        return all.filter(function (q) { return set.has(q.compoundKey); });
    }

    function _onEnterSettling() {
        // Persistence: mark sub-level cleared / record round accuracy / dispatch badge unlocks
        if (state.mode !== 'practice') return;
        const attempts = (state.players.p1.correctCount || 0) + (state.players.p1.wrongCount || 0);
        const acc = attempts > 0
            ? state.players.p1.correctCount / attempts
            : null;
        if (typeof Save !== 'undefined') {
            if (acc !== null && Save.recordSubLevelRound) {
                Save.recordSubLevelRound(state.family, state.difficulty, acc);
            }
            if (Save.isSubLevelCleared && Save.isSubLevelCleared(state.family, state.difficulty)) {
                if (Save.markSubLevelClear) Save.markSubLevelClear(state.family, state.difficulty);
                // Explicitly unlock family story on sub-level clear (README §1438-1440).
                if (Save.unlockStoryV2) Save.unlockStoryV2(state.family);
            }
            // dev shortcut also unlocks
            const s = Save.readSettings ? Save.readSettings() : {};
            if (s && s.devQuickWin && s.devQuickWin.enabled) {
                if (Save.markSubLevelClear) Save.markSubLevelClear(state.family, state.difficulty);
                if (Save.unlockStoryV2) Save.unlockStoryV2(state.family);
            }
        }
        // Stop AI if any
        if (aiController) { try { aiController.stop(); } catch (e) {} aiController = null; }
        goToScreen('settle');
    }

    function goToScreen(screenId) {
        _currentScreen = screenId;
        render();
        _syncMusicForScreen(screenId);
        if (_isMenuScreen(screenId)) _focusFirstMenuItem(screenId);
    }

    // ----- 選單方向鍵導航 -----
    const _MENU_SCREEN_IDS = ['main-menu', 'sub-menu', 'settle'];
    function _isMenuScreen(id) {
        return _MENU_SCREEN_IDS.indexOf(id) !== -1;
    }
    function _menuButtons(screenId) {
        const root = document.getElementById('screen-' + screenId);
        if (!root) return [];
        // 收集畫面內所有可見、可互動的 button（含 back btn / 各區段選項）
        const list = root.querySelectorAll('button');
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (b.disabled) continue;
            if (b.offsetParent === null && getComputedStyle(b).position !== 'fixed') continue;
            out.push(b);
        }
        return out;
    }
    function _focusFirstMenuItem(screenId) {
        // 延後到 render() 之後，避免 sub-menu 動態內容尚未掛上
        requestAnimationFrame(function () {
            const btns = _menuButtons(screenId);
            if (btns.length === 0) return;
            // 略過畫面最上方的「返回」按鈕，預設選第一個內容項目
            const target = btns.find(function (b) { return !b.classList.contains('v2-back-btn'); }) || btns[0];
            try { target.focus({ preventScroll: false }); } catch (e) { target.focus(); }
        });
    }
    function _handleMenuArrowNav(e) {
        const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        if (e.code === 'Enter' || e.code === 'Space') {
            const ae = document.activeElement;
            if (ae && ae.tagName === 'BUTTON' && _menuButtons(_currentScreen).indexOf(ae) !== -1) {
                ae.click();
                e.preventDefault();
                return true;
            }
            return false;
        }
        const dir = dirMap[e.code];
        if (!dir) return false;
        const btns = _menuButtons(_currentScreen);
        if (btns.length === 0) return false;
        let current = document.activeElement;
        if (!current || btns.indexOf(current) === -1) current = btns[0];
        const next = _findSpatialNeighbor(current, btns, dir);
        if (next) {
            try { next.focus({ preventScroll: false }); } catch (err) { next.focus(); }
            e.preventDefault();
            return true;
        }
        return false;
    }
    function _findSpatialNeighbor(current, candidates, direction) {
        const cur = current.getBoundingClientRect();
        const cx = cur.left + cur.width / 2;
        const cy = cur.top + cur.height / 2;
        let best = null;
        let bestScore = Infinity;
        for (let i = 0; i < candidates.length; i++) {
            const b = candidates[i];
            if (b === current) continue;
            const r = b.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            let primary, secondary;
            if (direction === 'up')         { if (dy >= -2) continue; primary = -dy; secondary = Math.abs(dx); }
            else if (direction === 'down')  { if (dy <=  2) continue; primary =  dy; secondary = Math.abs(dx); }
            else if (direction === 'left')  { if (dx >= -2) continue; primary = -dx; secondary = Math.abs(dy); }
            else if (direction === 'right') { if (dx <=  2) continue; primary =  dx; secondary = Math.abs(dy); }
            else continue;
            const score = primary + secondary * 2;
            if (score < bestScore) { bestScore = score; best = b; }
        }
        return best;
    }

    // -----------------------------------------------------------------------
    // 4. Menu & Settings event wiring
    // -----------------------------------------------------------------------
    // Give-up button + G key: forfeit the current answer slot in buzzed phase.
    // Sends GIVE_UP with the buzz owner — same downstream as ANSWER_TIMEOUT,
    // but instant (no need to wait the full 5s if you know you don't know).
    function _dispatchGiveUpIfBuzzed() {
        if (!state || state.mode !== 'duel' || state.phase !== 'buzzed') return false;
        if (!state.buzz || !state.buzz.owner) return false;
        // PvE: human can't give up on AI's behalf.
        if (state.opponent !== 'human' && state.buzz.owner === 'p2') return false;
        dispatch({ type: 'GIVE_UP', player: state.buzz.owner });
        return true;
    }
    function _dispatchGiveUpFor(player) {
        if (!state || state.mode !== 'duel' || state.phase !== 'buzzed') return false;
        if (!state.buzz || state.buzz.owner !== player) return false;
        if (state.opponent !== 'human' && player === 'p2') return false;
        dispatch({ type: 'GIVE_UP', player });
        return true;
    }
    function attachGiveUpListeners() {
        const btn = document.getElementById('btn-giveup');
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                _dispatchGiveUpIfBuzzed();
            });
        }
        document.addEventListener('keydown', function (e) {
            const kb = (typeof Save !== 'undefined' && Save.readSettings)
                ? (Save.readSettings().keybindings || {}) : {};
            if (e.code === (kb.giveUpP1 || 'KeyV')) {
                if (_dispatchGiveUpFor('p1')) e.preventDefault();
            } else if (e.code === (kb.giveUpP2 || 'Backslash')) {
                if (_dispatchGiveUpFor('p2')) e.preventDefault();
            }
        });
    }

    function attachMenuListeners() {
        document.body.addEventListener('click', function (e) {
            const t = e.target.closest && e.target.closest('[data-action]');
            if (!t) return;
            const action = t.getAttribute('data-action');
            const arg = t.getAttribute('data-arg');
            switch (action) {
                case 'enter-difficulty':
                    _subMenuContext = { kind: 'difficulty', difficulty: arg };
                    goToScreen('sub-menu');
                    break;
                case 'enter-duel-menu':
                    _subMenuContext = { kind: 'duelFamily', difficulty: arg || 'beginner' };
                    goToScreen('sub-menu');
                    break;
                case 'enter-tutorial':
                    _subMenuContext = { kind: 'tutorialModules' };
                    goToScreen('sub-menu');
                    break;
                case 'enter-codex': goToScreen('codex'); break;
                case 'enter-wrong-book': goToScreen('wrong-book'); break;
                case 'enter-settings': goToScreen('settings'); break;
                case 'open-help':
                    UIStory.openHelp(arg);
                    break;
                case 'back-to-main':
                case 'back-to-menu':
                    if (aiController) { try { aiController.stop(); } catch (err) {} aiController = null; }
                    if (_currentScreen === 'game') {
                        try { EffectManager.cancelAllEffects('leave-game'); } catch (err) {}
                        clearTransientUI();
                        resetRuntimeAfterLeavingGame();
                    }
                    goToScreen('main-menu');
                    break;
                case 'continue-practice':
                    if (state && state.mode === 'practice') {
                        startMode({ mode: 'practice', family: state.family, difficulty: state.difficulty, opponent: 'human' });
                    }
                    break;
                case 'show-story':
                    if (state && state.family) {
                        const fam = (typeof Families !== 'undefined') ? Families[state.family] : null;
                        const sKey = fam ? fam.storyKey : state.family;
                        if (sKey) {
                            const prevScreen = _currentScreen;
                            UIStory.openStory(sKey, function () { goToScreen(prevScreen); });
                        }
                    }
                    break;
                case 'show-tutorial':
                    if (state && state.family && state.difficulty) {
                        if (_currentScreen === 'game') {
                            _toggleQuickHint();
                            break;
                        }
                        UIStory.openLevelTutorial(state.family, state.difficulty, function () { goToScreen('settle'); });
                    }
                    break;
                case 'next-level':
                    UISettle.goNextLevel();
                    break;
                case 'story-advance':
                    UIStory.advanceStory();
                    break;
                case 'tutorial-prev':
                    UIStory.tutorialPrev();
                    break;
                case 'tutorial-next':
                    UIStory.tutorialNext();
                    break;
                case 'tutorial-close':
                    UIStory.closeTutorialAndContinue();
                    break;
                case 'confirm-yes':
                    if (_pendingConfirm && _pendingConfirm.onYes) _pendingConfirm.onYes();
                    _pendingConfirm = null; render();
                    break;
                case 'confirm-no':
                    if (_pendingConfirm && _pendingConfirm.onNo) _pendingConfirm.onNo();
                    _pendingConfirm = null; render();
                    break;
            }
        });

        // Story screen: click anywhere to advance
        const storyScreen = document.getElementById('screen-story');
        if (storyScreen) {
            storyScreen.addEventListener('click', function (e) {
                if (e.target && e.target.closest
                    && e.target.closest('button, [data-action], a, input, select, textarea')) {
                    return;
                }
                if (_currentScreen === 'story') UIStory.advanceStory();
            });
        }

        // Keyboard shortcuts for menu screens (game-screen input is handled by InputController)
        document.addEventListener('keydown', function (e) {
            // 選單畫面：方向鍵移動焦點、Enter/Space 啟動
            if (_isMenuScreen(_currentScreen)) {
                if (_handleMenuArrowNav(e)) return;
            }
            if (_currentScreen !== 'main-menu' && _currentScreen !== 'game' && (e.code === 'Escape' || e.code === 'KeyM')) {
                // Step-back through the duel sub-menu tree before bailing to main.
                if (_currentScreen === 'sub-menu' && _subMenuContext) {
                    if (_subMenuContext.kind === 'duelOpponentSetting'
                     || _subMenuContext.kind === 'duelFamily') {
                        goToScreen('main-menu'); e.preventDefault(); return;
                    }
                }
                goToScreen('main-menu');
                e.preventDefault();
                return;
            }
            if (_currentScreen === 'game' && (e.code === 'Escape' || e.code === 'KeyM')) {
                _pendingConfirm = {
                    text: '確定返回大廳？目前的對局會結束。',
                    onYes: function () {
                        if (aiController) { try { aiController.stop(); } catch (err) {} aiController = null; }
                        try { EffectManager.cancelAllEffects('leave-game'); } catch (err) {}
                        clearTransientUI();
                        resetRuntimeAfterLeavingGame();
                        goToScreen('main-menu');
                    },
                    onNo: function () {}
                };
                render();
                e.preventDefault();
                return;
            }
            if (_currentScreen === 'story') {
                if (e.code === 'Space' || e.code === 'Enter') { UIStory.advanceStory(); e.preventDefault(); return; }
                if (e.code === 'Escape') { UIStory.escapeStory(); e.preventDefault(); return; }
            }
        });
    }

    function _enterDifficulty(d) {
        if (d === 'advanced') {
            startMode({ mode: 'practice', family: 'englishChallenge', difficulty: 'advanced', opponent: 'human' });
        } else {
            _subMenuContext = { kind: 'difficulty', difficulty: d };
            goToScreen('sub-menu');
        }
    }
    function _clickAction(name) {
        const btn = document.querySelector('[data-action="' + name + '"]');
        if (btn) btn.click();
    }

    // -----------------------------------------------------------------------
    // 5. Init
    // -----------------------------------------------------------------------
    // Sorting-Hat character: empty .hat-char divs in HTML need eye/brow/mouth
    // children injected so the CSS face works. Ported from legacy/game.js.
    const HAT_EXPRS = ['neutral', 'happy', 'sad', 'surprised', 'thinking', 'wink', 'annoyed', 'sleepy', 'sleep'];
    const HAT_INNER =
        '<div class="hat-img"></div>' +
        '<div class="brow left"></div><div class="brow right"></div>' +
        '<div class="eye left"><div class="pupil"></div></div>' +
        '<div class="eye right"><div class="pupil"></div></div>' +
        '<div class="mouth"></div>';
    // 'grimoire'（預設，靜態圖）或 'hat'（CSS 五官會做表情）。開發者選項可切換。
    function _characterSkin() {
        const s = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : null;
        return (s && s.characterSkin === 'hat') ? 'hat' : 'grimoire';
    }
    function ensureHatChar(el) {
        if (!el) return;
        if (_characterSkin() === 'grimoire') {
            // 魔導書：靜態圖，忽略表情。切換自帽版時（無 .grimoire-img）重繪。
            if (!el.querySelector('.grimoire-img')) {
                el.classList.add('is-grimoire');
                el.innerHTML = '<img class="grimoire-img" src="assets/images/character/magicbook.webp" alt="">';
            }
        } else if (!el.querySelector('.hat-img')) {
            el.classList.remove('is-grimoire');
            el.innerHTML = HAT_INNER;
        }
    }
    function setHatExpression(el, expr) {
        if (!el) return;
        HAT_EXPRS.forEach(e => el.classList.remove(e));
        el.classList.add(expr && HAT_EXPRS.indexOf(expr) >= 0 ? expr : 'neutral');
    }
    let _hatMouseBound = false;
    // 依目前皮膚設定同步所有 .hat-char 的 DOM（切換 hat/grimoire 後也會正確重繪）。
    // 只碰 DOM、不綁事件，可安全在每次 render() 結尾呼叫。
    function syncHatChars() {
        document.querySelectorAll('.hat-char').forEach(ensureHatChar);
    }
    function initHatChars() {
        syncHatChars();
        if (_hatMouseBound) return;
        _hatMouseBound = true;
        document.addEventListener('mousemove', (ev) => {
            document.querySelectorAll('.hat-char:not(.surprised):not(.sleepy) .eye').forEach(eye => {
                const p = eye.querySelector('.pupil');
                if (!p) return;
                const r = eye.getBoundingClientRect();
                if (!r.width) return;
                const ang = Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
                const m = Math.max(2, r.width * 0.16);
                p.style.transform = 'translate(' + (-50 + Math.cos(ang) * 18) + '%, ' + (-50 + Math.sin(ang) * 18) + '%)';
            });
        });
    }

    function init() {
        if (typeof document === 'undefined') return;
        document.body.classList.add('v2-active');
        if (document.documentElement) document.documentElement.classList.add('v2-active');

        state = GameState.createStateV2();
        if (typeof InputController !== 'undefined' && InputController.initV2) {
            inputController = InputController.initV2({
                dispatch: dispatch,
                getState: function () { return state; }
            });
        }

        UIStory.init({ goToScreen: goToScreen, render: render, getState: function () { return state; }, characterSkin: _characterSkin, ensureHatChar: ensureHatChar, setHatExpression: setHatExpression, syncHatChars: syncHatChars });
        UICodex.init({ goToScreen: goToScreen, openStory: UIStory.openStory, famCompoundKeys: _famCompoundKeys });
        UIWrongBook.init({ findImageFor: _findImageFor, startMode: startMode, render: render, goToScreen: goToScreen, requestConfirm: requestConfirm });
        UISettle.init({ getState: function () { return state; }, goToScreen: goToScreen, startMode: startMode, findImageFor: _findImageFor, requestConfirm: requestConfirm, getWrongChosenMap: function () { return _wrongChosenMap; }, scrollToCodexMol: UICodex.scrollToMol });
        UISettings.init({ render: render, syncMusicForScreen: _syncMusicForScreen, formatKeyCode: _formatKeyCode, escapeHtml: _escapeHtml, requestConfirm: requestConfirm, getCurrentScreen: function () { return _currentScreen; } });
        attachMenuListeners();
        UISettings.attachListeners();
        attachGiveUpListeners();
        initHatChars();
        if (typeof AudioManager !== 'undefined' && AudioManager.preload) {
            AudioManager.preload();
        }
        _armMusicUnlock();
        render();
        if (_isMenuScreen(_currentScreen)) _focusFirstMenuItem(_currentScreen);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready (script loaded after parsing).
        init();
    }
})();
