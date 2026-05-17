# Game Core Refactor Architecture

This document is the engineering execution map for the game-core refactor. The product rules live in `README.md`; this document defines module boundaries and guardrails for implementation.

## Scope

Refactor the core game rules, state flow, input locking, answer resolution, and transient effect lifecycle.

Do not redesign the visual UI in this phase. Avoid broad changes to `index.html`, `style.css`, `layout.css`, and `menu.css` unless a script tag or tiny state hook is required.

## Non-Goals

- Redesigning the menu, cards, modals, or visual theme.
- Rewriting Story, Tutorial, Codex, Wizard Picker, audio, or arena visuals from scratch.
- Changing chemistry content in `data.js`.
- Changing save format beyond fields required by the new Practice progress rules.
- Optimizing animations for polish before the state flow is stable.

## Target Modules

### `mode-rules.js`

Owns data-only mode configuration.

Expected responsibilities:

- Practice: 10-question rounds, 70% pass threshold, continue-practice policy.
- Speed: 60-second timer, +3 / -3 second answer effects, time-zero ending.
- Duel Standard: static question, buzz-in, 5-second answer ownership, first to 5.
- Duel Dynamic: shared Duel rules plus Dynamic variants and `completeState` policy.

Must not:

- Touch DOM.
- Read button classes.
- Start timers directly.

### `game-state.js`

Owns game state and state transition helpers.

Expected responsibilities:

- Current mode, level, question, round counters, and active player.
- Player state: score, answer count, cooldown, answer ownership, streaks.
- Locks: `globalInputLocked`, per-player locks, confirmation pause state.
- Duel shared wrong-option elimination.
- Cleanup state reset helpers.

Must not:

- Render HTML.
- Play sounds.
- Directly call `Save`.

### `question-engine.js`

Owns question selection, option generation, and answer checks.

Expected responsibilities:

- Draw questions from `QuestionSets[currentLevel]`.
- Avoid immediate repeats where possible.
- Build four options from `AnswerBank`.
- Support Level 99 category answers.
- Return answer results without mutating UI.

Must not:

- Add classes to option buttons.
- Decide visual feedback.
- Write progress to save.

### `effect-manager.js`

Owns transient effects and timers.

Expected responsibilities:

- Global input lock during answer resolution, reveal, and question transition.
- Per-player cooldown and answer-ownership countdown.
- Correct / wrong / reveal / timeout lifecycle.
- Cleanup of timeouts, intervals, transient DOM, and classes.
- Pause and resume timers / Dynamic animations during confirm dialogs.

Must not:

- Decide whether an answer is correct.
- Decide mode win conditions.
- Persist save data.

### `input-controller.js`

Owns conversion from raw keyboard / pointer events into game actions.

Expected responsibilities:

- Map keyboard and clicks to actions: `ANSWER_OPTION`, `BUZZ`, `CONFIRM_EXIT`, `CONFIRM_RESTART`.
- Respect `globalInputLocked` and per-player locks.
- Allow only confirmation/pause actions when appropriate.

Must not:

- Determine answer correctness.
- Mutate scoring or progress.
- Render options.

### `game.js`

Remains the coordination entry point for the first refactor phase.

Expected responsibilities:

- Initialize modules.
- Keep existing Story / Tutorial / Codex / Wizard Picker integration.
- Call render helpers and preserve current UI structure.
- Bridge old UI to new core modules during migration.

## Script Loading

If new browser globals are used, add scripts before `game.js` in `index.html`:

```html
<script src="mode-rules.js"></script>
<script src="game-state.js"></script>
<script src="question-engine.js"></script>
<script src="effect-manager.js"></script>
<script src="input-controller.js"></script>
<script src="game.js"></script>
```

Prefer small globals such as `ModeRules`, `GameState`, `QuestionEngine`, `EffectManager`, and `InputController` to match the existing non-module script style.

## State Principles

- DOM classes reflect state; they are not the source of truth.
- `setTimeout` and intervals are registered through effect lifecycle helpers.
- Cleanup means clearing transient state only. It does not choose the next gameplay destination.
- Confirm dialogs pause timers and Dynamic animations; cancel resumes the previous state.
- Any answer-resolution animation must set `globalInputLocked` until the next stable state.

## Migration Order

1. Add modules and script tags with no behavior change.
2. Move mode constants into `mode-rules.js`.
3. Wrap question drawing and option generation in `question-engine.js`.
4. Introduce state helpers and locks in `game-state.js`.
5. Route input through `input-controller.js`.
6. Centralize answer-resolution timers and cleanup in `effect-manager.js`.
7. Implement README mode rules one mode at a time: Practice, Speed, Duel Standard, Duel Dynamic.

## Stop Conditions

Pause and ask the user before:

- Removing a major feature.
- Redesigning layout or CSS.
- Changing chemistry content.
- Changing save-data compatibility in a way that could break existing saves.
- Reinterpreting a README rule that is still ambiguous.
