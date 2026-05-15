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

    return {
        SOLO_KEYS,
        DUEL_KEYS,
        optionActionFromKey,
        buzzActionFromKey,
        systemActionFromKey
    };
})();
