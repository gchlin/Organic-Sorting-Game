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

        // Key → option index mapping. Reads from Save.readSettings().keybindings
        // each keydown so live rebinds in Settings take effect immediately.
        // Defaults: A/F/Z/C (left) and 4/6/1/3 (right).
        function _kb() {
            if (typeof Save !== 'undefined' && Save.readSettings) {
                const s = Save.readSettings();
                if (s && s.keybindings) return s.keybindings;
            }
            return (typeof Save !== 'undefined' && Save.defaultKeybindings) ? Save.defaultKeybindings() : {};
        }
        function _keyMaps() {
            const kb = _kb();
            const left = {};
            _addKeyAlias(left, kb.optionLeft0, 0);
            _addKeyAlias(left, kb.optionLeft1, 1);
            _addKeyAlias(left, kb.optionLeft2, 2);
            _addKeyAlias(left, kb.optionLeft3, 3);
            const right = {};
            _addKeyAlias(right, kb.optionRight0, 0);
            _addKeyAlias(right, kb.optionRight1, 1);
            _addKeyAlias(right, kb.optionRight2, 2);
            _addKeyAlias(right, kb.optionRight3, 3);
            return { left, right, buzzP1: kb.buzzP1, buzzP2: kb.buzzP2 };
        }

        function _addKeyAlias(map, code, optionIndex) {
            if (!code) return;
            map[code] = optionIndex;
            if (code.indexOf('Digit') === 0) {
                map['Numpad' + code.slice(5)] = optionIndex;
            } else if (code.indexOf('Numpad') === 0) {
                map['Digit' + code.slice(6)] = optionIndex;
            }
        }

        function handleKeydown(e) {
            const state = getState();
            if (!state) return;
            if (state.globalInputLocked || lockedPhaseFn(state.phase)) {
                return;  // I-2: drop input at source
            }

            const maps = _keyMaps();

            // Buzz keys (only in Duel PvP / PvE)
            if (state.mode === 'duel' && state.phase === 'buzzOpen') {
                if (e.code === maps.buzzP1) {
                    dispatch({ type: 'BUZZ', player: 'p1' });
                    e.preventDefault();
                    return;
                }
                if (e.code === maps.buzzP2 && state.opponent === 'human') {
                    dispatch({ type: 'BUZZ', player: 'p2' });
                    e.preventDefault();
                    return;
                }
            }

            // Answer keys
            if (state.phase === 'canAnswer' || state.phase === 'buzzed') {
                let player = null;
                let optIdx = null;
                if (e.code in maps.left)  { player = 'p1'; optIdx = maps.left[e.code]; }
                else if (e.code in maps.right) {
                    // In Duel PvP, right-side keys = p2; in Practice or PvE, right-side keys also act as p1 (alternate input)
                    player = (state.mode === 'duel' && state.opponent === 'human') ? 'p2' : 'p1';
                    optIdx = maps.right[e.code];
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
            // Authority over WHO clicked: in Duel buzzed phase, it's whoever owns
            // the buzz — the option buttons are shared between players (same set
            // of options visible to both), so their data-player attribute is
            // hardcoded "p1" and would otherwise lock P2 out of mouse input.
            // In Practice (single-player) or buzzOpen (shouldn't be answering),
            // fall back to the DOM attribute.
            let player;
            if (state.mode === 'duel' && state.phase === 'buzzed') {
                player = state.buzz && state.buzz.owner;
                if (!player) return;
            } else {
                player = btn.getAttribute('data-player') || 'p1';
            }
            dispatch({ type: 'SUBMIT_ANSWER', player, key });
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
