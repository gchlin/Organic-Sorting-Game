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

    return {
        setTimeoutTracked,
        clearTimeoutTracked,
        setIntervalTracked,
        clearIntervalTracked,
        clearAllTimers,
        removeTransientElements,
        clearTransientClasses,
        cleanup
    };
})();
