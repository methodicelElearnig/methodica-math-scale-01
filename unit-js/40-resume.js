'use strict';
/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   Shared by all five components. Definition-only; 90-boot.js calls initResumeLeaveHandlers()
   and ../unit-js/50-loader.js drives the restore. Full design: ../RESUME.md.

   ONE State document per unit, keyed by window.XAPI_UNIT_ID. Kata addresses state by
   ?registration alone, and the launch registration rides through every cross-part navigation on
   window.location.search — which is what lets five components share one document.

   Per-part seams, all read at CALL time:
     capturePartPayload()   returns this component's payload, including currentScreen
     applyExecutionState()  replays a payload onto this component (still per-part until 30-nav)
   ═══════════════════════════════════════════════════════════════════ */

var RESUME_STATE_VERSION = 3;
var RESUME_STATE_ID      = 'execution-state';
var _resumeReady         = false;
var _restoring           = false;
var _leavingToNextPart   = false;

/* The whole v3 document, as last read or written. All five parts share ONE document: Kata
   addresses state by ?registration alone, and the launch registration rides through every
   cross-part navigation on window.location.search. v2 kept a single part's payload and threw the
   rest away on handoff; v3 keeps every part's, because the back button has to restore them. */
var _unitState = null;

/* Forward order of the unit. Only the v2→v3 migration reads it. */
var RESUME_PART_CHAIN = [
  'methodica-math-scale-01-01',
  'methodica-math-scale-01-02',
  'methodica-math-scale-01-03',
  'methodica-math-scale-01-04',
  'methodica-math-scale-01-05'
];

function currentPartSlug() {
  var p = window.location.pathname.replace(/\/index\.html.*$/, '').replace(/\/+$/, '');
  return p.split('/').pop() || '';
}

function emptyUnitState() {
  return {
    v: RESUME_STATE_VERSION,
    part: currentPartSlug(),   // which component the learner should land on
    parts: {},                 // slug → that component's payload (incl. currentScreen)
    prev:  {},                 // slug → the component the learner entered it FROM
    done:  {},                 // component slug (or 'unit') → its 'completed' has been sent
    doneItems: {}              // '<slug>#<itemId>' → that item's 'completed' has been sent
  };
}

/* A v2 document holds one part's payload and no ledger. Discarding it — which the bare version
   check used to do — would restart the learner at part 01 with an empty ledger, so every
   'completed' they already earned would be reported a second time. Wrap it instead, and seed the
   ledger from the chain: a learner sitting in part N demonstrably finished the parts before it.
   `prev` stays empty on purpose. A v2 document does not record which way the learner came into
   part 03, and guessing would send them back to a part they never opened; the back button simply
   stays hidden until they traverse a real forward edge. Item marks cannot be recovered, so a
   migrating learner may re-send one round of item 'completed'. */
function migrateV2(old) {
  var doc = emptyUnitState();
  doc.part = old.part || currentPartSlug();
  doc.parts[doc.part] = old;
  var i = RESUME_PART_CHAIN.indexOf(doc.part);
  for (var k = 0; k < i; k++) doc.done[RESUME_PART_CHAIN[k]] = true;
  return doc;
}

/* Always returns a usable document. _unitState must never be left null: sendCompletedOnce and
   captureUnitState both dereference it, and every one of their call sites sits inside a swallowing
   try/catch — a throw there would drop a real statement in silence. */
