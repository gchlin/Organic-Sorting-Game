# Game V2 實施計畫

本文整理 `docs/Review_game-v2_2` 的可採用項目，並補上重新檢視 `game-v2.js`、`mode-rules.js`、`effect-manager.js` 後發現的實際風險。目標是先修會造成錯誤遊戲結果的 bug，再逐步降低 `game-v2.js` 的責任過重與狀態邏輯不清。

## 目前判斷

## 實作狀態（2026-05-20）

目前 **尚未完成 Game V2 全部規劃項目**。

已完成並提交：

- `docs(architecture): align rules with runtime API`
- `fix(tutorial): prevent in-game tutorial from settling`
- `feat(tutorial): replace in-game tutorial modal with quick hint`
- `fix(stats): count duel timeout and give-up as wrong attempts`
- `refactor(time): thread action now through buzz flow`
- `chore(effects): verify dynamic pause completion handling`
- `feat(duel): show dynamic score percentage`
- `feat(audio): introduce audio manager`
- `feat(audio): add combo-tier sound hooks`
- `feat(dynamic): add blur and rotate zoom variants`
- `fix(ui): clean minor navigation and popup issues`
- 額外完成：Duel 最後一題 queue 空時正確結算。
- 額外完成：答對後 dynamic effect 快速推進到完整顯示，再驗證答案。
- 額外完成：玩家設定新增 BGM / SFX 音量，預設背景音樂 60%、效果音效 40%。

尚未完成，仍保留為後續工作：

- `feat(tutorial): add tutorial level flow`
- `feat(tutorial): add guided key-highlight steps`
- `css: phase A add style sections`
- `css: phase B move low-risk inline styles`
- `css: phase C move display visibility rules to classes`
- `refactor(game-v2): extract modal/runtime/render helpers`

判斷：

- **核心 Duel / Dynamic / Audio / Quick hint 修補已完成。**
- **完整教學關卡、導引按鍵亮起、CSS 分階段整理、`game-v2.js` 拆分尚未完成。**
- 因此不能宣稱 Game V2 全部完成；只能宣稱「Phase 1-5 與 audio/dynamic 相關 gameplay bug 修補已完成」。

### 架構治理

已新增 `docs/ARCHITECTURE_RULES.md` 作為後續所有人與 AI 修改前必讀的規則文件。

接下來所有實作任務都應先遵守：

- 不新增第二套 timer / event loop。
- 不新增第二套 Save side-effect path。
- reducer 不再新增 direct `Date.now()`。
- JS 不寫固定樣式，固定視覺樣式回到 CSS。
- 正式關卡內不再開完整教學 modal。
- Duel dynamic pause 是正式遊戲規則，要修乾淨，不是移除。

### 已確認需要修

1. **遊戲中開啟教學，完成後會直接進結算**
   - 位置：`game-v2.js` 的 `show-tutorial`
   - 現況：`onDone` 寫死 `goToScreen('settle')`
   - 影響：玩家從遊戲中點教學，看完後關卡會被視為完成
   - 判斷：高優先級 bug

2. **教學 modal 開啟時，遊戲 timer / dynamic effect 仍在背景跑**
   - 位置：`show-tutorial`、`_closeTutorialAndContinue`、`_startBuzzedTickLoop`、`EffectManager`
   - 現況：畫面進教學，但 duel 搶答倒數和 dynamic effect 可能繼續進行
   - 影響：玩家看教學時可能被逾時、分數時間點可能改變
   - 判斷：高優先級 bug，但不能直接套用 `Review_game-v2_2` 裡的 patch，因為該 patch 使用錯誤欄位 `duration`，而 `EffectManager.runEffect()` 實際使用 `ms`

3. **Duel 逾時與放棄沒有增加 `wrongCount`**
   - 位置：`mode-rules.js` 的 `duel.buzzed.ANSWER_TIMEOUT`、`duel.buzzed.GIVE_UP`
   - 現況：只設定 `failedPlayersThisCycle` 和 `lastResolveReason`
   - 影響：結算準確率若使用 `correctCount / (correctCount + wrongCount)`，會高估表現
   - 判斷：中高優先級 bug

