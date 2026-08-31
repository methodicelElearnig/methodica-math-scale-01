# Metadata fixes — 2026-08-05

Everything changed in `metadata/` while preparing this unit for its first push to the Kata
(Katalog) catalog, why each change was needed, and what deliberately was **not** changed.

The files were authored 2026-07-29. They were correct in structure and content — every id nests
properly, no duplicate keys, question ids sequential, and every `correctAnswers` entry is a real
member of its `answers[]`. The problems were all in **controlled-vocabulary spelling** plus one
**unit id** mistake.

**Total: 38 value edits across all 6 files** — 37 vocabulary values + 1 unit id (plus the 5
`learningUnitId` references that follow from it).

The last 2 were found only after querying the live API — see §2.1.

Method: exact-string replacement on JSON values, so key order, indentation, Hebrew text and
everything else stayed byte-identical. All 6 files re-parsed clean afterwards.

---

## 1. The unit id (1 edit + 5 references)

```
- "id": "https://lomdot.education.gov.il/metodica/720active/math/scale/01/"
+ "id": "https://lomdot.education.gov.il/metodica/720active/math/scale/01/methodica-math-scale-01/"
```

**Why.** Kata derives `uniqueKey` from the last path segment of the id. The original id stopped at
the unit *folder*, so the key resolved to the bare string **`"01"`** — which would collide with
every other unit numbered 01 across every subject. `SEND-METADATA.md` documents the expected form,
and the science unit confirms it:

| | unit id | → `uniqueKey` |
|---|---|---|
| science (accepted by the live API) | `…/science/mass-measure/01/methodica-science-mass-measure-01` | `methodica-science-mass-measure-01` |
| math, before | `…/math/scale/01/` | `01` ❌ |
| math, after | `…/math/scale/01/methodica-math-scale-01/` | `methodica-math-scale-01` ✅ |

`learningUnitId` was updated to the same value in all 5 component files. Only the exact
full-prefix value was replaced — component and item ids, which merely *start* with that prefix,
were left untouched.

**Resulting id hierarchy.** The unit and the components are **siblings** sharing the folder prefix;
components are not nested under the unit id. This matches the science unit's shape.

| Level | Shape | Trailing slash |
|---|---|---|
| unit | `<prefix>methodica-math-scale-01/` | yes |
| component | `<prefix>methodica-math-scale-01-0N/` | yes |
| item | `<component>methodica-math-scale-01-0N-NNN/` | yes |
| question | `<item>qN` | no |

## 2. Controlled-vocabulary spelling — 35 values

Every compound vocabulary value had its words in the **wrong order**. The pattern is uniform
enough to look mechanical — worth fixing in whatever generated these files, or the next unit will
arrive the same way.

| was | corrected to | field | count |
|---|---|---|---|
| `content-interactive` | `interactive-content` | `mediaFormat` (items) | 21 |
| `basic-curriculum-core` | `core-curriculum-basic` | `depthLevel` (components) | 4 |
| `advanced-curriculum-core` | `core-curriculum-advanced` | `depthLevel` (components) | 1 |
| `thinking-algorithmic` | `algorithmic-thinking` | `cognitiveLevel` (component) | 1 |
| `exercise-solved` | `solved-exercise` | `contentType` (item) | 1 |
| `task-inquiry-or-project` | `project-or-inquiry-task` | `contentType` (item) | 1 |
| `religious-state` | `state-religious` | `targetSector` (unit) | 1 |
| `education-special` | `special-education` | `targetSector` (unit) | 1 |
| `populations-disadvantaged` | `disadvantaged-populations` | `targetAudience` (unit) | 1 |
| `immigrants-new` | `new-immigrants` | `targetAudience` (unit) | 1 |
| `needs-special-with-students` | `students-with-special-needs` | `targetAudience` (unit) | 1 |
| `gaps-language-with-students` | `students-with-language-gaps` | `targetAudience` (unit) | 1 |
| `reasoning-and-interpretation` | `interpretation-and-reasoning` | `cognitiveLevel` (components) | 2 |
| | | **total** | **37** |

### Per file

