# Live verification — `selected` / learning-type on the part-01 choice, 2026-11-02

Package `../../deployments/2026-11-02` (commit `1fbecbc`). Why: step 5 of the `selected` / learning-type
plan — this unit already sent `selected` on screen 2's המשך, but with the card's label as `response`; it
now sends the chosen path item's `mediaFormat` (guide
`Documentation/reporting-and-resume/ADDING-REPORTING-AND-RESUME.md` §6.3a), and the s3 / s4 mode toggles
report too.

## CDN upload

All 7 files are **byte-identical** to the package (cache-busted downloads compared with `cmp`):

| File | Bytes |
|---|---|
| `unit-js/20-xapi.js` | 21,479 |
| `-01/script.js` | 121,711 |
| `-01/index.html` | 198,015 |
| `-02/index.html` | 131,250 |
| `-03/index.html` | 22,552 |
| `-04/index.html` | 95,276 |
| `-05/index.html` | 78,258 |

The live metadata `metadata/methodica-math-scale-01-01.json` (24,692 bytes) is unchanged and identical to
the package: 003 `video`, 004 `text` — the values the statement's `response` copies.

## Live part 01 (CDN page, `sendStatement720` captured in the page — nothing sent to Kata)

`https://lomdot.education.gov.il/metodica/720/math/scale/01/methodica-math-scale-01-01/index.html`

- Loads `../unit-js/20-xapi.js?v=9` and `script.js?v=23`; `XAPI_LEARNING_PATHS` = `video` → 003 `video`,
  `cards` → 004 `text`.
- Screen 2: two card clicks → **no** `selected`.
- המשך on video → s4 and **one** statement: verb `selected`, objectType `onlinelesson` (the library uses
  the component id), `{ category: 'learning-type' }`, `result.response` = **`video`** (was the label).
- Back to s2, המשך again → nothing (picks ledger).
- s4 cards toggle → s3 and **one** `selected`, `response` = **`text`**.
- s3 video toggle → s4 and nothing (already reported).
- Item statements unchanged: 002 on s2, 003 on s4 (with the YouTube `played` / `paused`), 004 on s3.

## Not checked here

- The statement as stored in Kata — a platform launch (`?slxapi=`) is needed; the platform team checks it
  after our notice (`Documentation/MOE/NOTE-TO-PLATFORM-selected-learning-type-2026-11-02.md`).
- How the platform / bot reads `response` = `mediaFormat` (agreed deviation from v2.7's `contentType`).
