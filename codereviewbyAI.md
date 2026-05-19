Code Review: game-v2.js
This is a substantial, well-structured game core. The dispatch → reducer → effects → render architecture is sound, and the invariant documentation in the header is excellent. Below is a catalog of issues found, ordered by severity.

🔴 Critical Bugs
1. Unguarded global reference to DuelDynamicRules — crashes on every action
JavaScript

Copy
const dynRules = getEffectiveRules(DuelDynamicRules, settings);
If DuelDynamicRules is not defined (script load order issue, test environment, etc.), this throws a ReferenceError on every single dispatched action — not just game actions. Since dispatch is called from menu navigation too, a missing global bricks the entire app silently (the try/finally in dispatch suppresses the error but leaves state inconsistent).

Fix:

JavaScript

Copy
const baseRules = (typeof DuelDynamicRules !== 'undefined') ? DuelDynamicRules : {};
const dynRules = getEffectiveRules(baseRules, settings);
2. _prevCombo is never reset between games
JavaScript

Copy
const _prevCombo = { p1: '', p2: '' };
This module-level variable persists across beginMode() calls. If a player earns "厲害" (3-streak) in game A, then starts game B and hits 3-streak again, the combo popup will not fire because _prevCombo.p1 === '厲害' still holds — the upward-crossing guard sees no tier change.

Fix: Reset in beginMode:

JavaScript

Copy
function beginMode(opts) {
  // …existing teardown…
  _prevCombo.p1 = '';
  _prevCombo.p2 = '';
  // …
}
3. Double render on settling — _onEnterSettling calls goToScreen → render() after render() already ran
JavaScript

Copy
// In applyAction:
render();                        // ← first render (on game screen)
if (beforePhase !== 'settling' && state.phase === 'settling') {
    _onEnterSettling();          // ← calls goToScreen('settle') → render()
}
The first render() paints the game screen while state.phase is already 'settling', then _onEnterSettling switches to the settle screen and renders again. The first render is wasted (the game screen is immediately replaced) and any DOM queries in that first render run against stale screen visibility.

Fix: Check phase transition before rendering:

JavaScript

Copy
if (beforePhase !== 'settling' && state.phase === 'settling') {
    _onEnterSettling();
}
render();
4. _goNextLevel iterates difficulty-then-family — likely wrong progression order
JavaScript

Copy
for (const d of DIFFICULTIES) {       // beginner → intermediate → advanced
    for (const fk of famKeys) {       // family A, B, C …
        all.push({ family: fk, difficulty: d });
    }
}
This produces: (A,beginner), (B,beginner), (C,beginner), (A,intermediate), … — the player finishes all beginner families before seeing any intermediate. The natural expectation for "next level" after clearing (A,beginner) is (A,intermediate), not (B,beginner).

Fix (family-first order):

JavaScript

Copy
for (const fk of famKeys) {
    for (const d of DIFFICULTIES) {
        if (Families[fk].difficulties.indexOf(d) !== -1)
            all.push({ family: fk, difficulty: d });
    }
}
🟠 Important Issues
5. Save.writeSettings with partial nested objects — depends on undocumented deep merge
JavaScript

Copy
Save.writeSettings({ devQuickWin: { enabled: v } });
// …later in another handler:
Save.writeSettings({ devQuickWin: { winAfter: v } });
If writeSettings does a shallow merge at the top level (replacing devQuickWin entirely), enabling the checkbox and then setting the "win after" number would wipe enabled back to undefined. This is a classic partial-update footgun.

Fix: Either document that writeSettings deep-merges, or always write the complete sub-object:

JavaScript

Copy
const prev = Save.readSettings().devQuickWin || {};
Save.writeSettings({ devQuickWin: Object.assign({}, prev, { enabled: v }) });
6. _setByPath creates intermediate objects as {} — breaks Sets and Arrays
JavaScript

Copy
function _setByPath(obj, path, value) {
    // …
    if (cur[parts[i]] === undefined || cur[parts[i]] === null)
        cur[parts[i]] = {};     // ← always a plain object
}
If the reducer emits a stateDiff like "effects.activeIds", this creates a {} where a Set is expected. Any subsequent .has() / .add() / .delete() calls on it will silently fail or throw.

Fix: Either ban paths that cross collection boundaries (enforce in reducer), or allow the reducer to specify the collection type, or switch to an explicit stateDiff format that uses whole-object replacement for collections:

JavaScript

Copy
// Safer: replace collections wholesale
if (result.stateDiff) {
    for (const path in result.stateDiff) {
        if (path.includes('activeIds') || path.includes('wrongInRound')) {
            _setByPath(state, path, result.stateDiff[path]); // must be a Set
        } else {
            _setByPath(state, path, result.stateDiff[path]);
        }
    }
}
7. Event listeners accumulate — attachMenuListeners, attachSettingsListeners, attachGiveUpListeners, initHatChars are never cleaned up
If init() is called more than once (HMR, dynamic module reload, test re-entry), every listener is duplicated. The document.body click delegate, document keydown handler, and mousemove handler will all fire multiple times per event.

