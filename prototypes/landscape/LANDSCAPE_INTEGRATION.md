# LANDSCAPE 橫向版面 · 合併指南

> 目標：把 `landscape/layout.css`（必要）+ `landscape/menu.css`、`landscape/codex.css`（可選）合進 `original/` 遊戲，**不破壞 `game.js` 邏輯**。本文件設計成可直接餵給 Claude Code 當 spec。

---

## 0. 前情提要 — 跟之前那份 INTEGRATION.md 的差別

| 文件 | 範圍 | 規模 |
|---|---|---|
| 既有 `INTEGRATION.md`（已驗證） | v2 視覺升級（icon SVG + Cinzel 字體 + 配色微調） | 小，純疊加 |
| **本文 `LANDSCAPE_INTEGRATION.md`** | 橫向版面重構（Grid 結構 + Duel 競技場 + 旋轉遮罩） | **中等**，需動 `index.html` 結構 |

**本次不依賴 v2 升級**。`data-icon` 屬性沒有 v2 就不會顯示 icon，但 layout 完全不受影響 — 你保留原本的 emoji 文字即可。

---

## 1. 檔案放哪裡

```
your-game/
├── index.html              ← 改（見 §3）
├── style.css               ← 不動
├── layout.css              ← ✅ 從 landscape/ 複製過來（必要）
├── menu.css                ← ✅ 可選，只有想換新版選單時才要
├── codex.css               ← ✅ 可選，只有想拆出新版圖鑑時才要
├── game.js / data.js / story.js / save.js  ← 小改 game.js（見 §4）
└── assets/...              ← 不動
```

**只導入 `layout.css` 就已經完成 80% 的橫向體驗**。menu.css / codex.css 是錦上添花。

---

## 2. 對應關係速查表（給 Claude Code 看）

### 2.1 Selector 對照

| `original/` 用的 | `layout.css` 期待的 | 怎麼處理 |
|---|---|---|
| `.question-container.parchment-bg` | `.q-frame.parchment-bg` | **HTML 加上 `q-frame` class**（保留 `question-container` 也 OK） |
| `.options-container.single-col` | `.opts` | **HTML 加上 `opts` class** |
| `.opt-btn` 內 `.option-text` 單一 span | `.opt-zh` + `.opt-en` 兩個 span | **可選**：要分行中英才需要拆；暫時保留單一 span 也能跑 |
| `#duel-arena`（absolute 浮層） | `#arena-bar`（Grid row） | **結構不同，需新建** — 見 §3.3 |
| `#arena-p1` / `#arena-p2`（含 emoji + label） | `.arena-player.p1-side` / `.p2-side`（含 HP + 分數） | **整段重寫** |
| `body.duel-desktop` / `body.duel-mobile` | `body.duel`（單一 class） | **`game.js` 多加 `duel` class**；舊兩個 class 暫時保留別刪，避免 regression |

### 2.2 ID 對照（這些保留，`game.js` 還在用）

✅ **不要改名**：`#game-container`、`#game-area`、`#info-bar`、`#time-bar-container`、`#time-bar`、`#hp-p1`、`#hp-p2`、`#score-p1`、`#score-p2`、`#q-p1`、`#q-p2`、`#q-shared`、`#opts-p1`、`#opts-p2`、`#mode-title`、`#level-title`、所有 `#btn-*`

🆕 **新增的 ID**：`#rotate-overlay`、`#arena-bar`、`#avatar-p1`、`#avatar-p2`

---

## 3. `index.html` 結構修改

### 3.1 `<head>` 加 2 行

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>有機分類帽 - Organic Sorting Hat</title>

    <!-- ✅ 新增：Cinzel 字體 -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&display=swap">

    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="layout.css">  <!-- ✅ 永遠在 style.css 之後 -->
</head>
```

### 3.2 `<body>` 最上面加旋轉遮罩

```html
<body>
    <!-- ✅ 新增：直向時顯示「請橫放」 -->
    <div id="rotate-overlay">
        <div>
            <div class="phone-icon"></div>
            <h2>請將手機橫放</h2>
            <p>有機分類帽建議橫向遊玩</p>
        </div>
    </div>

    <div id="preload-container"></div>
    <div id="menu-container"> ... </div>  <!-- 主選單，不動 -->
    <div id="game-container" class="hidden"> ... </div>  <!-- 見 §3.3 -->
</body>
```

### 3.3 `#game-container` 重構（核心改動）

#### 修改前（原始）

