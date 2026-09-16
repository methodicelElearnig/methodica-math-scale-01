'use strict';
/* ═══════════════════ xAPI (720) — identity ═══════════════════
   Shared by all five components of methodica-math-scale-01. Loaded first; see unit-js/README.md.

   Canonical id prefix for this unit. Every id the lomda reports is built from it and must match
   metadata/*.json byte-for-byte, INCLUDING the trailing slashes that convention carries. */
var XAPI_ID_PREFIX = 'https://lomdot.education.gov.il/metodica/720active/math/scale/01/';

/* The unit id is the prefix PLUS the unit slug — it must equal metadata unit id exactly.
   (The prefix alone is only the folder; keying the unit on that resolved to "01".) */
window.XAPI_UNIT_ID = XAPI_ID_PREFIX + 'methodica-math-scale-01/';   // resume State document key

/* Last path segment of a canonical id — the short slug the bug-report form records. */
function shortId(u){ return String(u || '').replace(/\/+$/, '').split('/').pop(); }

/* Resume (KATA State API) — ACTIVE.
   True also switches the loader to xapi-720-k.js, which carries the State transport that -i lacks
   plus diagnostics on the state layer (stateLastResult720). So this flag changes reporting too,
   not only restore — see 50-loader.js. Full design: docs-and-tools/RESUME.md.

   What is implemented: one unit-level state document (unit-js/40-resume.js), a landing pointer
   across parts, a screen pointer within a part, unit-level state for the chosen character, and
   the 'completed' ledger — which lives in the document and therefore survives tab closure. */
var RESUME_ENABLED = true;

/* ── The platform owns routing (2026-09-16, docs-and-tools/REPORT-XAPI.md §12) ──
   Kata launches each component on its own URL with its own ?registration, and routes on our
   'completed' statements. The unit therefore no longer moves between components by itself: the
   last-screen buttons report and stop, the first-screen "חזרה" is hidden, and the loader's resume
   hop is gone. The navigation code is kept for local walkthroughs behind this flag — and ONLY when
   the page was not launched by the platform: every Kata launch URL carries ?registration, and a hop
   in a real session would report the next component under this component's registration. So the
   flag is refused outright whenever ?registration is present, whatever else the URL says. */
var DEV_NAV = false;
try {
  var _devQ = new URLSearchParams(location.search);
  DEV_NAV = _devQ.get('dev') === '1' && !_devQ.has('registration');
} catch (e) {}