function readUnitState() {
  var doc = null;
  try {
    /* QA escape hatch. Off-platform there is no ?registration, so the library's localStorage
       fallback keys every local run to the SAME document — after one pass the ledger is full and
       no 'completed' is ever emitted again, which reads as a catastrophic regression to whoever
       tests next. ?resetState starts from a clean document. */
    if (/[?&]resetState(=|&|$)/.test(window.location.search)) {
      /* One-shot. Every cross-part navigation copies window.location.search verbatim, so left in
         place this would re-fire on arrival in the next component and wipe the document on every
         hop — resume would never work at all. Strip it before anything else reads the query. */
      try {
        var _q = window.location.search
          .replace(/([?&])resetState(=[^&]*)?(&|$)/, '$1')
          .replace(/[?&]$/, '');
        history.replaceState(null, '', window.location.pathname + _q + window.location.hash);
      } catch (e) {}
      _unitState = emptyUnitState();
      persistUnitState(_unitState);
      return _unitState;
    }
    doc = (typeof window.loadState720 === 'function') ? window.loadState720(RESUME_STATE_ID) : null;
  } catch (e) { console.error('[resume] read', e); doc = null; }
  if (doc && doc.v === 2 && doc.part) doc = migrateV2(doc);
  if (doc && doc.v !== RESUME_STATE_VERSION) doc = null;   // older shape still: discard
  if (!doc) doc = emptyUnitState();
  doc.parts     = doc.parts     || {};
  doc.prev      = doc.prev      || {};
  doc.done      = doc.done      || {};
  doc.doneItems = doc.doneItems || {};
  _unitState = doc;
  return doc;
}

/* REPLACES this part's slot rather than merging into it — a merge would leave stale keys alive.
   `part` is deliberately not touched: only writeForwardState and goBackToPrevPart move the landing
   pointer. A save that reset it to the current slug would undo the one they just wrote, and the
   debounced timer left behind by the last goTo() would fire mid-navigation and bounce the learner
   straight back to the part they were leaving. */
function captureUnitState() {
  var doc = _unitState || emptyUnitState();
  doc.v = RESUME_STATE_VERSION;
  if (!doc.part) doc.part = currentPartSlug();
  doc.parts[currentPartSlug()] = capturePartPayload();
  _unitState = doc;
  return doc;
}

/* Re-arming the debounce BEFORE the synchronous write is what makes a handoff stick: the page
   stays alive while the next document loads, long enough for a stale timer to fire and clobber the
   write with a payload still naming THIS part. Returns whether the synchronous write landed —
   callers that are about to navigate need to know. */
function persistUnitState(doc) {
  var ok = false;
  try {
    if (typeof window.saveState720Debounced === 'function') window.saveState720Debounced(RESUME_STATE_ID, doc);
    if (typeof window.saveState720 === 'function') ok = (window.saveState720(RESUME_STATE_ID, doc) !== false);
  } catch (e) { console.error('[resume] persist', e); ok = false; }
  return ok;
}

/* _leavingToNextPart stops the leave handlers overwriting the pointer we just wrote. If the
   navigation never happens (offline, 404, a cancelled unload) the page stays alive, so release it
   rather than leaving this part unable to save for the rest of the session. */
function armLeaving() {
  _leavingToNextPart = true;
  try { setTimeout(function () { _leavingToNextPart = false; }, 5000); } catch (e) {}
}

/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every finished
   screen re-reachable, and the library's dedupe only spans a single page load. `initialized` is
   deliberately NOT guarded: the platform asks for it on every entry.

   Three orderings here are load-bearing. During a restore we neither send nor mark:
   applyExecutionState stubs the sender, so a mark made there would permanently suppress a
   statement that never actually left — that is how part 05's unit 'completed' would go missing.
   The ledger is obeyed only when it positively says "already sent"; if the document is
   unavailable we send anyway, because every call site swallows exceptions and a silent drop is far
   worse than a duplicate. And the mark is persisted synchronously right here, because two callers
   (part 02's below-threshold branch, part 05's finale) send without navigating afterwards, so
   nothing else would ever write it. */
function alreadySent(ledger, key) {
  return !!(_unitState && _unitState[ledger] && _unitState[ledger][key]);
}
function markSent(ledger, key) {
  if (!_unitState) return;
  _unitState[ledger] = _unitState[ledger] || {};
  _unitState[ledger][key] = true;
  try { persistUnitState(captureUnitState()); } catch (e) { console.error('[resume] ledger', e); }
}
function sendCompletedOnce(ledger, key, objectType, result, opts) {
  if (_restoring) return;
  if (alreadySent(ledger, key)) return;
  sendStatement720('completed', objectType, result || null, opts);
  markSent(ledger, key);
}
function itemLedgerKey(item) { return currentPartSlug() + '#' + item; }

