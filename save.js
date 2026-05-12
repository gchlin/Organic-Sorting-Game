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
//   Save.markLevelClear("level3") // 該關達門檻 → 同時解鎖該關劇情
//   Save.recordBest("speed_level3", 120)
//   Save.get()                    // 取得當前存檔物件（唯讀心態，要改請走上面的方法）
//   Save.exportText() / Save.importText(str) / Save.reset()
//   Save.isStoryUnlocked("level3") / Save.isLevelCleared("level3") / Save.knows("ethanol")

const Save = (function () {
    const STORAGE_KEY = 'organicSortingHat.save';
    const CURRENT_VERSION = 1;

    // 勳章門檻 —— ★ 草稿，待 §5 定案後調整 ★
    // id 對應 UI 圖示 / 名稱（之後再做圖鑑頁時補）。emoji 占位。
    const BADGE_DEFS = [
        { id: 'correct_10',   needCorrect: 10,   emoji: '🥉', label: '初試啼聲' },
        { id: 'correct_50',   needCorrect: 50,   emoji: '🥈', label: '小有心得' },
        { id: 'correct_200',  needCorrect: 200,  emoji: '🥇', label: '熟練學徒' },
        { id: 'correct_500',  needCorrect: 500,  emoji: '🎩', label: '分類帽認證' },
        { id: 'correct_1000', needCorrect: 1000, emoji: '🏆', label: '有機大師' }
    ];

    function defaultSave() {
        return {
            version: CURRENT_VERSION,
            totalCorrect: 0,        // 累積答對題數（非比率、非最佳；Duel 不計入）
            badges: [],             // 已解鎖勳章 id
            seenMolecules: [],      // 圖鑑·分類：已認得的分子 key
            knownProperties: [],    // 圖鑑·性質用途：已解鎖的分子 key
            memes: [],              // 圖鑑·迷因梗圖：已解鎖編號
            wrongQueue: {},         // 錯題：{ molKey: 還沒攻克的次數 }
            storyUnlocked: [],      // 已解鎖劇情的關卡 ["level1", …]
            levelClears: {},        // 各關是否達門檻過 { "level1": true, … }
            bestScores: {},         // { "speed_level3": 120, "duel_level6": 80, … }
            tutorialSeen: false,    // 全域新手導覽是否已看過（首次進站自動跳出）
            levelTutorialsSeen: []  // 已看過「本關分類帽教學」的關卡 ["level1", …]（第一次進關自動跳出）
        };
    }

    // 把任意（可能舊版 / 殘缺）的物件補成最新結構
    function migrate(obj) {
        const base = defaultSave();
        if (!obj || typeof obj !== 'object') return base;
        const out = base;
        for (const k of Object.keys(base)) {
            if (k === 'version') continue;
            if (obj[k] !== undefined && obj[k] !== null) {
                // 型別大致對得上才採用，避免壞資料污染
                if (Array.isArray(base[k]) && Array.isArray(obj[k])) out[k] = obj[k].slice();
                else if (typeof base[k] === 'object' && typeof obj[k] === 'object' && !Array.isArray(obj[k])) out[k] = Object.assign({}, obj[k]);
                else if (typeof base[k] === typeof obj[k]) out[k] = obj[k];
            }
        }
        out.version = CURRENT_VERSION;
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
            const raw = localStorage.getItem(STORAGE_KEY);
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

    // 該關達門檻：記 levelClears + 順帶解鎖該關劇情
    function markLevelClear(levelKey) {
        let changed = false;
        if (!data.levelClears[levelKey]) { data.levelClears[levelKey] = true; changed = true; }
        if (!data.storyUnlocked.includes(levelKey)) { data.storyUnlocked.push(levelKey); changed = true; }
        if (changed) persist();
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

    // 載入一次（模組初始化）
    load();

    return {
        load, get,
        addCorrect, recordWrong, clearWrong,
        seeMolecule, unlockProperty, unlockMeme,
        unlockStory, markLevelClear, recordBest,
        knows, isStoryUnlocked, isLevelCleared,
        unlockedBadges, allBadgeDefs, wrongList,
        markTutorialSeen, isTutorialSeen,
        markLevelTutorialSeen, isLevelTutorialSeen,
        exportText, importText, reset
    };
})();
