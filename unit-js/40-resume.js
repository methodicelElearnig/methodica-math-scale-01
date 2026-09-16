'use strict';
/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   Shared by all five components. Definition-only; ../unit-js/90-boot.js calls
   initResumeResetHatch() and initResumeLeaveHandlers(), and ../unit-js/50-loader.js drives the
   restore itself. Full design: docs-and-tools/RESUME.md.

   ── One document per {learner, component} — Kata's model, and since v5 ours ──
   Verified against Documentation/KATA/KATA-API.md and Kata's own note (2026-09-16): the
   registration our content saves State under is a {user, component} pair — for one learner every
   component of the unit has a DIFFERENT registration, hence a different document. The address is
   ?registration ALONE (or studentId+componentKey; sending both is a 400). The platform launches
   each component on its own (POST /launcher/context takes one componentId and returns one
   registrationId), and since 2026-09-16 no part navigates to another or copies its query along —
   so every part reads and writes ITS OWN document, nothing else.

   v5 (2026-09-16): the document itself now matches. No more `part` (landing pointer), `prev`
   (back edges) or `parts{}` (every part's payload) — instead `component` (whose document this is)
   and `payload` (this part's). A document whose `component` is not the current part is
   discarded with console.warn: one registration shared by two components would be a platform-side
   fault, and another part's payload is never applied.

   The platform may CLEAR one component's State on a repeat entry (a re-take of an assessment
   component). An absent document (404) is therefore "a fresh attempt": no payload, an empty
   `done` ledger (the completed goes out again — intended), and an empty `results` section that
   beats the localStorage cache of the previous attempt (read precedence in the getters).

   (window.XAPI_UNIT_ID and RESUME_STATE_ID only dictate the localStorage fallback key, which
   comes into play when there is no valid ?slxapi. RESUME_STATE_ID carries the part slug so that
   fallback is one document per part as well — without it a ?dev=1 walk from 01 to 02 read 01's
   document in 02.)

   ── Three facts from that document that bear directly on the code here ──
   • Durability: Kata "never acknowledges a write that wasn't durably saved". The true returned by
     saveState720 is a real promise, which is what justifies the !== false check in
     persistUnitState.
   • Size: ~1MB ceiling (413 above it). This document is tiny — one part's payload and four
     ledgers — so there is no concern.
   • Retention: ~12 months from the last update, after which GET returns 404. readUnitState treats
     404/null as "new document", so a learner returning after longer simply starts fresh.

   Per-part seams, all read at CALL time:
     capturePartPayload()   returns this component's payload, including currentScreen
     applyResumeVars(st)    restores answer variables — parameter MUST be named `st`
     applyResumeDom(st)     restores values that live only in the DOM
     restoreScreenUI(n)     repaints an answered screen; MUST stay exception-safe
   ═══════════════════════════════════════════════════════════════════ */

/* v4 (2026-09-01): added `ui` (the chosen character) and `results`. Until v3 the character lived
   ONLY in localStorage, so a learner continuing the same registration from another machine got the
   wrong avatar. The document is the source of truth and localStorage a synchronous cache.

   v5 (2026-09-16): one document per part — `component` + `payload` instead of
   `part`/`parts{}`/`prev{}` (see the header). There IS a migration from v4 (migrateState):
   payload = parts[this part's slug]; the four ledgers, the character and the results are kept as
   they are. Any other v is discarded. A learner mid-part on upload day loses nothing.

   ⚠️ Even so, every ?v= on unit-js/*.js and on script.js in all five index.html MUST be bumped in
   the same commit — a stale cached 40-resume.js reading a v5 document deletes it, and a new
   script.js against a stale 40-resume.js calls setters that do not exist. */
var RESUME_STATE_VERSION = 5;
/* Carries the slug: the localStorage fallback key (and the library's debounce map) is per part.
   currentPartSlug is a function declaration below — hoisted. */
var RESUME_STATE_ID      = 'execution-state::' + currentPartSlug();

/* Not set until the first successful read (or its catch). Every write path checks it, so nothing
   is written before it is known what the document already holds. */
var _resumeReady         = false;

/* Set only inside applyExecutionState. Suppresses writes and the ledger — see there. */
var _restoring           = false;

/* Stops the leave handlers trampling the save written moments before a (DEV_NAV-only) navigation. */
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
   learner ARRIVED at the page. A URL differing only in case would not match the document's
   `component` (discarded as "another part's") and would key the ledger differently — and from
   there: vanished progress, a `done` ledger that misses, and therefore a duplicate 'completed'. */
function currentPartSlug() {
  var p = window.location.pathname.replace(/\/index\.html.*$/, '').replace(/\/+$/, '');
  return (p.split('/').pop() || '').toLowerCase();
}

function itemLedgerKey(item) { return currentPartSlug() + '#' + item; }

/* ── The document ─────────────────────────────────────────────────── */

function emptyUnitState() {
  return {
    v: RESUME_STATE_VERSION,
    component: currentPartSlug(),  // whose document this is — checked on every read; another part's is discarded
    payload: null,                 // capturePartPayload() of THIS part (incl. currentScreen)
    done:  {},                     // component slug → its 'completed' has been sent
    doneItems: {},                 // '<slug>#<itemId>' → that item's 'completed' has been sent
    hints: {},                     // '<itemId>/<qKey>' → that hint's 'requested.1' has been sent
    picks: {},                     // one-off learner choices whose 'selected' has been sent
    /* ── `ui` and `results` — this part's own copy ──
       They sit BESIDE the payload, not inside it: captureUnitState replaces the payload on every
       save. The character is chosen in part 01 and reaches the later parts through the same-browser
       localStorage mirror (adoptUnitCharacter copies it into this part's document on first entry). */
    ui:      { character: null },   // e.g. 'Character1' | 'text' | null
    results: {}                     // resultKey → outcome; empty in this unit (gates derive from the payload)
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

/* One-step migration only (v4 → v5), mechanical and jsdom-testable. A current-version document
   comes back as is; any other version → null (discarded). */
function migrateState(old) {
  if (!old) return null;
  if (old.v === RESUME_STATE_VERSION) return old;
  if (old.v !== RESUME_STATE_VERSION - 1) return null;
  var slug = currentPartSlug();
  return {
    v: RESUME_STATE_VERSION,
    component: slug,
    payload: (old.parts && old.parts[slug]) || null,
    done: old.done || {},
    doneItems: old.doneItems || {},
    hints: old.hints || {},
    picks: old.picks || {},
    ui: old.ui || { character: null },
    results: old.results || {}
  };
}

/* Always returns a usable document. A v4 document is migrated; another part's document (component
   mismatch) is discarded with a warning — one registration shared by two components is a platform
   fault, and a foreign payload is never applied; 404/null = a fresh attempt (see the header). */
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
  doc = migrateState(doc);
  if (doc && doc.component && doc.component !== currentPartSlug()) {
    console.warn('[resume] document belongs to "' + doc.component + '", not "' + currentPartSlug() + '" — discarded');
    doc = null;
  }
  if (!doc) doc = emptyUnitState();
  doc.component = currentPartSlug();
  doc.payload   = doc.payload   || null;
  doc.done      = doc.done      || {};
  doc.doneItems = doc.doneItems || {};
  doc.hints     = doc.hints     || {};
  doc.picks     = doc.picks     || {};
  /* These must be present objects rather than undefined: their EXISTENCE is what tells the
     getters "the document is the authority, do not fall back to localStorage". Without it a reset
     document (or one the platform cleared for a re-take) would hand back the character from a
     stale cache — a reset that is not a reset. */
  doc.ui        = doc.ui        || { character: null };
  doc.results   = doc.results   || {};
  _unitState = doc;
  return doc;
}

/* REPLACES the payload rather than merging into it — a merge would leave stale keys alive. */
function captureUnitState() {
  var doc = _unitState || emptyUnitState();
  doc.v = RESUME_STATE_VERSION;
  doc.component = currentPartSlug();
  doc.payload = capturePartPayload();
  _unitState = doc;
  return doc;
}

/* Re-arming the debounce BEFORE the synchronous write is what makes a handoff stick: the page
   stays alive while the next document loads, long enough for a stale timer to fire and clobber
   the write with a payload still naming THIS part. Returns whether the synchronous write landed. */
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

/* Called from ../unit-js/50-loader.js immediately after _resumeReady is set (phase B). A choice
   made in this session is newer than what the document says, so it wins; the same queue carries
   the character adoptUnitCharacter copied from the mirror in phase A. */
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

/* The character on entering a part — four steps (decision 2026-09-16): (1) this part's document;
   (2) if null — the localStorage mirror (the choice made in part 01 on this browser); (3) if found —
   copied into this part's document: onto doc directly, so getUnitCharacter returns it between
   phase A and phase B, and into the _pendingProfile queue, so drainPendingUnitState persists it in
   phase B (phase A still never writes); (4) if neither — the caller keeps the default.

   NEVER deletes the mirror. Its predecessor (applyUnitProfile) read a null ui.character as "no
   character", nulled the in-memory value and deleted the mirror — and under one document per part
   every part >= 02 opens with null, so the character was lost on every Kata launch, and with the
   mirror gone, for every part after it too. A reset (?resetState) adopts nothing.

   Returns whether anything changed — a screen already painted in the previous colour has to be
   repainted before the cover is dropped. */
function adoptUnitCharacter(doc) {
  var c = (doc && doc.ui && doc.ui.character) || null;
  if (!c && !_resetRequested) {
    c = _lsGet(UI_CHARACTER_KEY);
    if (c && doc) {
      doc.ui = doc.ui || {};
      doc.ui.character = c;
      _pendingProfile = { character: c };
    }
  }
  var cur = window.lomdaState ? (window.lomdaState.selectedCharacter || null) : null;
  if (c) {
    if (window.lomdaState) window.lomdaState.selectedCharacter = c;
    _lsSet(UI_CHARACTER_KEY, c);
  }
  return c !== cur;
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

/* ── Holding the cover until the active screen's images are actually ready ──
   dropBootCover() above stays synchronous: every error path needs the cover down NOW, and
   _test/verify-report.js calls it and asserts on the next line that the cover is gone. This is the
   NORMAL-path variant.

   Why it exists: 50-loader.js dropped the cover in the SAME synchronous task in which
   resetScreenState() had assigned the avatar's src. Assigning src does not repaint — it STARTS a
   download — so the cover lifted over an <img> still compositing its previous, wrong frame. The
   comment at 50-loader.js:142 ("repaint here, behind the cover, before it is removed") described
   an intention the code could not keep. This makes it true.

   ⚠️ This is the one function in the unit that can leave a learner facing a blank white page, so
   it fails OPEN in every direction: a 404, a hung connection, no active screen, an exception while
   collecting the images — all of them land on dropBootCover() regardless. The ceiling is armed
   FIRST, before anything that can throw.

   1200ms, well under the markup safety net's own ceiling: the net is the last resort and must
   never be the thing that rescues the normal path. If the images are not in by then the learner
   sees the screen with holes in it — the same outcome as before this change, and strictly better
   than more white. */
var BOOT_COVER_IMG_WAIT_MS = 1200;

function dropBootCoverWhenPainted() {
  var done = false;
  function finish() { if (done) return; done = true; dropBootCover(); }

  try { setTimeout(finish, BOOT_COVER_IMG_WAIT_MS); } catch (e) { finish(); return; }

  try {
    var scr = document.querySelector('.screen.active');
    if (!scr) { finish(); return; }

    var pending = [];
    scr.querySelectorAll('img').forEach(function (im) {
      /* .complete is already true for a decoded image and for one with no src at all.
         getClientRects() is empty inside a display:none subtree — the zoom overlays and the
         hidden character widgets must not add their download to every learner's wait.
         (getClientRects, not offsetParent: offsetParent is null for position:fixed.) */
      if (!im.complete && im.getAttribute('src') && im.getClientRects().length) pending.push(im);
    });
    if (!pending.length) { finish(); return; }

    var left = pending.length;
    pending.forEach(function (im) {
      /* addEventListener, NOT im.onload — setImgSrc owns those two properties on these very
         elements, and assigning them here would silently cancel its reveal and leave the avatar
         at opacity 0 forever. */
      function settle() {
        im.removeEventListener('load', settle);
        im.removeEventListener('error', settle);
        if (--left <= 0) finish();
      }
      im.addEventListener('load', settle);
      im.addEventListener('error', settle);   /* a 404 must not hold the cover */
    });
  } catch (e) { finish(); }
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

   ── One layer + a fallback (all of it DEV_NAV-only since 2026-09-16) ──
   1. The edge map in sessionStorage — available SYNCHRONOUSLY from the moment the script loads.
   2. The hard-coded arguments — for when storage is blocked or no edge exists.
   The document tier (`prev`) went with the landing pointer in v5: the document belongs to one
   part and has nothing to point at. The navigation itself runs only under DEV_NAV
   (10-identity.js); in production the platform launches each component on its own.

   The edge also carries the target screen's hash, because the screen to return to differs by
   source (from part 01 the learner left screen 23; from part 02, screen 8).

   sessionStorage rather than localStorage: the edge belongs to the current attempt. An
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

/* The edge leading into the current part — from the sessionStorage map only. */
function _incomingEdge() {
  return _readEdges()[currentPartSlug()] || null;
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

/* Back navigation — DEV_NAV only. Saves this part synchronously (so the ?dev=1 walk resumes it
   where it stood) and navigates. There is no landing pointer to write any more, hence no write
   that could fail and hold the learner in place.
   Since 2026-09-16 the platform owns routing (REPORT-XAPI.md §12): outside a local walkthrough
   (DEV_NAV, 10-identity.js) this is a no-op. The button is hidden too, by hideCrossPartBack() —
   belt and braces, because the control can still be reached from a stale DOM or by keyboard. */
function goBackToPreviousPart(fallbackSlug, fallbackHash) {
  if (!DEV_NAV) return;
  var href = previousPartHref(fallbackSlug, fallbackHash);
  if (RESUME_ENABLED && _resumeReady) {
    flushResumeSave();
    armLeaving();
  }
  /* replace(), not href: the browser's own Back need not return to the part just left. */
  window.location.replace(href);
}

/* Production hides the first-screen "חזרה" (#back-to-prev-part, parts 02–05): the platform routes,
   and the learner never moves between parts from inside one. Called from 90-boot.js. Under DEV_NAV
   the button stays, resolved by the edge map and the fallback above. */
function hideCrossPartBack() {
  if (DEV_NAV) return;
  var b = document.getElementById('back-to-prev-part');
  /* Inline display:none as well as the attribute: the button's own rule (.btn-back-s3 { display:flex })
     is an author rule and beats the UA's [hidden] { display:none } — seen live on 16/09, the
     button stayed on screen with hidden === true. */
  if (b) { b.hidden = true; b.style.display = 'none'; b.setAttribute('aria-hidden', 'true'); }
}

/* Records the back edge and saves the part being left — DEV_NAV only (every caller sits inside an
   `if (DEV_NAV)` block). No landing pointer and no seeding of the destination any more: the
   destination's document is another part's. */
function writeForwardState(destSlug, returnHash) {
  /* The edge map always, even when resume is off or not ready — the part code relies on it. */
  recordForwardEdge(destSlug, returnHash);
  if (!RESUME_ENABLED || !_resumeReady) return;
  flushResumeSave();
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

   It strips itself from the URL: left in place it would re-fire on every reload and resume
   would never work. The strip
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
