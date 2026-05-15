// game.js - 有機分類帽 (修復音效、冷卻與Combo攻擊版)

const WIZARD_PRESETS = [
    { emoji: '🧙', name: '凱庫勒傳人', title: '苯環發現者嫡傳弟子', avatar: 'assets/images/wizard-avatars/kekule.webp' },
    { emoji: '💜', name: '羰基魔女',   title: 'C=O 的召喚者',       avatar: 'assets/images/wizard-avatars/carbonyl-witch.webp' },
    { emoji: '🔥', name: '烯炔騎士',   title: 'π 鍵破壞者',         avatar: 'assets/images/wizard-avatars/alkene-alkyne-knight.webp' },
];

const Game = (function() {
    // --- 變數與設定 ---
    let currentMode = "practice";
    let currentLevel = "level1";
    let timerInterval = null;
    let gameActive = false;
    let timeLeft = 0;
    let _globalInputLocked = false;
    const _coreState = (typeof GameState !== 'undefined') ? GameState.createState() : null;
    const MAX_TIME = (typeof ModeRules !== 'undefined' && ModeRules.get('speed'))
        ? ModeRules.get('speed').durationSeconds
        : 60;

    // 玩家狀態
    // isLocked: 答錯冷卻鎖定
    const players = {
        p1: { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false },
        p2: { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false }
    };

    function setGlobalInputLocked(locked) {
        _globalInputLocked = Boolean(locked);
        if (typeof GameState !== 'undefined' && _coreState) {
            // Keep the new core-state scaffold in sync while game.js is migrated.
            GameState.setGlobalInputLocked(_coreState, _globalInputLocked);
        }
    }

    function setManagedTimeout(key, callback, delay) {
        if (typeof EffectManager !== 'undefined' && EffectManager.setTimeoutTracked) {
            return EffectManager.setTimeoutTracked(key, callback, delay);
        }
        return setTimeout(callback, delay);
    }

    function clearManagedTimeout(key, id) {
        if (typeof EffectManager !== 'undefined' && EffectManager.clearTimeoutTracked) {
            EffectManager.clearTimeoutTracked(key);
            return;
        }
        if (id) clearTimeout(id);
    }

    function cleanupQuestionTransientState() {
        if (typeof EffectManager !== 'undefined') {
            if (EffectManager.removeTransientElements) EffectManager.removeTransientElements(UI.game);
            if (EffectManager.clearTransientClasses) EffectManager.clearTransientClasses(UI.game);
        } else {
            UI.game.querySelectorAll('.buzz-countdown, .buzz-penalty-badge, .time-bonus, .combo-projectile, .bolt, .impact-burst, .spark')
                .forEach(el => el.remove());
            UI.game.querySelectorAll('.correct, .wrong, .reveal-correct, .locked-area, .buzz-active, .buzz-locked-out, .pre-buzz')
                .forEach(el => el.classList.remove('correct', 'wrong', 'reveal-correct', 'locked-area', 'buzz-active', 'buzz-locked-out', 'pre-buzz'));
        }
        ['p1', 'p2'].forEach(player => {
            players[player].isLocked = false;
            const playerUI = getPlayerUI(player);
            if (playerUI.warn) {
                playerUI.warn.classList.add('hidden');
                playerUI.warn.textContent = '魔力告急!';
            }
        });
    }

    // 魔法師身份（角色選擇彈窗設定）
    const wizardPersonas = {
        p1: { emoji: '🧙', name: '玩家一' },
        p2: { emoji: '🧙', name: '玩家二' }
    };

    // 答錯冷卻的 setTimeout 控制（避免「試管破了」警告與灰色鎖定殘留到下一局）
    const lockTimers = { p1: null, p2: null };

    // 抽題用：洗牌佇列（保證一輪內不重複出同一題；發完一輪才重洗）
    let questionQueue = [];
    let questionQueueLevel = null;
    // 主線關卡順序（決定「目前學到哪」→ 干擾選項只能從學過的分子裡抽）
    const MAIN_LEVELS = ['level1', 'level2', 'level3', 'level4', 'level5', 'level6'];

    // 關卡資訊（名稱、對應梗圖檔名陣列；圖鑑與「下一關」用）
    // 梗圖命名規則：依關卡順序 → 第 N 關用 memeN.jpg；之後若一關有多張改成 ['memeN-1.jpg','memeN-2.jpg', …]
    const LEVEL_INFO = {
        level1:  { name: 'Level 1：碳氫骨架基礎',      memes: ['meme1.jpg'] },
        level2:  { name: 'Level 2：單鍵氧家族（醇醚）', memes: ['meme2.jpg'] },
        level3:  { name: 'Level 3：雙鍵氧家族（醛酮）', memes: ['meme3.jpg'] },
        level4:  { name: 'Level 4：雙氧複合（酸酯）',   memes: ['meme4.jpg'] },
        level5:  { name: 'Level 5：雜原子與鹵素',      memes: ['meme5.jpg'] },
        level6:  { name: 'Level 6：終極分類帽（綜合）', memes: ['meme6.jpg'] },
        levelShell: { name: '「龜殼」與它的產地（苯環陷阱）', titleShort: '龜殼之地', memes: [] },
        level99: { name: 'Level 99：資優全英挑戰',     memes: ['meme7.jpg'] },
    };
    // 官能基類別中文名（提示文字用，讓玩家知道「這一類」到底是哪一類）
    const CATEGORY_NAMES = {
        alkane: '烷類', alkene: '烯類', alkyne: '炔類', alcohol: '醇', ether: '醚',
        aldehyde: '醛', ketone: '酮', carboxylic: '羧酸', ester: '酯', amine: '胺',
        aromatic: '芳香烴', halide: '鹵化物', phenol: '酚'
    };
    const LEVEL_ORDER = ['level1','level2','level3','level4','level5','level6','levelShell','level99'];
    function _nextLevelKey(levelKey) {
        const i = LEVEL_ORDER.indexOf(levelKey);
        return (i >= 0 && i < LEVEL_ORDER.length - 1) ? LEVEL_ORDER[i + 1] : null;
    }
    let _autoStoryTimer = null;   // endGame 後自動播劇情的計時器（換頁時要清掉）
    const DESKTOP_DUEL_QUERY = '(min-width: 900px) and (pointer: fine)';
    const ANSWER_KEY_BINDINGS = {
        solo: [
            ['KeyA', 'Digit4', 'Numpad4'],
            ['KeyF', 'Digit6', 'Numpad6'],
            ['KeyZ', 'Digit1', 'Numpad1'],
            ['KeyC', 'Digit3', 'Numpad3']
        ],
        duelDesktop: {
            p1: [['KeyA'], ['KeyF'], ['KeyZ'], ['KeyC']],
            p2: [['Digit4', 'Numpad4'], ['Digit6', 'Numpad6'], ['Digit1', 'Numpad1'], ['Digit3', 'Numpad3']]
        }
    };
    const SOLO_KEYS = createKeyIndexMap(ANSWER_KEY_BINDINGS.solo);
    const DUEL_DESKTOP_KEYS = {
        p1: createKeyIndexMap(ANSWER_KEY_BINDINGS.duelDesktop.p1),
        p2: createKeyIndexMap(ANSWER_KEY_BINDINGS.duelDesktop.p2)
    };
    const MENU_SHORTCUTS = {
        Digit1: { mode: 'practice', level: 'level1' },
        Digit2: { mode: 'practice', level: 'level2' },
        Digit3: { mode: 'practice', level: 'level3' },
        Digit4: { mode: 'practice', level: 'level4' },
        Digit5: { mode: 'practice', level: 'level5' },
        Digit6: { mode: 'practice', level: 'level6' },
        Digit7: { mode: 'practice', level: 'levelShell' },
        Digit9: { mode: 'practice', level: 'level99' },
        KeyQ: { mode: 'speed', level: 'level3' },
        KeyW: { mode: 'speed', level: 'level4' },
        KeyE: { mode: 'speed', level: 'level6' },
        KeyU: { mode: 'duel', level: 'level3' },
        KeyI: { mode: 'duel', level: 'level4' },
        KeyO: { mode: 'duel', level: 'level6' }
    };
    const WHY_HINTS = {
        alkane: "只有 C-C 單鍵和 C-H，沒有任何含氧 / 氮 / 鹵的官能基",
        alkene: "含有 C=C 雙鍵",
        alkyne: "含有 C≡C 參鍵",
        alcohol: "-OH 接在飽和（sp3）碳上",
        ether: "C-O-C，氧夾在兩個碳之間（沒有 OH、也沒有 C=O）",
        aldehyde: "-CHO：羰基 C=O 在碳鏈末端，旁邊接一個 H",
        ketone: "羰基 C=O 夾在兩個碳之間",
        carboxylic: "-COOH：同一個碳上同時有 C=O 和 -OH",
        ester: "-COO-：像羧酸但 -OH 被換成 -O-碳（C(=O)-O-C）",
        amine: "含 -NH2 / -NHR / -NR2（氮接碳，沒有羰基）",
        aromatic: "含苯環，且苯環上只接烷基 / 乙烯基等碳氫基（沒有其他官能基）",
        halide: "含 C-X（X = F、Cl、Br、I）",
        phenol: "-OH 直接接在苯環的碳上（若接 -CH2- 之類則算醇，不是酚）"
    };
    const CAT_CATEGORY_MAP = {
        CAT_ALKANE: 'alkane',
        CAT_ALKENE: 'alkene',
        CAT_ALKYNE: 'alkyne',
        CAT_ALCOHOL: 'alcohol',
        CAT_ALDEHYDE: 'aldehyde',
        CAT_KETONE: 'ketone',
        CAT_CARBOXYLIC: 'carboxylic',
        CAT_ESTER: 'ester',
        CAT_ETHER: 'ether',
        CAT_AMINE: 'amine',
        CAT_AROMATIC: 'aromatic',
        CAT_HALIDE: 'halide',
        CAT_PHENOL: 'phenol'
    };
    const COACH_LINES = {
        intro: "先看結構裡最醒目的官能基，再選分類。需要提示就按下方的「💡 提示」。",
        correct: ["答對了，這頂帽子認同你的判斷。", "很好，官能基抓得準。", "分類成功，下一個結構。"],
        streak: "連錯幾題時，先找氧、氮、鹵素，再看有沒有 C=O 或苯環。",
        // 開啟提示時，分類帽給的「怎麼看」判斷流程
        guide: "判斷順序：① 有苯環嗎？②有 C=O 嗎—接 H 是醛、夾在中間是酮、配 -OH 是羧酸、配 -O-碳 是酯。③ 有 -OH 嗎—接苯環是酚、接飽和碳是醇；C-O-C 是醚。④ 有 N 是胺、有 F/Cl/Br/I 是鹵化物、有 C=C 是烯、C≡C 是炔；都沒有就是烷。"
    };
    let isDuelDesktop = false;
    let _devQuickWin = false;      // 開發測試捷徑；預設關閉，避免覆蓋正式規格
    const DEV_WIN_AFTER = 2;       // 測試模式：答對幾題就過關
    let _muted = false;
    let practiceWrongStreak = 0;
    // Practice round counters; pass/clear is based on answering the full level bank.
    let practiceRoundTotal = 0;
    let practiceRoundCorrect = 0;
    let practiceCoachEl = null;
    let practiceCoachBubbleEl = null;
    let practiceWhyEl = null;
    let practiceHintBtn = null;
    let practiceTutBtn = null;
    let practiceButtonRow = null;

    const DUEL_WIN_TARGET = (typeof ModeRules !== 'undefined' && ModeRules.get('duel'))
        ? ModeRules.get('duel').winCorrectCount
        : 5;
    const DUEL_READING_MS = 1500;
    const DUEL_LOCK_MS = 2000;

    // Zoom duel mode constants
    const ZOOM_DURATION_MS = 12000;
    const ZOOM_PENALTY_MS = 800;

    // Module variables for zoom mode
    let duelVariant = 'standard';    // 'standard' | 'zoom'
    let _pendingVariant = 'standard';

    // Buzz-in state machine
    const _buzz = { phase: 'idle', buzzedBy: null, penaltyPlayer: null, failedPlayers: new Set(), effectComplete: false };

    // Zoom animation time tracking
    let _zoomStartTime = 0;
    let _zoomPausedAt = 0;
    let _zoomElapsedMs = 0;
    let _zoomTimeoutId = null;
    let _penaltyTimerId = null;
    let _buzzCountdownId = null;
    const BUZZ_ANSWER_SECONDS = (typeof ModeRules !== 'undefined' && ModeRules.get('duel'))
        ? ModeRules.get('duel').answerOwnershipSeconds
        : 5;
    let _buzzCountdownRemaining = BUZZ_ANSWER_SECONDS;
    const BUZZ_TIMEOUT_MS = BUZZ_ANSWER_SECONDS * 1000;

    // Confusable categories for generating wrong-answer options
    const CONFUSABLE_CATS = {
        aldehyde:   ['ketone','carboxylic','ester'],
        ketone:     ['aldehyde','ester','alcohol'],
        carboxylic: ['ester','aldehyde','alcohol'],
        ester:      ['carboxylic','ether','ketone'],
        alcohol:    ['ether','phenol','carboxylic'],
        ether:      ['alcohol','ester','alkane'],
        aromatic:   ['phenol','halide','alkene'],
        phenol:     ['alcohol','aromatic','ether'],
        amine:      ['halide','alcohol','alkane'],
        halide:     ['alkane','amine','aromatic'],
        alkane:     ['alkene','ether','alkyne'],
        alkene:     ['alkyne','alkane','aromatic'],
        alkyne:     ['alkene','alkane','amine']
    };

    const readingTimers = { p1: null, p2: null };
    // Per-player question state (used in duel mode)
    const duelQ = {
        p1: { queue: [], queueLevel: null, question: null, correctKey: '' },
        p2: { queue: [], queueLevel: null, question: null, correctKey: '' }
    };
    // 對決：兩位玩家共用的題目順序（→ 兩邊第 N 題是同一分子，公平；選項順序仍各自獨立隨機，防作弊）
    let _duelOrder = null;
    let _duelOrderLevel = null;

    let currentQuestion = null;
    let correctAnswerKey = "";

    // DOM 快取
    const UI = {
        menu: document.getElementById('menu-container'),
        game: document.getElementById('game-container'),
        infoBar: document.getElementById('info-bar'),
        arenaBar: document.getElementById('arena-bar'),
        modeTitle: document.getElementById('mode-title'),
        levelTitle: document.getElementById('level-title'),
        timeBar: document.getElementById('time-bar'),
        
        sharedArea: document.getElementById('shared-question-area'),

        qContainerP1: document.getElementById('q-container-p1'),
        qContentP1: document.getElementById('q-p1'),
        qContentP2: document.getElementById('q-p2'),
        qContentShared: document.getElementById('q-shared'),

        optsP1: document.getElementById('opts-p1'),
        optsP2: document.getElementById('opts-p2'),

        hpP1: document.getElementById('hp-p1'),
        scoreP1: document.getElementById('score-p1'),
        hpP1Info: document.getElementById('hp-p1-info'),
        scoreP1Info: document.getElementById('score-p1-info'),
        warnP1: document.getElementById('warn-p1'),
        // 注意：這裡改用動態生成的元素來做 Combo 攻擊，不再只是靜態顯示

        hpP2: document.getElementById('hp-p2'),
        scoreP2: document.getElementById('score-p2'),
        warnP2: document.getElementById('warn-p2'),

        resultModal: document.getElementById('result-modal'),
        resultTitle: document.getElementById('result-title'),
        resultMsg: document.getElementById('result-msg'),
        resultStats: document.getElementById('result-stats'),
        btnRestart: document.getElementById('btn-restart'),
        btnNextLevel: document.getElementById('btn-next-level'),
        btnMenu: document.getElementById('btn-menu'),
        btnBack: document.getElementById('btn-back'),
        btnBackDuel: document.getElementById('btn-back-duel'),
        btnShowRef: document.getElementById('btn-show-ref'),
        refModal: document.getElementById('ref-modal'),
        btnCloseRef: document.getElementById('btn-close-ref'),
        storyModal: document.getElementById('story-modal'),
        storySpeakerEmoji: document.getElementById('story-speaker-emoji'),
        storySpeakerName: document.getElementById('story-speaker-name'),
        storyText: document.getElementById('story-text'),
        storyDots: document.getElementById('story-dots'),
        storyModalContent: document.querySelector('#story-modal .modal-content'),
        btnStoryNext: document.getElementById('btn-story-next'),
        btnStorySkip: document.getElementById('btn-story-skip'),
        btnShowStory: document.getElementById('btn-show-story'),
        btnShowTutorial: document.getElementById('btn-show-tutorial'),
        wizardBadgeP1: document.getElementById('wizard-p1'),
        wizardBadgeP2: document.getElementById('wizard-p2'),
        wizardPicker: document.getElementById('wizard-picker'),
        pickerTitle: document.getElementById('picker-title'),
        pickerSubtitle: document.getElementById('picker-subtitle'),
        wizardGrid: document.getElementById('wizard-grid'),
        btnPickerConfirm: document.getElementById('btn-picker-confirm'),
        btnPickerCancel: document.getElementById('btn-picker-cancel'),
        codexModal: document.getElementById('codex-modal'),
        btnOpenCodex: document.getElementById('btn-open-codex'),
        btnCloseCodex: document.getElementById('btn-close-codex'),
        codexSummary: document.getElementById('codex-summary'),
        codexContent: document.querySelector('#codex-modal .codex-content'),
        codexTabs: document.querySelectorAll('#codex-modal [data-codex-tab]'),
        codexPanels: document.querySelectorAll('#codex-modal [data-codex-panel]'),
        codexPanelLevels: document.getElementById('codex-panel-levels'),
        codexPanelBadges: document.getElementById('codex-panel-badges'),
        codexPanelMolecules: document.getElementById('codex-panel-molecules'),
        codexPanelStory: document.getElementById('codex-panel-story'),
        tutorialModal: document.getElementById('tutorial-modal'),
        btnTutorial: document.getElementById('btn-tutorial'),
        tutorialIcon: document.getElementById('tutorial-icon'),
        tutorialHat: document.getElementById('tutorial-hat'),
        tutorialTitle: document.getElementById('tutorial-title'),
        tutorialText: document.getElementById('tutorial-text'),
        tutorialDots: document.getElementById('tutorial-dots'),
        tutorialModalTitle: document.getElementById('tutorial-modal-title'),
        btnTutorialNext: document.getElementById('btn-tutorial-next'),
        btnTutorialPrev: document.getElementById('btn-tutorial-prev'),
        btnTutorialSkip: document.getElementById('btn-tutorial-skip'),
        settingsModal: document.getElementById('settings-modal'),
        btnOpenSettings: document.getElementById('btn-open-settings'),
        btnCloseSettings: document.getElementById('btn-close-settings'),
        btnSettingsMute: document.getElementById('btn-settings-mute'),
        btnSettingsExport: document.getElementById('btn-settings-export'),
        btnSettingsImport: document.getElementById('btn-settings-import'),
        btnSettingsReset: document.getElementById('btn-settings-reset'),
        btnSettingsTutorial: document.getElementById('btn-settings-tutorial'),
        importFile: document.getElementById('import-file')
    };

    function getPlayerUI(player) {
        const isP1 = player === 'p1';
        return {
            options: isP1 ? UI.optsP1 : UI.optsP2,
            warn: isP1 ? UI.warnP1 : UI.warnP2,
            hp: isP1 ? UI.hpP1 : UI.hpP2,
            score: isP1 ? UI.scoreP1 : UI.scoreP2,
            hpInfo: isP1 ? UI.hpP1Info : null,
            scoreInfo: isP1 ? UI.scoreP1Info : null,
            questionContent: isP1 ? UI.qContentP1 : UI.qContentP2
        };
    }

    // 音效 Context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // --- 角色選擇彈窗 ---
    let _pickerPendingMode = null;
    let _pickerPendingLevel = null;
    let _pickerStep = null; // 'solo' | 'p1' | 'p2' | 'change'
    let _pickerSelectedIdx = -1; // index in WIZARD_PRESETS, -1 = custom
    let _p1WizardPersisted = false; // P1 魔法師是否已選過（跨關卡記憶）
    let _pickerKeyFocusIdx = -1;   // 鍵盤焦點在第幾張卡片（-1 = 無）

    function buildWizardGrid() {
        UI.wizardGrid.innerHTML = '';
        _pickerKeyFocusIdx = -1;
        WIZARD_PRESETS.forEach((w, i) => {
            const card = document.createElement('div');
            card.className = 'wizard-card';
            card.dataset.idx = i;
            card.innerHTML = `<div class="wizard-card-avatar"><img src="${w.avatar}" alt="${w.name}" loading="lazy"></div>
                              <div class="wizard-card-name">${w.name}</div>
                              <div class="wizard-card-title">${w.title}</div>`;
            card.addEventListener('click', () => {
                document.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('selected', 'keyboard-focus'));
                card.classList.add('selected');
                _pickerSelectedIdx = i;
                _pickerKeyFocusIdx = i;
                UI.btnPickerConfirm.disabled = false;
            });
            UI.wizardGrid.appendChild(card);
        });
    }

    function _pickerSetKeyFocus(newIdx) {
        const cards = UI.wizardGrid.querySelectorAll('.wizard-card');
        if (_pickerKeyFocusIdx >= 0 && _pickerKeyFocusIdx < cards.length) {
            cards[_pickerKeyFocusIdx].classList.remove('keyboard-focus');
        }
        _pickerKeyFocusIdx = Math.max(0, Math.min(newIdx, cards.length - 1));
        if (_pickerKeyFocusIdx >= 0 && _pickerKeyFocusIdx < cards.length) {
            cards[_pickerKeyFocusIdx].classList.add('keyboard-focus');
            cards[_pickerKeyFocusIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    function showWizardPicker(mode, level) {
        _pickerPendingMode = mode;
        _pickerPendingLevel = level;
        _pickerSelectedIdx = -1;

        // 更換魔法師模式（首頁按鈕）
        if (mode === '_change') {
            _pickerStep = 'change';
            buildWizardGrid();
            UI.btnPickerConfirm.disabled = true;
            UI.pickerTitle.textContent = '更換你的魔法師';
            UI.pickerSubtitle.textContent = `目前：${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}`;
            UI.menu.classList.add('hidden');
            UI.wizardPicker.classList.remove('hidden');
            return;
        }

        // 非對決模式：若已選過魔法師就直接開始
        if (mode !== 'duel' && _p1WizardPersisted) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            startGame(mode, level);
            return;
        }

        buildWizardGrid();
        UI.btnPickerConfirm.disabled = true;

        if (mode === 'duel') {
            if (_p1WizardPersisted) {
                // P1 已記住，只選 P2
                _pickerStep = 'p2';
                UI.pickerTitle.textContent = '⚔️ 玩家二，選擇你的魔法師';
                UI.pickerSubtitle.textContent = `P2 · 右側 / 下側玩家　（P1：${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}）`;
            } else {
                _pickerStep = 'p1';
                UI.pickerTitle.textContent = '⚔️ 玩家一，選擇你的魔法師';
                UI.pickerSubtitle.textContent = 'P1 · 左側 / 上側玩家';
            }
        } else {
            _pickerStep = 'solo';
            UI.pickerTitle.textContent = '選擇你的魔法師';
            UI.pickerSubtitle.textContent = '選擇一個身份';
        }

        UI.menu.classList.add('hidden');
        UI.wizardPicker.classList.remove('hidden');
    }

    function _updateWizardStatusBar() {
        const bar = document.getElementById('wizard-status-bar');
        const label = document.getElementById('wizard-status-label');
        if (!bar || !label) return;
        if (_p1WizardPersisted) {
            label.textContent = `${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}`;
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }

    function _applyPickerChoice(player) {
        const w = WIZARD_PRESETS[_pickerSelectedIdx];
        wizardPersonas[player] = { emoji: w.emoji, name: w.name };
    }

    function initPickerListeners() {

        UI.btnPickerConfirm.addEventListener('click', () => {
            if (_pickerStep === 'solo') {
                _applyPickerChoice('p1');
                wizardPersonas.p2 = { emoji: '🧙', name: '玩家二' };
                _p1WizardPersisted = true;
                _updateWizardStatusBar();
                UI.wizardPicker.classList.add('hidden');
                if (audioCtx.state === 'suspended') audioCtx.resume();
                startGame(_pickerPendingMode, _pickerPendingLevel);
            } else if (_pickerStep === 'p1') {
                _applyPickerChoice('p1');
                _p1WizardPersisted = true;
                _updateWizardStatusBar();
                _pickerStep = 'p2';
                _pickerSelectedIdx = -1;
                _pickerKeyFocusIdx = -1;
                buildWizardGrid();
                UI.btnPickerConfirm.disabled = true;
                UI.pickerTitle.textContent = '⚔️ 玩家二，選擇你的魔法師';
                UI.pickerSubtitle.textContent = `P2 · 右側 / 下側玩家　（P1 已選：${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}）`;
            } else if (_pickerStep === 'p2') {
                _applyPickerChoice('p2');
                UI.wizardPicker.classList.add('hidden');
                if (audioCtx.state === 'suspended') audioCtx.resume();
                startGame(_pickerPendingMode, _pickerPendingLevel);
            } else if (_pickerStep === 'change') {
                _applyPickerChoice('p1');
                _p1WizardPersisted = true;
                _updateWizardStatusBar();
                UI.wizardPicker.classList.add('hidden');
                UI.menu.classList.remove('hidden');
                focusFirstAvailableControl(UI.menu);
            }
        });

        UI.btnPickerCancel.addEventListener('click', () => {
            UI.wizardPicker.classList.add('hidden');
            UI.menu.classList.remove('hidden');
            focusFirstAvailableControl(UI.menu);
        });
    }

    // --- 魔法師彈窗鍵盤導航 ---
    function handlePickerKeydown(e) {
        const cards = UI.wizardGrid.querySelectorAll('.wizard-card');
        const total = cards.length;

        switch (e.code) {
            case 'Escape':
                e.preventDefault();
                UI.btnPickerCancel.click();
                break;
            case 'Enter':
                e.preventDefault();
                if (_pickerKeyFocusIdx >= 0 && _pickerKeyFocusIdx < total) {
                    cards[_pickerKeyFocusIdx].click();
                }
                if (!UI.btnPickerConfirm.disabled) UI.btnPickerConfirm.click();
                break;
            case 'Space':
                e.preventDefault();
                if (_pickerKeyFocusIdx >= 0 && _pickerKeyFocusIdx < total) {
                    cards[_pickerKeyFocusIdx].click();
                }
                break;
            case 'ArrowRight':
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowDown': {
                e.preventDefault();
                if (total === 0) break;
                if (_pickerKeyFocusIdx < 0) { _pickerSetKeyFocus(0); break; }
                // 計算每列格數（從第一排有幾個同 offsetTop）
                const firstTop = cards[0].offsetTop;
                let cols = 0;
                for (let c = 0; c < total; c++) {
                    if (cards[c].offsetTop === firstTop) cols++; else break;
                }
                if (cols < 1) cols = 1;
                let idx = _pickerKeyFocusIdx;
                if (e.code === 'ArrowRight') idx = (idx + 1) % total;
                else if (e.code === 'ArrowLeft') idx = (idx - 1 + total) % total;
                else if (e.code === 'ArrowDown') idx = Math.min(idx + cols, total - 1);
                else if (e.code === 'ArrowUp') idx = Math.max(idx - cols, 0);
                _pickerSetKeyFocus(idx);
                break;
            }
        }
    }

    // --- 初始化 ---
    // --- 分類帽角色（CSS 五官 + 表情）---
    const HAT_EXPRS = ['neutral', 'happy', 'sad', 'surprised', 'thinking', 'wink'];
    const HAT_INNER =
        '<div class="hat-img"></div>' +
        '<div class="brow left"></div><div class="brow right"></div>' +
        '<div class="eye left"><div class="pupil"></div></div>' +
        '<div class="eye right"><div class="pupil"></div></div>' +
        '<div class="mouth"></div>';
    let _hatExprTimer = null;
    let _hatMouseBound = false;
    function buildHatChar(el) { if (el && !el.querySelector('.hat-img')) el.innerHTML = HAT_INNER; }
    function initHatChars() {
        document.querySelectorAll('.hat-char').forEach(buildHatChar);
        if (!_hatMouseBound) {
            _hatMouseBound = true;
            document.addEventListener('mousemove', (ev) => {
                // 瞳孔淡淡地追滑鼠（遊戲、新手導覽、劇情都看）
                document.querySelectorAll('.hat-char:not(.surprised):not(.sleepy) .eye').forEach(eye => {
                    const p = eye.querySelector('.pupil');
                    if (!p) return;
                    const r = eye.getBoundingClientRect();
                    if (!r.width) return;
                    const ang = Math.atan2(ev.clientY - (r.top + r.height/2), ev.clientX - (r.left + r.width/2));
                    const m = Math.max(2, r.width * 0.16);
                    p.style.transform = `translate(calc(-50% + ${Math.cos(ang)*m}px), calc(-50% + ${Math.sin(ang)*m}px))`;
                });
            });
        }
    }
    // 設定所有分類帽表情；ms > 0 時自動回到 neutral
    function setHatExpr(expr, ms) {
        if (_hatExprTimer) { clearTimeout(_hatExprTimer); _hatExprTimer = null; }
        document.querySelectorAll('.hat-char').forEach(h => {
            h.classList.remove(...HAT_EXPRS);
            h.classList.add(HAT_EXPRS.includes(expr) ? expr : 'neutral');
        });
        if (ms && ms > 0) _hatExprTimer = setTimeout(() => setHatExpr('neutral'), ms);
    }

    function init() {
        initHatChars();
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _pendingVariant = btn.dataset.variant || 'standard';
                startGame(btn.dataset.mode, btn.dataset.level);
            });
        });

        const btnChangeWizard = document.getElementById('btn-change-wizard');
        if (btnChangeWizard) {
            btnChangeWizard.classList.add('hidden');
        }

        UI.optsP1.addEventListener('click', e => handleOptionClick(e, 'p1'));
        UI.optsP2.addEventListener('click', e => handleOptionClick(e, 'p2'));
        document.addEventListener('keydown', handleKeyboardInput);
        window.addEventListener('resize', () => {
            if (currentMode === 'duel') setupLayout(currentMode);
        });

        UI.btnBack.addEventListener('click', confirmReturnToMenu);
        if (UI.btnBackDuel) UI.btnBackDuel.addEventListener('click', confirmReturnToMenu);
        UI.btnMenu.addEventListener('click', confirmReturnToMenu);
        UI.btnRestart.addEventListener('click', () => startGame(currentMode, currentLevel));
        if (UI.btnNextLevel) UI.btnNextLevel.addEventListener('click', () => {
            const nextLv = _nextLevelKey(currentLevel);
            if (nextLv) startGame(currentMode, nextLv);
        });
        if (UI.btnOpenCodex) UI.btnOpenCodex.addEventListener('click', openCodex);
        if (UI.btnCloseCodex) UI.btnCloseCodex.addEventListener('click', closeCodex);
        initCodexTabs();
        if (UI.btnOpenSettings) UI.btnOpenSettings.addEventListener('click', openSettings);
        if (UI.btnCloseSettings) UI.btnCloseSettings.addEventListener('click', closeSettings);
        if (UI.btnSettingsMute) UI.btnSettingsMute.addEventListener('click', () => {
            toggleMute();
            _syncSettingsMuteBtn();
        });
        if (UI.btnSettingsExport) UI.btnSettingsExport.addEventListener('click', () => {
            if (typeof Save !== 'undefined') {
                const text = Save.exportText();
                const blob = new Blob([text], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sort-hat-save-${new Date().getTime()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });
        if (UI.btnSettingsImport) UI.btnSettingsImport.addEventListener('click', () => {
            if (UI.importFile) UI.importFile.click();
        });
        if (UI.btnSettingsReset) UI.btnSettingsReset.addEventListener('click', () => {
            if (confirm('確定要清除所有進度？這個操作無法復原。')) {
                if (typeof Save !== 'undefined') Save.reset();
                location.reload();
            }
        });
        if (UI.btnSettingsTutorial) UI.btnSettingsTutorial.addEventListener('click', () => {
            closeSettings();
            showTutorial(true);
        });
        if (UI.btnShowRef) UI.btnShowRef.addEventListener('click', showReference);
        if (UI.btnCloseRef) {
            UI.btnCloseRef.setAttribute('role', 'button');
            UI.btnCloseRef.setAttribute('tabindex', '0');
            UI.btnCloseRef.setAttribute('aria-label', '關閉分類總表');
            UI.btnCloseRef.addEventListener('click', closeReference);
            UI.btnCloseRef.addEventListener('keydown', e => {
                if (e.code === 'Enter' || e.code === 'Space') {
                    e.preventDefault();
                    closeReference();
                }
            });
        }

        initPickerListeners();
        initStoryListeners();
        initTutorialListeners();

        if (UI.btnShowStory) {
            UI.btnShowStory.addEventListener('click', () => {
                if (_autoStoryTimer) { clearTimeout(_autoStoryTimer); _autoStoryTimer = null; }
                UI.resultModal.classList.add('hidden');
                showStory(currentLevel, () => {
                    UI.resultModal.classList.remove('hidden');
                    _focusResultDefault();
                });
            });
        }

        if (UI.btnShowTutorial) {
            UI.btnShowTutorial.addEventListener('click', () => {
                if (_autoStoryTimer) { clearTimeout(_autoStoryTimer); _autoStoryTimer = null; }
                UI.resultModal.classList.add('hidden');
                showLevelTutorial(currentLevel, () => {
                    UI.resultModal.classList.remove('hidden');
                    _focusResultDefault();
                });
            });
        }

        // 靜音按鈕（首頁 + 遊戲中）
        const btnMute = document.getElementById('btn-mute');
        const btnMuteGame = document.getElementById('btn-mute-game');
        [btnMute, btnMuteGame].forEach(btn => {
            if (btn) btn.addEventListener('click', toggleMute);
        });

        // 匯出存檔 → 下載 .json 檔（無法下載時降級為剪貼簿/prompt）
        const btnExport = document.getElementById('btn-export');
        if (btnExport) btnExport.addEventListener('click', () => {
            const text = Save.exportText();
            try {
                const blob = new Blob([text], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `有機分類帽-存檔-${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                showBadgeToast(null, '📤 已下載存檔 JSON');
            } catch(e) {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text)
                        .then(() => showBadgeToast(null, '📋 存檔已複製到剪貼簿'))
                        .catch(() => window.prompt('複製以下存檔：', text));
                } else {
                    window.prompt('複製以下存檔：', text);
                }
            }
        });

        // 匯入存檔（選檔案 或 貼文字）
        const btnImportOpen = document.getElementById('btn-import-open');
        const importModal = document.getElementById('import-modal');
        const btnImportConfirm = document.getElementById('btn-import-confirm');
        const btnImportCancel = document.getElementById('btn-import-cancel');
        const importTextarea = document.getElementById('import-textarea');
        const importFile = document.getElementById('import-file');
        function _doImport(str) {
            const ok = Save.importText((str || '').trim());
            if (ok) {
                importModal.classList.add('hidden');
                updateMenuProgress();
                showBadgeToast(null, '✅ 存檔匯入成功！');
            } else if (importTextarea) {
                importTextarea.style.borderColor = '#e74c3c';
                setTimeout(() => { importTextarea.style.borderColor = ''; }, 1500);
            }
        }
        if (btnImportOpen && importModal) {
            btnImportOpen.addEventListener('click', () => {
                if (importTextarea) importTextarea.value = '';
                if (importFile) importFile.value = '';
                importModal.classList.remove('hidden');
            });
            btnImportCancel.addEventListener('click', () => importModal.classList.add('hidden'));
            btnImportConfirm.addEventListener('click', () => _doImport(importTextarea ? importTextarea.value : ''));
            if (importFile) importFile.addEventListener('change', () => {
                const f = importFile.files && importFile.files[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => _doImport(String(reader.result || ''));
                reader.onerror = () => showBadgeToast(null, '⚠️ 讀取檔案失敗');
                reader.readAsText(f);
            });
        }

        // 重置進度
        const btnReset = document.getElementById('btn-reset-save');
        if (btnReset) btnReset.addEventListener('click', () => {
            if (confirm('確定要重置所有進度嗎？（此操作無法復原）')) {
                Save.reset();
                updateMenuProgress();
                showBadgeToast(null, '🗑️ 進度已重置');
            }
        });

        preloadImages();
        applyKeyboardHints();
        updateMenuProgress();
        focusFirstAvailableControl(UI.menu);

        // 第一次進站 → 自動跳新手導覽
        if (typeof Save !== 'undefined' && !Save.isTutorialSeen()) {
            setTimeout(() => showTutorial(false), 400);
        }
    }

    function preloadImages() {
        if(typeof QuestionSets === 'undefined') return;
        Object.values(QuestionSets).forEach(list => {
            list.forEach(q => {
                if(q.qType === 'img') { const img = new Image(); img.src = q.qContent; }
            });
        });
    }

    // --- 遊戲流程 ---
    function startGame(mode, level) {
        if (_autoStoryTimer) { clearTimeout(_autoStoryTimer); _autoStoryTimer = null; }
        // 第一次進這一關 → 先放分類帽的「本關教學」，看完再真正開始
        if (typeof LevelTutorials !== 'undefined' && LevelTutorials[level]
            && typeof Save !== 'undefined' && !Save.isLevelTutorialSeen(level)) {
            showLevelTutorial(level, () => _doStartGame(mode, level));
            return;
        }
        _doStartGame(mode, level);
    }

    function _doStartGame(mode, level) {
        currentMode = mode;
        currentLevel = level;
        duelVariant = _pendingVariant;
        gameActive = true;
        setGlobalInputLocked(false);
        timeLeft = (mode === 'practice') ? 0 : MAX_TIME;
        cleanupQuestionTransientState();

        // 重置玩家數據與殘留 UI 狀態
        ['p1', 'p2'].forEach(p => {
            const playerUI = getPlayerUI(p);
            players[p] = { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false, correctCount: 0, totalAsked: 0 };
            updateStats(p);
            document.querySelectorAll(`.combo-projectile.${p}-atk`).forEach(el => el.remove());
            if (lockTimers[p]) { clearTimeout(lockTimers[p]); lockTimers[p] = null; }
            if (readingTimers[p]) { clearTimeout(readingTimers[p]); readingTimers[p] = null; }
            duelQ[p] = { queue: [], queueLevel: null, question: null, correctKey: '' };
            const warnEl = playerUI.warn;
            warnEl.classList.add('hidden');
            warnEl.textContent = '魔力告急!';
            const optsEl = playerUI.options;
            optsEl.classList.remove('locked-area');
        });
        // 更新玩家名稱標籤
        if (UI.wizardBadgeP1) UI.wizardBadgeP1.textContent = `${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}`;
        if (UI.wizardBadgeP2) UI.wizardBadgeP2.textContent = `${wizardPersonas.p2.emoji} ${wizardPersonas.p2.name}`;
        const avatarP1 = document.getElementById('wizard-avatar-p1');
        if (avatarP1) avatarP1.textContent = wizardPersonas.p1.emoji;

        // Reset HP text label based on mode
        if (mode === 'duel') {
            document.querySelectorAll('.hp-text').forEach(el => el.textContent = `進度 0/${DUEL_WIN_TARGET}`);
        } else {
            document.querySelectorAll('.hp-text').forEach(el => el.textContent = '魔法成功率');
        }
        UI.timeBar.classList.remove('time-running-out');
        // 強制重洗題目佇列
        questionQueue = [];
        questionQueueLevel = null;
        _duelOrder = null;
        _duelOrderLevel = null;
        currentQuestion = null;
        practiceWrongStreak = 0;
        practiceRoundTotal = 0;
        practiceRoundCorrect = 0;
        clearPracticeFeedback();

        UI.menu.classList.add('hidden');
        UI.resultModal.classList.add('hidden');
        UI.game.classList.remove('hidden');
        UI.modeTitle.textContent = getModeName(mode);
        UI.levelTitle.textContent = (LEVEL_INFO[level] && LEVEL_INFO[level].titleShort) ? LEVEL_INFO[level].titleShort : level.toUpperCase();

        document.body.classList.remove('duel-zoom');
        if (mode === 'duel' && duelVariant === 'zoom') {
            document.body.classList.add('duel-zoom');
        }

        setupLayout(mode);
        setupPracticeFeedback(mode);
        setHatExpr('neutral');

        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);
        UI.timeBar.style.width = '100%';

        if (mode === 'practice' || mode === 'speed') {
            gameActive = true;
            if (mode === 'speed') timerInterval = setInterval(gameLoop, 100);
            nextQuestion();
        } else {
            // duel：黑幕短暫遮住，同時揭開題目，無倒數數字
            document.body.classList.add('countdown-active');
            setTimeout(() => {
                document.body.classList.remove('countdown-active');
                gameActive = true;
                timerInterval = setInterval(gameLoop, 100);
                nextQuestion();
            }, 800);
        }
    }

    function setupLayout(mode) {
        document.body.classList.remove('duel', 'duel-mode', 'duel-desktop', 'duel-mobile');
        isDuelDesktop = false;
        UI.sharedArea.classList.add('hidden');
        UI.optsP2.classList.add('hidden');
        UI.qContainerP1.classList.remove('hidden');
        UI.infoBar.classList.remove('hidden');
        if (UI.arenaBar) UI.arenaBar.classList.add('hidden');

        if (mode === 'duel') {
            document.body.classList.add('duel', 'duel-mode');
            isDuelDesktop = window.matchMedia(DESKTOP_DUEL_QUERY).matches;
            document.body.classList.add(isDuelDesktop ? 'duel-desktop' : 'duel-mobile');
            UI.infoBar.classList.add('hidden');
            if (UI.arenaBar) UI.arenaBar.classList.remove('hidden');
            UI.qContainerP1.classList.add('hidden');   // Duel：單人題框隱藏，改用 #shared-question-area
            UI.sharedArea.classList.remove('hidden');
            UI.optsP2.classList.remove('hidden');
            _arenaUpdateWizards();
        }
    }

    let _practiceHintOn = false;   // 自我修煉的「提示模式」（預設關）

    function setupPracticeFeedback(mode) {
        ensurePracticeFeedbackUI();
        _practiceHintOn = false;
        _updatePracticeHintBtn();
        if (practiceHintBtn) practiceHintBtn.classList.toggle('hidden', mode !== 'practice');
        if (practiceTutBtn) {
            const hasTut = (typeof LevelTutorials !== 'undefined') && !!LevelTutorials[currentLevel];
            practiceTutBtn.classList.toggle('hidden', mode !== 'practice' || !hasTut);
        }
        if (mode === 'practice') {
            setPracticeCoachText(COACH_LINES.intro);
            if (practiceWhyEl) { practiceWhyEl.textContent = ''; practiceWhyEl.classList.add('hidden'); }
        } else if (mode === 'speed') {
            setPracticeCoachText('⚡ 加油！');
        } else {
            if (practiceCoachBubbleEl) practiceCoachBubbleEl.classList.add('hidden');
            if (practiceWhyEl) practiceWhyEl.classList.add('hidden');
        }
    }

    function ensurePracticeFeedbackUI() {
        if (!practiceCoachBubbleEl) {
            practiceCoachBubbleEl = document.getElementById('practice-coach-bubble');
        }
        if (!practiceButtonRow) {
            practiceButtonRow = document.createElement('div');
            practiceButtonRow.className = 'practice-button-row';
            UI.qContainerP1.insertAdjacentElement('afterend', practiceButtonRow);
        }
        if (!practiceHintBtn) {
            practiceHintBtn = document.createElement('button');
            practiceHintBtn.id = 'practice-hint-btn';
            practiceHintBtn.className = 'btn magic-btn practice-hint-btn hidden';
            practiceHintBtn.type = 'button';
            practiceHintBtn.addEventListener('click', togglePracticeHint);
            practiceButtonRow.appendChild(practiceHintBtn);
            addButtonHint(practiceHintBtn, 'H');
        }
        if (!practiceTutBtn) {
            practiceTutBtn = document.createElement('button');
            practiceTutBtn.id = 'practice-tut-btn';
            practiceTutBtn.className = 'btn magic-btn practice-hint-btn hidden';
            practiceTutBtn.type = 'button';
            setBtnText(practiceTutBtn, '📖 再次教學');
            practiceTutBtn.addEventListener('click', () => {
                if (typeof LevelTutorials !== 'undefined' && LevelTutorials[currentLevel])
                    showLevelTutorial(currentLevel, null);
            });
            practiceButtonRow.appendChild(practiceTutBtn);
        }
        if (!practiceWhyEl) {
            practiceWhyEl = document.createElement('div');
            practiceWhyEl.id = 'practice-why-hint';
            practiceWhyEl.className = 'practice-why-hint hidden';
            practiceButtonRow.insertAdjacentElement('afterend', practiceWhyEl);
        }
    }

    function _updatePracticeHintBtn() {
        if (!practiceHintBtn) return;
        setBtnText(practiceHintBtn, _practiceHintOn ? '💡 提示模式：開（點此關閉）' : '💡 需要提示？');
        practiceHintBtn.classList.toggle('hint-on', _practiceHintOn);
    }

    function togglePracticeHint() {
        if (currentMode !== 'practice') return;
        _practiceHintOn = !_practiceHintOn;
        _updatePracticeHintBtn();
        if (_practiceHintOn) {
            setPracticeCoachText(COACH_LINES.guide);
            // 若這題已經答錯過，順手把這題的詳細說明補上
            if (practiceWrongStreak > 0) showPracticeWrongHint(true);
        } else {
            if (practiceWhyEl) { practiceWhyEl.textContent = ''; practiceWhyEl.classList.add('hidden'); }
            setPracticeCoachText(COACH_LINES.intro);
        }
    }

    function setPracticeCoachText(text) {
        ensurePracticeFeedbackUI();
        if (!practiceCoachBubbleEl) return;
        practiceCoachBubbleEl.textContent = text;
        practiceCoachBubbleEl.classList.toggle('hidden', !text);
    }

    function clearPracticeFeedback() {
        if (practiceWhyEl) {
            practiceWhyEl.textContent = '';
            practiceWhyEl.classList.add('hidden');
        }
    }

    // --- 靜音 ---
    function toggleMute() {
        _muted = !_muted;
        document.body.classList.toggle('muted', _muted);
        const btnMute = document.getElementById('btn-mute');
        const btnMuteGame = document.getElementById('btn-mute-game');
        if (btnMute) {
            btnMute.textContent = '音效';
            btnMute.dataset.icon = _muted ? 'sound-off' : 'sound-on';
        }
        if (btnMuteGame) {
            btnMuteGame.dataset.icon = _muted ? 'sound-off' : 'sound-on';
        }
    }

    // --- 進度面板 ---
    function _totalMoleculeCount() {
        if (typeof QuestionSets === 'undefined') return 0;
        const keys = new Set();
        Object.values(QuestionSets).forEach(list => list.forEach(q => keys.add(q.aKey)));
        return keys.size;
    }

    function updateMenuProgress() {
        if (typeof Save === 'undefined') return;
        const d = Save.get();
        const totalMol = _totalMoleculeCount();
        const seenMol  = d.seenMolecules.length;

        const elMol  = document.getElementById('prog-molecules');
        const elCorr = document.getElementById('prog-correct');
        const elBadges = document.getElementById('prog-badges');
        const elLevels = document.getElementById('prog-levels');

        if (elMol)  elMol.textContent  = `${seenMol} / ${totalMol}`;
        if (elCorr) elCorr.textContent = d.totalCorrect;

        // 關卡通過指示
        if (elLevels) {
            const LEVELS = ['level1','level2','level3','level4','level5','level6'];
            elLevels.innerHTML = LEVELS.map(lv => {
                const cleared = Save.isLevelCleared(lv);
                return `<span class="prog-level-chip${cleared ? ' cleared' : ''}">${lv.replace('level','Lv.')}</span>`;
            }).join('');
        }

        // 勳章列表
        if (elBadges) {
            elBadges.innerHTML = Save.allBadgeDefs().map(b => {
                const unlocked = d.badges.includes(b.id);
                return `<span class="prog-badge${unlocked ? ' unlocked' : ''}" title="${b.label}（${b.needCorrect}題）">${b.emoji}</span>`;
            }).join('');
        }
    }

    // --- 勳章 Toast ---
    let _badgeToastTimer = null;
    function showBadgeToast(badgeId, customMsg) {
        const el = document.getElementById('badge-toast');
        if (!el) return;
        let msg = customMsg;
        if (!msg && badgeId && typeof Save !== 'undefined') {
            const badge = Save.allBadgeDefs().find(b => b.id === badgeId);
            if (badge) msg = `🎉 勳章解鎖！${badge.emoji} ${badge.label}`;
        }
        if (!msg) return;
        el.textContent = msg;
        el.classList.remove('hidden');
        void el.offsetWidth;
        el.classList.add('show');
        if (_badgeToastTimer) clearTimeout(_badgeToastTimer);
        _badgeToastTimer = setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.classList.add('hidden'), 350);
        }, 2800);
    }

    // --- 競速 +時間浮字 ---
    function showTimeBonus(bonus, referenceEl) {
        const pop = document.createElement('div');
        pop.className = 'time-bonus-pop';
        pop.textContent = `${bonus > 0 ? '+' : ''}${bonus}s`;
        // 定位在答題區中央上方
        const rect = referenceEl
            ? referenceEl.getBoundingClientRect()
            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        pop.style.left = `${rect.left + rect.width / 2}px`;
        pop.style.top  = `${rect.top}px`;
        pop.style.transform = 'translateX(-50%)';
        document.body.appendChild(pop);
        setTimeout(() => pop.remove(), 950);
    }

    function showMenu() {
        gameActive = false;
        setGlobalInputLocked(false);
        clearInterval(timerInterval);
        clearZoomState();
        cleanupQuestionTransientState();
        if (_autoStoryTimer) { clearTimeout(_autoStoryTimer); _autoStoryTimer = null; }
        ['p1', 'p2'].forEach(p => {
            if (readingTimers[p]) { clearTimeout(readingTimers[p]); readingTimers[p] = null; }
        });
        clearPracticeFeedback();
        if (practiceCoachBubbleEl) practiceCoachBubbleEl.classList.add('hidden');
        UI.game.classList.add('hidden');
        UI.resultModal.classList.add('hidden');
        if (UI.storyModal) UI.storyModal.classList.add('hidden');
        if (UI.codexModal) UI.codexModal.classList.add('hidden');
        if (UI.wizardPicker) UI.wizardPicker.classList.add('hidden');
        UI.menu.classList.remove('hidden');
        document.body.classList.remove('duel', 'duel-mode', 'duel-desktop', 'duel-mobile', 'duel-zoom', 'countdown-active');
        if (UI.arenaBar) UI.arenaBar.classList.add('hidden');
        UI.infoBar.classList.remove('hidden');
        updateMenuProgress();
        focusFirstAvailableControl(UI.menu);
    }

    function confirmReturnToMenu() {
        if (!isVisible(UI.game) && !isVisible(UI.resultModal)) {
            showMenu();
            return;
        }
        if (!window.confirm('確定返回大廳？目前這題會中斷。')) return;
        showMenu();
    }

    function showReference() {
        if (UI.refModal) UI.refModal.classList.remove('hidden');
        if (UI.btnCloseRef) UI.btnCloseRef.focus();
    }

    function closeReference() {
        if (UI.refModal) UI.refModal.classList.add('hidden');
        if (UI.btnShowRef && !UI.btnShowRef.classList.contains('hidden')) UI.btnShowRef.focus();
    }

    // --- 圖鑑 (Codex) ---
    function openCodex() {
        renderCodex();
        switchCodexTab('levels');
        if (UI.codexModal) UI.codexModal.classList.remove('hidden');
        const firstTab = UI.codexModal ? UI.codexModal.querySelector('[data-codex-tab="levels"]') : null;
        if (firstTab) try { firstTab.focus(); } catch(e) {}
    }
    function closeCodex() {
        if (UI.codexModal) UI.codexModal.classList.add('hidden');
        if (UI.btnOpenCodex) try { UI.btnOpenCodex.focus(); } catch(e) {}
    }

    // --- 設定 (Settings) ---
    function openSettings() {
        initSettingsTabs();
        switchSettingsTab('options');
        _syncSettingsMuteBtn();
        if (UI.settingsModal) UI.settingsModal.classList.remove('hidden');
        if (UI.btnCloseSettings) try { UI.btnCloseSettings.focus(); } catch(e) {}
    }
    function closeSettings() {
        if (UI.settingsModal) UI.settingsModal.classList.add('hidden');
        if (UI.btnOpenSettings) try { UI.btnOpenSettings.focus(); } catch(e) {}
    }
    function _syncSettingsMuteBtn() {
        if (!UI.btnSettingsMute) return;
        UI.btnSettingsMute.dataset.icon = _muted ? 'sound-off' : 'sound-on';
        UI.btnSettingsMute.textContent = '音效';
    }

    function initSettingsTabs() {
        if (!UI.settingsModal) return;
        const settingsTabs = UI.settingsModal.querySelectorAll('[data-settings-tab]');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => switchSettingsTab(tab.dataset.settingsTab));
        });
    }

    function switchSettingsTab(tabName) {
        if (!tabName || !UI.settingsModal) return;
        const settingsTabs = UI.settingsModal.querySelectorAll('[data-settings-tab]');
        const settingsPanels = UI.settingsModal.querySelectorAll('[data-settings-panel]');
        settingsTabs.forEach(tab => {
            const active = tab.dataset.settingsTab === tabName;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        settingsPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.settingsPanel === tabName);
        });
    }

    function initCodexTabs() {
        if (!UI.codexTabs) return;
        UI.codexTabs.forEach(tab => {
            tab.addEventListener('click', () => switchCodexTab(tab.dataset.codexTab));
        });
    }

    function switchCodexTab(tabName) {
        if (!tabName) return;
        UI.codexTabs.forEach(tab => {
            const active = tab.dataset.codexTab === tabName;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        UI.codexPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.codexPanel === tabName);
        });
        if (UI.codexContent) UI.codexContent.scrollTop = 0;
    }

    function renderCodex() {
        const data = (typeof Save !== 'undefined') ? Save.get() : null;
        const totalMol = _totalMoleculeCount();
        const seenMol = data ? data.seenMolecules.length : 0;
        const clearedCount = (typeof Save !== 'undefined')
            ? LEVEL_ORDER.filter(lv => Save.isLevelCleared(lv)).length
            : 0;
        const storyCount = (typeof Save !== 'undefined')
            ? LEVEL_ORDER.filter(lv => Save.isLevelCleared(lv) && typeof StoryScripts !== 'undefined' && StoryScripts[lv]).length
            : 0;
        const badgeDefs = (typeof Save !== 'undefined') ? Save.allBadgeDefs() : [];
        const badgeCount = data ? data.badges.length : 0;

        if (UI.codexSummary) UI.codexSummary.textContent = `— ${wizardPersonas.p1.name} 的修煉紀錄`;
        _setText('codex-count-levels', `${clearedCount}/${LEVEL_ORDER.length}`);
        _setText('codex-count-badges', `${badgeCount}/${badgeDefs.length}`);
        _setText('codex-count-molecules', `${seenMol}/${totalMol}`);
        _setText('codex-count-story', `${storyCount}/${LEVEL_ORDER.length}`);

        renderCodexLevels();
        renderCodexBadges(badgeDefs, data);
        renderCodexMolecules(data);
        renderCodexStories();
    }

    function _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function _levelShortLabel(lv) {
        if (lv === 'levelShell') return '龜殼';
        if (lv === 'level99') return 'L99';
        return lv.replace('level', 'L');
    }

    function _uniqueQuestionsForLevel(lv) {
        const list = (typeof QuestionSets !== 'undefined') ? QuestionSets[lv] : null;
        if (!list || !list.length) return [];
        const seen = new Set();
        return list.filter(q => {
            if (!q || !q.aKey || seen.has(q.aKey)) return false;
            seen.add(q.aKey);
            return true;
        });
    }

    function renderCodexLevels() {
        if (!UI.codexPanelLevels) return;
        let html = '<div class="codex-level-grid">';
        LEVEL_ORDER.forEach(lv => {
            const info = LEVEL_INFO[lv];
            if (!info) return;
            const cleared = (typeof Save !== 'undefined') && Save.isLevelCleared(lv);
            const cls = `codex-level-card ${cleared ? 'cleared' : 'locked'}${lv === 'level6' ? ' boss' : ''}${lv === 'level99' ? ' genius' : ''}`;
            html += `<article class="${cls}">
                <div class="codex-level-head">
                    <span class="codex-level-tag">${_levelShortLabel(lv)}</span>
                    <span class="codex-level-state">${cleared ? '已通過' : '未通過'}</span>
                </div>
                <h3>${info.name}</h3>
                <p>${cleared ? '劇情、分子與梗圖已解鎖。' : '通過這一關後解鎖圖鑑內容。'}</p>
            </article>`;
        });
        html += '</div>';
        UI.codexPanelLevels.innerHTML = html;
    }

    function renderCodexBadges(badgeDefs, data) {
        if (!UI.codexPanelBadges) return;
        const totalCorrect = data ? data.totalCorrect : 0;
        const unlocked = new Set(data ? data.badges : []);
        if (!badgeDefs || !badgeDefs.length) {
            UI.codexPanelBadges.innerHTML = '<p class="codex-empty">目前沒有勳章設定。</p>';
            return;
        }
        UI.codexPanelBadges.innerHTML = `<div class="codex-badge-grid">${badgeDefs.map(b => {
            const isUnlocked = unlocked.has(b.id);
            const progress = b.needCorrect ? Math.min(100, Math.round(totalCorrect / b.needCorrect * 100)) : 0;
            return `<article class="codex-badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="codex-badge-icon">${b.emoji || '🏅'}</div>
                <div class="codex-badge-name">${b.label}</div>
                <div class="codex-badge-cond">${isUnlocked ? '已解鎖' : `累積答對 ${b.needCorrect} 題`}</div>
                <div class="codex-badge-progress"><div class="fill" style="width:${progress}%"></div></div>
            </article>`;
        }).join('')}</div>`;
    }

    function renderCodexMolecules(data) {
        if (!UI.codexPanelMolecules) return;
        const seenKeys = new Set(data ? data.seenMolecules : []);
        let html = '';
        LEVEL_ORDER.forEach(lv => {
            const info = LEVEL_INFO[lv];
            const questions = _uniqueQuestionsForLevel(lv);
            if (!info || !questions.length) return;
            const levelCleared = (typeof Save !== 'undefined') && Save.isLevelCleared(lv);
            const unlockedCount = questions.filter(q => levelCleared || seenKeys.has(q.aKey)).length;
            html += `<section class="codex-molecule-section">
                <h3 class="codex-section-title"><span class="codex-level-tag">${_levelShortLabel(lv)}</span>${info.name}<span class="codex-section-count">${unlockedCount}/${questions.length}</span></h3>
                <div class="codex-mol-grid">`;
            questions.forEach(q => {
                const unlocked = levelCleared || seenKeys.has(q.aKey);
                const ab = (typeof AnswerBank !== 'undefined') ? AnswerBank[q.aKey] : null;
                const name = ab ? ab.content : q.aKey;
                const fact = (typeof CompoundFacts !== 'undefined' && CompoundFacts[q.aKey]) ? CompoundFacts[q.aKey] : '（小知識整理中……）';
                if (!unlocked) {
                    html += `<div class="codex-mol-card locked"><span class="codex-mol-img placeholder">?</span><span class="codex-mol-name">???</span></div>`;
                    return;
                }
                html += `<button class="codex-mol-card" type="button" aria-expanded="false">
                    <img class="codex-mol-img" src="${q.qContent}" alt="" loading="lazy">
                    <span class="codex-mol-name">${name}</span>
                    <span class="codex-mol-fact">${fact}</span>
                </button>`;
            });
            html += '</div></section>';
        });
        UI.codexPanelMolecules.innerHTML = html || '<p class="codex-empty">還沒有可顯示的分子。</p>';
        UI.codexPanelMolecules.querySelectorAll('.codex-mol-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const open = card.classList.toggle('open');
                card.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });
    }

    function renderCodexStories() {
        if (!UI.codexPanelStory) return;
        let html = '';
        LEVEL_ORDER.forEach(lv => {
            const info = LEVEL_INFO[lv];
            const script = (typeof StoryScripts !== 'undefined') ? StoryScripts[lv] : null;
            if (!info || !script || !script.length) return;
            const cleared = (typeof Save !== 'undefined') && Save.isLevelCleared(lv);
            if (!cleared) {
                html += `<article class="codex-story-card locked">
                    <div class="codex-story-head"><span class="codex-level-tag">${_levelShortLabel(lv)}</span><h3>${info.name}</h3></div>
                    <p>通過這一關後解鎖劇情。</p>
                </article>`;
                return;
            }
            html += `<details class="codex-story-card">
                <summary><span class="codex-level-tag">${_levelShortLabel(lv)}</span><strong>${info.name}</strong><span>${script.length} 句對話</span></summary>
                <div class="codex-story">`;
            script.forEach(line => {
                    const isWiz = line.who === 'wiz';
                    const who = isWiz ? `${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}` : '🎩 分類帽';
                    const cls = isWiz ? 'codex-line-wiz' : 'codex-line-hat';
                    const text = line.text.replace(/\{name\}/g, wizardPersonas.p1.name || '你');
                    html += `<p class="codex-line ${cls}"><strong>${who}：</strong>${text}</p>`;
            });
            const memes = (info.memes && info.memes.length) ? info.memes : (info.meme ? [info.meme] : []);
            if (memes.length) {
                html += `<div class="codex-meme-strip">${memes.map(m => `<img class="codex-meme-img" src="assets/images/meme/${m}" alt="" loading="lazy">`).join('')}</div>`;
            }
            html += '</div></details>';
        });
        UI.codexPanelStory.innerHTML = html || '<p class="codex-empty">還沒有可顯示的劇情。</p>';
    }

    function isVisible(el) {
        return !!el && !el.classList.contains('hidden');
    }

    function getModeName(m) {
        if(m==='speed') return "競速挑戰";
        if(m==='duel') return "巫師對決";
        return "自我修煉";
    }

    function createKeyIndexMap(bindingRows) {
        const map = {};
        bindingRows.forEach((codes, index) => {
            codes.forEach(code => { map[code] = index; });
        });
        return map;
    }

    function keyCodeToLabel(code) {
        if (code.startsWith('Key')) return code.slice(3);
        if (code.startsWith('Digit')) return code.slice(5);
        if (code.startsWith('Numpad')) return code.slice(6);
        return code;
    }

    function formatKeyHint(codes, prefix = '') {
        const labels = [...new Set(codes.map(keyCodeToLabel))];
        return labels.map(label => `${prefix}${label}`).join(' / ');
    }

    function addButtonHint(el, label, side = 'left') {
        // 手機上不添加快捷鍵提示
        if (window.matchMedia('(pointer: coarse)').matches) return;
        if (!el || !label || el.querySelector('.button-hotkey')) return;
        const hint = document.createElement('span');
        hint.className = `button-hotkey button-hotkey-${side}`;
        hint.textContent = `[${label}]`;
        el.prepend(hint);
    }
    // 改按鈕文字，但保留前面的 [快捷鍵] 標籤
    function setBtnText(el, text) {
        if (!el) return;
        const hint = el.querySelector('.button-hotkey');
        el.textContent = text;
        if (hint) el.prepend(hint);
    }

    function applyKeyboardHints() {
        Object.entries(MENU_SHORTCUTS).forEach(([code, target]) => {
            const btn = UI.menu.querySelector(`.menu-btn[data-mode="${target.mode}"][data-level="${target.level}"]`);
            addButtonHint(btn, keyCodeToLabel(code));
        });

        addButtonHint(UI.btnBack, 'Esc / M');
        addButtonHint(UI.btnRestart, 'R');
        addButtonHint(UI.btnNextLevel, 'Enter / N');
        addButtonHint(UI.btnMenu, 'Esc / M');
        addButtonHint(UI.btnShowRef, 'H');
        addButtonHint(UI.btnShowStory, 'S');
        addButtonHint(UI.btnShowTutorial, 'T');
        // 首頁次要按鈕
        addButtonHint(UI.btnTutorial, 'T');
        addButtonHint(UI.btnOpenCodex, 'C');
        // 劇情 / 新手導覽 翻頁按鈕
        addButtonHint(UI.btnStoryNext, 'Enter / →');
        addButtonHint(UI.btnStorySkip, 'Esc（長按空白鍵=全部跳過）');
        addButtonHint(UI.btnTutorialNext, 'Enter / →');
        addButtonHint(UI.btnTutorialPrev, '←');
        addButtonHint(UI.btnTutorialSkip, 'Esc');
        addButtonHint(UI.btnCloseCodex, 'Esc / X');

        if (UI.btnCloseRef && !UI.btnCloseRef.querySelector('.button-hotkey')) {
            UI.btnCloseRef.innerHTML = `<span class="button-hotkey button-hotkey-left">[X]</span><span aria-hidden="true">×</span>`;
        }
    }

    // --- 核心邏輯 ---
    function gameLoop() {
        if (!gameActive) return;
        timeLeft -= 0.1;
        
        const pct = (timeLeft / MAX_TIME) * 100;
        UI.timeBar.style.width = `${pct}%`;

        // 警告
        if (timeLeft <= 5) {
            UI.timeBar.classList.add('time-running-out');
            if (Math.floor(timeLeft * 10) % 10 === 0) {
                 UI.warnP1.classList.remove('hidden');
                 UI.warnP2.classList.remove('hidden');
                 playSound('beep');
            }
        } else {
            UI.timeBar.classList.remove('time-running-out');
            UI.warnP1.classList.add('hidden');
            UI.warnP2.classList.add('hidden');
        }

        if (timeLeft <= 0) endGame(currentMode === 'duel' ? 'draw' : 'lose');
    }

    // --- 故事播放系統 ---
    const STORY_MIN_ASKED = (typeof ModeRules !== 'undefined' && ModeRules.get('practice'))
        ? ModeRules.get('practice').roundSize
        : 10;

    let _storyLines = [];
    let _storyIdx = 0;
    let _storyOnDone = null;

    const SPEAKER_INFO = {
        hat: { emoji: '🎩', name: '分類帽', cls: 'speaker-hat' },
        wiz: { emoji: '🧙', name: null, cls: 'speaker-wiz' }  // name 由 wizardPersonas 動態填
    };

    function _storyReplaceName(text) {
        return text.replace(/\{name\}/g, wizardPersonas.p1.name || '你');
    }

    function _storyRenderLine(idx) {
        const line = _storyLines[idx];
        const isWiz = line.who === 'wiz';

        // 講者頭像：分類帽 → 用有眼睛的分類帽角色；魔法師 → 用 persona emoji
        const hatEl = document.getElementById('story-speaker-hat');
        if (hatEl) {
            buildHatChar(hatEl);
            hatEl.classList.toggle('hidden', isWiz);
        }
        UI.storySpeakerEmoji.classList.toggle('hidden', !isWiz);
        if (isWiz) UI.storySpeakerEmoji.textContent = wizardPersonas.p1.emoji;
        UI.storySpeakerName.textContent = isWiz ? wizardPersonas.p1.name : '分類帽';
        UI.storyText.textContent = _storyReplaceName(line.text);

        UI.storyModalContent.classList.toggle('speaker-wiz', isWiz);

        // 更新進度點
        UI.storyDots.querySelectorAll('.story-dot').forEach((dot, i) => {
            dot.classList.toggle('done', i < idx);
            dot.classList.toggle('current', i === idx);
        });

        // 最後一句改按鈕文字
        setBtnText(UI.btnStoryNext, (idx === _storyLines.length - 1) ? '完成 ✓' : '繼續 →');
    }

    function _buildDots() {
        UI.storyDots.innerHTML = '';
        _storyLines.forEach((_, i) => {
            const dot = document.createElement('span');
            dot.className = 'story-dot';
            UI.storyDots.appendChild(dot);
        });
    }

    function showStory(levelKey, onDone) {
        const script = (typeof StoryScripts !== 'undefined') ? StoryScripts[levelKey] : null;
        if (!script || script.length === 0) { if (onDone) onDone(); return; }

        _storyLines = script;
        _storyIdx = 0;
        _storyOnDone = onDone || null;

        _buildDots();
        _storyRenderLine(0);

        if (UI.storyModal) UI.storyModal.classList.remove('hidden');
    }

    function _storyAdvance() {
        _storyIdx++;
        if (_storyIdx >= _storyLines.length) {
            _storyClose(true);
        } else {
            _storyRenderLine(_storyIdx);
        }
    }

    function _storyBack() {
        if (_storyIdx > 0) {
            _storyIdx--;
            _storyRenderLine(_storyIdx);
        }
    }

    function _storyClose(finished) {
        UI.storyModal.classList.add('hidden');
        if (_storyOnDone) { const cb = _storyOnDone; _storyOnDone = null; cb(finished); }
    }

    function initStoryListeners() {
        UI.btnStoryNext.addEventListener('click', _storyAdvance);
        UI.btnStorySkip.addEventListener('click', () => _storyClose(false));
    }

    // --- 新手導覽 ---
    const TUTORIAL_SLIDES = [
        { icon: 'hat', title: '歡迎來到「有機分類帽」', text: '我是分類帽，會在你旁邊吐槽……我是說，給你提示。這裡是練習「快速辨認有機官能基」的地方。' },
        { icon: '🔬', title: '怎麼玩', text: '螢幕中間會出現一個分子結構圖，你要從四個選項裡選出它屬於哪一類官能基（烷、烯、醇、醛、酮、酸、酯……）。選對，魔法成功率上升；選錯，咒語會失控、成功率下降；歸零就魔力耗盡。' },
        { icon: '⌨️', title: '怎麼按', text: '用滑鼠直接點選項就行。也可以用鍵盤——每個選項上會標 [快捷鍵]。對決模式時，玩家一用左邊那組鍵、玩家二用右邊那組。結算頁可用 Enter（下一關）、R（再玩）、Esc（回大廳）。' },
        { icon: '⚗️', title: '三種模式', text: '⚗️ 自我修煉：慢慢練，答錯會給你提示。⏳ 競速挑戰：限時作答，答對加秒、連對加更多。⚔️ 巫師對決：兩人同一台搶答（桌面用鍵盤、手機橫放用觸控）。' },
        { icon: '📖', title: '通關與劇情', text: '每一關把題庫全部題目都至少作答過一次就算通過，並解鎖分類帽的劇情對話。單次答對率會記錄在圖鑑裡，方便回顧練習狀況。' },
        { icon: '✨', title: '開始吧', text: '方向鍵選關卡、Enter 開始。隨時可以從首頁的「新手導覽」再看一次這份說明。去吧，別讓帽子等太久。' },
    ];
    let _tutIdx = 0;
    let _tutSlides = TUTORIAL_SLIDES;     // 目前正在播的投影片陣列（全域導覽 or 某一關的教學）
    let _tutDoneLabel = '開始遊戲 ✓';     // 最後一頁「下一頁」按鈕的文字
    let _tutOnClose = null;               // 關閉時要做的事（標記已看、回到原畫面…）

    function _renderTutDots() {
        if (!UI.tutorialDots) return;
        UI.tutorialDots.innerHTML = '';
        _tutSlides.forEach(() => {
            const d = document.createElement('span'); d.className = 'story-dot'; UI.tutorialDots.appendChild(d);
        });
    }
    function _showTutorialModal(slides, opts) {
        if (!UI.tutorialModal || !slides || !slides.length) { if (opts && opts.onClose) opts.onClose(); return; }
        _tutSlides = slides;
        _tutIdx = 0;
        _tutDoneLabel = (opts && opts.doneLabel) || '開始遊戲 ✓';
        _tutOnClose = (opts && opts.onClose) || null;
        if (UI.tutorialModalTitle) UI.tutorialModalTitle.textContent = (opts && opts.title) || '新手導覽';
        _renderTutDots();
        _tutRender();
        UI.tutorialModal.classList.remove('hidden');
        if (UI.btnTutorialNext) try { UI.btnTutorialNext.focus(); } catch(e) {}
    }
    // 全域 6 頁「怎麼玩」導覽（首次進站自動跳 / 首頁按鈕重看）
    function showTutorial(fromButton) {
        if (!UI.tutorialModal) return;
        if (!fromButton && !isVisible(UI.menu)) return;  // 自動跳出時，若玩家已離開大廳就不打擾
        _showTutorialModal(TUTORIAL_SLIDES, {
            title: '新手導覽',
            doneLabel: '開始遊戲 ✓',
            onClose: () => {
                if (typeof Save !== 'undefined') Save.markTutorialSeen();
                focusFirstAvailableControl(UI.menu);
            }
        });
    }
    // 某一關的「分類帽教學」（第一次進關自動跳 / 結算頁「看本關教學」重看）
    function showLevelTutorial(levelKey, onDone) {
        const slides = (typeof LevelTutorials !== 'undefined') ? LevelTutorials[levelKey] : null;
        if (!slides || !slides.length) { if (onDone) onDone(); return; }
        const info = (typeof LEVEL_INFO !== 'undefined') ? LEVEL_INFO[levelKey] : null;
        const lvName = info ? (info.titleShort || info.name) : levelKey;
        _showTutorialModal(slides, {
            title: lvName + ' · 分類帽教學',
            doneLabel: '看完了 ✓',
            onClose: () => {
                if (typeof Save !== 'undefined') Save.markLevelTutorialSeen(levelKey);
                if (onDone) onDone();
            }
        });
    }
    function _tutRender() {
        const s = _tutSlides[_tutIdx];
        // 帽子（永遠顯示在左邊）
        if (UI.tutorialHat) buildHatChar(UI.tutorialHat);
        // 圖片或 emoji（在右邊）
        if (s.img) {
            const imgs = Array.isArray(s.img) ? s.img : [s.img];
            UI.tutorialIcon.classList.toggle('multi', imgs.length > 1);
            UI.tutorialIcon.innerHTML = imgs.map(src =>
                `<img class="tutorial-img" src="${src}" alt="" onerror="this.style.display='none'">`).join('');
        } else if (s.icon && s.icon !== 'hat') {
            UI.tutorialIcon.classList.remove('multi');
            UI.tutorialIcon.textContent = s.icon;
        } else {
            UI.tutorialIcon.classList.remove('multi');
            UI.tutorialIcon.innerHTML = '';
        }
        UI.tutorialTitle.textContent = s.title || '';
        UI.tutorialText.textContent = s.text || '';
        UI.tutorialDots.querySelectorAll('.story-dot').forEach((d, i) => {
            d.classList.toggle('done', i < _tutIdx);
            d.classList.toggle('current', i === _tutIdx);
        });
        UI.btnTutorialPrev.disabled = (_tutIdx === 0);
        setBtnText(UI.btnTutorialNext, (_tutIdx === _tutSlides.length - 1) ? _tutDoneLabel : '下一頁 →');
        // 套用本頁表情
        if (s.expr) setHatExpr(s.expr);
    }
    function _tutNext() {
        if (_tutIdx >= _tutSlides.length - 1) { _tutClose(); return; }
        _tutIdx++; _tutRender();
    }
    function _tutPrev() { if (_tutIdx > 0) { _tutIdx--; _tutRender(); } }
    function _tutClose() {
        UI.tutorialModal.classList.add('hidden');
        const cb = _tutOnClose; _tutOnClose = null;
        if (cb) cb();
    }
    function initTutorialListeners() {
        if (UI.btnTutorial)     UI.btnTutorial.addEventListener('click', () => showTutorial(true));
        if (UI.btnTutorialNext) UI.btnTutorialNext.addEventListener('click', _tutNext);
        if (UI.btnTutorialPrev) UI.btnTutorialPrev.addEventListener('click', _tutPrev);
        if (UI.btnTutorialSkip) UI.btnTutorialSkip.addEventListener('click', _tutClose);
    }

    function _checkStoryThreshold() {
        if (currentMode !== 'practice') return false;
        const stat = (typeof Save !== 'undefined' && Save.practiceStats) ? Save.practiceStats(currentLevel) : null;
        const list = (typeof QuestionSets !== 'undefined') ? QuestionSets[currentLevel] : null;
        return !!(stat && list && stat.answered.length >= list.length);
    }

    function getPracticeQuestionId(qData) {
        if (!qData) return '';
        return qData.id || qData.key || qData.qContent || qData.aKey || '';
    }

    function recordPracticeProgress(isCorrect) {
        if (currentMode !== 'practice' || typeof Save === 'undefined' || !Save.recordPracticeAttempt) return;
        const roundTotal = practiceRoundTotal || players.p1.totalAsked || 1;
        Save.recordPracticeAttempt(
            currentLevel,
            getPracticeQuestionId(currentQuestion),
            isCorrect,
            practiceRoundCorrect,
            roundTotal
        );
    }

    function endGame(resultType, winner) {
        gameActive = false;
        setGlobalInputLocked(false);
        clearInterval(timerInterval);
        cleanupQuestionTransientState();
        if (_autoStoryTimer) { clearTimeout(_autoStoryTimer); _autoStoryTimer = null; }
        ['p1', 'p2'].forEach(p => {
            if (readingTimers[p]) { clearTimeout(readingTimers[p]); readingTimers[p] = null; }
        });
        UI.resultModal.classList.remove('hidden');

        // 「到下一關」按鈕：練習/競速/對決都導到 LEVEL_ORDER 的下一關（同模式）；沒有下一關就隱藏
        const nextLv = _nextLevelKey(currentLevel);
        if (UI.btnNextLevel) UI.btnNextLevel.classList.toggle('hidden', !nextLv);
        
        let title = "", msg = "";
        if (currentMode === 'duel') {
            if (resultType === 'win') {
                title = (winner === 'p1' ? "P1 獲勝!" : "P2 獲勝!");
                msg = "魔法決鬥的王者誕生了！";
                playSound('win');
            } else {
                title = "平手 (動態平衡)";
                msg = "兩位魔法師的魔力勢均力敵……";
                playSound('lose');
            }
            UI.resultStats.innerHTML = `P1: ${players.p1.correctCount}/${DUEL_WIN_TARGET} 題 <br> P2: ${players.p2.correctCount}/${DUEL_WIN_TARGET} 題`;
        } else if (currentMode === 'practice') {
            const total = Math.max(players.p1.totalAsked, 1);
            const pct = Math.round((players.p1.correctCount / total) * 100);
            const cleared = _checkStoryThreshold();
            title = cleared ? "練習通關" : "本輪完成";
            msg = cleared ? "已完成本關題庫，解鎖本關進度。" : "已記錄本輪答對率，可繼續練習剩餘題目。";
            playSound(cleared ? 'win' : 'lose');
            UI.resultStats.innerHTML = `答對: ${players.p1.correctCount}/${players.p1.totalAsked}<br>本輪答對率: ${pct}%`;
        } else if (currentMode === 'speed') {
            title = "Speed 結算";
            msg = `答對題數: ${players.p1.correctCount}`;
            playSound('win');
            UI.resultStats.innerHTML = `答對: ${players.p1.correctCount}<br>得分: ${players.p1.score}`;
        } else {
            title = "練習完成";
            msg = `最終魔力: ${players.p1.score}`;
            playSound('win');
            UI.resultStats.innerHTML = `得分: ${players.p1.score}`;
        }
        UI.resultTitle.textContent = title;
        UI.resultMsg.textContent = msg;

        // 故事解鎖判斷
        const alreadyUnlocked = (typeof Save !== 'undefined') && Save.isStoryUnlocked(currentLevel);
        const hasScript = (typeof StoryScripts !== 'undefined') && !!StoryScripts[currentLevel];
        const metThreshold = _checkStoryThreshold();

        if (metThreshold && typeof Save !== 'undefined') {
            Save.markLevelClear(currentLevel);
        }

        // 完成題庫：顯示「解鎖劇情」按鈕，由玩家點按才播劇情（不自動跳）
        let freshStory = false;
        if (UI.btnShowStory) {
            if (hasScript && metThreshold) {
                freshStory = !alreadyUnlocked;
                setBtnText(UI.btnShowStory, alreadyUnlocked ? '📖 重播劇情' : '✨ 解鎖劇情！（點我看）');
                UI.btnShowStory.classList.remove('hidden');
            } else {
                UI.btnShowStory.classList.add('hidden');
            }
        }

        // 本關有教學頁 → 顯示「看本關教學」按鈕（隨時可重看）
        if (UI.btnShowTutorial) {
            const hasTut = (typeof LevelTutorials !== 'undefined') && !!LevelTutorials[currentLevel];
            UI.btnShowTutorial.classList.toggle('hidden', !hasTut);
        }

        _focusResultDefault(freshStory);
    }

    // 結算頁預設聚焦：剛解鎖劇情 → 聚焦「解鎖劇情」；否則 →「到下一關」（沒有就「再次練習」）
    function _focusResultDefault(preferStory) {
        let target = null;
        if (preferStory && UI.btnShowStory && !UI.btnShowStory.classList.contains('hidden')) {
            target = UI.btnShowStory;
        } else if (UI.btnNextLevel && !UI.btnNextLevel.classList.contains('hidden')) {
            target = UI.btnNextLevel;
        } else {
            target = UI.btnRestart;
        }
        if (target) try { target.focus(); } catch(e) {}
    }

    function getRandomMsg(type) {
        const MSG_WIN = ["有機小天才", "路易斯結構大師", "諾貝爾化學獎預備", "魔力滿溢"];
        const MSG_LOSE = ["魔力潰散!", "重新詠唱一次……", "小心咒語反噬", "把碳看成氮了嗎?", "咒文崩解……"];
        return (type==='win') ? MSG_WIN[Math.floor(Math.random()*MSG_WIN.length)] : MSG_LOSE[Math.floor(Math.random()*MSG_LOSE.length)];
    }

    // --- 題目生成 ---
    function shuffleArray(arr) {
        if (typeof QuestionEngine !== 'undefined' && QuestionEngine.shuffle) {
            return QuestionEngine.shuffle(arr);
        }
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function getLevelQuestions(levelKey) {
        if (typeof QuestionEngine !== 'undefined' && QuestionEngine.getQuestions) {
            return QuestionEngine.getQuestions(levelKey);
        }
        return (typeof QuestionSets !== 'undefined' && Array.isArray(QuestionSets[levelKey])) ? QuestionSets[levelKey] : [];
    }

    function avoidImmediateRepeat(queue, lastQuestion) {
        if (lastQuestion && queue.length > 1 && queue[queue.length - 1] === lastQuestion) {
            [queue[0], queue[queue.length - 1]] = [queue[queue.length - 1], queue[0]];
        }
        return queue;
    }

    function buildQuestionQueue(levelKey, lastQuestion, limit) {
        const list = getLevelQuestions(levelKey);
        let queue = shuffleArray([...list]);
        if (typeof limit === 'number') queue = queue.slice(0, Math.min(limit, queue.length));
        return avoidImmediateRepeat(queue, lastQuestion);
    }

    function nextQuestion() {
        if (!gameActive) return;
        setHatExpr('neutral');
        cleanupQuestionTransientState();
        if (currentMode === 'duel') {
            if (duelVariant === 'zoom') {
                nextDuelZoomQuestion();
            } else {
                nextDuelQuestion('p1');
                nextDuelQuestion('p2');
            }
            return;
        }
        const list = getLevelQuestions(currentLevel);
        if (!list || list.length === 0) return;

        if (currentMode === 'practice' && practiceRoundTotal > 0 && players.p1.totalAsked >= practiceRoundTotal) {
            endGame(_checkStoryThreshold() ? 'win' : 'lose');
            return;
        }

        if (questionQueueLevel !== currentLevel || questionQueue.length === 0) {
            practiceRoundTotal = list.length;
            practiceRoundCorrect = 0;
            if (currentMode === 'practice') {
                const roundSize = STORY_MIN_ASKED;
                questionQueue = buildQuestionQueue(currentLevel, currentQuestion, roundSize);
                practiceRoundTotal = questionQueue.length;
            } else {
                questionQueue = buildQuestionQueue(currentLevel, currentQuestion);
            }
            questionQueueLevel = currentLevel;
        }

        const qData = questionQueue.pop();
        currentQuestion = qData;
        correctAnswerKey = qData.aKey;

        const options = generateOptions(correctAnswerKey, currentLevel);
        renderQuestion(qData, options);
    }

    function nextDuelQuestion(player) {
        if (!gameActive) return;
        const list = getLevelQuestions(currentLevel);
        if (!list || list.length === 0) return;
        const pq = duelQ[player];

        // 共用題目順序：建一次，兩位玩家共用 → 第 N 題同一分子
        if (_duelOrderLevel !== currentLevel || !_duelOrder || _duelOrder.length === 0) {
            _duelOrder = buildQuestionQueue(currentLevel);
            _duelOrderLevel = currentLevel;
        }

        if (pq.queueLevel !== currentLevel || pq.queue.length === 0) {
            pq.queue = [..._duelOrder];   // 各自一份副本，但順序相同
            avoidImmediateRepeat(pq.queue, pq.question);
            pq.queueLevel = currentLevel;
        }

        const qData = pq.queue.pop();
        pq.question = qData;
        pq.correctKey = qData.aKey;

        const options = generateOptions(pq.correctKey, currentLevel);  // 各自獨立隨機 → 選項順序不同
        renderDuelQuestion(player, qData, options);
        startReadingPeriod(player);
    }

    function nextDuelStandardRound() {
        nextDuelQuestion('p1');
        nextDuelQuestion('p2');
    }

    function renderDuelQuestion(player, qData, options) {
        setGlobalInputLocked(false);
        const playerUI = getPlayerUI(player);
        // 新版 landscape：兩位玩家共用中央 #q-shared 題目框
        const qContentEl = UI.qContentShared || (player === 'p1' ? playerUI.questionContent : null);
        const optsEl = playerUI.options;

        if (qContentEl) {
            const imgTag = `<img src="${qData.qContent}" alt="Structure" draggable="false">`;
            qContentEl.innerHTML = imgTag;
            qContentEl.querySelector('img').onerror = () => { qContentEl.innerHTML = "<span class='q-text'>圖片遺失</span>"; };
        }

        optsEl.innerHTML = '';
        optsEl.classList.remove('locked-area');
        if (lockTimers[player]) { clearTimeout(lockTimers[player]); lockTimers[player] = null; }
        players[player].isLocked = false;

        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'btn opt-btn magic-stone-btn';
            btn.dataset.idx = idx;
            btn.dataset.key = opt.key;
            // Key hint: P1 uses A/F/Z/C, P2 uses 4/6/1/3
            const keyCodes = (player === 'p1')
                ? ANSWER_KEY_BINDINGS.duelDesktop.p1[idx]
                : ANSWER_KEY_BINDINGS.duelDesktop.p2[idx];
            const keyLabel = isDuelDesktop ? formatKeyHint(keyCodes) : '';
            btn.innerHTML = keyLabel
                ? `<span class="key-hint key-hint-left">[${keyLabel}]</span><span class="option-text">${opt.text}</span>`
                : `<span class="option-text">${opt.text}</span>`;
            optsEl.appendChild(btn);
        });
    }

    function startReadingPeriod(player) {
        const optsEl = getPlayerUI(player).options;
        optsEl.classList.add('locked-area');
        players[player].isLocked = true;
        if (readingTimers[player]) clearTimeout(readingTimers[player]);
        readingTimers[player] = setTimeout(() => {
            if (!gameActive) return;
            optsEl.classList.remove('locked-area');
            players[player].isLocked = false;
            readingTimers[player] = null;
        }, DUEL_READING_MS);
    }

    function updateDuelProgress(player) {
        const hpEl = getPlayerUI(player).hp;
        const count = players[player].correctCount;
        const pct = Math.min((count / DUEL_WIN_TARGET) * 100, 100);
        hpEl.style.width = `${pct}%`;
        hpEl.style.background = '';
    }

    function generateOptions(correctKey, level) {
        if (!AnswerBank[correctKey]) return [];

        let pool;
        if (level === 'level99') {
            // Level 99：干擾選項從英文官能基「類別卡」裡抽
            pool = shuffleArray(Object.keys(AnswerBank).filter(k =>
                k !== correctKey && AnswerBank[k].category === 'cat'
            )).slice(0, 3);
        } else {
            // 一般關卡：干擾選項只從「目前關卡 + 之前關卡」學過的分子裡抽
            //（避免冒出玩家還沒學到的化合物）；並優先抽「同關卡」的，
            // 因為同一關的官能基通常較接近，當干擾選項更有鑑別度。
            const upTo = MAIN_LEVELS.indexOf(level);
            const thisLevelKeys = new Set();
            const earlierKeys = new Set();
            (QuestionSets[level] || []).forEach(q => thisLevelKeys.add(q.aKey));
            if (upTo === -1) {
                // 非主線關卡（如「龜殼」陷阱關）：干擾選項先從本關自己的分子抽，不夠再從全部分子補
                Object.keys(AnswerBank).forEach(k => { if (AnswerBank[k].category !== 'cat') earlierKeys.add(k); });
            } else {
                for (let i = 0; i < upTo; i++) {
                    (QuestionSets[MAIN_LEVELS[i]] || []).forEach(q => earlierKeys.add(q.aKey));
                }
            }
            thisLevelKeys.delete(correctKey);
            const near = shuffleArray([...thisLevelKeys].filter(k => AnswerBank[k]));
            const far  = shuffleArray([...earlierKeys].filter(k => AnswerBank[k] && k !== correctKey && !thisLevelKeys.has(k)));
            pool = [...near, ...far].slice(0, 3);
        }

        const finalKeys = shuffleArray([correctKey, ...pool]);
        return finalKeys.map(k => ({ key: k, text: AnswerBank[k].content }));
    }

    function renderQuestion(qData, options) {
        setGlobalInputLocked(false);
        clearPracticeFeedback();
        let targets = (currentMode === 'duel') ? [UI.qContentShared] : [UI.qContentP1];
        const imgTag = `<img src="${qData.qContent}" alt="Structure" draggable="false">`;
        
        targets.forEach(el => {
            el.innerHTML = imgTag;
            el.querySelector('img').onerror = () => { el.innerHTML = "<span class='q-text'>圖片遺失</span>"; };
        });

        const renderBtns = (container, playerPrefix) => {
            container.innerHTML = '';
            // 解除鎖定狀態（含清掉上一題殘留的冷卻灰與計時器）
            container.classList.remove('locked-area');
            if (lockTimers[playerPrefix]) { clearTimeout(lockTimers[playerPrefix]); lockTimers[playerPrefix] = null; }
            players[playerPrefix].isLocked = false;
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'btn opt-btn magic-stone-btn';
                btn.dataset.idx = idx;
                btn.dataset.key = opt.key;
                const keyHint = getKeyHint(idx, playerPrefix);
                btn.innerHTML = keyHint
                    ? `<span class="key-hint key-hint-left">[${keyHint.left}]</span><span class="option-text">${opt.text}</span><span class="key-hint key-hint-right">[${keyHint.right}]</span>`
                    : `<span class="option-text">${opt.text}</span>`;
                container.appendChild(btn);
            });
        };

        renderBtns(UI.optsP1, 'p1');
        if (currentMode === 'duel') renderBtns(UI.optsP2, 'p2');
        blurActiveControl();
    }

    function getKeyHint(index, playerPrefix) {
        // 手機上不顯示快捷鍵提示
        if (window.matchMedia('(pointer: coarse)').matches) return '';

        if (currentMode === 'duel' && isDuelDesktop && playerPrefix === 'p1') {
            return {
                left: formatKeyHint(ANSWER_KEY_BINDINGS.duelDesktop.p1[index]),
                right: formatKeyHint(ANSWER_KEY_BINDINGS.duelDesktop.p2[index])
            };
        }
        if (currentMode !== 'duel') {
            return {
                left: formatKeyHint(ANSWER_KEY_BINDINGS.duelDesktop.p1[index]),
                right: formatKeyHint(ANSWER_KEY_BINDINGS.duelDesktop.p2[index])
            };
        }
        return '';
    }

    // --- 互動處理 (冷卻、Combo、音效) ---
    function handleOptionClick(e, player) {
        if (!gameActive) return;
        if (_globalInputLocked) return;

        // Zoom duel mode: intercept tap as buzz-in if in zooming phase
        if (currentMode === 'duel' && duelVariant === 'zoom') {
            if (_buzz.phase === 'zooming' && !isPenaltyPlayer(player)) {
                handleZoomBuzzIn(player);
                return;
            }
            if (_buzz.phase !== 'buzzed' || _buzz.buzzedBy !== player) return;
            // Fall through to normal option-click handling for buzzed player
        }

        // 1. 檢查是否在冷卻中
        if (players[player].isLocked) return;

        const btn = e.target.closest('.opt-btn');
        if (!btn) return;

        const selectedKey = btn.dataset.key;
        const activeCorrectKey = (currentMode === 'duel') ? duelQ[player].correctKey : correctAnswerKey;
        const isCorrect = (selectedKey === activeCorrectKey);

        if (isCorrect) {
            handleCorrect(player, btn);
        } else {
            handleWrong(player, btn);
        }
    }

    function handleKeyboardInput(e) {
        // 劇情對話框鍵盤（在 e.repeat 檢查前，因為長按空白鍵 = 略過全部）
        if (isVisible(UI.storyModal)) {
            if (e.code === 'Space') {
                e.preventDefault();
                if (e.repeat) UI.btnStorySkip.click();   // 長按 → 略過全部
                else UI.btnStoryNext.click();            // 單按 → 下一句
                return;
            }
            if (e.repeat) return;
            if (e.code === 'Enter' || e.code === 'ArrowRight') {
                e.preventDefault();
                UI.btnStoryNext.click();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                _storyBack();                            // ← 上一句
            } else if (e.code === 'Escape') {
                e.preventDefault();
                UI.btnStorySkip.click();
            }
            return;
        }

        if (e.repeat) return;

        // 新手導覽鍵盤
        if (isVisible(UI.tutorialModal)) {
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') { e.preventDefault(); UI.btnTutorialNext.click(); }
            else if (e.code === 'ArrowLeft') { e.preventDefault(); UI.btnTutorialPrev.click(); }
            else if (e.code === 'Escape') { e.preventDefault(); UI.btnTutorialSkip.click(); }
            return;
        }

        // 魔法師選擇框優先接管鍵盤
        if (isVisible(UI.wizardPicker)) {
            const inInput = e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if (inInput) {
                if (e.code === 'Escape') { e.preventDefault(); UI.btnPickerCancel.click(); return; }
                // Enter 從 input 確認（若按鈕可用）
                if (e.code === 'Enter') {
                    e.preventDefault();
                    if (!UI.btnPickerConfirm.disabled) UI.btnPickerConfirm.click();
                    return;
                }
                // 方向鍵從 input 跳到格子導航
                if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
                    e.preventDefault();
                    e.target.blur();
                    handlePickerKeydown(e);
                }
                return;
            }
            handlePickerKeydown(e);
            return;
        }

        if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        if (gameActive && isVisible(UI.game) && isGameControlSuppressedKey(e.code)) {
            e.preventDefault();
            blurActiveControl();
            return;
        }

        if (handleArrowNavigation(e)) return;
        if (handleGlobalShortcut(e)) return;
        if (!gameActive) return;
        if (_globalInputLocked) return;

        let player = 'p1';
        let optionIndex;

        if (currentMode === 'duel') {
            if (duelVariant === 'zoom') {
                handleZoomBuzzKey(e);
                return;
            }
            if (!isDuelDesktop) return;
            if (Object.prototype.hasOwnProperty.call(DUEL_DESKTOP_KEYS.p1, e.code)) {
                player = 'p1';
                optionIndex = DUEL_DESKTOP_KEYS.p1[e.code];
            } else if (Object.prototype.hasOwnProperty.call(DUEL_DESKTOP_KEYS.p2, e.code)) {
                player = 'p2';
                optionIndex = DUEL_DESKTOP_KEYS.p2[e.code];
            } else {
                return;
            }
        } else {
            if (!Object.prototype.hasOwnProperty.call(SOLO_KEYS, e.code)) return;
            optionIndex = SOLO_KEYS[e.code];
        }

        const container = getPlayerUI(player).options;
        const btn = container.querySelector(`.opt-btn[data-idx="${optionIndex}"]`);
        if (!btn) return;
        e.preventDefault();
        handleOptionClick({ target: btn }, player);
    }

    function _setDevQuickWin(on) {
        _devQuickWin = on;
        let indicator = document.getElementById('dev-quickwin-indicator');
        if (on) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'dev-quickwin-indicator';
                indicator.textContent = `🔧 測試模式：答對 ${DEV_WIN_AFTER} 題即結算`;
                indicator.style.cssText = 'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);background:#c0392b;color:#fff;padding:4px 14px;border-radius:8px;font-size:0.85rem;z-index:9999;pointer-events:none;font-family:sans-serif;';
                document.body.appendChild(indicator);
            }
            indicator.style.display = 'block';
        } else if (indicator) {
            indicator.style.display = 'none';
        }
    }

    function handleGlobalShortcut(e) {
        // ` 鍵切換開發者快速結算模式
        if (e.code === 'Backquote') {
            e.preventDefault();
            _setDevQuickWin(!_devQuickWin);
            return true;
        }

        if (isVisible(UI.refModal)) {
            if (e.code === 'Escape' || e.code === 'KeyX') {
                e.preventDefault();
                closeReference();
                return true;
            }
            return false;
        }

        if (isVisible(UI.resultModal)) {
            const nextAvail = UI.btnNextLevel && !UI.btnNextLevel.classList.contains('hidden');
            if (e.code === 'Enter') {
                e.preventDefault();
                const f = document.activeElement;
                if (f && [UI.btnRestart, UI.btnNextLevel, UI.btnMenu, UI.btnShowStory, UI.btnShowTutorial].includes(f) && !f.classList.contains('hidden')) {
                    f.click();
                } else if (nextAvail) {
                    UI.btnNextLevel.click();
                } else {
                    UI.btnRestart.click();
                }
                return true;
            }
            if (e.code === 'KeyR') { e.preventDefault(); UI.btnRestart.click(); return true; }
            if (e.code === 'KeyN' && nextAvail) { e.preventDefault(); UI.btnNextLevel.click(); return true; }
            if (e.code === 'KeyS' && UI.btnShowStory && !UI.btnShowStory.classList.contains('hidden')) { e.preventDefault(); UI.btnShowStory.click(); return true; }
            if (e.code === 'KeyT' && UI.btnShowTutorial && !UI.btnShowTutorial.classList.contains('hidden')) { e.preventDefault(); UI.btnShowTutorial.click(); return true; }
            if (e.code === 'KeyM' || e.code === 'Escape') { e.preventDefault(); confirmReturnToMenu(); return true; }
            return false;
        }

        if (isVisible(UI.settingsModal)) {
            if (e.code === 'Escape' || e.code === 'KeyX') {
                e.preventDefault();
                closeSettings();
            }
            return true;
        }

        if (isVisible(UI.codexModal)) {
            if (e.code === 'Escape' || e.code === 'KeyX') {
                e.preventDefault();
                closeCodex();
            }
            // 圖鑑開著時消化所有快捷鍵（避免觸發底下選單的關卡捷徑）；不 preventDefault 讓 Tab/Enter 原生行為仍可用
            return true;
        }

        if (isVisible(UI.menu)) {
            if (Object.prototype.hasOwnProperty.call(MENU_SHORTCUTS, e.code)) {
                const target = MENU_SHORTCUTS[e.code];
                e.preventDefault();
                startGame(target.mode, target.level);
                return true;
            }
            if (e.code === 'KeyH' && UI.btnShowRef && !UI.btnShowRef.classList.contains('hidden')) {
                e.preventDefault();
                showReference();
                return true;
            }
            if (e.code === 'KeyT' && UI.btnTutorial) { e.preventDefault(); showTutorial(true); return true; }
            if (e.code === 'KeyC' && UI.btnOpenCodex) { e.preventDefault(); openCodex(); return true; }
            return false;
        }

        if (isVisible(UI.game)) {
            if (e.code === 'Escape' || e.code === 'KeyM') {
                e.preventDefault();
                confirmReturnToMenu();
                return true;
            }
            if (e.code === 'KeyR') {
                e.preventDefault();
                startGame(currentMode, currentLevel);
                return true;
            }
            if (e.code === 'KeyH' && currentMode === 'practice') {
                e.preventDefault();
                togglePracticeHint();
                return true;
            }
        }

        return false;
    }

    function getActivePanel() {
        if (isVisible(UI.tutorialModal)) return UI.tutorialModal;
        if (isVisible(UI.codexModal)) return UI.codexModal;
        if (isVisible(UI.refModal)) return UI.refModal;
        if (isVisible(UI.resultModal)) return UI.resultModal;
        if (isVisible(UI.menu)) return UI.menu;
        if (isVisible(UI.game)) return UI.game;
        return document.body;
    }

    function isGameControlSuppressedKey(code) {
        return code === 'Enter' ||
            code === 'Space' ||
            code === 'ArrowUp' ||
            code === 'ArrowDown' ||
            code === 'ArrowLeft' ||
            code === 'ArrowRight';
    }

    function blurActiveControl() {
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
    }

    function getFocusableControls(root) {
        return [...root.querySelectorAll('button, [role="button"], .opt-btn')]
            .filter(el => !el.disabled && isControlVisible(el));
    }

    function isControlVisible(el) {
        if (!el || el.classList.contains('hidden')) return false;
        if (el.closest('.hidden')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    }

    function focusFirstAvailableControl(root) {
        requestAnimationFrame(() => {
            const controls = getFocusableControls(root);
            if (controls.length) controls[0].focus();
        });
    }

    function handleArrowNavigation(e) {
        const directions = {
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right'
        };
        const direction = directions[e.code];
        if (!direction) return false;

        const current = document.activeElement;
        const topProgress = document.querySelector('.top-progress');
        const isTopButton = topProgress && topProgress.contains(current) && ['button', 'Button'].some(t => current.tagName === 'BUTTON');

        if (isTopButton && (direction === 'left' || direction === 'right')) {
            e.preventDefault();
            const topButtons = [...topProgress.querySelectorAll('button')].filter(btn => !btn.disabled && isControlVisible(btn));
            if (topButtons.length < 2) return true;
            const currentIdx = topButtons.indexOf(current);
            if (currentIdx === -1) {
                topButtons[0].focus();
            } else {
                const nextIdx = direction === 'right' ? (currentIdx + 1) % topButtons.length : (currentIdx - 1 + topButtons.length) % topButtons.length;
                topButtons[nextIdx].focus();
            }
            return true;
        }

        const controls = getFocusableControls(getActivePanel());
        if (!controls.length) return false;

        e.preventDefault();
        if (!current || !controls.includes(current)) {
            controls[0].focus();
            return true;
        }

        const next = findDirectionalTarget(current, controls, direction);
        if (next) next.focus();
        return true;
    }

    function findDirectionalTarget(current, controls, direction) {
        const currentRect = current.getBoundingClientRect();
        const cx = currentRect.left + currentRect.width / 2;
        const cy = currentRect.top + currentRect.height / 2;
        let best = null;
        let bestScore = Infinity;

        controls.forEach(candidate => {
            if (candidate === current) return;
            const rect = candidate.getBoundingClientRect();
            const tx = rect.left + rect.width / 2;
            const ty = rect.top + rect.height / 2;
            const dx = tx - cx;
            const dy = ty - cy;

            const inDirection =
                (direction === 'left' && dx < -4) ||
                (direction === 'right' && dx > 4) ||
                (direction === 'up' && dy < -4) ||
                (direction === 'down' && dy > 4);
            if (!inDirection) return;

            const primary = (direction === 'left' || direction === 'right') ? Math.abs(dx) : Math.abs(dy);
            const secondary = (direction === 'left' || direction === 'right') ? Math.abs(dy) : Math.abs(dx);
            const score = primary * 10 + secondary;
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        });

        if (best) return best;
        const index = controls.indexOf(current);
        const delta = (direction === 'left' || direction === 'up') ? -1 : 1;
        return controls[(index + delta + controls.length) % controls.length];
    }

    function handleCorrect(player, btn) {
        if (currentMode === 'duel' && duelVariant === 'zoom') {
            handleZoomCorrect(player, btn);
            return;
        }
        if (_globalInputLocked) return;
        setGlobalInputLocked(true);

        playSound('correct');
        btn.classList.add('correct');
        if (currentMode !== 'duel') setHatExpr(currentMode === 'speed' ? 'wink' : 'happy', 1300);
        players[player].totalAsked++;
        players[player].correctCount++;

        if (currentMode === 'duel') {
            updateDuelProgress(player);
            duelArenaAttack(player);
            const devWin = _devQuickWin && players[player].correctCount >= DEV_WIN_AFTER;
            if (devWin || players[player].correctCount >= DUEL_WIN_TARGET) {
                endGame('win', player);
                return;
            }
            setTimeout(() => {
                setGlobalInputLocked(false);
                nextDuelStandardRound();
            }, 700);
            return;
        }

        // practice / speed mode
        if (_devQuickWin) {
            // 測試模式：答對 DEV_WIN_AFTER 題就強制結算
            players[player].score += 10;
            updateStats(player);
            Save.addCorrect(1);
            Save.seeMolecule(correctAnswerKey);
            if (players[player].correctCount >= DEV_WIN_AFTER) {
                practiceRoundTotal = STORY_MIN_ASKED;
                practiceRoundCorrect = STORY_MIN_ASKED;
                players[player].totalAsked = STORY_MIN_ASKED;
                players[player].correctCount = STORY_MIN_ASKED;
                setTimeout(() => endGame('win', player), 600);
            } else {
                setTimeout(() => {
                    setGlobalInputLocked(false);
                    nextQuestion();
                }, 800);
            }
            return;
        }

        practiceWrongStreak = 0;
        if (currentMode === 'practice') {
            practiceRoundCorrect++;
            const newBadges = Save.addCorrect(1);
            if (newBadges && newBadges.length) showBadgeToast(newBadges[0]);
            Save.seeMolecule(correctAnswerKey);
            recordPracticeProgress(true);
            const lines = COACH_LINES.correct;
            setPracticeCoachText(lines[Math.floor(Math.random() * lines.length)]);
        }
        if (currentMode === 'speed') {
            const speedRules = (typeof ModeRules !== 'undefined' && ModeRules.get('speed')) ? ModeRules.get('speed') : null;
            const bonus = speedRules ? speedRules.correctTimeDelta : 3;
            timeLeft = Math.min(timeLeft + bonus, MAX_TIME);
            showTimeBonus(bonus, UI.optsP1);
            const speedLines = ['⚡ 繼續！', '🔥 燃燒！', '💥 完美！', '✨ 加速！', '🚀 快！'];
            setPracticeCoachText(speedLines[Math.floor(Math.random() * speedLines.length)]);
        }

        players[player].score += (10 + players[player].combo * 2);
        players[player].combo++;
        if (currentMode !== 'speed' && currentMode !== 'practice') {
            players[player].hp = Math.min(players[player].hp + 5, players[player].maxHp);
        }
        triggerComboAttack(player);
        updateStats(player);

        setTimeout(() => {
            setGlobalInputLocked(false);
            nextQuestion();
        }, 1000);
    }

    function handleWrong(player, btn) {
        if (currentMode === 'duel' && duelVariant === 'zoom') {
            handleZoomWrong(player, btn);
            return;
        }
        if (_globalInputLocked) return;
        setGlobalInputLocked(true);

        playSound('wrong');
        btn.classList.add('wrong');
        if (currentMode !== 'duel') setHatExpr('sad', 1600);
        players[player].totalAsked++;
        if (currentMode === 'practice') recordPracticeProgress(false);
        if (shouldRevealCorrectOnWrong()) revealCorrectAnswer(player);
        showPracticeWrongHint();

        players[player].combo = 0;
        if (currentMode === 'speed') {
            const speedRules = (typeof ModeRules !== 'undefined' && ModeRules.get('speed')) ? ModeRules.get('speed') : null;
            const penalty = speedRules ? Math.abs(speedRules.wrongTimeDelta) : 3;
            timeLeft = Math.max(timeLeft - penalty, 0);
            showTimeBonus(-penalty, UI.optsP1);
        } else if (currentMode !== 'duel' && currentMode !== 'practice') {
            players[player].hp -= 20;
        } else if (currentMode === 'duel') {
            duelArenaFizzle(player);
        }

        players[player].isLocked = true;
        const playerUI = getPlayerUI(player);
        const container = playerUI.options;
        container.classList.add('locked-area');

        if (currentMode === 'practice') {
            Save.recordWrong(correctAnswerKey);
        }

        const warnEl = playerUI.warn;
        warnEl.textContent = "魔力潰散!";
        warnEl.classList.remove('hidden');

        const lockDuration = (currentMode === 'duel') ? DUEL_LOCK_MS : 1600;
        if (lockTimers[player]) clearTimeout(lockTimers[player]);
        lockTimers[player] = setTimeout(() => {
            players[player].isLocked = false;
            container.classList.remove('locked-area');
            warnEl.classList.add('hidden');
            warnEl.textContent = '魔力告急!';
            btn.classList.remove('wrong');
            if (currentMode === 'duel') clearCorrectReveal(player);
            lockTimers[player] = null;
            setGlobalInputLocked(false);
            if (gameActive && currentMode !== 'duel') {
                nextQuestion();
            }
        }, lockDuration);

        if (currentMode !== 'duel') {
            updateStats(player);
            if (currentMode === 'speed') {
                if (timeLeft <= 0) endGame('lose');
            } else if (currentMode !== 'practice' && players[player].hp <= 0) {
                endGame('lose');
            }
        }
    }

    function getOptionContainerForPlayer(player) {
        return getPlayerUI(player).options;
    }

    function revealCorrectAnswer(player) {
        const correctKey = (currentMode === 'duel') ? duelQ[player].correctKey : correctAnswerKey;
        const container = getOptionContainerForPlayer(player);
        const correctBtn = container.querySelector(`.opt-btn[data-key="${correctKey}"]`);
        if (correctBtn) correctBtn.classList.add('reveal-correct');
    }

    function shouldRevealCorrectOnWrong() {
        if (typeof ModeRules === 'undefined' || !ModeRules.get) return false;
        const rules = ModeRules.get(currentMode);
        return !!(rules && rules.revealCorrectOnWrong);
    }

    function clearCorrectReveal(player) {
        const container = getPlayerUI(player).options;
        container.querySelectorAll('.reveal-correct').forEach(el => el.classList.remove('reveal-correct'));
    }

    function _categoryNameOf(answerKey) {
        const cat = getAnswerCategory(answerKey);
        return (cat && CATEGORY_NAMES[cat]) ? CATEGORY_NAMES[cat] : '這一類';
    }

    // fromToggle = true 表示是玩家剛按下「提示」、把這題已答錯的詳細說明補上（不再 +1 連錯數）
    function showPracticeWrongHint(fromToggle) {
        if (currentMode !== 'practice') return;
        if (!fromToggle) practiceWrongStreak++;

        ensurePracticeFeedbackUI();
        const hint = getWhyHintForAnswer(correctAnswerKey);
        const catName = _categoryNameOf(correctAnswerKey);
        const ab = (typeof AnswerBank !== 'undefined') ? AnswerBank[correctAnswerKey] : null;
        const molName = ab ? ab.content : '';

        if (_practiceHintOn) {
            // 提示模式開：講清楚——這是哪一類、怎麼看出來的
            const why = hint ? `——${hint}。` : '。';
            practiceWhyEl.textContent = `${molName ? `「${molName}」` : '這個結構'}屬於「${catName}」${why}`;
            practiceWhyEl.classList.remove('hidden');
            const coachText = practiceWrongStreak >= 3
                ? `${molName ? `「${molName}」` : '這個結構'}是「${catName}」${why}${COACH_LINES.streak}`
                : COACH_LINES.guide;
            setPracticeCoachText(coachText);
        } else {
            // 提示模式關：不直接給答案，連錯兩次就提醒怎麼打開提示
            practiceWhyEl.textContent = '';
            practiceWhyEl.classList.add('hidden');
            if (practiceWrongStreak >= 3) {
                setPracticeCoachText('還是卡關？按一下下方的「💡 需要提示？」（或按 H），我就講清楚怎麼判斷。');
            } else if (practiceWrongStreak === 2) {
                setPracticeCoachText('連錯兩題了——按下方的「💡 需要提示？」（或按 H），我就告訴你這題該看哪裡。');
            } else {
                setPracticeCoachText('再看一次。先找最醒目的官能基。');
            }
        }
        // 答錯的「失望」過後，帽子轉成「思考」陪你看提示
        setTimeout(() => { if (isVisible(UI.game) && currentMode === 'practice') setHatExpr('thinking'); }, 1500);
    }

    function getWhyHintForAnswer(answerKey) {
        const category = getAnswerCategory(answerKey);
        return category ? WHY_HINTS[category] : '';
    }

    function getAnswerCategory(answerKey) {
        if (Object.prototype.hasOwnProperty.call(CAT_CATEGORY_MAP, answerKey)) {
            return CAT_CATEGORY_MAP[answerKey];
        }

        const answer = AnswerBank[answerKey];
        if (!answer || answer.category === 'cat') return '';
        return answer.category;
    }

    // --- 對決競技場動畫 ---
    const arenaEl   = document.getElementById('arena-bar');
    const arenaP1El = document.getElementById('avatar-p1');
    const arenaP2El = document.getElementById('avatar-p2');

    function _arenaOnce(el, cls, dur) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), dur);
    }

    function _arenaShake() {
        if (!arenaEl) return;
        _arenaOnce(arenaEl, 'shake', 320);
    }

    function _arenaSpawnBolt(caster, comboCount) {
        if (!arenaEl) return;
        const b = document.createElement('div');
        const toP2 = (caster === 'p1');
        b.className = 'arena-bolt ' + (toP2 ? 'bolt-lr' : 'bolt-rl');
        b.textContent = comboCount >= 3 ? '🌩️' : '⚡';
        arenaEl.appendChild(b);
        setTimeout(() => {
            b.remove();
            _arenaImpact(toP2 ? 'p2' : 'p1', caster, comboCount);
        }, 310);
    }

    function _arenaImpact(target, caster, comboCount) {
        if (!arenaEl) return;
        const targetEl = target === 'p1' ? arenaP1El : arenaP2El;

        // 爆炸點
        const burst = document.createElement('div');
        burst.className = 'arena-burst';
        burst.textContent = '💥';
        burst.style[target === 'p1' ? 'left' : 'right'] = '14%';
        arenaEl.appendChild(burst);
        setTimeout(() => burst.remove(), 540);

        // 火花
        const tRect = targetEl.getBoundingClientRect();
        const aRect = arenaEl.getBoundingClientRect();
        const cx = tRect.left - aRect.left + tRect.width / 2;
        const cy = tRect.top  - aRect.top  + tRect.height / 2;
        const SPARKS = ['✨','⚡','💢','🔆'];
        for (let i = 0; i < 8; i++) {
            const s = document.createElement('div');
            s.className = 'arena-spark';
            s.textContent = SPARKS[i % 4];
            s.style.left = `${cx}px`;
            s.style.top  = `${cy}px`;
            const ang  = Math.random() * Math.PI * 2;
            const dist = 36 + Math.random() * 52;
            s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
            s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
            arenaEl.appendChild(s);
            setTimeout(() => s.remove(), 540);
        }

        // 被擊中：hit 動畫後恢復 idle
        targetEl.classList.remove('idle');
        _arenaOnce(targetEl, 'hit', 580);
        setTimeout(() => { targetEl.classList.add('idle'); }, 600);
        _arenaShake();

        // Combo 文字（combo ≥ 2）
        if (comboCount >= 2) {
            const ct = document.createElement('div');
            ct.className = 'arena-combo';
            ct.style.color = caster === 'p1' ? '#8be9fd' : '#ff8a8a';
            ct.style.fontSize = `${1.8 + Math.min(comboCount, 6) * 0.3}rem`;
            ct.textContent = `COMBO ×${comboCount}${comboCount >= 4 ? ' 🔥' : '!'}`;
            arenaEl.appendChild(ct);
            setTimeout(() => ct.remove(), 700);
        }
    }

    function duelArenaAttack(player) {
        if (!arenaEl || arenaEl.classList.contains('hidden') || !isDuelDesktop) return;
        const casterEl = player === 'p1' ? arenaP1El : arenaP2El;
        const comboCount = players[player].combo; // already incremented by this point
        casterEl.classList.remove('idle');
        _arenaOnce(casterEl, 'charging', 290);
        setTimeout(() => { casterEl.classList.add('idle'); }, 310);
        setTimeout(() => _arenaSpawnBolt(player, comboCount), 200);
    }

    function duelArenaFizzle(player) {
        if (!arenaEl || arenaEl.classList.contains('hidden') || !isDuelDesktop) return;
        const casterEl = player === 'p1' ? arenaP1El : arenaP2El;
        casterEl.classList.remove('idle');
        _arenaOnce(casterEl, 'arena-fizzle', 520);
        setTimeout(() => { casterEl.classList.add('idle'); }, 540);

        // 冒煙
        const smoke = document.createElement('div');
        smoke.className = 'arena-burst';
        smoke.textContent = '💨';
        smoke.style[player === 'p1' ? 'left' : 'right'] = '10%';
        smoke.style.bottom = '56px';
        arenaEl.appendChild(smoke);
        setTimeout(() => smoke.remove(), 540);
    }

    function _arenaUpdateWizards() {
        if (!arenaP1El || !arenaP2El) return;
        // avatar-p1/p2 是直接放 emoji 文字的 div（新版 arena-bar 結構）
        arenaP1El.textContent = wizardPersonas.p1.emoji;
        arenaP2El.textContent = wizardPersonas.p2.emoji;
        // pname span 與 avatar 同層，在 .p1-side / .p2-side 裡
        const p1Side = arenaP1El.closest('.p1-side');
        if (p1Side) { const n = p1Side.querySelector('.pname'); if (n) n.textContent = wizardPersonas.p1.name; }
        const p2Side = arenaP2El.closest('.p2-side');
        if (p2Side) { const n = p2Side.querySelector('.pname'); if (n) n.textContent = wizardPersonas.p2.name; }
    }

    // --- Combo 攻擊動畫 (對戰時射向對方) ---
    function triggerComboAttack(player) {
        const comboCount = players[player].combo;
        if (comboCount < 2) return;

        // 建立投射物
        const projectile = document.createElement('div');
        projectile.className = `combo-projectile ${player}-atk`;
        projectile.textContent = `COMBO x${comboCount}!`;
        
        // 放入遊戲區域
        UI.game.appendChild(projectile);

        // 動畫結束後移除 DOM；備用 timeout 處理 prefers-reduced-motion 導致 animationend 不觸發的情況
        projectile.addEventListener('animationend', () => {
            projectile.remove();
        });
        setTimeout(() => projectile.remove(), 1200);
    }

    function updateStats(p) {
        const data = players[p];
        const playerUI = getPlayerUI(p);
        const hpEl = playerUI.hp;
        const scoreEl = playerUI.score;

        hpEl.style.width = `${data.hp}%`;
        hpEl.classList.toggle('hp-low', data.hp < 30);
        scoreEl.textContent = data.score;

        // 單人模式：同步 info-bar 的 HP/分數
        if (p === 'p1' && !document.body.classList.contains('duel')) {
            if (playerUI.hpInfo) {
                playerUI.hpInfo.style.width = `${data.hp}%`;
                playerUI.hpInfo.classList.toggle('hp-low', data.hp < 30);
            }
            if (playerUI.scoreInfo) playerUI.scoreInfo.textContent = data.score;
        }
    }

    // --- 音效系統 (增強版) ---
    function playSound(type) {
        if (_muted) return;
        // 先嘗試抓 HTML 的 audio 標籤
        const audioId = {
            'correct': 'se-correct',
            'wrong': 'se-wrong',
            'win': 'se-win',
            'lose': 'se-lose',
            'beep': 'se-beep'
        }[type];
        const audioEl = document.getElementById(audioId);
        
        if (audioEl) {
            audioEl.currentTime = 0;
            // 處理這該死的 Promise 錯誤 (如果使用者還沒互動過)
            const p = audioEl.play();
            if (p !== undefined) p.catch(e => console.log("Audio blocked:", e));
        } else {
            // Web Audio API 備用方案
            fallbackSound(type);
        }
    }

    function fallbackSound(type) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;

        function tone(freq, type_, dur, vol, freqEnd) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = type_; osc.frequency.setValueAtTime(freq, now);
            if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.linearRampToValueAtTime(0, now + dur);
            osc.start(now); osc.stop(now + dur);
        }

        if (type === 'correct') {
            tone(500, 'sine', 0.08, 0.12, 900);
            setTimeout(() => { const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.type='sine'; o.frequency.value=1100; g.gain.setValueAtTime(0.10,audioCtx.currentTime); g.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.18); o.start(); o.stop(audioCtx.currentTime+0.18); }, 90);
        } else if (type === 'wrong') {
            tone(220, 'sawtooth', 0.15, 0.18, 130);
            setTimeout(() => tone(130, 'sawtooth', 0.15, 0.12, 90), 140);
        } else if (type === 'countdown') {
            tone(880, 'sine', 0.12, 0.10);
        } else if (type === 'start') {
            // 上升三連音：do mi sol
            [523, 659, 784].forEach((f, i) => {
                setTimeout(() => tone(f, 'sine', 0.18, 0.13), i * 120);
            });
        } else if (type === 'win') {
            [523, 659, 784, 1047].forEach((f, i) => {
                setTimeout(() => tone(f, 'sine', 0.22, 0.13), i * 130);
            });
        } else if (type === 'lose') {
            [400, 330, 262].forEach((f, i) => {
                setTimeout(() => tone(f, 'sawtooth', 0.22, 0.12), i * 140);
            });
        } else if (type === 'beep') {
            tone(660, 'sine', 0.08, 0.08);
        } else if (type === 'buzz') {
            // Buzz-in sound: sliding frequency down from 880 to 660 Hz
            const now = audioCtx.currentTime;
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(880, now);
            o.frequency.linearRampToValueAtTime(660, now + 0.12);
            g.gain.setValueAtTime(0.28, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            o.start(now);
            o.stop(now + 0.18);
        }
    }

    // ========================================
    // ZOOM DUEL MODE FUNCTIONS
    // ========================================

    function nextDuelZoomQuestion() {
        if (!gameActive) return;
        clearZoomState();
        if (UI.qContentShared) UI.qContentShared.innerHTML = '';

        const list = getLevelQuestions(currentLevel);
        if (!list || !list.length) return;
        if (_duelOrderLevel !== currentLevel || !_duelOrder || !_duelOrder.length) {
            _duelOrder = buildQuestionQueue(currentLevel);
            _duelOrderLevel = currentLevel;
        }
        const pq = duelQ.p1;
        if (pq.queueLevel !== currentLevel || !pq.queue.length) {
            pq.queue = [..._duelOrder];
            avoidImmediateRepeat(pq.queue, pq.question);
            pq.queueLevel = currentLevel;
        }
        const qData = pq.queue.pop();
        if (!qData) return;

        const correctCat = getAnswerCategory(qData.aKey);
        duelQ.p1.question = qData;
        duelQ.p1.correctKey = correctCat;
        duelQ.p2.question = qData;
        duelQ.p2.correctKey = correctCat;

        const imgTag = `<img src="${qData.qContent}" alt="Structure" draggable="false">`;
        UI.qContentShared.innerHTML = imgTag;

        setZoomPreBuzzState();
        setGlobalInputLocked(false);
        startZoomAnimation(qData);
        _buzz.phase = 'zooming';
        _buzz.buzzedBy = null;
        _buzz.penaltyPlayer = null;
        _buzz.failedPlayers.clear();
        _buzz.effectComplete = false;
    }

    function startZoomAnimation(qData) {
        const img = UI.qContentShared.querySelector('img');
        if (!img) return;

        const ox = (Math.random() * 30 - 15).toFixed(1);
        const oy = (Math.random() * 30 - 15).toFixed(1);
        img.style.setProperty('--zoom-ox', `${ox}%`);
        img.style.setProperty('--zoom-oy', `${oy}%`);
        img.style.setProperty('--zoom-duration', '12s');
        img.style.animationDelay = '0s';

        img.classList.remove('zoom-active', 'zoom-paused');
        void img.offsetWidth;
        img.classList.add('zoom-active');

        _zoomStartTime = Date.now();
        _zoomElapsedMs = 0;

        clearManagedTimeout('zoom-effect-complete', _zoomTimeoutId);
        _zoomTimeoutId = setManagedTimeout('zoom-effect-complete', () => handleZoomEffectComplete(), ZOOM_DURATION_MS);
    }

    function handleZoomBuzzIn(player) {
        if (_buzz.phase !== 'zooming') return;
        _buzz.phase = 'buzzed';
        _buzz.buzzedBy = player;

        const img = UI.qContentShared.querySelector('img');
        if (img) {
            if (!_buzz.effectComplete) {
                _zoomPausedAt = Date.now();
                _zoomElapsedMs += _zoomPausedAt - _zoomStartTime;
            } else {
                _zoomElapsedMs = ZOOM_DURATION_MS;
            }

            // Pause animation at current frame by adding zoom-paused class
            // Keep zoom-active to preserve animation definition
            img.classList.add('zoom-paused');
        }

        if (_zoomTimeoutId) {
            clearManagedTimeout('zoom-effect-complete', _zoomTimeoutId);
            _zoomTimeoutId = null;
        }

        const other = player === 'p1' ? 'p2' : 'p1';
        const buzzingOpts = getPlayerUI(player).options;
        const otherOpts = getPlayerUI(other).options;

        buzzingOpts.classList.remove('pre-buzz', 'buzz-locked-out');
        buzzingOpts.classList.add('buzz-active');
        otherOpts.classList.add('buzz-locked-out');
        otherOpts.classList.remove('buzz-active');

        const options = generateCategoryOptions(duelQ[player].question.aKey);
        renderZoomOptions(player, options);

        const avatarEl = player === 'p1' ? arenaP1El : arenaP2El;
        _arenaOnce(avatarEl, 'charging', 400);

        playSound('buzz');

        // Start 3-second countdown for buzz-in answering
        _buzzCountdownRemaining = BUZZ_ANSWER_SECONDS;
        startBuzzCountdown(player);
    }

    function handleZoomEffectComplete() {
        if (_buzz.phase !== 'zooming') return;
        clearManagedTimeout('zoom-effect-complete', _zoomTimeoutId);
        _zoomTimeoutId = null;
        _zoomElapsedMs = ZOOM_DURATION_MS;
        _buzz.effectComplete = true;
    }

    function handleZoomCorrect(player, btn) {
        if (_globalInputLocked) return;
        setGlobalInputLocked(true);
        playSound('correct');
        btn.classList.add('correct');
        _buzz.phase = 'correct_wait';

        clearBuzzCountdown();

        players[player].correctCount++;
        updateDuelProgress(player);
        duelArenaAttack(player);

        if (_zoomTimeoutId) {
            clearManagedTimeout('zoom-effect-complete', _zoomTimeoutId);
            _zoomTimeoutId = null;
        }

        if (_buzz.effectComplete) {
            setManagedTimeout('zoom-correct-finish', () => finishZoomCorrect(player), 700);
            return;
        }

        resumeZoomAnimation();
        const remainingMs = Math.max(0, ZOOM_DURATION_MS - _zoomElapsedMs);
        _zoomStartTime = Date.now() - _zoomElapsedMs;
        _zoomTimeoutId = setManagedTimeout('zoom-effect-complete', () => {
            _zoomTimeoutId = null;
            _zoomElapsedMs = ZOOM_DURATION_MS;
            _buzz.effectComplete = true;
            finishZoomCorrect(player);
        }, remainingMs);
    }

    function finishZoomCorrect(player) {
        const devWin = _devQuickWin && players[player].correctCount >= DEV_WIN_AFTER;
        if (devWin || players[player].correctCount >= DUEL_WIN_TARGET) {
            endGame('win', player);
            return;
        }
        setGlobalInputLocked(false);
        nextDuelZoomQuestion();
    }

    function handleZoomWrong(player, btn) {
        if (_globalInputLocked) return;
        setGlobalInputLocked(true);
        playSound('wrong');
        if (btn) btn.classList.add('wrong');

        clearBuzzCountdown();

        _buzz.phase = 'penalty';
        _buzz.penaltyPlayer = player;
        _buzz.failedPlayers.add(player);

        duelArenaFizzle(player);
        showZoomPenaltyBadge(player);

        const other = player === 'p1' ? 'p2' : 'p1';
        const container = getPlayerUI(player).options;
        container.classList.add('buzz-locked-out');

        clearManagedTimeout('zoom-penalty', _penaltyTimerId);
        _penaltyTimerId = setManagedTimeout('zoom-penalty', () => {
            if (btn) btn.classList.remove('wrong');
            container.classList.remove('buzz-active');

            const otherOpts = getPlayerUI(other).options;
            removeZoomPenaltyBadges();

            if (!_buzz.failedPlayers.has(other)) {
                container.classList.add('buzz-locked-out');
                otherOpts.classList.remove('pre-buzz', 'buzz-locked-out');
                otherOpts.classList.add('buzz-active');
                const options = generateCategoryOptions(duelQ[other].question.aKey);
                renderZoomOptions(other, options);
                _buzz.phase = 'buzzed';
                _buzz.buzzedBy = other;
                _buzz.penaltyPlayer = null;
                _buzzCountdownRemaining = BUZZ_ANSWER_SECONDS;
                setGlobalInputLocked(false);
                startBuzzCountdown(other);
                return;
            }

            setZoomPreBuzzState();
            _buzz.phase = 'zooming';
            _buzz.penaltyPlayer = null;
            _buzz.buzzedBy = null;
            _buzz.failedPlayers.clear();

            clearManagedTimeout('zoom-effect-complete', _zoomTimeoutId);
            if (_buzz.effectComplete) {
                _zoomTimeoutId = null;
            } else {
                resumeZoomAnimation();
                const remainingMs = Math.max(500, ZOOM_DURATION_MS - _zoomElapsedMs);
                _zoomTimeoutId = setManagedTimeout('zoom-effect-complete', () => handleZoomEffectComplete(), remainingMs);
                _zoomStartTime = Date.now() - _zoomElapsedMs;
            }
            setGlobalInputLocked(false);
        }, ZOOM_PENALTY_MS);
    }

    function generateCategoryOptions(aKey) {
        const correctCat = getAnswerCategory(aKey);
        const distractors = (CONFUSABLE_CATS[correctCat] || []).slice(0, 3);
        const finalCats = shuffleArray([correctCat, ...distractors]);
        return finalCats.map(cat => ({ key: cat, text: CATEGORY_NAMES[cat] }));
    }

    function setZoomPreBuzzState() {
        [UI.optsP1, UI.optsP2].forEach((el, i) => {
            el.classList.add('pre-buzz');
            el.classList.remove('buzz-active', 'buzz-locked-out');
            el.innerHTML = '';
            const player = i === 0 ? 'p1' : 'p2';
            const label = isDuelDesktop ? '按任意鍵\n快速搶答' : '點按搶答';
            el.dataset.buzzLabel = label;
        });
    }

    function setZoomPreBuzzStateFor(player) {
        const el = getPlayerUI(player).options;
        el.classList.add('pre-buzz');
        el.classList.remove('buzz-active', 'buzz-locked-out');
        el.innerHTML = '';
        el.dataset.buzzLabel = isDuelDesktop ? '按任意鍵\n快速搶答' : '點按搶答';
    }

    function resumeZoomAnimation() {
        const img = UI.qContentShared.querySelector('img');
        if (!img) return;
        img.classList.remove('zoom-paused');
    }

    function renderZoomOptions(player, options) {
        const optsEl = getPlayerUI(player).options;
        optsEl.classList.remove('pre-buzz');
        optsEl.innerHTML = '';

        // Add countdown timer display
        const countdownDiv = document.createElement('div');
        countdownDiv.className = 'buzz-countdown countdown-tick';
        countdownDiv.id = `buzz-countdown-${player}`;
        countdownDiv.textContent = `${BUZZ_ANSWER_SECONDS}`;
        optsEl.appendChild(countdownDiv);

        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'btn opt-btn magic-stone-btn';
            btn.dataset.idx = idx;
            btn.dataset.key = opt.key;
            const keyCodes = (player === 'p1')
                ? ANSWER_KEY_BINDINGS.duelDesktop.p1[idx]
                : ANSWER_KEY_BINDINGS.duelDesktop.p2[idx];
            const keyLabel = isDuelDesktop ? formatKeyHint(keyCodes) : '';
            btn.innerHTML = keyLabel
                ? `<span class="key-hint key-hint-left">[${keyLabel}]</span><span class="option-text">${opt.text}</span>`
                : `<span class="option-text">${opt.text}</span>`;
            optsEl.appendChild(btn);
        });
    }

    function startBuzzCountdown(player) {
        // Clear any existing countdown
        clearManagedTimeout('buzz-countdown', _buzzCountdownId);

        // Update display immediately
        const countdownEl = document.getElementById(`buzz-countdown-${player}`);
        if (countdownEl) {
            countdownEl.textContent = `${_buzzCountdownRemaining}`;
            // Force animation replay by removing and re-adding class
            countdownEl.classList.remove('countdown-tick');
            void countdownEl.offsetWidth; // trigger reflow
            countdownEl.classList.add('countdown-tick');
        }

        if (_buzzCountdownRemaining <= 0) {
            // Time's up: auto-submit as wrong answer
            handleBuzzTimeout(player);
            return;
        }

        _buzzCountdownRemaining--;
        _buzzCountdownId = setManagedTimeout('buzz-countdown', () => startBuzzCountdown(player), 1000);
    }

    function handleBuzzTimeout(player) {
        if (_buzz.buzzedBy !== player) return;

        handleZoomWrong(player, null);
    }

    function clearBuzzCountdown() {
        if (_buzzCountdownId) {
            clearManagedTimeout('buzz-countdown', _buzzCountdownId);
            _buzzCountdownId = null;
        }
        _buzzCountdownRemaining = BUZZ_ANSWER_SECONDS;
        // Remove countdown display
        document.querySelectorAll('.buzz-countdown').forEach(el => el.remove());
    }

    function clearZoomState() {
        if (_zoomTimeoutId) { clearManagedTimeout('zoom-effect-complete', _zoomTimeoutId); _zoomTimeoutId = null; }
        clearManagedTimeout('zoom-correct-finish', null);
        if (_penaltyTimerId) { clearManagedTimeout('zoom-penalty', _penaltyTimerId); _penaltyTimerId = null; }
        clearBuzzCountdown();
        _buzz.phase = 'idle';
        _buzz.buzzedBy = null;
        _buzz.penaltyPlayer = null;
        _buzz.failedPlayers.clear();
        _buzz.effectComplete = false;
        UI.sharedArea.querySelectorAll('.zoom-timeout-banner').forEach(el => el.remove());
        const img = UI.qContentShared && UI.qContentShared.querySelector('img');
        if (img) {
            img.classList.remove('zoom-active', 'zoom-paused');
            img.style.animationDelay = '';
            img.style.setProperty('--zoom-duration', '');
        }
        if (UI.qContentShared) UI.qContentShared.innerHTML = '';
        [UI.optsP1, UI.optsP2].forEach(el => {
            el.classList.remove('pre-buzz', 'buzz-active', 'buzz-locked-out');
            el.innerHTML = '';
        });
        removeZoomPenaltyBadges();
    }

    function showZoomPenaltyBadge(player) {
        const optsEl = getPlayerUI(player).options;
        const badge = document.createElement('div');
        badge.className = 'buzz-penalty-badge';
        badge.textContent = '✗ 答錯！';
        optsEl.style.position = 'relative';
        optsEl.appendChild(badge);
        setTimeout(() => badge.remove(), 2000);
    }

    function removeZoomPenaltyBadges() {
        document.querySelectorAll('.buzz-penalty-badge').forEach(el => el.remove());
    }

    function isPenaltyPlayer(player) {
        return _buzz.penaltyPlayer === player;
    }

    function handleZoomBuzzKey(e) {
        if (!isDuelDesktop) return;
        let player = null;
        if (_buzz.phase === 'zooming') {
            if (Object.prototype.hasOwnProperty.call(DUEL_DESKTOP_KEYS.p1, e.code)) player = 'p1';
            else if (Object.prototype.hasOwnProperty.call(DUEL_DESKTOP_KEYS.p2, e.code)) player = 'p2';
            if (player && !isPenaltyPlayer(player)) {
                e.preventDefault();
                handleZoomBuzzIn(player);
            }
        } else if (_buzz.phase === 'buzzed' && _buzz.buzzedBy) {
            const buzzedKeys = (_buzz.buzzedBy === 'p1') ? DUEL_DESKTOP_KEYS.p1 : DUEL_DESKTOP_KEYS.p2;
            if (Object.prototype.hasOwnProperty.call(buzzedKeys, e.code)) {
                e.preventDefault();
                const idx = buzzedKeys[e.code];
                const container = getPlayerUI(_buzz.buzzedBy).options;
                const btn = container.querySelector(`.opt-btn[data-idx="${idx}"]`);
                if (btn) handleOptionClick({ target: btn }, _buzz.buzzedBy);
            }
        }
    }

    return { init };
})();

window.addEventListener('load', Game.init);
