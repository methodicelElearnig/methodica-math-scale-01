'use strict';
/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   Shared by all five components. Definition-only; ../unit-js/90-boot.js calls
   initResumeResetHatch() and initResumeLeaveHandlers(), and ../unit-js/50-loader.js drives the
   restore itself. Full design: docs-and-tools/RESUME.md.

   ── One document — but not "per unit" in Kata's model ──
   Verified against Documentation/KATA/KATA-API.md. Kata has NO concept of a unit-level state
   document. Its model is one opaque document per learner–component pair (KATA-API.md §3).

   What works, and why: the address is ?registration ALONE (or studentId+componentKey; sending
   both is a 400). The platform launches one component, and every cross-part navigation copies
   window.location.search verbatim — so all five parts present the same registration and in
   effect share THE DOCUMENT OF THE COMPONENT THAT WAS LAUNCHED (part 01). Kata permits this
   because it validates the address against the group's launches, not the calling component.

   ⚠️ Residual risk: if the platform ever deep-launches another part directly it gets a different
   registration → a different document → split progress. That is a question for the platform
   partner, not something this code can fence.

   (window.XAPI_UNIT_ID and RESUME_STATE_ID only dictate the localStorage fallback key, which
   comes into play when there is no valid ?slxapi.)

   ── Three facts from that document that bear directly on the code here ──
   • Durability: Kata "never acknowledges a write that wasn't durably saved". The true returned by
     saveState720 is a real promise, which is what justifies the !== false check in
     persistUnitState and the refusal to navigate back on a failed write.
   • Size: ~1MB ceiling (413 above it). This document is tiny — a screen pointer per part and two
     ledgers — so there is no concern.
   • Retention: ~12 months from the last update, after which GET returns 404. readUnitState treats
     404/null as "new document", so a learner returning after longer simply starts fresh.

   Per-part seams, all read at CALL time:
     capturePartPayload()   returns this component's payload, including currentScreen
     applyResumeVars(st)    restores answer variables — parameter MUST be named `st`
     applyResumeDom(st)     restores values that live only in the DOM
     restoreScreenUI(n)     repaints an answered screen; MUST stay exception-safe
   ═══════════════════════════════════════════════════════════════════ */

/* v4 (2026-09-01): added two classes of unit-level state — `ui` (the chosen character) and
   `results` (cross-part gate outcomes). Until v3 the character lived ONLY in localStorage, so a
   learner continuing the same registration from another machine got the wrong avatar in parts 01
   and 05. The document is now the source of truth and localStorage is a synchronous cache.

   The 3 → 4 jump discards existing documents (readUnitState throws away any v that is not the
   current one). That is deliberate and approved: this unit has never had a live Kata run, so the
   field is clean.

   ⚠️ Because of that, every ?v= on unit-js/*.js and on script.js in all five index.html MUST be
   bumped in the same commit — a stale cached 40-resume.js reading a v4 document deletes it, and a
   new script.js against a stale 40-resume.js calls setters that do not exist. */
var RESUME_STATE_VERSION = 4;
var RESUME_STATE_ID      = 'execution-state';

/* Not set until the first successful read (or its catch). Every write path checks it, so nothing
   is written before it is known what the document already holds. */
var _resumeReady         = false;

/* Set only inside applyExecutionState. Suppresses writes and the ledger — see there. */
var _restoring           = false;

/* Stops the leave handlers trampling a landing pointer written moments before a navigation. */
var _leavingToNextPart   = false;

/* The whole document, as last read or written. Never left null after readUnitState():
   sendCompletedOnce and captureUnitState both dereference it, and every one of their call sites
   sits inside a swallowing try/catch — a throw there would drop a real statement in silence. */
var _unitState           = null;

/* Set by initResumeResetHatch. The flag is needed because the hatch strips ?resetState from the
   URL at the very start of boot, while readUnitState runs later (after the library loads) — by
   which time a query-string check would find nothing. */
var _resetRequested      = false;

/* This component's slug, derived from the folder path. The folder names are the source of truth
   for this internal slug, and they are all lowercase — like the ids in metadata/.

   ⚠️ toLowerCase() is not cosmetic. The slug comes from location.pathname, i.e. from how the
   learner ARRIVED at the page. A URL differing only in case would produce a second key for the
   same part — two separate entries under parts[] — and from there: split progress, a `done`
   ledger that misses, and therefore a duplicate 'completed'. */
