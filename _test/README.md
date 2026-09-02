# `_test/` — headless regression oracle

**Not deployed.** This folder is development tooling only; exclude it from any release package.

## What is here

| File | What it does |
|---|---|
| `verify-report.js` | **Structure.** 550 assertions. Loads the real `index.html`, `script.js` and every `unit-js/*.js` of all five components into jsdom, runs the script tags in document order from disk, and asserts against what actually ran. It does not call the code in isolation — it runs it. |
| `statement-flow.js` | **Behaviour.** 32 assertions. Which statements actually leave the lomda when a learner does a thing, in what order, with what result — and, more importantly, which ones do **not** leave when the same screen is reached again by resume or by the back button. |
| `xapi-720-k.js` | A local stand-in for the CDN library, backed by `sessionStorage`. Loaded in the browser via `?xapiLib=`, and executed directly by both harnesses. |

## Running

jsdom is not in the repo and there is no `package.json`. **Do not install it inside the project
folder** — it sits in a synced OneDrive directory, and jsdom's `node_modules` is roughly 26MB that
would be synced for nothing. Install somewhere outside and point `NODE_PATH` at it:

```bash
mkdir -p /tmp/lomda-test && cd /tmp/lomda-test && npm install jsdom
```

Then from the unit root:

```bash
NODE_PATH=/tmp/lomda-test/node_modules node _test/verify-report.js && NODE_PATH=/tmp/lomda-test/node_modules node _test/statement-flow.js
```

Exit 0 means everything passed; failures print as a list at the end. Both accept an alternative base
path as the first argument — without one they assume their own parent directory.

> ⚠️ If you do install locally anyway, install every package in **one command**. `npm install X
> --no-save` in a folder with no `package.json` can **remove** a package installed earlier in that
> same folder.

## What `verify-report.js` covers

| Area | What is asserted |
|---|---|
| **The regression gate** | With no `?slxapi`: `sendStatement720` does not exist, and `xapiOnScreen`, `xapiAnswered` and `xapiCompleteComponent` are inert no-ops that do not throw. The lomda must behave exactly as it did before reporting existed. |
| Clean load | Zero console errors loading the full page in all five components; every local script tag resolves and executes; `script.js` precedes `90-boot.js`. |
| The shared layer | All 33 public functions defined in every component. |
| The boot cover | `#boot-cover` exists, is inline-styled, is a **sibling** of `#app` and not a child, ships with the markup safety net, and `dropBootCover()` removes it idempotently. |
| Ids | `XAPI_COMP_ID` and `XAPI_UNIT_ID` match `metadata/*.json` byte for byte (BOM-tolerant); every item in `SCREEN_TO_SUBCONTENT` exists in metadata. |
| The screen map | `SCREEN_TO_SUBCONTENT` has one entry per real screen with no holes; the `.screen` count in the DOM agrees. |
| Navigation | `goTo()` reaches every real screen and `currentScreen` tracks; out-of-range is rejected **without** moving `currentScreen`. |
| `#screen=N` | The four components a cross-part "back" can land on reach the right screen — and the hash does **not** cancel the state restore. |
| The state document | v4 shape including `ui` and `results`; `currentPartSlug` lowercases a capitalised URL. |
| The ledger | Fails open the first time, dedupes the second, a different key still sends, and a restore neither sends **nor marks**. |
| Unit-level state | A choice made before the document arrives is queued and later wins over the document; a reset document beats a stale cache; `applyUnitProfile` reports whether it changed anything. |
| Back edges | All three layers in priority order (document → sessionStorage → hard-coded fallback); `writeForwardState` records both; a failed state write leaves the landing pointer alone. |
| The reset hatch | `?resetState` strips itself from the URL, keeps the rest of the query, raises the flag, and clears both the character cache and the nav-edge map. |
| **Flush before return** | Brace-matched over every function: a function that commits an answer must flush, and no `return` may sit between the commitment and the flush. |
| Deploy contract | `?v=` identical across all five `index.html`; every cross-part path lowercase; every cross-part navigation carries the query string; the library letter is listed in the `XAPI_USING_G` regex; no identifier declared in both layers. |
| Hint dedupe | Reopening a hint reports `requested.1` once; a different question still reports. |
| Video | Only `data-xapi-report` elements are wired. |

## Two allowlists, and why they are there

`verify-report.js` carries `KNOWN_PHANTOM_SCREENS` and `KNOWN_UNFLUSHED`. Both encode **pre-existing
gaps that predate the v4 upgrade** and are listed in `docs-and-tools/REPORT-XAPI.md` §9:

- Component 01 declares `TOTAL_SCREENS = 24` but screens **5 and 13 have no markup**; `goTo()` rejects
  them via its null-screen guard.
- Four functions (`s5Submit`, `s5Q2Submit`, `s16Q2Submit`, `s42Check`) latch a commitment flag and
  never flush, because they belong to screens that no longer exist.

Both are dead code awaiting removal, not resume bugs. They are allowlisted rather than ignored so the
surrounding assertions still run — and **removing an entry must make the corresponding assertion pass,
not fail.** If you delete the dead code, delete the allowlist entry in the same commit.

## Negative-test every assertion you add

An assertion that cannot fail is worse than no assertion, because it reads as coverage. Every check in
both suites was verified by breaking the thing it guards and confirming the failure, then restoring.
Two of them are worth knowing about specifically:

`applyExecutionState`'s **sender stub** and `sendCompletedOnce`'s **`if (_restoring) return;`** protect
the same outcome, and either alone keeps the wire quiet — so a test that only counts statements cannot
tell them apart. They are pinned separately:

- the stub, by asserting a restore opens its item **exactly once** rather than twice (`initialized` is
  the one verb the ledger cannot dedupe — it bypasses it deliberately);
- the guard, by asserting the restore leaves the ledger **unmarked**, and that a real completion
  afterwards still goes out. A mark taken while the sender was stubbed would permanently suppress a
  statement that never actually left, which is how the unit `completed` goes missing for good.

## Two things jsdom cannot cover

1. **Appearance.** The harness checks classes, text and `disabled` flags — not pixels. Visual
   verification needs a real browser; `.claude/launch.json` has a static server for that.
2. **`HTMLMediaElement`.** jsdom implements neither `load()` nor `play()`, and `play()` returns
   `undefined` — so `video.play().catch(...)` throws. Both harnesses replace all three with the browser
   contract, to exercise the real code path rather than a jsdom gap.

That failure is itself what showed why `unit-js/90-boot.js` must be a **separate** script tag rather
than a few lines at the bottom of `script.js`: a top-level throw in `script.js` takes the rest of that
file with it, silently.
