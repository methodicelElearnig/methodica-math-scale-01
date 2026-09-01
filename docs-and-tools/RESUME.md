# Resume — how the mechanism works

Resume ("המשך מהמקום שבו הפסקת") is **enabled** in all five components as of 2026-08-06.
`RESUME_ENABLED = true` in `unit-js/10-identity.js`; that flag is also what switches the loader from
`xapi-720-i.js` to `xapi-720-k.js`, the build that carries the State API transport plus diagnostics.

This document describes the mechanism as built. §9 lists what is deliberately *not* restored, §10
records the verification performed, and §11 is the changelog of the defects fixed on the way here.

> ## v4 (2026-09-01) — parity with `methodica-science-mass-measure-02`
>
> This unit is where the shared `unit-js/` layer was invented; the science unit forked it on
> 2026-08-17 and then hardened it for two weeks. Those fixes are now back-ported. **`§6b` is
> obsolete and `§10`'s "still to do" list is partly closed — read this box first.**
>
> | Change | Effect |
> |---|---|
> | `RESUME_STATE_VERSION` **3 → 4** | The document gains `ui` (the chosen character) and `results` (cross-part gates). There is **no migration** — any other `v` is discarded. Approved because this unit has never had a live Kata run, so the field is clean. `migrateV2` and `RESUME_PART_CHAIN` are deleted. |
> | Character is unit-level state | It lived only in `localStorage`, so a learner continuing the same registration on another machine got the wrong avatar in parts 01 and 05. The document is now the source of truth and `localStorage` is a synchronous cache. Read via `getUnitCharacter()`, written via `setUnitCharacter()`, both `typeof`-guarded at the call sites. |
> | `#boot-cover` | Screen 0 no longer flashes before the restore jumps. Removed by `dropBootCover()` from every loader exit path, with a dependency-free 800 ms markup safety net above it. |
> | Loader gates | A missing `XAPI_METADATA_FILE` exits loudly; the metadata poll is capped at 10 s instead of spinning forever; `XAPI_COMP_ID` is checked against `window.METADATA.id` on every load. |
> | Library **`-j` → `-k`** | Adds `stateLastResult720()` → `{op,status,ok,reason}`. A failed write used to be one bit: 401, 413, 412 and CORS all looked identical. The `XAPI_USING_G` regex widened to `[ghijk]` in the same edit. |
> | Two-phase loader | Reading the document and the cross-part hop moved **before** the metadata poll; `_resumeReady` deliberately stayed after it. |
> | `#screen=N` | `applyExecutionState(st, screenOverride)`. The hash selects the screen and **no longer cancels the restore** — that bug lost `XAPI_Q_RESULTS` on cross-part back and routed a passing learner into remediation. |
> | Back edges | `prev[slug]` is now `{from, hash}`, with a `sessionStorage` layer readable before the document arrives and a hard-coded fallback below that. `goBackToPrevPart()` → **`goBackToPreviousPart(fallbackSlug, fallbackHash)`**; `syncBackButton()` is gone and the button ships visible (see §6a). |
> | Reset hatch | `initResumeResetHatch()` runs first from `90-boot.js` instead of inside `readUnitState()`, so `?resetState` is honoured before anything reads the query or the cache. It clears the nav-edge map and the character cache too. |
> | `currentPartSlug()` | Lowercases. A capitalised URL used to produce a second key for the same part. |
> | Call-site helpers | `xapiAnswered` / `xapiRequestedHint` / `xapiCompleteComponent` / `xapiCompleteUnit` replace 25 duplicated `answered` blocks and 23 raw hint sends. `requested.1` is now deduped per question per page load — reopening a hint used to report every time. |
> | Tests | `_test/verify-report.js` (445 assertions) and `_test/statement-flow.js` (32) — see `_test/README.md`. |