4. **`back-to-main` 有重複 `goToScreen('main-menu')`**
   - 位置：`game-v2.js` 的 `back-to-main` / `back-to-menu`
   - 現況：特定條件下呼叫一次，後面又無條件呼叫一次
   - 影響：重複 render / music sync，可能造成閃動或音樂重啟
   - 判斷：低成本修復

5. **`_wrongChosenMap` 只用 compoundKey 當 key**
   - 位置：`game-v2.js`
   - 現況：同一 compound 在同一輪再次出現時，後一次錯選會沿用第一次記錄
   - 影響：錯題結算顯示可能錯誤
   - 判斷：中優先級，尤其 wrong-book retrain 題池可能重複時要修
   - 實作前必須先確認 reset boundary：目前是 per-round 還是 per-question；確認後再決定用 `(compoundKey + questionIndex)` 或改成每題清除。

6. **Combo popup 清理使用 stale DOM reference**
   - 位置：`game-v2.js` 的 `_spawnComboPopup`
   - 現況：timeout closure 內使用舊的 `feedback` reference
   - 影響：切畫面後可能清不到新的 overlay 狀態
   - 判斷：中低優先級

### Review 文件中不應照修的項目

1. **PvE AI 設定 partial overwrite**
   - `save.js` 的 `writeSettings()` 已對 `pveAI` 做 per-difficulty merge
   - 不需要在 UI listener 手動 deep clone

2. **Scoring 設定 partial overwrite**
   - `save.js` 的 `writeSettings()` 已對 `scoring` 做 merge
   - 不應列為 critical

3. **Wrong answer double-recording**
   - `game-v2.js` 有 `saveWrong` effect handler，但目前 `mode-rules.js` 未 emit `saveWrong`
   - 現況不是雙寫 bug；若未來 reducer 改成 emit `saveWrong`，才需要移除 direct `Save.recordWrongV2`

4. **Review 文件的 pause/resume 範例**
   - 不可直接套用
   - 問題一：`resumeGameFromModal()` 把 `_gamePausedAt` 設成 0 後又拿它計算剩餘時間
   - 問題二：`EffectManager.runEffect({ type: 'timer', duration: remainingMs })` 無效，正確欄位是 `ms`

## 實施順序

### Phase 0：重新定義教學策略

新方向：

- **完整教學內容改成「教學關卡」**
  - 玩家在教學關卡中學官能基、選項操作、搶答、放棄、快捷鍵。
  - 教學關卡本身就是 game state 的一種流程，不再是正式關卡中途插入的多頁 modal。
  - 可以安全地教玩家按鍵，因為它本來就是關卡，不需要暫停正式對局。

- **正式關卡內只保留「快速提示」**
  - 小浮層。
  - 純文字。
  - 不切換 screen。
  - 不進入 `_tutorialState`。
  - 不標記關卡完成。
  - 不碰 timer / AI / dynamic effect。
  - 不要求 menu 每個關卡都支援快速鍵；正式關卡內的快捷鍵重點放在答題、搶答、放棄。

這會大幅降低複雜度，因為目前最麻煩的是「完整教學 modal 被插入正在進行的遊戲」。如果正式關卡內沒有完整 modal，就不需要為教學處理：

- duel 倒數暫停
- dynamic zoom 暫停/恢復
- AI 暫停/恢復
- tutorial onDone 回到哪個 screen
- 看完教學誤觸結算
- modal 中途關閉後 effect id 如何恢復

保留的唯一需求是：快速提示浮層不能阻擋或改變 game loop。它可以只是 render 層狀態，例如 `_quickHintOpen = true/false`。

### Phase 1：修正教學 modal 導致錯誤結算

目標：短期先修掉現有 bug；中期把正式關卡內的完整教學入口改成快速提示。

做法：

1. 短期：在 `show-tutorial` 捕捉來源畫面：
   - `const returnScreen = _currentScreen`
2. `_tutorialState.onDone` 改為：
   - 若來源是 `game`：回到 `game`
   - 若來源是 `settle`：回到 `settle`
   - 其他來源：回到來源畫面或只 `render()`
