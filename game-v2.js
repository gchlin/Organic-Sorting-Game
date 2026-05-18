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
        if (settings && settings.devQuickWin && settings.devQuickWin.enabled) {
            const winAfter = Math.max(1, settings.devQuickWin.winAfter || 2);
            out.winTarget = winAfter;
            out.practiceClearAfterN = winAfter;
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
    let _tutorialState = null;  // { pages, idx, onDone, key }
    let _storyState = null;     // { lines, idx, playerName, onDone }
    let _wrongChosenMap = {};   // { compoundKey: chosenWrongAnswerKey } — per round
    let _codexTab = 'molecules'; // 'molecules' | 'levels' | 'badges' | 'story'
    let _wrongBookTab = 'category'; // 'category' | 'all' | 'box1' | 'box2' | 'box3' | 'mastered'

    function dispatch(action) {
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
        const dynRules = getEffectiveRules(DuelDynamicRules, settings);

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
            const wasCorrect = (action.key === preCorrectKey);
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
                // Track the first chosen wrong answer for this compound (for settle display)
                if (!_wrongChosenMap[preCompoundKey]) {
                    _wrongChosenMap[preCompoundKey] = action.key;
                }
                if (typeof Save !== 'undefined') {
                    if (Save.recordWrongV2) Save.recordWrongV2(state.family, state.difficulty, preCompoundKey);
                    // A wrong answer also demotes (back to box 1) if already tracked.
                    if (Save.demoteWrongV2) Save.demoteWrongV2(state.family, state.difficulty, preCompoundKey);
                }
            }
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

        // Render after each action.
        render();

        // Settle-side bookkeeping (badges + persistence + result)
        if (beforePhase !== 'settling' && state.phase === 'settling') {
            _onEnterSettling();
        }
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
                dispatch({ type: 'EFFECT_COMPLETE', effectId: -1 });
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
                const durationMs = variantDef ? variantDef.durationMs : 8000;
                EffectManager.runDynamicEffect(
                    { op: 'playToComplete', variant: variant, durationMs: durationMs,
                      startElapsedMs: state.dynamic.elapsedMs || 0,
                      onTick: function (ms) { if (state && state.dynamic) { state.dynamic.elapsedMs = ms; _updateDynamicVisual(); } },
                      onCompleteStateReached: function () {
                          if (state && state.dynamic) { state.dynamic.completeStateReached = true; state.dynamic.phase = 'completed'; }
                      } },
                    function (completedId) { dispatch({ type: 'EFFECT_COMPLETE', effectId: completedId }); }
                );
                return;
            }
            if (effect.name === 'freezeAtCompleteState') {
                if (state.dynamic) { state.dynamic.phase = 'completed'; state.dynamic.completeStateReached = true; }
                dispatch({ type: 'EFFECT_COMPLETE', effectId: -1 });
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
        const opts = document.querySelectorAll('#game-options .option-btn');
        for (let i = 0; i < opts.length; i++) {
            opts[i].classList.remove('eliminated', 'wrong-chosen', 'correct-reveal', 'correct-chosen');
        }
        const buzz = document.getElementById('game-buzz');
        if (buzz) buzz.classList.remove('buzz-open', 'buzz-owner-p1', 'buzz-owner-p2');
        const hint = document.getElementById('game-hint-bubble');
        if (hint) { hint.classList.remove('visible'); hint.textContent = ''; }
        const img = document.getElementById('game-image');
        if (img) img.classList.remove('dyn-zoom', 'dyn-playing', 'dyn-paused', 'dyn-completing', 'dyn-complete');
        const fb = document.getElementById('feedback-overlay');
        if (fb) { fb.classList.remove('show-correct', 'show-wrong'); fb.textContent = ''; }
        // Stop buzz countdown + clear handoff overlay
        _hideBuzzedUI();
        if (state && state.buzz) { state.buzz.timerStartedAt = 0; state.buzz._isHandoff = false; }
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
            'phase-revealing', 'phase-revealed', 'phase-cleanup', 'input-locked'
        );
        if (state) {
            if (state.phase === 'resolvingCorrect') document.body.classList.add('phase-resolving-correct');
            if (state.phase === 'resolvingWrong') document.body.classList.add('phase-resolving-wrong');
            if (state.phase === 'revealing') document.body.classList.add('phase-revealing');
            if (state.phase === 'revealed') document.body.classList.add('phase-revealed');
            if (state.phase === 'cleanup') document.body.classList.add('phase-cleanup');
            if (state.globalInputLocked) document.body.classList.add('input-locked');
        }

        switch (_currentScreen) {
            case 'main-menu': renderMainMenu(); break;
            case 'sub-menu': renderSubMenu(); break;
            case 'game': renderGameScreen(); break;
            case 'settle': renderSettleScreen(); break;
            case 'codex': renderCodexScreen(); break;
            case 'wrong-book': renderWrongBookScreen(); break;
            case 'settings': renderSettingsScreen(); break;
            case 'story': renderStoryScreen(); break;
        }
        renderTutorialModal();
        renderConfirmModal();
        renderDevBanner();
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
    //   'duelDifficulty'       {}               → opponent toggle + 初/中/高 (mode is sticky)
    //   'duelFamily'           { difficulty }   → family list, click starts duel using saved mode
    //   'duelOpponentSetting'  {}               → PvP / PvE 易/中/難 picker, saves to
    //                                             settings.duelOpponent then returns to
    //                                             duelDifficulty. NOT in the start-game flow.
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

        if (_subMenuContext.kind === 'difficulty') {
            const diff = _subMenuContext.difficulty;
            titleEl.textContent = diffName(diff) + ' 練習 — 選擇主題子關';
            const familyKeys = Object.keys(Families).filter(k => Families[k].difficulties.indexOf(diff) !== -1);
            for (let i = 0; i < familyKeys.length; i++) {
                const fk = familyKeys[i];
                const btn = appendFamilyButton(fk, diff, 'L' + (i + 1), function () {
                    startMode({ mode: 'practice', family: fk, difficulty: diff, opponent: 'human' });
                });
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duelDifficulty') {
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const currentOpp = settings.duelOpponent || 'aiMedium';
            titleEl.textContent = '巫師對決';
            const opponentRow = document.createElement('div');
            opponentRow.className = 'v2-duel-mode-toggle';
            const opponents = [
                { key: 'human', label: 'PvP（雙人）' },
                { key: 'aiEasy', label: 'PvE 易' },
                { key: 'aiMedium', label: 'PvE 中' },
                { key: 'aiHard', label: 'PvE 難' }
            ];
            for (let i = 0; i < opponents.length; i++) {
                const op = opponents[i];
                const btn = document.createElement('button');
                btn.className = 'v2-duel-mode-option';
                btn.type = 'button';
                btn.textContent = op.label;
                btn.setAttribute('aria-pressed', op.key === currentOpp ? 'true' : 'false');
                if (op.key === currentOpp) btn.classList.add('is-active');
                btn.addEventListener('click', function () {
                    if (typeof Save !== 'undefined' && Save.writeSettings) {
                        Save.writeSettings({ duelOpponent: op.key });
                    }
                    render();
                });
                opponentRow.appendChild(btn);
            }
            listEl.appendChild(opponentRow);

            const diffs = [
                { key: 'beginner', label: '1. 初級' },
                { key: 'intermediate', label: '2. 中級' },
                { key: 'advanced', label: '3. 高級' }
            ];
            for (let i = 0; i < diffs.length; i++) {
                const d = diffs[i];
                const btn = document.createElement('button');
                setMenuButtonContent(btn, '', d.label.replace(/^\d+\.\s*/, ''));
                btn.addEventListener('click', function () {
                    _subMenuContext = { kind: 'duelFamily', difficulty: d.key };
                    render();
                });
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duelFamily') {
            const diff = _subMenuContext.difficulty;
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const opponent = settings.duelOpponent || 'aiMedium';
            const oppLabel = { human: 'PvP', aiEasy: 'PvE 易', aiMedium: 'PvE 中', aiHard: 'PvE 難' }[opponent] || opponent;
            titleEl.textContent = diffName(diff) + ' 巫師對決（' + oppLabel + '） — 選擇主題子關';
            const familyKeys = Object.keys(Families).filter(k => Families[k].difficulties.indexOf(diff) !== -1);
            for (let i = 0; i < familyKeys.length; i++) {
                const fk = familyKeys[i];
                const btn = appendFamilyButton(fk, diff, 'L' + (i + 1), function () {
                    // 直接用 settings 裡存的對手模式開始對決
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
                    _subMenuContext = { kind: 'duelDifficulty' };
                    render();
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
            if (scoreEl) scoreEl.textContent = String(player.correctCount || 0);
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

        // Question image
        const imgEl = document.getElementById('game-image');
        if (imgEl) {
            const q = state.question && state.question.current;
            if (q && q.qContent) {
                if (imgEl.getAttribute('src') !== q.qContent) imgEl.setAttribute('src', q.qContent);
            }
            // Dynamic variant classes
            if (state.dynamic) {
                if (state.dynamic.variant === 'zoom') imgEl.classList.add('dyn-zoom');
                else imgEl.classList.remove('dyn-zoom');
                imgEl.classList.toggle('dyn-playing', state.dynamic.phase === 'playing');
                imgEl.classList.toggle('dyn-paused', state.dynamic.phase === 'paused');
                imgEl.classList.toggle('dyn-completing', state.dynamic.phase === 'playingToComplete');
                imgEl.classList.toggle('dyn-complete', !!state.dynamic.completeStateReached);
            }
            _updateDynamicVisual();
        }

        // Options: render only when phase indicates options should be visible.
        // Practice: visible whenever question exists. Duel: visible only while phase===buzzed (and shown to owner only) or revealing.
        const optsContainer = document.getElementById('game-options');
        if (optsContainer && state.question && state.question.options) {
            const showOptions = (state.mode === 'practice')
                || (state.mode === 'duel'
                    && (state.phase === 'buzzed' || state.phase === 'revealing' || state.phase === 'revealed'
                        || state.phase === 'resolvingCorrect' || state.phase === 'resolvingWrong'));
            optsContainer.style.visibility = showOptions ? 'visible' : 'hidden';
            const btns = optsContainer.querySelectorAll('.option-btn');
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const keybindings = settings.keybindings || {};
            for (let i = 0; i < btns.length; i++) {
                const opt = state.question.options[i];
                if (opt) {
                    btns[i].setAttribute('data-option-key', opt.key);
                    const leftKey = _formatKeyCode(keybindings['optionLeft' + i]);
                    const rightKey = _formatKeyCode(keybindings['optionRight' + i]);
                    btns[i].innerHTML =
                        '<span class="option-key-hint">[' + _escapeHtml(leftKey) + ']</span>' +
                        '<span class="option-label">' + _escapeHtml(opt.content || '') + '</span>' +
                        '<span class="option-key-hint">[' + _escapeHtml(rightKey) + ']</span>';
                    // option class overlays
                    btns[i].classList.toggle('eliminated',
                        state.question.eliminatedWrongKeys && state.question.eliminatedWrongKeys.has
                            && state.question.eliminatedWrongKeys.has(opt.key)
                            && opt.key !== state.question.lastChosenWrongKey);
                    btns[i].classList.toggle('wrong-chosen',
                        opt.key === state.question.lastChosenWrongKey);
                    btns[i].classList.toggle('correct-reveal',
                        (state.phase === 'revealing' || state.phase === 'revealed')
                        && opt.key === state.question.correctKey);
                    // Also light up the correct option green while in resolvingCorrect (Practice + Duel)
                    btns[i].classList.toggle('correct-chosen',
                        state.phase === 'resolvingCorrect' && opt.key === state.question.correctKey);
                } else {
                    btns[i].setAttribute('data-option-key', '');
                    btns[i].innerHTML = '';
                    btns[i].classList.remove('eliminated', 'wrong-chosen', 'correct-reveal');
                }
            }
        }

        // Buzz visibility / state. Per the reducer truth table:
        //   state.phase === 'buzzOpen' → both players eligible to buzz
        //   state.phase === 'buzzed'   → one owner (state.buzz.owner) acts
        const buzz = document.getElementById('game-buzz');
        if (buzz) {
            const isDuel = state.mode === 'duel';
            buzz.style.display = isDuel ? 'flex' : 'none';
            buzz.classList.toggle('buzz-open', state.phase === 'buzzOpen');
            buzz.classList.toggle('buzz-owner-p1', state.phase === 'buzzed' && state.buzz && state.buzz.owner === 'p1');
            buzz.classList.toggle('buzz-owner-p2', state.phase === 'buzzed' && state.buzz && state.buzz.owner === 'p2');
            // PvE: hide the P2 buzz button (AI owns p2; human shouldn't be able
            // to steal it via mouse click). PvP: show both.
            const p2Btn = document.getElementById('buzz-p2');
            if (p2Btn) p2Btn.style.display = (isDuel && state.opponent === 'human') ? '' : 'none';
        }

        // Spin up / tear down the buzzed-phase rAF loop based on current phase.
        if (state.phase === 'buzzed') {
            _startBuzzedTickLoop();
        } else {
            _hideBuzzedUI();
        }

        _updateFeedbackOverlay();
        _checkComboPopup();
    }

    // ---- Audio feedback (Web Audio API beeps — no asset files needed) ----
    // First call creates AudioContext. Modern browsers require a user gesture
    // before audio plays; the menu click that started the game counts.
    let _audioCtx = null;
    function _getAudioCtx() {
        if (_audioCtx) return _audioCtx;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            _audioCtx = new Ctx();
            return _audioCtx;
        } catch (e) { return null; }
    }
    function _beep(name) {
        const soundSettings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
        if (soundSettings.soundEnabled === false) return;
        const ctx = _getAudioCtx();
        if (!ctx) return;
        try {
            const t0 = ctx.currentTime;
            function note(freq, type, startMs, durMs, peakGain) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type || 'sine';
                osc.frequency.value = freq;
                const start = t0 + startMs / 1000;
                const stop = start + durMs / 1000;
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(peakGain || 0.12, start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, stop);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(start); osc.stop(stop);
            }
            if (name === 'correct') {
                // Pleasant two-note ding (C5 → G5)
                note(523, 'sine', 0,  150, 0.12);
                note(784, 'sine', 80, 280, 0.10);
            } else if (name === 'wrong') {
                // Harsh low buzz (A2 sawtooth)
                note(110, 'sawtooth', 0, 350, 0.15);
            } else if (name === 'timeout') {
                // Falling tone (G3 → D3)
                note(196, 'triangle', 0,   200, 0.12);
                note(147, 'triangle', 200, 300, 0.12);
            } else if (name === 'buzz') {
                // Game-show style two-note buzz (A5 → D6) — louder than other beeps
                // so it cuts through and clearly marks "someone grabbed the buzzer".
                note(880, 'square', 0,  110, 0.14);
                note(1175, 'square', 70, 160, 0.12);
            }
        } catch (e) { /* fail silent */ }
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
            el.textContent = '✓ 答對';
            el.classList.add('show-correct');
        } else if (state.phase === 'resolvingWrong') {
            const reason = state.question && state.question.lastResolveReason;
            el.textContent = reason === 'timeout' ? '⏱ 逾時'
                           : reason === 'giveup' ? '⊘ 放棄'
                           : '✗ 答錯';
            el.classList.add('show-wrong');
        } else {
            el.textContent = '';
        }
    }

    // ---- Buzz countdown + handoff overlay (rAF loop) --------------------
    // render() only fires on dispatch, so a per-second countdown would tick
    // jerkily. We run a lightweight rAF loop while phase===buzzed that updates
    // #buzz-countdown (5→1, big red number) and fades #handoff-overlay.
    // Loop self-terminates when phase leaves 'buzzed'.
    let _buzzedTickRafId = null;
    function _startBuzzedTickLoop() {
        if (_buzzedTickRafId !== null) return;
        function tick() {
            if (!state || state.phase !== 'buzzed' || !state.buzz || !state.buzz.timerStartedAt) {
                _buzzedTickRafId = null;
                _hideBuzzedUI();
                return;
            }
            const elapsed = Date.now() - state.buzz.timerStartedAt;
            const remaining = Math.max(0, 5000 - elapsed);
            const sec = Math.ceil(remaining / 1000);
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
                    giveup.classList.add('visible');
                    giveup.setAttribute('data-side', side);
                }
            }
            const handoff = document.getElementById('handoff-overlay');
            if (handoff) {
                if (state.buzz._isHandoff && elapsed < 1000) {
                    handoff.textContent = '⚡ 輪到 ' + (state.buzz.owner === 'p1' ? 'P1' : 'P2');
                    handoff.style.opacity = String(Math.max(0, 1 - elapsed / 800));
                    handoff.classList.add('visible');
                } else {
                    handoff.classList.remove('visible');
                    handoff.style.opacity = '0';
                    if (state.buzz._isHandoff) state.buzz._isHandoff = false;
                }
            }
            _buzzedTickRafId = requestAnimationFrame(tick);
        }
        _buzzedTickRafId = requestAnimationFrame(tick);
    }
    function _hideBuzzedUI() {
        const cd = document.getElementById('buzz-countdown');
        if (cd) { cd.classList.remove('visible', 'urgent'); cd.textContent = ''; }
        const handoff = document.getElementById('handoff-overlay');
        if (handoff) { handoff.classList.remove('visible'); handoff.style.opacity = '0'; handoff.textContent = ''; }
        const giveup = document.getElementById('btn-giveup');
        if (giveup) giveup.classList.remove('visible');
    }

    // Update inline transform on #game-image based on state.dynamic.elapsedMs.
    // Called from render() AND from onTick callbacks (so animation is smooth between dispatches).
    function _updateDynamicVisual() {
        const imgEl = document.getElementById('game-image');
        if (!imgEl) return;
        if (state && state.dynamic && state.dynamic.variant === 'zoom' && state.mode === 'duel') {
            const v = (typeof DynamicVariants !== 'undefined' && DynamicVariants.zoom) || {};
            const dur = v.durationMs || 8000;
            const initialScale = v.initialScale || 5;
            const finalScale = v.finalScale || 1;
            const t = state.dynamic.completeStateReached
                ? 1
                : Math.min(1, Math.max(0, (state.dynamic.elapsedMs || 0) / dur));
            const scale = initialScale - (initialScale - finalScale) * t;
            imgEl.style.transform = 'scale(' + scale + ')';
        } else {
            imgEl.style.transform = '';
        }
    }

    function _comboLevel(streak) {
        if (streak >= 8) return 'Brilliant!';
        if (streak >= 5) return 'Great!';
        if (streak >= 3) return 'Good!';
        return '';
    }
    function _comboTier(label) {
        if (label === 'Brilliant!') return 'brilliant';
        if (label === 'Great!')     return 'great';
        if (label === 'Good!')      return 'good';
        return '';
    }

    // Combo popup: large floating text near the player when combo level crosses
    // a threshold upward. Tracks previous combo per player so a sustained streak
    // doesn't re-trigger every frame; resets to '' on cleanup/wrong/new question.
    const _prevCombo = { p1: '', p2: '' };
    function _spawnComboPopup(label, player) {
        if (typeof document === 'undefined') return;
        const tier = _comboTier(label);
        if (!tier) return;
        const el = document.createElement('div');
        el.className = 'combo-popup tier-' + tier + ' side-' + (player === 'p1' ? 'left' : 'right');
        el.textContent = label;
        document.body.appendChild(el);
        // Auto-remove after the CSS animation finishes (1.4s). Doubled timer so
        // late removal doesn't clip the fade-out.
        setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 1600);
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
                    _spawnComboPopup(newLabel, p);
                }
            }
            _prevCombo[p] = newLabel;
        });
    }

    function renderSettleScreen() {
        if (!state) return;
        const titleEl = document.getElementById('settle-title');
        const statsEl = document.getElementById('settle-stats');
        const wrongReview = document.getElementById('settle-wrong-review');
        const wrongCards = document.getElementById('settle-wrong-cards');
        if (!titleEl || !statsEl) return;

        if (state.mode === 'duel') {
            titleEl.textContent = state.result && state.result.winner
                ? ((state.result.winner === 'p1' ? 'P1' : 'P2') + ' 勝利！')
                : '本局結算';
        } else {
            const cleared = (typeof Save !== 'undefined' && Save.isSubLevelCleared
                && Save.isSubLevelCleared(state.family, state.difficulty));
            if (state.queueSource === 'wrongOnly') {
                // Celebrate when every entry in the bucket is now in box ≥4 (mastered).
                let entries = [];
                if (typeof Save !== 'undefined' && Save.getWrongEntriesV2) {
                    entries = Save.getWrongEntriesV2(state.family, state.difficulty);
                }
                const allMastered = entries.length > 0 && entries.every(function (e) { return e.box >= 4; });
                titleEl.textContent = allMastered ? '🎉 該組錯題全部進入「已克服」' : '🎯 錯題重練結算';
            } else {
                titleEl.textContent = cleared ? '已通關該子關 🥉' : '本輪結算';
            }
        }

        // Accuracy now uses correctCount / (correctCount + wrongCount).
        // wrongCount counts wrong submissions, so even if you eventually got
        // the same question right after a mistake, accuracy reflects that mistake.
        const p1 = state.players.p1;
        const totalSubmissions = (p1.correctCount || 0) + (p1.wrongCount || 0);
        const acc = totalSubmissions > 0 ? (p1.correctCount / totalSubmissions) : null;
        statsEl.innerHTML = '';
        _appendStat(statsEl, '答對', String(p1.correctCount || 0));
        if ((p1.wrongCount || 0) > 0) {
            _appendStat(statsEl, '答錯', String(p1.wrongCount || 0));
        }
        if (state.mode === 'duel') {
            _appendStat(statsEl, 'P2 答對', String(state.players.p2.correctCount || 0));
        }
        _appendStat(statsEl, '本輪正確率', acc !== null ? (Math.round(acc * 100) + '%') : '—');
        // Practice: show progress against the sub-level's full question set.
        if (state.mode === 'practice'
            && typeof QuestionEngine !== 'undefined' && QuestionEngine.getQuestionSet
            && typeof Save !== 'undefined' && Save.getAskedHistory) {
            const total = QuestionEngine.getQuestionSet(state.family, state.difficulty).length;
            const asked = Save.getAskedHistory(state.family, state.difficulty).size;
            if (total > 0) {
                _appendStat(statsEl, '子關進度', Math.min(asked, total) + ' / ' + total + ' 題');
            }
        }

        // Tutorial button: hide/disable if no tutorial exists for current family-difficulty
        const tutBtn = document.querySelector('[data-action="show-tutorial"]');
        if (tutBtn) {
            const tutKey = (state && state.family && state.difficulty)
                ? state.family + '-' + state.difficulty : null;
            const tut = tutKey && (typeof LevelTutorials !== 'undefined') ? LevelTutorials[tutKey] : null;
            const hasTut = tut && (Array.isArray(tut.pages) ? tut.pages.length > 0
                                 : Array.isArray(tut) ? tut.length > 0 : false);
            tutBtn.style.display = hasTut ? '' : 'none';
        }

        // Wrong review (Practice only)
        if (wrongReview && wrongCards) {
            const wrongs = (state.wrongInRound && state.wrongInRound.size > 0)
                ? Array.from(state.wrongInRound) : [];
            if (state.mode === 'practice' && wrongs.length > 0) {
                wrongReview.classList.remove('empty');
                wrongCards.innerHTML = '';
                for (let i = 0; i < wrongs.length; i++) {
                    const ck = wrongs[i];
                    const entry = (typeof AnswerBank !== 'undefined') ? AnswerBank[ck] : null;
                    const img = _findImageFor(ck);
                    const card = document.createElement('div');
                    card.className = 'v2-wrong-card';

                    const imgEl = document.createElement('img');
                    imgEl.src = img || '';
                    imgEl.alt = '';
                    card.appendChild(imgEl);

                    const nameEl = document.createElement('div');
                    nameEl.className = 'name-zh';
                    nameEl.textContent = entry ? entry.content : ck;
                    card.appendChild(nameEl);

                    // "你選了：XXX"
                    const chosenKey = _wrongChosenMap[ck];
                    if (chosenKey) {
                        const chosenEntry = (typeof AnswerBank !== 'undefined') ? AnswerBank[chosenKey] : null;
                        const chosenText = chosenEntry ? chosenEntry.content : chosenKey;
                        const chosenEl = document.createElement('div');
                        chosenEl.className = 'v2-wrong-card-chosen';
                        chosenEl.textContent = '你選了：' + chosenText;
                        card.appendChild(chosenEl);
                    }

                    // "看圖鑑 →" link
                    const codexLink = document.createElement('button');
                    codexLink.className = 'v2-wrong-card-codex-link';
                    codexLink.textContent = '看圖鑑 →';
                    (function (molKey) {
                        codexLink.addEventListener('click', function (e) {
                            e.stopPropagation();
                            goToScreen('codex');
                            // Scroll to the molecule card after render
                            setTimeout(function () {
                                const target = document.getElementById('codex-mol-' + molKey);
                                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 80);
                        });
                    })(ck);
                    card.appendChild(codexLink);

                    wrongCards.appendChild(card);
                }
            } else {
                wrongReview.classList.add('empty');
            }
        }
    }
    function _appendStat(parent, label, value) {
        const line = document.createElement('div');
        line.className = 'stat-line';
        line.innerHTML = '<span>' + label + '</span><span>' + value + '</span>';
        parent.appendChild(line);
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

    function renderCodexScreen() {
        const root = document.getElementById('codex-content');
        if (!root) return;
        if (typeof Families === 'undefined' || typeof QuestionImages === 'undefined' || typeof AnswerBank === 'undefined') {
            root.innerHTML = '<p style="text-align:center;color:var(--hp-parchment-dark);">資料載入中…</p>';
            return;
        }

        const save = (typeof Save !== 'undefined' && Save.get) ? Save.get() : {};
        const unlockedBadges = save.badges || [];
        const unlockedMols = save.unlockedMols || [];
        const famKeys = Object.keys(Families);

        // ---- Tab nav ----
        // Compute counts for each tab badge.
        let levelsCleared = 0, levelsTotal = 0;
        let molUnlockedTotal = 0, molTotalAll = 0;
        let storyUnlocked = 0, storyTotal = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            for (const diff of (fam.difficulties || [])) {
                levelsTotal++;
                if (unlockedBadges.includes(fk + '-' + diff + '-completed')) levelsCleared++;
            }
            const mks = _famCompoundKeys(fam);
            molTotalAll += mks.length;
            molUnlockedTotal += mks.filter(m => unlockedMols.includes(m.ck)).length;
            if (fam.storyKey) {
                storyTotal++;
                if (typeof Save !== 'undefined' && Save.isStoryUnlockedV2 && Save.isStoryUnlockedV2(fam.storyKey)) storyUnlocked++;
            }
        }
        const allDefs = (typeof Save !== 'undefined' && Save.allBadgeDefs) ? Save.allBadgeDefs() : [];
        const badgesUnlocked = allDefs.filter(d => unlockedBadges.includes(d.id)).length;

        const TABS = [
            { key: 'molecules', label: '分子',     count: molUnlockedTotal + '/' + molTotalAll },
            { key: 'levels',    label: '闖關進度', count: levelsCleared + '/' + levelsTotal },
            { key: 'badges',    label: '勳章',     count: badgesUnlocked + '/' + allDefs.length },
            { key: 'story',     label: '劇情',     count: storyUnlocked + '/' + storyTotal },
        ];

        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

        let html = '<nav class="codex-tabs" role="tablist">';
        for (const t of TABS) {
            const active = (t.key === _codexTab) ? ' active' : '';
            html += '<button type="button" class="tab' + active + '" data-codex-tab="' + t.key + '">'
                  + esc(t.label) + ' <span class="count">' + esc(t.count) + '</span></button>';
        }
        html += '</nav>';

        html += '<div class="codex-content">';

        // ---- Panel: levels (one card per family-difficulty) ----
        let levelsHTML = '<div class="codex-level-grid">';
        const FAM_VARIANT = { mixed: 'boss', englishChallenge: 'genius' };
        let lvIdx = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            const variant = FAM_VARIANT[fk] || '';
            for (const diff of (fam.difficulties || [])) {
                lvIdx++;
                const completedId = fk + '-' + diff + '-completed';
                const masteryId = fk + '-' + diff + '-mastery';
                const cleared = unlockedBadges.includes(completedId);
                const mastered = unlockedBadges.includes(masteryId);
                const locked = !cleared && (fam.lockedUntil && !unlockedBadges.includes(fam.lockedUntil));
                const cls = ['codex-level-card', variant, cleared ? 'cleared' : '', locked ? 'locked' : '', mastered ? 'mastered' : ''].filter(Boolean).join(' ');
                const DIFF_LABEL = { beginner: '初', intermediate: '中', advanced: '高' };
                const stateText = mastered ? '★ 精通' : cleared ? '已通關' : locked ? '🔒 未解鎖' : '尚未通關';
                levelsHTML += '<div class="' + cls + '">'
                    + '<div class="codex-level-head">'
                      + '<span class="codex-level-tag">L' + lvIdx + ' · ' + esc(DIFF_LABEL[diff] || diff) + '</span>'
                      + '<span class="codex-level-state">' + esc(stateText) + '</span>'
                    + '</div>'
                    + '<h3>' + esc(fam.nameZh || fk) + '</h3>'
                    + '<p>' + esc(fam.descZh || '') + '</p>'
                  + '</div>';
            }
        }
        levelsHTML += '</div>';
        html += '<section class="codex-panel' + (_codexTab === 'levels' ? ' active' : '') + '" data-codex-panel="levels">' + levelsHTML + '</section>';

        // ---- Panel: badges ----
        let badgesHTML = '<div class="codex-badge-grid">';
        if (allDefs.length === 0) {
            badgesHTML += '<p class="codex-ach-empty">（暫無勳章定義）</p>';
        } else {
            for (const def of allDefs) {
                const u = unlockedBadges.includes(def.id);
                const cls = 'codex-badge-card ' + (u ? 'unlocked' : 'locked');
                const name = u ? (def.label || def.id) : '???';
                const cond = def.needCorrect
                    ? ('累積答對 ' + def.needCorrect + ' 題' + (u ? '' : '解鎖'))
                    : (def.descZh || def.condition || '');
                let progress = '';
                if (!u && def.needCorrect) {
                    const cur = save.correctTotal || 0;
                    const pct = Math.min(100, Math.round((cur / def.needCorrect) * 100));
                    progress = '<div class="codex-badge-progress"><div class="fill" style="width:' + pct + '%"></div></div>';
                }
                badgesHTML += '<div class="' + cls + '">'
                    + '<div class="codex-badge-icon">' + esc(def.emoji || '🏅') + '</div>'
                    + '<div class="codex-badge-name">' + esc(name) + '</div>'
                    + '<div class="codex-badge-cond">' + esc(cond) + '</div>'
                    + progress
                  + '</div>';
            }
        }
        badgesHTML += '</div>';
        html += '<section class="codex-panel' + (_codexTab === 'badges' ? ' active' : '') + '" data-codex-panel="badges">' + badgesHTML + '</section>';

        // ---- Panel: molecules (per-family sections) ----
        const CAT_LABEL_ZH = { alkane:'烷類', alkene:'烯類', alkyne:'炔類', alcohol:'醇',
            ether:'醚', aldehyde:'醛', ketone:'酮', carboxylic:'羧酸',
            ester:'酯', amine:'胺', halide:'鹵化物', aromatic:'芳香烴', phenol:'酚' };
        let molHTML = '';
        let famIdx = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            const items = _famCompoundKeys(fam);
            if (items.length === 0) continue;
            famIdx++;
            const unlockedHere = items.filter(it => unlockedMols.includes(it.ck)).length;
            molHTML += '<div class="codex-molecule-section">'
                + '<h3 class="codex-section-title">'
                  + '<span class="codex-level-tag">L' + famIdx + '</span> '
                  + esc(fam.nameZh || fk)
                  + ' <span class="codex-section-count">' + unlockedHere + '/' + items.length + '</span>'
                + '</h3>'
                + '<div class="codex-mol-grid">';
            for (const it of items) {
                const u = (typeof Save !== 'undefined' && Save.isMolUnlocked) ? Save.isMolUnlocked(it.ck) : unlockedMols.includes(it.ck);
                const ab = AnswerBank[it.ck];
                const nameZh = (ab && ab.content) ? ab.content : it.ck;
                if (u) {
                    const catZh = ab ? (CAT_LABEL_ZH[ab.category] || ab.category || '') : '';
                    const factText = (typeof CompoundFacts !== 'undefined' && CompoundFacts[it.ck]) ? CompoundFacts[it.ck] : '';
                    molHTML += '<button type="button" class="codex-mol-card" data-mol="' + esc(it.ck) + '">'
                        + '<img class="codex-mol-img" src="' + esc(it.src) + '" alt="' + esc(nameZh) + '" loading="lazy">'
                        + '<div class="codex-mol-name">' + esc(nameZh) + '</div>'
                        + '<div class="codex-mol-en">' + esc(it.ck) + '</div>'
                        + '<div class="codex-mol-stamps"><span class="codex-mol-stamp">' + esc(catZh) + '</span></div>'
                        + (factText ? '<div class="codex-mol-fact">' + esc(factText) + '</div>' : '')
                      + '</button>';
                } else {
                    molHTML += '<div class="codex-mol-card locked">'
                        + '<div class="codex-mol-img placeholder"></div>'
                        + '<div class="codex-mol-name">???</div>'
                      + '</div>';
                }
            }
            molHTML += '</div></div>';
        }
        html += '<section class="codex-panel' + (_codexTab === 'molecules' ? ' active' : '') + '" data-codex-panel="molecules">' + molHTML + '</section>';

        // ---- Panel: story ----
        let storyHTML = '<div class="codex-story-grid">';
        let chIdx = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            if (!fam.storyKey) continue;
            chIdx++;
            const u = (typeof Save !== 'undefined' && Save.isStoryUnlockedV2) ? Save.isStoryUnlockedV2(fam.storyKey) : false;
            const cls = 'codex-story-card' + (u ? '' : ' locked');
            storyHTML += '<div class="' + cls + '" data-story-key="' + esc(fam.storyKey) + '">'
                + '<div class="ch-header">'
                  + '<span class="ch-num">CH.' + chIdx + '</span>'
                  + '<h3 class="ch-title">' + esc(fam.nameZh || fk) + '</h3>'
                + '</div>'
                + '<p class="ch-preview">' + esc(u ? (fam.storyTeaser || '點擊播放劇情') : '通關後解鎖') + '</p>'
                + '<div class="ch-meta"><span>🎩 分類帽</span><span>' + (u ? '已解鎖' : '未解鎖') + '</span></div>'
              + '</div>';
        }
        storyHTML += '</div>';
        html += '<section class="codex-panel' + (_codexTab === 'story' ? ' active' : '') + '" data-codex-panel="story">' + storyHTML + '</section>';

        html += '</div>'; // close .codex-content
        root.innerHTML = html;

        // Wire tab clicks (no re-render needed — just toggle .active).
        root.querySelectorAll('[data-codex-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const k = btn.getAttribute('data-codex-tab');
                _codexTab = k;
                root.querySelectorAll('[data-codex-tab]').forEach(b => b.classList.toggle('active', b === btn));
                root.querySelectorAll('[data-codex-panel]').forEach(p => p.classList.toggle('active', p.getAttribute('data-codex-panel') === k));
            });
        });

        // Wire molecule card clicks — toggle open/closed.
        root.querySelectorAll('.codex-mol-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const isOpen = card.classList.contains('open');
                root.querySelectorAll('.codex-mol-card.open').forEach(c => c.classList.remove('open'));
                if (!isOpen) card.classList.add('open');
            });
        });

        // Wire story-card clicks for unlocked entries.
        root.querySelectorAll('.codex-story-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const sk = card.getAttribute('data-story-key');
                if (sk) _openStory(sk, function () { goToScreen('codex'); });
            });
        });
    }

    function renderWrongBookScreen() {
        const root = document.getElementById('wrong-book-groups');
        if (!root) return;
        const all = (typeof Save !== 'undefined' && Save.getAllActiveWrongs)
            ? Save.getAllActiveWrongs() : {};
        const keys = Object.keys(all);
        if (keys.length === 0) {
            root.innerHTML = '<div class="v2-wrong-empty">目前沒有錯題</div>';
            return;
        }

        const DIFF_NAME = { beginner: '初級', intermediate: '中級', advanced: '高級' };
        const tabs = [
            { key: 'category', label: '依類別' },
            { key: 'all', label: '全部' },
            { key: 'box1', label: '待訂正' },
            { key: 'box2', label: '訂正一次' },
            { key: 'box3', label: '訂正兩次' },
            { key: 'mastered', label: '已克服' }
        ];

        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
        function tabMatches(entry) {
            if (_wrongBookTab === 'all' || _wrongBookTab === 'category') return true;
            if (_wrongBookTab === 'box1') return entry.box <= 1;
            if (_wrongBookTab === 'box2') return entry.box === 2;
            if (_wrongBookTab === 'box3') return entry.box === 3;
            if (_wrongBookTab === 'mastered') return entry.box >= 4;
            return true;
        }

        const groups = [];
        const counts = { category: 0, all: 0, box1: 0, box2: 0, box3: 0, mastered: 0 };
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]; // 'family-difficulty'
            const dashIdx = key.lastIndexOf('-');
            if (dashIdx === -1) continue;
            const family = key.slice(0, dashIdx);
            const difficulty = key.slice(dashIdx + 1);
            const fam = (typeof Families !== 'undefined') ? Families[family] : null;
            const entries = (Save.getWrongEntriesV2)
                ? Save.getWrongEntriesV2(family, difficulty)
                : all[key].map(function (ck) { return { compoundKey: ck, box: 1, correctStreak: 0 }; });
            entries.forEach(function (e) {
                counts.category++;
                counts.all++;
                if (e.box <= 1) counts.box1++;
                else if (e.box === 2) counts.box2++;
                else if (e.box === 3) counts.box3++;
                else if (e.box >= 4) counts.mastered++;
            });
            const filtered = entries.filter(tabMatches);
            if (!filtered.length) continue;
            groups.push({ key: key, family: family, difficulty: difficulty, fam: fam, entries: filtered, allEntries: entries });
        }

        let html = '<nav class="codex-tabs v2-wrong-tabs" role="tablist">';
        for (const t of tabs) {
            const active = (_wrongBookTab === t.key) ? ' active' : '';
            html += '<button type="button" class="tab' + active + '" data-wrong-tab="' + t.key + '">'
                + esc(t.label) + ' <span class="count">' + esc(counts[t.key]) + '</span></button>';
        }
        html += '</nav>';

        if (!groups.length) {
            html += '<div class="v2-wrong-empty">這個頁籤目前沒有卡片</div>';
            root.innerHTML = html;
            wireWrongBookTabs(root);
            return;
        }

        html += '<div class="v2-wrong-group-list' + (_wrongBookTab === 'category' ? '' : ' is-flat') + '">';
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const masteredCount = g.allEntries.filter(function (e) { return e.box >= 4; }).length;
            const practiceCount = g.allEntries.length - masteredCount;
            const title = (g.fam ? g.fam.nameZh : g.family) + ' ' + (DIFF_NAME[g.difficulty] || g.difficulty)
                + ' 共' + g.allEntries.length + '題 要練習';
            const groupTag = g.family + '|' + g.difficulty;
            const filteredKeys = g.entries.map(function (e) { return e.compoundKey; }).join(',');

            html += '<details class="v2-wrong-group" open data-wrong-group="' + esc(groupTag) + '">'
                + '<summary class="v2-wrong-summary">'
                    + '<span class="v2-wrong-summary-title">' + esc(title) + '</span>'
                    + '<span class="v2-wrong-summary-meta">練習中 ' + practiceCount + ' / 已克服 ' + masteredCount + '</span>'
                + '</summary>'
                + '<div class="v2-wrong-cards">';

            for (let j = 0; j < g.entries.length; j++) {
                const family = g.family;
                const difficulty = g.difficulty;
                const entry = g.entries[j];
                const ck = entry.compoundKey;
                const bank = (typeof AnswerBank !== 'undefined') ? AnswerBank[ck] : null;
                const img = _findImageFor(ck);
                const boxDots = '●'.repeat(entry.box) + '○'.repeat(5 - entry.box);
                const masteredClass = entry.box >= 4 ? ' mastered' : '';
                html += '<div class="v2-wrong-card box-' + entry.box + masteredClass + '">'
                    + '<img src="' + esc(img || '') + '" alt="">'
                    + '<div class="name-zh">' + esc(bank ? bank.content : ck) + '</div>'
                    + '<div class="box-indicator" title="卡片盒層級 ' + entry.box + '/5">' + boxDots + '</div>'
                    + '<button type="button" class="v2-wrong-delete" data-wrong-delete="' + esc(groupTag + '|' + ck) + '" title="從錯題本移除">×</button>'
                + '</div>';
            }
            html += '</div><div class="v2-wrong-actions">'
                + '<button type="button" data-wrong-retrain="' + esc(groupTag) + '" data-wrong-keys="' + esc(filteredKeys) + '">重練目前篩選 (' + g.entries.length + ' 題)</button>';
            if (masteredCount > 0) {
                html += '<button type="button" class="v2-wrong-purge" data-wrong-purge="' + esc(groupTag) + '">刪除已克服 (' + masteredCount + ' 題)</button>';
            }
            html += '</div></details>';
        }
        html += '</div>';
        root.innerHTML = html;
        wireWrongBookTabs(root);
        wireWrongBookActions(root);
    }

    function wireWrongBookTabs(root) {
        root.querySelectorAll('[data-wrong-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _wrongBookTab = btn.getAttribute('data-wrong-tab') || 'category';
                renderWrongBookScreen();
            });
        });
    }

    function wireWrongBookActions(root) {
        root.querySelectorAll('[data-wrong-retrain]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const parts = (btn.getAttribute('data-wrong-retrain') || '').split('|');
                const keys = (btn.getAttribute('data-wrong-keys') || '').split(',').filter(Boolean);
                startMode({ mode: 'practice', family: parts[0], difficulty: parts[1], opponent: 'human', queueSource: 'wrongOnly', wrongKeys: keys });
            });
        });
        root.querySelectorAll('[data-wrong-delete]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                const parts = (btn.getAttribute('data-wrong-delete') || '').split('|');
                if (Save.deleteWrongV2) {
                    Save.deleteWrongV2(parts[0], parts[1], parts[2]);
                    render();
                }
            });
        });
        root.querySelectorAll('[data-wrong-purge]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const parts = (btn.getAttribute('data-wrong-purge') || '').split('|');
                _pendingConfirm = {
                    text: '確定要刪除這組已克服的卡片？',
                    onYes: function () {
                        if (Save.deleteMasteredWrongsV2) Save.deleteMasteredWrongsV2(parts[0], parts[1]);
                        render();
                    },
                    onNo: function () {}
                };
                render();
            });
        });
    }

    function renderSettingsScreen() {
        const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
        // Player tab
        _setChecked('settings-sound-enabled', settings.soundEnabled !== false); // default true
        _setChecked('settings-dev-quickwin-enabled', settings.devQuickWin && settings.devQuickWin.enabled);
        _setValue('settings-dev-quickwin-after', settings.devQuickWin && settings.devQuickWin.winAfter);
        _setChecked('settings-dev-quickwin-show-indicator', settings.devQuickWin && settings.devQuickWin.showIndicator);
        _setChecked('settings-dev-show-fps', settings.devShowFps);
        _setChecked('settings-dev-log-actions', settings.devLogActions);
        // PvE AI params
        var pveAI = (settings && settings.pveAI) ? settings.pveAI : {};
        ['easy', 'medium', 'hard'].forEach(function (diff) {
            var p = (pveAI[diff] && typeof pveAI[diff] === 'object') ? pveAI[diff] : {};
            _setValue('pveai-' + diff + '-buzzWindowMin',  p.buzzWindowMin);
            _setValue('pveai-' + diff + '-buzzWindowMax',  p.buzzWindowMax);
            _setValue('pveai-' + diff + '-answerThinkMin', p.answerThinkMin);
            _setValue('pveai-' + diff + '-answerThinkMax', p.answerThinkMax);
        });
        _renderKeybindingsList(settings.keybindings || {});
    }

    // 快速鍵分組（顯示順序＝畫面順序；layout: 'grid2x2' 對應 2×2 選項版面）
    const _KEYBIND_GROUPS = [
        { title: '左側 / P1 答題', layout: 'grid2x2', rows: [
            { id: 'optionLeft0', label: '左上' },
            { id: 'optionLeft1', label: '右上' },
            { id: 'optionLeft2', label: '左下' },
            { id: 'optionLeft3', label: '右下' }
        ]},
        { title: '右側 / P2 答題（PvP）／練習替代輸入', layout: 'grid2x2', rows: [
            { id: 'optionRight0', label: '左上' },
            { id: 'optionRight1', label: '右上' },
            { id: 'optionRight2', label: '左下' },
            { id: 'optionRight3', label: '右下' }
        ]},
        { title: '搶答', layout: 'row2', rows: [
            { id: 'buzzP1', label: 'P1 搶答' },
            { id: 'buzzP2', label: 'P2 搶答' }
        ]}
    ];

    // 系統快速鍵：只顯示、不可改
    const _KEYBIND_READONLY_GROUPS = [
        { title: '選單操作（不可改）', layout: 'row2', rows: [
            { label: '移動焦點',  code: '↑ ↓ ← →' },
            { label: '啟動所選項', code: 'Enter / Space' }
        ]},
        { title: '畫面導航（不可改）', layout: 'row2', rows: [
            { label: '返回 / 離開', code: 'Esc / M' },
            { label: '投降（對決搶答中）', code: 'G' }
        ]},
        { title: '劇情播放（不可改）', layout: 'row2', rows: [
            { label: '推進對話', code: 'Space / Enter' },
            { label: '離開劇情', code: 'Esc' }
        ]}
    ];

    // 將 KeyboardEvent.code 轉成顯示文字
    function _formatKeyCode(code) {
        if (!code) return '—';
        if (code.indexOf('Key') === 0)    return code.slice(3);              // KeyA → A
        if (code.indexOf('Digit') === 0)  return code.slice(5);              // Digit4 → 4
        if (code.indexOf('Numpad') === 0) return 'Num ' + code.slice(6);     // Numpad4 → Num 4
        if (code.indexOf('Arrow') === 0)  return '↑↓←→ '.charAt(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(code)) || code;
        return code;                                                          // Space, Enter, Tab, …
    }

    function _escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _renderKeybindingsList(bindings) {
        const root = document.getElementById('keybindings-list');
        if (!root) return;
        root.innerHTML = '';
        _KEYBIND_GROUPS.forEach(function (group) {
            const h = document.createElement('div');
            h.className = 'v2-kb-group-title';
            h.textContent = group.title;
            root.appendChild(h);
            const grid = document.createElement('div');
            grid.className = 'v2-kb-grid v2-kb-' + (group.layout || 'list');
            group.rows.forEach(function (row) {
                const cell = document.createElement('div');
                cell.className = 'v2-kb-cell';
                const lbl = document.createElement('span');
                lbl.className = 'v2-kb-label';
                lbl.textContent = row.label;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'v2-kb-key';
                btn.setAttribute('data-kb-id', row.id);
                btn.textContent = _formatKeyCode(bindings[row.id]);
                cell.appendChild(lbl);
                cell.appendChild(btn);
                grid.appendChild(cell);
            });
            root.appendChild(grid);
        });
        // Read-only system keys
        _KEYBIND_READONLY_GROUPS.forEach(function (group) {
            const h = document.createElement('div');
            h.className = 'v2-kb-group-title';
            h.textContent = group.title;
            root.appendChild(h);
            const grid = document.createElement('div');
            grid.className = 'v2-kb-grid v2-kb-' + (group.layout || 'list');
            group.rows.forEach(function (row) {
                const cell = document.createElement('div');
                cell.className = 'v2-kb-cell';
                const lbl = document.createElement('span');
                lbl.className = 'v2-kb-label';
                lbl.textContent = row.label;
                const key = document.createElement('span');
                key.className = 'v2-kb-key is-readonly';
                key.textContent = row.code;
                cell.appendChild(lbl);
                cell.appendChild(key);
                grid.appendChild(cell);
            });
            root.appendChild(grid);
        });
    }
    function _setChecked(id, v) {
        const el = document.getElementById(id);
        if (el) el.checked = !!v;
    }
    function _setValue(id, v) {
        const el = document.getElementById(id);
        if (el && typeof v !== 'undefined' && v !== null) el.value = String(v);
    }

    function renderStoryScreen() {
        const whoEl  = document.getElementById('story-who');
        const textEl = document.getElementById('story-text');
        if (!whoEl || !textEl || !_storyState) return;
        const line = _storyState.lines[_storyState.idx];
        if (!line) return;
        const WHO_LABEL = { hat: '🎩 分類帽', wiz: '🧙 魔法師' };
        whoEl.textContent = WHO_LABEL[line.who] || line.who;
        const raw = line.text || '';
        const name = _storyState.playerName || '';
        textEl.textContent = name ? raw.replace(/\{name\}/g, name) : raw.replace(/\{name\}/g, '你');

        // Drive the sorting-hat character. hat lines use their author-given expr;
        // wiz lines (no other speaker exists) keep the hat present but neutral.
        const hatEl = document.getElementById('story-hat');
        if (hatEl) {
            ensureHatChar(hatEl);
            const expr = (line.who === 'hat') ? (line.expr || 'neutral') : 'neutral';
            setHatExpression(hatEl, expr);
        }
    }

    // Advance to next family/difficulty after settle.
    // Order: iterate Families in declaration order, for each difficulty in
    // [beginner, intermediate, advanced]; after the last → show "all done" alert.
    // Duel mode: "再來一場" (same family+difficulty, same opponent).
    function _goNextLevel() {
        if (!state) { goToScreen('main-menu'); return; }
        if (state.mode === 'duel') {
            // Duel: rematch same settings
            startMode({ mode: 'duel', family: state.family, difficulty: state.difficulty,
                        opponent: state.opponent || 'human' });
            return;
        }
        // Practice: find next family/difficulty in order
        const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
        const famKeys = Object.keys(typeof Families !== 'undefined' ? Families : {});
        // Build flat list of [family, difficulty] pairs valid for the family
        const all = [];
        for (const d of DIFFICULTIES) {
            for (const fk of famKeys) {
                if (Families[fk].difficulties && Families[fk].difficulties.indexOf(d) !== -1) {
                    all.push({ family: fk, difficulty: d });
                }
            }
        }
        // Find current index
        const curIdx = all.findIndex(function (item) {
            return item.family === state.family && item.difficulty === state.difficulty;
        });
        if (curIdx !== -1 && curIdx + 1 < all.length) {
            const next = all[curIdx + 1];
            startMode({ mode: 'practice', family: next.family, difficulty: next.difficulty, opponent: 'human' });
        } else {
            // Already at the last level
            _pendingConfirm = {
                text: '恭喜！你已完成所有關卡。',
                onYes: function () { goToScreen('main-menu'); },
                onNo: null
            };
            render();
        }
    }

    // Open story player. familyKey → looks up StoryScripts[familyKey].
    // onDone() is called after the last line (or if story is empty).
    function _openStory(familyKey, onDone) {
        const scripts = (typeof StoryScripts !== 'undefined') ? StoryScripts : {};
        const lines = scripts[familyKey];
        if (!lines || lines.length === 0) {
            if (typeof onDone === 'function') onDone();
            return;
        }
        const saveData = (typeof Save !== 'undefined' && Save.get) ? Save.get() : {};
        const playerName = saveData && saveData.playerName ? saveData.playerName : '';
        _storyState = { lines: lines, idx: 0, playerName: playerName, onDone: onDone || null };
        goToScreen('story');
    }

    function _advanceStory() {
        if (!_storyState) return;
        if (_storyState.idx < _storyState.lines.length - 1) {
            _storyState.idx++;
            render();
        } else {
            // Last line — end story
            const cb = _storyState.onDone;
            _storyState = null;
            if (typeof cb === 'function') {
                cb();
            } else {
                goToScreen('main-menu');
            }
        }
    }

    function renderTutorialModal() {
        const modal = document.getElementById('modal-tutorial');
        if (!modal) return;
        if (!_tutorialState) { modal.classList.remove('is-open'); return; }
        modal.classList.add('is-open');
        const title = document.getElementById('modal-tutorial-title');
        const body = document.getElementById('modal-tutorial-body');
        const page = _tutorialState.pages[_tutorialState.idx] || {};
        if (title) title.textContent = page.title || '教學';
        if (!body) return;

        // Build slide: [hat + img(s)] on top, text below.
        // page.img may be a string, array, or undefined.
        const imgs = Array.isArray(page.img) ? page.img.slice()
                   : (page.img ? [page.img] : []);
        const expr = page.expr || 'neutral';
        const text = page.text || page.body || page.content || '';

        // Escape helper for src attribute (paths are author-controlled but be safe)
        function attr(s) { return String(s).replace(/"/g, '&quot;'); }
        function esc(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        let mediaHTML = '';
        if (imgs.length > 0 || expr) {
            const iconClass = imgs.length > 1 ? 'tutorial-icon multi' : 'tutorial-icon';
            const imgHTML = imgs.map(src =>
                '<img class="tutorial-img" src="' + attr(src) + '" alt="">'
            ).join('');
            mediaHTML =
                '<div class="tutorial-slide-media">' +
                    '<div id="tutorial-hat" class="hat-char ' + esc(expr) + '"></div>' +
                    (imgs.length ? '<div class="' + iconClass + '">' + imgHTML + '</div>' : '') +
                '</div>';
        }
        body.innerHTML =
            '<div class="tutorial-slide">' +
                mediaHTML +
                '<p class="tutorial-text">' + esc(text) + '</p>' +
            '</div>';

        // Inject hat inner DOM so CSS face renders.
        const hatEl = body.querySelector('#tutorial-hat');
        ensureHatChar(hatEl);
    }

    function renderConfirmModal() {
        const modal = document.getElementById('modal-confirm');
        if (!modal) return;
        if (!_pendingConfirm) { modal.classList.remove('is-open'); return; }
        modal.classList.add('is-open');
        const t = document.getElementById('modal-confirm-text');
        if (t) t.textContent = _pendingConfirm.text || '確定？';
    }

    function openHelp(kind) {
        if (kind === 'wrong-book') {
            _tutorialState = {
                pages: [
                    {
                        title: '卡片盒記憶法',
                        expr: 'happy',
                        text: '卡片盒記憶法會把題目放進不同熟練度的盒子：越不熟越常練，越熟越往後放，讓複習集中在真正需要訂正的卡片。'
                    },
                    {
                        title: '頁籤代表什麼',
                        expr: 'neutral',
                        text: '待訂正是還沒有訂正成功的卡片；訂正一次、訂正兩次代表已連續答對後升到下一盒；已克服代表已進入第 4 盒，可以批次刪除。'
                    },
                    {
                        title: '訂正規則',
                        expr: 'neutral',
                        text: '訂正答對會累積熟練度並往後升盒；若再次答錯，卡片會回到待訂正。你也可以按單張卡片右上角的 × 自己刪除。'
                    }
                ],
                idx: 0,
                onDone: function () { goToScreen('wrong-book'); }
            };
            render();
            return;
        }
        if (kind === 'codex') {
            _tutorialState = {
                pages: [
                    {
                        title: '圖鑑頁籤',
                        expr: 'neutral',
                        text: '分子會顯示已解鎖的化合物；闖關進度記錄各子關完成狀態；勳章是累積成就；劇情會在通關後解鎖。'
                    },
                    {
                        title: '卡片內容',
                        expr: 'happy',
                        text: '已解鎖的分子卡可以點開，查看結構圖、名稱、分類與簡短說明。未解鎖卡片會先以 ??? 顯示。'
                    }
                ],
                idx: 0,
                onDone: function () { goToScreen('codex'); }
            };
            render();
        }
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
        const tutKey = opts.family + '-' + opts.difficulty;
        if (typeof Save !== 'undefined' && Save.isTutorialSeenV2 && !Save.isTutorialSeenV2(opts.family, opts.difficulty)) {
            const tut = (typeof LevelTutorials !== 'undefined') ? LevelTutorials[tutKey] : null;
            const pages = (tut && Array.isArray(tut.pages)) ? tut.pages
                        : (tut && Array.isArray(tut)) ? tut : null;
            if (pages && pages.length > 0) {
                _tutorialState = {
                    pages: pages,
                    idx: 0,
                    key: tutKey,
                    family: opts.family,
                    difficulty: opts.difficulty,
                    onDone: function () { beginMode(opts); }
                };
                render();
                return;
            }
        }
        beginMode(opts);
    }

    function beginMode(opts) {
        // Tear down any prior AI
        if (aiController) { try { aiController.stop(); } catch (e) {} aiController = null; }

        _wrongChosenMap = {};
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

        state.dynamic.variant = (opts.mode === 'duel') ? 'zoom' : null;

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
            familyScope: (state.difficulty === 'advanced') ? null : family,
            optionCount: 4
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
        const acc = state.players.p1.totalAsked > 0
            ? state.players.p1.correctCount / state.players.p1.totalAsked
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
    function attachGiveUpListeners() {
        const btn = document.getElementById('btn-giveup');
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                _dispatchGiveUpIfBuzzed();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.code !== 'KeyG') return;
            if (_dispatchGiveUpIfBuzzed()) e.preventDefault();
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
                    if (arg === 'advanced') {
                        // Advanced has only englishChallenge — skip sub-menu.
                        startMode({ mode: 'practice', family: 'englishChallenge', difficulty: 'advanced', opponent: 'human' });
                    } else {
                        _subMenuContext = { kind: 'difficulty', difficulty: arg };
                        goToScreen('sub-menu');
                    }
                    break;
                case 'enter-duel-menu':
                    _subMenuContext = { kind: 'duelDifficulty' };
                    goToScreen('sub-menu');
                    break;
                case 'enter-tutorial':
                    // Open generic tutorial — first key in LevelTutorials if any
                    if (typeof LevelTutorials !== 'undefined') {
                        const k = Object.keys(LevelTutorials)[0];
                        if (k) {
                            const tut = LevelTutorials[k];
                            const pages = Array.isArray(tut && tut.pages) ? tut.pages : (Array.isArray(tut) ? tut : null);
                            if (pages) {
                                _tutorialState = { pages: pages, idx: 0, key: k, onDone: function () { render(); } };
                                render();
                            }
                        }
                    }
                    break;
                case 'enter-codex': goToScreen('codex'); break;
                case 'enter-wrong-book': goToScreen('wrong-book'); break;
                case 'enter-settings': goToScreen('settings'); break;
                case 'open-help':
                    openHelp(arg);
                    break;
                case 'back-to-main':
                case 'back-to-menu':
                    if (aiController) { try { aiController.stop(); } catch (err) {} aiController = null; }
                    // 在 duel 子樹裡先逐層退回，全部退完才回主選單
                    if (_currentScreen === 'sub-menu' && _subMenuContext) {
                        if (_subMenuContext.kind === 'duelOpponentSetting'
                         || _subMenuContext.kind === 'duelFamily') {
                            _subMenuContext = { kind: 'duelDifficulty' };
                            render();
                            break;
                        }
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
                            _openStory(sKey, function () { goToScreen(prevScreen); });
                        }
                    }
                    break;
                case 'show-tutorial':
                    if (state && state.family && state.difficulty) {
                        const tutKey = state.family + '-' + state.difficulty;
                        const tut = (typeof LevelTutorials !== 'undefined') ? LevelTutorials[tutKey] : null;
                        const pages = (tut && Array.isArray(tut.pages)) ? tut.pages
                                    : (tut && Array.isArray(tut)) ? tut : null;
                        if (pages && pages.length > 0) {
                            _tutorialState = {
                                pages: pages, idx: 0, key: tutKey,
                                family: state.family, difficulty: state.difficulty,
                                onDone: function () { goToScreen('settle'); }
                            };
                            render();
                        }
                    }
                    break;
                case 'next-level':
                    _goNextLevel();
                    break;
                case 'story-advance':
                    _advanceStory();
                    break;
                case 'tutorial-prev':
                    if (_tutorialState && _tutorialState.idx > 0) { _tutorialState.idx--; render(); }
                    break;
                case 'tutorial-next':
                    if (_tutorialState) {
                        if (_tutorialState.idx < _tutorialState.pages.length - 1) {
                            _tutorialState.idx++;
                            render();
                        } else {
                            _closeTutorialAndContinue();
                        }
                    }
                    break;
                case 'tutorial-close':
                    _closeTutorialAndContinue();
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
            storyScreen.addEventListener('click', function () {
                if (_currentScreen === 'story') _advanceStory();
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
                        _subMenuContext = { kind: 'duelDifficulty' };
                        render(); e.preventDefault(); return;
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
                        goToScreen('main-menu');
                    },
                    onNo: function () {}
                };
                render();
                e.preventDefault();
                return;
            }
            if (_currentScreen === 'story') {
                if (e.code === 'Space' || e.code === 'Enter') { _advanceStory(); e.preventDefault(); return; }
                if (e.code === 'Escape') { _storyState = null; goToScreen('main-menu'); e.preventDefault(); return; }
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
    function _closeTutorialAndContinue() {
        if (!_tutorialState) return;
        const cb = _tutorialState.onDone;
        if (_tutorialState.family && _tutorialState.difficulty
            && typeof Save !== 'undefined' && Save.markTutorialSeenV2) {
            Save.markTutorialSeenV2(_tutorialState.family, _tutorialState.difficulty);
        }
        _tutorialState = null;
        render();
        if (typeof cb === 'function') cb();
    }

    // 快速鍵捕捉：一次只允許一個格子處於捕捉狀態
    let _kbCaptureCleanup = null;
    function _wireKeybindingsCapture() {
        const root = document.getElementById('keybindings-list');
        if (!root) return;
        root.addEventListener('click', function (e) {
            const btn = e.target.closest && e.target.closest('.v2-kb-key');
            if (!btn || btn.classList.contains('is-readonly')) return;
            _startKeybindingCapture(btn);
        });
    }
    function _startKeybindingCapture(btn) {
        if (_kbCaptureCleanup) _kbCaptureCleanup();
        const id = btn.getAttribute('data-kb-id');
        btn.classList.add('is-capturing');
        btn.textContent = '按下任一鍵…';
        function onKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            cleanup();
            if (ev.code === 'Escape') { renderSettingsScreen(); return; }
            // 找出衝突的 binding，若有 → 交換到舊鍵
            const current = Save.readSettings().keybindings || {};
            const oldCode = current[id];
            const patch = {};
            patch[id] = ev.code;
            for (const otherId of Object.keys(current)) {
                if (otherId !== id && current[otherId] === ev.code) {
                    patch[otherId] = oldCode;  // 交換
                }
            }
            Save.writeSettings({ keybindings: patch });
            renderSettingsScreen();
        }
        function cleanup() {
            document.removeEventListener('keydown', onKey, true);
            btn.classList.remove('is-capturing');
            _kbCaptureCleanup = null;
        }
        _kbCaptureCleanup = cleanup;
        document.addEventListener('keydown', onKey, true);
    }

    function attachSettingsListeners() {
        const map = [
            ['settings-sound-enabled', 'checkbox', function (v) {
                Save.writeSettings({ soundEnabled: v });
            }],
            ['settings-dev-quickwin-enabled', 'checkbox', function (v) {
                Save.writeSettings({ devQuickWin: { enabled: v } });
            }],
            ['settings-dev-quickwin-after', 'number', function (v) {
                Save.writeSettings({ devQuickWin: { winAfter: v } });
            }],
            ['settings-dev-quickwin-show-indicator', 'checkbox', function (v) {
                Save.writeSettings({ devQuickWin: { showIndicator: v } });
            }],
            ['settings-dev-show-fps', 'checkbox', function (v) {
                Save.writeSettings({ devShowFps: v });
            }],
            ['settings-dev-log-actions', 'checkbox', function (v) {
                Save.writeSettings({ devLogActions: v });
            }],
        ];
        for (let i = 0; i < map.length; i++) {
            const [id, kind, setter] = map[i];
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener('change', function () {
                const v = (kind === 'checkbox') ? !!el.checked
                        : (kind === 'number') ? Math.max(1, Number(el.value) || 1)
                        : el.value;
                setter(v);
                render();
            });
        }
        // PvE AI number inputs (live-update settings.pveAI)
        ['easy', 'medium', 'hard'].forEach(function (diff) {
            ['buzzWindowMin', 'buzzWindowMax', 'answerThinkMin', 'answerThinkMax'].forEach(function (field) {
                const elId = 'pveai-' + diff + '-' + field;
                const el = document.getElementById(elId);
                if (!el) return;
                el.addEventListener('change', function () {
                    const raw = parseFloat(el.value);
                    if (isNaN(raw)) return;
                    const val = (field === 'buzzWindowMin' || field === 'buzzWindowMax')
                        ? Math.min(1, Math.max(0, raw))
                        : Math.max(0, raw);
                    const patch = {};
                    patch[diff] = {};
                    patch[diff][field] = val;
                    Save.writeSettings({ pveAI: patch });
                });
            });
        });
        // PvE AI reset-to-default button
        const pveaiReset = document.getElementById('settings-pveai-reset');
        if (pveaiReset) {
            pveaiReset.addEventListener('click', function () {
                Save.writeSettings({ pveAI: {
                    easy:   { buzzWindowMin: 0.85, buzzWindowMax: 0.95, answerThinkMin: 1500, answerThinkMax: 3000 },
                    medium: { buzzWindowMin: 0.75, buzzWindowMax: 0.90, answerThinkMin: 1200, answerThinkMax: 2500 },
                    hard:   { buzzWindowMin: 0.70, buzzWindowMax: 0.85, answerThinkMin: 1000, answerThinkMax: 2000 }
                }});
                renderSettingsScreen();
            });
        }
        // 快速鍵：點擊任一格 → 進入「按下新鍵」捕捉狀態
        _wireKeybindingsCapture();
        const kbReset = document.getElementById('settings-keys-reset');
        if (kbReset) {
            kbReset.addEventListener('click', function () {
                const def = (Save && Save.defaultKeybindings) ? Save.defaultKeybindings() : {};
                Save.writeSettings({ keybindings: def });
                renderSettingsScreen();
            });
        }
        // Tab switching
        document.querySelectorAll('#screen-settings .v2-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                const which = tab.getAttribute('data-tab');
                document.querySelectorAll('#screen-settings .v2-tab').forEach(function (t) {
                    t.classList.toggle('is-active', t === tab);
                });
                document.querySelectorAll('#screen-settings .v2-tab-panel').forEach(function (p) {
                    p.classList.toggle('is-active', p.getAttribute('data-tab-panel') === which);
                });
            });
        });
        // Save tab buttons
        const resetWrong = document.getElementById('settings-wrong-book-reset');
        if (resetWrong) resetWrong.addEventListener('click', function () {
            _pendingConfirm = {
                text: '確定要清空整個錯題本？此動作無法復原。',
                onYes: function () { Save.clearWrongLog(); render(); },
                onNo: function () {}
            };
            render();
        });
        const resetBtn = document.getElementById('settings-reset-button');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            _pendingConfirm = {
                text: '確定要重置全部存檔？所有進度將消失。',
                onYes: function () { Save.reset(); render(); },
                onNo: function () {}
            };
            render();
        });
        const exportBtn = document.getElementById('settings-export-button');
        if (exportBtn) exportBtn.addEventListener('click', function () {
            const text = Save.exportText();
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'organic-sorting-save.json';
            a.click();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
        const importBtn = document.getElementById('settings-import-button');
        if (importBtn) importBtn.addEventListener('click', function () {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.addEventListener('change', function () {
                const file = input.files && input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function () {
                    if (Save.importText(String(reader.result))) {
                        render();
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        });
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
    function ensureHatChar(el) {
        if (el && !el.querySelector('.hat-img')) el.innerHTML = HAT_INNER;
    }
    function setHatExpression(el, expr) {
        if (!el) return;
        HAT_EXPRS.forEach(e => el.classList.remove(e));
        el.classList.add(expr && HAT_EXPRS.indexOf(expr) >= 0 ? expr : 'neutral');
    }
    let _hatMouseBound = false;
    function initHatChars() {
        document.querySelectorAll('.hat-char').forEach(ensureHatChar);
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

        attachMenuListeners();
        attachSettingsListeners();
        attachGiveUpListeners();
        initHatChars();
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
