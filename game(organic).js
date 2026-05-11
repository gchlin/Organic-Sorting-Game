// game.js - 有機分類帽 (修復音效、冷卻與Combo攻擊版)

const WIZARD_PRESETS = [
    { emoji: '🧙', name: '凱庫勒傳人',  title: '苯環發現者嫡傳弟子' },
    { emoji: '🔬', name: '居里見習生',  title: '放射性學徒巫師' },
    { emoji: '⚗️', name: '拉瓦節信徒',  title: '質量守恆的信仰者' },
    { emoji: '🧪', name: '費雪酯化師',  title: '酯化反應大師' },
    { emoji: '💜', name: '羰基魔女',    title: 'C=O 的召喚者' },
    { emoji: '⚡', name: '鹵素獵人',    title: '追蹤 F·Cl·Br·I 者' },
    { emoji: '🔥', name: '烯炔騎士',    title: 'π 鍵破壞者' },
    { emoji: '🌿', name: '胺基戰士',    title: '氮原子的詩人' },
    { emoji: '🫧', name: '醚類隱士',    title: 'C–O–C 的守護者' },
    { emoji: '🍷', name: '乙醇愛好者',  title: '–OH 的忠實信徒' },
    { emoji: '🍋', name: '羧酸女俠',    title: '酸性官能基代言人' },
    { emoji: '🌸', name: '酚環衛士',    title: '苯酚直系護衛' },
];