Fix: Return cleanup functions or guard with a flag:

JavaScript

Copy
let _listenersAttached = false;
function attachAllListeners() {
    if (_listenersAttached) return;
    _listenersAttached = true;
    attachMenuListeners();
    attachSettingsListeners();
    // …
}
8. renderCodexScreen / renderWrongBookScreen — full DOM rebuild + listener re-attachment every render
These functions set root.innerHTML = html then call wireWrongBookTabs(root) / wireWrongBookActions(root). Every render() call (which happens on every dispatched action, including timer ticks during gameplay) tears down and rebuilds the entire codex/wrong-book DOM and re-attaches all listeners.

When the codex or wrong-book screen isn't active (_currentScreen !== 'codex'), the switch in render() skips them — so the real cost is only when those screens are visible. But even then, any dispatch (including background effects completing) triggers a full rebuild.

Fix: Short-circuit early:

JavaScript

Copy
case 'codex':
    if (document.getElementById('codex-content').childElementCount === 0
        || _codexDirty) {
        renderCodexScreen();
        _codexDirty = false;
    }
    break;
Or use a dirty flag set only when codex-relevant state changes.

9. Missing typeof guards on critical globals
Several code paths assume globals exist without checking:

Location
Global	Consequence if missing
beginMode	QuestionEngine	Crash on queue building
beginMode	AIController	Crash on new AIController() (partially guarded by try-catch)
_enrichQuestionState	QuestionEngine, Difficulties	Crash on options generation
renderMainMenu	Families, QuestionImages, AnswerBank	Partially guarded
_famCompoundKeys	QuestionImages	Unchecked — crash on loop
Fix: Add typeof X !== 'undefined' guards at each call site, or centralize dependency checking in init() and set a flag.

10. _formatKeyCode edge case for arrow keys
JavaScript

Copy
if (code.indexOf('Arrow') === 0)
    return '↑↓←→ '.charAt(
        ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(code)
    ) || code;
indexOf returns -1 for unrecognized codes starting with Arrow (e.g., a hypothetical ArrowHome). '↑↓←→ '.charAt(-1) returns '' (empty string), not code — the || code fallback never triggers because charAt(-1) is '' which is falsy. Wait — actually '' || code would return code. So this is correct. But charAt(-1) returning '' is a JS quirk — worth a comment.

🟡 Medium Issues
11. _wrongChosenMap lives at module scope but logically belongs to round state
It maps compoundKey → chosenWrongAnswerKey for the settle screen's "你選了：XXX" display. It's cleared in beginMode, but if SUBMIT_ANSWER fires after beginMode creates a new state but before the first question loads, it could write stale data.

Fix: Move it into state.wrongChosenMap = {} inside GameState.createStateV2().

12. Queue empty after wrong-book retrain — no user feedback
JavaScript

