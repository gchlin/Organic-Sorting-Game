# Refactor Test Checklist

Use this checklist after each game-core refactor milestone. The goal is to catch state-flow regressions, not to polish UI.

## Static Checks

- [ ] `git status --short` shows only expected files changed.
- [ ] New script files are loaded before `game.js` in `index.html`.
- [ ] Browser console has no syntax errors on page load.
- [ ] Existing globals still load: `AnswerBank`, `QuestionSets`, `StoryScripts`, `LevelTutorials`, `Save`, `Game`.
- [ ] No new module requires a build step or network dependency.

## Smoke Test

- [ ] Page loads to the main menu.
- [ ] New player tutorial can open and close.
- [ ] Wizard picker still opens and starts a game.
- [ ] Reference / Codex / Settings modals still open and close.
- [ ] Mute button still toggles without errors.
- [ ] Save export and import controls still open.

## Practice Mode

- [ ] Starts without countdown.
- [ ] Shows question image and four options.
- [ ] Answering locks input during feedback.
- [ ] Correct answer increments round stats.
- [ ] Wrong answer reveals correct answer and shows learning feedback.
- [ ] Round ends after 10 questions.
- [ ] 7/10 or better marks the level as passed.
- [ ] Below 7/10 does not mark the level as passed.
- [ ] End-of-round choice offers continue practice or leave level.
- [ ] Continue practice includes unseen questions and this round's wrong questions.
- [ ] Practice pass rate is stored for Codex display.
- [ ] Practice is the only mode that unlocks story.

## Speed Mode

- [ ] Starts at 60 seconds.
- [ ] UI displays time only, not HP/health.
- [ ] Correct answer adds 3 seconds.
- [ ] Wrong answer subtracts 3 seconds.
- [ ] Time value remains integer seconds.
- [ ] Time reaching zero ends the game and shows correct-answer count.
- [ ] Speed does not unlock Codex molecules.
- [ ] Speed does not unlock story.

## Duel Standard

- [ ] Static question appears before options are visible.
- [ ] Players must use buzz-in before seeing options.
- [ ] First valid buzz gets answer ownership.
- [ ] Only current answer owner can answer.
- [ ] Answer owner has 5 seconds.
- [ ] Timeout counts as answer failure but does not eliminate any option.
- [ ] Wrong selected option is shared-eliminated for the question.
- [ ] Wrong answer transfers ownership to the opponent.
- [ ] After both players fail a turn, both can buzz again.
- [ ] When three wrong options have been eliminated, the correct answer is revealed and the game moves to next question.
- [ ] First player to 5 correct answers wins.
- [ ] Duel correct answers do not increment total Practice answer count.
- [ ] Duel does not unlock Codex or story.

## Duel Dynamic

- [ ] Dynamic question starts with question image and buzz bell only.
- [ ] Options are not visible before buzz-in.
- [ ] Dynamic animation starts before buzz-in.
- [ ] Pressing buzz pauses Dynamic animation.
- [ ] Current answer owner sees options.
- [ ] Owner timeout after 5 seconds transfers ownership to opponent without eliminating an option.
- [ ] Owner wrong answer transfers ownership to opponent and keeps Dynamic paused.
- [ ] Opponent timeout/wrong answer restores full buzz and resumes Dynamic if reveal threshold is not reached.
- [ ] Dynamic animation reaching completeState does not reveal the answer by itself.
- [ ] If three wrong options are eliminated, Dynamic reaches completeState before revealing answer.
- [ ] After reveal, transient classes and timers are cleaned before next question.

## Input Locking And Cleanup

- [ ] Repeated rapid clicks during answer feedback do not trigger multiple answers.
- [ ] Repeated key presses during answer feedback do not trigger multiple answers.
- [ ] Global input lock releases before next stable question state.
- [ ] Per-player lock prevents only the locked player when appropriate.
- [ ] `Esc` / `M` during gameplay opens "confirm return to menu" instead of immediately leaving.
- [ ] Confirmation pauses Speed timer, Duel answer countdown, and Dynamic animation.
- [ ] Canceling confirmation resumes previous state.
- [ ] Confirming return performs cleanup and returns to menu.
- [ ] `R` during gameplay asks for restart confirmation.
- [ ] Restart confirmation cleanup does not leave old timers or classes.

## Regression Watchlist

- [ ] No stuck `.locked-area`.
- [ ] No warning message remains after next question.
- [ ] No answer highlight remains after next question.
- [ ] No Dynamic pause class remains after next question.
- [ ] No old countdown continues after leaving mode.
- [ ] No attack/effect element remains permanently on screen.
- [ ] No modal leaves background gameplay running unless explicitly intended.

## Suggested Manual Test Script

1. Load page and start Practice Level 1.
2. Answer several correct and wrong responses quickly, including double-clicks.
3. Finish 10 questions and verify pass/fail flow.
4. Start Speed, answer correct/wrong, verify +3/-3 seconds and zero-time ending.
5. Start Duel Standard, test buzz, wrong transfer, timeout, and first-to-5.
6. Start Duel Dynamic, test pre-buzz hidden options, pause/resume, timeout transfer, and reveal threshold.
7. During each mode, press `Esc`, cancel, then press `Esc` again and confirm.
