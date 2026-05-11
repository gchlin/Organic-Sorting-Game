# AI Cowork 紀錄

> 用途：記錄 AI 協作中已完成的功能、測試結果、設計依據與後續交接事項。
> 參考文件：`設計決策清單.md`
> 建立：2026-05-11

---

## 2026-05-11 — Codex 工作紀錄

### 1. 題庫 SVG 擴充與格式修正

**對應設計決策**
- `設計決策清單.md` §1 學習目標與範圍：不新增新官能基家族，維持分類 / 辨識名稱 / 辨識結構。
- `設計決策清單.md` §11 內容管線：SVG 生成器 + `data(organic).js` 登錄。
- `設計決策清單.md` §14 測試與驗證：檢查圖片路徑與 `AnswerBank` key。

**完成項目**
- 安裝 RDKit：`rdkit-2026.03.1`。
- 新增第一批題庫 SVG，總 SVG 數由 38 擴到 81。
- 新增 `assets/images/14_phenol/` 放酚類新增圖。
- 新增 RDKit 產圖腳本：`assets/images/generate_added_rdkit_svgs.py`。
- 用 RDKit 重新覆蓋錯誤格式的新增 SVG，符合既有 SVG 格式：
  - `xmlns:rdkit`
  - `width='400px' height='300px' viewBox='0 0 400 300'`
  - 背景 `<rect style='opacity:1.0;fill:#FFFFFF;stroke:none' ...>`
  - 鍵使用 `<path class='bond-* atom-*'>`
  - 原子使用 `<path class='atom-*'>`
- 更新 `assets/images/compounds_map.json` 為 81 筆，並補回 SMILES。
- 更新 `assets/images/README.md` 與 `README.md`，列出新增分子。
- 更新 `data(organic).js`，讓 `test.html` 可看到新增圖片。

**新增分子範圍**
- 烷烴、烯烴、炔烴、醇、醚、醛、酮、羧酸、酯、胺、鹵化物、芳香烴、酚。
- 不新增醯胺、硝基、腈、酸酐、醯氯。

**測試結果**
- `python -c "import rdkit; print(rdkit.__version__)"` → `2026.03.1`
- RDKit `Chem` / `Draw` / `rdMolDraw2D` import OK。
- `Chem.MolFromSmiles('CCCC')` OK。
- 新增 SVG 抽查符合 RDKit path 格式，沒有 `<text>` 卡片格式殘留。
- `node --check data(organic).js` 通過。
- 自動檢查 `QuestionSets`：
  - missing image files: `0`
  - missing `AnswerBank` keys: `0`
- `compounds_map.json` total: `81`

---

### 2. Claude 批次改動測試

**對應設計決策**
- `設計決策清單.md` §12 健壯性 / 邊界：狀態清理與殘留 bug。
- `設計決策清單.md` §14 測試與驗證：靜態檢查 + 資料一致性檢查。

**測試項目**
- `game(organic).js`
  - 修「試管破了卡住、選項變灰點不動」。
  - 抽題去重：洗牌佇列，一輪內不重複，發完重洗，避免連兩題一樣。
  - `generateOptions()` 只從目前關卡與之前學過關卡抽干擾選項。
- `data(organic).js`
  - `phenol → phenol`
  - `benzyl_alcohol → alcohol`
  - `benzaldehyde → aldehyde`
  - `benzoic_acid → carboxylic`
  - `aniline → amine`
- `index(organic).html`
  - Level 6 顯示為「綜合題」。
- `wizard-prototype.html`
  - 內嵌 JS 語法檢查。

**測試結果**
- `node --check game(organic).js` 通過。
- `node --check data(organic).js` 通過。
- `wizard-prototype.html` 內嵌 script 取出後 `node --check` 通過。
- `QuestionSets` 圖片與 key 一致性檢查通過。
- Level 1-6 沒有重複 `aKey`。
- Level 99 重複 `CAT_*` 是預期行為，因為多張結構圖對應同一英文分類。
- 洗牌佇列邊界模擬通過：
  - 多題關卡重洗時避免上一輪最後一題與新一輪第一題相同。
  - 單題關卡不可避免重複，屬合理邊界。

**附帶修正**
- `index(organic).html`：`Dual Mode` 改為 `Duel Mode`。

---

### 3. 鍵盤快捷 + Duel 桌面 RWD

**對應設計決策**
- `設計決策清單.md` §8 輸入與平台：
  - 單人模式支援鍵盤。
  - Duel 桌面與手機依設備分支。
  - 不為公平性加入人工輸入延遲。
