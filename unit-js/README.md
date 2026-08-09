# `unit-js/` — the shared layer

One copy of every behaviour that is the same in all five components of this unit. Each
`methodica-math-scale-01-0N/script.js` keeps only that component's configuration and screen logic,
and fills in the hook contract below.

Companions: [RESUME.md](../RESUME.md) · [REPORT-XAPI.md](../REPORT-XAPI.md) ·
[REPORT-ISSUE.md](../REPORT-ISSUE.md)

---

## Load order

Every part's `index.html` ends with exactly this, in this order:

```html
<script src="../unit-js/10-identity.js?v=1"></script>
<script src="../unit-js/15-ui.js?v=1"></script>
<script src="../unit-js/25-report.js?v=1"></script>
<script src="../unit-js/28-feedback-drag.js?v=1"></script>
<script src="../unit-js/60-devbridge.js?v=1"></script>
<script src="script.js?v=N"></script>              <!-- per-part: DEFINITIONS + CONFIG ONLY -->
<script src="../unit-js/90-boot.js?v=1"></script>  <!-- the ONLY side effects -->
```

Component 01 additionally loads the YouTube `iframe_api` **after** `script.js`, which is where
`window.onYouTubeIframeAPIReady` is defined.

**What the numeric prefixes mean.** There is no module system here — ten `<script>` tags execute in
document order, and without the prefix the only record of that order would be five separate
`index.html` files. The number puts it next to the code, and counting by 5s and 10s leaves room to
insert a file without renumbering. **What they do not mean:** nothing reads them, and because every
file except `90-boot.js` is definition-only, the order among `10-`–`60-` is nearly arbitrary in
practice. Only two positions carry real weight — `script.js` before `90-boot.js`, and `90-boot.js`
last.

> **`?v=` invariant.** All five `index.html` reference the same shared URLs, so a given shared file's
> `?v=` **must be identical in all five**. A mismatch means one part fetches a second copy under a
> different URL, and two parts can execute different versions of the same logic inside one learner
> session.

---

## The hook contract

Every `script.js` must define these. The shared layer reads them **at call time**, never at load
time, which is why `script.js` may load after the shared files.

### Configuration

| Name | Kind | Read by |
|---|---|---|
| `TOTAL_SCREENS` | number | `goTo`, dev bridge |
| `currentScreen` | number | `submitReport`, resume |
| `SCREEN_TO_SUBCONTENT` | object | `xapiOnScreen`, `submitReport` |
| `XAPI_COMP_SLUG`, `XAPI_COMP_ID` | string | `xapiItemId` |
| `XAPI_EVAL_ITEMS` | object | `xapiOnScreen`, `xapiFinishItems` |
| `RESUME_PLAIN_VARS` | array (may be `[]`) | that part's own capture/apply |
| `RESUME_INPUT_IDS`, `RESUME_TEXT_IDS` | array, optional | that part's own `applyResumeDom` |

### Functions

| Name | Notes |
|---|---|
| `resetScreenState(n)` | dispatches to the screen's `sNNEnter()` |
| `restoreScreenUI(n)` | repaints an answered screen; must be exception-safe |
| `capturePartPayload()` | returns this part's payload, including `currentScreen` |
| `applyResumeVars(st)` | **the parameter must be named `st`** — see the warning below |
| `applyResumeDom(st)` / `applyResumeInputs(...)` | restores DOM-only answers |
| `bootXAPI()` | the loader; called last by `90-boot.js` |
| `initResumeLeaveHandlers()` | registers `beforeunload` / `pagehide` / `visibilitychange` |
| `partBoot()` | *optional* — anything only this component needs at startup |

> ⚠️ **`applyResumeVars`'s parameter must stay named `st`.** It runs
> `eval(k + ' = st.vars[k];')`, which resolves `st` lexically. Renaming it fails **silently**: the
> assignment throws, the surrounding `try/catch` swallows it, and the learner's answers quietly
> vanish. Nothing enforces this.

---

## Why boot order is explicit

Before the split each `script.js` interleaved definitions with side effects, and startup order was
whatever the file happened to be in. `90-boot.js` is now the only file in this directory with
top-level side effects, and its order is load-bearing:

