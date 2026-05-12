# 視覺升級併入原專案的步驟（無摩擦版）

> 目標：把這個視覺升級包合進你 VSCode + Claude Code 的原始專案，**不破壞任何遊戲邏輯**，且讓 Claude Code 之後改功能時不會誤改美術。

---

## 一、檔案放哪裡

把這幾個檔案 / 資料夾**整個複製貼上**到你的遊戲專案根目錄：

```
your-game/
├── index.html                  ← 你原本的（要小幅修改，見步驟二）
├── style.css                   ← 你原本的（不動）
├── style-visual-v2.css         ← ✅ 新增
├── data.js / story.js / save.js / game.js  ← 不動
└── assets/
    ├── images/character/       ← 你原本的
    └── icons/                  ← ✅ 新增（16 個 SVG）
        ├── codex.svg
        ├── sound-on.svg
        ├── sound-off.svg
        ├── export.svg
        ├── import.svg
        ├── reset.svg
        ├── wizard.svg
        ├── swords.svg
        ├── flask.svg
        ├── hourglass.svg
        ├── quill.svg
        ├── close.svg
        ├── check.svg
        ├── back.svg
        ├── books.svg
        └── medal.svg
```

---

## 二、`index.html` 要改的兩個地方

### 1. `<head>` 加 2 行

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>有機分類帽 - Organic Sorting Hat</title>

    <!-- ✅ 新增：載入 Cinzel 標題字體 -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&display=swap">

    <link rel="stylesheet" href="style.css">

    <!-- ✅ 新增：永遠在 style.css 之後 -->
    <link rel="stylesheet" href="style-visual-v2.css">
</head>
```

### 2. emoji 按鈕加 `data-icon` 屬性（HTML 文字保留語義）

**修改前 → 修改後對照表**：

```html
<!-- 存檔控制列 -->
<button id="btn-open-codex"  class="btn magic-btn save-ctrl-btn" data-icon="codex">圖鑑</button>
<button id="btn-mute"        class="btn magic-btn save-ctrl-btn" data-icon="sound-on">音效</button>
<button id="btn-export"      class="btn magic-btn save-ctrl-btn" data-icon="export">匯出存檔</button>
<button id="btn-import-open" class="btn magic-btn save-ctrl-btn" data-icon="import">匯入存檔</button>
<button id="btn-reset-save"  class="btn magic-btn save-ctrl-btn reset-btn" data-icon="reset">重置</button>

<!-- 選單分組標題（用 data-icon 在標題前面加 icon） -->
<h3 class="menu-heading" data-icon="flask">自我修煉 (Practice)</h3>
<h3 class="menu-heading" data-icon="hourglass">競速挑戰 (Time Attack)</h3>
<h3 class="menu-heading" data-icon="swords">巫師對決 (Duel Mode)</h3>

<!-- info-bar 按鈕 -->
<button id="btn-back"      class="btn magic-btn icon-btn" data-icon="back">撤退</button>
<button id="btn-mute-game" class="btn magic-btn icon-btn icon-only" data-icon="sound-on" title="靜音"></button>

<!-- 玩家頭像（如果要把 🧙 換掉） -->
<div id="wizard-p1" class="wizard-badge" data-icon="wizard">玩家一</div>

<!-- 進度面板 -->
<span data-icon="books">認識分子</span>
<span data-icon="check">累積答對</span>

<!-- 自訂名稱 input placeholder 之前的 ✏️ 留著沒關係，是 placeholder 不是 icon -->
```

**規則**：
- 把 emoji 從文字中**刪除**，加上 `data-icon="<name>"` 屬性
- icon 顏色會自動跟隨文字顏色（hover 時也會變金）

### 3. 靜音切換時，動態切換 icon name（JS 端）

在 `game.js` 找到切換靜音的程式碼，加一行：

```js
// 假設原本是這樣：
btnMute.textContent = isMuted ? '🔇 音效' : '🔊 音效';

// 改成：
btnMute.textContent = '音效';
btnMute.dataset.icon = isMuted ? 'sound-off' : 'sound-on';
```

---

## 三、HP 條低血量轉紅（可選，但建議）

在 `game.js` 找到更新 HP 條 width 的地方，加一行 class toggle：

```js
function updateHp(player, percent) {
    const bar = document.getElementById(`hp-${player}`);
    bar.style.width = percent + '%';
    bar.classList.toggle('hp-low', percent < 30);  // ✅ 新增
}
```

---

## 四、給 Claude Code 看的「禁止區」標記

在專案根目錄新增 `VISUAL_RULES.md`：

```markdown
# Visual Rules (READ BEFORE EDITING)

## DO NOT MODIFY without explicit user approval:
- `style-visual-v2.css`        — visual polish layer
- `assets/icons/*.svg`         — icon set
- `assets/characters/*`        — AI-generated character art
- `assets/scenes/*`            — AI-generated scene art
- `assets/badges/*`            — AI-generated badges

## When adding new UI elements:
- Use `data-icon="<name>"` instead of emoji
- See `PROMPT_GUIDE.md` for icon naming conventions
- If you need a new icon, ADD a placeholder emoji and TELL the user

## Color usage:
- All colors must come from `style.css` `:root` variables or `style-visual-v2.css`
- Never introduce new hex codes without checking PALETTE LOCK
```

Claude Code 看到這個檔就知道哪些是「美術師的活」不要碰。

---

## 五、Git workflow 建議

```bash
# 開一個 visual upgrade 分支，跟功能開發分開
git checkout -b visual/icon-upgrade

# 加入新檔案
git add style-visual-v2.css assets/icons/ PROMPT_GUIDE.md INTEGRATION.md VISUAL_RULES.md

# 修改 index.html
git add index.html

git commit -m "feat(visual): add icon system + timer bar v2 + HP bar polish"

# 合回 main
git checkout main
git merge visual/icon-upgrade
```

往後**美術變動**走 `visual/*` 分支，**功能變動**走 `feat/*` 分支，撞檔機率近乎零。

---

## 六、回退機制

如果某個視覺改動你不喜歡：

- **整層回退**：刪掉 `<link rel="stylesheet" href="style-visual-v2.css">` 那一行即可
- **單項回退**：到 `style-visual-v2.css` 找對應段落，整段刪掉或註解掉
- **某個 icon 換回 emoji**：把 `data-icon="xxx"` 屬性移除，emoji 字元加回文字即可

`style.css` 永遠是 source of truth；v2 只是「化妝」。

---

## 七、之後 AI 圖到位後該做什麼

1. 把生成的 webp 放進 `assets/characters/` `assets/scenes/` `assets/badges/`
2. 在 `style-visual-v2.css` 最下方加：
   ```css
   /* 巫師選擇彈窗：背景換成 AI 立繪 */
   .wizard-card[data-wiz="fire"]  { background-image: url('assets/characters/wizard-fire.webp'); }
   .wizard-card[data-wiz="water"] { background-image: url('assets/characters/wizard-water.webp'); }
   /* ... */
   ```
3. 在 HTML 對應的 `.wizard-card` 加 `data-wiz="fire"` 屬性

**完全不需要動 JS**。
