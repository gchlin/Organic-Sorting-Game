// effect-manager.js - timer, lock, and cleanup registry

const EffectManager = (function () {
    const timeouts = new Map();
    const intervals = new Map();

    function setTimeoutTracked(key, callback, delay) {
        clearTimeoutTracked(key);
        const id = setTimeout(() => {
            timeouts.delete(key);
            callback();
        }, delay);
        timeouts.set(key, id);
        return id;
    }

    function clearTimeoutTracked(key) {
        if (timeouts.has(key)) {
            clearTimeout(timeouts.get(key));
            timeouts.delete(key);
        }
    }

    function setIntervalTracked(key, callback, delay) {
        clearIntervalTracked(key);
        const id = setInterval(callback, delay);
        intervals.set(key, id);
        return id;
    }

    function clearIntervalTracked(key) {
        if (intervals.has(key)) {
            clearInterval(intervals.get(key));
            intervals.delete(key);
        }
    }

    function clearAllTimers() {
        timeouts.forEach(id => clearTimeout(id));
        intervals.forEach(id => clearInterval(id));
        timeouts.clear();
        intervals.clear();
    }

    function removeTransientElements(root) {
        const scope = root || document;
        [
            '.buzz-countdown',
            '.buzz-penalty-badge',
            '.zoom-timeout-banner',
            '.time-bonus',
            '.combo-projectile',
            '.bolt',
            '.impact-burst',
            '.spark'
        ].forEach(selector => {
            scope.querySelectorAll(selector).forEach(el => el.remove());
        });
    }

    function clearTransientClasses(root) {
        const scope = root || document;
        [
            'correct',
            'wrong',
            'reveal-correct',
            'locked-area',
            'buzz-active',
            'buzz-locked-out',
            'pre-buzz',
            'zoom-active',
            'zoom-paused',
            'time-running-out',
            'countdown-active'
        ].forEach(cls => {
            scope.querySelectorAll(`.${cls}`).forEach(el => el.classList.remove(cls));
        });
    }

    function cleanup(root) {
        clearAllTimers();
        removeTransientElements(root);
        clearTransientClasses(root);
    }

    // ---------------------------------------------------------------------
    // effectId-tracked API (Wave 2 of data-driven rewrite)
    //
    // Backs invariants from README "規則層不變式":
    //   I-3  EFFECT_COMPLETE must carry effectId; cancelled IDs go to a
    //        blacklist so late-arriving callbacks are dropped at the reducer.
    //   I-4  Next question is only dispatched on EFFECT_COMPLETE, never on a
    //        raw setTimeout — this API is what produces those completions.
    //   I-5  Dynamic playback state is data; pause records elapsedMs so
    //        resume can continue from the exact same position regardless of
    //        DOM remounts.
    //   I-6  PLAY_TO_COMPLETE waits for completeStateReached before signalling
    //        completion; revealing only happens after that.
    //   I-7  cleanup is a phase: cancelAllEffects() mass-blacklists active
    //        IDs so any in-flight callbacks become no-ops.
    //
    // Uses NEW names with the *Effect suffix so we don't collide with the
    // legacy clearAllTimers / cleanup family above. Once game.js is fully
    // rewritten the legacy names will be retired.
    // ---------------------------------------------------------------------

    let _nextEffectId = 1;
    const _activeEffects = new Map();      // effectId -> { type, cancel, _completionTimerId }
    const _blacklistedEffects = new Set(); // effectIds whose EFFECT_COMPLETE should be dropped
    const _dynamicTickHandles = new Map(); // effectId -> { rafId, startedAt, elapsedMsOnPause, durationMs, variant, onTick, onComplete, completeStateReached }

    // RAF/timeout shim: prefer requestAnimationFrame in the browser, fall back
    // to setTimeout(~16ms) so tests can run under Node without jsdom.
    const _hasRAF = typeof requestAnimationFrame === 'function'
        && typeof cancelAnimationFrame === 'function';
    function _scheduleTick(fn) {
        if (_hasRAF) {
            return { kind: 'raf', id: requestAnimationFrame(fn) };
        }
        return { kind: 'timeout', id: setTimeout(() => fn(Date.now()), 16) };
    }
    function _cancelTick(handle) {
        if (!handle) return;
        if (handle.kind === 'raf') {
            try { cancelAnimationFrame(handle.id); } catch (e) {}
        } else {
            clearTimeout(handle.id);
        }
    }
    function _now() {
        return (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
    }

    function _finishEffect(effectId, onComplete) {
        const entry = _activeEffects.get(effectId);
        if (!entry) return; // already cancelled / cleaned
        _activeEffects.delete(effectId);
        if (_blacklistedEffects.has(effectId)) return; // I-3: drop ghosts
        if (typeof onComplete === 'function') {
            try { onComplete(effectId); } catch (e) {
                if (typeof console !== 'undefined') console.error(e);
            }
        }
    }

    function runEffect(effect, onComplete) {
        const id = _nextEffectId++;
        const type = (effect && effect.type) || 'render';

        // Default no-op cancel; specific branches replace it.
        const entry = { type, cancel: function () {}, _completionTimerId: null };
        _activeEffects.set(id, entry);

        if (type === 'dynamic') {
            // Delegate to the dynamic engine; it manages its own lifecycle and
            // calls back into _finishEffect when complete.
            return _startDynamic(id, effect, onComplete);
        }

        // Decide how long until we synthesise EFFECT_COMPLETE.
        // - 'sound':                fire-and-forget; complete next tick.
        // - 'anim' / 'timer':       wait `ms` (default 1000 for anim, 0 for timer).
        // - 'render':               purely declarative; ack synchronously on next tick.
        // - 'cleanup' /
        //   'cleanupAndDispatch':   ack next tick so caller drives sequencing.
        let delayMs;
        if (typeof effect.ms === 'number' && effect.ms >= 0) {
            delayMs = effect.ms;
        } else if (type === 'anim') {
            delayMs = 1000;
        } else if (type === 'timer') {
            delayMs = 0;
        } else {
            delayMs = 0; // sound / render / cleanup / cleanupAndDispatch / unknown
        }

        const timerId = setTimeout(function () {
            entry._completionTimerId = null;
            _finishEffect(id, onComplete);
        }, delayMs);
        entry._completionTimerId = timerId;
        entry.cancel = function () {
            if (entry._completionTimerId !== null) {
                clearTimeout(entry._completionTimerId);
                entry._completionTimerId = null;
            }
        };
        return id;
    }

    function cancelEffect(effectId) {
        const entry = _activeEffects.get(effectId);
        if (!entry) return false;
        try { entry.cancel(); } catch (e) {}
        // Dynamic entries also have an RAF tick handle to tear down.
        const dyn = _dynamicTickHandles.get(effectId);
        if (dyn) {
            _cancelTick(dyn._tickHandle);
            _dynamicTickHandles.delete(effectId);
        }
        _activeEffects.delete(effectId);
        _blacklistedEffects.add(effectId);
        return true;
    }

    function cancelAllEffects(reason) {
        // Snapshot keys first; cancelEffect mutates _activeEffects.
        const ids = Array.from(_activeEffects.keys());
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const entry = _activeEffects.get(id);
            if (entry) {
                try { entry.cancel(); } catch (e) {}
            }
            const dyn = _dynamicTickHandles.get(id);
            if (dyn) {
                _cancelTick(dyn._tickHandle);
                _dynamicTickHandles.delete(id);
            }
            _blacklistedEffects.add(id);
        }
        _activeEffects.clear();
        if (reason && typeof console !== 'undefined' && console.debug) {
            console.debug('[EffectManager] cancelAllEffects:', reason);
        }
    }

    function isEffectBlacklisted(effectId) {
        return _blacklistedEffects.has(effectId);
    }

    // ---- Dynamic playback (I-5, I-6) -------------------------------------
    //
    // Effect shape:
    //   { type:'dynamic', variant, op, startElapsedMs?, durationMs?,
    //     onTick?(elapsedMs), onPaused?(elapsedMs),
    //     onCompleteStateReached?() }
    //
    // op:
    //   'play'            start tick loop from elapsedMs = 0
    //   'resume'          start tick loop from startElapsedMs
    //   'pause'           stop tick loop; report current elapsedMs via onPaused
    //   'playToComplete'  like play/resume but skips wait if completeState
    //                     already reached (PLAY_TO_COMPLETE → revealing)
    //
    // RAF strategy: real requestAnimationFrame in browser; setTimeout(16ms)
    // fallback for Node. completeStateReached fires when elapsed >= durationMs
    // (or immediately for playToComplete if startElapsedMs >= durationMs).

    function _startDynamic(effectId, effect, onComplete) {
        const op = effect.op || 'play';
        const durationMs = typeof effect.durationMs === 'number' ? effect.durationMs : 1000;
        const startElapsedMs = typeof effect.startElapsedMs === 'number' ? effect.startElapsedMs : 0;
        const onTick = typeof effect.onTick === 'function' ? effect.onTick : null;
        const onPaused = typeof effect.onPaused === 'function' ? effect.onPaused : null;
        const onCompleteStateReached = typeof effect.onCompleteStateReached === 'function'
            ? effect.onCompleteStateReached : null;

        // pause is synchronous: just look up the most recent dynamic handle.
        // Caller-side pattern: dispatch PAUSE_DYNAMIC → runEffect({op:'pause'})
        // which immediately completes after reading elapsedMs.
        if (op === 'pause') {
            const handle = _dynamicTickHandles.get(effect.targetEffectId);
            let elapsedNow = 0;
            if (handle) {
                elapsedNow = handle.elapsedMsOnPause
                    + (handle.startedAt !== null ? (_now() - handle.startedAt) : 0);
                _cancelTick(handle._tickHandle);
                handle._tickHandle = null;
                handle.elapsedMsOnPause = elapsedNow;
                handle.startedAt = null;
            }
            if (onPaused) {
                try { onPaused(elapsedNow); } catch (e) {}
            }
            // Pause itself is an instantaneous effect; ack immediately.
            const entry = _activeEffects.get(effectId);
            if (entry) {
                entry.cancel = function () {};
                entry._completionTimerId = setTimeout(function () {
                    entry._completionTimerId = null;
                    _finishEffect(effectId, onComplete);
                }, 0);
            }
            return effectId;
        }

        // play / resume / playToComplete: spin up a tick loop.
        const initialElapsed = (op === 'resume' || op === 'playToComplete')
            ? startElapsedMs
            : 0;

        // Short-circuit playToComplete if we're already at/past completeState.
        if (op === 'playToComplete' && initialElapsed >= durationMs) {
            if (onCompleteStateReached) {
                try { onCompleteStateReached(); } catch (e) {}
            }
            const entry = _activeEffects.get(effectId);
            if (entry) {
                entry._completionTimerId = setTimeout(function () {
                    entry._completionTimerId = null;
                    _finishEffect(effectId, onComplete);
                }, 0);
            }
            return effectId;
        }

        const handle = {
            variant: effect.variant || null,
            durationMs: durationMs,
            elapsedMsOnPause: initialElapsed,
            startedAt: _now(),
            _tickHandle: null,
            completeStateReached: false
        };
        _dynamicTickHandles.set(effectId, handle);

        function tick() {
            const h = _dynamicTickHandles.get(effectId);
            if (!h) return; // cancelled
            if (h.startedAt === null) return; // paused mid-flight
            const elapsed = h.elapsedMsOnPause + (_now() - h.startedAt);
            if (onTick) {
                try { onTick(elapsed); } catch (e) {}
            }
            if (elapsed >= h.durationMs) {
                if (!h.completeStateReached) {
                    h.completeStateReached = true;
                    if (onCompleteStateReached) {
                        try { onCompleteStateReached(); } catch (e) {}
                    }
                }
                _cancelTick(h._tickHandle);
                h._tickHandle = null;
                _dynamicTickHandles.delete(effectId);
                _finishEffect(effectId, onComplete);
                return;
            }
            h._tickHandle = _scheduleTick(tick);
        }

        handle._tickHandle = _scheduleTick(tick);

        const entry = _activeEffects.get(effectId);
        if (entry) {
            entry.cancel = function () {
                const h = _dynamicTickHandles.get(effectId);
                if (h) {
                    _cancelTick(h._tickHandle);
                    _dynamicTickHandles.delete(effectId);
                }
            };
        }
        return effectId;
    }

    function runDynamicEffect(effect, onComplete) {
        // Convenience wrapper so callers don't need to set type:'dynamic'.
        const wrapped = Object.assign({}, effect || {}, { type: 'dynamic' });
        return runEffect(wrapped, onComplete);
    }

    return {
        setTimeoutTracked,
        clearTimeoutTracked,
        setIntervalTracked,
        clearIntervalTracked,
        clearAllTimers,
        removeTransientElements,
        clearTransientClasses,
        cleanup,
        // New effectId-tracked API (Wave 2)
        runEffect,
        cancelEffect,
        cancelAllEffects,
        runDynamicEffect,
        isEffectBlacklisted
    };
})();