> **Where the code lives (since 2026-08-09).** The mechanism used to be copied into all five
> `script.js`. It now has one copy in [`unit-js/`](unit-js/README.md):
>
> | Piece | File |
> |---|---|
> | the v4 document, the ledger, cross-part back, unit-level state, save/flush | `unit-js/40-resume.js` |
> | `goTo()` and `applyExecutionState()` — the replay | `unit-js/30-nav.js` |
> | the restore *trigger* and the cross-part hop | `unit-js/50-loader.js` |
> | `initResumeLeaveHandlers()` registration | `unit-js/90-boot.js` |
>
> What stays **per component**, because it is genuinely different in each, is the payload contract:
> `RESUME_PLAIN_VARS`, `RESUME_INPUT_IDS`, `RESUME_TEXT_IDS`, `capturePartPayload()`,
> `applyResumeVars(st)`, `applyResumeDom(st)` and `restoreScreenUI(n)`.
>
> ⚠️ **`applyResumeVars`'s parameter must stay named `st`** — it runs `eval(k + ' = st.vars[k];')`,
> which resolves `st` lexically. Renaming it fails *silently*: the assignment throws, the enclosing
> `try/catch` swallows it, and the learner's answers vanish with nothing in the console.

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

Since **v3 (2026-08-09)** the document also keeps **every** part's payload, not just the current
one, which is what lets the first screen of parts 02–05 offer "חזרה" back into the component the
learner actually came from, fully restored (§6a). Retention brings a second requirement with it:
because a finished part is now re-enterable, `completed` must not be re-reported, so the document
carries a ledger of the ones already sent (§8a).

## 2. Storage — the xAPI State API

Transport lives in the shared CDN library, not in this repo:
`https://lomdot.education.gov.il/metodica/720active/common/xapi-720-k.js`. It is `-i` plus a State
API block plus `stateLastResult720()`; nothing else differs. Three functions on `window`:

| Function | Behavior |
|---|---|
| `saveState720(stateId, obj)` | `ADL.XAPIWrapper.sendState(...)`, synchronous. Returns `true`/`false`. |
| `loadState720(stateId, cb)` | `getState(...)` synchronously and **also returns** the object. The lomda uses the return value. `null` when absent or on error. |
| `saveState720Debounced(stateId, obj, ms)` | `setTimeout` coalescing, default **800 ms**, keyed per `stateId`; re-arming replaces the pending payload. |

**What actually addresses the document, against Kata:** only the **registration**.
`GET`/`PUT`/`DELETE /api/v1/xapi/activities/state` accepts `registration`, or `studentId` +
`componentKey` as an alternative — supplying both is a `400`. There is no `activityId`, no
`stateId` and no `unitKey` parameter ([KATA-API.md](../../Documentation/KATA/KATA-API.md)). So:

1. **Registration** — `window.XAPI_REGISTRATION` from `?registration`. The platform launches the
   unit once; every cross-part navigation copies `window.location.search` verbatim, so all five
   parts present the *same* registration and therefore read and write **one** document. This, not
   the activity id, is what makes resume unit-scoped. Absent → `null`.
2. **Activity id** — `window.XAPI_UNIT_ID`, set identically in all five parts at
   [script.js:9](methodica-math-scale-01-01/script.js:9):
   `https://…/math/scale/01/methodica-math-scale-01/`. Kata never sees it; it only keys the
   `localStorage` fallback below. The trailing slash still matters for *reporting*
   ([REPORT-XAPI.md §1](REPORT-XAPI.md)).
3. **State id** — `RESUME_STATE_ID = 'execution-state'`. Also fallback-only, for the same reason.

> **Depends on a single launch of component 01.** Kata's registration is documented as stable per
> platform, learner **and component**. The unit-wide document works because the platform launches
> once and the lomda navigates internally. If the platform ever deep-launched part 03 directly, that
> registration would address a *different* document and the learner's progress would split in two.
> Worth confirming with the platform partner. Two related behaviours are undocumented and should be
> checked against the live API before being relied on: whether Kata validates a registration against
> the calling component (the docs define only a group-scoped `404`), and whether ingested statements
> are attributed by registration regardless of the activity id in the statement.

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
| Cross-part jump forward | `writeForwardState(destSlug)` | §6. |
| Cross-part jump back | `goBackToPreviousPart()` | §6a. Refuses to navigate if the write fails. |
| `completed` reported | `markSent()` inside `sendCompletedOnce` — **synchronous** | §8a. Two call sites never navigate afterwards, so nothing else would persist the mark. |

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
  afterwards neutralises the first group without touching any `sNNEnter()`.