| File | edits | breakdown |
|---|---|---|
| `…-01.json` | 11 | 9 × `interactive-content`, 1 × `core-curriculum-basic`, 1 × `solved-exercise` |
| `…-02.json` | 9 | 7 × `interactive-content`, 1 × `core-curriculum-basic`, 1 × `algorithmic-thinking` |
| `…-03.json` | 2 | 1 × `core-curriculum-basic`, 1 × `project-or-inquiry-task` |
| `…-04.json` | 6 | 4 × `interactive-content`, 1 × `core-curriculum-advanced`, 1 × `interpretation-and-reasoning` |
| `…-05.json` | 3 | 1 × `interactive-content`, 1 × `core-curriculum-basic`, 1 × `interpretation-and-reasoning` |
| `…_unit.json` | 6 | the 2 `targetSector` + 4 `targetAudience` values |

## 2.1 The two the science project could not have told us about

The first 35 corrections came from the science unit's metadata, whose values the live API had
accepted — good empirical evidence, but it says nothing about codes science does not use.

`reasoning-and-interpretation` (parts 04 and 05) *looked* well-formed, so it survived the first
pass and was flagged as "unverified" rather than fixed. Querying
`GET /api/v1/cognitive-levels` on 2026-08-05 settled it: **the real code is
`interpretation-and-reasoning`** — the same word-order fault as everything else, just not
recognisable without the authoritative list.

The API returns 16 codes, 4 mathematics and 12 science. The mathematics four:

| code | Hebrew | English |
|---|---|---|
| `algorithmic-thinking` | חשיבה אלגוריתמית | Algorithmic Thinking |
| `process-thinking` | חשיבה תהליכית | Procedural Thinking |
| `interpretation-and-reasoning` | חיפוש פתוח והנמקה | Open Interpretation and Reasoning |
| `knowledge-and-recall` | ידע וזיהוי | Knowledge and Recognition |

All five components now carry a code that exists in Kata, verified against the live list:

| Component | `cognitiveLevel` | Hebrew |
|---|---|---|
| `…-01`, `…-03` | `process-thinking` | חשיבה תהליכית |
| `…-02` | `algorithmic-thinking` | חשיבה אלגוריתמית |
| `…-04`, `…-05` | `interpretation-and-reasoning` | חיפוש פתוח והנמקה |

Two things that had been guessed are now settled: `problem-solving`, which I had put in the
script's whitelist on assumption, **does not exist** — the fourth mathematics code is
`knowledge-and-recall`. And all 12 science codes are live, so the inherited "4 levels still 422"
note was stale; `$PendingCognitiveLevel` is now empty.

### The other vocabularies remain inferred

Only `cognitive-levels` and `skills` have list endpoints; `depth-levels`, `media-formats`,
`content-types`, `mastery-levels`, `target-sectors`, `target-audiences` and `component-purposes`
all return 404. Those corrections still rest on the science unit's accepted values — strong
evidence, but not authoritative the way the cognitive levels now are.

### Why `targetSector` / `targetAudience` mattered most

`send-metadata.ps1` forwarded those two fields **without validation**. The other reversed values
would have been caught locally by the enum checks; these six would have reached the API and failed
as a 422 *after* the unit had already been created. Validation for them has since been added
(see §4).

## 3. State after the fixes

Validator result: **0 errors, 1 warning.**

The single warning is part 04's item numbering gap `-003` → `-005`. That is not a spelling problem:
metadata item `005` ("מסך חיזוק לאחר ניסיון לא מוצלח") describes a reinforcement screen that
**does not exist in the code**, and part 05's metadata says a failed peak question should route to
it. Left as-is — see [REPORT-XAPI.md](REPORT-XAPI.md) §9.1. Nothing validates `order` contiguity.

`send-metadata.ps1 -DryRun` now completes clean: **28 payloads** (1 unit + 5 components + 22
items), exit code 0.

### Inventory as it now stands