function currentPartSlug() {
  var p = window.location.pathname.replace(/\/index\.html.*$/, '').replace(/\/+$/, '');
  return (p.split('/').pop() || '').toLowerCase();
}

function itemLedgerKey(item) { return currentPartSlug() + '#' + item; }

/* ── The document ─────────────────────────────────────────────────── */

function emptyUnitState() {
  return {
    v: RESUME_STATE_VERSION,
    part: currentPartSlug(),   // which component the learner should land on
    parts: {},                 // slug → that component's payload (incl. currentScreen)
    prev:  {},                 // slug → {from, hash}: where it was entered from, back to which screen
    done:  {},                 // component slug (or 'unit') → its 'completed' has been sent
    doneItems: {},             // '<slug>#<itemId>' → that item's 'completed' has been sent
    hints: {},                 // '<itemId>/<qKey>' → that hint's 'requested.1' has been sent
    picks: {},                 // one-off learner choices whose 'selected' has been sent
    /* ── Unit-level state (v4) ──
       These two are NOT per part and therefore do not live in parts[]: captureUnitState replaces
       the current part's slot on every save, so anything parked there would be destroyed on the
       next part's first screen change. */
    ui:      { character: null },   // e.g. 'Character1' | 'text' | null — chosen on screen 0 of part 01
    results: {}                     // resultKey → outcome, for gates read across parts
  };
}

/* The localStorage keys that were the source of truth until v3 and are a synchronous cache from
   v4 on. Held in one list because two sites need it: the getters (fallback when there is no
   document) and initResumeResetHatch (a reset must clear the cache too).
   RESULT_KEYS is empty in this unit — every gate it routes on (getQuizScore,
   getBasicPracticeScore, getAdvancedPracticeScore) is derived from the part's own payload. The
   API is carried anyway so this file stays identical across units. */
var UI_CHARACTER_KEY = 'lomdaCharacter';
var RESULT_KEYS      = [];

/* Always returns a usable document. There is no migration — not from v2, not from v3. Any v that
   is not the current one is discarded, which is approved here because the field is clean. */
function readUnitState() {
  var doc = null;
  try {
    if (_resetRequested) {
      _unitState = emptyUnitState();
      persistUnitState(_unitState);
      console.log('[resume] state reset');
      return _unitState;
    }
    doc = (typeof window.loadState720 === 'function') ? window.loadState720(RESUME_STATE_ID) : null;
  } catch (e) { console.error('[resume] read', e); doc = null; }
  if (doc && doc.v !== RESUME_STATE_VERSION) doc = null;
  if (!doc) doc = emptyUnitState();
  doc.parts     = doc.parts     || {};
  doc.prev      = doc.prev      || {};
  doc.done      = doc.done      || {};
  doc.doneItems = doc.doneItems || {};
  doc.hints     = doc.hints     || {};
  doc.picks     = doc.picks     || {};
  /* These must be present objects rather than undefined: their EXISTENCE is what tells the
     getters "the document is the authority, do not fall back to localStorage". Without it a reset
     document would hand back the character from a stale cache — a reset that is not a reset. */
  doc.ui        = doc.ui        || { character: null };
  doc.results   = doc.results   || {};
  _unitState = doc;
  return doc;
}

/* REPLACES this part's slot rather than merging into it — a merge would leave stale keys alive.
   `part` is deliberately not touched: only writeForwardState and goBackToPreviousPart move the
   landing pointer. A save that reset it to the current slug would undo the one they just wrote,
   and the debounced timer left behind by the last goTo() would fire mid-navigation and bounce the
   learner straight back to the part they were leaving. */
function captureUnitState() {
  var doc = _unitState || emptyUnitState();
  doc.v = RESUME_STATE_VERSION;
  if (!doc.part) doc.part = currentPartSlug();
  doc.parts[currentPartSlug()] = capturePartPayload();
  _unitState = doc;
  return doc;
}

/* Re-arming the debounce BEFORE the synchronous write is what makes a handoff stick: the page
   stays alive while the next document loads, long enough for a stale timer to fire and clobber
   the write with a payload still naming THIS part. Returns whether the synchronous write landed —
   callers that are about to navigate need to know. */
