# CSS 減肥計畫

## 目的

降低主線 CSS 體積與閱讀成本，讓後續維護時不用每次載入整包 `style.css`。本次只清理未使用或 legacy CSS，不改遊戲行為、不重新設計 UI。

## 現況

正式入口 `index.html` 依序載入：

1. `style.css`
2. `sorting-hat.css`
3. `menu.css`

目前規模：

| 檔案 | 大小 | 行數 | 判斷 |
|---|---:|---:|---|
| `style.css` | 約 118.8 KB | 4,026 行 | 最大，混有 base、legacy、v2 game、codex、settings |
| `menu.css` | 約 10.7 KB | 355 行 | v2 主選單/子選單，應大多保留 |
| `sorting-hat.css` | 約 13.6 KB | 443 行 | 混有 v2 帽子/story/tutorial 與舊版殘留 |

預估第一輪可讓三個 CSS 總量減少約 25% - 35%。

## CSS 責任邊界

### `style.css`

保留：

- `:root` theme variables
- global reset / base layout
- `.hidden`
- v2 modal：`.modal`、`.modal.is-open`
- icon system：`[data-icon]`
- v2 screens：`.v2-root`、`.screen`
- v2 game：`#screen-game`、`.player-area`、`.option-btn`、`.v2-buzz`
- feedback / countdown / give-up / combo popup
- settle、codex、wrong-book、settings styles

刪除候選：

- legacy main menu
- legacy game container
- legacy duel layout
- old `#duel-arena`
- old modal / picker / import / toast styles
- duplicate patch blocks already superseded by v2 styles

### `menu.css`

保留：

- `#screen-main-menu.is-active`
- `.v2-menu-*`
- `.v2-section-*`
- `#screen-sub-menu.is-active`
- `.v2-sub-list`
- submenu responsive layout

刪除候選：

- confirmed unused `.key-hint` menu rules if global CSS permanently hides them
- any selector not found in `index.html` or `game-v2.js` dynamic DOM

### `sorting-hat.css`

保留：

- `.hat-char`
- hat expression classes: `.happy`, `.sad`, `.surprised`, `.thinking`, `.wink`
- `#tutorial-hat`
- `.tutorial-slide-media`
- `.screen.v2-story-screen.is-active`
- `#story-hat`
- `.v2-story-*`

刪除候選：

- `.question-container:has(...)`
- `.wizard-avatar`
- `.hat-display`
- `.hat-coach-wrap`
- `.coach-bubble`
- `body.duel-mode` / `body.duel-desktop` old hat rules
- old `.story-modal-content` / `.story-speaker-*` modal rules, if not used by v2

## 實作順序

1. 建立分支：`refactor/css-slim-v2`
2. 建立本文件：`docs/style減肥.md`
3. 先做 selector 掃描，產出刪除候選清單。
4. 第一輪只改 `style.css`：
   - 刪除明確 legacy DOM 相關樣式。
   - 不碰 v2 game/codex/settings/wrong-book。
5. 第二輪改 `sorting-hat.css`：
   - 刪除 legacy coach / arena / old modal。
   - 保留帽子角色、story、tutorial。
6. 第三輪輕量整理 `menu.css`：
   - 只刪確認未使用的小型規則。
7. 統計清理前後大小與行數。
8. 執行驗證。

## 驗證清單

必測畫面：

- 主選單
- 子選單
- 自我修煉
- 答對 / 答錯 / 結算
- Duel PvP
- Duel PvE
- 搶答倒數
- 放棄作答
- tutorial modal
- story screen
- codex
- wrong book
- settings

必查樣式：

- `.screen.is-active` 顯示正常
- `.modal.is-open` 疊層正常
- `.v2-menu-btn` 未跑版
- `.hat-char` 表情正常
- `.tutorial-icon` 圖片正常
- `.option-btn` 狀態：wrong / correct / eliminated 正常
- `.codex-tabs` 切換正常
- `.v2-wrong-card` 顯示正常

## 完成標準

- CSS 總行數至少減少 20%。
- `style.css` 行數明顯下降。
- `menu.css` 不被誤刪主功能。
- `sorting-hat.css` 只留下帽子、tutorial、story 相關主線樣式。
- 根目錄 `index.html` 主流程無視覺回歸。
- 文件更新實際刪除後的大小、行數與測試結果。

## 不做事項

- 不修改 `legacy/`
- 不修改 `prototypes/`
- 不修改 `level_UI/`
- 不重設 UI 視覺風格
- 不改 `game-v2.js` 行為，除非發現 CSS 清理需要同步刪除死 DOM references

## 執行備忘

每刪一批 CSS 後都要：

1. 重新掃描 selector。
2. 開一次主畫面。
3. 確認 console 沒有因 DOM/CSS 假設破掉。
4. 更新本文件的「實際結果」區塊。

## 實際結果

| 項目 | 清理前 | 清理後 | 差異 |
|---|---:|---:|---:|
| `style.css` 大小 | 118.8 KB | 70.1 KB | -48.7 KB |
| `style.css` 行數 | 4,026 | 2,292 | -1,734 |
| `sorting-hat.css` 大小 | 13.6 KB | 7.8 KB | -5.8 KB |
| `sorting-hat.css` 行數 | 443 | 206 | -237 |
| `menu.css` 大小 | 10.7 KB | 10.3 KB | -0.4 KB |
| `menu.css` 行數 | 355 | 342 | -13 |
| CSS 總行數 | 4,824 | 2,840 | -1,984 |

## 執行紀錄

- Branch: `refactor/css-slim-v2`
- Selector 掃描與刪除結果：已移除 legacy main menu/game/duel/arena、old wizard picker、old coach/story modal、old progress/import/toast/timebar/hpbar rules；保留 v2 menu、game、codex、wrong-book、settings、tutorial、story、hat character。
- 驗證結果：CSS brace/comment 平衡檢查通過；legacy selector 掃描未再命中主要刪除候選；環境未提供可直接呼叫的 Edge/Chrome/Playwright，尚未做截圖式視覺 smoke test。