3. bug 來源是 `show-tutorial` 內 hard-coded `onDone: goToScreen('settle')`；`markTutorialSeenV2()` 本身不是觸發結算的原因，可以保留。
4. 中期：正式關卡中的 `show-tutorial` 改成 `show-quick-hint`
5. 完整教學只從主選單、教學關卡、結算頁或圖鑑/錯題本 help 入口進入

若 Phase 2 與 Phase 1 同一輪 land，可直接跳到 Phase 2，省略步驟 1-2 的 returnScreen 表，避免寫一段隨即被刪的程式。

驗證：

1. 進入 practice 關卡，答題前按遊戲中的教學，完成後仍停在遊戲畫面
2. 進入 settle 畫面按教學，完成後回 settle
3. `Save.isSubLevelCleared()` 不應因看教學而改變

### Phase 2：移除正式關卡內的完整教學 modal

目標：不要在正式 game loop 中加入第二套 modal pause 系統。

決策：

- 正式關卡內不開完整 tutorial modal。
- 正式關卡內的教學按鈕改成 quick hint。
- quick hint 不改 phase、不停 timer、不碰 AI、不進 `_tutorialState`。
- 若任何完整 tutorial modal 嘗試從 `game` screen 開啟，runtime 應阻止或轉成 quick hint。

這會刪掉原本需要設計的 modal pause/resume 工作。Duel 搶答後暫停 dynamic 仍是核心玩法，另由 dynamic pause cleanup 處理，不和 tutorial modal 混在一起。

驗證：

1. Practice / Duel 中按教學只開 quick hint。
2. quick hint 開啟時，遊戲 phase 不變。
3. Duel countdown / AI / dynamic effect 不因 quick hint 建立額外 pause path。
4. quick hint 是 non-modal：不 focus trap，不設定 `aria-modal="true"`，遊戲鍵盤輸入仍照常運作。

### Phase 3：修正 Duel 逾時/放棄統計

目標：結算顯示和準確率符合「逾時/放棄算一次錯誤嘗試」。

做法：

1. 在 `duel.buzzed.ANSWER_TIMEOUT` 的 `stateDiff` 增加：
   - ``[`players.${a.player}.wrongCount`]``
   - ``[`players.${a.player}.correctStreak`] = 0``
2. 在 `duel.buzzed.GIVE_UP` 做同樣處理
3. 固定統計語意：
   - `totalAsked` 只代表題目進度 / 題目數。
   - accuracy 使用 `correctCount / (correctCount + wrongCount)`。
   - `Save.recordSubLevelRound()` 與 settle screen 都使用同一個 accuracy 分母。
   - 若 `correctCount + wrongCount === 0`，accuracy 為 `null`。

理由：

- Practice 可以答錯後重答；用 `correctCount / totalAsked` 會把多次錯誤隱藏掉。
- Duel timeout / give-up 是失敗嘗試，應計入 `wrongCount`。

驗證：

1. Practice 10 題全答對且無錯：accuracy 100%。
2. Practice 10 題最後都答對，但中間錯 5 次：accuracy 10 / 15。
3. Duel timeout / give-up 會增加 wrongCount，accuracy 不會被高估。

### Phase 3b：清理 reducer 時間來源

目標：在碰任何 buzz timing、dynamic score percentage 或 future pause 前，先把 reducer 裡的 direct `Date.now()` 移出。

做法：

1. runtime dispatch gameplay action 時補 `now`：
   - `{ type: 'BUZZ', player, now }`
   - handoff 產生的 next state 也使用 action/effect 提供的 `now`
2. `mode-rules.js` 的 `BUZZ` / handoff 不再直接呼叫 `Date.now()`。
3. `_startBuzzedTickLoop()` 仍可用 wall-clock 顯示倒數，但 reducer state 的時間戳由 action 提供。

驗證：

1. BUZZ 後 `buzz.timerStartedAt` 來自 action.now。
2. handoff 後新的 `buzz.timerStartedAt` 來自 action/effect 注入時間。
3. 既有 Duel countdown 行為不變。

### Phase 3c：驗證 dynamic pause no-op handler

