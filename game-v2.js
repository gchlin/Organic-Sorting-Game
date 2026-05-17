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
        if (action.type === 'SUBMIT_ANSWER' && preCompoundKey) {
            const wasCorrect = (action.key === preCorrectKey);
            if (state.mode === 'practice' && wasCorrect) {
                if (typeof Save !== 'undefined') {
                    if (Save.markFixedV2) Save.markFixedV2(state.family, state.difficulty, preCompoundKey);
                    if (Save.recordMoleculeAnsweredV2) Save.recordMoleculeAnsweredV2(preCompoundKey, state.difficulty);
                    if (Save.addCorrect) Save.addCorrect(1);
                }
            } else if (state.mode === 'practice' && !wasCorrect) {
                state.wrongInRound.add(preCompoundKey);
                if (typeof Save !== 'undefined' && Save.recordWrongV2) {
                    Save.recordWrongV2(state.family, state.difficulty, preCompoundKey);
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
            // No-op here: EffectManager.cancelAllEffects on cleanup already clears timers.
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
                      onTick: function (ms) { if (state && state.dynamic) state.dynamic.elapsedMs = ms; },
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
                      onTick: function (ms) { if (state && state.dynamic) state.dynamic.elapsedMs = ms; },
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
                      onTick: function (ms) { if (state && state.dynamic) state.dynamic.elapsedMs = ms; },
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
        // Per state→class table: clear all .eliminated/.wrong-chosen/.correct-reveal on options;
        // hide hint bubble; remove buzz-owner-* classes from #game-buzz.
        const opts = document.querySelectorAll('#game-options .option-btn');
        for (let i = 0; i < opts.length; i++) {
            opts[i].classList.remove('eliminated', 'wrong-chosen', 'correct-reveal');
        }
        const buzz = document.getElementById('game-buzz');
        if (buzz) buzz.classList.remove('buzz-open', 'buzz-owner-p1', 'buzz-owner-p2');
        const hint = document.getElementById('game-hint-bubble');
        if (hint) { hint.classList.remove('visible'); hint.textContent = ''; }
        const img = document.getElementById('game-image');
        if (img) img.classList.remove('dyn-zoom', 'dyn-playing', 'dyn-paused', 'dyn-completing', 'dyn-complete');
    }

    // -----------------------------------------------------------------------
    // 2. Render
    // -----------------------------------------------------------------------
    function render() {
        if (typeof document === 'undefined') return;
        document.body.classList.add('v2-active');

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
            'phase-revealing', 'phase-cleanup', 'input-locked'
        );
        if (state) {
            if (state.phase === 'resolvingCorrect') document.body.classList.add('phase-resolving-correct');
            if (state.phase === 'resolvingWrong') document.body.classList.add('phase-resolving-wrong');
            if (state.phase === 'revealing') document.body.classList.add('phase-revealing');
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

    function renderSubMenu() {
        const titleEl = document.getElementById('sub-menu-title');
        const listEl = document.getElementById('sub-menu-list');
        if (!titleEl || !listEl) return;
        listEl.innerHTML = '';
        if (!_subMenuContext) return;

        if (_subMenuContext.kind === 'difficulty') {
            const diff = _subMenuContext.difficulty;
            const diffName = { beginner: '初級', intermediate: '中級', advanced: '高級' }[diff] || diff;
            titleEl.textContent = diffName + ' — 選擇主題子關';
            const familyKeys = Object.keys(Families).filter(k => Families[k].difficulties.indexOf(diff) !== -1);
            for (let i = 0; i < familyKeys.length; i++) {
                const fk = familyKeys[i];
                const btn = document.createElement('button');
                btn.textContent = (i + 1) + '. ' + Families[fk].nameZh;
                if (typeof Save !== 'undefined' && Save.isSubLevelCleared && Save.isSubLevelCleared(fk, diff)) {
                    btn.classList.add('sub-cleared');
                }
                btn.addEventListener('click', function () {
                    startMode({ mode: 'practice', family: fk, difficulty: diff, opponent: 'human' });
                });
                listEl.appendChild(btn);
            }
        } else if (_subMenuContext.kind === 'duel') {
            titleEl.textContent = 'Duel Dynamic — 選對手';
            const duelDiff = _subMenuContext.difficulty || 'intermediate';
            const opponents = [
                { key: 'human', label: '1. PvP（雙人）' },
                { key: 'aiEasy', label: '2. PvE 易' },
                { key: 'aiMedium', label: '3. PvE 中' },
                { key: 'aiHard', label: '4. PvE 難' },
            ];
            for (let i = 0; i < opponents.length; i++) {
                const op = opponents[i];
                const btn = document.createElement('button');
                btn.textContent = op.label;
                btn.addEventListener('click', function () {
                    startMode({ mode: 'duel', family: 'mixed', difficulty: duelDiff, opponent: op.key });
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
        }

        // Options: render only when phase indicates options should be visible.
        // Practice: visible whenever question exists. Duel: visible only while phase===buzzed (and shown to owner only) or revealing.
        const optsContainer = document.getElementById('game-options');
        if (optsContainer && state.question && state.question.options) {
            const showOptions = (state.mode === 'practice')
                || (state.mode === 'duel'
                    && (state.phase === 'buzzed' || state.phase === 'revealing'
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
                        state.phase === 'revealing' && opt.key === state.question.correctKey);
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
        }
    }

    function _comboLevel(streak) {
        if (streak >= 8) return 'Brilliant!';
        if (streak >= 5) return 'Great!';
        if (streak >= 3) return 'Good!';
        return '';
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
            const wrongsLeft = (typeof Save !== 'undefined' && Save.getActiveWrongs
                ? Save.getActiveWrongs(state.family, state.difficulty).length
                : 0);
            if (state.queueSource === 'wrongOnly' && wrongsLeft === 0) {
                titleEl.textContent = '🎉 已克服該組所有錯題';
            } else {
                titleEl.textContent = cleared ? '已通關該子關 🥉' : '本輪結算';
            }
        }

        const acc = state.players.p1.totalAsked > 0
            ? (state.players.p1.correctCount / state.players.p1.totalAsked) : null;
        statsEl.innerHTML = '';
        _appendStat(statsEl, '答對', String(state.players.p1.correctCount || 0));
        if (state.mode === 'duel') {
            _appendStat(statsEl, 'P2 答對', String(state.players.p2.correctCount || 0));
        }
        _appendStat(statsEl, '本輪正確率', acc !== null ? (Math.round(acc * 100) + '%') : '—');

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
        root.innerHTML = '<p style="text-align:center;color:var(--hp-parchment-dark);">圖鑑顯示佔位 — 完整家族卡 / 分子卡渲染待 wave 5 補上。</p>';
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
            empty.textContent = '目前沒有未克服的錯題 ✨';
            root.appendChild(empty);
            return;
        }
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]; // 'family-difficulty'
            const dashIdx = key.lastIndexOf('-');
            if (dashIdx === -1) continue;
            const family = key.slice(0, dashIdx);
            const difficulty = key.slice(dashIdx + 1);
            const compounds = all[key];
            const fam = (typeof Families !== 'undefined') ? Families[family] : null;
            const diffName = { beginner: '初', intermediate: '中', advanced: '高' }[difficulty] || difficulty;
            const block = document.createElement('div');
            block.className = 'v2-wrong-group';
            block.innerHTML =
                '<h3>' + (fam ? fam.nameZh : family) + ' · ' + diffName + '</h3>' +
                '<div>未克服 <span class="count">' + compounds.length + '</span> 題</div>';
            const retrainBtn = document.createElement('button');
            retrainBtn.textContent = '重練這組 (' + compounds.length + ' 題)';
            retrainBtn.addEventListener('click', function () {
                startMode({
                    mode: 'practice', family: family, difficulty: difficulty,
                    opponent: 'human', queueSource: 'wrongOnly'
                });
            });
            block.appendChild(retrainBtn);
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
            }
            // dev shortcut also unlocks
            const s = Save.readSettings ? Save.readSettings() : {};
            if (s && s.devQuickWin && s.devQuickWin.enabled) {
                if (Save.markSubLevelClear) Save.markSubLevelClear(state.family, state.difficulty);
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
                    _subMenuContext = { kind: 'duel', difficulty: 'intermediate' };
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
                if (e.code === 'Digit4' || e.code === 'Numpad4') { _subMenuContext = { kind: 'duel', difficulty: 'intermediate' }; goToScreen('sub-menu'); e.preventDefault(); return; }
                if (e.code === 'KeyT') { _clickAction('enter-tutorial'); e.preventDefault(); return; }
                if (e.code === 'KeyC') { goToScreen('codex'); e.preventDefault(); return; }
                if (e.code === 'KeyW') { goToScreen('wrong-book'); e.preventDefault(); return; }
            }
            if (_currentScreen !== 'main-menu' && _currentScreen !== 'game' && (e.code === 'Escape' || e.code === 'KeyM')) {
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

        state = GameState.createStateV2();
        if (typeof InputController !== 'undefined' && InputController.initV2) {
            inputController = InputController.initV2({
                dispatch: dispatch,
                getState: function () { return state; }
            });
        }

        attachMenuListeners();
        attachSettingsListeners();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready (script loaded after parsing).
        init();
    }
})();
