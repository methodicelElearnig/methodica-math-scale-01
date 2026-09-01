# Adding xAPI (720) reporting to a unit

How to instrument a 720 לומדה so it reports learner activity to Kata. Written as a working guide for
the **next** unit; `methodica-math-scale-01` is the reference implementation throughout, and every
concrete id, count and denominator below is *its* value — yours will differ.

Companion: **[REPORT-ISSUE.md](REPORT-ISSUE.md)** for the "מצאתם בעיה?" learner problem-report
feature. The two are independent features that share one dependency (`window.METADATA`), so read
this one first.

- **Unit** = the whole לומדה. **Component / Part** = one `<unit-slug>-0N` folder.
- Each part has `index.html`, `script.js`, `styles.css`, `assets/`; the reporting machinery itself
  lives once per unit in **[`unit-js/`](unit-js/README.md)**.
- The library is loaded at runtime from the gov.il CDN — **no library file ships in a unit repo.**
- Every `sendStatement720(...)` call is wrapped in `try/catch`, so a reporting failure can never
  interrupt the learner. Keep that invariant.

> **The machinery is not code you write any more.** `unit-js/20-xapi.js` and `unit-js/50-loader.js`
> hold the item-scope logic and the loader in one shared copy. A new unit copies that directory,
> changes the id prefix in `10-identity.js`, and then fills in the per-component **configuration**
> described in §2. Everything this guide says about ids, scoring and verification still applies —
> what changed is that you configure it rather than reimplement it.
>
> This unit reached that state the hard way: five hand-copied generations of the same code had
> drifted apart, and one component was still running a version of `goTo()` missing a null-screen
> guard the others had. See [`unit-js/README.md`](unit-js/README.md).

---

## 0. Before you write any code

1. **Author `metadata/`** — one JSON per component plus one for the unit. This is the single source
   of truth for every id the code emits. Nothing below works until it exists.
2. **Push it to Kata** — see [SEND-METADATA.md](SEND-METADATA.md); verify with a round-trip via
   [RETRIEVE-METADATA.md](RETRIEVE-METADATA.md). The CDN and the Kata catalog are two independent
   destinations: uploading the lomda does not populate the catalog, and pushing metadata does not
   deploy the lomda.
3. **Confirm the cognitive-level / mastery-level codes** your subject uses against the live
   vocabulary. A wrong code is a **422 at push time, not a dry-run failure**.

---

## 1. Canonical ids — get the trailing slashes right first

Ids are full canonical URLs under the unit's CDN prefix, e.g.

```
https://lomdot.education.gov.il/metodica/720active/math/scale/01/
```

| Level | Shape | Trailing slash |
|---|---|---|
| unit | `<prefix><unit-slug>/` | **yes** |
| component | `<prefix><unit-slug>-0N/` | **yes** |
| item | `<component><unit-slug>-0N-NNN/` | **yes** |
| question | `<item>qN` | no |

The unit and the components are **siblings** sharing `<prefix>` — components are **not** nested
under the unit id.

> **The mistake to avoid.** If the unit id stops at `<prefix>` (the bare folder), Kata's `uniqueKey`
> resolves to the last path segment — in this unit's case the string `"01"`. It looks harmless and
> breaks the catalog. `send-metadata.ps1` now refuses to run if the unit key degrades that way.

**Trailing-slash convention is not universal across units.** This unit carries them; the science
units do not. Whichever you choose, the code must match `metadata/` byte-for-byte. Here that means
`xapiItemId()` *emits* the slash and `xapiQ()` normalises it away (`_xapiTrim`) before matching the
`-NNN` suffix. Check yours before assuming.

---

## 2. Per-unit and per-component configuration

**Once per unit**, in `unit-js/10-identity.js`:

```js
var XAPI_ID_PREFIX = 'https://lomdot.education.gov.il/metodica/720active/<subject>/<topic>/<nn>/';
window.XAPI_UNIT_ID = XAPI_ID_PREFIX + '<unit-slug>/';   // trailing slash — see §1
var RESUME_ENABLED = false;   // resume is a separate feature — see RESUME.md
```

**Per component**, in its own `script.js`. These are *data*, read by the shared layer at call time:

| Symbol | Purpose |
|---|---|
| `SCREEN_TO_SUBCONTENT` | screen → `[item suffix, page-in-item]`; `null` for screens with no catalog item. Read by `xapiOnScreen()` **and** by the problem-report form. |
| `XAPI_COMP_SLUG` / `XAPI_COMP_ID` | id construction — `XAPI_COMP_ID = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/'` |
| `XAPI_EVAL_ITEMS` | items that carry a graded question *in code* (not merely in metadata) |
| `XAPI_METADATA_FILE` | `'../metadata/<component>.json'` |
| `XAPI_ITEM_RESULT` | *optional* — item suffix → function returning an explicit result, when the library's all-correct AND is wrong for that item |
| `onXapiReady()` | *optional* — runs after the component `initialized`; used by the entry and terminal components to open the unit metadata |

Provided by `unit-js/20-xapi.js`, so you call them but do not write them: `xapiItemId()`,
`xapiAnswerText(el)` (clones the option before reading `textContent`, so tooltip nodes are not
spliced into the answer string), `xapiQ(suffix, qKey)` (resolves a question id **from metadata**,
never from a hardcoded string), `xapiOnScreen()` / `xapiFinishItems()` / `xapiWireVideos()`, and
`XAPI_Q_RESULTS` + `xapiCorrectCount()`.

Two invariants that are yours to keep:

- **Write `XAPI_Q_RESULTS[...]` outside each `answered` `try/catch`**, so a reporting failure cannot
  corrupt the score.
- **`SCREEN_TO_SUBCONTENT` must have exactly `TOTAL_SCREENS` entries.** A missing key is a silently
  unreported screen.

The `xapiOnScreen(n)` call that drives item-level `initialized` / `completed` pairs already lives in
the shared `goTo()` (`unit-js/30-nav.js`) — you do not add it per part.

---

## 3. The loader

`unit-js/50-loader.js` loads `xapiwrapper.min.js` then the 720 library from
`https://lomdot.education.gov.il/metodica/720active/common/`, reads `?slxapi`, waits for metadata,
configures the LRS, restores resume state, and emits the component `initialized`. It is called last
by `unit-js/90-boot.js`, because it may navigate away.

Two things to get right:

> **`window.XAPI_USING_G`** is set from a regex like `/xapi-720-[ghijk]\.js/`. If the CDN library ever
> moves to a new letter, **widen that regex** — otherwise all item-level and video statements go
> silent with no error. It is now in one place instead of five, which is the point.

> **Which library letter** is selected by `RESUME_ENABLED`, because the resume build carries an
> extra transport — see [RESUME.md](RESUME.md). Either way the library is a **shared, cross-unit**
> file: never ship a copy in a unit repo, and treat any library change as affecting every 720 lomda
> that loads it.

**Order matters more than it looks.** The loader performs the resume hop — if the state document
names a different component, it `window.location.replace()`s there and returns. Anything that emits
a statement *before* that check leaves a statement behind for a component the learner only passed
through. That is why the entry component opens the unit from `onXapiReady()` rather than inline.

---

## 4. What to report, and where it fires

| Statement | Fires |
|---|---|
| `initialized` (component) | in the loader, once per page load — deliberately **not** deduped |
| `initialized` / `completed` (item) | `xapiOnScreen()`, when the learner crosses into a different item |
| `answered` / `answered.last` | each `sNNSubmit`. Only `answered.last` feeds the component score denominator |
| `requested.1` | on hint **open** only |
| `completed` (component) | in the routing function that leaves the component |
| `completed` (unit) | once, in the terminal component |
| `selected` | a genuine learner *preference* (e.g. video vs. flip-cards), under a `category` |
| `played` / `paused` | YouTube via the player callback; HTML5 `<video>` via `xapiWireVideos()`, **opt-in only** — an element must carry `data-xapi-report="<item>"` |

Notes worth copying:

- **Hints are usually toggles** (`popup.hidden = !popup.hidden`). Put `xapiRequestedHint()` inside
  the "just opened" branch, or closing a hint reports a second request. The helper *also* dedupes
  per question per page load, which the open-branch rule alone does not cover: each overlay closes
  three ways (its close button, the backdrop, Escape) and all three leave the hint button live, so a
  learner who opens a hint twice used to report `requested.1` twice.
- **Decorative video is not content.** `xapiWireVideos()` wires only elements carrying
  `data-xapi-report`. It used to select every `<video>`, which meant the companion-character clips
  reported — and not quietly: `.load()` on a playing element emits a `pause` then a `play`, i.e. a
  fabricated pair on every entry to the screen, including on back-navigation and on resume.
- **Decorative choices are not `selected`.** An avatar picker is decoration; a learning-format
  choice is a preference. Only the latter is reported.
- **Narrative interstitials can share an item with the questions they introduce.** That keeps the
  item open across the component so its single `completed` carries the full result, instead of
  latching a partial score the first time the learner steps onto a narrative screen.