function persistUnitState(doc) {
  var ok = false;
  try {
    if (typeof window.saveState720Debounced === 'function') window.saveState720Debounced(RESUME_STATE_ID, doc);
    /* !== false rather than a truthiness check: the library returns an explicit true/false on
       every path and never undefined. */
    if (typeof window.saveState720 === 'function') ok = (window.saveState720(RESUME_STATE_ID, doc) !== false);
    /* Diagnostics. Under -j a write failure was a single bit, so a run that failed against the
       platform could not be interpreted — 412 vs 413 (document over 1MB) vs 401 vs CORS all
       looked identical. -k adds stateLastResult720(); typeof-guarded so this unit still runs
       against -j, which does not have it. */
    if (!ok && typeof window.stateLastResult720 === 'function') {
      console.error('[resume] persist failed —', window.stateLastResult720());
    }
  } catch (e) { console.error('[resume] persist', e); ok = false; }
  return ok;
}

/* If the navigation ultimately does not happen (offline, 404, a cancelled unload) the page stays
   alive, so release the flag rather than leaving this part unable to save for the rest of the
   session. */
function armLeaving() {
  _leavingToNextPart = true;
  try { setTimeout(function () { _leavingToNextPart = false; }, 5000); } catch (e) {}
}

/* ── Unit-level state — character and cross-part results ─────────────
   ── Why there is a getter/setter layer at all ──
   Until v4 the character was read and written straight to localStorage in parts 01 and 05. That
   worked perfectly on one machine and broke completely on two: the Kata document did not carry
   it, so a learner continuing the same registration elsewhere got the wrong avatar. This layer
   moves the authority to the document.

   ── Read precedence, and why ──
   1. The document, if `ui`/`results` EXIST on it. Existence, not value: a reset document holds
      {character:null} and {}, and that must beat a stale cache — otherwise ?resetState is not a
      reset.
   2. localStorage, when there is no document at all — i.e. before resume has read (the
      synchronous path at the top of each script.js) or when resume is off entirely.

   ── And why localStorage is still written ──
   It became a synchronously readable cache rather than a source of truth. That is what holds the
   no-flash rule: window.lomdaState.selectedCharacter is set at the top of each script.js, before
   the first paint, while the document is still two CDN scripts away. */

/* A choice made before _resumeReady was set. A real window, not a theoretical one: the character
   picker is screen 0 of part 01 and the document only arrives after two CDN scripts. Without this
   queue the choice would never reach the document — nothing after it would write it. */
var _pendingProfile = null;
var _pendingResults = null;

/* localStorage throws SecurityError on an opaque origin (file://). All access goes through these
   so no call site has to handle it itself. */
function _lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
function _lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
function _lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

function getUnitCharacter() {
  if (_unitState && _unitState.ui) return _unitState.ui.character || null;
  return _lsGet(UI_CHARACTER_KEY);
}

function setUnitCharacter(c) {
  if (window.lomdaState) window.lomdaState.selectedCharacter = c;
  if (c) _lsSet(UI_CHARACTER_KEY, c); else _lsDel(UI_CHARACTER_KEY);
  if (!RESUME_ENABLED) return;
  if (!_resumeReady || !_unitState) { _pendingProfile = { character: c }; return; }
  _unitState.ui = _unitState.ui || {};
  _unitState.ui.character = c;
  /* Synchronous, not debounced: the learner clicks "continue" immediately after choosing, and a
     debounced write could fire after the navigation — the same reasoning as flushResumeSave. */
  try { persistUnitState(captureUnitState()); } catch (e) { console.error('[resume] character', e); }
}

function getUnitResult(key) {
  if (_unitState && _unitState.results) return _unitState.results[key] || null;
  return _lsGet(key);
}

function setUnitResult(key, val) {
  _lsSet(key, val);
  if (!RESUME_ENABLED) return;
  if (!_resumeReady || !_unitState) {
    _pendingResults = _pendingResults || {};
    _pendingResults[key] = val;
    return;
  }
  _unitState.results = _unitState.results || {};
  _unitState.results[key] = val;
  try { persistUnitState(captureUnitState()); } catch (e) { console.error('[resume] result', e); }
}

/* Called from ../unit-js/50-loader.js immediately after _resumeReady is set, and BEFORE
   applyUnitProfile. That order is what implements the precedence rule: a choice made in this
   session is newer than what the document says, so it wins. */
