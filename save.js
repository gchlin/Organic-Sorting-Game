// save(organic).js — 本地存檔（localStorage / 純前端，無後端）
//
// 對應 設計決策清單.md §17。
// 存的東西：累積答對數、勳章、三類圖鑑解鎖、錯題佇列、劇情解鎖、各關通過、各模式最高分。
// 提供：讀寫（自動持久化）、匯出 / 匯入（明碼 JSON，不加密）、重置、版本遷移。
//
// 用法（在 game.js 等處）：
//   Save.addCorrect(1)            // 答對一題 → 回傳這次新解鎖的勳章 id 陣列（沒有就 []）
//   Save.recordWrong("phenol")    // 答錯記錄
//   Save.clearWrong("phenol")     // 攻克一次（次數 -1，歸零就移除）
//   Save.seeMolecule("ethanol")   // 圖鑑·分類：認得了
//   Save.unlockProperty("ethanol")// 圖鑑·性質用途
//   Save.unlockMeme(3)            // 圖鑑·迷因梗圖（用編號）
//   Save.markLevelClear("level3") // 該關完成題庫 → 同時解鎖該關劇情
//   Save.recordBest("speed_level3", 120)
//   Save.get()                    // 取得當前存檔物件（唯讀心態，要改請走上面的方法）
//   Save.exportText() / Save.importText(str) / Save.reset()
//   Save.isStoryUnlocked("level3") / Save.isLevelCleared("level3") / Save.knows("ethanol")
//
// v2 API (schema version 2):
//   Save.migrateV1toV2(old)                            // pure function; returns new-format object
//   Save.markSubLevelClear(family, difficulty)          // returns newly-unlocked badge IDs
//   Save.recordSubLevelRound(family, difficulty, acc)   // returns newly-unlocked badge IDs
//   Save.markTutorialSeenV2(family, difficulty)
//   Save.isTutorialSeenV2(family, difficulty)
//   Save.recordMoleculeAnsweredV2(compoundKey, difficulty)
//   Save.recordAskedV2(family, difficulty, compoundKey)        // returns { newlyCleared }
//   Save.getAskedHistory(family, difficulty)                   // returns Set<compoundKey>
//   Save.isSubLevelCleared(family, difficulty)                 // boolean
//   Save.clearAskedHistory(family?, difficulty?)               // scope-aware reset
//   Save.readSettings() / Save.writeSettings(partial)

