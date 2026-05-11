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
        btnBack: document.getElementById('btn-back')
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

        UI.btnBack.addEventListener('click', showMenu);
        UI.btnMenu.addEventListener('click', showMenu);
        UI.btnRestart.addEventListener('click', () => startGame(currentMode, currentLevel));

        preloadImages();
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

        // 重置玩家數據
        ['p1', 'p2'].forEach(p => {
            players[p] = { score: 0, hp: 100, combo: 0, maxHp: 100, isLocked: false };
            updateStats(p);
            // 清除之前的 Combo 動畫
            document.querySelectorAll(`.combo-projectile.${p}-atk`).forEach(el => el.remove());
        });

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
        document.body.classList.remove('duel-mode');
        UI.sharedArea.classList.add('hidden');
        UI.p2Area.classList.add('hidden');
        UI.qContainerP1.classList.remove('hidden');
        UI.infoBar.style.display = 'flex';

        if (mode === 'duel') {
            document.body.classList.add('duel-mode');
            UI.infoBar.style.display = 'none';
            UI.p2Area.classList.remove('hidden');
            UI.qContainerP1.classList.add('hidden');
            UI.sharedArea.classList.remove('hidden');
        }
    }

    function showMenu() {
        gameActive = false;
        clearInterval(timerInterval);
        UI.game.classList.add('hidden');
        UI.resultModal.classList.add('hidden');
        UI.menu.classList.remove('hidden');
        document.body.classList.remove('duel-mode');
    }

    function getModeName(m) {
        if(m==='speed') return "競速挑戰";
        if(m==='duel') return "巫師對決";
        return "自我修煉";
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
    function nextQuestion() {
        if (!gameActive) return;
        const list = QuestionSets[currentLevel];
        if (!list || list.length === 0) return;

        const qData = list[Math.floor(Math.random() * list.length)];
        currentQuestion = qData;
        correctAnswerKey = qData.aKey;

        const options = generateOptions(correctAnswerKey, currentLevel);
        renderQuestion(qData, options);
    }

    function generateOptions(correctKey, level) {
        const isLevel99 = (level === 'level99');
        if (!AnswerBank[correctKey]) return [];

        let pool = Object.keys(AnswerBank).filter(k => {
            if (k === correctKey) return false;
            const item = AnswerBank[k];
            const isCategoryType = (item.category === 'cat');
            return isLevel99 ? isCategoryType : !isCategoryType;
        });
        
        pool.sort(() => Math.random() - 0.5);
        const distractors = pool.slice(0, 3);
        const finalKeys = [correctKey, ...distractors].sort(() => Math.random() - 0.5);
        
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
            // 解除鎖定狀態
            players[playerPrefix].isLocked = false; 
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'btn opt-btn magic-stone-btn';
                btn.textContent = opt.text;
                btn.dataset.key = opt.key;
                container.appendChild(btn);
            });
        };

        renderBtns(UI.optsP1, 'p1');
        if (currentMode === 'duel') renderBtns(UI.optsP2, 'p2');
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
        container.classList.add('locked-area'); // CSS 控制變灰

        // 警告文字
        const warnEl = (player === 'p1') ? UI.warnP1 : UI.warnP2;
        warnEl.textContent = "試管破了!";
        warnEl.classList.remove('hidden');
        
        // 1秒後解除鎖定
        setTimeout(() => {
            if(gameActive) {
                players[player].isLocked = false;
                container.classList.remove('locked-area');
                warnEl.classList.add('hidden');
                // 移除按鈕錯誤樣式，讓玩家可以重選
                btn.classList.remove('wrong'); 
            }
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