function drainPendingUnitState() {
  if (!_unitState) return;
  var dirty = false;
  if (_pendingProfile) {
    _unitState.ui = _unitState.ui || {};
    _unitState.ui.character = _pendingProfile.character;
    _pendingProfile = null;
    dirty = true;
  }
  if (_pendingResults) {
    _unitState.results = _unitState.results || {};
    Object.keys(_pendingResults).forEach(function (k) {
      _unitState.results[k] = _pendingResults[k];
    });
    _pendingResults = null;
    dirty = true;
  }
  if (dirty) {
    try { persistUnitState(captureUnitState()); } catch (e) { console.error('[resume] drain', e); }
  }
}

/* Aligns the in-memory character with the document. Returns whether anything changed — the caller
   needs that, because a screen already painted in the previous colour has to be repainted before
   the cover is dropped. Must NOT write to the document: loader phase A is read-only. */
function applyUnitProfile(doc) {
  if (!doc || !doc.ui) return false;
  var c = doc.ui.character || null;
  var cur = window.lomdaState ? (window.lomdaState.selectedCharacter || null) : null;
  if (c === cur) return false;
  if (window.lomdaState) window.lomdaState.selectedCharacter = c;
  if (c) _lsSet(UI_CHARACTER_KEY, c); else _lsDel(UI_CHARACTER_KEY);
  return true;
}

/* ── The boot cover ──────────────────────────────────────────────────
   #boot-cover sits in the markup of all five index.html (a SIBLING of #app, not a child — #app is
   moved and scaled by scaleApp) and is painted in the page background so it lands on the first
   frame. It hides the window in which screen 0 is already visible but the document has not been
   read yet.

   ⚠️ This is the one way this change could leave a learner facing a blank screen, so removal is
   centralised here, idempotent, and called from every exit path of 50-loader.js. Above it sits a
   safety net that depends on no JS file at all: a small inline script in the markup that removes
   the cover after 800ms — unless 50-loader.js has set window.__resumeInFlight, in which case it
   waits for the restore up to a hard 6-second ceiling. Even a 40-resume.js that failed to load
   cannot leave the cover in place: the flag is then simply never set, and the net removes it at
   800ms as before.

   Clearing the flag here rather than at the call sites: dropBootCover is already the point every
   exit path goes through, so "the cover is down" and "the restore is not in flight" stay
   together. */
function dropBootCover() {
  try { window.__resumeInFlight = false; } catch (e) {}
  try {
    var c = document.getElementById('boot-cover');
    if (c && c.parentNode) c.parentNode.removeChild(c);
  } catch (e) {}
}

/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every
   finished screen re-reachable, and the library's own dedupe only spans a single page load.

   Three orderings here are load-bearing:
   1. Bail out ENTIRELY while _restoring — neither send nor mark. applyExecutionState stubs the
      sender, so a mark taken there would permanently suppress a statement that never actually
      left. That is how part 05's unit 'completed' would go missing.
   2. FAIL OPEN, never closed. The ledger is obeyed only when it positively says "already sent".
      If the document is unavailable we send anyway: every call site swallows exceptions, and a
      silent drop is far worse than a duplicate.
   3. The mark is persisted SYNCHRONOUSLY right here. Some callers send without navigating
      afterwards, so nothing else would ever write it.

   'initialized' is never suppressed — the platform asks for it on every entry.

   sendStatementOnce carries these invariants for ANY verb; sendCompletedOnce is the 'completed'
   case of it. Hint requests go through the same path (xapiRequestedHint in 20-xapi.js), so a
   hint reported once stays reported across a reload, a cross-part hop and a tab close. */
function alreadySent(ledger, key) {
  return !!(_unitState && _unitState[ledger] && _unitState[ledger][key]);
}

function markSent(ledger, key) {
  if (!_unitState) return;
  _unitState[ledger] = _unitState[ledger] || {};
  _unitState[ledger][key] = true;
  try { persistUnitState(captureUnitState()); } catch (e) { console.error('[resume] ledger', e); }
}

/* Returns whether the key is SETTLED — either sent just now, or already in the ledger. false
   means the call was suppressed because a restore is in flight, so the caller must not latch
   anything of its own either (invariant 1). */
function sendStatementOnce(ledger, key, verb, objectType, result, opts) {
  if (_restoring) return false;
  if (alreadySent(ledger, key)) return true;
  sendStatement720(verb, objectType, result || null, opts);
  markSent(ledger, key);
  return true;
}

function sendCompletedOnce(ledger, key, objectType, result, opts) {
  sendStatementOnce(ledger, key, 'completed', objectType, result, opts);
}

