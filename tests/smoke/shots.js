// 截圖基準線工具：CSS 重構的視覺回歸護欄。
// 用法：
//   node shots.js --baseline   拍基準線到 shots/baseline/
//   node shots.js --compare    重拍到 shots/current/ 並和 baseline 逐位元組比對
// 決定性來源：Math.random 換成固定種子 PRNG（題目/選項順序固定）、
// 動畫/過渡全關、等 fonts.ready。同一台機器同版 Chrome 下輸出位元組穩定。

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8951;
const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg',
};
const BROWSERS = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

// 固定種子 PRNG（mulberry32），讓題目抽選/選項洗牌每次一樣
const SEED_SNIPPET = `(function () {
    // 關掉首頁魔導書待機表情循環，讓主選單截圖決定性
    window.__NO_HAT_IDLE__ = true;
    let s = 42;
    Math.random = function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
})();`;

const FREEZE_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';

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

async function newPage(browser, w, h) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    // 固定媒體特徵：headless 會繼承主機的 reduce 設定，鎖住才能跨機器決定性
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    // 擋掉外部字體（Google Fonts）：載入時機是競態來源，一律用本地 fallback 才決定性
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const u = req.url();
        if (u.includes('googleapis.com') || u.includes('gstatic.com')) req.abort();
        else req.continue();
    });
    await page.evaluateOnNewDocument(SEED_SNIPPET);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
    await page.addStyleTag({ content: FREEZE_CSS });
    await page.evaluate(() => document.fonts.ready);
    return page;
}

async function shot(page, dir, name) {
    await sleep(250);
    await page.screenshot({ path: path.join(dir, name + '.png') });
}

async function captureAll(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const exe = BROWSERS.find(p => fs.existsSync(p));
    if (!exe) throw new Error('no Chrome/Edge found');
    const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });

    // --- 選單類（1366x768） ---
    let page = await newPage(browser, 1366, 768);
    await shot(page, dir, 'main-menu-1366');

    await page.click('[data-action="enter-difficulty"][data-arg="beginner"]');
    await sleep(300);
    await shot(page, dir, 'sub-menu-practice-1366');
    await page.keyboard.press('Escape');
    await sleep(300);

    await page.click('[data-action="enter-duel-menu"][data-arg="beginner"]');
    await sleep(300);
    await shot(page, dir, 'sub-menu-duel-1366');
    await page.keyboard.press('Escape');
    await sleep(300);

    await page.click('[data-action="enter-codex"]');
    await sleep(400);
    await shot(page, dir, 'codex-1366');
    await page.keyboard.press('Escape');
    await sleep(300);

    await page.click('[data-action="enter-wrong-book"]');
    await sleep(400);
    await shot(page, dir, 'wrong-book-empty-1366');
    await page.keyboard.press('Escape');
    await sleep(300);

    await page.click('[data-action="enter-settings"]');
    await sleep(400);
    await shot(page, dir, 'settings-1366');
    await page.keyboard.press('Escape');
    await sleep(300);

    // --- 練習：教學 modal → 遊戲畫面 → 快速提示泡泡（種子固定 → 題目固定） ---
    await page.click('[data-action="enter-difficulty"][data-arg="beginner"]');
    await sleep(300);
    await page.evaluate(() => { document.querySelector('#sub-menu-list button:not(.v2-tutorial-entry)').click(); });
    await sleep(800);
    const hasTutorialModal = await page.evaluate(() =>
        !!document.querySelector('[data-action="tutorial-close"]'));
    if (hasTutorialModal) await shot(page, dir, 'tutorial-modal-1366');
    await closeOverlays(page);
    await sleep(400);
    await shot(page, dir, 'practice-game-1366');
    const bb = await page.evaluate(() => {
        const b = document.querySelector('[data-action="show-tutorial"]');
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(bb.x, bb.y);
    await sleep(300);
    await shot(page, dir, 'practice-quickhint-1366');
    await page.close();

    // --- 對決畫面（1366x768，搶答前） ---
    page = await newPage(browser, 1366, 768);
    await page.click('[data-action="enter-duel-menu"][data-arg="beginner"]');
    await sleep(300);
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('#sub-menu-list button'));
        const b = btns.find(x => !x.classList.contains('v2-duel-mode-option'));
        if (b) b.click();
    });
    await sleep(800);
    await closeOverlays(page);
    await sleep(400);
    // duel 的分子是隨時間顯影的動態畫面，拍照前遮掉，只比對 HUD/選項/搶答鈕版型
    await page.addStyleTag({ content: '#game-image-container { visibility: hidden !important; }' });
    await shot(page, dir, 'duel-game-1366');
    await page.close();

    // --- 直式手機（360x640）：主選單＋練習畫面 ---
    page = await newPage(browser, 360, 640);
    await shot(page, dir, 'main-menu-360');
    await page.click('[data-action="enter-difficulty"][data-arg="beginner"]');
    await sleep(300);
    await page.evaluate(() => { document.querySelector('#sub-menu-list button:not(.v2-tutorial-entry)').click(); });
    await sleep(800);
    await closeOverlays(page);
    await sleep(400);
    await shot(page, dir, 'practice-game-360');
    await page.close();

    await browser.close();
}