- `設計決策清單.md` §7 UI / UX / 響應式：
  - 桌面 Duel 使用共用題目與共用 2x2 選項盤。
  - 手機 Duel 保留原本橫放觸控版面。
- `設計決策清單.md` §13 可及性：
  - 鍵盤可操作性前進一步，但尚未完成完整可及性驗證。

**完成項目**
- `game(organic).js`
  - 單人模式鍵盤：
    - `A/F/Z/C`
    - `4/6/1/3`
    - 小鍵盤 `Numpad4/6/1/3`
  - Duel 桌面鍵盤：
    - P1：`A/F/Z/C`
    - P2：`4/6/1/3`
    - P2 同時支援主鍵盤數字與小鍵盤。
  - `setupLayout()` 依設備分支：
    - `(min-width: 900px) and (pointer: fine)` → `.duel-desktop`
    - 其他 Duel → `.duel-mobile`
  - 桌面 Duel：
    - 兩人共用同一題。
    - 兩人共用同一組選項。
    - P2 選項區隱藏。
    - 玩家各自冷卻；P1 或 P2 答錯不會把共用選項整組鎖死。
  - 鍵位提示不寫死：
    - 新增 `ANSWER_KEY_BINDINGS` 作為答題選項鍵的單一來源。
    - 實際答題鍵判定與選項按鈕顯示都從 `ANSWER_KEY_BINDINGS` 產生。
    - 未來若做自定義鍵盤，只開放答題選項鍵；主選單、返回、重開、關閉彈窗等系統快捷鍵固定，不給使用者改。
- `style(organic).css`
  - 新增 `.key-hint`。
  - 新增 `.duel-desktop` 桌面版面。
  - 新增 `.duel-mobile` 手機版保留規則。
- `index(organic).html`
  - Duel 說明改為「桌面鍵盤搶答；手機橫放觸控」。
- `README.md`
  - 補上操作說明。
- 非選項按鈕鍵盤操作
  - 主選單原生支援 `Tab` / `Enter` 選取按鈕，並新增快捷鍵：
    - `1-6`：Practice Level 1-6
    - `9`：Practice Level 99
    - `Q/W/E`：Time Attack 三關
    - `U/I/O`：Duel 三關
  - 遊戲中：`Esc` / `M` 返回大廳，`R` 重新開始本關。
  - 結算畫面：`Enter` / `R` 再次實驗，`Esc` / `M` 返回大廳。
  - 參考圖彈窗：`Esc` / `X` 關閉；關閉鈕補上 `role="button"`、`tabindex="0"`、`Enter` / `Space` 操作。
  - 方向鍵可在目前畫面的可操作按鈕間移動焦點，`Enter` / `Space` 執行焦點按鈕，支援不使用滑鼠完成關卡選擇、答題、返回與重開。
  - 所有可見快捷鍵提示統一使用中括弧，例如 `[A]`、`[4]`、`[Esc / M]`；主選單與控制按鈕由 JS 依 shortcut 設定自動標註。
  - 主選單加上鍵盤操作說明：「方向鍵選關卡，Enter / Space 開始；也可直接按按鈕前的 [快捷鍵]。」

**目前鍵位設計**

單人與 Duel 桌面模式：

| 畫面位置 | 選項 | 左側鍵 | 右側鍵 |
|---|---|---|
| 左上 | 1 | A | 4 |
| 右上 | 2 | F | 6 |
| 左下 | 3 | Z | 1 |
| 右下 | 4 | C | 3 |

**測試結果**
- `node --check game(organic).js` 通過。
- `node --check data(organic).js` 通過。
- 自動檢查 `QuestionSets`：
  - missing image files: `0`
  - missing `AnswerBank` keys: `0`
- `KEY_HINTS` 已移除。
- 選項按鈕提示由 `ANSWER_KEY_BINDINGS` 自動產生。
- 搜尋確認正式頁面沒有 `Dual Mode` 殘留。

**剩餘風險**
- 尚未做瀏覽器實機截圖 / Playwright 檢查。
- 桌面 Duel 底部 2x2 選項盤在不同螢幕高度可能需要微調。
- 尚未測手機實機橫放觸控。
- 尚未處理 `prefers-reduced-motion`。

---

## 交接建議

1. 下一步應做實機 / 瀏覽器測試：
   - 桌面寬螢幕 Duel。
   - 桌面低高度視窗。
   - 手機橫放 Duel。
   - 單人鍵盤操作。