---

## 5. Scoring — choose the denominator deliberately

**Always supply an explicit result on `completed`.** The library's own aggregation is an all-correct
AND and would report `success:false` for any partial pass.

The denominator should be **what the learner was promised**, not the metadata question count. In
this unit part 01 promises "4 מתוך 5", and screens 19–20 are parts א/ב of one exercise — so the
denominator is 5 exercises, not 11 questions.

Reference values from `methodica-math-scale-01`:

| Part | Rule |
|---|---|
| 01 | `getQuizScore() / 5` — 4 of 5 → `scaled 0.8, success true` |
| 02 | correct / 7; `success` requires **both** stated gates (`basic >= 3` **and** `advanced >= 2`) |
| 03 | `{ success: true }`, **no score** — off-computer class task, nothing to grade |
| 04 | correct / 5 |
| 05 | the שאלת-שיא rule from the item's own `informationToBot`: **≥ 3 of 4 passes**, supplied via `peakResult()` so item and component agree |

**Report `completed` on failure paths too.** A component the learner does not clear must still be
reported, or the whole attempt goes unrecorded. In this unit part 02 emits `completed` on both
branches and simply does not navigate when the gate is not met — routing a failed learner is the
host platform's job, via the component's `recommendedAfterFail`.

---

## 6. Query-string propagation

`?slxapi` and `?registration` enter through the **root `index.html`**, which redirects to part 01
carrying `window.location.search`. **Every** cross-part jump must append `window.location.search`:

```js
window.location.href = '../<unit-slug>-0N/index.html' + window.location.search;
```

Miss one and the LRS configuration is lost from that point on — everything downstream silently
reports nothing.

---

## 7. Not reporting the same thing twice

The library allows one `completed` per object **per page load**. That is not enough once a learner
can reload, resume, or navigate backwards into a finished component — each of those is a new page
load, so the same `completed` can reach the LRS again.

Suppressing that requires a ledger that outlives the page, which is resume's concern, not this
document's. **See [RESUME.md](RESUME.md) §8a** for the mechanism and the orderings it depends on.
The one rule that belongs here: `initialized` is deliberately **not** suppressed — the platform asks
for it on every entry.

---

## 8. Verification checklist

Work through this before calling the wiring done.

- [ ] **Regression gate** — with no `?slxapi`, `getXAPIParameters` sets `XAPI_DISABLED = true` and
      every statement is a silent no-op. The lomda must behave exactly as it did before
      instrumentation. Check every part.
- [ ] **Id integrity** — every `xapiQ()` `parentId` matches a real metadata `subContent[].id`, and
      every `questionId` matches a real metadata question, byte-for-byte. Zero mismatches.
- [ ] **Coverage** — every item suffix in `SCREEN_TO_SUBCONTENT` exists in metadata; list any
      metadata item nothing maps to (see §9).
- [ ] **Screen-map size** equals `TOTAL_SCREENS` in every part.
- [ ] **Statement flow** — item `initialized` on entering an item, `requested` on hint open,
      `answered` carrying the learner's real Hebrew answer text and
      `context.contextActivities.parent` pointing at the item.
- [ ] **Scoring** — hit each threshold and confirm `scaled` and `success`, including the unit
      `completed` from the terminal component.
- [ ] **Metadata validation** — ids nest correctly, no duplicate keys, questions sequenced,
      `correctAnswers ⊆ answers`, matching pairs against declared lists, enums against the live
      vocabulary.
- [ ] `node --check` on every `script.js` **and every `unit-js/*.js`**; both `.ps1` files parse.
- [ ] **No shared identifier is redeclared in a part file.** A `var`/`function` collision is a
      *silent* last-wins overwrite, and `script.js` loads after the shared layer — so a leftover
      local copy wins and the extraction looks fine while shipping the old code. Script it; see
      [`unit-js/README.md`](unit-js/README.md).
- [ ] **`?v=` is identical in all five `index.html`** for each shared file. A mismatch lets two
      components run different versions of the same logic in one learner session.
- [ ] **A real Kata run** with `?slxapi` + `?registration` — statements actually arriving, not just
      well-formed. Stubs prove payload shape, not delivery.

**A cheap regression oracle worth building early.** Drive `goTo()` across every screen of a
component and dump the resulting statement log as a normalised, diffable list. It exercises the item
`initialized`/`completed` machinery deterministically without clicking through content, so any later
refactor can be checked against a saved baseline in seconds. It does not cover answer-driven
results — a scripted walkthrough still does — but it catches the class of breakage that silent
`try/catch` blocks would otherwise hide.