目標：解決 `duel.buzzed.EFFECT_COMPLETE` Band-aid 是否仍必要。

做法：

1. 檢查 `EffectManager._blacklistedEffects` 是否已能阻止 pause/cancel 後的 dynamic completion。
2. 暫時移除 `duel.buzzed.EFFECT_COMPLETE` no-op handler，在 Duel buzz / answer / handoff / reveal 流程中驗證。
3. 若沒有 regression，刪除 handler。
4. 若仍有漏出的 `EFFECT_COMPLETE`，記錄 event source，修 `EffectManager`，不要只保留吞事件補丁。

若驗證過程出現 regression，恢復 no-op handler，並依 `ARCHITECTURE_RULES.md` 的 Dynamic Pause 規則把繞過 blacklist 的 event source 記錄下來，再修 `EffectManager`；不要把驗證中的暫時移除直接合併成永久刪除。

### Phase 4：新增 dynamic score percentage UI

目標：Duel dynamic reveal 過程中顯示目前可得分數百分比，且與實際得分公式一致。

做法：

1. 在遊戲畫面新增元素，例如：
   - `#dynamic-score-pct`
2. 在 `_updateDynamicVisual()` 裡更新文字，因為該函式已在 rAF tick 中被呼叫
3. 百分比公式必須跟 `mode-rules.js` 一致：
   - `potential = max(duelMinScore, duelBaseScore * (1 - elapsedMs / dynamicDurationMs))`
   - `pct = round(potential / duelBaseScore * 100)`
4. 不要使用 `maxScore - (maxScore - minScore) * t`，因為那和目前 reducer 的實際得分公式不同

驗證：

1. dynamic 剛開始顯示約 100%
2. dynamic 完成後顯示 `duelMinScore / duelBaseScore`
3. 搶答後實際得分與顯示百分比可推導一致
4. dynamic image 不得有 `transition: transform` 或 `transition: filter` 造成 rAF 數值延遲

### Phase 4b：Dynamic effect 擴充策略

目標：增加 Duel 可玩性，但保持 effect 與計分一致。

可行效果：

1. **zoom**
   - 現有：從放大到正常大小。
   - 成本：已存在，低。

2. **blur-to-clear**
   - 從模糊到清楚。
   - CSS：`filter: blur(px)`。
   - 成本：低。
   - 風險：過度 blur 可能讓玩家完全看不到有效資訊。

3. **pixelate-to-clear**
   - 從粗馬賽克到清楚。
   - 成本：中到高。
   - 原因：純 CSS 對 SVG/img pixelate 不穩，可能需要 canvas 或預處理圖。
   - 建議：先不要第一批做。

4. **rotate-and-shrink**
   - 一邊旋轉一邊從大縮小。
   - CSS：`transform: scale(...) rotate(...)`。
   - 成本：低到中。
   - 風險：旋轉會影響可讀性，分子結構可能變難辨識但不是化學本身的難度。

5. **spotlight / mask reveal**
   - 一開始只露出局部，逐漸露出全圖。
   - 成本：中。
   - 風險：要處理不同尺寸 SVG 的遮罩位置。

建議第一批只做：

- `zoom`
- `blur`
- `rotateZoom`

不要一開始就做 pixelate。pixelate 等 core loop 穩定後再做。

不同關卡不同效果：

- 可以做，而且是推薦方向。
- 每個 family/difficulty 可以指定 `dynamicVariant`。
- 例如 beginner 用 `zoom`，intermediate 用 `blur`，advanced 用 `rotateZoom`。
- 計分公式先保持同一套：都用 `elapsedMs / durationMs` 算分數，不因效果不同改分數邏輯。

效果交替：

- 可以每題輪替或隨機，但第一版不建議完全隨機。
- 推薦：關卡固定效果，或一個關卡只在 2 種效果間輪替。
- 原因：玩家需要建立預期；太隨機會像 UI 在干擾，而不是遊戲規則。

架構建議：