const Game = (function() {
    // --- 變數與設定 ---
    let currentMode = "practice";
    let currentLevel = "level1";
    let timerInterval = null;
    let gameActive = false;
    let timeLeft = 0;
    const MAX_TIME = 60;

    // 玩家狀態
    // isLocked: 答錯冷卻鎖定
    const players = {
        p1: { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false },
        p2: { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false }
    };

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
        intro: "先看結構裡最醒目的官能基，再選分類。",
        correct: ["答對了，這頂帽子認同你的判斷。", "很好，官能基抓得準。", "分類成功，下一個結構。"],
        streak: "連錯幾題時，先找氧、氮、鹵素，再看有沒有 C=O 或苯環。"
    };
    let isDuelDesktop = false;
    let _devQuickWin = true; // ← 改成 true 開啟測試模式（答對1題即結算）；` 鍵也可即時切換
    let _muted = false;
    let practiceWrongStreak = 0;
    // Practice 一輪計數（用於 markLevelClear 門檻判斷：正確率 ≥ 60%）
    let practiceRoundTotal = 0;
    let practiceRoundCorrect = 0;
    let practiceCoachEl = null;
    let practiceCoachBubbleEl = null;
    let practiceWhyEl = null;

    const DUEL_WIN_TARGET = 8;
    const DUEL_READING_MS = 1500;
    const DUEL_LOCK_MS = 2000;

    const readingTimers = { p1: null, p2: null };
    // Per-player question state (used in duel mode)
    const duelQ = {
        p1: { queue: [], queueLevel: null, question: null, correctKey: '' },
        p2: { queue: [], queueLevel: null, question: null, correctKey: '' }
    };

    let currentQuestion = null;
    let correctAnswerKey = "";

    // DOM 快取
    const UI = {
        menu: document.getElementById('menu-container'),
        game: document.getElementById('game-container'),
        infoBar: document.getElementById('info-bar'),
        modeTitle: document.getElementById('mode-title'),
        levelTitle: document.getElementById('level-title'),
        timeBar: document.getElementById('time-bar'),
        
        p1Area: document.getElementById('p1-area'),
        p2Area: document.getElementById('p2-area'),
        sharedArea: document.getElementById('shared-question-area'),
        
        qContainerP1: document.getElementById('q-container-p1'),
        qContentP1: document.getElementById('q-p1'),
        qContainerP2: document.getElementById('q-container-p2'),
        qContentP2: document.getElementById('q-p2'),
        qContentShared: document.getElementById('q-shared'),

        optsP1: document.getElementById('opts-p1'),
        optsP2: document.getElementById('opts-p2'),

        hpP1: document.getElementById('hp-p1'),
        scoreP1: document.getElementById('score-p1'),
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
        btnMenu: document.getElementById('btn-menu'),
        btnBack: document.getElementById('btn-back'),
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
        wizardBadgeP1: document.getElementById('wizard-p1'),
        wizardBadgeP2: document.getElementById('wizard-p2'),
        wizardPicker: document.getElementById('wizard-picker'),
        pickerTitle: document.getElementById('picker-title'),
        pickerSubtitle: document.getElementById('picker-subtitle'),
        wizardGrid: document.getElementById('wizard-grid'),
        customNameInput: document.getElementById('custom-name-input'),
        btnPickerConfirm: document.getElementById('btn-picker-confirm'),
        btnPickerCancel: document.getElementById('btn-picker-cancel')
    };

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
            card.innerHTML = `<div class="wizard-card-emoji">${w.emoji}</div>
                              <div class="wizard-card-name">${w.name}</div>
                              <div class="wizard-card-title">${w.title}</div>`;
            card.addEventListener('click', () => {
                document.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('selected', 'keyboard-focus'));
                card.classList.add('selected');
                _pickerSelectedIdx = i;
                _pickerKeyFocusIdx = i;
                UI.customNameInput.value = '';
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
            UI.customNameInput.value = '';
            UI.btnPickerConfirm.disabled = true;
            UI.pickerTitle.textContent = '更換你的魔法師';
            UI.pickerSubtitle.textContent = `目前：${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}`;
            UI.menu.classList.add('hidden');
            UI.wizardPicker.classList.remove('hidden');
            UI.customNameInput.focus();
            return;
        }

        // 非對決模式：若已選過魔法師就直接開始
        if (mode !== 'duel' && _p1WizardPersisted) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            startGame(mode, level);
            return;
        }

        buildWizardGrid();
        UI.customNameInput.value = '';
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
            UI.pickerSubtitle.textContent = '選一個身份，或輸入自訂名稱';
        }

        UI.menu.classList.add('hidden');
        UI.wizardPicker.classList.remove('hidden');
        UI.customNameInput.focus();
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
        if (_pickerSelectedIdx >= 0) {
            const w = WIZARD_PRESETS[_pickerSelectedIdx];
            wizardPersonas[player] = { emoji: w.emoji, name: w.name };
        } else {
            const custom = UI.customNameInput.value.trim();
            wizardPersonas[player] = { emoji: '🧙', name: custom || (player === 'p1' ? '玩家一' : '玩家二') };
        }
    }

    function initPickerListeners() {
        UI.customNameInput.addEventListener('input', () => {
            const hasText = UI.customNameInput.value.trim().length > 0;
            if (hasText) {
                document.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('selected'));
                _pickerSelectedIdx = -1;
            }
            UI.btnPickerConfirm.disabled = !hasText && _pickerSelectedIdx < 0;
        });

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
                UI.customNameInput.value = '';
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
    function init() {
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showWizardPicker(btn.dataset.mode, btn.dataset.level);
            });
        });

        const btnChangeWizard = document.getElementById('btn-change-wizard');
        if (btnChangeWizard) {
            btnChangeWizard.addEventListener('click', () => showWizardPicker('_change', null));
        }

        UI.optsP1.addEventListener('click', e => handleOptionClick(e, 'p1'));
        UI.optsP2.addEventListener('click', e => handleOptionClick(e, 'p2'));
        document.addEventListener('keydown', handleKeyboardInput);
        window.addEventListener('resize', () => {
            if (currentMode === 'duel') setupLayout(currentMode);
        });

        UI.btnBack.addEventListener('click', showMenu);
        UI.btnMenu.addEventListener('click', showMenu);
        UI.btnRestart.addEventListener('click', () => startGame(currentMode, currentLevel));
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

        if (UI.btnShowStory) {
            UI.btnShowStory.addEventListener('click', () => {
                UI.resultModal.classList.add('hidden');
                showStory(currentLevel, () => {
                    UI.resultModal.classList.remove('hidden');
                });
            });
        }

        // 靜音按鈕（首頁 + 遊戲中）
        const btnMute = document.getElementById('btn-mute');
        const btnMuteGame = document.getElementById('btn-mute-game');
        [btnMute, btnMuteGame].forEach(btn => {
            if (btn) btn.addEventListener('click', toggleMute);
        });

        // 匯出存檔
        const btnExport = document.getElementById('btn-export');
        if (btnExport) btnExport.addEventListener('click', () => {
            const text = Save.exportText();
            navigator.clipboard.writeText(text).then(() => {
                btnExport.textContent = '✅ 已複製';
                setTimeout(() => { btnExport.textContent = '📤 匯出'; }, 2000);
            }).catch(() => {
                // 降級：顯示 prompt
                window.prompt('複製以下存檔：', text);
            });
        });

        // 匯入存檔
        const btnImportOpen = document.getElementById('btn-import-open');
        const importModal = document.getElementById('import-modal');
        const btnImportConfirm = document.getElementById('btn-import-confirm');
        const btnImportCancel = document.getElementById('btn-import-cancel');
        const importTextarea = document.getElementById('import-textarea');
        if (btnImportOpen && importModal) {
            btnImportOpen.addEventListener('click', () => {
                if (importTextarea) importTextarea.value = '';
                importModal.classList.remove('hidden');
                if (importTextarea) importTextarea.focus();
            });
            btnImportCancel.addEventListener('click', () => importModal.classList.add('hidden'));
            btnImportConfirm.addEventListener('click', () => {
                const ok = Save.importText(importTextarea.value.trim());
                if (ok) {
                    importModal.classList.add('hidden');
                    updateMenuProgress();
                    showBadgeToast(null, '✅ 存檔匯入成功！');
                } else {
                    importTextarea.style.borderColor = '#e74c3c';
                    setTimeout(() => { importTextarea.style.borderColor = ''; }, 1500);
                }
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
        currentMode = mode;
        currentLevel = level;
        gameActive = true;
        timeLeft = (mode === 'practice') ? 0 : MAX_TIME;

        // 重置玩家數據與殘留 UI 狀態
        ['p1', 'p2'].forEach(p => {
            players[p] = { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false, correctCount: 0, totalAsked: 0 };
            updateStats(p);
            document.querySelectorAll(`.combo-projectile.${p}-atk`).forEach(el => el.remove());
            if (lockTimers[p]) { clearTimeout(lockTimers[p]); lockTimers[p] = null; }
            if (readingTimers[p]) { clearTimeout(readingTimers[p]); readingTimers[p] = null; }
            duelQ[p] = { queue: [], queueLevel: null, question: null, correctKey: '' };
            const warnEl = (p === 'p1') ? UI.warnP1 : UI.warnP2;
            warnEl.classList.add('hidden');
            warnEl.textContent = '快炸了!';
            const optsEl = (p === 'p1') ? UI.optsP1 : UI.optsP2;
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
            document.querySelectorAll('.hp-text').forEach(el => el.textContent = '反應產率');
        }
        UI.timeBar.classList.remove('time-running-out');
        // 強制重洗題目佇列
        questionQueue = [];
        questionQueueLevel = null;
        currentQuestion = null;
        practiceWrongStreak = 0;
        practiceRoundTotal = 0;
        practiceRoundCorrect = 0;
        clearPracticeFeedback();

        UI.menu.classList.add('hidden');
        UI.resultModal.classList.add('hidden');

        // Show countdown overlay before revealing game so question content never flashes through
        const countdownOverlay = document.getElementById('countdown-overlay');
        if (countdownOverlay && mode !== 'practice') countdownOverlay.classList.remove('hidden');

        UI.game.classList.remove('hidden');
        UI.modeTitle.textContent = getModeName(mode);
        UI.levelTitle.textContent = level.toUpperCase();

        setupLayout(mode);
        setupPracticeFeedback(mode);

        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);
        UI.timeBar.style.width = '100%';

        if (mode === 'practice') {
            gameActive = true;
            nextQuestion();
        } else {
            runCountdown(['3', '2', '1', '開始!'], () => {
                document.body.classList.remove('countdown-active');
                gameActive = true;
                timerInterval = setInterval(gameLoop, 100);
                nextQuestion();
            });
        }
    }

    function runCountdown(steps, onDone) {
        const numEl = document.getElementById('countdown-number');
        const overlay = document.getElementById('countdown-overlay');
        // 用 body class 黑幕蓋住題目內容，overlay 只顯示數字
        document.body.classList.add('countdown-active');
        if (overlay) overlay.classList.remove('hidden');

        let i = 0;
        function tick() {
            if (i >= steps.length) {
                if (overlay) overlay.classList.add('hidden');
                onDone();
                return;
            }
            if (numEl) {
                numEl.textContent = steps[i];
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = '';
            }
            playSound(i < steps.length - 1 ? 'countdown' : 'start');
            i++;
            setTimeout(tick, 850);
        }
        tick();
    }

    function setupLayout(mode) {
        document.body.classList.remove('duel-mode', 'duel-desktop', 'duel-mobile');
        isDuelDesktop = false;
        UI.sharedArea.classList.add('hidden');
        UI.p2Area.classList.add('hidden');
        UI.optsP2.classList.remove('hidden');
        UI.qContainerP1.classList.remove('hidden');
        UI.infoBar.style.display = 'flex';
        if (arenaEl) arenaEl.classList.add('hidden');

        if (mode === 'duel') {
            document.body.classList.add('duel-mode');
            isDuelDesktop = window.matchMedia(DESKTOP_DUEL_QUERY).matches;
            document.body.classList.add(isDuelDesktop ? 'duel-desktop' : 'duel-mobile');
            UI.infoBar.style.display = 'none';
            UI.p2Area.classList.remove('hidden');
            UI.qContainerP1.classList.remove('hidden');
            UI.qContainerP2.classList.remove('hidden');
            UI.optsP2.classList.remove('hidden');
            if (arenaEl && isDuelDesktop) {
                arenaEl.classList.remove('hidden');
                _arenaUpdateWizards();
            }
        }
    }

    function setupPracticeFeedback(mode) {
        ensurePracticeFeedbackUI();
        if (mode === 'practice') {
            setPracticeCoachText(COACH_LINES.intro);
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
        if (!practiceWhyEl) {
            practiceWhyEl = document.createElement('div');
            practiceWhyEl.id = 'practice-why-hint';
            practiceWhyEl.className = 'practice-why-hint hidden';
            UI.qContainerP1.insertAdjacentElement('afterend', practiceWhyEl);
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
        const icon = _muted ? '🔇' : '🔊';
        const label = _muted ? '🔇 靜音' : '🔊 音效';
        const btnMute = document.getElementById('btn-mute');
        const btnMuteGame = document.getElementById('btn-mute-game');
        if (btnMute) btnMute.textContent = label;
        if (btnMuteGame) btnMuteGame.textContent = icon;
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
        pop.textContent = `+${bonus}s`;
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
        clearInterval(timerInterval);
        ['p1', 'p2'].forEach(p => {
            if (readingTimers[p]) { clearTimeout(readingTimers[p]); readingTimers[p] = null; }
        });
        clearPracticeFeedback();
        if (practiceCoachBubbleEl) practiceCoachBubbleEl.classList.add('hidden');
        UI.game.classList.add('hidden');
        UI.resultModal.classList.add('hidden');
        if (UI.storyModal) UI.storyModal.classList.add('hidden');
        UI.menu.classList.remove('hidden');
        document.body.classList.remove('duel-mode', 'duel-desktop', 'duel-mobile');
        updateMenuProgress();
        focusFirstAvailableControl(UI.menu);
    }

    function showReference() {
        if (UI.refModal) UI.refModal.classList.remove('hidden');
        if (UI.btnCloseRef) UI.btnCloseRef.focus();
    }

    function closeReference() {
        if (UI.refModal) UI.refModal.classList.add('hidden');
        if (UI.btnShowRef && !UI.btnShowRef.classList.contains('hidden')) UI.btnShowRef.focus();
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
        if (!el || !label || el.querySelector('.button-hotkey')) return;
        const hint = document.createElement('span');
        hint.className = `button-hotkey button-hotkey-${side}`;
        hint.textContent = `[${label}]`;
        el.prepend(hint);
    }

    function applyKeyboardHints() {
        Object.entries(MENU_SHORTCUTS).forEach(([code, target]) => {
            const btn = UI.menu.querySelector(`.menu-btn[data-mode="${target.mode}"][data-level="${target.level}"]`);
            addButtonHint(btn, keyCodeToLabel(code));
        });

        addButtonHint(UI.btnBack, 'Esc / M');
        addButtonHint(UI.btnRestart, 'Enter / R');
        addButtonHint(UI.btnMenu, 'Esc / M');
        addButtonHint(UI.btnShowRef, 'H');

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
    const STORY_THRESHOLD = 0.6;  // 答對率 ≥ 60%，且至少答 4 題
    const STORY_MIN_ASKED = 4;

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
        const info = SPEAKER_INFO[line.who];
        const name = line.who === 'wiz'
            ? `${wizardPersonas.p1.emoji} ${wizardPersonas.p1.name}`
            : `${info.emoji} 分類帽`;

        UI.storySpeakerEmoji.textContent = line.who === 'wiz' ? wizardPersonas.p1.emoji : info.emoji;
        UI.storySpeakerName.textContent   = line.who === 'wiz' ? wizardPersonas.p1.name : '分類帽';
        UI.storyText.textContent          = _storyReplaceName(line.text);

        UI.storyModalContent.classList.toggle('speaker-wiz', line.who === 'wiz');

        // 更新進度點
        UI.storyDots.querySelectorAll('.story-dot').forEach((dot, i) => {
            dot.classList.toggle('done', i < idx);
            dot.classList.toggle('current', i === idx);
        });

        // 最後一句改按鈕文字
        UI.btnStoryNext.textContent = (idx === _storyLines.length - 1) ? '完成 ✓' : '繼續 →';
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

        UI.storyModal.classList.remove('hidden');
    }

    function _storyAdvance() {
        _storyIdx++;
        if (_storyIdx >= _storyLines.length) {
            _storyClose(true);
        } else {
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

    function _checkStoryThreshold() {
        // 回傳是否本次達門檻
        if (currentMode === 'duel') {
            // 任一玩家贏（correctCount >= DUEL_WIN_TARGET）就算
            return players.p1.correctCount >= DUEL_WIN_TARGET || players.p2.correctCount >= DUEL_WIN_TARGET;
        }
        const p = players.p1;
        if (p.totalAsked < STORY_MIN_ASKED) return false;
        return (p.correctCount / p.totalAsked) >= STORY_THRESHOLD;
    }

    function endGame(resultType, winner) {
        gameActive = false;
        clearInterval(timerInterval);
        ['p1', 'p2'].forEach(p => {
            if (readingTimers[p]) { clearTimeout(readingTimers[p]); readingTimers[p] = null; }
        });
        UI.resultModal.classList.remove('hidden');
        
        let title = "", msg = "";
        if (currentMode === 'duel') {
            if (resultType === 'win') {
                title = (winner === 'p1' ? "P1 獲勝!" : "P2 獲勝!");
                msg = "合成大師誕生了！";
                playSound('win');
            } else {
                title = "平手 (動態平衡)";
                msg = "實驗室維持了完美的平衡...";
                playSound('lose');
            }
            UI.resultStats.innerHTML = `P1: ${players.p1.correctCount}/${DUEL_WIN_TARGET} 題 <br> P2: ${players.p2.correctCount}/${DUEL_WIN_TARGET} 題`;
        } else {
            if (players.p1.hp <= 0) {
                title = "實驗失敗 (爆炸)";
                msg = getRandomMsg('lose');
                playSound('lose');
            } else {
                title = "實驗完成";
                msg = `最終產率: ${players.p1.score}`;
                playSound('win');
            }
            UI.resultStats.innerHTML = `得分: ${players.p1.score}`;
        }
        UI.resultTitle.textContent = title;
        UI.resultMsg.textContent = msg;

        // 故事解鎖判斷
        const alreadyUnlocked = (typeof Save !== 'undefined') && Save.isStoryUnlocked(currentLevel);
        const hasScript = (typeof StoryScripts !== 'undefined') && !!StoryScripts[currentLevel];
        const metThreshold = _checkStoryThreshold();

        if (hasScript && metThreshold && typeof Save !== 'undefined') {
            Save.markLevelClear(currentLevel);
        }

        if (UI.btnShowStory) {
            if (hasScript && metThreshold) {
                UI.btnShowStory.textContent = alreadyUnlocked ? '📖 重播劇情' : '✨ 解鎖劇情！';
                UI.btnShowStory.classList.remove('hidden');
            } else {
                UI.btnShowStory.classList.add('hidden');
            }
        }
    }

    function getRandomMsg(type) {
        const MSG_WIN = ["有機小天才", "路易斯結構大師", "諾貝爾化學獎預備", "合成產率 100%"];
        const MSG_LOSE = ["試管炸裂!", "請重新滴定...", "小心側反應發生", "把碳看成氮了嗎?", "結構崩塌..."];
        return (type==='win') ? MSG_WIN[Math.floor(Math.random()*MSG_WIN.length)] : MSG_LOSE[Math.floor(Math.random()*MSG_LOSE.length)];
    }

    // --- 題目生成 ---
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function nextQuestion() {
        if (!gameActive) return;
        if (currentMode === 'duel') {
            nextDuelQuestion('p1');
            nextDuelQuestion('p2');
            return;
        }
        const list = QuestionSets[currentLevel];
        if (!list || list.length === 0) return;

        if (questionQueueLevel !== currentLevel || questionQueue.length === 0) {
            // 一輪結束：判斷 Practice 通關門檻（正確率 ≥ 60%）
            if (currentMode === 'practice' && practiceRoundTotal > 0) {
                if (practiceRoundCorrect / practiceRoundTotal >= 0.6) {
                    Save.markLevelClear(currentLevel);
                }
            }
            practiceRoundTotal = list.length;
            practiceRoundCorrect = 0;
            questionQueue = shuffleArray([...list]);
            if (currentQuestion && questionQueue.length > 1 &&
                questionQueue[questionQueue.length - 1] === currentQuestion) {
                [questionQueue[0], questionQueue[questionQueue.length - 1]] =
                    [questionQueue[questionQueue.length - 1], questionQueue[0]];
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
        const list = QuestionSets[currentLevel];
        if (!list || list.length === 0) return;
        const pq = duelQ[player];

        if (pq.queueLevel !== currentLevel || pq.queue.length === 0) {
            pq.queue = shuffleArray([...list]);
            if (pq.question && pq.queue.length > 1 &&
                pq.queue[pq.queue.length - 1] === pq.question) {
                [pq.queue[0], pq.queue[pq.queue.length - 1]] =
                    [pq.queue[pq.queue.length - 1], pq.queue[0]];
            }
            pq.queueLevel = currentLevel;
        }

        const qData = pq.queue.pop();
        pq.question = qData;
        pq.correctKey = qData.aKey;

        const options = generateOptions(pq.correctKey, currentLevel);
        renderDuelQuestion(player, qData, options);
        startReadingPeriod(player);
    }

    function renderDuelQuestion(player, qData, options) {
        const qContentEl = (player === 'p1') ? UI.qContentP1 : UI.qContentP2;
        const optsEl = (player === 'p1') ? UI.optsP1 : UI.optsP2;

        const imgTag = `<img src="${qData.qContent}" alt="Structure" draggable="false">`;
        qContentEl.innerHTML = imgTag;
        qContentEl.querySelector('img').onerror = () => { qContentEl.innerHTML = "<span class='q-text'>圖片遺失</span>"; };

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
        const optsEl = (player === 'p1') ? UI.optsP1 : UI.optsP2;
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
        const hpEl = (player === 'p1') ? UI.hpP1 : UI.hpP2;
        const areaEl = (player === 'p1') ? UI.p1Area : UI.p2Area;
        const count = players[player].correctCount;
        const pct = Math.min((count / DUEL_WIN_TARGET) * 100, 100);
        hpEl.style.width = `${pct}%`;
        hpEl.style.background = '';
        const hpTextEl = areaEl.querySelector('.hp-text');
        if (hpTextEl) hpTextEl.textContent = `進度 ${count}/${DUEL_WIN_TARGET}`;
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
            if (upTo === -1) {
                Object.keys(AnswerBank).forEach(k => { if (AnswerBank[k].category !== 'cat') earlierKeys.add(k); });
            } else {
                (QuestionSets[level] || []).forEach(q => thisLevelKeys.add(q.aKey));
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
        if (e.repeat) return;

        // 魔法師選擇框優先接管鍵盤
        if (isVisible(UI.wizardPicker)) {
            const inInput = e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if (inInput) {
                if (e.code === 'Escape') { e.preventDefault(); UI.btnPickerCancel.click(); return; }
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

        let player = 'p1';
        let optionIndex;

        if (currentMode === 'duel') {
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

        const container = player === 'p1' ? UI.optsP1 : UI.optsP2;
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
                indicator.textContent = '🔧 測試模式：答對1題即結算';
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
            if (e.code === 'KeyR' || e.code === 'Enter') {
                e.preventDefault();
                startGame(currentMode, currentLevel);
                return true;
            }
            if (e.code === 'KeyM' || e.code === 'Escape') {
                e.preventDefault();
                showMenu();
                return true;
            }
            return false;
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
            return false;
        }

        if (isVisible(UI.game)) {
            if (e.code === 'Escape' || e.code === 'KeyM') {
                e.preventDefault();
                showMenu();
                return true;
            }
            if (e.code === 'KeyR') {
                e.preventDefault();
                startGame(currentMode, currentLevel);
                return true;
            }
        }

        return false;
    }

    function getActivePanel() {
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

        const controls = getFocusableControls(getActivePanel());
        if (!controls.length) return false;

        e.preventDefault();
        const current = controls.includes(document.activeElement) ? document.activeElement : null;
        if (!current) {
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
        playSound('correct');
        btn.classList.add('correct');
        players[player].totalAsked++;
        players[player].correctCount++;

        if (currentMode === 'duel') {
            const duelBadges = Save.addCorrect(1);
            if (duelBadges && duelBadges.length) showBadgeToast(duelBadges[0]);
            Save.seeMolecule(duelQ[player].correctKey);
            updateDuelProgress(player);
            duelArenaAttack(player);
            if (_devQuickWin || players[player].correctCount >= DUEL_WIN_TARGET) {
                endGame('win', player);
                return;
            }
            setTimeout(() => nextDuelQuestion(player), 700);
            return;
        }

        // practice / speed mode
        if (_devQuickWin) {
            // 測試模式：強制達門檻結算
            practiceRoundTotal = STORY_MIN_ASKED;
            practiceRoundCorrect = STORY_MIN_ASKED;
            players[player].totalAsked = STORY_MIN_ASKED;
            players[player].correctCount = STORY_MIN_ASKED;
            players[player].score += 10;
            updateStats(player);
            Save.addCorrect(1);
            Save.seeMolecule(correctAnswerKey);
            setTimeout(() => endGame('win', player), 600);
            return;
        }

        practiceWrongStreak = 0;
        const newBadges = Save.addCorrect(1);
        if (newBadges && newBadges.length) showBadgeToast(newBadges[0]);
        Save.seeMolecule(correctAnswerKey);
        if (currentMode === 'practice') {
            practiceRoundCorrect++;
            const lines = COACH_LINES.correct;
            setPracticeCoachText(lines[Math.floor(Math.random() * lines.length)]);
        }
        if (currentMode === 'speed') {
            const bonus = players[player].combo >= 2 ? (players[player].combo >= 3 ? 4 : 3) : 2;
            timeLeft = Math.min(timeLeft + bonus, MAX_TIME);
            showTimeBonus(bonus, UI.optsP1);
            const speedLines = ['⚡ 繼續！', '🔥 燃燒！', '💥 完美！', '✨ 加速！', '🚀 快！'];
            setPracticeCoachText(speedLines[Math.floor(Math.random() * speedLines.length)]);
        }

        players[player].score += (10 + players[player].combo * 2);
        players[player].combo++;
        players[player].hp = Math.min(players[player].hp + 5, players[player].maxHp);
        triggerComboAttack(player);
        updateStats(player);

        setTimeout(() => { nextQuestion(); }, 1000);
    }

    function handleWrong(player, btn) {
        playSound('wrong');
        btn.classList.add('wrong');
        players[player].totalAsked++;
        revealCorrectAnswer(player);
        showPracticeWrongHint();

        players[player].combo = 0;
        if (currentMode !== 'duel') {
            players[player].hp -= 20;
        } else {
            duelArenaFizzle(player);
        }

        players[player].isLocked = true;
        const container = (player === 'p1') ? UI.optsP1 : UI.optsP2;
        container.classList.add('locked-area');

        if (currentMode !== 'duel') {
            Save.recordWrong(correctAnswerKey);
        }

        const warnEl = (player === 'p1') ? UI.warnP1 : UI.warnP2;
        warnEl.textContent = "試管破了!";
        warnEl.classList.remove('hidden');

        const lockDuration = (currentMode === 'duel') ? DUEL_LOCK_MS : 1600;
        if (lockTimers[player]) clearTimeout(lockTimers[player]);
        lockTimers[player] = setTimeout(() => {
            players[player].isLocked = false;
            container.classList.remove('locked-area');
            warnEl.classList.add('hidden');
            warnEl.textContent = '快炸了!';
            btn.classList.remove('wrong');
            clearCorrectReveal(player);
            lockTimers[player] = null;
        }, lockDuration);

        if (currentMode !== 'duel') {
            updateStats(player);
            if (players[player].hp <= 0) endGame('lose');
        }
    }

    function getOptionContainerForPlayer(player) {
        return player === 'p1' ? UI.optsP1 : UI.optsP2;
    }

    function revealCorrectAnswer(player) {
        const correctKey = (currentMode === 'duel') ? duelQ[player].correctKey : correctAnswerKey;
        const container = getOptionContainerForPlayer(player);
        const correctBtn = container.querySelector(`.opt-btn[data-key="${correctKey}"]`);
        if (correctBtn) correctBtn.classList.add('reveal-correct');
    }

    function clearCorrectReveal(player) {
        const container = player === 'p1' ? UI.optsP1 : UI.optsP2;
        container.querySelectorAll('.reveal-correct').forEach(el => el.classList.remove('reveal-correct'));
    }

    function showPracticeWrongHint() {
        if (currentMode !== 'practice') return;

        practiceWrongStreak++;
        const hint = getWhyHintForAnswer(correctAnswerKey);
        if (!hint) return;

        ensurePracticeFeedbackUI();
        practiceWhyEl.textContent = `為什麼：${hint}`;
        practiceWhyEl.classList.remove('hidden');

        const coachText = practiceWrongStreak >= 3
            ? `${hint} ${COACH_LINES.streak}`
            : hint;
        setPracticeCoachText(coachText);
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
    const arenaEl   = document.getElementById('duel-arena');
    const arenaP1El = document.getElementById('arena-p1');
    const arenaP2El = document.getElementById('arena-p2');

    function _arenaOnce(el, cls, dur) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), dur);
    }

    function _arenaShake() {
        if (!arenaEl) return;
        _arenaOnce(arenaEl, 'arena-shake', 320);
    }

    function _arenaSpawnBolt(caster, comboCount) {
        if (!arenaEl) return;
        const b = document.createElement('div');
        b.className = 'arena-bolt';
        b.textContent = comboCount >= 3 ? '🌩️' : '⚡';
        const toP2 = (caster === 'p1');
        b.style.animation = (toP2 ? 'arenaBoltLR' : 'arenaBoltRL') + ' .32s linear forwards';
        if (toP2) b.style.left = '15%'; else b.style.right = '15%';
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

        // 被擊中
        _arenaOnce(targetEl, 'arena-hit', 580);
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
        _arenaOnce(casterEl, 'arena-charging', 290);
        setTimeout(() => _arenaSpawnBolt(player, comboCount), 200);
    }

    function duelArenaFizzle(player) {
        if (!arenaEl || arenaEl.classList.contains('hidden') || !isDuelDesktop) return;
        const casterEl = player === 'p1' ? arenaP1El : arenaP2El;
        _arenaOnce(casterEl, 'arena-fizzle', 520);

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
        arenaP1El.querySelector('.arena-wiz-emoji').textContent = wizardPersonas.p1.emoji;
        arenaP1El.querySelector('.arena-wiz-label').textContent = wizardPersonas.p1.name;
        arenaP2El.querySelector('.arena-wiz-emoji').textContent = wizardPersonas.p2.emoji;
        arenaP2El.querySelector('.arena-wiz-label').textContent = wizardPersonas.p2.name;
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
        const hpEl = (p==='p1') ? UI.hpP1 : UI.hpP2;
        const scoreEl = (p==='p1') ? UI.scoreP1 : UI.scoreP2;
        
        hpEl.style.width = `${data.hp}%`;
        if (data.hp < 30) hpEl.style.background = 'linear-gradient(to right, #c0392b, #7f0909)';
        else hpEl.style.background = ''; 
        scoreEl.textContent = data.score;
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
        }
    }

    return { init };
})();

window.addEventListener('load', Game.init);