> **Revised 2026-08-08 — this sequence now runs on every navigation, not just at restore.**
> Steps 2/4/5 (capture → re-apply → paint) were originally performed **once**, for the landing
> screen only, and `goTo()` was left untouched. That left two defects. *(a)* Because every
> `sNNEnter()` zeroes its screen's answer variables, navigating **back** to an answered question
> wiped it — even mid-session with no reload at all. *(b)* Because `restoreScreenUI()` was called
> only for the landing screen, after a reload every *other* screen still held pristine markup, so
> returning to an answered question showed it unanswered even though the variables were correct.
> Guarding the enters (the part 04/05 and science-unit idiom) fixes *(a)* only — after a reload
> there is no answered DOM to preserve, so the painter must rebuild it.
> `goTo()` therefore now snapshots via `captureExecutionState()` before `resetScreenState(n)`, and
> re-applies + `restoreScreenUI(n)` after, guarded by `_restoring` and wrapped in try/catch so
> navigation can never break. A never-answered screen snapshots falsy values, so the re-apply is a
> no-op and every painter early-returns — pristine screens are unaffected. The `sNNEnter()`
> functions are still byte-for-byte unchanged; only `goTo()` gained the sequence.
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

**Two phases since v4**, split deliberately.

**Phase A — read-only**, immediately after `getXAPIParameters` and **before** the metadata poll:

```js
var _saved = readUnitState();                    // never returns null
if (_saved.part && _saved.part !== currentPartSlug()) {
  window.__resumeInFlight = true;                // hold the cover across the hop
  window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
  return;                                        // hop, carrying the query string
}
if (applyUnitProfile(_saved)) resetScreenState(currentScreen);   // the character, repainted
var _payload = _saved.parts[currentPartSlug()];  // this part's slot, not the whole document
if (!_payload) dropBootCover();                  // a first-time learner waits for nothing
```

**Phase B**, after `changeConfig` and **before** the component `initialized`:

```js
_resumeReady = true;
if (!_unitState) _unitState = emptyUnitState();
drainPendingUnitState();                         // this session's choice beats the document
var _hm = /^#screen=(\d+)$/.exec(window.location.hash);
if (_payload) { applyExecutionState(_payload, _hm ? parseInt(_hm[1], 10) : undefined); _resumed = true; }
dropBootCover();
```

- **Why phase A runs before the poll.** The cover hides screen 0 until it is known what to draw, so
  its lifetime *is* the learner's wait — and the poll is capped at 10 s. Making a learner stare at a
  cover for 10 s would be a worse regression than the flash the cover exists to fix. It is safe to
  run early because `getXAPIParameters` sets `window.slxapi`, `XAPI_REGISTRATION` and
  `XAPI_DISABLED` **synchronously** before it touches metadata, and `loadState720` works over a raw
  XHR rather than through `ADL.XAPIWrapper`.
- **Why `_resumeReady` did NOT move with it.** It is the gate on every write path. Setting it in
  phase A would open a window in which any `goTo()` arms a save that overwrites `doc.parts[slug]`
  with a fresh payload — a write *before* the restore, which is precisely what every write path is
  built to prevent. Phase A therefore only reads; `applyUnitProfile` touches memory and the cache,
  never the document.
- Reading **before** the `initialized` is what keeps a hopping session from leaving a statement
  behind for the part it merely passed through. In part 01 the early `return` also skips
  `loadUnitMetadata`, so no unit `initialized` is emitted either.
- `readUnitState()` always yields a usable document: it discards any `v` that is not the current one
  (§6b — there is no migration since v4) and otherwise returns a fresh skeleton. `_unitState` is
  **never** left `null` — the ledger and `captureUnitState` both dereference it from inside
  swallowing `try/catch` blocks, where a throw would drop a real statement in silence.
