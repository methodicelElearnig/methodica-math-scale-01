# Live verification — item split in part 01, 2026-10-27

Package `../../deployments/2026-10-27` (commit `96c6183`). Why: `QA/2026-10-26` — the bot answered about
the learning path the learner had not chosen; 002 is now the choice, 003 video, 004 cards, and the old
003–009 are 005–011.

## CDN upload

All 3 files are **byte-identical** to the package (cache-busted downloads compared with `cmp`):
`metadata/methodica-math-scale-01-01.json` 24,692 · `-01/index.html` 197,995 · `-01/script.js` 121,840.

## KATA send — component 01 only, unit not written (`-ComponentsOnly`)

**Run 1:** `UNIT … components-only, not written (exists)`; component 01 + items 001–009 updated (200),
010–011 created (201); `created=2 updated=10 failed=0`. Read back: everything matched **except two
leftovers** — 002 still held the old 002's two questions and 005 the old 005's question. The sender left
`questions` out of an item PATCH when the list was empty, and Kata keeps what it has.

**Fix + run 2:** the sender now always sends `questions` (`[]` when empty). Run 2 updated the component
and items 001–005 and 008 (200). Items 006, 007, 009, 010, 011 failed with **422 `questions: list_type`**:
an if-expression unrolled their one-element list into an object. A failed PATCH writes nothing, and those
five were already correct from run 1. Fixed after the run (`[object[]]` straight into the body), and the
FAILED log line now names the request that failed (it printed the create route for a failed PATCH).
The dry run after the fix shows every item's `questions` as a list. No third send was needed.

## Read back (raw `GET /api/v1/content-units/methodica-math-scale-01`)

This repo's `retrieve-metadata.ps1` garbles Hebrew on write, so the raw response was compared instead
(before: `../../deployments/kata-snapshots/2026-10-27-before-split/_raw-content-unit.json`, after:
`../../deployments/kata-snapshots/2026-10-27-after-split-raw-content-unit.json`).

- **Unit record unchanged** (`updatedAt` 2026-08-05; title `ar` / `he` / `Hebrew` intact).
- **The other 9 components unchanged**, the 5 Arabic ones included.
- **Component 01**: `published`, title "בואו נלמד משהו חדש", 11 items; every item matches `metadata/`
  (title, informationToBot, contentType, mediaFormat, questions). 002 and 005 carry no questions.

## Not checked here

- The bot's answers on each path — the platform team checks that after our notice.
- A live xAPI run inside KATA — covered locally by `verify-report.js`, `statement-flow.js` and the browser
  walk of both paths.