/* ── Cross-part back edges ───────────────────────────────────────────
   ── Why this exists ──
   Part 03 is reachable from TWO places: from part 02 (the normal route) and from part 01 directly
   (when the learner clears the 4/5 threshold and skips part 02). A hard-coded back button would
   send the skipper into content they never saw.

   The solution is a MAP OF EDGES, not a stack: forward navigation writes the edge, back
   navigation only reads it. There is no invariant a partial write can break.

   ── Three layers, deliberately ──
   1. `prev` in the document — durable, survives tab closure, and the source of truth.
   2. The edge map in sessionStorage — available SYNCHRONOUSLY from the moment the script loads.
      Not redundant: the document only arrives after two CDN scripts and the metadata poll, and
      the back button is visible immediately. A learner clicking in that first second would
      otherwise fall through to the hard-coded fallback — exactly the bug the edges exist to fix.
   3. The hard-coded arguments — the pre-edges behaviour, for when neither layer is available
      (storage blocked, library never loaded).

   The edge also carries the target screen's hash, because the screen to return to differs by
   source (from part 01 the learner left screen 23; from part 02, screen 8).

   sessionStorage rather than localStorage in layer 2: the edge belongs to the current attempt. An
   edge left over from a previous attempt could route a learner down a path they did not take.

   ⚠️ NAV_EDGE_KEY must carry the unit slug. Two units sharing this key share a ledger and
   silently suppress each other's reports. */
var NAV_EDGE_KEY = 'lomda_nav_edges::methodica-math-scale-01';