- `_resumed` is set from whether a **payload** was applied, not from whether a document existed. A
  v4 document always exists; if it holds nothing for this part, `applyExecutionState` is a no-op and
  the landing screen still owes its item `initialized`.
- **The hash is an override, not a veto.** `'#screen=N'` picks the screen; it must not skip
  `applyExecutionState`. An earlier version did, and cross-part "back" lost the whole restore —
  including `XAPI_Q_RESULTS`, from which the forward routing is derived, so a learner who had met
  the 4/5 threshold was sent into remediation.
- `location.replace` (not `href`) keeps the abandoned part out of the back-stack.
- On any throw the `catch` still sets `_resumeReady = true` and installs a skeleton document: a
  failed read does not disable saving, and it does not silence reporting either.
- `?resetState` (any part) starts from a clean document, then **strips itself from the URL** via
  `history.replaceState`. It has to: every cross-part navigation copies `window.location.search`
  verbatim, so left in place it would re-fire on arrival in the next component and wipe the document
  on every hop — resume would never work at all. See §10 for why QA needs it.

## 6. Cross-part handoff

`writeForwardState(destSlug)` moves the landing pointer to `destSlug`, records the back-edge
`prev[destSlug] = <this part>`, and seeds `parts[destSlug] = {currentScreen: 0}` **only if the
destination has never been visited** — a learner going forward into a part they have already been
in resumes where they left off rather than replaying from screen 0. It then persists through
`persistUnitState()`, which re-arms the debounce **before** the synchronous write, and calls
`armLeaving()`.

Call sites, two of which are conditional:

| Part | Function | Placement |
|---|---|---|
| 01 | `routeAfterQuiz()` | **inside each branch** — the destination differs (`-03` at ≥ 4/5, else `-02`) |
| 02 | `routeAfterAdvancedPractice()` | **inside `if (getAdvancedPracticeScore() >= 2)`** — a learner who never clears 2/2 stays on the screen and must resume back to it |
| 03 | `goToAdvanced()` | unconditional → `-04` |
| 04 | `goToNextModule()` | unconditional → `-05` |

Part 05 is terminal and writes no forward state. Nothing is added to part 01's
`routeAfterBasicPractice()`, which navigates out of range and is dead.

> **Changed in v3.** A forward blob used to *discard* the departed part's answers, documented here
> as intentional. It no longer does: `writeForwardState` calls `captureUnitState()` first, so the
> part being left is written into its own slot. The back button restores the part the learner came
> from, and it cannot restore what was thrown away. The avatar still travels through
> `localStorage.lomdaCharacter` rather than the document.

## 6a. Cross-part back ("חזרה" on the first screen)

The first screen of parts **02, 03, 04 and 05** carries `#back-to-prev-part`, which calls
`goBackToPreviousPart()`. Before v3 the same button existed in 02/03/04 as `goTo(23)` / `goTo(35)` —
leftovers from the pre-split global screen numbering that `goTo`'s range guard swallowed silently,
so it had never worked. Part 05's first screen had no such button at all; its bar also gained
`s3-bottom-bar` to lay two buttons out.

`prev` is a **map of back-edges, not a stack**: forward navigation writes `prev[dest]`, back
navigation only reads it. Nothing to push, pop, or keep in sync, and a partial write cannot corrupt
an ordering. It also settles part 03, which is reachable from **both** 01 (at ≥ 4/5) and 02 (at
≥ 2/2): whichever router actually navigated is the one that wrote the edge, so the same button
resolves to whichever part the learner really came from.

`goBackToPreviousPart()` points the document at the destination **before** navigating. That is what
stops the destination's loader seeing a mismatch and hopping straight back — the ping-pong that
would otherwise re-send `completed` on every cycle. If the synchronous write does not land it
retries once, and if that fails too it **stays put**, rolls the in-memory pointer back and logs
`[resume] back: state write failed, staying put`. Navigating on a failed write is the one thing
that reintroduces the ping-pong.

