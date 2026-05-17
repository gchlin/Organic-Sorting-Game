// game-state.js - source-of-truth state helpers for Organic Sorting Hat

const GameState = (function () {
    const PLAYERS = Object.freeze(['p1', 'p2']);

    function createPlayerState() {
        return {
            score: 0,
            combo: 0,
            correctStreak: 0,
            wrongStreak: 0,
            correctCount: 0,
            totalAsked: 0,
            state: 'ready',
            isLocked: false
        };
    }

    function createState() {
        return {
            mode: 'practice',
            level: 'level1',
            duelVariant: 'standard',
            active: false,
            timeLeft: 0,
            globalInputLocked: false,
            players: {
                p1: createPlayerState(),
                p2: createPlayerState()
            },
            question: {
                current: null,
                correctKey: '',
                options: [],
                eliminatedWrongKeys: new Set(),
                failedPlayersThisCycle: new Set()
            },
            buzz: {
                phase: 'idle',
                owner: null,
                previousOwner: null,
                eligiblePlayers: new Set(PLAYERS)
            },
            dynamic: {
                variant: null,
                phase: 'inactive',
                completeStateReached: false,
                elapsedMs: 0
            }
        };
    }

    function resetPlayer(playerState) {
        Object.assign(playerState, createPlayerState());
        return playerState;
    }

    function resetPlayers(state) {
        PLAYERS.forEach(player => resetPlayer(state.players[player]));
        return state;
    }

    function resetQuestion(state) {
        state.question.current = null;
        state.question.correctKey = '';
        state.question.options = [];
        state.question.eliminatedWrongKeys.clear();
        state.question.failedPlayersThisCycle.clear();
        state.buzz.phase = 'idle';
        state.buzz.owner = null;
        state.buzz.previousOwner = null;
        state.buzz.eligiblePlayers = new Set(PLAYERS);
        state.dynamic.phase = 'inactive';
        state.dynamic.completeStateReached = false;
        state.dynamic.elapsedMs = 0;
        return state;
    }

    function setGlobalInputLocked(state, locked) {
        state.globalInputLocked = Boolean(locked);
        return state.globalInputLocked;
    }

    function canPlayerAct(state, player) {
        if (state.globalInputLocked) return false;
        const p = state.players[player];
        return !!p && !p.isLocked;
    }

    function recordCorrect(state, player) {
        const p = state.players[player];
        if (!p) return null;
        p.correctCount += 1;
        p.totalAsked += 1;
        p.correctStreak += 1;
        p.wrongStreak = 0;
        p.combo += 1;
        return p;
    }

    function recordWrong(state, player, options) {
        const p = state.players[player];
        if (!p) return null;
        p.totalAsked += 1;
        p.correctStreak = 0;
        p.wrongStreak += 1;
        p.combo = 0;
        if (options && options.wrongKey) {
            state.question.eliminatedWrongKeys.add(options.wrongKey);
        }
        if (options && options.failedCycle) {
            state.question.failedPlayersThisCycle.add(player);
        }
        return p;
    }

    function clearTransientLocks(state) {
        state.globalInputLocked = false;
        PLAYERS.forEach(player => {
            state.players[player].isLocked = false;
            state.players[player].state = 'ready';
        });
        return state;
    }

    // --- V2 state shape (data-driven rewrite, per README "game-state.js — state shape") ---
    // Additive: legacy createState / createPlayerState above remain in use until game.js
    // is rewritten in a later wave. New code should call createStateV2 / createPlayerStateV2.

    function createPlayerStateV2() {
        // NOTE: no `combo` field. comboLevel is derived from correctStreak by render
        // (see README "Combo / Streak 規格 → 狀態欄位（去除冗餘）").
        // wrongCount counts WRONG submissions (not unique compounds) so settle's
        // accuracy = correctCount / (correctCount + wrongCount) reflects mistakes
        // even when the player eventually answered the same question correctly.
        return {
            score: 0,
            correctStreak: 0,
            wrongStreak: 0,
            correctCount: 0,
            wrongCount: 0,
            totalAsked: 0,
            state: 'ready',
            isLocked: false
        };
    }

    function createStateV2() {
        return {
            mode: 'practice',
            family: 'hydrocarbon',
            difficulty: 'intermediate',
            opponent: 'human',
            phase: 'idle',
            globalInputLocked: false,
            queue: [],
            seenInRound: new Set(),
            wrongInRound: new Set(),
            round: { index: 0, size: 10, score: 0, accuracyThisRound: null },
            question: {
                current: null,
                correctKey: '',
                options: [],
                eliminatedWrongKeys: new Set(),
                lastChosenWrongKey: null,
                failedPlayersThisCycle: new Set()
            },
            players: {
                p1: createPlayerStateV2(),
                p2: createPlayerStateV2()
            },
            buzz: {
                phase: 'idle',
                owner: null,
                eligible: new Set(['p1', 'p2']),
                timerId: null,
                timerStartedAt: 0,   // when the current 5s answer timer started (ms epoch)
                _isHandoff: false    // true on the frame ownership switches to the other player
            },
            dynamic: {
                variant: null,
                phase: 'inactive',
                elapsedMs: 0,
                completeStateReached: false
            },
            effects: {
                activeIds: new Set(),
                blacklistIds: new Set()
            },
            result: {
                winner: null,
                passed: false,
                badgesEarned: []
            }
        };
    }

    // Invariant I-2: globalInputLocked is derived from phase, not manually set.
    // Reducer / render consult this; the cached `globalInputLocked` field is for
    // convenience only — the truth is this function.
    function isInputLockedPhase(phase) {
        return phase === 'resolvingCorrect'
            || phase === 'resolvingWrong'
            || phase === 'revealing'
            || phase === 'revealed'
            || phase === 'cleanup';
    }

    return {
        PLAYERS,
        createState,
        createPlayerState,
        resetPlayer,
        resetPlayers,
        resetQuestion,
        setGlobalInputLocked,
        canPlayerAct,
        recordCorrect,
        recordWrong,
        clearTransientLocks,
        createStateV2,
        createPlayerStateV2,
        isInputLockedPhase
    };
})();