1. **`scaleApp()` first** — `initFeedbackDrag`'s `getAppTransform()` parses
   `#app.style.transform`, which does not exist until `scaleApp` has written it.
2. **`initFeedbackDrag()` must be the last thing that wraps `goTo`.** It replaces `window.goTo`
   with a wrapper; because a top-level `function goTo(){}` is also a window property, a bare
   `goTo(n)` call anywhere then reaches the wrapper too. Anything installed after it is bypassed.
3. **`partBoot()` before `bootXAPI()`** — a component's own wiring must be in place before a resume
   can replay onto it.
4. **`bootXAPI()` last**, exactly as every `script.js` used to end. It may
   `window.location.replace()` to another component, and nothing after it would run.

No `DOMContentLoaded` wrapper is needed: `90-boot.js` sits immediately before `</body>`.

---

## Adding to the shared layer

Two rules, both of which exist because failures here are silent:

**No identifier may be declared at top level in both a shared file and a part file.** A
`let`/`const` collision is a loud `SyntaxError`, but a **`var`/`function` collision is a silent
last-wins overwrite** — and `script.js` loads *after* the shared files, so a leftover part-local
copy wins and the extraction looks successful while shipping the old code. Check it:

```bash
node -e "const fs=require('fs');const s=new Map();fs.readdirSync('unit-js').filter(f=>f.endsWith('.js')).forEach(f=>fs.readFileSync('unit-js/'+f,'utf8').split('\n').forEach(l=>{const m=l.match(/^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/);if(m)s.set(m[1],f)}));['01','02','03','04','05'].forEach(p=>{const h=[];fs.readFileSync('methodica-math-scale-01-'+p+'/script.js','utf8').split('\n').forEach((l,i)=>{const m=l.match(/^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/);if(m&&s.has(m[1]))h.push(m[1]+'@'+(i+1))});console.log(p+': '+(h.length?h.join(', '):'clean'))})"
```

Hook names are the expected exceptions.

**When components disagree, take the superset and prove it inert.** Every block extracted so far
had drifted between parts. The rule that worked: adopt the newest version plus any guard another
part added, then verify the difference cannot fire elsewhere. Two worked examples —

- the draggable feedback code existed in **four** generations; the shared copy is the newest plus
  component 04's `.s5-fb-body` guard, which is inert because that class exists on exactly one
  element in the whole unit;
- `resetReportForm` / `reportTextBlur` come from components 04/05, whose modal adds
  `#report-text-error`; every lookup is guarded, so in 01/02/03 the extra lines short-circuit.

---

## Files

| File | What it holds |
|---|---|
| `10-identity.js` | `XAPI_ID_PREFIX`, `window.XAPI_UNIT_ID`, `shortId()`, `RESUME_ENABLED` |
| `15-ui.js` | `announce`, `scaleApp`, image zoom, `initA11yWiring`, `s5FbClose`, `checkRatio`, `updateNavBar` |
| `20-xapi.js` | item scope and question ids — `xapiOnScreen`, `xapiQ`, `xapiFinishItems`, `xapiWireVideos`, `xapiItemResult` |
| `25-report.js` | the whole "מצאתם בעיה?" layer + `initReportModal()` |
| `28-feedback-drag.js` | `initFeedbackDrag()` — draggable inline feedback |
| `30-nav.js` | `currentScreen`, `goTo()`, `applyExecutionState()` |
| `40-resume.js` | the v3 resume core, the `completed` ledger, cross-part back, save/flush |
| `50-loader.js` | `bootXAPI()` — CDN loader, metadata poll, resume hop, `onXapiReady()` |
| `60-devbridge.js` | `initDevBridge()` — the `index_dev.html` postMessage bridge (not deployed) |
| `90-boot.js` | the startup sequence — the only side effects |

## What this cost and bought

The five `script.js` went from **11,327 lines to 6,900**; `unit-js/` is **1,195**. Net **−4,427
lines**, and every shared behaviour now has exactly one copy.

The extraction also surfaced drift that had been invisible: four generations of the draggable
feedback code, two of the report modal, and a null-screen guard that only two of five components
had. That last one was a live bug — component 01's `goTo(5)` and `goTo(13)` threw inside an
`onclick`, and adopting the guard unit-wide fixed it.