- `DynamicVariants` 只描述參數：duration、initial/final blur、scale、rotate。
- `_updateDynamicVisual()` 根據 `state.dynamic.variant` 套用不同 CSS。
- 不要每個 effect 寫一套新的 timer。所有 dynamic effect 共用 `EffectManager.runDynamicEffect()`。

### Phase 5：清理低成本 bug

1. 移除 `back-to-main` 的重複 `goToScreen('main-menu')`
2. `_spawnComboPopup()` cleanup 時重新 query DOM，而不是使用 stale `feedback`
3. keybinding capture 過濾 modifier-only key：
   - Shift / Control / Alt / Meta
4. story screen click handler 忽略互動元素：
   - 若 `e.target.closest('button, [data-action], a, input, select, textarea')` 則不 advance

## 後續重構建議

### 0. 先用 `ARCHITECTURE_RULES.md` 收斂風格

因為專案經過多個 AI / 多輪設計修改，現在有幾種風格混在一起：

- reducer effects 與 direct Save calls 混用
- reducer 內直接使用 `Date.now()`
- dynamic pause 有 Band-aid
- UI 有 DOM API 與大型 HTML string 混用
- 固定樣式有一部分寫在 JS
- audio 還是 `game-v2.js` helper，不是獨立系統

不建議一次全部重寫。建議每次功能修改時，只整理該功能附近的違規點，並避免新增新的混用。

### 1. 拆分 `game-v2.js`

`game-v2.js` 現在同時負責：

- dispatch / reducer integration
- effect plumbing
- render game screen
- render codex / wrong-book / settings
- tutorial / story modal
- menu navigation
- audio
- keyboard capture

建議拆成：

1. `game-runtime.js`
   - `dispatch()`
   - `applyAction()`
   - `runEffectAndChain()`
   - phase transition hooks
2. `game-render.js`
   - `renderGameScreen()`
   - `_updateDynamicVisual()`
   - feedback overlay
3. `menu-render.js`
   - main menu / sub menu / settle
   - menu arrow navigation
4. `modal-ui.js`
   - tutorial / story / confirm
   - modal pause interface
5. `settings-ui.js`
   - settings render + listeners
6. `codex-ui.js`
   - codex / wrong-book

這不是第一優先，因為目前還有會影響遊戲結果的 bug。建議在 Phase 1-5 後再做。

### 2. 明確定義「時間來源」

目前時間分散在：

- `Date.now()` in reducer rules
- `EffectManager` 的 timeout / rAF
- `_startBuzzedTickLoop()` 的 countdown
- `AIController` 的 reaction timing

建議後續建立一個 runtime clock 或至少集中 helper：

- `getNow()`
- `startBuzzTimer(owner, ms)`
- `pauseRuntime(reason)`
- `resumeRuntime(reason)`

這會讓 tutorial pause、browser inactive、AI timing、dynamic score percentage 更容易一致。

### 3. 移除 reducer 裡的 `Date.now()`

`mode-rules.js` 標榜 data-only reducer table，但現在 `BUZZ` 和 handoff 仍直接呼叫 `Date.now()`。這讓測試和 pause 更難做。

建議：

- action 帶入 `now`，例如 `{ type: 'BUZZ', player, now: Date.now() }`
- reducer 只讀 action，不直接讀 wall clock

### 4. 收斂 effect 語意

目前 effect 有兩種風格：

- reducer emit effect，`runEffectAndChain()` 執行
- `game-v2.js` 在 `applyAction()` 直接做 Save side effects

建議選一個方向：

- 短期：保留 direct Save calls，但刪掉未使用的 `saveWrong` / `fixWrong` effect handler，避免未來雙寫
- 長期：讓 reducer emit persistence effects，`game-runtime.js` 統一執行，`applyAction()` 不直接碰 Save

### 5. 建立最小測試面

即使目前是純前端，也可以先加 Node 層級的 reducer tests：

1. practice 答錯後可重答，`wrongCount` 增加
2. duel 答錯 handoff 到另一方
3. duel timeout / give-up 增加 `wrongCount`
4. duel score percentage helper 與 actual scoring 一致
5. tutorial onDone 不會觸發 settling

### 6. 教學關卡設計

教學關卡應該分成幾個短段落，每段只教一件事：