> **Changed in v4.** The button now ships **visible**, and `syncBackButton()` is gone. It became
> unnecessary once the back target was resolved in three layers — the document, a `sessionStorage`
> edge map readable synchronously from the moment the script loads, and a hard-coded fallback passed
> in the `onclick`. Parts 02–05 are only reachable through the forward chain, so a sane target always
> exists; hiding the button until `_unitState` arrived (two CDN scripts and a metadata poll later)
> meant a learner clicking in that first second got nothing at all, which is the very bug the edges
> were added to fix.

## 6b. Version migration — REMOVED in v4 (2026-09-01)

> **This section is historical.** `RESUME_STATE_VERSION` is now **4**, `migrateV2()` and
> `RESUME_PART_CHAIN` are deleted, and `readUnitState()` discards any document whose `v` is not the
> current one. That was approved because this unit has never had a live Kata run, so there are no
> documents in the field to lose. The deploy-atomically warning at the end of this section still
> applies in full, and matters more than before: a stale cached `40-resume.js` reading a v4 document
> **deletes** it. Bump every `?v=` in the same commit as a version bump.
>
> The original v2 → v3 text follows, for anyone reading a document written before 2026-09-01.

`RESUME_STATE_VERSION` was **3**. A v2 document was migrated, not discarded — discarding it would
restart the learner at part 01 with an empty ledger, so every `completed` they had already earned
would be reported a second time, which is precisely what §8a exists to prevent.

`migrateV2()` wraps the old single-part payload as `parts[old.part]`, keeps the landing pointer, and
seeds `done` for every part **earlier in `RESUME_PART_CHAIN`** than `old.part` — a learner sitting
in part N demonstrably finished the ones before it. `prev` is deliberately left empty: a v2 document
does not record which way the learner entered part 03, and guessing would send them back to a part
they never opened. The back button simply stays hidden until they traverse a real forward edge.
Item-level marks cannot be recovered, so a migrating learner may re-send one round of item
`completed`.

> **Deploy all five folders atomically.** They are separate deployables. A part still on v2 beside
> parts on v3 discards the v3 document and writes a v2 one, which the others then migrate and
> overwrite — a reset loop that wipes `done` each cycle. The same applies to a rollback.

## 7. The document

```js
{
  v: 3,
  part: '<slug the learner should land on>',
  parts: { '<slug>': { currentScreen, …that part's payload }, … },   // every part, retained
  prev:  { '<slug>': '<slug it was entered FROM>' },                 // back-edges (§6a)
  done:  { '<slug>': true, unit: true },                             // component/unit 'completed' sent
  doneItems: { '<slug>#<itemId>': true }                             // item 'completed' sent
}
```

`capturePartPayload()` returns this part's payload alone; `captureUnitState()` **replaces** (never
merges into) `parts[currentPartSlug()]` — a merge would leave stale keys alive, most visibly part
02's `texts` map, where a stale label for a row the learner has since cleared to `'-'` would survive
and be repainted.

`captureUnitState()` deliberately does **not** touch `part`. Only `writeForwardState` and
`goBackToPreviousPart` move the landing pointer. A save that reset it to the current slug would undo the
one those two just wrote, and the debounced timer left behind by the last `goTo()` would fire
mid-navigation and bounce the learner back to the part they were leaving.

Size is not a concern: all five payloads together run ~10–20 KB against Kata's ~1 MB cap.

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

## 8a. The `completed` ledger

Back navigation makes every finished screen re-reachable, and the library's own dedupe lasts only
one page load. So `completed` goes through `sendCompletedOnce(ledger, key, …)`, backed by `done`
(components, plus `unit`) and `doneItems` (`'<slug>#<itemId>'`). Wrapped call sites: the item close
in `xapiOnScreen()` and `xapiFinishItems()` in all five parts, and the component `completed` in
`routeAfterQuiz` (01), `routeAfterAdvancedPractice` (02), `goToAdvanced` (03), `goToNextModule` (04)
and `s53Enter` (05 — component **and** unit).

