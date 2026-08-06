# Resume — how the mechanism works

Resume ("המשך מהמקום שבו הפסקת") is **enabled** in all five components as of 2026-08-06.
`RESUME_ENABLED = true` at line 14 of every `script.js`; that flag is also what switches the loader
from `xapi-720-i.js` to `xapi-720-j.js`, the build that carries the State API transport.

This document describes the mechanism as built. §9 lists what is deliberately *not* restored, §10
records the verification performed, and §11 is the changelog of the defects fixed on the way here.

---

## 1. What it does

A learner leaves the לומדה mid-way and comes back later through the platform launch link. Instead of
restarting at part 01 screen 0 they land on **the screen of the component they stopped at**, with
their answers, attempts and scores intact and repainted — and nothing is re-reported to the LRS.

Scope is the **whole unit**, not one component:

- One State document per unit, shared by all five parts.
- Re-entry always goes through the root `index.html`, which redirects to part 01
  ([index.html:8](index.html:8)). Part 01 reads the state and, if the learner stopped elsewhere,
  **hops** to that component before emitting any statement of its own.

## 2. Storage — the xAPI State API

Transport lives in the shared CDN library, not in this repo:
`https://lomdot.education.gov.il/metodica/720active/common/xapi-720-j.js`. It is `-i` plus a State
API block; nothing else differs. Three functions on `window`:

| Function | Behavior |
|---|---|
| `saveState720(stateId, obj)` | `ADL.XAPIWrapper.sendState(...)`, synchronous. Returns `true`/`false`. |
| `loadState720(stateId, cb)` | `getState(...)` synchronously and **also returns** the object. The lomda uses the return value. `null` when absent or on error. |
| `saveState720Debounced(stateId, obj, ms)` | `setTimeout` coalescing, default **800 ms**, keyed per `stateId`; re-arming replaces the pending payload. |

The document is addressed by three things:

1. **Activity id** — `window.XAPI_UNIT_ID`, set identically in all five parts at
   [script.js:9](methodica-math-scale-01-01/script.js:9):
   `https://…/math/scale/01/methodica-math-scale-01/`. The trailing slash matters
   ([REPORTING-ADDING.md §1](REPORTING-ADDING.md)); keying on the folder prefix instead would
   collapse Kata's `uniqueKey` to `"01"`, which is why the 2026-08-05 unit-id correction was also a
   resume fix.
2. **Registration** — `window.XAPI_REGISTRATION` from `?registration`. Kata ties both tracking and
   state to it. Absent → `null`.
3. **State id** — `RESUME_STATE_ID = 'execution-state'`, the same constant everywhere.

**Off-platform fallback:** when `window.XAPI_DISABLED` is true (no valid `?slxapi`) the library
transparently uses `localStorage` under
`lomda_state::<activityId>::<registration|local>::execution-state`. The whole feature is therefore
exercisable on `http://localhost` with no LRS.

## 3. When state is written

| Trigger | Call | Why |
|---|---|---|
| Screen change | `scheduleResumeSave()` at the end of `goTo()` — **debounced** | The choke point; bounds loss to one screen. |
| Answer committed | `flushResumeSave()` at the end of every `sNNSubmit` / `sNNCheck` / `ddqCheck` — **synchronous** | See the race note below. |
| Leaving the page | `flushResumeSave()` on `beforeunload`, `pagehide`, and a hidden `visibilitychange` | `beforeunload` never fires when a mobile tab is backgrounded and then killed. |
| Cross-part jump | `writeForwardState(destSlug)` | §6. |

All of them bail out unless `RESUME_ENABLED && _resumeReady && !_restoring`, so nothing is written
during a restore and nothing before the first successful read.