```html
<div id="game-container" class="hidden">
    <div id="info-bar">...撤退 / 靜音 / 模式 / Level...</div>
    <div id="game-area">
        <div id="duel-arena" class="hidden">... 浮層競技場 ...</div>
        <div id="p1-area" class="player-area p1-theme">
            <div class="player-header">HP + Score</div>
            <div class="status-overlay">warn / combo</div>
            <div id="q-container-p1" class="question-container parchment-bg">題目+帽子</div>
            <div id="opts-p1" class="options-container single-col">選項</div>
        </div>
        <div id="shared-question-area" class="hidden">Duel 共用題目</div>
        <div id="p2-area" class="player-area p2-theme hidden">同 P1</div>
    </div>
    <div id="time-bar-container">...</div>
</div>
```

#### 修改後（要做的最小變動）

**策略：保留所有原有 id，只在外層加新 class，並在 Duel 時把 `#arena-bar` 插進去取代 `#info-bar`。**

```html
<div id="game-container" class="hidden">

    <!-- ① 單人模式：info-bar 加上 HP + 分數（給 layout.css 的 .spacer/.score-box 用） -->
    <div id="info-bar">
        <button id="btn-back" class="btn magic-btn icon-btn">↩ 撤退</button>
        <button id="btn-mute-game" class="btn magic-btn icon-btn" title="靜音">🔊</button>
        <div class="stat-box title-stat"><span id="mode-title">修煉模式</span></div>
        <div class="stat-box title-stat"><span id="level-title">Level 1</span></div>

        <!-- ✅ 新增：spacer + 單人 HP/分數搬到這 -->
        <div class="spacer"></div>
        <div class="hp-bar-container magic-border" id="solo-hp-wrap"
             style="height:clamp(14px,3vh,22px); width:clamp(120px,22vw,260px);">
            <div class="hp-bar" id="hp-p1-info" style="width:100%;"></div>
            <span class="hp-text">魔法</span>
        </div>
        <div class="score-box">魔力 <strong id="score-p1-info">0</strong></div>
    </div>

    <!-- ② Duel 模式：插入競技場 bar（預設 hidden，duel 時 JS 顯示，並把 info-bar 隱藏） -->
    <div id="arena-bar" class="hidden">
        <div class="arena-player p1-side">
            <div class="arena-avatar idle" id="avatar-p1" aria-hidden="true">🧙</div>
            <span class="pname">玩家一</span>
            <div class="hp-bar-container">
                <div class="hp-bar" id="hp-p1" style="width:100%;"></div>
            </div>
            <span class="pscore"><span class="mp-label">魔力</span><strong id="score-p1">0</strong></span>
        </div>
        <div class="arena-center">
            <div class="arena-hat hat-char neutral" aria-hidden="true">
                <div class="hat-img"></div>
                <div class="brow left"></div><div class="brow right"></div>
                <div class="eye left"><div class="pupil"></div></div>
                <div class="eye right"><div class="pupil"></div></div>
                <div class="mouth"></div>
            </div>
            <span class="arena-level" id="arena-level-label">Level 1</span>
        </div>
        <div class="arena-player p2-side">
            <span class="pname">玩家二</span>
            <div class="hp-bar-container">
                <div class="hp-bar" id="hp-p2" style="width:100%;"></div>
            </div>
            <span class="pscore"><span class="mp-label">魔力</span><strong id="score-p2">0</strong></span>
            <div class="arena-avatar idle" id="avatar-p2" aria-hidden="true">🧙</div>
        </div>
    </div>

    <!-- ③ Game area：單人 2 欄 (q-frame | opts)、Duel 3 欄 (opts.p1 | q-frame | opts.p2) -->
    <div id="game-area">
        <!-- 單人模式題目區（原 #q-container-p1 加 q-frame class） -->
        <div id="q-container-p1" class="q-frame question-container parchment-bg">
            <div id="wizard-avatar-p1" class="wizard-avatar" aria-hidden="true"></div>
            <div id="q-p1" class="question-content"></div>
            <div id="practice-coach-bubble" class="coach-bubble hidden"></div>
            <div class="hat-display hat-char neutral" aria-hidden="true">
                <div class="hat-img"></div>
                <div class="brow left"></div><div class="brow right"></div>
                <div class="eye left"><div class="pupil"></div></div>
                <div class="eye right"><div class="pupil"></div></div>
                <div class="mouth"></div>
            </div>
        </div>

        <!-- 單人模式選項區（原 #opts-p1 加 opts class） -->
        <div id="opts-p1" class="opts options-container single-col">
            <button class="btn opt-btn magic-stone-btn" data-idx="0">選項 A</button>
            <button class="btn opt-btn magic-stone-btn" data-idx="1">選項 B</button>
            <button class="btn opt-btn magic-stone-btn" data-idx="2">選項 C</button>
            <button class="btn opt-btn magic-stone-btn" data-idx="3">選項 D</button>
        </div>

        <!-- Duel 共用題目區（原 #shared-question-area 加 q-frame class，並移到中間） -->
        <div id="shared-question-area" class="q-frame hidden parchment-bg magic-border">
            <div id="q-shared" class="question-content"></div>
        </div>

        <!-- P2 選項區（原 #opts-p2 加 opts.p2 class） -->
        <div id="opts-p2" class="opts p2 options-container single-col hidden">
            <button class="btn opt-btn magic-stone-btn" data-idx="0">選項 A</button>
            <button class="btn opt-btn magic-stone-btn" data-idx="1">選項 B</button>
            <button class="btn opt-btn magic-stone-btn" data-idx="2">選項 C</button>
            <button class="btn opt-btn magic-stone-btn" data-idx="3">選項 D</button>
        </div>
    </div>

    <div id="time-bar-container" class="magic-border bottom-bar">
        <div id="time-bar"></div>
    </div>

</div>
```

