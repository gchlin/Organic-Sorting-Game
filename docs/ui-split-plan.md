# game-v2.js 切檔規格（ui-split）

目的：把五個畫面模組從 game-v2.js（~2900 行 IIFE）搬出，core 只留狀態機
（dispatch/reduce/effects）、遊戲畫面、選單與共用 helper。**只搬不改**：
每一行 diff 都要能對應到「搬移」，不做順手重構、不改行為。

盤點基準：commit `289159f`。文中行號是當時的快照，**每搬一步行號就會位移，
一律以函式名重新定位**。

## 護欄（每一步的完工定義）

1. `cd tests/smoke && node run.js` 印出 **ALL GREEN**（第一次要先 `npm install`）。
2. `git diff` 只含該步驟的模組（一個 ui-*.js 新檔 + game-v2.js 刪除區 + index.html 兩行）。
3. game-v2.js 行數真的變少（搬移量 ≈ 刪除量）。
4. 每個 ui-*.js 只准碰自己畫面的 DOM；跨畫面元素一律走 core helper。
5. 發現孤兒 helper（搬走後沒人用）→ 回報，不刪。
6. `node -e "new Function(require('fs').readFileSync('<file>','utf8'))"` 對每個改過的 js 檔語法檢查。

## 模組樣板（沿用 input-controller.js 的依賴注入模式）

```js
// ui-codex.js - 圖鑑畫面（core 的 render() 分派進來）
const UICodex = (function () {
    let ctx = null;                 // core 注入的依賴，見各模組 ctx 表
    function init(context) { ctx = context; }
    let _codexTab = 'molecules';    // 模組獨佔的閉包狀態搬進來
    function renderCodexScreen() { /* 原封搬入，閉包引用改 ctx.* */ }
    return { init, render: renderCodexScreen };
})();
```

core（game-v2.js）在 `init()` 裡呼叫 `UICodex.init({ ... })`，
`render()` 的 switch 改呼叫 `UICodex.render()`。
index.html：`<script src="ui-codex.js">` 放在 game-v2.js **之前**，
並更新 game-v2.js / 該檔的 `?v=` cache-bust 字串。

**事件接線原則**：`attachMenuListeners` 的 data-action switch **留在 core**，
case 內改成呼叫模組 API。模組內部自己 render 時掛的 listener（如 wrong-book
的 wireWrongBookTabs）跟著模組走。

**共用狀態原則**：`_pendingConfirm` 不直接給模組碰。core 新增一個 helper：

```js
function requestConfirm(text, onYes, onNo) {
    _pendingConfirm = { text: text, onYes: onYes, onNo: onNo || function () {} };
    render();
}
```

模組經 `ctx.requestConfirm(...)` 使用。（此 helper 在 3a 第一步就加進 core。）

## 搬移順序與各模組規格

### 3a. ui-codex.js（UICodex）— 最乾淨，先做

- 搬：`renderCodexScreen`（1382-1589，含內部的 tab/卡片/story-card 接線與局部 `esc()`）。
- 搬入模組的閉包狀態：`_codexTab`（獨佔）。
- ctx：`{ goToScreen, openStory, famCompoundKeys }`
  （core 的 `goToScreen`、`_openStory`、`_famCompoundKeys`）。
- 直接用的全域（不經 ctx）：`Families`、`QuestionImages`、`AnswerBank`、`CompoundFacts`、`Save`。
- core 改動：render() switch `case 'codex': UICodex.render()`；init() 加 `UICodex.init({...})`。
- 不搬：`_famCompoundKeys`（renderMainMenu 也用）、`openHelp` 的 codex 分支（留 core，3d 再處理）。
- ~~已知潛在 bug：settle 的「看圖鑑 →」按鈕期待 `#codex-mol-<key>` 元素，
  但 codex 卡片只有 `data-mol` 沒有 id~~——切檔完成後已修：UICodex 開
  `scrollToMol(molKey)` API（切分子 tab ＋捲動），settle 經 ctx.scrollToCodexMol 呼叫。

### 3b. ui-wrong-book.js（UIWrongBook）

- 搬：`renderWrongBookScreen`（1591-1706）、`wireWrongBookTabs`（1708-1715）、
  `wireWrongBookActions`（1717-1749）。
- 搬入模組的閉包狀態：`_wrongBookTab`（獨佔）。
- ctx：`{ findImageFor, startMode, render, goToScreen, requestConfirm }`。
- 直接用的全域：`Save`、`AnswerBank`、`Families`。
- 不搬：`_buildQueueFromWrongBook`（屬 mode-start 管線，留 core）、
  `openHelp` 的 wrong-book 分支（留 core，3d 處理）、
  `#settings-wrong-book-reset`（屬 settings）。
- core 改動：render() switch 改 `UIWrongBook.render()`；init() 注入。

### 3c. ui-settle.js（UISettle）

- 搬：`renderSettleScreen`（1229-1347）、`_appendStat`（1348-1353，獨佔）、
  `_goNextLevel`（1942-1978，獨佔）。
- ctx：`{ getState, goToScreen, startMode, findImageFor, requestConfirm,
  getWrongChosenMap }`（core 加 `getWrongChosenMap: () => _wrongChosenMap`）。