1. **基礎選項操作**
   - 顯示一題非常簡單的分子。
   - 教玩家用滑鼠點選。
   - 接著提示快捷鍵。

2. **Practice 快捷鍵**
   - 顯示四個選項與按鍵標籤。
   - 要求玩家用快捷鍵答對一次。
   - 錯了不懲罰，只提示「看選項旁邊的按鍵」。

3. **官能基辨識**
   - 用 2-3 題固定題教常見官能基。
   - 每題結束後用一行文字說明辨識點。

4. **Duel 搶答**
   - 教 buzz key。
   - dynamic zoom 開始後提示「看清楚就搶答」。
   - 玩家搶答後暫停，教作答鍵。

5. **放棄/逾時**
   - 教玩家答不出來可以放棄。
   - 說明放棄算本次失敗，但不等於關卡失敗。

6. **正式關卡提示**
   - 最後教玩家：正式關卡內的 `?` 只會顯示快速提示，不會打開完整教學。

實作上可以先不新增完整 mode。最保守做法：

- 新增一個 tutorial family/difficulty 或固定 tutorial queue。
- 使用現有 `practice` / `duel` 流程跑。
- 額外加一個 `tutorialStep` 狀態，控制提示文字和下一步條件。

等教學關卡穩定後，再考慮抽成正式 `tutorial` mode。

### 7. 教學關卡按鍵導引

可以做「指定按鍵亮起，玩家必須照著按才能繼續」。

建議做法：

- 教學關卡用 step 定義：
  - `message`
  - `highlightTarget`
  - `requiredAction`
  - `onSuccessNextStep`
- 例如：
  - step 1：亮起第一個選項，要求滑鼠點擊。
  - step 2：亮起 `KeyQ` 標籤，要求按 `Q`。
  - step 3：亮起 buzz key，要求搶答。
  - step 4：亮起 give-up key，要求放棄一次。

實作邊界：

- 不需要 menu 每個關卡都支援快捷鍵。
- 教學關卡只攔截與當前 step 有關的 input。
- 其他 input 可以忽略或顯示「請按亮起的鍵」。
- 這個邏輯應該放在 tutorial-level controller，不要塞進一般 `InputController` 的主規則裡。

生成時機：

- 在 quick hint 替換完成後開始做。
- 原因：先移除正式關卡內完整 modal 的複雜度，再新增教學關卡，才不會兩套教學流程互相干擾。

### 8. Combo 音效

目前 combo popup 只顯示視覺效果，沒有獨立 combo sound effect。答對音效仍來自 reducer emit 的 `sound: correct`。

未來可以改成：

- combo 3：`comboGood`
- combo 5：`comboGreat`
- combo 7：`comboBrilliant`

建議不要寫死在 `_spawnComboPopup()` 裡。應新增一個 mapping：

- `comboSoundByTier = { good, great, brilliant }`

再由 combo popup 或 combo effect 統一呼叫 `_beep(comboSoundByTier[tier])`。長期更好的是把 audio 抽到 `audio-manager.js`。

### 9. CSS 整理

`style.css` 目前因多次設計變更已經偏亂，但不建議一次大拆。

這是中高風險工作，因為畫面樣式很容易出現非功能性回歸：

- 按鈕顯示錯誤
- Duel / Practice 狀態樣式互相影響
- option visibility 壞掉
- dynamic transform 疊加錯誤
- modal 層級或遮罩異常
- mobile/desktop layout 跑版

因此 CSS 遷移要獨立於核心 gameplay bug 修復，不要和 reducer / timer / tutorial flow 同一個 commit 混做。

建議順序：

#### CSS Phase A：只加規則，不搬樣式

1. 在 `ARCHITECTURE_RULES.md` 固定規則：JS 設 state，CSS 管樣式。
2. 在 `style.css` 加分區註解，不移動大段 CSS。
3. 新功能樣式只放到對應分區，不再加在檔案最底部。

風險：低。

#### CSS Phase B：搬低風險 inline style

先處理完全固定、不依賴時間或 gameplay calculation 的樣式：