| Component | order | items | questions | `depthLevel` | `cognitiveLevel` | `masteryLevel` |
|---|---|---|---|---|---|---|
| `…-01` | 1 | 9 | 11 | `core-curriculum-basic` | `process-thinking` | `intermediate` |
| `…-02` | 2 | 7 | 7 | `core-curriculum-basic` | `algorithmic-thinking` | `basic` |
| `…-03` | 3 | 1 | 0 | `core-curriculum-basic` | `process-thinking` | `intermediate` |
| `…-04` | 4 | 4 | 5 | `core-curriculum-advanced` | `interpretation-and-reasoning` | `advanced` |
| `…-05` | 5 | 1 | 4 | `core-curriculum-basic` | `interpretation-and-reasoning` | `intermediate` |

## 4. Knock-on changes outside `metadata/`

**`send-metadata.ps1`** — so these faults cannot recur silently:

- `$ValidMasteryLevel` added **and `masteryLevel` is now forwarded in the component payload.** The
  string `masteryLevel` appeared nowhere in the original script, so all five values were being
  silently dropped on push. Absent stays absent rather than being defaulted.
- `$ValidTargetSector` / `$ValidTargetAudience` added, and `New-UnitBody` now validates both.
- `New-UnitBody` throws if the unit `uniqueKey` ever resolves to something that is not a
  `methodica-*` slug — the §1 fault, made loud.
- `$ValidCognitiveLevel` now holds all 16 verified codes (4 mathematics + 12 science), replacing
  the two entries that had been guessed. `$PendingCognitiveLevel` is empty — the four science
  levels the inherited comment described as blocked are live.

**The lomda runtime** — `window.XAPI_UNIT_ID` in all five `script.js` files changed from
`XAPI_ID_PREFIX` to `XAPI_ID_PREFIX + 'methodica-math-scale-01/'`, to keep matching the corrected
unit id. Re-verified in a browser afterwards: component, item and question ids are unchanged and
still match metadata exactly, `window.XAPI_UNIT_ID === UNIT_METADATA.id`, and a unit-scope
statement targets the corrected id. `XAPI_ID_PREFIX` itself was **not** changed — it is the folder
prefix that component ids are built from.

## 5. Deliberately NOT changed

| Item | Why it was left |
|---|---|
| **`prerequisiteLearningObjective`** holds a URL (`…/math/proportion/05/`) while `subTopic` and `learningObjective` are MOE codes (`MOE.MATH.G8.NUM.…`); science has `[]` | Inconsistent, and probably wrong — but picking the right MOE code is a content decision, not a mechanical fix. Flagged, not guessed. |
| **Trailing slashes** on unit / component / item ids (science has none) | Harmless: Kata strips them when deriving `uniqueKey`, and the runtime already normalises them. Changing them would mean re-verifying the whole reporting layer for no gain. |
| **Part 04 item `005`** with no matching screen | A real content gap, not a metadata typo. Fixing it means either building the screen or removing the item — the content owner's call. |

## 6. Status

`metadata/` is **ready to push** as far as anything checkable locally or against the API goes:

- validator: **0 errors, 1 warning** (part 04's `-003` → `-005` gap, §3)
- `send-metadata.ps1 -DryRun`: clean, 28 payloads, exit 0
- every `cognitiveLevel` verified to exist in Kata, against the live endpoint

The one genuinely unresolved item is **`prerequisiteLearningObjective`** (§5) — a URL where the
neighbouring fields are MOE codes. It will not fail a dry run, and there is no endpoint to check it
against.

Residual risk sits with the vocabularies that have no list endpoint (§2.1). If a push does return
a 422 on one of those, the message names the field and value, and the fix is the same shape as
everything in §2.

Run `send-metadata.ps1` from **native PowerShell**, not Git Bash — Git Bash garbles the Hebrew in
the console output (the data itself is fine).

## 7. How to re-check

```powershell
# from the repo root, native PowerShell
pwsh -File send-metadata.ps1 -DryRun          # builds every payload, no network, no key needed
```

The live cognitive-level list (needs the key, which lives in the git-ignored `kata-api-key.txt`):

```powershell
$key = (Get-Content kata-api-key.txt -Raw).Trim()
curl.exe -s -X GET "https://kata.cet.ac.il/api/v1/cognitive-levels" -H "X-API-Key: $key"
```

Note the header is **`X-API-Key`**, not `Bearer` — matching what the script itself sends.
