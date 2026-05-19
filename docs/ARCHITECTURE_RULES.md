# Architecture Rules

這份文件是給人和 AI 共同遵守的專案規則。目的不是追求抽象，而是避免不同人或不同模型修改後，出現第二套 loop、第二套 timer、第二套 save path、第二套 styling path。

## 核心原則

1. `mode-rules.js` 決定遊戲規則。
2. `game-v2.js` 或未來的 runtime module 負責 dispatch、套用 state diff、執行 effects、呼叫 render。
3. UI module 只負責 render / bind UI，不直接改 gameplay state。
4. `EffectManager` 是 timer / dynamic effect 的唯一執行層。
5. `Save` side effects 要走同一種路徑，不要同一件事同時 direct call 又 effect call。
6. JS 設定狀態；CSS 決定長相。

## Reducer / Rules

`mode-rules.js` 的 reducer handler 應保持接近純函式：

- 可以讀取 `state`、`action`、`dynRules`。
- 回傳 `{ nextPhase, stateDiff, effects }`。
- 不直接碰 DOM。
- 不直接呼叫 `Save`。
- 不直接播放 audio。
- 不直接啟動 timer。
- 不新增 UI class。

### 時間規則

不要在 reducer 裡直接呼叫 `Date.now()`。

建議：

- action 帶入時間，例如 `{ type: 'BUZZ', player, now }`
- runtime 在 dispatch 前補 `now`
- reducer 只使用 `action.now`

例外：

- 短期修 bug 可以先保留既有 `Date.now()`，但新功能不要再新增。

## Effects

Reducer 只描述要做什麼，不執行它。

推薦 effect 類型 (`effect.type`)：

- `sound`
- `anim`
- `timer`
- `timer.clear`
- `persist`
- `render`

Dynamic gameplay 透過 `{ type: 'anim', name: ... }` 派發。目前 `game-v2.js` 認得的 `name`：

- `startDynamic`
- `pauseDynamic`
- `resumeDynamic`
- `playDynamicToCompleteState`
- `freezeAtCompleteState`

`EffectManager.runDynamicEffect()` 內部使用 `{ op: 'play' | 'pause' | 'resume' | 'playToComplete' }`。Reducer 不直接 emit `{ type: 'dynamic', op: ... }`，而是 emit `{ type: 'anim', name: ... }`，再由 `game-v2.js` 轉譯。

不要 emit `dynamic.pause` / `dynamic.resume` / `dynamic.play` 作為 effect type；runtime 目前不認得這些名稱。

### Save Side Effects

目前 `game-v2.js` 有 direct Save calls，也有 `saveWrong` / `fixWrong` effect handler。這會造成風格混用。

短期規則：

- 不新增新的 direct Save calls，除非是在既有區塊延伸同一行為。
- 不新增新的 persistence effect，除非同時移除對應 direct Save call。
- 不讓同一件事同時 direct call 和 effect call。

長期目標：

- 所有 gameplay persistence 都改為 `persist` effects。
- runtime 統一執行 `persist` effects。
- `applyAction()` 不再直接知道 `Save.recordWrongV2`、`Save.addCorrect` 等細節。

## Dynamic Pause

Duel 搶答後暫停 dynamic 是正式遊戲規則，不是 modal pause，也不能移除。

規則：

- `BUZZ` 進入 `buzzed` 時，dynamic 必須暫停。
- 回合結束、換人或 reveal 時，dynamic 必須由明確 effect 恢復或播放到 complete state。
- `EffectManager` 應保證被 pause/cancel 的 dynamic effect 不會漏出舊的 `EFFECT_COMPLETE`。
- 不應依賴 `duel.buzzed.EFFECT_COMPLETE` 的 Band-aid 長期吞事件。
- 必須驗證 `duel.buzzed.EFFECT_COMPLETE` no-op handler 是否仍必要：
  - 若 `_blacklistedEffects` 已能阻止舊 effect completion，刪除該 no-op handler。
  - 若仍必要，文件必須寫明是哪一個 event source 繞過 blacklist。

目標：

- 把 dynamic pause/resume 做成 `EffectManager` 的正式能力。
- 移除或縮小 `duel.buzzed.EFFECT_COMPLETE` 的補丁。

## Tutorial Strategy

正式關卡內不開完整教學 modal。

