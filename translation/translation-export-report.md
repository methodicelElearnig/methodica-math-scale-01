# Translation Export Report — methodica-math-scale-01, Target 01

**Module root:** `learning-demo/`
**Module name:** `methodica-math-scale-01`
**Target:** `01`
**Parts covered:** `01, 02, 03, 04, 05` (verified against the actual folder structure — see §1)
**Export type:** First export (no prior XLIFF existed for this target; §7 refresh workflow does not apply)
**Files:** `methodica-math-scale-01_target-01_he.xlf`, `translation-screen-manifest.csv`, this report

---

## 1. Discrepancy check against the part list

The requested part list (`01, 02, 04, 05`, later clarified to mean 01–05) was verified against the module root folder listing. **Result: the folder structure has exactly parts 01–05, no gaps, no undocumented extra parts.** `methodica-math-scale-01-01` through `-05` all exist; there is no `-06` and no missing part in the middle.

Two structural discrepancies from the assumed convention were found and are called out explicitly:

1. **No `js/main.js` per part.** Each part ships a flat `script.js` directly in its own folder root (`methodica-math-scale-01-0N/script.js`), not `js/main.js`. There is no `js/` subfolder anywhere in this module.
2. **A shared `unit-js/` layer at the module root**, loaded by all five parts' `index.html` (10 files, ~1,195 lines total, see `unit-js/README.md`). This is genuine shared chrome infrastructure that was *not* anticipated by the standard "module-root redirect page" pseudo-part-00 pattern — it owns the report-modal's dropdown labels/placeholder (DOM-mirrored with each part's HTML), viewport scaling, image-zoom plumbing, the resume/state-restore engine, and the boot sequence. It was folded into pseudo-part `00` alongside the module-root `index.html` (screen `01-00-99`) since it is genuinely part of the whole-module chrome, not any single part.

---

## 2. Totals

| Metric | Count |
|---|---|
| Total screens (incl. pseudo-screens `-99` and module-root `00-99`) | **57** |
| Total translation units | **950** |
| Manual-review-flagged units | **28** |
| Manual-review-flagged screens (part-level notes) | **5** |

### Units per part

| Part | Units |
|---|---|
| `01-00` (module root + shared `unit-js/`) | 4 |
| `01-01` | 370 |
| `01-02` | 197 |
| `01-03` | 53 |
| `01-04` | 173 |
| `01-05` | 153 |

### Units per screen

See `translation-screen-manifest.csv` for the full per-screen table (screen id, title, template type, source file, selector, manual-review note). Per-screen unit counts are also reproducible from the XLIFF's `screen-id` notes; the extremes are: `01-01-03` (55 units — the composite flip-cards screen with two embedded questions) and the various `-99` chrome screens (25–41 units each, dominated by the report modal + image-zoom modal set, which repeats structurally in every part).

### Units by source file (approximate, by first-listed location)

| File pattern | Approx. units |
|---|---|
| `index.html` (all 5 parts + module root) | ~560 |
| `script.js` (all 5 parts, dynamic feedback/explanation/announcer strings) | ~370 |
| `unit-js/*.js` (shared) | ~4 (rest are DOM-mirror cross-references onto `index.html` units, not separate units) |

---

## 3. Consolidated duplicates

Per the consolidation rules, duplicates were **kept separate per part and per screen** in almost all cases — heavy verbatim repetition (`חזרה`, `רמז`, `סגור`, `אפשר רמז?`, `צדקתי?`, the report-modal set, the flag button) is expected and by design. The few units that *were* consolidated (single XLIFF unit, multiple source locations listed) because the occurrences are genuinely interchangeable copies of the same control:

- **The flag/report button** (`מצאתם בעיה?`) — 3 identical occurrences per part (`aria-label`, `title`, visible `<span>`) consolidated into 1 unit per part (5 units total, one per part-chrome screen).
- **Image-zoom modal close-button** (`סגירת התמונה`) — consolidated to 1 unit per part, with every zoom-modal occurrence listed as an additional source location (ranges from 4 occurrences in part 05 to 8 in part 01).
- **Cross-screen runtime relabels** (`שנמשיך?`, the universal `זה לא מדויק/מדוייק, ננסה שוב?` first-wrong message, `רמז נפתח`/`רמז נסגר` hint announcer pairs) — consolidated to one unit per part with every call site listed, since these are the exact same JS-driven string reused verbatim across every question screen in that part.

Everything else — including near-identical phrases like the two `כל הכבוד!` occurrences in part 05 (one with a trailing invisible character, one without, serving different rhetorical moments) — was deliberately **kept separate**, per the instruction to prefer contextual clarity over deduplication.

---

## 4. Excluded items (with reasons)

- **Bare numeric dropdown/answer-option values with no attached unit word** — parts 01 and 02 (e.g. the unit-conversion dropdowns' `300`/`3,000`/`30,000`-style options). Excluded per the bare-numeral rule; every number that carries a unit word or sentence context was kept.
- **Console diagnostics** (`console.log`/`console.warn`/`console.error`) — present in every part's `script.js`, all English, never rendered to the DOM. Not included.
- **Source-code comments**, including the Hebrew ones quoting internal exercise/screen numbering (e.g. `// שאלה 2 (א+ב יחד)` in part 02, `// א, ב, ד` in part 02's `S28_CORRECT` comment, `4 מתוך 5` in a part-01 block comment, `שאלת-שיא` inside a block comment in `unit-js/20-xapi.js:67`) — confirmed by Sweep 2 (§10) to be the only uncovered Hebrew fragments in the entire module, and all seven are comments.
- **Decorative/`aria-hidden` SVG glyphs and the `✕`/`&#10005;` close-icon entity** — excluded everywhere; their `aria-label="סגור"` counterpart is captured instead.
- **`0 / 250` report-form character counter** — a live numeric template with no linguistic content at rest; its counting logic lives in the shared `unit-js/25-report.js`.
- **`ZOOM X4` overlay label** (part 05, screen 6) — Latin-script UI badge, not Hebrew. Not excluded outright; flagged as manual-review instead (§6) since it may be intentional stylized design or an oversight.

---

## 5. Out-of-scope (not excluded, but not in this export either)

- **YouTube caption tracks** for the embedded video in part 01, screen 4 — live in YouTube, not in these files. Needs a separate localization pass by whoever manages the YouTube asset.
- **`metadata/*.json`** — confirmed to contain Hebrew (question/answer metadata consumed by KATA), but it is authoring/reporting data, not rendered by the lomda itself. Not touched; flagged as a candidate for a separate metadata-localization pass if ever needed.

---

## 6. Manual-review list (28 units + 5 screen-level notes)

**Content bugs / inconsistencies (flagged, not fixed):**

| Unit | Issue |
|---|---|
| `01-01-01-019` | Stale `alt` text: says "figure with binoculars" but the image is a roller-pose character (copy-paste error from the correct instance two lines above). |
| `01-01-11-002` | Typo: `סנטימרים` missing a ט (should be `סנטימטרים`). |
| `01-01-16-017`/`018` | Singular `ניסית` vs. plural `ניסיתם` for the same learner on the same screen; the plural one belongs to a `s16Q2Submit()` function with no matching Q2 markup on this screen — likely leftover code. |
| `01-01-20-007` | Double space in `שטיח  בצורת`. |
| `01-01-23-002` | This screen's nav-dots lack a `data-q` attribute present on identical markup elsewhere — markup-only, no text impact. |
| `01-02-04-018`, `01-02-05-024` | Non-standard `מדוייק` (double-yud) spelling vs. the standard `מדויק` used elsewhere. |
| `01-02-05-025` | Mixes gershayim `ס״מ`/straight-quote `ס"מ`, and a Hebrew maqaf `ב־200`/plain hyphen `ב-200`, within one paragraph. |
| `01-03-01-008` | Missing the trailing invisible character (U+200B) that sibling list items all carry. |
| `01-05-06-004` | Inconsistent spacing around a hyphen between two adjacent answer options (`ל-100,000` vs. `ל- 6,250`). |
| `01-05-06-007` | `ZOOM X4` — Latin-script overlay label, not Hebrew; confirm whether intentional. |
| `01-05-06-020` | Wrong-branch explanation differs from the correct-branch version by two trailing invisible characters only. |
| `01-05-07-002` | Double period `..` — likely a typo, not an intentional ellipsis. |
| `01-05-08-001` | `מִשְׁטָח` carries full Hebrew niqqud (vowel points) — the only vocalized word in the part; likely an autocorrect artifact. |
| `01-05-08-020` | Wrong-branch explanation missing a space before a number that the correct-branch version has. |
| `01-00-99-004` | Shared JS announcer string lacks the exclamation mark that the visually-identical modal heading has in every part. |

**Dead/unreachable code** (listed per instructions, not silently dropped — recommend an owner decision on whether to translate at all):

- `01-01-99-031..034` — data-screen `5`, fully coded in `script.js:546-770`, no matching HTML anywhere in part 01.
- `01-01-99-035` — data-screen `13`, `script.js:1937-1965`, same situation.
- `01-04-99-038..041` — a "screen 42 / Q3ג" block, `script.js:1053-1158` in part 04, referencing `#s6`/`goTo(7)` which don't exist (`TOTAL_SCREENS=6`).
- `01-01-04-003` — not dead code but a **structural placeholder**: screen 4 (part 01) repeats screen 3's entire embedded Q1/Q2 verbatim; rather than duplicate ~30 units a second time, a single placeholder unit points back at `01-01-03-018` through `-048` and is marked to be excluded from anything sent to a human translator.

**Logic-coupled strings (translate with care — see full developer-notes in the XLIFF for exact locations):**

- **Highest risk:** `01-02-05-009`/`-010` (part 02, screen 5) — the answer words `כפל`/`חילוק` are compared as **literal strings** against a JS constant (`S30_CORRECT`, `script.js:672`). Mistranslating either word without updating the JS constant breaks grading silently.
- **`S16`–`S23_RESTORE_EXPLANATION` family** (part 01) and the equivalent `S26`–`S33`/`S37`–`S41`/`S45`–`S51` families (parts 02/04/05) — every graded question's explanation text is duplicated verbatim between the live-submit code path and a resume/reload-restore constant. Both copies are captured as one unit with a developer-note cross-referencing the mirror location; translate once, apply identically to both.
- **Report-modal dropdown labels** (`תקלה טכנית או שמשהו לא עובד`, `משהו לא ברור לי`, `אחר`, `בחרו סוג בעיה`) — DOM-mirrored between each part's static HTML and the single shared `unit-js/25-report.js` (`REPORT_TYPE_LABELS` + `PLACEHOLDER`). All 6 locations (5 parts + 1 shared JS file) must read identically.

---

## 7. Refresh workflow

Not applicable — this is a first export for target 01 (no prior XLIFF exists to diff against).

---

## 8. Normalized (non-byte-matching) strings

A "normalized match" means the stored `<source>` text is confirmed present at its recorded line(s), but is not a byte-for-byte copy of the raw file bytes because of a documented, deliberate transformation:

1. **Multi-line HTML joins** — a source string spanning several indented lines in the original (typically joined by inline `<br>` tags) is stored on one line, with the `<br>` tags kept and the newline/indentation between them dropped. This affects the majority of question-stem and hint-text units across all five parts.
2. **JS string-literal concatenation** — several `script.js` explanation strings are built from two or more `'...' + '...'` literals across source lines; the stored unit is the concatenated runtime value, not either literal alone.
3. **JS `\n` escape sequences** — a small number of JS string literals use a literal `\n` escape (not a real line break) to force a line break in the rendered explanation; the stored unit uses a real line break in its place, matching what actually displays.
4. **Runtime-concatenated values** — units using the `{placeholder}` convention (`{number}`, `{targetLabel}`, `{code}`) represent strings the JS builds at runtime from a variable; the literal static source text never matches byte-for-byte by definition, and Sweep 1 (§10) marks these as `SKIP` rather than pass/fail.
5. **Tooltip-word placeholders** — the `{tooltip:WORD}` convention (2 instances in part 05, plus the developer-note-only explanation for part 01's differently-structured tooltip on screen 22) marks where an inline info-icon widget's markup was elided from the surrounding sentence.

None of these are transcription errors; all are the intentional normalizations the export format requires.

---

## 9. Malformed or ambiguous screen structures

- **Part 01, data-screens 5 and 13 do not exist in the HTML** despite `TOTAL_SCREENS = 24` and full corresponding JS logic existing for both. Confirmed non-contiguous by design (a code comment in `script.js:2221` explicitly documents this). Not treated as missing/broken — captured as dead-code manual-review units instead (§6).
- **Part 04, a "screen 42" JS block** references `#s6`/`goTo(7)`, neither of which exists (`TOTAL_SCREENS=6`, only screens 0–5 exist). Same treatment.
- **Part 01, screen 4 is a structural near-duplicate of screen 3** (video-mode vs. cards-mode presentation of the identical embedded Q1/Q2 content) — handled via the placeholder unit `01-01-04-003` rather than full duplication (§6).

No screen anywhere had unparseable or ambiguous `data-screen` markup requiring a fallback numbering scheme — the project's own `data-screen` attribute was usable directly in every case, per the required approach.

---

## 10. Verification results

### Sweep 1 — every unit still matches its recorded source location

| Result | Count | % of total |
|---|---|---|
| Exact byte match | 36 | 3.8% |
| Normalized match (documented transformation, §8) | 848 | 89.3% |
| **FAIL** | **0** | **0%** |
| Skipped (consolidated multi-location / dead-code / placeholder / runtime-concatenation — not string-matchable by design) | 66 | 6.9% |
| **Total** | **950** | 100% |

**0 failures.** The low "exact byte match" percentage (3.8%) is expected and healthy: the overwhelming majority of units in this module are multi-line HTML joins or JS-concatenated explanation strings, which are *supposed* to differ from raw file bytes per the documented normalizations in §8 — not a sign of transcription error. Every one of the 66 skipped units was individually inspected against its source file by hand (not just algorithmically) before being classified as unmatchable-by-design; none were skipped to hide a real miss.

Three genuine data-entry errors were caught and corrected during this sweep before the final XLIFF was generated:
- Two zoom-modal cloned `alt` texts in part 05 (`01-05-99-027`, `-029`) were transcribed as the contracted form "מפת שטח" instead of the file's actual "מפה של השטח".
- One zoom-modal cloned `alt` text in part 05 (`01-05-99-031`) was transcribed as "מפת שטח" instead of the file's actual "מפה של השטח - זום".
- Part 01's screen-22 tooltip unit (`01-01-22-007`) originally duplicated the trigger phrase "המרחק האווירי" (once as plain text, once inside a `{tooltip:}` placeholder) because that screen's info-icon does not wrap a trigger word the way part 05's tooltips do — corrected to plain prose with a developer-note explaining the structural difference.

### Sweep 2 — no Hebrew in the source is uncovered

| Result | Count |
|---|---|
| Hebrew-bearing code fragments scanned (non-comment) | 1,549 |
| Flagged for review | 21 |
| — excluded (inline `//` comment) | 16 |
| — excluded (block `/* */` comment) | 5 |
| **Genuine misses** | **0** |

One genuine miss *was* found and fixed before this final count: `script.js:266` in part 01 (`document.getElementById('s2-char-b').alt = 'דמות עם קלפים';`) — a dynamically-assigned `alt` text on the "cards" learning-mode character image that the initial per-screen HTML extraction missed because it exists only in `script.js`, not in the static markup. Added as `01-01-02-010`.

All 21 remaining flagged fragments are inside comments (7 distinct comments, each matched twice — once by the inline-comment scan, once because a couple of the same fragments recur near identically worded comments elsewhere) and are correctly excluded, matching §4.

### Structural checks

| Check | Result |
|---|---|
| XML well-formed | ✅ Yes |
| Trans-unit ids unique | ✅ Yes (0 duplicates across 950 units) |
| Every unit has a `screen-id` note | ✅ Yes (by construction) |
| Every screen id referenced by a unit exists in the manifest, and vice versa | ✅ Yes (0 orphans either direction) |
| Every `<target>` empty | ✅ Yes (0 non-empty targets) |
| Ids match `{target}-{part}-{screen}-{string}` shape (2-2-2-3 digit groups) | ✅ Yes (0 malformed ids) |
| `source-location` notes point at real files | ✅ Yes (validated as part of Sweep 1's line-range bounds check; 0 out-of-range references) |
| Placeholders intact (`{tooltip:...}`, `{number}`, `{targetLabel}`, `{code}`) | ✅ Yes — preserved literally in `<source>`, never populated |

### No production files modified

Confirmed by two independent checks: (1) every file under `translation/` has today's date; every production file (`index.html`, `script.js`, `unit-js/*.js`, `metadata/*.json`, etc.) retains its pre-existing modification timestamp (Aug 12 / Aug 23, both before this session). (2) A review of every tool call made during this export confirms production files were only ever opened via read-only operations (`Read`, `Grep`, and `sed -n`/`grep` through Bash) — no `Edit`/`Write` call targeted anything outside the `translation/` folder.

---

## 11. Files in this export

| File | Purpose |
|---|---|
| `methodica-math-scale-01_target-01_he.xlf` | The XLIFF 1.2 export — 950 trans-units, empty targets, UTF-8 no BOM |
| `translation-screen-manifest.csv` | 57-row screen manifest (`screen_id, screen_title, screen_type, source_file, container_or_selector, manual_review`) |
| `translation-export-report.md` | This report |
| `lib.ps1`, `data-00.ps1`…`data-05.ps1`, `build.ps1`, `verify.ps1` | The generation/verification scripts used to build and check the export — kept for reproducibility and for a future refresh pass; not part of the deliverable itself |
| `sweep1-results.csv`, `sweep2-uncovered.csv`, `stats.json` | Raw verification-sweep output backing §10 |
