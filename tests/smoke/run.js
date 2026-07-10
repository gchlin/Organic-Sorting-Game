// 煙霧測試：驗證重構（切檔）前後遊戲行為不變。
// 用法：cd tests/smoke && npm install && node run.js
// 需要本機 Chrome 或 Edge；不會下載瀏覽器。
// 涵蓋：練習流程（含答錯閃爍、打完一輪到結算）、對決流程（搶答前後的
// 看教學泡泡）、多視窗尺寸泡泡可見性、圖鑑/錯題本/設定畫面渲染。

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8941;
const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
    '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};
const BROWSERS = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function serve() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            fs.readFile(path.join(ROOT, p), (err, data) => {
                if (err) { res.writeHead(404); res.end(); return; }
                res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(PORT, () => resolve(server));
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 關掉自動打開的教學／故事（新關卡第一次進入會自動彈出）
async function closeOverlays(page) {
    for (let i = 0; i < 15; i++) {
        const closed = await page.evaluate(() => {
            const c = document.querySelector('[data-action="tutorial-close"]');
            if (c && c.offsetParent !== null) { c.click(); return 1; }
            const s = document.querySelector('#screen-story.is-active');
            if (s) { s.click(); return 1; }
            return null;
        });
        if (!closed) return;
        await sleep(250);
    }
}

async function enterPractice(page) {
    await page.click('[data-action="enter-difficulty"][data-arg="beginner"]');
    await page.waitForSelector('#screen-sub-menu.is-active');
    await page.evaluate(() => { document.querySelector('#sub-menu-list button:not(.v2-tutorial-entry)').click(); });
    await sleep(700);
    await closeOverlays(page);
    await sleep(400);
}

// 看教學按鈕沒被蓋住、點擊後泡泡在視窗內可見
async function assertHintBubbleWorks(page, label, failures) {
    const probe = await page.evaluate(() => {
        const b = document.querySelector('[data-action="show-tutorial"]');
        if (!b) return { error: 'button missing' };
        const r = b.getBoundingClientRect();
        if (r.width === 0) return { error: 'button zero-size / hidden' };
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!(el === b || b.contains(el))) return { error: 'button covered by ' + (el && el.tagName + '#' + el.id) };
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (probe.error) { failures.push(`${label}: ${probe.error}`); return false; }
    await page.mouse.click(probe.x, probe.y);
    await sleep(300);
    const bubble = await page.evaluate(() => {
        const hb = document.getElementById('game-hint-bubble');
        const cs = getComputedStyle(hb);
        const r = hb.getBoundingClientRect();
        return {
            ok: cs.display !== 'none' && r.height > 10 && r.top >= 0 && r.top < innerHeight && hb.innerHTML.length > 0,
            detail: `display=${cs.display} top=${Math.round(r.top)} h=${Math.round(r.height)} vh=${innerHeight}`,
        };
    });
    if (!bubble.ok) { failures.push(`${label}: bubble not visible (${bubble.detail})`); return false; }
    await page.mouse.click(probe.x, probe.y); // 關回去
    await sleep(200);
    return true;
}

// 答對後不自動換題：停在 awaitingContinue，導師講解該分子的用途。
async function assertCorrectPause(page, failures) {
    const st = await page.evaluate(() => {
        const cont = document.getElementById('game-continue');
        const bub = document.getElementById('game-mentor-bubble');
        return {
            awaiting: document.body.classList.contains('phase-awaiting-continue'),
            contShown: !!cont && cont.style.display !== 'none',
            bubbleText: bub ? bub.textContent.trim() : '',
        };
    });
    if (!st.awaiting) { failures.push('practice: correct answer did not pause at awaitingContinue'); return; }
    if (!st.contShown) failures.push('practice: continue button hidden while awaiting continue');
    if (!st.bubbleText) failures.push('practice: mentor said nothing after a correct answer');

    // 控制列不能蓋到分子圖
    const clash = await page.evaluate(() => {
        const c = document.getElementById('game-controls').getBoundingClientRect();
        const i = document.getElementById('game-image-container').getBoundingClientRect();
        const hit = !(c.right <= i.left || c.left >= i.right || c.bottom <= i.top || c.top >= i.bottom);
        return { hit, inView: c.bottom <= innerHeight + 1 };
    });
    if (clash.hit) failures.push('practice: control row overlaps the molecule card');
    if (!clash.inView) failures.push('practice: control row pushed below the viewport');

    // ← 進入唯讀回顧：看得到正解，但點選項不能改變 phase。
    await page.keyboard.press('ArrowLeft');
    await sleep(250);
    const rv = await page.evaluate(() => {
        const reviewing = document.body.classList.contains('is-reviewing');
        const revealed = !!document.querySelector('#game-options .option-btn.correct-reveal');
        const before = document.body.className;
        const o = document.querySelector('#game-options .option-btn[data-option-key]');
        if (o) o.click();
        return { reviewing, revealed, changed: document.body.className !== before };
    });
    if (!rv.reviewing) failures.push('practice: ArrowLeft did not enter review');
    if (!rv.revealed) failures.push('practice: review does not mark the correct option');
    if (rv.changed) failures.push('practice: clicking an option during review changed state');
    await page.keyboard.press('Escape');
    await sleep(250);
    const back = await page.evaluate(() => ({
        reviewing: document.body.classList.contains('is-reviewing'),
        onGame: !!document.querySelector('#screen-game.is-active'),
    }));
    if (back.reviewing) failures.push('practice: Escape did not leave review');
    if (!back.onGame) failures.push('practice: Escape during review left the game screen');
}

async function pressContinue(page) {
    await page.evaluate(() => {
        const c = document.getElementById('game-continue');
        if (c && c.style.display !== 'none') c.click();
    });
}

// 場景 1：練習流程 — 泡泡、答錯閃爍、一路打到結算畫面
async function scenarioPractice(browser, failures) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
    await enterPractice(page);

    const onGame = await page.evaluate(() => !!document.querySelector('#screen-game.is-active.mode-practice'));
    if (!onGame) { failures.push('practice: game screen not active'); await page.close(); return; }

    await assertHintBubbleWorks(page, 'practice 1366x768', failures);

    // 點選項直到答錯一次 → 「看教學」文字要有閃爍動畫 class
    let sawFlash = false;
    for (let i = 0; i < 6 && !sawFlash; i++) {
        await page.evaluate(() => {
            const o = document.querySelector('#game-options .option-btn[data-option-key]');
            if (o) o.click();
        });
        await sleep(250);
        const st = await page.evaluate(() => ({
            wrong: document.body.className.includes('phase-resolving-wrong'),
            flash: !!document.querySelector('.v2-game-tutorial-label.hint-flash-text'),
        }));
        if (st.wrong) {
            sawFlash = st.flash;
            if (!st.flash) failures.push('practice: wrong answer but no hint-flash-text on label');
            break;
        }
        await sleep(1400);          // 答對 → 停在 awaitingContinue
        await assertCorrectPause(page, failures);
        await pressContinue(page);
        await sleep(400);
    }

    // 打完整輪到結算。practice 答錯不換題（同一題重選），而 .eliminated class
    // 會被 cleanup effect 洗掉，所以由測試端自己記住這題試過哪些選項。
    let settled = false;
    let lastProg = '';
    let tried = [];
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
        const snap = await page.evaluate((tried) => {
            if (document.querySelector('#screen-settle.is-active')) return { settled: true };
            const prog = (document.getElementById('game-question-progress') || {}).textContent || '';
            // 答對後停在 awaitingContinue，要按「繼續」才會換題
            const cont = document.getElementById('game-continue');
            if (cont && cont.style.display !== 'none') { cont.click(); return { prog, continued: true }; }
            if (document.body.classList.contains('input-locked')) return { prog };
            const opts = Array.from(document.querySelectorAll('#game-options .option-btn[data-option-key]'));
            const o = opts.find(x => tried.indexOf(x.getAttribute('data-option-key')) === -1);
            if (!o) return { prog };
            o.click();
            return { prog, clicked: o.getAttribute('data-option-key') };
        }, tried);
        if (snap.settled) { settled = true; break; }
        if (snap.prog && snap.prog !== lastProg) { lastProg = snap.prog; tried = []; }
        if (snap.clicked) tried.push(snap.clicked);
        await sleep(500);
    }
    if (!settled) { failures.push('practice: never reached settle screen'); await page.close(); return; }
    const settleOk = await page.evaluate(() => {
        const stats = document.getElementById('settle-stats');
        return !!(stats && stats.children.length >= 2);
    });
    if (!settleOk) failures.push('practice: settle stats empty');
    await page.close();
}

// 場景 2：對決流程 — 搶答前後泡泡都要能開
async function scenarioDuel(browser, failures) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
    await page.click('[data-action="enter-duel-menu"][data-arg="beginner"]');
    await page.waitForSelector('#screen-sub-menu.is-active');
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('#sub-menu-list button'));
        const b = btns.find(x => !x.classList.contains('v2-duel-mode-option'));
        if (b) b.click();
    });
    await sleep(700);
    await closeOverlays(page);
    await sleep(400);

    const onGame = await page.evaluate(() => !!document.querySelector('#screen-game.is-active.mode-duel'));
    if (!onGame) { failures.push('duel: game screen not active'); await page.close(); return; }

    await assertHintBubbleWorks(page, 'duel pre-buzz', failures);

    await page.keyboard.press('Space'); // P1 搶答
    await sleep(400);
    const buzzed = await page.evaluate(() => document.body.className.includes('phase-buzzed'));
    if (!buzzed) failures.push('duel: Space did not enter buzzed phase');
    else await assertHintBubbleWorks(page, 'duel buzzed', failures);
    await page.close();
}

