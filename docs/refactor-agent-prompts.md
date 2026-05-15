# Refactor Agent Prompts

Use these prompts when delegating codebase analysis or implementation. The main agent remains responsible for architecture, integration, review, and final verification.

## Shared Instructions For All Subagents

```text
You are working in the Organic Sorting Hat repository.

Read README.md first and treat its top specification section as the source of truth. Decision Log entries are historical and may conflict with the current spec.

Do not redesign UI visuals. Do not broadly edit index.html or CSS unless explicitly asked. Do not change chemistry content in data.js.

When reporting code references, include file paths and line numbers. Keep output concise and actionable.
```

## Agent A: Practice / Speed Read-Only Analysis

```text
You are subagent A. Do read-only analysis only. Do not modify files.

Goal: Analyze game.js Practice and Speed flows against README.md's current rules.

Find and report:
1. Relevant functions and line numbers.
2. Existing behavior that conflicts with the new spec:
   - Practice: 10-question rounds, 70% pass, continue with unseen + wrong questions.
   - Speed: 60 seconds only, +3/-3 seconds, time-zero ending, no HP/health.
3. Logic that should move to mode-rules.js, game-state.js, question-engine.js, or effect-manager.js.
4. Minimal migration steps for Practice and Speed.

Do not analyze Duel/Dynamic except where shared code affects Practice/Speed.
```

## Agent B: Duel / Dynamic Read-Only Analysis

```text
You are subagent B. Do read-only analysis only. Do not modify files.

Goal: Analyze game.js Duel Standard, Zoom/Dynamic, buzz-in, answer ownership, timeout, cooldown, and wrong-option elimination flows against README.md's current rules.

Find and report:
1. Relevant functions and line numbers.
2. Existing behavior that conflicts with the new spec:
   - Duel Standard: static question + buzz bell + 5-second answer ownership.
   - Duel Dynamic: question shown before options, buzz bell, Dynamic pauses after buzz.
   - Timeout: 5 seconds counts as failure but does not eliminate an option.
   - Wrong options are shared across both players.
   - After both players fail a turn, Dynamic resumes and full buzz is restored.
   - When 3 wrong options are eliminated, Dynamic reaches completeState before answer reveal.
3. Which old zoom logic can be kept, and which must be replaced.
4. Suggested state-machine fields needed for Duel/Dynamic.

Do not analyze Practice/Speed except where shared code affects Duel/Dynamic.
```

## Agent C: Effects / Cleanup / Input Locks Read-Only Analysis

```text
You are subagent C. Do read-only analysis only. Do not modify files.

Goal: Analyze game.js timers, setTimeouts, intervals, class add/remove, transient DOM, locked-area, warnings, answer effects, Dynamic animation pause/resume, and modal/confirm behavior.

Find and report:
1. Relevant functions and line numbers.
2. Every timer / interval / transient class lifecycle you can identify.
3. Places likely to cause duplicate input, stale classes, stuck warnings, clipped effects, or effects that never disappear.
4. What should be centralized in effect-manager.js.
5. Where globalInputLocked and per-player locks should be enforced.

Prioritize bug risk over cosmetic issues.
```

## Worker Prompt: Create Core Module Skeletons

Use after the read-only agents report back.

```text
You are a worker agent. You may edit files.

Task: Create the initial core-module skeletons without changing gameplay behavior:
- mode-rules.js
- game-state.js
- question-engine.js
- effect-manager.js
- input-controller.js

Also add script tags before game.js in index.html.

Constraints:
- Do not rewrite game.js behavior yet.
- Keep browser-global style, no bundler.
- Export globals: ModeRules, GameState, QuestionEngine, EffectManager, InputController.
- Include minimal no-op or pure helper APIs that the main agent can wire in later.
- Do not edit CSS.
- Do not edit data.js content.

At the end, list files changed and any assumptions.
```

## Worker Prompt: Implement Mode Rules

```text
You are a worker agent. You may edit files.

Task: Implement mode-rules.js based on README.md:
- Practice: 10 questions, 70% pass threshold, continue-practice policy.
- Speed: 60 seconds, +3/-3 seconds, time-zero ending.
- Duel Standard: first to 5, buzz-in, 5-second answer ownership.
- Duel Dynamic: same Duel rules plus Dynamic variants with completeState.

Constraints:
- Do not change UI visuals.
- Do not change data.js.
- Keep rules data-driven and easy to inspect.
- If game.js integration is needed, keep it minimal and documented.
```

## Main Agent Handoff Prompt

```text
You are the main supervising agent for the Organic Sorting Hat game-core refactor.

Current branch should be refactor/game-core-state.

Read:
- README.md
- docs/refactor-architecture.md
- docs/refactor-agent-prompts.md
- docs/refactor-test-checklist.md
- game.js
- data.js
- save.js
- story.js
- tutorial.js

Plan:
1. Spawn read-only subagents A/B/C using docs/refactor-agent-prompts.md.
2. While they inspect, locally review script loading and game.js entry points.
3. Integrate their findings into a minimal implementation plan.
4. Implement in small steps, preserving UI visuals.
5. Run static checks and the manual checklist where possible.
6. Commit only coherent milestones.

Ask the user only if README.md is ambiguous, if a major feature would need removal, or if UI/CSS redesign becomes necessary.
```
