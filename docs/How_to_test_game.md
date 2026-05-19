# 問答遊戲 Debug 筆記

## 核心觀念

大部分 UI bug 不是畫面問題，而是：

* state（狀態）不明確
* transition（切換流程）混亂
* timeout 殘留
* input 沒有 lock

先把狀態定義清楚，再修 UI。

---

# 1. 遊戲狀態（Game States）

## 建議狀態

* idle
* showingQuestion
* waitingForAnswer
* answerSelected
* showingFeedback
* transitioning
* gameOver

---

# 2. 狀態規則

| 狀態               | 可點擊 | 可 highlight        | 說明      |
| ---------------- | --- | ------------------ | ------- |
| showingQuestion  | yes | yes                | 題目剛顯示   |
| waitingForAnswer | yes | hover only         | 等待玩家作答  |
| answerSelected   | no  | selected only      | 玩家已選答案  |
| showingFeedback  | no  | correct/wrong only | 顯示正確與錯誤 |
| transitioning    | no  | no                 | 切換下一題   |
| gameOver         | no  | no                 | 遊戲結束    |

---

# 3. 重要互動規則

## Input Lock（避免連點）

玩家第一次有效點擊後：

* 立即 disable 所有按鈕
* 忽略後續點擊
* 防止重複加分

---

## Feedback Timing（回饋時序）

建議流程：

1. 玩家點答案
2. 立即 lock input
3. 顯示 selected 狀態
4. 顯示 correct / wrong feedback
5. 等待 feedback delay
6. 切換下一題

---

## Transition 規則

切換下一題期間：

* 禁止點擊
* 清除舊 highlight
* 清除舊 timeout
* reset UI state

---

# 4. 常見 Bug 來源

## Stale Timeout（舊 timeout 殘留）

上一題 timeout 影響下一題。

解法：

* timeout 要命名
* 下一題前 clearTimeout

例如：

* feedbackTimeout
* transitionTimeout

---

## State Leakage（狀態殘留）

上一題的 highlight 還留著。

解法：

* render 下一題前先 reset UI state

---

## Double Click Race（連點競態）

玩家快速連點。

解法：

* 第一個 click 就立刻：
  inputLocked = true

---

## 延遲感（Laggy Feeling）

玩家點了但沒立即反應。

解法：

* click 後立即有視覺回饋
* 立刻 disable button

---

# 5. Debug Overlay（超重要）

開發時畫面上永遠顯示：

STATE: waitingForAnswer
selectedAnswer: B
inputLocked: true
transitioning: false

很多 bug 一眼就能看出來。

---

# 6. Event Timeline（事件時間軸）

紀錄重要事件：

[12:01.231] click answer A
[12:01.240] input locked
[12:01.260] show feedback
[12:02.000] next question

很多「怪怪的」其實是 timing 問題。

---

# 7. 建議 Workflow

## 改 code 前先問：

* 哪個 state 錯了？
* 哪個 event 太晚發生？
* 哪個 timeout 沒清掉？

---

## 優先修：

* state
* timing
* local interaction

避免：

* 重寫整個 game loop
* debug 時大重構

---

# 8. 黃金法則

如果 UI 很亂：
→ state machine 不清楚

如果 UI 很卡：
→ feedback timing 太慢

如果 UI 很像鬧鬼：
→ stale state / stale timeout