**`initialized` is deliberately not guarded.** The platform asks for it on every entry. The
consequence is an unmatched item `initialized` in the LRS whenever a learner re-enters a finished
part: `applyExecutionState` ends with `xapiCurrentItem = null; xapiOnScreen(currentScreen)`, and the
matching `completed` is ledger-blocked. Likewise a learner who backs all the way to part 01 emits
the unit-scope `initialized` *after* the unit `completed` was already sent. Both follow directly
from "keep `initialized`, suppress `completed`" and should be confirmed acceptable to the platform.

Three orderings inside `sendCompletedOnce` are load-bearing:

- **Bail out entirely while `_restoring`** — neither send nor mark. `applyExecutionState` stubs the
  sender, so a mark taken there would permanently suppress a statement that never actually left.
  Part 05's `s53Enter()` runs inside that stub when a learner resumes onto the finale, which is
  exactly how the unit `completed` would go missing.
- **Fail open, never closed.** The ledger is obeyed only when it positively says "already sent". If
  the document is unavailable the statement goes out anyway: every call site sits inside a
  swallowing `try/catch`, where a silent drop is far worse than a duplicate.
- **Persist the mark synchronously, in `markSent`.** Two callers send without navigating afterwards
  — part 02's below-2/2 branch and part 05's finale — so nothing else would ever write it.

In `xapiFinishItems()` the latch is cleared whether or not the statement was suppressed; a latch
left set would make the next `xapiOnScreen` try to close the same item again.

## 9. Deliberately not restored

Fidelity was scoped to **question screens** as a first step. Everything below lands at its screen
start and the learner repeats that one interaction:

> **Note (2026-08-08).** Answered **question** screens are no longer in this list on *revisit*
> either — since §4's revision they keep their final state (marked, feedback shown, locked)
> whenever the learner returns to them, whether by back-navigation mid-session or after a reload.
> A question answered wrong once but not yet solved keeps its interim "try again" state and stays
> answerable. Everything below still lands at its screen start.

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
  re-reported — since v3 the ledger guarantees it rather than the restore stub happening to cover
  it); the `done` map would now let a future build branch instead.

Also not restored, by design: a learner going **forward** into a part they have already visited
resumes at their furthest screen there rather than replaying it from screen 0 (§6). Backing out of
part 05 and continuing again therefore returns to the finale, not to part 05 screen 0.

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
- Confirmed against the deployed `xapi-720-k.js`: `sendStatement720` is a top-level `function`
  declaration, so the no-op stub genuinely overrides it, and `saveState720Debounced` keys timers per
  `stateId` and closes over the new payload on re-arm. **Re-check both on any library bump** — if
  `sendStatement720` ever becomes `const`/`let`, the stub fails silently and resume re-reports
  everything.
  *(Re-confirmed 2026-08-09 against the live CDN copy: still `function sendStatement720(...)` at
  line 389. Library source of truth now lives at `2026/720-common-lib/`.)*
- **`saveState720Debounced` closes over `obj` by reference**, serializing at fire time rather than
  at arm time. Because `persistUnitState` always hands it the same `_unitState` object, a timer that
  survives into a handoff writes the already-corrected pointer. Re-arming is still done first —
  belt and braces, and the only behaviour that holds if the library ever switches to snapshotting.

### v3 verification (2026-08-09) — browser pane, live

A stub library is now checked in at [`_test/xapi-720-k.js`](../_test/xapi-720-k.js). It is **not
shipped**: the parts only honour `?xapiLib=` on `localhost`, and the filename must keep the
`xapi-720-k.js` ending because `window.XAPI_USING_G` is set from a regex on it — rename it and
item-level statements go silent with no error. State and the statement log live in `sessionStorage`
so both survive cross-part navigation, and `saveState720Debounced` really defers 800 ms so the
stale-timer race is reproducible. Console helpers: `__stmts()`, `__state()`, `__dupes()`,
`__reset()`, `__failWrites(bool)`.

Served over `http://localhost:8777` and walked end to end. All green:

- **Every back edge**: 02→01 s23, 03→02 s8, 04→03 s2, 05→04 s5 — each landing on the previous part's
  **last** screen with options disabled, the learner's wrong pick and the correct answer both shown,
  and continue re-enabled. Part 03's free text came back verbatim.