// 場景 3：多視窗尺寸 — 泡泡在每種尺寸都要看得到（曾因 grid-area 定位壞在中段尺寸）
async function scenarioViewports(browser, failures) {
    const SIZES = [[1920, 945], [1536, 703], [1366, 768], [1280, 600], [1100, 519], [360, 640]];
    for (const [w, h] of SIZES) {
        const page = await browser.newPage();
        await page.setViewport({ width: w, height: h });
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
        await enterPractice(page);
        await assertHintBubbleWorks(page, `viewport ${w}x${h}`, failures);
        await page.close();
    }
}

// 場景 4：圖鑑 / 錯題本 / 設定 — 進得去、有內容、回得來
async function scenarioMenuScreens(browser, failures) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
    const screens = [
        ['enter-codex', 'screen-codex'],
        ['enter-wrong-book', 'screen-wrong-book'],
        ['enter-settings', 'screen-settings'],
    ];
    for (const [action, screenId] of screens) {
        await page.click(`[data-action="${action}"]`);
        await sleep(400);
        const ok = await page.evaluate((id) => {
            const s = document.getElementById(id);
            return !!(s && s.classList.contains('is-active') && s.textContent.trim().length > 0);
        }, screenId);
        if (!ok) failures.push(`${screenId}: not active or empty`);
        await page.keyboard.press('Escape');
        await sleep(300);
        const backHome = await page.evaluate(() => !!document.querySelector('#screen-main-menu.is-active'));
        if (!backHome) failures.push(`${screenId}: Escape did not return to main menu`);
    }
    await page.close();
}

(async () => {
    const exe = BROWSERS.find(p => fs.existsSync(p));
    if (!exe) { console.error('FAIL: no Chrome/Edge found'); process.exit(1); }
    const server = await serve();
    const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
    const failures = [];
    const scenarios = [
        ['practice', scenarioPractice],
        ['duel', scenarioDuel],
        ['viewports', scenarioViewports],
        ['menu-screens', scenarioMenuScreens],
    ];
    for (const [name, fn] of scenarios) {
        const before = failures.length;
        try { await fn(browser, failures); }
        catch (e) { failures.push(`${name}: threw ${e.message}`); }
        console.log(`${failures.length === before ? 'PASS' : 'FAIL'}  ${name}`);
    }
    await browser.close();
    server.close();
    if (failures.length) {
        console.log('\n--- failures ---');
        failures.forEach(f => console.log('  ✗ ' + f));
        process.exit(1);
    }
    console.log('\nALL GREEN');
})();