const Save = (function () {
    const STORAGE_KEY = 'organicSortingHat.save';
    const CURRENT_VERSION = 2;

    // 勳章門檻 —— ★ 草稿，待 §5 定案後調整 ★
    // id 對應 UI 圖示 / 名稱（之後再做圖鑑頁時補）。emoji 占位。
    const BADGE_DEFS = [
        { id: 'correct_10',   needCorrect: 10,   emoji: '🥉', label: '初試啼聲' },
        { id: 'correct_50',   needCorrect: 50,   emoji: '🥈', label: '小有心得' },
        { id: 'correct_200',  needCorrect: 200,  emoji: '🥇', label: '熟練學徒' },
        { id: 'correct_500',  needCorrect: 500,  emoji: '🎩', label: '分類帽認證' },
        { id: 'correct_1000', needCorrect: 1000, emoji: '🏆', label: '有機大師' }
    ];

    // Mapping from old level keys to new family keys
    const LEVEL_TO_FAMILY = {
        level1: 'hydrocarbon',
        level2: 'oxygen',
        level3: 'oxygen',
        level4: 'oxygen',
        level5: 'nitrogenHalide',
        level6: 'mixed',
        levelShell: 'shell',
        level99: 'englishChallenge'
    };

    // Families that have a storyKey (null means no story to unlock)
    const FAMILY_STORY_KEYS = {
        hydrocarbon: 'hydrocarbon',
        oxygen: 'oxygen',
        nitrogenHalide: 'nitrogenHalide',
        mixed: 'mixed',
        shell: 'shell',
        englishChallenge: null
    };

    function defaultSettings() {
        return {
            devQuickWin: {
                enabled: true,
                winAfter: 2,
                appliesTo: ['practice', 'duel'],
                showIndicator: true
            },
            devShowFps: false,
            devLogActions: false
        };
    }

    function defaultFamilyDifficultyEntry() {
        return { completedAll: false, lastAccuracy: null };
    }

    function defaultSave() {
        return {
            version: CURRENT_VERSION,
            totalCorrect: 0,        // 累積答對題數（非比率、非最佳；Duel 不計入）
            badges: [],             // 已解鎖勳章 id（含 family-difficulty-completed/mastery）
            seenMolecules: [],      // 圖鑑·分類：已認得的分子 key（legacy v1）
            knownProperties: [],    // 圖鑑·性質用途：已解鎖的分子 key
            memes: [],              // 圖鑑·迷因梗圖：已解鎖編號
            wrongQueue: {},         // 錯題：{ molKey: 還沒攻克的次數 }
            storyUnlocked: [],      // 已解鎖劇情的關卡 ["level1", …]（legacy v1）
            levelClears: {},        // 各關是否完成題庫 { "level1": true, … }（legacy v1）
            practiceStats: {},      // { levelKey: { answered: [], lastRate, bestRate, lastCorrect, lastTotal } }
            bestScores: {},         // { "speed_level3": 120, "duel_level6": 80, … }
            tutorialSeen: false,    // 全域新手導覽是否已看過（首次進站自動跳出）
            levelTutorialsSeen: [], // 已看過「本關分類帽教學」的關卡（legacy v1）
            // --- v2 fields ---
            familyProgress: {},     // { [familyKey]: { [difficulty]: { completedAll, lastAccuracy } } }
            tutorialsSeen: [],      // ['hydrocarbon-beginner', 'oxygen-intermediate', …]
            moleculeSeen: {},       // { [compoundKey]: { beginner: bool, intermediate: bool, advanced: bool } }
            unlockedStories: [],    // family keys; e.g. ['hydrocarbon', 'oxygen']
            wrongLog: {},           // { 'family-difficulty': { active: [], fixed: [], lastUpdated: 0 } }
            askedHistory: {},       // { 'family-difficulty': [compoundKey, …] }  — set, stored as array
            settings: defaultSettings()
        };
    }

    // --- Migration: v1 → v2 ---
    // Pure function: takes old-format object, returns new-format object.
    function migrateV1toV2(old) {
        if (!old || typeof old !== 'object') old = {};

        const out = defaultSave();

        // Preserve scalar fields
        if (typeof old.totalCorrect === 'number') out.totalCorrect = old.totalCorrect;
        // Support both old key names found in the wild
        if (typeof old.correctTotal === 'number' && out.totalCorrect === 0) out.totalCorrect = old.correctTotal;

        // Preserve array fields
        if (Array.isArray(old.badges)) out.badges = old.badges.slice();
        if (Array.isArray(old.seenMolecules)) out.seenMolecules = old.seenMolecules.slice();
        if (Array.isArray(old.knownProperties)) out.knownProperties = old.knownProperties.slice();
        if (Array.isArray(old.memes)) out.memes = old.memes.slice();
        if (Array.isArray(old.levelTutorialsSeen)) out.levelTutorialsSeen = old.levelTutorialsSeen.slice();

        // Preserve object fields
        if (old.wrongQueue && typeof old.wrongQueue === 'object' && !Array.isArray(old.wrongQueue)) {
            out.wrongQueue = Object.assign({}, old.wrongQueue);
        }
        if (old.levelClears && typeof old.levelClears === 'object' && !Array.isArray(old.levelClears)) {
            out.levelClears = Object.assign({}, old.levelClears);
        }
        if (old.practiceStats && typeof old.practiceStats === 'object' && !Array.isArray(old.practiceStats)) {
            out.practiceStats = Object.assign({}, old.practiceStats);
        }
        if (old.bestScores && typeof old.bestScores === 'object' && !Array.isArray(old.bestScores)) {
            out.bestScores = Object.assign({}, old.bestScores);
        }

        if (typeof old.tutorialSeen === 'boolean') out.tutorialSeen = old.tutorialSeen;

        // Map levelsCleared array → familyProgress
        // Old format had levelsCleared as array of level keys OR levelClears as object
        const clearedLevels = Array.isArray(old.levelsCleared) ? old.levelsCleared : [];
        // Also handle levelClears object
        if (old.levelClears && typeof old.levelClears === 'object') {
            for (const lk of Object.keys(old.levelClears)) {
                if (old.levelClears[lk] && !clearedLevels.includes(lk)) {
                    clearedLevels.push(lk);
                }
            }
        }

        for (const levelKey of clearedLevels) {
            const family = LEVEL_TO_FAMILY[levelKey];
            if (!family) continue;
            const difficulty = (levelKey === 'level99') ? 'advanced' : 'intermediate';
            if (!out.familyProgress[family]) out.familyProgress[family] = {};
            if (!out.familyProgress[family][difficulty]) {
                out.familyProgress[family][difficulty] = defaultFamilyDifficultyEntry();
            }
            out.familyProgress[family][difficulty].completedAll = true;
        }

        // Map levelTutorialsSeen → tutorialsSeen
        const oldLevelTuts = Array.isArray(old.levelTutorialsSeen) ? old.levelTutorialsSeen : [];
        const tutSet = new Set();
        for (const levelKey of oldLevelTuts) {
            const family = LEVEL_TO_FAMILY[levelKey];
            if (!family) continue;
            const difficulty = (levelKey === 'level99') ? 'advanced' : 'intermediate';
            tutSet.add(family + '-' + difficulty);
        }
        out.tutorialsSeen = Array.from(tutSet);

        // Map seenMolecules → moleculeSeen (intermediate=true; old version only had intermediate)
        const oldSeen = Array.isArray(old.seenMolecules) ? old.seenMolecules : [];
        for (const compoundKey of oldSeen) {
            if (!out.moleculeSeen[compoundKey]) {
                out.moleculeSeen[compoundKey] = { beginner: false, intermediate: false, advanced: false };
            }
            out.moleculeSeen[compoundKey].intermediate = true;
        }

        // Map unlockedStories (old: level keys OR family keys) → new family keys
        const oldStories = Array.isArray(old.unlockedStories) ? old.unlockedStories
                         : Array.isArray(old.storyUnlocked) ? old.storyUnlocked
                         : [];
        const storySet = new Set();
        for (const key of oldStories) {
            // Check if it's a level key
            if (LEVEL_TO_FAMILY[key]) {
                storySet.add(LEVEL_TO_FAMILY[key]);
            } else {
                // Might already be a family key
                storySet.add(key);
            }
        }
        out.unlockedStories = Array.from(storySet);

        // Settings: start from defaults (old data had none)
        out.settings = defaultSettings();

        // Wrong-log starts empty in v2; v1 had nothing comparable
        out.wrongLog = {};

        // Asked-history starts empty in v2; legacy saves effectively reset
        // progress on upgrade. Acceptable because old `levelsCleared`
        // already restored the family-completion badges via familyProgress.
        out.askedHistory = {};

        out.version = 2;
        return out;
    }

    // --- Legacy v1 migrate (field-fill for missing keys) ---
    function migrate(obj) {
        if (!obj || typeof obj !== 'object') return defaultSave();
        // If version is not 2, run v1→v2 migration
        if (!obj.version || obj.version !== 2) {
            return migrateV1toV2(obj);
        }
        // Version 2: fill missing v2 fields with defaults
        const base = defaultSave();
        const out = Object.assign({}, base, obj);
        // Ensure nested defaults for settings
        if (!out.settings || typeof out.settings !== 'object') {
            out.settings = defaultSettings();
        } else {
            out.settings = Object.assign({}, defaultSettings(), out.settings);
            if (!out.settings.devQuickWin || typeof out.settings.devQuickWin !== 'object') {
                out.settings.devQuickWin = defaultSettings().devQuickWin;
            } else {
                out.settings.devQuickWin = Object.assign({}, defaultSettings().devQuickWin, out.settings.devQuickWin);
            }
        }
        if (!out.familyProgress || typeof out.familyProgress !== 'object') out.familyProgress = {};
        if (!out.moleculeSeen || typeof out.moleculeSeen !== 'object') out.moleculeSeen = {};
        if (!Array.isArray(out.tutorialsSeen)) out.tutorialsSeen = [];
        if (!Array.isArray(out.unlockedStories)) out.unlockedStories = [];
        if (!out.wrongLog || typeof out.wrongLog !== 'object') out.wrongLog = {};
        if (!out.askedHistory || typeof out.askedHistory !== 'object') out.askedHistory = {};
        out.version = 2;
        return out;
    }

    let data = defaultSave();

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // 私密視窗 / 容量滿 / 被瀏覽器擋 → 退回「只在記憶體中」，不讓遊戲掛掉
            console.warn('[Save] 無法寫入 localStorage，本次進度不會被保存：', e);
        }
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
                     || localStorage.getItem('organicSortingHat')  // legacy key fallback
                     || localStorage.getItem('organicSortingHat:v1'); // legacy key fallback
            data = raw ? migrate(JSON.parse(raw)) : defaultSave();
        } catch (e) {
            console.warn('[Save] 讀取存檔失敗，改用全新存檔：', e);
            data = defaultSave();
        }
        return data;
    }

    // --- 集合（陣列當 set 用）小工具 ---
    function addToSet(key, value) {
        if (!data[key].includes(value)) { data[key].push(value); persist(); return true; }
        return false;
    }

    // --- 對外 API ---

    // 答對 n 題 → 更新累積、檢查勳章；回傳這次「新解鎖」的勳章 id 陣列
    function addCorrect(n) {
        n = (typeof n === 'number' && n > 0) ? Math.floor(n) : 1;
        data.totalCorrect += n;
        const newly = [];
        for (const b of BADGE_DEFS) {
            if (data.totalCorrect >= b.needCorrect && !data.badges.includes(b.id)) {
                data.badges.push(b.id);
                newly.push(b.id);
            }
        }
        persist();
        return newly;
    }

    function recordWrong(molKey) {
        if (!molKey) return;
        data.wrongQueue[molKey] = (data.wrongQueue[molKey] || 0) + 1;
        persist();
    }

    // 攻克一次（次數 -1；歸零就移除）；回傳是否已完全攻克
    function clearWrong(molKey) {
        if (!molKey || !data.wrongQueue[molKey]) return true;
        data.wrongQueue[molKey] -= 1;
        if (data.wrongQueue[molKey] <= 0) { delete data.wrongQueue[molKey]; persist(); return true; }
        persist();
        return false;
    }

    function seeMolecule(molKey) { return addToSet('seenMolecules', molKey); }
    function unlockProperty(molKey) { return addToSet('knownProperties', molKey); }
    function unlockMeme(id) { return addToSet('memes', id); }

    function unlockStory(levelKey) { return addToSet('storyUnlocked', levelKey); }

    // 該關完成題庫：記 levelClears + 順帶解鎖該關劇情
    function markLevelClear(levelKey) {
        let changed = false;
        if (!data.levelClears[levelKey]) { data.levelClears[levelKey] = true; changed = true; }
        if (!data.storyUnlocked.includes(levelKey)) { data.storyUnlocked.push(levelKey); changed = true; }
        if (changed) persist();
    }

    function recordPracticeAttempt(levelKey, questionId, correct, roundCorrect, roundTotal) {
        if (!levelKey) return null;
        if (!data.practiceStats[levelKey]) {
            data.practiceStats[levelKey] = {
                answered: [],
                lastRate: 0,
                bestRate: 0,
                lastCorrect: 0,
                lastTotal: 0
            };
        }
        const stat = data.practiceStats[levelKey];
        if (questionId && !stat.answered.includes(questionId)) stat.answered.push(questionId);
        if (typeof roundCorrect === 'number' && typeof roundTotal === 'number' && roundTotal > 0) {
            const rate = roundCorrect / roundTotal;
            stat.lastRate = rate;
            stat.bestRate = Math.max(stat.bestRate || 0, rate);
            stat.lastCorrect = roundCorrect;
            stat.lastTotal = roundTotal;
        }
        persist();
        return stat;
    }

    function practiceStats(levelKey) {
        return data.practiceStats[levelKey] || null;
    }

    function recordBest(modeKey, score) {
        if (!modeKey || typeof score !== 'number') return;
        if (!(modeKey in data.bestScores) || score > data.bestScores[modeKey]) {
            data.bestScores[modeKey] = score;
            persist();
        }
    }

    // --- 查詢 ---
    function get() { return data; }
    function knows(molKey) { return data.seenMolecules.includes(molKey); }
    function isStoryUnlocked(levelKey) { return data.storyUnlocked.includes(levelKey); }
    function isLevelCleared(levelKey) { return !!data.levelClears[levelKey]; }
    function unlockedBadges() { return BADGE_DEFS.filter(b => data.badges.includes(b.id)); }
    function allBadgeDefs() { return BADGE_DEFS.slice(); }
    // 錯題清單（次數由多到少），給「錯題回顧 / 優先重考」用
    function wrongList() {
        return Object.keys(data.wrongQueue)
            .sort((a, b) => data.wrongQueue[b] - data.wrongQueue[a])
            .map(k => ({ key: k, count: data.wrongQueue[k] }));
    }

    // --- 匯出 / 匯入 / 重置 ---
    function exportText() { return JSON.stringify(data); }

    function importText(str) {
        try {
            const obj = JSON.parse(str);
            data = migrate(obj);
            persist();
            return true;
        } catch (e) {
            console.warn('[Save] 匯入失敗（格式不對）：', e);
            return false;
        }
    }

    function reset() { data = defaultSave(); persist(); }

    function markTutorialSeen() { if (!data.tutorialSeen) { data.tutorialSeen = true; persist(); } }
    function isTutorialSeen() { return !!data.tutorialSeen; }
    function markLevelTutorialSeen(levelKey) { return addToSet('levelTutorialsSeen', levelKey); }
    function isLevelTutorialSeen(levelKey) { return data.levelTutorialsSeen.includes(levelKey); }

    // =======================================================================
    // v2 API
    // =======================================================================

    // Ensure familyProgress[family][difficulty] entry exists
    function ensureFamilyDifficulty(family, difficulty) {
        if (!data.familyProgress[family]) data.familyProgress[family] = {};
        if (!data.familyProgress[family][difficulty]) {
            data.familyProgress[family][difficulty] = defaultFamilyDifficultyEntry();
        }
        return data.familyProgress[family][difficulty];
    }

    // markSubLevelClear(family, difficulty)
    // Sets familyProgress[family][difficulty].completedAll = true.
    // If family has storyKey non-null, adds to unlockedStories.
    // Returns array of newly unlocked badge IDs.
    function markSubLevelClear(family, difficulty) {
        const entry = ensureFamilyDifficulty(family, difficulty);
        const newlyUnlocked = [];
        const badgeId = family + '-' + difficulty + '-completed';
        if (!entry.completedAll) {
            entry.completedAll = true;
            if (!data.badges.includes(badgeId)) {
                data.badges.push(badgeId);
                newlyUnlocked.push(badgeId);
            }
        }
        // Unlock story if family has one
        const storyKey = (family in FAMILY_STORY_KEYS) ? FAMILY_STORY_KEYS[family] : family;
        if (storyKey && !data.unlockedStories.includes(storyKey)) {
            data.unlockedStories.push(storyKey);
        }
        persist();
        return newlyUnlocked;
    }

    // recordSubLevelRound(family, difficulty, accuracy)
    // Updates familyProgress[family][difficulty].lastAccuracy.
    // If accuracy >= 0.80, returns ['<family>-<difficulty>-mastery'] if newly unlocked.
    function recordSubLevelRound(family, difficulty, accuracy) {
        const entry = ensureFamilyDifficulty(family, difficulty);
        entry.lastAccuracy = accuracy;
        const newlyUnlocked = [];
        if (typeof accuracy === 'number' && accuracy >= 0.80) {
            const badgeId = family + '-' + difficulty + '-mastery';
            if (!data.badges.includes(badgeId)) {
                data.badges.push(badgeId);
                newlyUnlocked.push(badgeId);
            }
        }
        persist();
        return newlyUnlocked;
    }

    // markTutorialSeenV2(family, difficulty) / isTutorialSeenV2(family, difficulty)
    // Keyed by 'family-difficulty'
    function markTutorialSeenV2(family, difficulty) {
        const key = family + '-' + difficulty;
        if (!data.tutorialsSeen.includes(key)) {
            data.tutorialsSeen.push(key);
            persist();
        }
    }

    function isTutorialSeenV2(family, difficulty) {
        return data.tutorialsSeen.includes(family + '-' + difficulty);
    }

    // recordMoleculeAnsweredV2(compoundKey, difficulty)
    // Sets moleculeSeen[compoundKey][difficulty] = true
    function recordMoleculeAnsweredV2(compoundKey, difficulty) {
        if (!data.moleculeSeen[compoundKey]) {
            data.moleculeSeen[compoundKey] = { beginner: false, intermediate: false, advanced: false };
        }
        if (!data.moleculeSeen[compoundKey][difficulty]) {
            data.moleculeSeen[compoundKey][difficulty] = true;
            persist();
        }
    }

    // =======================================================================
    // Wrong-review v2 (錯題本 / 錯題回顧)
    //
    // Per README "錯題回顧 / 錯題本":
    // - wrongLog is bucketed by `${family}-${difficulty}`.
    //   { active: string[], fixed: string[], lastUpdated: number }
    // - recordWrongV2: add a compoundKey to active if not already in active/fixed.
    //   (If it's already fixed → it stays fixed; player has overcome it once.)
    // - markFixedV2: if compoundKey is in active, move it to fixed.
    //   (No-op if not in active.)
    // - clearWrongLog: scope-aware reset (family+difficulty / family / all).
    //
    // Effect manager calls these fire-and-forget; no return value contract.
    // =======================================================================

    function _wrongBucketKey(family, difficulty) {
        return family + '-' + difficulty;
    }

    function _ensureWrongBucket(family, difficulty) {
        const key = _wrongBucketKey(family, difficulty);
        if (!data.wrongLog || typeof data.wrongLog !== 'object') data.wrongLog = {};
        if (!data.wrongLog[key] || typeof data.wrongLog[key] !== 'object') {
            data.wrongLog[key] = { active: [], fixed: [], lastUpdated: 0 };
        }
        const bucket = data.wrongLog[key];
        if (!Array.isArray(bucket.active)) bucket.active = [];
        if (!Array.isArray(bucket.fixed)) bucket.fixed = [];
        if (typeof bucket.lastUpdated !== 'number') bucket.lastUpdated = 0;
        return bucket;
    }

    function recordWrongV2(family, difficulty, compoundKey) {
        if (!family || !difficulty || !compoundKey) return;
        const bucket = _ensureWrongBucket(family, difficulty);
        if (bucket.active.indexOf(compoundKey) !== -1) return;
        if (bucket.fixed.indexOf(compoundKey) !== -1) return; // already overcome; ignore
        bucket.active.push(compoundKey);
        bucket.lastUpdated = Date.now();
        persist();
    }

    function markFixedV2(family, difficulty, compoundKey) {
        if (!family || !difficulty || !compoundKey) return;
        const bucket = _ensureWrongBucket(family, difficulty);
        const idx = bucket.active.indexOf(compoundKey);
        if (idx === -1) return;
        bucket.active.splice(idx, 1);
        if (bucket.fixed.indexOf(compoundKey) === -1) bucket.fixed.push(compoundKey);
        bucket.lastUpdated = Date.now();
        persist();
    }

    function getActiveWrongs(family, difficulty) {
        if (!family || !difficulty) return [];
        const key = _wrongBucketKey(family, difficulty);
        const bucket = data.wrongLog && data.wrongLog[key];
        if (!bucket || !Array.isArray(bucket.active)) return [];
        return bucket.active.slice();
    }

    function getAllActiveWrongs() {
        const out = {};
        if (!data.wrongLog || typeof data.wrongLog !== 'object') return out;
        for (const k of Object.keys(data.wrongLog)) {
            const bucket = data.wrongLog[k];
            if (bucket && Array.isArray(bucket.active) && bucket.active.length > 0) {
                out[k] = bucket.active.slice();
            }
        }
        return out;
    }

    function clearWrongLog(family, difficulty) {
        if (!data.wrongLog || typeof data.wrongLog !== 'object') {
            data.wrongLog = {};
            persist();
            return;
        }
        if (!family) {
            data.wrongLog = {};
            persist();
            return;
        }
        if (!difficulty) {
            // Clear all difficulties of this family
            for (const k of Object.keys(data.wrongLog)) {
                if (k.indexOf(family + '-') === 0) delete data.wrongLog[k];
            }
            persist();
            return;
        }
        const key = _wrongBucketKey(family, difficulty);
        delete data.wrongLog[key];
        persist();
    }

    // =======================================================================
    // Asked-history v2
    //
    // Per README "通關、進度與存檔規則":
    // - `askedHistory[family-difficulty]: Set<compoundKey>` tracks which
    //   questions in a sub-level have been ASKED (regardless of result).
    // - This is distinct from `moleculeSeen` (which tracks answered correctly,
    //   for codex stamps). The Practice clear condition uses askedHistory.
    // - Serialized as array; getAskedHistory(...) returns a fresh Set.
    // - recordAskedV2 returns { newlyCleared: bool } so the caller can
    //   trigger markSubLevelClear (badge + story unlock) on the transition.
    // =======================================================================

    function _askedBucketKey(family, difficulty) {
        return family + '-' + difficulty;
    }

    function _ensureAskedBucket(family, difficulty) {
        const key = _askedBucketKey(family, difficulty);
        if (!data.askedHistory || typeof data.askedHistory !== 'object') data.askedHistory = {};
        if (!Array.isArray(data.askedHistory[key])) data.askedHistory[key] = [];
        return data.askedHistory[key];
    }

    function recordAskedV2(family, difficulty, compoundKey) {
        if (!family || !difficulty || !compoundKey) return { newlyCleared: false };
        const bucket = _ensureAskedBucket(family, difficulty);
        const wasAlready = bucket.indexOf(compoundKey) !== -1;
        if (!wasAlready) {
            bucket.push(compoundKey);
            persist();
        }
        // Detect the transition: this push made the bucket size equal the
        // full question-set size for the first time.
        let total = 0;
        if (typeof QuestionEngine !== 'undefined' && typeof QuestionEngine.getQuestionSet === 'function') {
            const set = QuestionEngine.getQuestionSet(family, difficulty);
            total = Array.isArray(set) ? set.length : 0;
        }
        const newlyCleared = !wasAlready && total > 0 && bucket.length === total;
        return { newlyCleared: newlyCleared };
    }

    function getAskedHistory(family, difficulty) {
        if (!family || !difficulty) return new Set();
        const key = _askedBucketKey(family, difficulty);
        const arr = data.askedHistory && data.askedHistory[key];
        return new Set(Array.isArray(arr) ? arr : []);
    }

    function isSubLevelCleared(family, difficulty) {
        if (!family || !difficulty) return false;
        if (typeof QuestionEngine === 'undefined' || typeof QuestionEngine.getQuestionSet !== 'function') return false;
        const set = QuestionEngine.getQuestionSet(family, difficulty);
        const total = Array.isArray(set) ? set.length : 0;
        if (total <= 0) return false;
        const asked = getAskedHistory(family, difficulty);
        return asked.size === total;
    }

    function clearAskedHistory(family, difficulty) {
        if (!data.askedHistory || typeof data.askedHistory !== 'object') {
            data.askedHistory = {};
            persist();
            return;
        }
        if (!family) {
            data.askedHistory = {};
            persist();
            return;
        }
        if (!difficulty) {
            // Clear all difficulties of this family
            for (const k of Object.keys(data.askedHistory)) {
                if (k.indexOf(family + '-') === 0) delete data.askedHistory[k];
            }
            persist();
            return;
        }
        const key = _askedBucketKey(family, difficulty);
        delete data.askedHistory[key];
        persist();
    }

    // readSettings() / writeSettings(partial)
    // Expose settings sub-object; writeSettings deep-merges and persists.
    function readSettings() {
        if (!data.settings || typeof data.settings !== 'object') {
            data.settings = defaultSettings();
        }
        return data.settings;
    }

    function writeSettings(partial) {
        if (!partial || typeof partial !== 'object') return;
        if (!data.settings || typeof data.settings !== 'object') {
            data.settings = defaultSettings();
        }
        // Deep-merge devQuickWin sub-object if present
        for (const key of Object.keys(partial)) {
            if (key === 'devQuickWin' && partial[key] && typeof partial[key] === 'object') {
                data.settings.devQuickWin = Object.assign({}, data.settings.devQuickWin || {}, partial[key]);
            } else {
                data.settings[key] = partial[key];
            }
        }
        persist();
    }

    // 載入一次（模組初始化）
    load();

    return {
        load, get,
        addCorrect, recordWrong, clearWrong,
        seeMolecule, unlockProperty, unlockMeme,
        unlockStory, markLevelClear, recordPracticeAttempt, practiceStats, recordBest,
        knows, isStoryUnlocked, isLevelCleared,
        unlockedBadges, allBadgeDefs, wrongList,
        markTutorialSeen, isTutorialSeen,
        markLevelTutorialSeen, isLevelTutorialSeen,
        exportText, importText, reset,
        // v2 API
        migrateV1toV2,
        markSubLevelClear,
        recordSubLevelRound,
        markTutorialSeenV2, isTutorialSeenV2,
        recordMoleculeAnsweredV2,
        // wrong-review v2
        recordWrongV2, markFixedV2, getActiveWrongs, getAllActiveWrongs, clearWrongLog,
        // asked-history v2
        recordAskedV2, getAskedHistory, isSubLevelCleared, clearAskedHistory,
        readSettings, writeSettings
    };
})();
