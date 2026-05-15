// mode-rules.js - data-only game mode rules for Organic Sorting Hat

const ModeRules = (function () {
    const MODES = Object.freeze({
        PRACTICE: 'practice',
        SPEED: 'speed',
        DUEL: 'duel'
    });

    const DUEL_VARIANTS = Object.freeze({
        STANDARD: 'standard',
        DYNAMIC: 'zoom'
    });

    const DYNAMIC_VARIANTS = Object.freeze({
        ZOOM: 'zoom'
    });

    const RULES = Object.freeze({
        practice: Object.freeze({
            key: MODES.PRACTICE,
            players: 1,
            timed: false,
            roundSize: 10,
            passThreshold: null,
            clearCondition: 'answer_all_questions_in_level',
            unlocksStory: true,
            countsTowardCodex: true,
            countsTowardBadges: true,
            continuePolicy: Object.freeze({
                includeUnseen: true,
                includeWrongFromRound: true
            })
        }),
        speed: Object.freeze({
            key: MODES.SPEED,
            players: 1,
            timed: true,
            durationSeconds: 60,
            correctTimeDelta: 3,
            wrongTimeDelta: -3,
            usesHealth: false,
            endsWhenTimeZero: true,
            unlocksStory: false,
            countsTowardCodex: false,
            countsTowardBadges: false
        }),
        duel: Object.freeze({
            key: MODES.DUEL,
            players: 2,
            timed: true,
            winCorrectCount: 5,
            answerOwnershipSeconds: 5,
            revealAfterEliminatedWrongOptions: 3,
            wrongOptionsShared: true,
            timeoutEliminatesOption: false,
            unlocksStory: false,
            countsTowardCodex: false,
            countsTowardBadges: false
        })
    });

    const DYNAMIC_RULES = Object.freeze({
        zoom: Object.freeze({
            key: DYNAMIC_VARIANTS.ZOOM,
            completeState: 'full-structure-visible',
            pauseOnBuzz: true,
            revealRequiresCompleteState: true
        })
    });

    function get(mode) {
        return RULES[mode] || null;
    }

    function getDuelVariant(variant) {
        return variant === DUEL_VARIANTS.DYNAMIC ? DYNAMIC_RULES.zoom : null;
    }

    function isPractice(mode) {
        return mode === MODES.PRACTICE;
    }

    function isSpeed(mode) {
        return mode === MODES.SPEED;
    }

    function isDuel(mode) {
        return mode === MODES.DUEL;
    }

    function isDynamicDuel(mode, variant) {
        return isDuel(mode) && variant === DUEL_VARIANTS.DYNAMIC;
    }

    return {
        MODES,
        DUEL_VARIANTS,
        DYNAMIC_VARIANTS,
        get,
        getDuelVariant,
        isPractice,
        isSpeed,
        isDuel,
        isDynamicDuel
    };
})();
