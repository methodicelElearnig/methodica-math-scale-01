# Reporting — What Was Added

This document records the **xAPI (720) reporting** and **problem-reporting** code added to
`methodica-math-scale-01`, following the pattern established in
`methodica-science-mass-measure-01` (branch `vadimr-1`) and the 720 technical guidelines v2.4.

- **Unit** = the whole לומדה (all 5 components).
- **Component / Part** = each `methodica-math-scale-01-0{1..5}` folder.
- Each part is self-contained: `index.html`, `script.js`, `styles.css`, `assets/`.
- The xAPI library is loaded at runtime from the gov.il CDN — no library file ships in this repo.
- Every `sendStatement720(...)` call is wrapped in `try/catch`, so a reporting failure can never
  interrupt the learner.

---

## 1. Canonical ids — note the trailing slashes

`metadata/` was authored on 2026-07-29 and is the single source of truth. Its ids are full
canonical URLs under:

```
https://lomdot.education.gov.il/metodica/720active/math/scale/01/
```

| Level | Shape | Trailing slash |
|---|---|---|
| unit | `<prefix>methodica-math-scale-01/` | **yes** |
| component | `<prefix>methodica-math-scale-01-0N/` | **yes** |
| item | `<component>methodica-math-scale-01-0N-NNN/` | **yes** |
| question | `<item>qN` | no |

The unit and the components are **siblings** sharing `<prefix>`; components are not nested under
the unit id. That matches the science unit's shape.

> The unit id originally stopped at `<prefix>` (the folder), which made Kata's `uniqueKey` resolve
> to the bare string `"01"`. Corrected on 2026-08-05 — see §7. `window.XAPI_UNIT_ID` was updated to
> match, and `send-metadata.ps1` now refuses to run if the unit key ever degrades that way again.

This differs from the science unit, whose ids carry no trailing slash. `xapiItemId()` therefore
**emits** the trailing slash, and `xapiQ()` normalises it away (`_xapiTrim`) before matching the
`-NNN` item suffix. Verified in-browser: every `parentId` the code produces is byte-identical to a
real `subContent[].id`, and every `questionId` is the absolute URL taken straight from metadata.

## 2. Per-part scaffolding

Added to the top of every `script.js`:

- `XAPI_ID_PREFIX`, `window.XAPI_UNIT_ID`, `shortId()`, `RESUME_ENABLED = false`.

Added before the report modal in every `script.js`:

- `SCREEN_TO_SUBCONTENT` — screen → `[item suffix, page-in-item]`, `null` for screens with no
  catalog item. Read by `xapiOnScreen()` (element 0) and `submitReport()` (both).
- `XAPI_COMP_SLUG` / `XAPI_COMP_ID` / `xapiItemId()` / `_xapiTrim()`
- `xapiAnswerText()` — clones the option before reading `textContent` so tooltip nodes are not
  spliced into the answer string, and the live DOM is untouched.
- `xapiQ(suffix, qKey)` — resolves the question id from metadata, never from a hardcoded string.
- `XAPI_EVAL_ITEMS` — items that carry a graded question **in code**.
- `xapiOnScreen()` / `xapiFinishItems()` / `xapiWireVideos()`
- `XAPI_Q_RESULTS` + `xapiCorrectCount()` (parts 02, 04, 05) — per-question outcome, written
  *outside* each answered `try/catch` so a reporting failure cannot corrupt the score.

`goTo()` gained one line — `try { xapiOnScreen(n); } catch (e) {}` — immediately after
`currentScreen = n`, which is what drives item-level `initialized`/`completed` pairs.

The loader IIFE at the end of each file loads `xapiwrapper.min.js` then `xapi-720-i.js` from
`https://lomdot.education.gov.il/metodica/720active/common/`, reads `?slxapi`, waits for metadata,
configures the LRS, and emits the component `initialized`.

> **`window.XAPI_USING_G`** is set from `/xapi-720-[ghij]\.js/`. If the CDN library ever moves to a
> new letter, widen that regex in all five loaders — otherwise every item-level and video statement
> goes silent with no error.

## 3. What each component reports

