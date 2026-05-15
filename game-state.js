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
        clearTransientLocks
    };
})();