Copy
function _buildQueueFromWrongBook(family, difficulty, overrideKeys) {
    const active = …;
    if (!active.length) return [];
    // …
}
If the player clicks "重練目前篩選" but the filtered set is empty (e.g., they just mastered all entries and the tab hasn't refreshed), state.queue = [], the first LOAD_NEXT_QUESTION triggers settling immediately with no questions answered — a confusing UX.

Fix: Add a pre-check in the click handler:

JavaScript

Copy
if (keys.length === 0) {
    _pendingConfirm = { text: '這個篩選下沒有可練習的卡片。', onYes: function(){}, onNo: null };
    render();
    return;
}
13. EFFECT_COMPLETE blacklist bypass when EffectManager is undefined
JavaScript

Copy
if (typeof EffectManager !== 'undefined' && EffectManager.isEffectBlacklisted && …) {
    return;  // dropped
}
// falls through if EffectManager doesn't exist
If EffectManager fails to load, no effect completion is ever blacklisted. Stale effects can drive ghost phase transitions. This violates invariant I-3.

Fix: Maintain an internal blacklist as a fallback:

JavaScript

Copy
const _blacklistedEffects = new Set();
// In runEffectAndChain, before running:
if (typeof runId === 'number') _blacklistedEffects.add(runId);
// In cancelAllEffects:
effectIds.forEach(id => _blacklistedEffects.add(id));
// In applyAction:
if (_blacklistedEffects.has(action.effectId)) { _blacklistedEffects.delete(action.effectId); return; }
14. runEffectAndChain accesses state.dynamic without null check
JavaScript

Copy
if (effect.name === 'startDynamic') {
    state.dynamic.phase = 'playing';   // ← crashes if state is null
If the game ends (state torn down) while an anim effect is being processed from the pending queue, state could be null.

Fix: Guard with if (!state || !state.dynamic) return; at the top of each anim branch.

15. Racy _buzzedTickRafId lifecycle — rAF can fire once after _hideBuzzedUI
When phase changes away from 'buzzed', the rAF loop's next tick fires the cleanup branch:

JavaScript

Copy
if (!state || state.phase !== 'buzzed' || …) {
    _buzzedTickRafId = null;
    _hideBuzzedUI();
    return;
}
But between the phase change and the next rAF tick, render() may have already painted the new state. The _hideBuzzedUI() call then redundantly modifies DOM. More critically, if another dispatch happens in that gap, _startBuzzedTickLoop sees _buzzedTickRafId !== null and doesn't restart — but the old loop is about to self-terminate.

Fix: Cancel the rAF explicitly on phase exit:

JavaScript

Copy
function _stopBuzzedTickLoop() {
    if (_buzzedTickRafId !== null) {
        cancelAnimationFrame(_buzzedTickRafId);
        _buzzedTickRafId = null;
    }
    _hideBuzzedUI();
}
Call _stopBuzzedTickLoop() in clearTransientUI().

🔵 Minor / Style Issues
16. Duplicated HTML-escape functions
_escapeHtml (top-level) and esc (inside renderCodexScreen / renderWrongBookScreen) do the same thing but esc also handles ' → &#39; (Wait—actually esc doesn't, they're identical). Remove one and use the other everywhere.

17. renderSettleScreen magic string 'wrongOnly' for state.queueSource
This is compared but never documented as a valid enum value. Add a constant:

JavaScript

Copy
const QUEUE_SOURCE_WRONG_ONLY = 'wrongOnly';
18. AudioContext is never closed
The browser will suspend it eventually, but calling _audioCtx.close() on game teardown is cleaner:

JavaScript

Copy
function _teardownAudio() {
    if (_audioCtx) { _audioCtx.close(); _audioCtx = null; }
}
19. _audioCtx may be in "suspended" state after creation
Browsers require a user gesture to resume an AudioContext. The first beep after page load may be silent if no prior gesture unlocked it. The menu click that starts the game is a gesture, but _beep is called from effects that may run asynchronously after the gesture context has expired.

Fix: Resume on first use:

JavaScript

Copy
function _getAudioCtx() {
    if (_audioCtx) {
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        return _audioCtx;
    }
    // …
}
20. Practice dev-shortcut state.queue = [] bypasses wrong-in-round processing
JavaScript

Copy
if (state.mode === 'practice' && action.type === 'SUBMIT_ANSWER' &&
    typeof dynRules.practiceClearAfterN === 'number' &&
    state.players.p1.correctCount >= dynRules.practiceClearAfterN) {
    state.queue = [];
}
Clearing the queue forces settling, but if the player's last answer was wrong, the wrong-in-round entry still needs to be shown on the settle screen. This works because state.wrongInRound is populated before this check runs — but it's fragile. Add a comment clarifying the intentional ordering dependency.

21. renderGameScreen option rendering has a subtle mismatch in duel feedback visibility
JavaScript

Copy
const feedbackApplies = !isDuel || !_lastAnswerPlayer || _lastAnswerPlayer === containerPlayer;
When _lastAnswerPlayer is null (just after LOAD_NEXT_QUESTION), !_lastAnswerPlayer is true, so feedbackApplies = true for both containers. In duel mode, this means both sides see feedback classes during revealing/revealed phases even though only one player answered. The correct-reveal class is arguably correct (both should see the right answer), but wrong-chosen and correct-chosen should probably only show on the answering player's side.

Summary Table
#
Severity	Issue	Location
1	🔴	Unguarded DuelDynamicRules reference	applyAction
2	🔴	_prevCombo never reset between games	module scope
3	🔴	Double render on settling	applyAction
4	🔴	_goNextLevel iterates difficulty-first	_goNextLevel
5	🟠	Partial writeSettings may wipe sibling keys	Settings handlers
6	🟠	_setByPath creates {} instead of Set/Array	_setByPath
7	🟠	Listeners accumulate on re-init	init
8	🟠	Full DOM rebuild on every render call	Codex/WrongBook
9	🟠	Missing typeof guards on globals	Multiple
10	🟠	Arrow key formatting edge case	_formatKeyCode
11	🟡	_wrongChosenMap at module scope	module scope
12	🟡	Empty queue → instant settle with no feedback	Wrong-book retrain
13	🟡	EFFECT_COMPLETE blacklist bypass	applyAction
14	🟡	Null state access in anim effects	runEffectAndChain
15	🟡	Racy rAF lifecycle for buzzed countdown	_startBuzzedTickLoop
16–21	🔵	Style/cleanup issues	Various
The architecture is solid — the phase-based state machine, effect chaining, and invariant enforcement are well-designed. The critical issues are all straightforward fixes (guards, resets, ordering). The most impactful improvement would be addressing the full-DOM-rebuild rendering strategy for the codex and wrong-book screens before they grow larger.