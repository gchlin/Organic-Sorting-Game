// input-controller.js - convert raw input into game actions

const InputController = (function () {
    const SOLO_KEYS = Object.freeze({
        KeyA: 0,
        Digit4: 0,
        Numpad4: 0,
        KeyF: 1,
        Digit6: 1,
        Numpad6: 1,
        KeyZ: 2,
        Digit1: 2,
        Numpad1: 2,
        KeyC: 3,
        Digit3: 3,
        Numpad3: 3
    });

    const DUEL_KEYS = Object.freeze({
        p1: Object.freeze({
            KeyA: 0,
            KeyF: 1,
            KeyZ: 2,
            KeyC: 3
        }),
        p2: Object.freeze({
            Digit4: 0,
            Numpad4: 0,
            Digit6: 1,
            Numpad6: 1,
            Digit1: 2,
            Numpad1: 2,
            Digit3: 3,
            Numpad3: 3
        })
    });

    function optionActionFromKey(code, mode) {
        if (mode === 'duel') {
            if (Object.prototype.hasOwnProperty.call(DUEL_KEYS.p1, code)) {
                return { type: 'ANSWER_OPTION', player: 'p1', optionIndex: DUEL_KEYS.p1[code] };
            }
            if (Object.prototype.hasOwnProperty.call(DUEL_KEYS.p2, code)) {
                return { type: 'ANSWER_OPTION', player: 'p2', optionIndex: DUEL_KEYS.p2[code] };
            }
            return null;
        }

        if (Object.prototype.hasOwnProperty.call(SOLO_KEYS, code)) {
            return { type: 'ANSWER_OPTION', player: 'p1', optionIndex: SOLO_KEYS[code] };
        }
        return null;
    }

    function buzzActionFromKey(code) {
        if (Object.prototype.hasOwnProperty.call(DUEL_KEYS.p1, code)) {
            return { type: 'BUZZ', player: 'p1' };
        }
        if (Object.prototype.hasOwnProperty.call(DUEL_KEYS.p2, code)) {
            return { type: 'BUZZ', player: 'p2' };
        }
        return null;
    }

    function systemActionFromKey(code) {
        if (code === 'Escape' || code === 'KeyM') return { type: 'CONFIRM_EXIT' };
        if (code === 'KeyR') return { type: 'CONFIRM_RESTART' };
        if (code === 'KeyH') return { type: 'TOGGLE_HINT' };
        return null;
    }

    // New v2 init: registers keyboard & click listeners that all funnel through dispatch
    function initV2({ dispatch, getState, options }) {
        options = options || {};
        const lockedPhaseFn = (typeof GameState !== 'undefined' && GameState.isInputLockedPhase)
            || function (phase) {
                return phase === 'resolvingCorrect' || phase === 'resolvingWrong'
                    || phase === 'revealing' || phase === 'cleanup';
            };

        // Key → option index mapping (2x2 layout):
        // A=0, F=1, Z=2, C=3 (left player or single)
        // 4=0, 6=1, 1=2, 3=3 (right player; also matches numpad)
        const KEY_TO_OPT_LEFT  = { KeyA: 0, KeyF: 1, KeyZ: 2, KeyC: 3 };
        const KEY_TO_OPT_RIGHT = { Digit4: 0, Numpad4: 0, Digit6: 1, Numpad6: 1, Digit1: 2, Numpad1: 2, Digit3: 3, Numpad3: 3 };

        function handleKeydown(e) {
            const state = getState();
            if (!state) return;
            if (state.globalInputLocked || lockedPhaseFn(state.phase)) {
                return;  // I-2: drop input at source
            }

            // Buzz keys (only in Duel PvP / PvE)
            if (state.mode === 'duel' && state.phase === 'buzzOpen') {
                if (e.code === 'Space') {
                    dispatch({ type: 'BUZZ', player: 'p1' });
                    e.preventDefault();
                    return;
                }
                if (e.code === 'Enter' && state.opponent === 'human') {
                    dispatch({ type: 'BUZZ', player: 'p2' });
                    e.preventDefault();
                    return;
                }
            }

            // Answer keys
            if (state.phase === 'canAnswer' || state.phase === 'buzzed') {
                let player = null;
                let optIdx = null;
                if (e.code in KEY_TO_OPT_LEFT)  { player = 'p1'; optIdx = KEY_TO_OPT_LEFT[e.code]; }
                else if (e.code in KEY_TO_OPT_RIGHT) {
                    // In Duel PvP, right-side keys = p2; in Practice or PvE, right-side keys also act as p1 (alternate input)
                    player = (state.mode === 'duel' && state.opponent === 'human') ? 'p2' : 'p1';
                    optIdx = KEY_TO_OPT_RIGHT[e.code];
                }
                if (player !== null && optIdx !== null) {
                    // In buzzed phase, only the buzz owner can answer
                    if (state.phase === 'buzzed' && state.buzz && state.buzz.owner !== player) return;
                    const opt = state.question && state.question.options && state.question.options[optIdx];
                    if (opt && opt.key) {
                        dispatch({ type: 'SUBMIT_ANSWER', player, key: opt.key });
                        e.preventDefault();
                    }
                }
            }
        }

        // Click on option buttons funnels through dispatch too
        function handleOptionClick(e) {
            const state = getState();
            if (!state) return;
            if (state.globalInputLocked || lockedPhaseFn(state.phase)) return;
            const btn = e.target.closest && e.target.closest('[data-option-key]');
            if (!btn) return;
            const key = btn.getAttribute('data-option-key');
            const playerAttr = btn.getAttribute('data-player') || 'p1';
            if (state.phase === 'buzzed' && state.buzz && state.buzz.owner !== playerAttr) return;
            dispatch({ type: 'SUBMIT_ANSWER', player: playerAttr, key });
        }

        // Click on buzz button
        function handleBuzzClick(e) {
            const state = getState();
            if (!state) return;
            if (state.globalInputLocked || lockedPhaseFn(state.phase)) return;
            if (state.mode !== 'duel' || state.phase !== 'buzzOpen') return;
            const btn = e.target.closest && e.target.closest('[data-buzz-player]');
            if (!btn) return;
            const player = btn.getAttribute('data-buzz-player');
            dispatch({ type: 'BUZZ', player });
        }

        if (options.attachDOM !== false && typeof document !== 'undefined') {
            document.addEventListener('keydown', handleKeydown);
            document.addEventListener('click', handleOptionClick);
            document.addEventListener('click', handleBuzzClick);
        }

        return {
            handleKeydown,
            handleOptionClick,
            handleBuzzClick,
            teardown() {
                if (typeof document !== 'undefined') {
                    document.removeEventListener('keydown', handleKeydown);
                    document.removeEventListener('click', handleOptionClick);
                    document.removeEventListener('click', handleBuzzClick);
                }
            },
        };
    }

    return {
        SOLO_KEYS,
        DUEL_KEYS,
        optionActionFromKey,
        buzzActionFromKey,
        systemActionFromKey,
        initV2
    };
})();