// 容差式像素比對：位元組級太脆（放大的 webp 重新取樣會產生 ±1 次像素噪點，
// 視覺相同卻位元組不同）。改用 Chrome 解碼兩張圖，統計「每通道差 > THRESH」
// 的像素數，超過 MAX_DIFF_PX 才判定為真正的視覺變化。
const PX_THRESH = 16;      // 單通道差異門檻（濾掉 AA 噪點）
const MAX_DIFF_PX = 120;   // 容許的雜訊像素上限；真正的改動是數千像素起跳
async function diffCount(page, bufA, bufB) {
    const a = 'data:image/png;base64,' + bufA.toString('base64');
    const b = 'data:image/png;base64,' + bufB.toString('base64');
    return page.evaluate(async (a, b, thresh) => {
        function load(src) { return new Promise((r, rej) => { const i = new Image(); i.onload = () => r(i); i.onerror = rej; i.src = src; }); }
        const ia = await load(a), ib = await load(b);
        if (ia.width !== ib.width || ia.height !== ib.height) return { size: true };
        const w = ia.width, h = ia.height;
        const ca = new OffscreenCanvas(w, h), cb = new OffscreenCanvas(w, h);
        const xa = ca.getContext('2d'), xb = cb.getContext('2d');
        xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0);
        const da = xa.getImageData(0, 0, w, h).data, db = xb.getImageData(0, 0, w, h).data;
        let count = 0;
        for (let i = 0; i < da.length; i += 4) {
            if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > thresh) count++;
        }
        return { count };
    }, a, b, PX_THRESH);
}

(async () => {
    const mode = process.argv.includes('--compare') ? 'compare' : 'baseline';
    const server = await serve();
    const baseDir = path.join(__dirname, 'shots', 'baseline');
    try {
        if (mode === 'baseline') {
            await captureAll(baseDir);
            console.log('baseline written to', baseDir);
        } else {
            const curDir = path.join(__dirname, 'shots', 'current');
            await captureAll(curDir);
            const exe = BROWSERS.find(p => fs.existsSync(p));
            const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
            const page = await browser.newPage();
            const names = fs.readdirSync(baseDir).filter(f => f.endsWith('.png'));
            let fail = 0;
            for (const n of names) {
                const cur = path.join(curDir, n);
                if (!fs.existsSync(cur)) { console.log('MISSING ', n); fail++; continue; }
                const res = await diffCount(page, fs.readFileSync(path.join(baseDir, n)), fs.readFileSync(cur));
                const bad = res.size || res.count > MAX_DIFF_PX;
                const detail = res.size ? 'size changed' : res.count + ' px';
                console.log((bad ? 'DIFFERS ' : 'SAME    ') + n + '  (' + detail + ')');
                if (bad) fail++;
            }
            const extra = fs.readdirSync(curDir).filter(f => f.endsWith('.png') && !names.includes(f));
            extra.forEach(n => { console.log('EXTRA   ', n); fail++; });
            await browser.close();
            if (fail) { console.log(`\n${fail} screenshot(s) differ`); process.exit(1); }
            console.log('\nALL SCREENSHOTS MATCH (within tolerance)');
        }
    } finally {
        server.close();
    }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