---

## 9. Gaps this process tends to surface

Instrumenting a unit forces you to map every screen to a catalog item, which reliably exposes
mismatches between what metadata promises and what the code does. Report them; do not silently
patch metadata to match code or vice versa — deciding which is right is a content call.

The three still open in `methodica-math-scale-01`:

1. **Part 04 metadata item `005`** ("מסך חיזוק לאחר ניסיון לא מוצלח") **has no screen in the code.**
   `s42Enter()`/`s42Check()` exist but `TOTAL_SCREENS` is 6, `resetScreenState` maps only 0–5, and
   `index.html` has no `s42` markup. Part 05's metadata says a failed peak question should route
   here; no such routing exists. Nothing maps to item `005`. *(This is also the `-003` → `-005`
   numbering warning in [METADATA-FIXES.md](METADATA-FIXES.md).)*
2. **Part 01 item `003`** (the guided worked example, screens 7–14) is authored with two questions,
   but the code never grades it — `s8Answer`/`s9Answer`/`s10Answer` ignore their argument and always
   reveal the correct mark. It is a Socratic walk-through, so no `answered` is emitted and it
   contributes nothing to the score. Either metadata drops those questions, or the screens become
   graded.
3. **Dead code**, uninstrumented: part 01 `s5*` / `s13*` (those screens do not exist),
   `routeAfterBasicPractice()` (navigates out of range), `s16Q2Submit` / `s16CheckBothDone` (never
   wired in the HTML); part 04 `s42*`.

---

## 9a. What changed in the v4 upgrade (2026-09-01)

Reporting-side changes only; the resume side is in [RESUME.md](RESUME.md).

- **Six call-site helpers** in `unit-js/20-xapi.js` replace what used to be a 6–8 line block repeated
  25 times and a raw one-liner repeated 23 times: `xapiAnswered`, `xapiRequestedHint`,
  `xapiCompleteComponent`, `xapiCompleteUnit`, plus the answer-text builders `xapiFieldsAnswer`,
  `xapiMultiAnswer` and `xapiZoneAnswer`. **No statement shape changed** — verb, `success`,
  `score.scaled` and `student_answer` are byte-identical to before.
  The point is not tidiness: the `XAPI_Q_RESULTS`-before-the-`try/catch` invariant in §2 is now
  enforced in one place instead of relied on at 25 sites, and the hint dedupe above became possible
  at all.
- **`requested.1` is deduped** per question per page load (`XAPI_HINTS_SENT`).
- **Video reporting is opt-in** — see the note in §4.
- **An id-mismatch gate** compares `XAPI_COMP_ID` against `window.METADATA.id` on every load of every
  part and shouts to the console on a mismatch. `XAPI_ID_PREFIX` is the one value in the shared layer
  set by inference, and before this gate a wrong slash or capital meant every statement pointed at a
  catalog object that does not exist, with no error anywhere.
- **Two loader gates**: a missing `XAPI_METADATA_FILE` exits loudly, and the metadata poll is capped
  at 10 s. The poll used to spin forever, so a 404 metadata file was a silent timer loop for the
  whole session with reporting off.
- **Library `-j` → `-k`**, which adds `stateLastResult720()`. The `XAPI_USING_G` regex widened to
  `[ghijk]` in the same edit — see the warning in §3.
- **Tests**: `_test/verify-report.js` and `_test/statement-flow.js`, and `_test/README.md`.

---

## 10. Reference — `methodica-math-scale-01` as built

| Part | Items | Questions | `answered` sites | `requested` | Component `completed` fires in |
|---|---|---|---|---|---|
| 01 | 9 | 11 | 9 | 7 | `routeAfterQuiz()` |
| 02 | 7 | 7 | 7 | 7 | `routeAfterAdvancedPractice()` |
| 03 | 1 | 0 | 0 | 0 | `goToAdvanced()` |
| 04 | 4 | 5 | 5 | 5 | `goToNextModule()` |
| 05 | 1 | 4 | 4 | 4 | `s53Enter()` (+ the unit `completed`) |

Related documents: [REPORT-ISSUE.md](REPORT-ISSUE.md) · [RESUME.md](RESUME.md) ·
[SEND-METADATA.md](SEND-METADATA.md) · [RETRIEVE-METADATA.md](RETRIEVE-METADATA.md) ·
[METADATA-FIXES.md](METADATA-FIXES.md)

Origin of the pattern: `methodica-science-mass-measure-01` (branch `vadimr-1`) and the 720 technical
guidelines v2.4.
