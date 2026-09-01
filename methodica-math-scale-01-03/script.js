'use strict';

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT 03 — off-computer class task.

   Identity, viewport scaling, the report modal, the resume core, the xAPI helpers and the loader
   all live in ../unit-js/, loaded by index.html BEFORE this file. See unit-js/README.md for the
   hook contract; what remains below is this component's own configuration and screen logic.
   ═══════════════════════════════════════════════════════════════════ */

var TOTAL_SCREENS = 3;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
/* Read through the shared getter: from v4 the Kata state document is the source of truth for
   the character and localStorage is only a synchronous cache (unit-js/40-resume.js). This runs
   before the first paint, while the document is still two CDN scripts away, so the cache is
   what the getter returns here — the document overrides it in loader phase A.
   typeof-guarded so a shared file that failed to load degrades to the old cache-only
   behaviour rather than throwing at top level and killing the rest of this script. */
const _savedChar = (typeof getUnitCharacter === 'function')
  ? getUnitCharacter()
  : localStorage.getItem('lomdaCharacter');
if (_savedChar) window.lomdaState.selectedCharacter = _savedChar;

/* Final assessment tracking (screens 43-52) */
let finalAssessmentScore = { correct: 0 };

let frcRevealed = [false, false, false];
let frcDone = false;

let s4VideoEnded = false;
let s4Playing = false;
let s4Timer = null;

let s7Timer = null;
let s8Timer = null;


function resetScreenState(n) {
  if (n === 0) { s24Enter(); }
  if (n === 1) { s34Enter(); }
  if (n === 2) { s35Enter(); }
}


/* ── Screen 24 ── */
function s24Enter() {
  var charImg = document.getElementById('s24-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
  }
}


/* ── Screen 35 ── */
function s35Enter() {
  var input = document.getElementById('s35-input');
  if (input) input.value = '';
  var widget = document.getElementById('s35-char-widget');
  if (widget) widget.classList.add('hidden');
  var cont = document.getElementById('s35-continue');
  if (cont) cont.disabled = true;
  var charImg = document.getElementById('s35-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
  }
}

function s35OnInput() {
  var val = document.getElementById('s35-input').value.trim();
  var hasText = val.length > 0;
  var widget = document.getElementById('s35-char-widget');
  if (widget) widget.classList.toggle('hidden', !hasText);
  var cont = document.getElementById('s35-continue');
  if (cont) cont.disabled = !hasText;
}

/* ── Screen 34 ── */
function s34Enter() {
  var charImg = document.getElementById('s34-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
  }
}

/* ════════════════════════════════════════════
   Screen 39 — Drag-and-Drop
   ════════════════════════════════════════════ */

var DDQ = {
  correctMap: {
    'target-lior-orech':  'drag-60',
    'target-lior-gova':   'drag-30',
    'target-yuval-orech': 'drag-24',
    'target-yuval-gova':  'drag-12'
  },
  revealMap: {
    'target-lior-orech':  'drag-60',
    'target-lior-gova':   'drag-30',
    'target-yuval-orech': 'drag-24',
    'target-yuval-gova':  'drag-12'
  }
};

var ddqPlacement = {
  'drag-6': 'source', 'drag-12': 'source', 'drag-15': 'source',
  'drag-24': 'source', 'drag-30': 'source', 'drag-48': 'source',
  'drag-60': 'source'
};
var ddqDragActive  = null;
var ddqDropHandled = false;
var ddqChecked     = false;
var ddqDone        = false;
var ddqAttempts    = 0;


/* ── Cross-folder navigation ── */
function goToAdvanced() {
  /* xAPI: this component is the off-computer class task — the catalog gives it no questions
     (isAssessment: false), so 'completed' carries success but no score: there is nothing to
     grade, only to finish. */
  xapiCompleteComponent({ success: true });
  /* Resume: point the state document at the component being entered, before navigating. */
  writeForwardState('methodica-math-scale-01-04', '#screen=2');
  window.location.href = '../methodica-math-scale-01-04/index.html' + window.location.search;
}

/* ── Per-part boot hook ──
   Called by ../unit-js/90-boot.js, which is the single place side effects are started from.
   Everything here used to run from top-level statements and DOMContentLoaded handlers. */