> **Why answer commits are synchronous.** `goTo(23)` schedules a debounced save for
> `{part: 01, screen: 23}`; the learner clicks continue 200 ms later; `routeAfterQuiz()` writes the
> forward blob and navigates — but the page stays alive while the next document loads, long enough
> for the stale timer to fire and land *after* the forward write. The next launch would then come
> back into the finished quiz. `_leavingToNextPart` cannot prevent it, because the pending payload
> lives inside the library. Two defences: commits flush synchronously, and `writeForwardState()`
> re-arms the debounce with the destination blob before writing it synchronously.

## 4. How restore works

`applyExecutionState()`, identical in all five parts:

1. `_restoring = true`; stub `window.sendStatement720` with a no-op.
2. Assign the state variables.
3. `goTo(screen)` — **inside** the stubbed region.
4. **Assign the variables a second time.**
5. `restoreScreenUI(currentScreen)` — paint the answered appearance.
6. `finally`: un-stub, `_restoring = false`.
7. `xapiCurrentItem = null;` then one explicit `xapiOnScreen(currentScreen)`.

Three of those steps are load-bearing and non-obvious:

- **The second assignment pass (4).** `goTo()` runs the screen's `sNNEnter()`, and those functions
  are *initialisers*, not restorers. Some reset the very variables just restored (part 01's quiz
  screens, all of part 02, part 04's s37/s38); the others early-return on a solved flag and leave
  the pristine markup on screen (part 04 s39/s40/s41, part 05 s45/s47/s49/s51). Assigning again
  afterwards neutralises the first group without touching `goTo()` or any `sNNEnter()` — the live
  answer path is byte-for-byte unchanged.
- **Holding the stub across `goTo` (1→6).** Part 05's `s53Enter()` emits the item, component **and
  unit** `completed` on entry, and the library's one-`completed`-per-page-load rule cannot help
  across a page load. Suppressing statements only during variable assignment would duplicate all
  three on every resume onto the finale.
- **Clearing `xapiCurrentItem` (7).** `xapiOnScreen()` early-returns on `item === xapiCurrentItem`,
  and the latch is still set during the stubbed `goTo` even though the statement was swallowed.
  Without the reset a resumed session would emit **no** item `initialized` at all, and the next
  screen change would close an item that was never opened.

### The painters

`restoreScreenUI(n)` dispatches to per-screen `sNNRestoreUI()` functions. They are **standalone** —
no `sNNSubmit` was refactored. Each mirrors only the DOM writes of its submit branches: never a
state mutation, never a statement, never `announce()`, never `s18QuizResults` or
`finalAssessmentScore`. `sqRestoreUI()` in part 01 ([01:727](methodica-math-scale-01-01/script.js:727))
already worked this way and is the model.

Every painter follows two axes, not four branches:

```
if (solved)            → terminal appearance (correct or final-wrong variant)
else {
  if (attempts >= 1)   → interim "try again" feedback + hint button revealed
  repaint the current selection / typed text     // unconditional — the two co-occur
  recompute the check button from the same predicate the live code uses
}
```

Selection and interim-wrong co-occur constantly, because most screens clear the selection on a first
wrong answer and the learner re-picks. Mirroring the live enablement predicate is what keeps a
resumed learner from being stranded on a screen they can neither answer nor leave.

**Correctness is never inferred from the attempt count** — part 02 increments only in the wrong
branch, parts 01/04/05 increment before branching. Sources per screen:

| Screens | Source of correctness |
|---|---|
| 01 s18–s23, 02 s26–s33, 04 s37/s38 | the existing `sNNCorrect` |
| 01 s16 | `s16Selected === S16_CORRECT` (no `s16Correct` exists) |
| 04 s39/s40/s41, 05 s45/s47/s49/s51 | `XAPI_Q_RESULTS['<item>/<q>']` — no `Correct` variable exists |

### Painter coverage

| Part | Screens repainted | Notes |
|---|---|---|
| 01 | 16, 18, 19, 20, 21, 22, 23 | Screens 3 and 4 are handled by the pre-existing `sqRestoreUI()`. Screen 16's painter **must** rebind `onclick` — `s16Submit` has no solved-guard that forwards, so without it the continue button is a dead end. The quiz nav dots repaint themselves from `s18QuizResults` via `s18UpdateNav`/`s23UpdateNav`. |
| 02 | 1, 2, 3, 4, 5, 7, 8 | Every screen except the two interstitials. Dropdown rows restore their label text from the captured DOM text (see §7); the final-wrong branch overwrites them with the correct labels. Nav bars repaint from `sNNSolved`/`sNNCorrect`. |
| 03 | 2 | The free-text reflection. `applyResumeDom()` puts the value back after `s35Enter()` blanks it, then `s35OnInput()` re-derives the widget and the continue button. |
| 04 | 1, 2, 3, 4, 5 | Screen 3 (drag-and-drop) replays the board through the existing `ddqRender()`, re-adds `s39-correct`, and repaints the per-target ✓/✗ badges from `ddqTargetResults`. It deliberately does **not** call `s39ShowFeedbackGated()`: that gate would make the learner re-scroll an explanation they already passed, and can strand them if `scrollHeight` is mismeasured before webfonts settle. |
| 05 | 2, 4, 6, 8 | Screen 4's reveal is rebuilt from the captured `s47Selected` array. Screen 10 (the finale) needs no painter — it is reached with all statements suppressed. |

## 5. The restore path at load time

Inside the loader IIFE, immediately after `changeConfig` and **before** the component
`initialized`:

```js
var _saved = window.loadState720(RESUME_STATE_ID);
if (_saved && _saved.v !== RESUME_STATE_VERSION) _saved = null;    // stale shape: discard
if (_saved && _saved.part && _saved.part !== currentPartSlug()) {
  window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
  return;                                                          // hop, carrying the query string
}
_resumeReady = true;
if (_saved) { applyExecutionState(_saved); _resumed = true; }
```

- Reading **before** the `initialized` is what keeps a hopping session from leaving a statement
  behind for the part it merely passed through. In part 01 the early `return` also skips
  `loadUnitMetadata`, so no unit `initialized` is emitted either.
- The version check sits **before** the part comparison, so a stale document cannot redirect.
- `location.replace` (not `href`) keeps the abandoned part out of the back-stack.
- On any throw the `catch` still sets `_resumeReady = true`: a failed read does not disable saving,
  so the next session gets a fresh valid document instead of being stuck.

## 6. Cross-part handoff

`writeForwardState(destSlug)` writes `{v: 2, part: destSlug, currentScreen: 0}` — re-arming the
debounce, then saving synchronously, then setting `_leavingToNextPart = true` so the leave handlers
do not overwrite it. Call sites, two of which are conditional:

| Part | Function | Placement |
|---|---|---|
| 01 | `routeAfterQuiz()` | **inside each branch** — the destination differs (`-03` at ≥ 4/5, else `-02`) |
| 02 | `routeAfterAdvancedPractice()` | **inside `if (getAdvancedPracticeScore() >= 2)`** — a learner who never clears 2/2 stays on the screen and must resume back to it |
| 03 | `goToAdvanced()` | unconditional → `-04` |
| 04 | `goToNextModule()` | unconditional → `-05` |

Part 05 is terminal and writes no forward state. Nothing is added to part 01's
`routeAfterBasicPractice()`, which navigates out of range and is dead.

A forward blob discards the departed part's answers. That is intentional and safe: no part reads
another part's variables, each part reports its own `completed` before leaving, and the avatar
travels through `localStorage.lomdaCharacter`, not the blob.

## 7. The blob

`{ v: 2, part, currentScreen, … }`. `RESUME_STATE_VERSION = 2`; any other `v` is discarded on read.

Per-part payload:

| Part | Contents |
|---|---|
| 01 | hand-written: `lomdaState`, `frc`, `s4`, `sq.*`, `s16`, `quiz.{results,s18…s23}`, `inputs` |
| 02 | `qResults`, `s26Vals`/`s27Vals`/`s30Vals`, `s28Selected`, `inputs`, `texts`, `vars` (22 names) |
| 03 | `scaleInput` |
| 04 | `qResults`, `ddqPlacement`, `ddqTargetResults`, `inputs`, `vars` (16 names) |
| 05 | `qResults`, `s47Selected` (a `Set`, via `Array.from`), `inputs`, `vars` (10 names) |

Parts 02–05 are list-driven: `RESUME_PLAIN_VARS` names the file-scope bindings copied verbatim, read
and written through `eval` because `let`/`var` at file scope are not reachable as `window`
properties. Assignment is whitelisted against that same list, so a tampered document cannot assign
an arbitrary name. (These files are `'use strict'`; assignment through a direct `eval` to an existing
outer binding still works — only declarations would be eval-scoped.)

Two things travel as DOM values rather than variables, because no variable holds them:

- **`inputs`** — the typed text of every value-input screen, read by element id at capture time. Safe
  because no submit branch clears those inputs, it only disables them.
- **`texts`** (part 02 only) — the *label* shown in each dropdown row. `sNNVals` holds the machine
  value; the label exists only in the DOM. `'-'` is a legitimate captured value: it is what an unset
  row, and a row cleared by a first wrong answer, shows.

`ddqTargetResults` (part 04) is the one genuinely new state variable. `ddqCheck` computes the
per-target ✓/✗ locally and then `ddqRevealCorrect()` overwrites `ddqPlacement` with the correct map,
so the badges cannot be recomputed after the fact.

## 8. Statement guarantees

- A resumed screen emits **exactly one** item `initialized` and nothing else.
- No `answered` is ever re-sent; the stub covers both the variable replay and everything `goTo` and
  the painters touch.
- Resuming onto part 05 screen 10 sends **no** `completed` — item, component or unit.
- A hopping session emits no `initialized` for the part it passes through.

## 9. Deliberately not restored

Fidelity was scoped to **question screens** as a first step. Everything below lands at its screen
start and the learner repeats that one interaction:

- Part 01 screens 7–14 (the guided worked example): screens 8/9/10 keep **no JS state at all**, so
  restoring their "answered" look would need new variables. Screen 1's scroll gate and screen 7's
  3-second timer likewise re-arm.
- Part 01 screen 2 (video vs. flip-cards choice) — `resetScreenState` nulls `selectedDesign` and the
  second pass restores the variable, but the learner re-picks to proceed.
- Ruler positions (01 s18, 04 s41), video playback position, hint-popup open state, scroll offsets.
- Per-selection saves. `sNNSelect` / `sNNPick` / `ddqDrop` do **not** save: every write is a
  synchronous network round trip, and the screen-change plus commit hooks already bound the loss.
  A selection made and abandoned mid-screen is still captured by the leave handlers.
- A learner who finished the unit keeps landing on the congratulations screen. Safe (nothing is
  re-reported); a `done` marker in the blob would let a future build branch instead.

## 10. Verification performed

The Browser-pane preview was unavailable in the session that built this, so verification ran
**headless in jsdom** against the real `index.html` + `script.js`, stubbing only the CDN library:
`saveState720`/`loadState720` over an in-memory store shared across simulated reloads,
`sendStatement720` into a statement log. The harness lives in the session scratchpad
(`harness.js`, `verify.js`, `sweep.js`) and is **not checked in**.

- **108 assertions, 0 failures** across: value/choice/multi-select/dropdown/drag-and-drop restore in
  every part; the interim-wrong-plus-fresh-selection state; the part 01 screen 16 dead-end (the
  restored button is clicked and must advance to 17); the part 04 badge replay and gate bypass; the
  finale duplicate-`completed` check; the forward-write clobber race (blob re-read after the 800 ms
  debounce window); the part 02 below-2/2 path; the cross-part hop; and stale-`v` discard.
- **Full sweep: 51 screens** — every screen with markup in all five parts, landed on, saved,
  reloaded, and checked for the right screen, no error logged, and no answer re-reported. 0 problems.
  (Part 01 screens 5 and 13 have no markup — pre-existing dead code, and unreachable, so no blob can
  point at them.)
- `node --check` passes on all five `script.js`.
- Confirmed against the deployed `xapi-720-j.js`: `sendStatement720` is a top-level `function`
  declaration, so the no-op stub genuinely overrides it, and `saveState720Debounced` keys timers per
  `stateId` and closes over the new payload on re-arm. **Re-check both on any library bump** — if
  `sendStatement720` ever becomes `const`/`let`, the stub fails silently and resume re-reports
  everything.

### Still to do before release

- **A real Kata run** with `?slxapi` + `?registration`: one State document per unit, the cross-part
  hop, and no duplicate `answered`/`completed`/item `initialized` in the LRS. `sendState`/`getState`
  against the live platform have never been exercised from this unit.
- A browser pass for **visual** confirmation of the painted states (the headless suite asserts
  classes, text and disabled flags, not appearance) and of the part 04 scroll gate, which jsdom
  cannot model — it reports every element as zero-height.
- Behavior with `?registration` absent (state keyed on `null`) is untested; in the `localStorage`
  fallback two learners sharing a browser profile would share one key.

## 11. Defects fixed in this change

All seven were present in the gated-off code:

1. **Part 01 never saved.** `captureExecutionState()` called `.slice()` on `s18QuizResults`, an
   object literal — a `TypeError` on every capture, swallowed by both callers.
2. **No save trigger.** `scheduleResumeSave()` had zero call sites repo-wide; the only writer was the
   `beforeunload` flush.
3. **`_leavingToNextPart` was dead** — never set `true`, so a forward jump saved the *departing*
   part and the next launch came back into it.
4. **Resuming onto part 05's finale re-sent** the item, component and unit `completed`.
5. **Restore repainted almost nothing** — the enter functions either wiped the restored variables or
   returned early and left pristine markup. Part 01 screen 16 was a hard dead end.
6. **Part 03 wiped its own restored answer**: `s35Enter()` blanks `#s35-input` after
   `applyExecutionState` had set it. (The earlier claim that part 03 lost drag-and-drop placements
   was wrong — part 03 has no drag-and-drop at all; that `DDQ` block is dead copied code, and the
   two `ddq*` names its `RESUME_PLAIN_VARS` captured were constants.)
7. **No item `initialized` on resume** — `xapiOnScreen`'s latch survived the stubbed `goTo`.

Two adjacent bugs were fixed at the same time, both in scope by agreement:

- **Part 02 never reported its component `completed`.** `routeAfterAdvancedPractice()` calls
  `getBasicPracticeScore()`, which did not exist in part 02; the `ReferenceError` was swallowed by
  the surrounding `try`. Added, copied from part 01's identical 4-exercise rule (screens 29+30 count
  as one).
- **Part 05 zeroed `finalAssessmentScore.correct`** on every unguarded entry to screen 2. The
  variable is write-only in that component (`peakResult()` scores from `XAPI_Q_RESULTS`), but the
  reset became a live trap once restored state could put the learner back there.

## 12. Reference

- [REPORTING-ADDING.md](REPORTING-ADDING.md) — §2 scaffolding, §4 query-string propagation, §8
  known content/code gaps.
- [METADATA-FIXES.md](METADATA-FIXES.md) — the unit-id correction the state key depends on.
- [deployments/2026-08-05/DEPLOY.md](../../deployments/2026-08-05/DEPLOY.md) — why no library copy
  ships with a release. `-j` is a **shared** file: deploying it affects every 720 lomda that loads
  it. That release predates this change and still pins `-i`.
- Origin of the pattern: `methodica-science-mass-measure-01` (branch `vadimr-1`), whose
  `720-common-lib/` owns `xapi-720-i.js` / `-j.js`.