- 直接用的全域：`Save`、`QuestionEngine`、`AnswerBank`、`Families`。
- **行為決策（唯一許可的行為變更）**：`renderSettleScreen` 內的
  `_syncTutorialBtn()` 呼叫（1287 附近）**直接刪除、不搬**——它操作的是
  `#screen-game` 的 HUD 按鈕（跨畫面，結算畫面沒這顆按鈕），且
  `renderGameScreen` 每次 render 已自行呼叫 `_syncTutorialBtn()`。
  刪除後跑 smoke 確認 practice 場景（含答錯閃爍）仍 GREEN。
- core 改動：render() switch 改 `UISettle.render()`；attachMenuListeners 的
  `case 'next-level':` 改 `UISettle.goNextLevel()`；`_onEnterSettling` 留 core。

### 3d. ui-story.js（UIStory）— 最糾結，共用狀態多，給較強模型

- 搬：`renderStoryScreen`（1915-1936）、`_openStory`（1982-1995）、
  `_advanceStory`（1997-2012）、`renderTutorialModal`（2014-2059）、
  `openHelp`（2070-2115，整個搬，含 codex/wrong-book 分支內容）、
  `_tutorialPagesFor`（922-930）、`_openTutorialPages`（931-941）、
  `_closeTutorialAndContinue`（2583-2593）。
- 搬入模組的閉包狀態：`_storyState`、`_tutorialState`（模組獨佔持有，
  core 不再直接讀寫）。
- 對外 API（core 呼叫點改用這些）：
  - `openStory(familyKey, onDone)` ← codex story-card（經 3a 的 ctx.openStory，
    core 的 passthrough 改指向 UIStory）、settle `show-story` case
  - `openTutorialPages(pages, key, onDone)` ← 子選單 tutorialModules（~689）
  - `pagesFor(family, difficulty)` ← core 的 `_syncTutorialBtn`（~999）與
    `startMode` 自動教學 gate（2132-2151）
  - `openLevelTutorial(family, difficulty, onDone)` ← `show-tutorial` 非 game
    分支（2467-2484）與 startMode gate（包 pagesFor + 建 state + render）
  - `advanceStory()`、`escapeStory()`（原鍵盤 Escape 分支：清 state 回主選單）、
    `closeTutorialAndContinue()`、`openHelp(kind)`
  - `renderStory()`、`renderTutorialModal()` ← render() 分派
- ctx：`{ goToScreen, render, getState, characterSkin, ensureHatChar,
  setHatExpression, syncHatChars }`（hat helpers 留 core，主選單也用）。
- 直接用的全域：`StoryScripts`、`StoryScriptsGrimoire`、`LevelTutorials`、
  `LevelTutorialMap`、`Save`、`Families`。
- **留在 core**：`show-tutorial` 的 `_currentScreen === 'game'` 分支
  （`_toggleQuickHint`，快速提示屬遊戲畫面）；`#screen-story` 點擊前進與
  story 鍵盤分支的**接線**留在 core，改呼叫 `UIStory.advanceStory()` 等。
- 注意：`Save.markTutorialSeenV2`（closeTutorialAndContinue 內）、
  `Save.isTutorialSeenV2`（startMode gate，留 core）。

### 3e. ui-settings.js（UISettings）

- 搬：`renderSettingsScreen`（1751-1786）、`_KEYBIND_GROUPS`（1789-1810）、
  `_KEYBIND_READONLY_GROUPS`（1813-1825）、`_renderKeybindingsList`（1846-1897）、
  `_setChecked`、`_setValue`、`_setVolumeControl`（1898-1913）、
  `_wireKeybindingsCapture`（2597-2605）、`_startKeybindingCapture`（2606-2639）、
  `attachSettingsListeners`（2641-2814）。
- 搬入模組的閉包狀態：`_kbCaptureCleanup`（獨佔）。
- ctx：`{ render, syncMusicForScreen, formatKeyCode, escapeHtml, requestConfirm,
  getCurrentScreen }`（`getCurrentScreen: () => _currentScreen`，
  `attachSettingsListeners` 內兩處 `_syncMusicForScreen(_currentScreen)` 用）。
- 直接用的全域：`Save`（readSettings/writeSettings/defaultKeybindings/
  clearWrongLog/reset/exportText/importText）。
- 不搬：`_formatKeyCode`、`_escapeHtml`（遊戲畫面也用，經 ctx）、
  `renderDevBanner`（碰 `#screen-game`，core）。
- core 改動：render() switch 改 `UISettings.render()`；init()（~2888）的
  `attachSettingsListeners()` 改 `UISettings.attachListeners()`。

## 完成後的 core（game-v2.js 預估 ~1500 行）

state/dispatch/reduce 接線、effects、renderGameScreen＋quick-hint＋buzzed UI、
renderMainMenu/renderSubMenu、renderConfirmModal、renderDevBanner、goToScreen、
startMode/beginMode、attachMenuListeners（data-action switch）、鍵盤導航、
共用 helper（_escapeHtml、_formatKeyCode、_findImageFor、_famCompoundKeys、
_syncTutorialBtn、requestConfirm、hat helpers、audio 包裝）。