function _readEdges() {
  try {
    var raw = window.sessionStorage.getItem(NAV_EDGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

/* Called by every forward navigator, immediately before navigating. writeForwardState calls it
   itself, so the two cannot come apart.
     destSlug    the destination's folder name
     returnHash  the hash that brings the learner back to the screen they left, e.g. '#screen=23' */
function recordForwardEdge(destSlug, returnHash) {
  try {
    var edges = _readEdges();
    edges[destSlug] = { from: currentPartSlug(), hash: returnHash || '' };
    window.sessionStorage.setItem(NAV_EDGE_KEY, JSON.stringify(edges));
  } catch (e) { /* storage blocked — the back button's fallback covers it */ }
}

/* The edge leading into the current part, by the precedence above. */
function _incomingEdge() {
  var here = currentPartSlug();
  var fromDoc = _unitState && _unitState.prev && _unitState.prev[here];
  if (fromDoc && fromDoc.from) return fromDoc;
  return _readEdges()[here] || null;
}

/* Resolving the edge to a URL. Deliberately separated from the navigation itself: it makes the
   decision testable without actually navigating — location.href cannot be stubbed in jsdom, and
   without this split the rule deciding where "back" leads would not be covered by tests at all. */
function previousPartHref(fallbackSlug, fallbackHash) {
  var edge = _incomingEdge();
  var slug = (edge && edge.from) || fallbackSlug;
  var hash = edge ? (edge.hash || '') : (fallbackHash || '');
  return '../' + slug + '/index.html' + window.location.search + hash;
}

/* Back navigation. Points the document at the destination BEFORE navigating — that is what stops
   the destination's loader seeing a mismatch and hopping straight back here (a ping-pong that
   re-sent 'completed' every cycle). If the write does not land, staying put is the safe failure. */
function goBackToPreviousPart(fallbackSlug, fallbackHash) {
  var href = previousPartHref(fallbackSlug, fallbackHash);
  var edge = _incomingEdge();
  var destSlug = (edge && edge.from) || fallbackSlug;

  if (RESUME_ENABLED && _resumeReady && destSlug) {
    var doc = captureUnitState();
    var here = doc.part;
    doc.part = destSlug;
    if (!persistUnitState(doc) && !persistUnitState(doc)) {
      console.error('[resume] back: state write failed, staying put');
      doc.part = here;
      return;
    }
    armLeaving();
  }
  /* replace(), not href: otherwise the browser's own Back would return the learner to the part
     they left, whose loader sees a different landing pointer and immediately hops forward — one
     Back press feels like the page is stuck. */
  window.location.replace(href);
}

/* Points the document at the component the learner is about to enter, so the next launch resumes
   forward instead of back into the part they just finished — and records the back edge.
   The departing part's payload is KEPT (captureUnitState runs first). That is the whole point:
   the back button restores the part the learner came from, and it cannot restore what was thrown
   away. An already-visited destination keeps its payload too, so going forward again resumes
   where the learner left off rather than replaying from screen 0. */
function writeForwardState(destSlug, returnHash) {
  /* Layer 2 always, even when resume is off or not ready — it is the behaviour that existed
     before this change, and the part code relies on it. */
  recordForwardEdge(destSlug, returnHash);
  if (!RESUME_ENABLED || !_resumeReady) return;
  var doc = captureUnitState();
  doc.part = destSlug;
  doc.prev[destSlug] = { from: currentPartSlug(), hash: returnHash || '' };
  if (!doc.parts[destSlug]) doc.parts[destSlug] = { currentScreen: 0 };
  persistUnitState(doc);
  armLeaving();
}

/* ── Painting an answered screen ─────────────────────────────────────
   goTo() in ../unit-js/30-nav.js repaints on every navigation (snapshot → resetScreenState →
   re-apply → paint). _repainting marks that window so callers can tell "the painter is
   re-showing existing feedback" from "this is new feedback from a live learner action" — the two
   need different behaviour anywhere a side effect is tied to showing feedback. */
var _repainting = false;

function resumeIsPainting() { return _restoring || _repainting; }

function beginRepaint() { _repainting = true; }
function endRepaint()   { _repainting = false; }

/* ── When state is written ───────────────────────────────────────────
   All of these bail out if resume is off, if there has not yet been a successful read, or during
   a restore — so nothing is written during a replay and nothing is written before the read. */

/* Screen change — the choke point. Debounced: bounds the loss to a single screen. */
function scheduleResumeSave() {
  if (!RESUME_ENABLED || !_resumeReady || _restoring) return;
  if (typeof window.saveState720Debounced !== 'function') return;
  try { window.saveState720Debounced(RESUME_STATE_ID, captureUnitState()); } catch (e) {}
}

/* Answer commitment / completion — synchronous.
   Why not debounced: goTo(n) arms a debounced save; the learner clicks "continue" 200ms later;
   the routing function writes the destination blob and navigates — but the page stays alive while
   the next document loads, long enough for the stale timer to fire AFTER the forward write. The
   next launch would come back into the part that was just finished.

   ⚠️ Contract: a function that commits an answer must flush, and no `return` may sit between the
   commitment and the flush. _test/verify-report.js asserts this statically. */
function flushResumeSave() {
  if (!RESUME_ENABLED || !_resumeReady || _restoring) return;
  if (typeof window.saveState720 !== 'function') return;
  try { window.saveState720(RESUME_STATE_ID, captureUnitState()); } catch (e) {}
}

/* Leaving the page. beforeunload alone is not enough: it never fires when a mobile tab is
   backgrounded and then killed, which is exactly how a learner leaves mid-lesson. */
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

/* ── QA escape hatch ─────────────────────────────────────────────────
   Off-platform there is no ?registration, so the library's localStorage fallback keys every local
   run to the SAME document — after one pass the ledger is full and no 'completed' is ever emitted
   again, which reads as a catastrophic regression to whoever tests next. ?resetState starts from
   a clean slate.

   It strips itself from the URL: every cross-part navigation copies window.location.search
   verbatim, so left in place it would re-fire on every hop and resume would never work. The strip
   must happen before anything reads the query, which is why 90-boot.js calls this FIRST; the
   _resetRequested flag carries the intent through to readUnitState, which runs later once the URL
   is already clean.

   It clears the cache too, not only the document. The getters fall back to localStorage when
   there is no document — i.e. exactly on the synchronous path at the top of each script.js,
   before readUnitState. Without this, ?resetState would leave the previous run's character alive
   until the document arrived, and a reset that leaves state behind is not a reset. */
function initResumeResetHatch() {
  if (!/[?&]resetState(=|&|$)/.test(window.location.search)) return;
  _resetRequested = true;
  try { window.sessionStorage.removeItem(NAV_EDGE_KEY); } catch (e) {}
  _lsDel(UI_CHARACTER_KEY);
  RESULT_KEYS.forEach(_lsDel);
  try {
    var q = window.location.search
      .replace(/([?&])resetState(=[^&]*)?(&|$)/, '$1')
      .replace(/[?&]$/, '');
    history.replaceState(null, '', window.location.pathname + q + window.location.hash);
  } catch (e) {}
  console.log('[resume] reset requested');
}
