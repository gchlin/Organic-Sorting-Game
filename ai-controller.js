// ai-controller.js - PvE AI driver for Duel mode
//
// Per README invariant I-8: the rules layer does NOT check whether a player is
// human or AI. The AI must walk through the same action interface (BUZZ /
// SUBMIT_ANSWER via dispatch) as the human input controller. The reducer must
// not be able to tell the difference.

const AIController = (function () {
    'use strict';

    // Default difficulty params — buzz window (progress ratio 0.0–1.0 within
    // the current buzzOpen effect) and answer think time (ms range).
    // These are the fallback values; the game reads live overrides from
    // Save.readSettings().pveAI at the moment each buzzOpen window opens or
    // each buzz is acquired, so changes in the settings UI take effect on the
    // very next question without restarting the game.
    const DEFAULT_PARAMS = Object.freeze({
        easy: Object.freeze({
            buzzWindowMin:    0.85,
            buzzWindowMax:    0.95,
            answerThinkMin:   1500,
            answerThinkMax:   3000,
            accuracy:         0.60
        }),
        medium: Object.freeze({
            buzzWindowMin:    0.75,
            buzzWindowMax:    0.90,
            answerThinkMin:   1200,
            answerThinkMax:   2500,
            accuracy:         0.80
        }),
        hard: Object.freeze({
            buzzWindowMin:    0.70,
            buzzWindowMax:    0.85,
            answerThinkMin:   1000,
            answerThinkMax:   2000,
            accuracy:         0.95
        })
    });

    // Fallback total duration (ms) used to estimate progress when the current
    // buzzOpen effect does not expose a known completeStateMs.
    // TODO: wire to DynamicVariants.zoom.durationMs once module deps allow it.
    const FALLBACK_BUZZ_DURATION_MS = 8000;

    // Polling frequency (ms) - ~60Hz
    const POLL_INTERVAL_MS = 16;

    // Read live params from Save.settings.pveAI if available, else fall back to
    // DEFAULT_PARAMS for the given difficulty.
    function _getParams(difficulty) {
        try {
            if (typeof Save !== 'undefined' && Save.readSettings) {
                const s = Save.readSettings();
                if (s && s.pveAI && s.pveAI[difficulty]) {
                    const p = s.pveAI[difficulty];
                    return {
                        buzzWindowMin:  typeof p.buzzWindowMin  === 'number' ? p.buzzWindowMin  : DEFAULT_PARAMS[difficulty].buzzWindowMin,
                        buzzWindowMax:  typeof p.buzzWindowMax  === 'number' ? p.buzzWindowMax  : DEFAULT_PARAMS[difficulty].buzzWindowMax,
                        answerThinkMin: typeof p.answerThinkMin === 'number' ? p.answerThinkMin : DEFAULT_PARAMS[difficulty].answerThinkMin,
                        answerThinkMax: typeof p.answerThinkMax === 'number' ? p.answerThinkMax : DEFAULT_PARAMS[difficulty].answerThinkMax,
                        accuracy:       typeof p.accuracy       === 'number' ? p.accuracy       : DEFAULT_PARAMS[difficulty].accuracy
                    };
                }
            }
        } catch (e) {}
        return DEFAULT_PARAMS[difficulty];
    }

    function _randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function _hasEligible(buzz, player) {
        if (!buzz || !buzz.eligible) return false;
        if (typeof buzz.eligible.has === 'function') return buzz.eligible.has(player);
        if (Array.isArray(buzz.eligible)) return buzz.eligible.indexOf(player) !== -1;
        return false;
    }

    // Estimate progress ratio (0.0–1.0) for the current buzzOpen phase.
    // Uses the state's dynamic.elapsedMs / dynamic.durationMs when available,
    // otherwise falls back to wall-clock time since _buzzOpenEnteredAt.
    function _getProgress(state, buzzOpenEnteredAt) {
        // Prefer data-driven dynamic state if present
        const dyn = state.dynamic;
        if (dyn) {
            const dur = typeof dyn.durationMs === 'number' && dyn.durationMs > 0
                ? dyn.durationMs
                : FALLBACK_BUZZ_DURATION_MS;
            if (typeof dyn.elapsedMs === 'number') {
                return Math.min(1.0, dyn.elapsedMs / dur);
            }
        }
        // Fallback: wall-clock elapsed since buzzOpen was entered
        const elapsed = Date.now() - buzzOpenEnteredAt;
        return Math.min(1.0, elapsed / FALLBACK_BUZZ_DURATION_MS);
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

        if (!DEFAULT_PARAMS[difficulty]) {
            throw new Error('Unknown difficulty: ' + difficulty);
        }
        if (player !== 'p1' && player !== 'p2') {
            throw new Error('Player must be p1 or p2');
        }
        if (typeof dispatch !== 'function' || typeof getState !== 'function') {
            throw new Error('AIController needs { dispatch, getState }');
        }

        let _started = false;
        let _pendingAnswerId = null;
        let _unsubscribe = null;
        let _lastPhase = null;
        let _lastOwner = null;

        // Buzz-window tracking
        let _buzzWaiting = false;         // true while we're waiting to reach targetProgress
        let _targetProgress = 0;          // randomly sampled target from [min, max]
        let _buzzOpenEnteredAt = 0;       // wall-clock ms when buzzOpen was last entered

        function _enterBuzzOpen() {
            const params = _getParams(difficulty);
            const min = Math.max(0, Math.min(params.buzzWindowMin, 0.99));
            const max = Math.max(min, Math.min(params.buzzWindowMax, 1.0));
            _targetProgress = _randomBetween(min, max);
            _buzzOpenEnteredAt = Date.now();
            _buzzWaiting = true;
        }

        function _cancelBuzzWait() {
            _buzzWaiting = false;
        }

        function _tryFireBuzz(s) {
            if (!_buzzWaiting) return;
            if (s.phase !== 'buzzOpen') { _cancelBuzzWait(); return; }
            if (!_hasEligible(s.buzz, player)) { _cancelBuzzWait(); return; }
            if (s.globalInputLocked) return;

            const progress = _getProgress(s, _buzzOpenEnteredAt);
            if (progress >= _targetProgress) {
                _cancelBuzzWait();
                dispatch({ type: 'BUZZ', player: player });
            }
        }

        function _handlePhase(s) {
            if (!s) return;
            if (s.mode !== 'duel') return;
            if (s.opponent === 'human') return;
            if (s.globalInputLocked) return;

            const buzz = s.buzz || {};

            // BuzzOpen + AI eligible → enter buzz-window waiting mode
            if (s.phase === 'buzzOpen' && _hasEligible(buzz, player) && !_buzzWaiting) {
                _enterBuzzOpen();
            }

            // Cancel buzz wait if state moved away
            if (s.phase !== 'buzzOpen' && _buzzWaiting) {
                _cancelBuzzWait();
            }

            // Buzzed by us → schedule SUBMIT_ANSWER after random think time
            if (s.phase === 'buzzed' && buzz.owner === player && _pendingAnswerId === null) {
                const question = s.question || {};
                const correctKey = question.correctKey;
                const optionList = Array.isArray(question.options) ? question.options : [];
                const optionKeys = optionList
                    .map(function (o) { return o && o.key; })
                    .filter(function (k) { return typeof k === 'string'; });
                const wrongOptions = optionKeys.filter(function (k) { return k !== correctKey; });
                const params = _getParams(difficulty);
                const willBeCorrect = Math.random() < params.accuracy;
                let pick;
                if (willBeCorrect) {
                    pick = correctKey;
                } else if (wrongOptions.length > 0) {
                    pick = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
                } else {
                    pick = correctKey;
                }
                const thinkMs = _randomBetween(params.answerThinkMin, params.answerThinkMax);
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
                }, thinkMs);
            }

            // Cancel pending answer if state moved away
            if ((s.phase !== 'buzzed' || buzz.owner !== player) && _pendingAnswerId !== null) {
                clearTimeout(_pendingAnswerId);
                _pendingAnswerId = null;
            }
        }

        // Poll at ~60Hz; on each tick check progress for pending buzz-window.
        function _onTick() {
            const s = getState();
            if (!s) return;

            // Fire progress-based buzz check every tick (not only on phase change)
            if (_buzzWaiting) {
                _tryFireBuzz(s);
            }

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
            _buzzWaiting = false;
            const intervalId = setInterval(_onTick, POLL_INTERVAL_MS);
            _unsubscribe = function () { clearInterval(intervalId); };
        };

        this.stop = function () {
            if (!_started) return;
            _started = false;
            _cancelBuzzWait();
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

    AIController.DEFAULT_PARAMS = DEFAULT_PARAMS;
    AIController.POLL_INTERVAL_MS = POLL_INTERVAL_MS;
    AIController.FALLBACK_BUZZ_DURATION_MS = FALLBACK_BUZZ_DURATION_MS;

    return AIController;
})();
