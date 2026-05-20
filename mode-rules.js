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
        ZOOM: 'zoom',
        BLUR: 'blur',
        ROTATE_ZOOM: 'rotateZoom'
    });

    const RULES = Object.freeze({
        practice: Object.freeze({
            key: MODES.PRACTICE,
            players: 1,
            timed: false,
            roundSize: 10,
            passThreshold: null,
            clearCondition: 'answer_all_questions_in_level',
            revealCorrectOnWrong: false,
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
            revealCorrectOnWrong: false,
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
            revealCorrectOnWrong: false,
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
        }),
        blur: Object.freeze({
            key: DYNAMIC_VARIANTS.BLUR,
            completeState: 'full-structure-visible',
            pauseOnBuzz: true,
            revealRequiresCompleteState: true
        }),
        rotateZoom: Object.freeze({
            key: DYNAMIC_VARIANTS.ROTATE_ZOOM,
            completeState: 'full-structure-visible',
            pauseOnBuzz: true,
            revealRequiresCompleteState: true
        })
    });

    function get(mode) {
        return RULES[mode] || null;
    }

    function getDuelVariant(variant) {
        return DYNAMIC_RULES[variant] || null;
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
        return isDuel(mode) && !!DYNAMIC_RULES[variant];
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

// =====================================================================
// Reducer table (wave 2 of rewrite, per README spec).
// Used exclusively by reduce() below; game-v2.js calls reduce() rather
// than referencing ModeRulesV2 directly. Grep confirmed: no other file
// references this symbol — it is intentionally module-private.
// =====================================================================

// Flat composite-key reducer table. key = `${mode}.${phase}.${ACTION}`.
// value = pure handler (state, action, dynRules) => { nextPhase, stateDiff, effects[] }.
const ModeRulesV2 = {
    // ===== Practice =====
    'practice.idle.LOAD_NEXT_QUESTION': (s) => s.queue.length
        ? { nextPhase: 'canAnswer',
            stateDiff: { 'question.current': s.queue[0], 'queue': s.queue.slice(1) },
            effects: [{ type: 'render' }] }
        : { nextPhase: 'settling',
            stateDiff: { 'result.passed': true },
            effects: [{ type: 'render' }] },

    'practice.canAnswer.SUBMIT_ANSWER': (s, a, dyn) => {
        if (a.key === s.question.correctKey) {
            const newStreak = s.players.p1.correctStreak + 1;
            const pts = newStreak >= 7 ? (dyn.practiceCombo7Score || 60)
                      : newStreak >= 5 ? (dyn.practiceCombo5Score || 40)
                      : newStreak >= 3 ? (dyn.practiceCombo3Score || 30)
                      : (dyn.practiceBaseScore || 10);
            return { nextPhase: 'resolvingCorrect',
                stateDiff: { 'players.p1.correctStreak': newStreak,
                             'players.p1.wrongStreak': 0,
                             'players.p1.correctCount': s.players.p1.correctCount + 1,
                             'players.p1.score': s.players.p1.score + pts,
                             'round.score': s.round.score + 1 },
                effects: [{ type: 'sound', name: 'correct' },
                          { type: 'anim', name: 'correctHighlight', ms: 1000 }] };
        }
        return { nextPhase: 'resolvingWrong',
            stateDiff: { 'players.p1.wrongStreak': s.players.p1.wrongStreak + 1,
                         'players.p1.correctStreak': 0,
                         'players.p1.wrongCount': (s.players.p1.wrongCount || 0) + 1,
                         'players.p1.score': Math.max(0, s.players.p1.score - (dyn.practiceWrongPenalty || 10)),
                         'question.lastChosenWrongKey': a.key,
                         'question.lastResolveReason': 'wrong',
                         'question.eliminatedWrongKeys': new Set([...s.question.eliminatedWrongKeys, a.key]) },
            effects: [{ type: 'sound', name: 'wrong' },
                      { type: 'anim', name: 'markChosen', ms: 800 }] };
    },

    'practice.resolvingCorrect.EFFECT_COMPLETE': (s) => ({
        nextPhase: 'cleanup',
        stateDiff: {},
        effects: [{ type: 'cleanupAndDispatch', next: { type: 'LOAD_NEXT_QUESTION' } }],
    }),

    'practice.resolvingWrong.EFFECT_COMPLETE': (s) => ({
        nextPhase: 'canAnswer',          // Practice 答錯不結束題目，玩家再選
        stateDiff: {},
        effects: [{ type: 'cleanup' }],
    }),

    'practice.cleanup.CLEANUP_DONE': (s) => ({ nextPhase: 'idle', stateDiff: {}, effects: [] }),

    // ===== Duel Dynamic =====
    'duel.idle.LOAD_NEXT_QUESTION': (s) => {
        if (!s.queue.length) {
            const p1Score = s.players.p1.score || 0;
            const p2Score = s.players.p2.score || 0;
            const winner = s.result.winner || (p1Score > p2Score ? 'p1' : p2Score > p1Score ? 'p2' : null);
            return { nextPhase: 'settling',
                stateDiff: { 'result.winner': winner },
                effects: [{ type: 'render' }] };
        }
        return {
            nextPhase: 'buzzOpen',
            stateDiff: { 'question.current': s.queue[0], 'queue': s.queue.slice(1),
                         'buzz.eligible': new Set(['p1', 'p2']) },
            effects: [{ type: 'render' },
                      { type: 'anim', name: 'startDynamic', variant: s.dynamic.variant }],
        };
    },

    'duel.buzzOpen.BUZZ': (s, a) => s.buzz.eligible.has(a.player)
        ? { nextPhase: 'buzzed',
            stateDiff: { 'buzz.owner': a.player, 'buzz.timerStartedAt': a.now || 0,
                         'buzz.elapsedAtBuzz': s.dynamic.elapsedMs || 0 },
            effects: [{ type: 'sound', name: 'buzz' },
                      { type: 'anim', name: 'pauseDynamic' },
                      { type: 'render', target: 'showOptionsTo', player: a.player },
                      { type: 'timer', ms: 7000, onTimeout: { type: 'ANSWER_TIMEOUT', player: a.player } }] }
        : { nextPhase: 'buzzOpen', stateDiff: {}, effects: [] },  // ignore (same-race)

    'duel.buzzOpen.DYNAMIC_COMPLETE': (s) => ({
        nextPhase: 'buzzOpen',
        stateDiff: { 'dynamic.completeStateReached': true, 'dynamic.phase': 'completed' },
        effects: [{ type: 'anim', name: 'freezeAtCompleteState' }],
    }),

    // Effect order matters: timer.clear FIRST so the 5s answer-timer (still
    // ticking from buzzOpen.BUZZ) is killed before anything else. Then sound,
    // then a short anim — the anim's EFFECT_COMPLETE is what drives the next
    // phase transition (resolvingCorrect/Wrong → revealing / next-player).
    'duel.buzzed.SUBMIT_ANSWER': (s, a, dyn) => {
        if (a.key === s.question.correctKey) {
            const elapsedSec = (s.buzz.elapsedAtBuzz || 0) / 1000;
            const durSec = (dyn.dynamicDurationMs || 8000) / 1000;
            const pts = Math.round(Math.max(
                dyn.duelMinScore || 20,
                (dyn.duelBaseScore || 100) * (1 - elapsedSec / durSec)
            ));
            return { nextPhase: 'resolvingCorrect',
                stateDiff: { [`players.${a.player}.correctCount`]: s.players[a.player].correctCount + 1,
                             [`players.${a.player}.correctStreak`]: s.players[a.player].correctStreak + 1,
                             [`players.${a.player}.score`]: s.players[a.player].score + pts },
                effects: [{ type: 'timer.clear' },
                          { type: 'sound', name: 'correct' },
                          { type: 'anim', name: 'correctHighlight', ms: 800 }] };
        }
        return { nextPhase: 'resolvingWrong',
            stateDiff: { 'question.eliminatedWrongKeys': new Set([...s.question.eliminatedWrongKeys, a.key]),
                         'question.failedPlayersThisCycle': new Set([...s.question.failedPlayersThisCycle, a.player]),
                         'question.lastChosenWrongKey': a.key,
                         'question.lastResolveReason': 'wrong',
                         [`players.${a.player}.wrongCount`]: (s.players[a.player].wrongCount || 0) + 1,
                         [`players.${a.player}.correctStreak`]: 0,
                         [`players.${a.player}.score`]: Math.max(0, s.players[a.player].score - (dyn.duelWrongPenalty || 50)) },
            effects: [{ type: 'timer.clear' },
                      { type: 'sound', name: 'wrong' },
                      { type: 'anim', name: 'markChosen', ms: 800 }] };
    },

    'duel.buzzed.ANSWER_TIMEOUT': (s, a) => ({
        nextPhase: 'resolvingWrong',
        stateDiff: { 'question.failedPlayersThisCycle': new Set([...s.question.failedPlayersThisCycle, a.player]),
                     'question.lastResolveReason': 'timeout',
                     [`players.${a.player}.wrongCount`]: (s.players[a.player].wrongCount || 0) + 1,
                     [`players.${a.player}.correctStreak`]: 0 },
        // 不加入 eliminatedWrongKeys、不設 lastChosenWrongKey —— 逾時 ≠ 選錯
        effects: [{ type: 'sound', name: 'wrong' }],
    }),

    // 玩家主動放棄作答（按 G 或 ⊘ 按鈕）。語意同 ANSWER_TIMEOUT，但不浪費時間。
    // 不增加 eliminatedWrongKeys（沒選錯），只標記 failedPlayersThisCycle。
    // 需要明確的 anim 來驅動 EFFECT_COMPLETE（SUBMIT_ANSWER 一樣道理）。
    'duel.buzzed.GIVE_UP': (s, a) => ({
        nextPhase: 'resolvingWrong',
        stateDiff: { 'question.failedPlayersThisCycle': new Set([...s.question.failedPlayersThisCycle, a.player]),
                     'question.lastResolveReason': 'giveup',
                     [`players.${a.player}.wrongCount`]: (s.players[a.player].wrongCount || 0) + 1,
                     [`players.${a.player}.correctStreak`]: 0 },
        effects: [{ type: 'timer.clear' },
                  { type: 'sound', name: 'timeout' },
                  { type: 'anim', name: 'giveUp', ms: 300 }],
    }),

    // Duel 答對：快速放完 Dynamic 到 completeState（讓沒搶到的對手也看到完整結構），
    // 再進 revealing 階段標出正解。若已達勝利門檻，reveal 後才結算。
    'duel.resolvingCorrect.EFFECT_COMPLETE': (s, _, dyn) => ({
        nextPhase: 'revealing',
        stateDiff: s.players[s.buzz.owner].score >= (dyn.scoreTarget || 300)
            ? { 'result.winner': s.buzz.owner }
            : {},
        effects: [{ type: 'anim', name: 'playDynamicToCompleteState', fastForwardMs: 900 }],
    }),

    'duel.resolvingWrong.EFFECT_COMPLETE': (s, a, dyn) => {
        const eliminated = s.question.eliminatedWrongKeys.size;
        const bothFailed = s.question.failedPlayersThisCycle.has('p1')
                        && s.question.failedPlayersThisCycle.has('p2');
        if (eliminated >= dyn.revealThreshold) {
            return { nextPhase: 'revealing', stateDiff: {},
                     effects: [{ type: 'anim', name: 'playDynamicToCompleteState' }] };
        }
        if (bothFailed) {
            return { nextPhase: 'buzzOpen',
                     stateDiff: { 'buzz.eligible': new Set(['p1', 'p2']),
                                  'question.failedPlayersThisCycle': new Set() },
                     effects: [{ type: 'anim', name: 'resumeDynamic' }] };
        }
        const other = s.buzz.owner === 'p1' ? 'p2' : 'p1';
        // _isHandoff is read by render to show the "⚡ 輪到 P2" overlay briefly.
        return { nextPhase: 'buzzed',
                 stateDiff: { 'buzz.owner': other, 'buzz.eligible': new Set([other]),
                              'buzz.timerStartedAt': a.now || 0,
                              'buzz._isHandoff': true },
                 effects: [{ type: 'sound', name: 'buzz' },
                           { type: 'anim', name: 'lockoutLoser' },
                           { type: 'render', target: 'showOptionsTo', player: other },
                           { type: 'timer', ms: 7000, onTimeout: { type: 'ANSWER_TIMEOUT', player: other } }] };
    },

    // Stage 1: Dynamic finished playing to completion. Now move to 'revealed' so
    // the correct-reveal CSS class stays visible while a short anim runs. We
    // can't both reveal AND cleanup from one handler — cleanupAndDispatch
    // cancels every active effect (including the reveal anim) and transitions
    // to the cleanup phase, which wipes the green highlight class immediately.
    'duel.revealing.EFFECT_COMPLETE': (s) => ({
        nextPhase: 'revealed', stateDiff: {},
        effects: [{ type: 'anim', name: 'revealCorrect', key: s.question.correctKey, ms: 1500 }],
    }),

    // Stage 2: reveal anim done → cleanup → next question.
    'duel.revealed.EFFECT_COMPLETE': (s) => s.result.winner
        ? { nextPhase: 'settling', stateDiff: {}, effects: [{ type: 'render' }] }
        : { nextPhase: 'cleanup', stateDiff: {},
            effects: [{ type: 'cleanupAndDispatch', next: { type: 'LOAD_NEXT_QUESTION' } }] },

    'duel.cleanup.CLEANUP_DONE': (s) => ({ nextPhase: 'idle', stateDiff: {}, effects: [] }),
};

// Dynamic 變體（與規則表分離；reducer 不直接讀）
const DynamicVariants = {
    zoom: {
        completeState: 'fullStructureVisible',
        pauseOnBuzz: true,
        revealRequiresCompleteState: true,
        durationMs: 8000,   // 從頭播到 completeState 的時間
        initialScale: 5,    // 初始放大倍率（5x → 大概只能看到 1–2 個元素符號）
        finalScale: 1,      // 結束尺寸
    },
    blur: {
        completeState: 'fullStructureVisible',
        pauseOnBuzz: true,
        revealRequiresCompleteState: true,
        durationMs: 8000,
        initialBlurPx: 18,
        finalBlurPx: 0,
    },
    rotateZoom: {
        completeState: 'fullStructureVisible',
        pauseOnBuzz: true,
        revealRequiresCompleteState: true,
        durationMs: 8000,
        initialScale: 2.8,
        finalScale: 1,
        initialRotateDeg: -18,
        finalRotateDeg: 0,
    },
};

// Duel / Dynamic 數值（餵給上面 handler 的 dyn 參數）
// 所有分數設定均可由 save.js 的 settings.scoring 覆蓋（透過 getEffectiveRules）。
const DuelDynamicRules = {
    // 勝利條件（分數制）
    scoreTarget:        300,   // 先達到此分數者獲勝
    winTarget:          5,     // 備用：答對題數（scoreTarget 未達前的 correctCount 檢查）
    // 對決分數
    duelBaseScore:      100,   // 最高分（動態剛開始即搶答）
    duelTimingDecay:    10,    // 每播放 1 秒扣除的分數
    duelMinScore:       20,    // 答對最低得分（再晚搶也有這分）
    duelWrongPenalty:   50,    // 答錯扣分
    dynamicDurationMs:  8000,  // 對應 DynamicVariants.*.durationMs
    // 練習分數（連對等級對應 _comboLevel 的 3/5/7 門檻）
    practiceBaseScore:     10, // 連對 1–2 題
    practiceWrongPenalty:  10, // 答錯扣分（下限 0）
    practiceCombo3Score:   30, // 連對 3–4
    practiceCombo5Score:   40, // 連對 5–6
    practiceCombo7Score:   60, // 連對 7+
    // 其他
    answerOwnershipMs: 5000,
    revealThreshold: 3,
};

// AI 難度
const AIDifficulty = {
    easy:   { buzzReactionMs: { mean: 2500, jitter: 500 }, accuracy: 0.60 },
    medium: { buzzReactionMs: { mean: 1500, jitter: 500 }, accuracy: 0.80 },
    hard:   { buzzReactionMs: { mean:  700, jitter: 300 }, accuracy: 0.95 },
};

// Reducer 入口
function reduce(state, action, dynRules) {
    const key = `${state.mode}.${state.phase}.${action.type}`;
    const handler = ModeRulesV2[key];
    if (!handler) {
        console.warn('[reducer] no rule for', key);
        return { nextPhase: state.phase, stateDiff: {}, effects: [] };
    }
    return handler(state, action, dynRules);
}