| Part | Items | Questions | `answered` sites | `requested` | Component `completed` fires in |
|---|---|---|---|---|---|
| 01 | 9 | 11 | 9 | 7 | `routeAfterQuiz()` |
| 02 | 7 | 7 | 7 | 7 | `routeAfterAdvancedPractice()` |
| 03 | 1 | 0 | 0 | 0 | `goToAdvanced()` |
| 04 | 4 | 5 | 5 | 5 | `goToNextModule()` |
| 05 | 1 | 4 | 4 | 4 | `s53Enter()` (+ the unit `completed`) |

Screens **5** and **13** do not exist in part 01, so `s5*` and `s13*` are dead code. Part 01's
`routeAfterBasicPractice()` calls `goTo(24)`/`goTo(31)`, both out of range for its 24 screens —
also dead. Neither is instrumented.

### Scoring — why the denominators differ

`completed` always supplies an explicit result, because the library's own aggregation is an
all-correct AND and would report `success:false` for any partial pass.

- **Part 01** — `getQuizScore() / 5`. The denominator is the five quiz *exercises* the learner was
  promised ("4 מתוך 5"), not the 11 metadata questions: screens 19 and 20 are parts א and ב of one
  exercise. Verified: 4 of 5 correct reports `scaled: 0.8, success: true`.
- **Part 02** — correct answers / 7. `success` requires **both** gates the content states:
  `getBasicPracticeScore() >= 3` and `getAdvancedPracticeScore() >= 2`.
- **Part 03** — `{ success: true }` with **no score**. The catalog gives this component no
  questions (`isAssessment: false`); it is the off-computer class task, so there is nothing to
  grade, only to finish.
- **Part 04** — correct answers / 5.
- **Part 05** — the שאלת-שיא rule from the item's own `informationToBot`: **≥ 3 of 4 passes**.
  `peakResult()` supplies it via `XAPI_ITEM_RESULT`, so both the item and the component report it.
  Verified: 3 of 4 correct reports `scaled: 0.75, success: true`.

### Part 02's failure path

`routeAfterAdvancedPractice()` navigates only at 2/2. The `completed` is emitted on **both**
paths — a learner who never clears the gate stays on the screen, and without this their whole
attempt would go unreported. The library allows one `completed` per object per page load, so the
repeat on a later retry is dropped rather than duplicated.

### Part 05's screen map

The narrative interstitials (screens 1, 3, 5, 7, 9) map to the **same** item as the four
sub-questions. That is deliberate: it keeps item `001` open across the whole component, so the
single allowed item `completed` carries the full 4-part result instead of latching a partial score
the first time the learner steps onto a narrative screen.

### Other statements

- `selected` — part 01 screen 2, when the learner chooses video vs. flip cards, under
  `{ category: 'learning-type' }`. The screen-0 avatar choice stays unreported: decoration, not a
  learning preference.
- `played` / `paused` — part 01's YouTube player via `s4OnPlayerStateChange`; part 05's single
  HTML5 `<video>` via the generic `xapiWireVideos()`. Parts 02/03/04 have no media.
- `requested.1` — on hint **open** only. Most hint functions here are toggles
  (`popup.hidden = !popup.hidden`), so the statement sits inside the "just opened" branch;
  otherwise closing a hint would report a second request.

## 4. Query-string propagation

`?slxapi` (and `registration`) enter through the **new root `index.html`**, which redirects to part
01 carrying `window.location.search`. Every cross-part jump now appends `window.location.search`:

`routeAfterQuiz()` (both branches) · `routeAfterAdvancedPractice()` · `goToAdvanced()` ·
`goToNextModule()`

Without this the LRS configuration is lost after part 01 and nothing downstream reports.

## 5. Problem reporting

The modal UI already existed in all five parts — flag button, form, custom select, validation, and
a discard-confirm dialog. Only the transport was missing (`submitReport()` was a `console.log`).

Added:

- `REPORT_FORM_ACTION` — the Google Form **belonging to this project**
  (`1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw`). It appears in the previous
  math-scale repo; the science unit borrowed it. Reports from this unit now land where they belong.