/* ── Cross-part back ─────────────────────────────────────────────────
   The first screen of parts 02–05 offers "חזרה" back into the component the learner actually came
   from. `prev` is a map of back-edges, not a stack: forward navigation writes prev[dest], back
   navigation only reads it. There is no invariant a partial write can break, and part 03 — which
   is reachable from both 01 and 02 — resolves correctly because whichever router navigated is the
   one that wrote the edge. */
function previousPartSlug() {
  return (_unitState && _unitState.prev && _unitState.prev[currentPartSlug()]) || null;
}

function goBackToPrevPart() {
  var prevSlug = previousPartSlug();
  if (!prevSlug) return;
  var doc = captureUnitState();
  var here = doc.part;
  doc.part = prevSlug;
  /* Pointing the document at the destination BEFORE navigating is what stops its loader seeing a
     mismatch and hopping straight back here. If the write does not land, staying put is the safe
     failure — navigating anyway produces exactly that ping-pong, re-sending 'completed' each
     cycle. */
  if (!persistUnitState(doc) && !persistUnitState(doc)) {
    console.error('[resume] back: state write failed, staying put');
    doc.part = here;
    return;
  }
  armLeaving();
  /* replace(), not href: matches the forward hop and keeps the abandoned part out of the
     back-stack, where the browser's own Back would land on a URL that just redirects forward. */
  window.location.replace('../' + prevSlug + '/index.html' + window.location.search);
}

/* The markup ships the button hidden — _unitState only arrives after two CDN scripts and the
   metadata poll, so anything visible before then would flash and vanish, and if the library never
   loads at all then hidden is the correct answer anyway. */
function syncBackButton() {
  try {
    var btn = document.getElementById('back-to-prev-part');
    if (btn) btn.hidden = !previousPartSlug();
  } catch (e) {}
}

/* Points the document at the component the learner is about to enter, so the next launch resumes
   forward instead of back into the part they just finished — and records the back-edge so that
   part's first screen knows where "חזרה" leads.
   Unlike v2 this KEEPS the departing part's answers (captureUnitState writes them first). That is
   the whole point: the back button restores the part the learner came from, and it cannot restore
   what was thrown away. An already-visited destination keeps its payload too, so going forward
   again resumes where the learner left off rather than replaying from screen 0. */
function writeForwardState(destSlug) {
  var doc = captureUnitState();
  doc.part = destSlug;
  doc.prev[destSlug] = currentPartSlug();
  if (!doc.parts[destSlug]) doc.parts[destSlug] = { currentScreen: 0 };
  persistUnitState(doc);
  armLeaving();
}

function scheduleResumeSave() {
  if (!RESUME_ENABLED || !_resumeReady || _restoring) return;
  if (typeof window.saveState720Debounced !== 'function') return;
  try { window.saveState720Debounced(RESUME_STATE_ID, captureUnitState()); } catch (e) {}
}

function flushResumeSave() {
  if (!RESUME_ENABLED || !_resumeReady || _restoring) return;
  if (typeof window.saveState720 !== 'function') return;
  try { window.saveState720(RESUME_STATE_ID, captureUnitState()); } catch (e) {}
}

/* beforeunload alone is not enough: it never fires when a mobile tab is backgrounded and then
   killed, which is exactly how a learner leaves mid-lesson. pagehide and a hidden
   visibilitychange cover that. */
function flushResumeSaveOnLeave() {
  if (_leavingToNextPart) return;
  flushResumeSave();
}

/* Registered from ../unit-js/90-boot.js. */
function initResumeLeaveHandlers() {
  window.addEventListener('beforeunload', flushResumeSaveOnLeave);
  window.addEventListener('pagehide', flushResumeSaveOnLeave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushResumeSaveOnLeave();
  });
}
