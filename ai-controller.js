// ai-controller.js - PvE AI driver for Duel mode
//
// Per README invariant I-8: the rules layer does NOT check whether a player is
// human or AI. The AI must walk through the same action interface (BUZZ /
// SUBMIT_ANSWER via dispatch) as the human input controller. The reducer must
// not be able to tell the difference.

const AIController = (function () {
    'use strict';

    // Difficulty params (mirror of AIDifficulty in mode-rules.js — duplicated
    // here for module isolation; can be swapped to reading from
    // ModeRulesV2.AIDifficulty in a later wave once game.js wires dependencies).
    const DIFFICULTY_PARAMS = Object.freeze({
        easy:   Object.freeze({ buzzReactionMs: Object.freeze({ mean: 2500, jitter: 500 }), accuracy: 0.60 }),
        medium: Object.freeze({ buzzReactionMs: Object.freeze({ mean: 1500, jitter: 500 }), accuracy: 0.80 }),
        hard:   Object.freeze({ buzzReactionMs: Object.freeze({ mean:  700, jitter: 300 }), accuracy: 0.95 })
    });

    // ms to "think" after gaining answer ownership, before submitting
    const THINK_MS = Object.freeze({ mean: 800, jitter: 1500 });

    // Polling frequency (ms) - ~60Hz
    const POLL_INTERVAL_MS = 16;

    function _jitterAround(spec) {
        return Math.max(50, spec.mean + (Math.random() - 0.5) * 2 * spec.jitter);
    }

    function _hasEligible(buzz, player) {
        if (!buzz || !buzz.eligible) return false;
        if (typeof buzz.eligible.has === 'function') return buzz.eligible.has(player);
        if (Array.isArray(buzz.eligible)) return buzz.eligible.indexOf(player) !== -1;
        return false;
    }

    function AIController(opts) {
        if (!(this instanceof AIController)) {
            return new AIController(opts);
        }
        opts = opts || {};
        const difficulty = opts.difficulty;
        const player = opts.player;
        const dispatch = opts.dispatch;
        const getState = opts.getState;

        if (!DIFFICULTY_PARAMS[difficulty]) {
            throw new Error('Unknown difficulty: ' + difficulty);
        }
        if (player !== 'p1' && player !== 'p2') {
            throw new Error('Player must be p1 or p2');
        }
        if (typeof dispatch !== 'function' || typeof getState !== 'function') {
            throw new Error('AIController needs { dispatch, getState }');
        }

        const params = DIFFICULTY_PARAMS[difficulty];

        let _started = false;
        let _pendingBuzzId = null;
        let _pendingAnswerId = null;
        let _unsubscribe = null;
        let _lastPhase = null;
        let _lastOwner = null;

        function _handlePhase(s) {
            if (!s) return;
            if (s.mode !== 'duel') return;
            // I-8 safety: even though reducer is agnostic, we still gate AI
            // activation on opponent !== 'human' so a human-vs-human duel
            // sharing this module never gets AI dispatches.
            if (s.opponent === 'human') return;
            if (s.globalInputLocked) return; // I-2: respect input lock at source

            const buzz = s.buzz || {};

            // BuzzOpen + AI eligible → schedule BUZZ
            if (s.phase === 'buzzOpen' && _hasEligible(buzz, player) && _pendingBuzzId === null) {
                const delay = _jitterAround(params.buzzReactionMs);
                _pendingBuzzId = setTimeout(function () {
                    _pendingBuzzId = null;
                    const now = getState();
                    if (!now) return;
                    // Re-check at fire time (state may have changed)
                    if (now.phase === 'buzzOpen'
                        && _hasEligible(now.buzz, player)
                        && !now.globalInputLocked) {
                        dispatch({ type: 'BUZZ', player: player });
                    }
                }, delay);
            }

            // Cancel pending buzz if state moved away
            if (s.phase !== 'buzzOpen' && _pendingBuzzId !== null) {
                clearTimeout(_pendingBuzzId);
                _pendingBuzzId = null;
            }

            // Buzzed by us → schedule SUBMIT_ANSWER
            if (s.phase === 'buzzed' && buzz.owner === player && _pendingAnswerId === null) {
                const question = s.question || {};
                const correctKey = question.correctKey;
                const optionList = Array.isArray(question.options) ? question.options : [];
                const optionKeys = optionList
                    .map(function (o) { return o && o.key; })
                    .filter(function (k) { return typeof k === 'string'; });
                const wrongOptions = optionKeys.filter(function (k) { return k !== correctKey; });
                const willBeCorrect = Math.random() < params.accuracy;
                let pick;
                if (willBeCorrect) {
                    pick = correctKey;
                } else if (wrongOptions.length > 0) {
                    pick = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
                } else {
                    pick = correctKey;
                }
                const delay = _jitterAround(THINK_MS);
                _pendingAnswerId = setTimeout(function () {
                    _pendingAnswerId = null;
                    const now = getState();
                    if (!now) return;
                    const nowBuzz = now.buzz || {};
                    if (now.phase === 'buzzed'
                        && nowBuzz.owner === player
                        && !now.globalInputLocked) {
                        dispatch({ type: 'SUBMIT_ANSWER', player: player, key: pick });
                    }
                }, delay);
            }

            // Cancel pending answer if state moved away (e.g. answer was taken
            // or timed out elsewhere)
            if ((s.phase !== 'buzzed' || buzz.owner !== player) && _pendingAnswerId !== null) {
                clearTimeout(_pendingAnswerId);
                _pendingAnswerId = null;
            }
        }

        // Track phase changes by polling getState() between actions; if the host
        // provides subscribe(), we could swap this out. Polling at ~60Hz is cheap.
        function _onTick() {
            const s = getState();
            if (!s) return;
            const curOwner = s.buzz ? s.buzz.owner : null;
            if (s.phase === _lastPhase && curOwner === _lastOwner) return;
            _lastPhase = s.phase;
            _lastOwner = curOwner;
            _handlePhase(s);
        }

        this.difficulty = difficulty;
        this.player = player;

        this.start = function () {
            if (_started) return;
            _started = true;
            _lastPhase = null;
            _lastOwner = null;
            const intervalId = setInterval(_onTick, POLL_INTERVAL_MS);
            _unsubscribe = function () { clearInterval(intervalId); };
        };

        this.stop = function () {
            if (!_started) return;
            _started = false;
            if (_pendingBuzzId !== null) {
                clearTimeout(_pendingBuzzId);
                _pendingBuzzId = null;
            }
            if (_pendingAnswerId !== null) {
                clearTimeout(_pendingAnswerId);
                _pendingAnswerId = null;
            }
            if (_unsubscribe) {
                _unsubscribe();
                _unsubscribe = null;
            }
        };
    }

    AIController.DIFFICULTY_PARAMS = DIFFICULTY_PARAMS;
    AIController.THINK_MS = THINK_MS;
    AIController.POLL_INTERVAL_MS = POLL_INTERVAL_MS;

    return AIController;
})();
