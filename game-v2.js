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
        }
        renderTutorialModal();
        renderConfirmModal();
        renderDevBanner();
    }

    function renderMainMenu() { /* static markup; no per-state rendering */ }

    // Sub-menu kinds:
    //   'difficulty'           { difficulty }   → family list, click starts practice
    //   'duelDifficulty'       {}               → 初/中/高 + "修改模式..." (mode is sticky)
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

        function appendFamilyButton(fk, diff, onClick) {
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
            btn.textContent = label;
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
                const btn = appendFamilyButton(fk, diff, function () {
                    startMode({ mode: 'practice', family: fk, difficulty: diff, opponent: 'human' });
                });
                btn.textContent = (i + 1) + '. ' + btn.textContent;
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duelDifficulty') {
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const currentOpp = settings.duelOpponent || 'aiMedium';
            const oppLabel = { human: 'PvP（雙人）', aiEasy: 'PvE 易', aiMedium: 'PvE 中', aiHard: 'PvE 難' }[currentOpp] || currentOpp;
            titleEl.textContent = '⚔️ 對決 — 選擇難度（目前對手：' + oppLabel + '）';
            const diffs = [
                { key: 'beginner', label: '1. 初級' },
                { key: 'intermediate', label: '2. 中級' },
                { key: 'advanced', label: '3. 高級' }
            ];
            for (let i = 0; i < diffs.length; i++) {
                const d = diffs[i];
                const btn = document.createElement('button');
                btn.textContent = d.label;
                btn.addEventListener('click', function () {
                    _subMenuContext = { kind: 'duelFamily', difficulty: d.key };
                    render();
                });
                listEl.appendChild(btn);
            }
            // "修改對手模式" 放在底下，視覺上跟難度按鈕區分
            const modeBtn = document.createElement('button');
            modeBtn.className = 'v2-sub-mode-toggle';
            modeBtn.textContent = '4. 修改對手模式...';
            modeBtn.addEventListener('click', function () {
                _subMenuContext = { kind: 'duelOpponentSetting' };
                render();
            });
            listEl.appendChild(modeBtn);
        } else if (_subMenuContext.kind === 'duelFamily') {
            const diff = _subMenuContext.difficulty;
            const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
            const opponent = settings.duelOpponent || 'aiMedium';
            const oppLabel = { human: 'PvP', aiEasy: 'PvE 易', aiMedium: 'PvE 中', aiHard: 'PvE 難' }[opponent] || opponent;
            titleEl.textContent = '⚔️ ' + diffName(diff) + ' 對決（' + oppLabel + '） — 選擇主題子關';
            const familyKeys = Object.keys(Families).filter(k => Families[k].difficulties.indexOf(diff) !== -1);
            for (let i = 0; i < familyKeys.length; i++) {
                const fk = familyKeys[i];
                const btn = appendFamilyButton(fk, diff, function () {
                    // 直接用 settings 裡存的對手模式開始對決
                    startMode({ mode: 'duel', family: fk, difficulty: diff, opponent: opponent });
                });
                btn.textContent = (i + 1) + '. ' + btn.textContent;
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duelOpponentSetting') {
            titleEl.textContent = '⚔️ 對決 — 選擇對手模式（會記住下次自動使用）';
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
                btn.textContent = op.label + (op.key === current ? '  ✓' : '');
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
            for (let i = 0; i < btns.length; i++) {
                const opt = state.question.options[i];
                if (opt) {
                    btns[i].setAttribute('data-option-key', opt.key);
                    btns[i].textContent = opt.content || '';
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
                    btns[i].textContent = '';
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
                giveup.classList.add('visible');
                giveup.setAttribute('data-side', side);
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
                    card.innerHTML =
                        '<img src="' + (img || '') + '" alt="">' +
                        '<div class="name-zh">' + (entry ? entry.content : ck) + '</div>';
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

    function renderCodexScreen() {
        const root = document.getElementById('codex-content');
        if (!root) return;
        if (typeof Families === 'undefined' || typeof QuestionImages === 'undefined' || typeof AnswerBank === 'undefined') {
            root.innerHTML = '<p style="text-align:center;color:var(--hp-parchment-dark);">資料載入中…</p>';
            return;
        }

        const frag = document.createDocumentFragment();

        // --- Family sections: each family → molecules grid ---
        for (const fKey of Object.keys(Families)) {
            const fam = Families[fKey];
            const filter = fam.imageFilter || {};

            // Collect compoundKeys for this family
            const famKeys = [];
            for (let i = 0; i < QuestionImages.length; i++) {
                const img = QuestionImages[i];
                const ck = img.compoundKey;
                let include = false;
                if (filter.type === 'all') {
                    include = true;
                } else if (filter.type === 'byCategory') {
                    const entry = AnswerBank[ck];
                    include = entry && filter.categories && filter.categories.includes(entry.category);
                } else if (filter.type === 'byCompoundKeys') {
                    include = filter.keys && filter.keys.includes(ck);
                }
                if (include) famKeys.push({ ck: ck, src: img.src });
            }

            const section = document.createElement('div');
            section.className = 'codex-family-section';

            const heading = document.createElement('h3');
            heading.textContent = fam.nameZh || fKey;
            section.appendChild(heading);

            const grid = document.createElement('div');
            grid.className = 'codex-grid';

            for (const item of famKeys) {
                const unlocked = (typeof Save !== 'undefined' && Save.isMolUnlocked)
                    ? Save.isMolUnlocked(item.ck) : false;
                const abEntry = AnswerBank[item.ck];
                const nameZh = (abEntry && abEntry.content) ? abEntry.content : item.ck;

                const card = document.createElement('div');
                card.className = 'codex-mol-card' + (unlocked ? '' : ' locked');

                if (unlocked) {
                    const img = document.createElement('img');
                    img.className = 'codex-mol-img';
                    img.src = item.src;
                    img.alt = nameZh;
                    img.loading = 'lazy';
                    card.appendChild(img);
                } else {
                    const ph = document.createElement('div');
                    ph.className = 'codex-mol-img placeholder';
                    ph.textContent = '?';
                    card.appendChild(ph);
                }

                const label = document.createElement('div');
                label.className = 'codex-mol-name';
                label.textContent = unlocked ? nameZh : '???';
                card.appendChild(label);

                grid.appendChild(card);
            }
            section.appendChild(grid);
            frag.appendChild(section);
        }

        // --- Story status section ---
        const storySection = document.createElement('div');
        storySection.className = 'codex-story-status-section';
        const storyHeading = document.createElement('h3');
        storyHeading.textContent = '家族劇情解鎖狀態';
        storySection.appendChild(storyHeading);

        for (const fKey of Object.keys(Families)) {
            const fam = Families[fKey];
            if (!fam.storyKey) continue; // englishChallenge has no story
            const unlocked = (typeof Save !== 'undefined' && Save.isStoryUnlockedV2)
                ? Save.isStoryUnlockedV2(fam.storyKey)
                : false;
            const row = document.createElement('div');
            row.className = 'codex-story-row' + (unlocked ? '' : ' locked-story');
            const badge = document.createElement('span');
            badge.className = 'story-badge';
            badge.textContent = unlocked ? '📖' : '🔒';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = fam.nameZh || fKey;
            row.appendChild(badge);
            row.appendChild(nameSpan);
            storySection.appendChild(row);
        }
        frag.appendChild(storySection);

        root.innerHTML = '';
        root.appendChild(frag);
    }

    function renderWrongBookScreen() {
        const root = document.getElementById('wrong-book-groups');
        if (!root) return;
        root.innerHTML = '';
        const all = (typeof Save !== 'undefined' && Save.getAllActiveWrongs)
            ? Save.getAllActiveWrongs() : {};
        const keys = Object.keys(all);
        if (keys.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'v2-wrong-empty';
            empty.textContent = '目前沒有錯題 ✨';
            root.appendChild(empty);
            return;
        }
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]; // 'family-difficulty'
            const dashIdx = key.lastIndexOf('-');
            if (dashIdx === -1) continue;
            const family = key.slice(0, dashIdx);
            const difficulty = key.slice(dashIdx + 1);
            const fam = (typeof Families !== 'undefined') ? Families[family] : null;
            const diffName = { beginner: '初', intermediate: '中', advanced: '高' }[difficulty] || difficulty;

            const entries = (Save.getWrongEntriesV2)
                ? Save.getWrongEntriesV2(family, difficulty)
                : all[key].map(function (ck) { return { compoundKey: ck, box: 1, correctStreak: 0 }; });
            const masteredCount = entries.filter(function (e) { return e.box >= 4; }).length;
            const struggleCount = entries.length - masteredCount;

            const block = document.createElement('div');
            block.className = 'v2-wrong-group';

            const header = document.createElement('div');
            header.innerHTML =
                '<h3>' + (fam ? fam.nameZh : family) + ' · ' + diffName + '</h3>' +
                '<div>共 <span class="count">' + entries.length + '</span> 題（still 練習中 ' + struggleCount
                + '，已克服 ' + masteredCount + '）</div>';
            block.appendChild(header);

            // Cards
            const cardWrap = document.createElement('div');
            cardWrap.className = 'v2-wrong-cards';
            for (let j = 0; j < entries.length; j++) {
                const entry = entries[j];
                const ck = entry.compoundKey;
                const bank = (typeof AnswerBank !== 'undefined') ? AnswerBank[ck] : null;
                const img = _findImageFor(ck);
                const card = document.createElement('div');
                card.className = 'v2-wrong-card box-' + entry.box;
                if (entry.box >= 4) card.classList.add('mastered');
                const boxDots = '●'.repeat(entry.box) + '○'.repeat(5 - entry.box);
                card.innerHTML =
                    '<img src="' + (img || '') + '" alt="">' +
                    '<div class="name-zh">' + (bank ? bank.content : ck) + '</div>' +
                    '<div class="box-indicator" title="鞋盒層級 ' + entry.box + '/5">' + boxDots + '</div>';
                const del = document.createElement('button');
                del.className = 'v2-wrong-delete';
                del.textContent = '✕';
                del.title = '從錯題本移除';
                del.addEventListener('click', function () {
                    if (Save.deleteWrongV2) {
                        Save.deleteWrongV2(family, difficulty, ck);
                        render();
                    }
                });
                card.appendChild(del);
                cardWrap.appendChild(card);
            }
            block.appendChild(cardWrap);

            // Action buttons
            const actions = document.createElement('div');
            actions.className = 'v2-wrong-actions';

            const retrainBtn = document.createElement('button');
            retrainBtn.textContent = '重練這組 (' + entries.length + ' 題)';
            retrainBtn.addEventListener('click', function () {
                startMode({
                    mode: 'practice', family: family, difficulty: difficulty,
                    opponent: 'human', queueSource: 'wrongOnly'
                });
            });
            actions.appendChild(retrainBtn);

            if (masteredCount > 0) {
                const purgeBtn = document.createElement('button');
                purgeBtn.textContent = '刪除已克服 (' + masteredCount + ' 題)';
                purgeBtn.className = 'v2-wrong-purge';
                purgeBtn.addEventListener('click', function () {
                    _pendingConfirm = {
                        text: '確定要刪除這組已克服的 ' + masteredCount + ' 題？',
                        onYes: function () {
                            if (Save.deleteMasteredWrongsV2) {
                                Save.deleteMasteredWrongsV2(family, difficulty);
                            }
                            render();
                        },
                        onNo: function () {}
                    };
                    render();
                });
                actions.appendChild(purgeBtn);
            }
            block.appendChild(actions);

            root.appendChild(block);
        }
    }

    function renderSettingsScreen() {
        const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
        _setChecked('settings-dev-quickwin-enabled', settings.devQuickWin && settings.devQuickWin.enabled);
        _setValue('settings-dev-quickwin-after', settings.devQuickWin && settings.devQuickWin.winAfter);
        _setChecked('settings-dev-quickwin-show-indicator', settings.devQuickWin && settings.devQuickWin.showIndicator);
        _setChecked('settings-dev-show-fps', settings.devShowFps);
        _setChecked('settings-dev-log-actions', settings.devLogActions);
    }
    function _setChecked(id, v) {
        const el = document.getElementById(id);
        if (el) el.checked = !!v;
    }
    function _setValue(id, v) {
        const el = document.getElementById(id);
        if (el && typeof v !== 'undefined' && v !== null) el.value = String(v);
    }

    function renderTutorialModal() {
        const modal = document.getElementById('modal-tutorial');
        if (!modal) return;
        if (!_tutorialState) { modal.classList.remove('is-open'); return; }
        modal.classList.add('is-open');
        const title = document.getElementById('modal-tutorial-title');
        const body = document.getElementById('modal-tutorial-body');
        const page = _tutorialState.pages[_tutorialState.idx];
        if (title) title.textContent = (page && page.title) || '教學';
        if (body) body.textContent = (page && (page.text || page.body || page.content)) || '';
    }

    function renderConfirmModal() {
        const modal = document.getElementById('modal-confirm');
        if (!modal) return;
        if (!_pendingConfirm) { modal.classList.remove('is-open'); return; }
        modal.classList.add('is-open');
        const t = document.getElementById('modal-confirm-text');
        if (t) t.textContent = _pendingConfirm.text || '確定？';
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

        state = GameState.createStateV2();
        state.mode = opts.mode;
        state.family = opts.family;
        state.difficulty = opts.difficulty;
        state.opponent = opts.opponent || 'human';
        state.queueSource = opts.queueSource || 'fresh';

        // Build queue
        if (opts.queueSource === 'wrongOnly') {
            state.queue = _buildQueueFromWrongBook(opts.family, opts.difficulty);
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

    function _buildQueueFromWrongBook(family, difficulty) {
        const active = (typeof Save !== 'undefined' && Save.getActiveWrongs)
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
                case 'show-tutorial':
                case 'next-level':
                    // Minimal: just go back to main menu for now.
                    goToScreen('main-menu');
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

        // Keyboard shortcuts for menu screens (game-screen input is handled by InputController)
        document.addEventListener('keydown', function (e) {
            // Globals
            if (_currentScreen === 'main-menu') {
                if (e.code === 'Digit1' || e.code === 'Numpad1') { _enterDifficulty('beginner'); e.preventDefault(); return; }
                if (e.code === 'Digit2' || e.code === 'Numpad2') { _enterDifficulty('intermediate'); e.preventDefault(); return; }
                if (e.code === 'Digit3' || e.code === 'Numpad3') { _enterDifficulty('advanced'); e.preventDefault(); return; }
                if (e.code === 'Digit4' || e.code === 'Numpad4') { _subMenuContext = { kind: 'duelDifficulty' }; goToScreen('sub-menu'); e.preventDefault(); return; }
                if (e.code === 'KeyT') { _clickAction('enter-tutorial'); e.preventDefault(); return; }
                if (e.code === 'KeyC') { goToScreen('codex'); e.preventDefault(); return; }
                if (e.code === 'KeyW') { goToScreen('wrong-book'); e.preventDefault(); return; }
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
            if (_currentScreen === 'settle') {
                if (e.code === 'KeyR') { _clickAction('continue-practice'); e.preventDefault(); return; }
                if (e.code === 'KeyN') { _clickAction('next-level'); e.preventDefault(); return; }
                if (e.code === 'KeyS') { _clickAction('show-story'); e.preventDefault(); return; }
                if (e.code === 'KeyT') { _clickAction('show-tutorial'); e.preventDefault(); return; }
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

    function attachSettingsListeners() {
        const map = [
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
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready (script loaded after parsing).
        init();
    }
})();