- `REPORT_TYPE_LABELS` — hoisted out of the custom-select IIFE to module scope, because the form
  records the human-readable label and `submitReport()` needs to read it. The target uses a hidden
  input plus a custom select, not a native `<select>`, so the reference's
  `options[selectedIndex].text` does not apply here.
- A **report-sent state** (`#report-thanks-modal` + `showReportThanks()` / `closeReportThanks()`).
  The pre-existing `#report-confirm-modal` is a *discard* prompt, not a thank-you. The new markup
  reuses the existing `.report-*` classes, so **no CSS changes were needed**.

Fields posted (`fetch`, `mode: 'no-cors'` — Google Forms returns an opaque response; a failure is
logged and the modal still closes):

| Field | Value |
|---|---|
| `entry.301404029_{year,month,day}` | date |
| `entry.2066097581_{hour,minute}` | time |
| `entry.1933069481` | unit slug (`shortId(META.learningUnitId)`) |
| `entry.2070680092` | component slug |
| `entry.1555704258` | item id, from `SCREEN_TO_SUBCONTENT` |
| `entry.1671046914` | page-in-item (raw screen number when unmapped) |
| `entry.1179822443` | problem type label |
| `entry.806447525` | free text |

Item and page come from the same screen map the xAPI item scope uses, so a report and a statement
always name the same place.

> Enriched reporting depends on `window.METADATA`, i.e. on the xAPI metadata layer — but not on
> statement sending. It works fine while `XAPI_DISABLED` is true.

## 6. Resume

Ported and **shipped gated off** (`RESUME_ENABLED = false` in every part), per the reference.
Nothing runs today: `_resumeReady` stays false, which also neutralises the `beforeunload` flush.

Each part carries `RESUME_STATE_ID`, `currentPartSlug()`, `captureExecutionState()`,
`applyExecutionState()`, `scheduleResumeSave()`, `flushResumeSave()` and the `beforeunload` hook.
Capture is list-driven (`RESUME_PLAIN_VARS`) plus explicit handling for anything JSON cannot
round-trip — part 02's `sNNVals` objects, part 04's `ddqPlacement`, part 05's `s47Selected` `Set`.
Restore leans on this codebase's own design: `resetScreenState(n)` calls each `sNNEnter()`, which
rebuilds its screen from those variables, so restoring the variables and calling `goTo()` is enough
for the visuals to follow. `applyExecutionState()` stubs out `sendStatement720` while replaying, so
resuming never re-reports answers.

**Before enabling:** flip `RESUME_ENABLED` (that also loads `xapi-720-j.js`, which carries the
State transport `-i` lacks), then verify restore on every screen of every component. The restore
paths have never been exercised.

## 7. Kata tooling

`send-metadata.ps1` / `retrieve-metadata.ps1` (+ their `.md` docs) were ported and re-pointed at
this unit. Authoring-time only — neither is loaded by the lomda. `kata-api-key.txt` is git-ignored
by the new `.gitignore`.

Run from **native PowerShell**, not Git Bash — Git Bash garbles the Hebrew in the payloads (the
data is fine; only the console rendering breaks).

### Metadata corrections applied 2026-08-05

A `-DryRun` plus a standalone validator found 30 errors; all were fixed in `metadata/` — 35
word-reversed vocabulary values plus the unit id, which had made Kata's `uniqueKey` resolve to the
bare string `"01"`.

➡️ **Full changelog, with per-file counts and the reasoning: [METADATA-FIXES.md](METADATA-FIXES.md).**
That document is the single source of truth for the metadata edits; this section only summarises.

### Script changes beyond the rename

- `$ValidCognitiveLevel` gained the four `mathematics` codes.
- **`$ValidMasteryLevel` + the field is now forwarded.** `masteryLevel` (`basic`/`intermediate`/
  `advanced`) appeared nowhere in the original script, so those values were silently dropped on
  push. Absent stays absent rather than being defaulted.
- **`$ValidTargetSector` / `$ValidTargetAudience`** added, and `New-UnitBody` now validates them.
- `New-UnitBody` throws if the unit `uniqueKey` does not look like a `methodica-*` slug.

`-DryRun` now completes clean: 28 payloads (1 unit + 5 components + 22 items), exit 0.