**注意 DOM 順序**：在 Duel 模式下，Grid 用 `grid-template-columns: 1fr 1.7fr 1fr`，所以 `#game-area` 內的**直接子元素順序必須是 `opts.p1` → `q-frame` → `opts.p2`**。把 P1 選項放在 `#opts-p1`、共用題目放中間、P2 選項在右邊就對了。

> 原本的 `#p1-area`、`#p2-area`、`.player-area` 包裝層**直接拆掉**，把裡面的 `#q-container-*`、`#opts-*` 拉到 `#game-area` 底下。`.player-header`（HP+分數）裡的東西移到 `#info-bar`（單人）或 `#arena-bar`（對決）。`.status-overlay`（warn/combo）可以保留浮在 `#game-area` 上面，或一起搬。

---

## 4. `game.js` 要動的地方

### 4.1 Body class 改用 `duel` 單一名稱

```js
// 找到所有這類程式碼：
document.body.classList.add('duel-mode');        // 舊
document.body.classList.add('duel-desktop');     // 舊
document.body.classList.add('duel-mobile');      // 舊

// 在進入 Duel 時，多加一行：
document.body.classList.add('duel');             // ✅ layout.css 需要這個

// 離開 Duel 時：
document.body.classList.remove('duel', 'duel-mode', 'duel-desktop', 'duel-mobile');
```

> 舊的 `duel-mode` / `duel-desktop` / `duel-mobile` **暫時不要刪**，原本 `style.css` 裡面還靠它定義動畫和細節樣式。新的 `duel` 只是給 `layout.css` 用。

### 4.2 Duel 模式切顯示

```js
function enterDuel() {
    document.body.classList.add('duel', 'duel-desktop');  // 桌面版同時加兩個
    document.getElementById('info-bar').classList.add('hidden');
    document.getElementById('arena-bar').classList.remove('hidden');
    document.getElementById('shared-question-area').classList.remove('hidden');
    document.getElementById('opts-p2').classList.remove('hidden');
    // q-container-p2 在新結構裡已經拿掉，不需要切顯示
}

function exitDuel() {
    document.body.classList.remove('duel', 'duel-desktop', 'duel-mobile', 'duel-mode');
    document.getElementById('info-bar').classList.remove('hidden');
    document.getElementById('arena-bar').classList.add('hidden');
    document.getElementById('shared-question-area').classList.add('hidden');
    document.getElementById('opts-p2').classList.add('hidden');
}
```

### 4.3 Arena element id 改名

| 舊 id | 新 id |
|---|---|
| `#duel-arena` | `#arena-bar` |
| `#arena-p1` / `#arena-p2` | `#avatar-p1` / `#avatar-p2`（只是頭像那個 `<div>`） |
| `.arena-wiz-emoji` | 直接寫在 `.arena-avatar` 裡 |

在 `game.js` 全域 search-replace：
```
duel-arena    → arena-bar
arena-p1      → avatar-p1
arena-p2      → avatar-p2
```

施法動畫的 class（`arena-charging` / `arena-hit` / `arena-fizzle` / `arena-shake`）**class 名稱保留**，`layout.css` 寫的是 `.arena-avatar.charging` / `.hit`（無 prefix），所以你有兩個選擇：

- **選項 A（簡單）**：保留 `style.css` 原本的 `.arena-charging` 等規則，`layout.css` 的新動畫不啟用 → 動畫沿用舊版
- **選項 B（用新動畫）**：在 `game.js` 把 `classList.add('arena-charging')` 改成 `classList.add('charging')` → 套用 layout.css 的新動畫