- 完整教學內容放進教學關卡。
- 教學關卡可以 data-driven，像一般關卡一樣運作。
- 正式關卡內只顯示 quick hint。
- quick hint 是純 UI 浮層，不改 phase、不停 timer、不碰 AI、不進 `_tutorialState`。
- quick hint 是 non-modal：
  - 不做 focus trap。
  - 不設定 `aria-modal="true"`。
  - keyboard input 仍交給遊戲流程。
  - 若需要 screen reader 提示，使用非阻塞的 `aria-live` 或一般可見文字。

## UI Rendering

避免 `game-v2.js` 持續膨脹。

應優先拆出的 UI：

- codex
- wrong book
- settings
- tutorial modal
- story player
- confirm modal
- audio manager
- menu navigation helpers

### DOM API vs HTML String

同一個 module 內盡量保持一致。

建議：

- 小型動態節點：DOM API。
- 大型靜態模板：允許 template string，但必須集中在該 UI module。
- 不要在 runtime loop 裡塞大型 HTML 字串。
- 所有使用 `innerHTML` 的地方必須 escape user/data content。

## CSS / Styling

`style.css` 已經因多次設計變更變大，後續不要再把樣式散進 JS。

CSS 不應推導 gameplay 邏輯。JS / runtime 應先算好 phase、mode、owner、visibility 等狀態，再用 class、`data-*` 或 CSS variables 表達；CSS 只負責呈現這些狀態。

JS 可以做：

- add/remove/toggle class
- set text content
- set ARIA attribute
- set `data-*`
- set CSS variables for runtime numeric values

JS 不應做：

- 寫固定 `display`
- 寫固定 `color`
- 寫 layout style
- 寫 animation style
- 在 HTML string 中塞 inline style

例外：

- canvas / WebGL。
- runtime 進度值，例如 `--score-fill`、`--dyn-scale`、`--dyn-blur`。

Dynamic image 的 runtime values 由 rAF 每 frame 更新。不要在 dynamic image 或其 transform/filter 上加 CSS transition，否則會出現雙重 easing 與可見延遲。

推薦模式：

```js
el.classList.toggle('is-visible', visible);
el.style.setProperty('--progress', String(progress));
```

```css
.thing {
  opacity: var(--progress, 0);
}

.thing.is-visible {
  visibility: visible;
}
```

## CSS 整理方向

不要一次大清空 `style.css`。先新增結構，再逐步搬移。

建議順序：

1. 建立 CSS 分區註解：
   - base tokens
   - layout
   - menu
   - game screen
   - duel dynamic
   - codex
   - wrong book
   - settings
   - modal
   - utility states
2. 把 inline style 改成 class 或 CSS variable。
3. 新功能樣式先放到對應分區，不再隨手加在檔案底部。
4. 後續若要拆檔，再拆成：
   - `style.css`
   - `game.css`
   - `codex.css`
   - `settings.css`
   - `modal.css`

## Audio

音效不應長期留在 `game-v2.js` helper。

短期：

- 保留 `_beep()`，但不要再擴大。
- combo 音效先用 mapping，不要寫死在 popup 裡。

長期：

- 新增 `audio-manager.js`
- 負責 sound file mapping
- preload / warm-up
- AudioContext unlock / resume
- BGM
- combo tier sounds
- fallback synth beep

## Menu / Input

不需要 menu 每個關卡都有快捷鍵。

保留：

- menu 滑鼠
- menu 方向鍵 / Enter
- game answer keys
- buzz keys
- give-up keys

教學關卡負責教 game keys，不要把 menu 快捷鍵需求擴大。

## Dynamic Variants

每個正式關卡只使用一種 dynamic effect。

第一批可做：

- `zoom`
- `blur`
- `rotateZoom`

暫緩：

- pixelate
- complex mask reveal

所有 dynamic variants 共用：

- `EffectManager.runDynamicEffect()`
- `elapsedMs / durationMs` scoring
- `_updateDynamicVisual()` 或未來的 dynamic renderer

## 修改前 Checklist

每次改動前先確認：

1. 這是 gameplay rule、runtime、UI、audio、save、CSS 哪一層？
2. 是否已有 helper 或 module 可以放？
3. 是否新增了第二套 timer / event loop / save path？
4. 是否把固定樣式寫進 JS？
5. 是否讓 reducer 直接碰到時間、DOM、Save、audio？
6. 是否需要補一個小測試或手動驗證步驟？
