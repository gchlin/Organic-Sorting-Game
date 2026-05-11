// game.js - 有機分類帽 (修復音效、冷卻與Combo攻擊版)

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
    let isDuelDesktop = false;

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
        btnCloseRef: document.getElementById('btn-close-ref')
    };

    // 音效 Context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // --- 初始化 ---
    function init() {
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // 強制喚醒音效引擎 (解決瀏覽器阻擋問題)
                if (audioCtx.state === 'suspended') audioCtx.resume();
                startGame(btn.dataset.mode, btn.dataset.level);
            });
        });

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

        preloadImages();
        applyKeyboardHints();
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
            players[p] = { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false };
            updateStats(p);
            // 清除之前的 Combo 動畫
            document.querySelectorAll(`.combo-projectile.${p}-atk`).forEach(el => el.remove());
            // 清掉上一局可能殘留的「試管破了」警告與冷卻鎖定（修復警告卡住、選項變灰無法點的 bug）
            if (lockTimers[p]) { clearTimeout(lockTimers[p]); lockTimers[p] = null; }
            const warnEl = (p === 'p1') ? UI.warnP1 : UI.warnP2;
            warnEl.classList.add('hidden');
            warnEl.textContent = '快炸了!';
            const optsEl = (p === 'p1') ? UI.optsP1 : UI.optsP2;
            optsEl.classList.remove('locked-area');
        });
        UI.timeBar.classList.remove('time-running-out');
        // 強制重洗題目佇列
        questionQueue = [];
        questionQueueLevel = null;
        currentQuestion = null;

        UI.menu.classList.add('hidden');
        UI.resultModal.classList.add('hidden');
        UI.game.classList.remove('hidden');
        UI.modeTitle.textContent = getModeName(mode);
        UI.levelTitle.textContent = level.toUpperCase();

        setupLayout(mode);

        if (timerInterval) clearInterval(timerInterval);
        if (mode !== 'practice') {
            UI.timeBar.style.width = '100%';
            timerInterval = setInterval(gameLoop, 100);
        } else {
            UI.timeBar.style.width = '100%';
        }

        nextQuestion();
    }

    function setupLayout(mode) {
        document.body.classList.remove('duel-mode', 'duel-desktop', 'duel-mobile');
        isDuelDesktop = false;
        UI.sharedArea.classList.add('hidden');
        UI.p2Area.classList.add('hidden');
        UI.optsP2.classList.remove('hidden');
        UI.qContainerP1.classList.remove('hidden');
        UI.infoBar.style.display = 'flex';

        if (mode === 'duel') {
            document.body.classList.add('duel-mode');
            isDuelDesktop = window.matchMedia(DESKTOP_DUEL_QUERY).matches;
            document.body.classList.add(isDuelDesktop ? 'duel-desktop' : 'duel-mobile');
            UI.infoBar.style.display = 'none';
            UI.p2Area.classList.remove('hidden');
            UI.qContainerP1.classList.add('hidden');
            UI.sharedArea.classList.remove('hidden');
            if (isDuelDesktop) UI.optsP2.classList.add('hidden');
        }
    }

    function showMenu() {
        gameActive = false;
        clearInterval(timerInterval);
        UI.game.classList.add('hidden');
        UI.resultModal.classList.add('hidden');
        UI.menu.classList.remove('hidden');
        document.body.classList.remove('duel-mode', 'duel-desktop', 'duel-mobile');
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

    function endGame(resultType, winner) {
        gameActive = false;
        clearInterval(timerInterval);
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
            UI.resultStats.innerHTML = `P1: ${players.p1.score} 分 <br> P2: ${players.p2.score} 分`;
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
        const list = QuestionSets[currentLevel];
        if (!list || list.length === 0) return;

        // 洗牌佇列：發完一輪才重洗，保證一輪內不重複；換關卡時重建
        if (questionQueueLevel !== currentLevel || questionQueue.length === 0) {
            questionQueue = shuffleArray([...list]);
            // 避免新一輪第一題剛好等於剛出過的那題（連續重複觀感差）
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
        focusFirstAvailableControl(UI.game);
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
        const isCorrect = (selectedKey === correctAnswerKey);

        if (isCorrect) {
            handleCorrect(player, btn);
        } else {
            handleWrong(player, btn);
        }
    }

    function handleKeyboardInput(e) {
        if (e.repeat) return;
        if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

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

        const container = (currentMode === 'duel' && isDuelDesktop) ? UI.optsP1 : (player === 'p1' ? UI.optsP1 : UI.optsP2);
        const btn = container.querySelector(`.opt-btn[data-idx="${optionIndex}"]`);
        if (!btn) return;
        e.preventDefault();
        handleOptionClick({ target: btn }, player);
    }

    function handleGlobalShortcut(e) {
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
        
        // 計算分數與 Combo
        players[player].score += (10 + players[player].combo * 2);
        players[player].combo++;
        players[player].hp = Math.min(players[player].hp + 5, players[player].maxHp);

        // 觸發 Combo 攻擊動畫
        triggerComboAttack(player);
        updateStats(player);

        // 對戰模式有人答對就換題；單人模式延遲換題
        setTimeout(() => {
            nextQuestion();
        }, 400);
    }

    function handleWrong(player, btn) {
        playSound('wrong');
        btn.classList.add('wrong'); // 這裡 CSS 會處理「無紅色背景」
        
        players[player].combo = 0;
        players[player].hp -= 20;
        
        // 2. 觸發冷卻 (鎖定該玩家按鈕)
        players[player].isLocked = true;
        const container = (player === 'p1') ? UI.optsP1 : UI.optsP2;
        const shouldLockContainer = !(currentMode === 'duel' && isDuelDesktop);
        if (shouldLockContainer) container.classList.add('locked-area'); // CSS 控制變灰

        // 警告文字
        const warnEl = (player === 'p1') ? UI.warnP1 : UI.warnP2;
        warnEl.textContent = "試管破了!";
        warnEl.classList.remove('hidden');

        // 1秒後解除鎖定（不再用 gameActive 當守衛——即使這次答錯導致遊戲結束，UI 也要清乾淨）
        if (lockTimers[player]) clearTimeout(lockTimers[player]);
        lockTimers[player] = setTimeout(() => {
            players[player].isLocked = false;
            if (shouldLockContainer) container.classList.remove('locked-area');
            warnEl.classList.add('hidden');
            warnEl.textContent = '快炸了!';
            // 移除按鈕錯誤樣式，讓玩家可以重選
            btn.classList.remove('wrong');
            lockTimers[player] = null;
        }, 1000); // 1秒冷卻

        updateStats(player);

        if (players[player].hp <= 0) {
            if (currentMode === 'duel') endGame('win', (player === 'p1' ? 'p2' : 'p1'));
            else endGame('lose');
        }
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

        // 動畫結束後移除 DOM
        projectile.addEventListener('animationend', () => {
            projectile.remove();
        });
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
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
    }

    return { init };
})();

window.addEventListener('load', Game.init);