1. HTML string 裡的固定 `style="text-align:center;color:..."`
2. 固定 empty/loading/notice 樣式
3. 固定 hidden/visible class，而不是 `style.display = ''`

風險：低到中。

驗證：

- main menu
- codex
- wrong book empty state
- settings
- tutorial modal

#### CSS Phase C：display / visibility 改成 class

處理 `game-v2.js` 裡這類邏輯：

- `buzz.style.display = isDuel ? 'flex' : 'none'`
- `p2Btn.style.display = ...`
- `container.style.visibility = ...`
- tutorial button show/hide

改成：

- JS toggle class / state class
- CSS 決定 display / visibility

風險：中。

驗證：

- Practice 不顯示 buzz
- Duel PvP 顯示雙方 buzz
- Duel PvE 隱藏 P2 buzz
- Buzzed phase 只顯示 owner options
- Revealing phase 顯示正解

#### CSS Phase D：dynamic effect 改成 CSS variables

目前 `_updateDynamicVisual()` 直接寫：

- `imgEl.style.transform = 'scale(...)'`

未來加 `blur` / `rotateZoom` 時，改成：

- `--dyn-scale`
- `--dyn-blur`
- `--dyn-rotate`

CSS 負責：

- transform
- filter
- transition/visual composition

風險：中高。

驗證：

- zoom 與原本視覺一致
- blur 不影響非 dynamic 關卡
- rotateZoom 不破壞 image layout
- 搶答 pause 時畫面停在正確進度
- dynamic image 沒有 transform/filter transition；runtime 每 frame 設值時不應被 CSS double-ease

#### CSS Phase E：拆 CSS 檔

等 UI module 拆出後再考慮，不要現在做。

可能拆成：

- `style.css`
- `game.css`
- `codex.css`
- `settings.css`
- `modal.css`

風險：中高。

前提：

- 已有手動測試清單
- 或已有基本 Playwright screenshot smoke test

#### CSS 遷移驗證清單

每次 CSS 遷移後至少檢查：

1. main menu
2. difficulty submenu
3. practice question
4. practice wrong answer
5. practice correct answer
6. settle screen
7. duel buzzOpen
8. duel buzzed owner side
9. duel PvE hidden P2 controls
10. dynamic playing / paused / reveal
11. codex tabs
12. wrong book empty + non-empty
13. settings tabs
14. tutorial / quick hint modal
15. mobile width

### 10. Audio Manager

新增 `audio-manager.js` 的目標：

- sound mapping
- preload / warm-up
- AudioContext unlock / resume
- BGM 播放與切換
- combo tier sounds
- fallback synth beep

建議時機：

- 教學跳結算 bug 與 quick hint stub 完成後
- combo tier sound 前
- dynamic variants 前
- 新增更多音檔前

理由：

- combo tier sounds 不應先接在 `_beep()` 上再二次遷移。
- BGM resume、AudioContext lifecycle、combo sound 都應共用同一個 audio path。

## 建議提交順序

1. `[done] docs(architecture): align rules with runtime API`
2. `[done] fix(tutorial): prevent in-game tutorial from settling`
3. `[done] feat(tutorial): replace in-game tutorial modal with quick hint`
4. `[done] fix(stats): count duel timeout and give-up as wrong attempts`
5. `[done] refactor(time): thread action now through buzz flow`
6. `[done] chore(effects): verify dynamic pause completion handling`
7. `[done] feat(duel): show dynamic score percentage`
8. `[done] feat(audio): introduce audio manager`
9. `[done] feat(audio): add combo-tier sound hooks`
10. `[done] feat(dynamic): add blur and rotate zoom variants`
11. `[done] fix(ui): clean minor navigation and popup issues`
12. `[todo] feat(tutorial): add tutorial level flow`
13. `[todo] feat(tutorial): add guided key-highlight steps`
14. `[todo] css: phase A add style sections`
15. `[todo] css: phase B move low-risk inline styles`
16. `[todo] css: phase C move display visibility rules to classes`
17. `[todo] refactor(game-v2): extract modal/runtime/render helpers`

後續新增完成：

- `[done] fix(duel): settle final question and tune audio levels`