- **Path-dependent back target**: after 01→02→03 the back button in part 03 resolved to **02**;
  after a 5/5 run routing 01→03 directly it resolved to **01**. Same button, same markup.
- **No duplicate `completed`**: a full traversal with three back-navigations plus a reload directly
  onto the finale produced exactly one `completed` per component, per item, and one for the unit —
  while `initialized` fired on every entry, as required.
- **No bounce-back**: the landing pointer still named the destination after the 800 ms debounce
  window had elapsed.
- **v2 → v3 migration**: a seeded v2 document for part 04 hopped correctly, restored the saved
  screen, seeded `done` for parts 01–03, and left the back button hidden (no `prev` edges).
- **Failed write**: with writes forced to fail, the back button stayed put and logged
  `[resume] back: state write failed, staying put`, with the in-memory pointer rolled back.
- Layout of part 05's new two-button bar checked (RTL: back right, continue left, no overlap).
- No `[resume]` errors in the console. `node --check` passes on all five `script.js`.

### Still to do before release

- **A real Kata run** with `?slxapi` + `?registration`: one State document per unit, the cross-part
  hop, and no duplicate `answered`/`completed`/item `initialized` in the LRS. `sendState`/`getState`
  against the live platform have **still** never been exercised from this unit — and v3 raises the
  stakes, because a silently-failed write now costs a duplicate `completed`, not just convenience.
  (**Resolved 2026-08-09:** `saveState720`'s return contract was checked against the library source
  in `2026/720-common-lib/xapi-720-j.js` — confirmed byte-identical to the deployed
  `https://lomdot.education.gov.il/metodica/720active/common/xapi-720-j.js` (md5
  `e9e154ddad446f4b9baabb07b19e6131`). It returns an explicit
  `true`/`false` on every path — `true` on 2xx and on the `XAPI_DISABLED` localStorage branch,
  `false` on a non-2xx, on a throw, and when `XAPI_REGISTRATION` is missing. It never returns
  `undefined`, so `goBackToPrevPart`'s refusal to navigate on a falsy return cannot misfire. The
  library reaches Kata with a direct synchronous `XMLHttpRequest` rather than
  `ADL.XAPIWrapper.sendState`, precisely because Kata addresses state by `registration` alone and
  because `sendState` in `xapiwrapper.min.js` never returns its XHR result at all.)
- The **jsdom harness** (108 assertions) is still not checked in; only the browser walkthrough above
  covers the v3 paths. A lost synchronous write and the stale-debounce race are far easier to assert
  headlessly than by hand.
- **QA note.** Off-platform there is no `?registration`, so the `localStorage` fallback keys every
  local run to the same document. After one pass `done` is fully populated and **no `completed` is
  emitted again** — which reads as a catastrophic regression to whoever tests next. Start local runs
  with `?resetState` (§5), or clear the key.
- **Multi-tab.** Every save writes the whole document from a possibly-stale `_unitState`. Under v2 a
  stale write cost one part's payload; under v3 it can resurrect an un-`done` ledger entry (→ a
  duplicate `completed`) or wipe four parts' answers. `If-Match`/ETag is available in Kata and unused
  here. Single-tab is currently an assumption, not an enforcement.
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

- [REPORT-XAPI.md](REPORT-XAPI.md) — §2 scaffolding, §6 query-string propagation, §9 known
  content/code gaps. §7 points back here for the `completed` ledger.
- [REPORT-ISSUE.md](REPORT-ISSUE.md) — the learner problem-report feature, independent of resume.
- [METADATA-FIXES.md](METADATA-FIXES.md) — the unit-id correction the state key depends on.
- [deployments/2026-08-05/DEPLOY.md](../../deployments/2026-08-05/DEPLOY.md) — why no library copy
  ships with a release. `-j` is a **shared** file: deploying it affects every 720 lomda that loads
  it. That release predates this change and still pins `-i`.
- Origin of the pattern: `methodica-science-mass-measure-01` (branch `vadimr-1`), whose
  `720-common-lib/` owns `xapi-720-i.js` / `-j.js`.