2. 若要做自定義鍵盤，只抽出答題選項用的 `ANSWER_KEY_BINDINGS`；其他全域控制快捷鍵維持固定。
3. 若要繼續改善 §8，建議同步更新 `設計決策清單.md`：
   - 鍵盤快捷標為已實作。
   - `setupLayout()` 依設備分支標為已實作。
   - Duel 實機測試仍留在 §14。

---

### 4. 答題回饋強化（設計決策清單 §4）

**對應設計決策**
- `設計決策清單.md` §0：不做全螢幕亮暗閃光 / 高對比爆閃；衝擊感用色彩光暈、位移、輕微震動。
- `設計決策清單.md` §4：答錯高亮正確答案、練習模式顯示「為什麼」、練習模式分類帽教練、Practice vs Speed 回饋不同。
- `化學審查清單.md` §3：13 類官能基「為什麼」草稿文案。

**完成項目**
- `game(organic).js`
  - 新增 `WHY_HINTS`，含 13 類：`alkane`、`alkene`、`alkyne`、`alcohol`、`ether`、`aldehyde`、`ketone`、`carboxylic`、`ester`、`amine`、`aromatic`、`halide`、`phenol`。
  - 新增 `CAT_CATEGORY_MAP`，讓 Level 99 的 `CAT_*` 答案也能對回正確官能基提示。
  - 答錯時在 1 秒冷卻期間替正確答案按鈕加 `.reveal-correct`，冷卻結束清掉；單人、競速、Duel 桌面共用選項、Duel 手機雙選項區都走同一套邏輯。
  - 練習模式答錯時顯示一行「為什麼」提示；競速 / 對決不顯示，避免拖慢節奏。
  - 練習模式新增分類帽教練 UI 雛形：🎩 + 對話泡泡。開場、答對、答錯、連錯 3 次以上會更新台詞。
- `style(organic).css`
  - 新增 `.reveal-correct` 柔和綠色光暈 / 脈動，不使用全螢幕閃光。
  - 新增 `.practice-why-hint`、`.practice-coach`、`.coach-bubble`、`.coach-emoji` 樣式。
  - 補 `prefers-reduced-motion: reduce`，關閉答錯震動、正解脈動、教練浮動與 combo 動畫。
- `設計決策清單.md`
  - §4 對應項目標 ✅ / `[x]`。

**測試結果**
- `node --check game(organic).js` 通過。
- `node --check data(organic).js` 通過。
- `QuestionSets` 一致性檢查通過：
  - missing image files: `0`
  - missing `AnswerBank` keys: `0`

**剩餘風險**
- 尚未做瀏覽器實機 / Playwright 視覺檢查；分類帽泡泡在小螢幕上可能還需要依實際版面微調位置。

---

### 5. 答題畫面鍵盤焦點修正

**背景**
- 先前進入遊戲後，瀏覽器焦點可能落在「撤退 / Esc」按鈕。
- 玩家若按 Enter，會誤觸返回大廳。
- 設計決策：答題畫面採「game controls」，不是一般網頁 focus navigation。

**完成項目**
- `game(organic).js`
  - `renderQuestion()` 結束時不再 `focusFirstAvailableControl(UI.game)`。
  - 新增 `blurActiveControl()`，每次出新題後清掉目前焦點。
  - 新增 `isGameControlSuppressedKey()`。
  - 答題畫面中攔截並 `preventDefault()`：
    - `ArrowUp`
    - `ArrowDown`
    - `ArrowLeft`
    - `ArrowRight`
    - `Enter`
    - `Space`
  - 答題鍵仍維持：
    - 左側：`A/F/Z/C`
    - 右側：`4/6/1/3`
  - `Esc / M` 返回大廳、`R` 重開仍保留。
  - 主選單 / 結算畫面 / 參考圖彈窗仍保留方向鍵、Enter、Space 的一般鍵盤導覽。

**測試結果**
- `node --check game(organic).js` 通過。
- `git diff --check` 無錯誤，只有 Windows CRLF 提示。

**交接給 Claude 的注意事項**
- 若之後調整鍵盤 UX，請保留「答題畫面不預設 focus、不用方向鍵 / Enter / Space 答題」這個決策，除非另開可及性設定。
- §13 可及性後續要補策略：目前答題畫面偏遊戲控制，非一般表單導覽；滑鼠 / 觸控與明確快捷鍵提示仍可用。