> ### ⚠️ Still unverified: three of the four mathematics cognitive levels
>
> Only `algorithmic-thinking` has a documented source (`RETRIEVE-METADATA.md` records that Kata
> returns it). `process-thinking` and `reasoning-and-interpretation` come from this repo's metadata
> and `problem-solving` is an assumption. A wrong code here is a **422 at push time, not a dry-run
> failure** — confirm with `GET /api/v1/cognitive-levels` (needs the API key) before pushing.
>
> Also unresolved: `prerequisiteLearningObjective` holds a URL
> (`…/math/proportion/05/`) while `subTopic` / `learningObjective` are MOE codes
> (`MOE.MATH.G8.NUM.…`). Science has `[]`. Left as authored — deciding the right value is a content
> call, not a mechanical fix.

## 8. Content gaps found while wiring this up

Reported, not silently patched:

1. **Part 04 metadata item `005`** ("מסך חיזוק לאחר ניסיון לא מוצלח") **has no screen in the
   code.** `s42Enter()`/`s42Check()` exist but `TOTAL_SCREENS` is 6, `resetScreenState` maps only
   0–5, and `index.html` has no `s42` markup. Part 05's metadata says a failed peak question should
   route here; part 05 has no such routing. Nothing maps to item `005`.
2. **Part 01 item `003`** (the guided skateboard worked example, screens 7–14) is authored in
   metadata with two questions, but the code never grades it: `s8Answer`/`s9Answer`/`s10Answer`
   ignore their argument and always reveal the correct mark. It is a Socratic walk-through
   ("בואו נפתור תרגיל אחד יחד"), so no `answered` is emitted and it contributes nothing to the
   score. Either the metadata should drop those questions or the screens should become graded.
3. **Dead code**: part 01 `s5*` / `s13*` (screens do not exist) and `routeAfterBasicPractice()`
   (navigates out of range); part 04 `s42*`; part 01 `s16Q2Submit` / `s16CheckBothDone` (never
   wired in the HTML).

## 9. Verification performed

Served the repo over `http://localhost` and exercised it in a real browser.

- **Regression gate** — with no `?slxapi`, `getXAPIParameters` sets `XAPI_DISABLED = true` and
  every statement is a silent no-op. Confirmed on all five parts; the lomda behaves exactly as
  before.
- **Id integrity** — for all five parts, every `xapiQ()` `parentId` matches a real metadata
  `subContent[].id` and every `questionId` matches a real metadata question. Zero mismatches.
  Every item suffix in `SCREEN_TO_SUBCONTENT` exists in metadata; the only metadata item nothing
  maps to is part 04's `005` (§8.1).
- **Statement flow** (with `ADL.XAPIWrapper.sendStatement` stubbed): item `initialized` on entering
  an item, `requested` on hint open, `answered` carrying the learner's real Hebrew answer text and
  `context.contextActivities.parent` pointing at the item.
- **Scoring** — part 01 at 4/5 → `scaled 0.8, success true`; part 05 at 3/4 → item **and**
  component `completed` both `scaled 0.75, success true`, followed by the unit `completed`.
- Screen-map size equals `TOTAL_SCREENS` in every part; `node --check` passes on all five
  `script.js`; both `.ps1` files parse.

- **Metadata** — a standalone validator (id nesting, duplicate keys, question sequencing,
  `correctAnswers ⊆ answers`, matching pairs against declared source/target lists, enum values
  against the live vocabulary) reports **0 errors, 1 warning** for `metadata/`. The warning is part
  04's `-003` → `-005` item gap, which is the missing reinforcement screen from §8.1. Running the
  same validator against the science metadata flags 5 real issues there, so its rules are not
  tuned to pass this unit.
- **Re-checked after the metadata corrections**: component/item/question ids unchanged and still
  matching, `window.XAPI_UNIT_ID === UNIT_METADATA.id`, and a unit-scope statement targets the
  corrected unit id.

Not yet done: a run against a real LRS, an end-to-end walk of every screen by hand, and
confirmation of the mathematics cognitive-level codes against `GET /api/v1/cognitive-levels`.