function partBoot() {
  ['Character1', 'Character2'].forEach(function(c) {
    var img = new Image(); img.src = './assets/images/' + c + '.png';
  });

  /* ── Keyboard accessibility ── */
  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectOption(card);
      }
    });
  });

  /* Close dropdowns when clicking outside */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.s5-dropdown')) {
      document.querySelectorAll('[data-screen="5"] .s5-dropdown').forEach(function (d) {
        d.classList.remove('is-open');
        var panel = document.getElementById('s5-dd-panel-' + d.dataset.row);
        if (panel) panel.hidden = true;
      });
      [1, 2, 3].forEach(function(n) {
        var w = document.getElementById('s26-wrap' + n);
        var p = document.getElementById('s26-panel' + n);
        if (w) w.classList.remove('is-open');
        if (p) p.hidden = true;
      });
      [1, 2].forEach(function(n) {
        var w = document.getElementById('s27-wrap' + n);
        var p = document.getElementById('s27-panel' + n);
        if (w) w.classList.remove('is-open');
        if (p) p.hidden = true;
      });
      [1, 2, 3, 4].forEach(function(n) {
        var w = document.getElementById('s30-wrap' + n);
        var p = document.getElementById('s30-panel' + n);
        if (w) w.classList.remove('is-open');
        if (p) p.hidden = true;
      });
    }
  });
}



/* ═══════════════════ xAPI (720) — item scope + question ids ═══════════════════
   Everything below is generic across the five components except SCREEN_TO_SUBCONTENT,
   XAPI_COMP_SLUG and XAPI_EVAL_ITEMS. */

/* Screen (data-screen index) -> [subContent suffix, page-in-item]; null = no catalog item.
   Read by xapiOnScreen (element 0) and by submitReport (both elements). */
var SCREEN_TO_SUBCONTENT = {
  0: null,            // congratulations / transition
  1: ['001', 1],      // class task: instructions
  2: ['001', 2]       // class task: type your scale (self-reported, not graded)
};

var XAPI_COMP_SLUG = 'methodica-math-scale-01-03';
/* Component and item ids must match metadata/*.json byte-for-byte — that convention keeps a
   TRAILING SLASH on unit, component and item ids (but not on question ids). */
var XAPI_COMP_ID   = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';



/* Items that carry a graded question IN CODE. */
var XAPI_EVAL_ITEMS = {};


/* Report modal, draggable feedback, a11y wiring and image zoom: ../unit-js/ */


/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   One State document per unit, keyed by window.XAPI_UNIT_ID.
   The off-computer class task. Its only stateful screen is 2, the free-text scale the learner
   types — the DDQ block further up this file is dead copied code (resetScreenState dispatches
   three screens and there is no ddqCheck anywhere), so nothing about it is captured.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).











/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every finished
   screen re-reachable, and the library's dedupe only spans a single page load. `initialized` is
   deliberately NOT guarded: the platform asks for it on every entry.





/* Nothing in this component keeps answer state in a variable. */
var RESUME_PLAIN_VARS = [];

/* This part's payload only. `v` and `part` live on the enclosing v3 document, not in here. */
function capturePartPayload() {
  var st = {
    currentScreen: currentScreen,
    scaleInput: (document.getElementById('s35-input') || {}).value || '',
    vars: {}
  };
  /* eval keeps this list-driven: these are file-scope `var`/`let` bindings, so they are
     not reachable as window properties. */
  RESUME_PLAIN_VARS.forEach(function (k) {
    try { st.vars[k] = eval(k); } catch (e) {}
  });
  return st;
}

/* Both restore passes run through here, so they can never drift apart. The parameter must stay
   named `st` — the eval below assigns through that name. */
function applyResumeVars(st) {
  if (st.vars) {
    Object.keys(st.vars).forEach(function (k) {
      if (RESUME_PLAIN_VARS.indexOf(k) === -1) return;   // never assign an unlisted name
      try { eval(k + ' = st.vars[k];'); } catch (e) {}
    });
  }
}

function applyResumeDom(st) {
  var input = document.getElementById('s35-input');
  if (input && typeof st.scaleInput === 'string') input.value = st.scaleInput;
}



/* ── Screen painters ────────────────────────────────────────────────
   Screen 2 is the only screen with anything to restore. Its whole "answered" appearance is what
   s35OnInput() derives from the input, so calling it is the faithful repaint — there is no
   grading, no feedback element and no lock. */
function restoreScreenUI(n) {
  try {
    if (n === 2) s35OnInput();
  } catch (e) { console.error('[resume] restoreScreenUI', e); }
}



/* xAPI loader: ../unit-js/50-loader.js. This component supplies its metadata file
   and, where it needs one, an onXapiReady() hook. */
var XAPI_METADATA_FILE = '../metadata/methodica-math-scale-01-03.json';