**建議先選 A**（零風險），看完整動順了再考慮 B。

### 4.4 HP 低血量轉紅（沿用舊 INTEGRATION.md §3）

```js
function updateHp(player, percent) {
    const bar = document.getElementById(`hp-${player}`);
    bar.style.width = percent + '%';
    bar.classList.toggle('hp-low', percent < 30);
}
```

### 4.5 單人模式 HP / 分數同步到 info-bar（新增）

因為單人模式的 HP 已經搬進 `#info-bar`，要在 `updateHp` / `updateScore` 同步更新 info-bar 那份：

```js
function updateScore(player, mp) {
    document.getElementById(`score-${player}`).textContent = mp;
    // 單人模式：同步 info-bar
    if (player === 'p1' && !document.body.classList.contains('duel')) {
        const el = document.getElementById('score-p1-info');
        if (el) el.textContent = mp;
    }
}
```

HP 同理 — 加一個 `#hp-p1-info` 的同步。**最省事的作法**：把 info-bar 的 HP/score 元素 id 直接命名 `hp-p1` / `score-p1`，但 Duel 切過去時把 info-bar hide 起來，這樣就只剩一份在畫面上。但要小心 id 衝突（HTML 不允許重複 id）。

**最乾淨的做法**：用不同 id（`hp-p1-info` / `score-p1-info`），在 `updateHp` / `updateScore` 一次更新兩個。

---

## 5. 給 Claude Code 的 prompt 樣板

複製這段到 VSCode 的 Claude Code（**用 Sonnet**，這個 refactor 不是 Haiku 能照表操課的）：

```
你的任務：把這個專案的 original/ 遊戲合進 landscape/ 的橫向版面。

請完全依照 LANDSCAPE_INTEGRATION.md 的步驟執行，並遵守以下硬規則：

【硬規則】
1. 不准改 game.js / data.js / story.js / save.js 的任何遊戲邏輯
   — 只允許動 body class 名稱、element id 對應、HP/score 同步三件事
2. 不准刪 style.css 任何規則 — layout.css 是疊加層
3. 不准動 §2.2 列出的「不要改名」id
4. 改 index.html 一次只動一個區塊，每改完一個就停下來給我看 diff
5. 遇到 LANDSCAPE_INTEGRATION.md 沒寫到的狀況，先停下來問，不要自己決定

【執行順序】
Step 1: 複製 landscape/layout.css 到專案根目錄
Step 2: 改 index.html §3.1 + §3.2（加字體 + 旋轉遮罩）— 給我看 diff
Step 3: 改 index.html §3.3 — 拆 #p1-area / #p2-area，重組 #game-area — 給我看 diff
Step 4: 新增 #info-bar 內的單人 HP/score 元素 — 給我看 diff
Step 5: 新增 #arena-bar 結構 — 給我看 diff
Step 6: 改 game.js §4.1 - §4.5 — 一次給我看一個方法的 diff

我每看完一個 step 會回覆「OK 繼續」或「停，這裡有問題：...」
```

---

## 6. 風險與回退

| 風險 | 回退 |
|---|---|
| Duel 切換後選項按鈕沒對齊到 P1/P2 那欄 | 檢查 `#game-area` 子元素 DOM 順序是不是 `opts-p1 → shared-question-area → opts-p2` |
| 單人模式 HP 不見 | `#info-bar` 沒加 `.spacer` 或 HP 元素，layout.css 預設不會幫你長一個出來 |
| 競技場動畫消失 | `game.js` 還在 add `arena-charging`，但 `layout.css` 寫的是 `.charging`。選 §4.3 的 A 方案就沒事 |
| 直向遮罩擋到桌面（明明是橫的卻顯示） | 檢查 `@media (orientation: portrait) and (max-width: 900px)` — 桌面在 portrait 但寬度 >900 不會觸發 |
| 整個壞掉想關掉 | 刪 `index.html` 裡 `<link rel="stylesheet" href="layout.css">` 那一行就完全回到原本 |

---

## 7. 之後可選 — menu.css / codex.css

如果 layout.css 跑順了，再考慮把 menu.css / codex.css 也合進去 — 但那是**另一份 refactor**（menu 要拆三欄、codex 要從 modal 改成獨立替頁）。建議分批：

1. **本次（先做）**：`layout.css` — 遊戲畫面橫向化
2. **下次**：`menu.css` — 主選單三欄
3. **再下次**：`codex.css` — 圖鑑替頁

每一次都是獨立 PR，獨立 Git 分支（`visual/landscape-game`、`visual/landscape-menu`、`visual/landscape-codex`）。
