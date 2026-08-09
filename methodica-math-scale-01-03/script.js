'use strict';

/* ═══════════════════ xAPI (720) — identity ═══════════════════
   Canonical id prefix for this unit. Every id the lomda reports is built from it and must match
   metadata/*.json byte-for-byte, INCLUDING the trailing slashes that convention carries. */
var XAPI_ID_PREFIX = 'https://lomdot.education.gov.il/metodica/720active/math/scale/01/';
/* The unit id is the prefix PLUS the unit slug — it must equal metadata unit id exactly.
   (The prefix alone is only the folder; keying the unit on that resolved to "01".) */
window.XAPI_UNIT_ID = XAPI_ID_PREFIX + 'methodica-math-scale-01/';   // resume State document key
/* Last path segment of a canonical id — the short slug the bug-report form records. */
function shortId(u){ return String(u || '').replace(/\/+$/, '').split('/').pop(); }
/* Resume (KATA State API) ships gated off. Flipping this to true also switches the library to
   xapi-720-j.js, which carries the State transport. See the RESUME block near the end of file. */
var RESUME_ENABLED = true;


function announce(msg) {
  var el = document.getElementById('a11y-announcer');
  if (!el || !msg) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = msg; }, 50);
}

const TOTAL_SCREENS = 3;
let currentScreen = 0;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
const _savedChar = localStorage.getItem('lomdaCharacter');
if (_savedChar) window.lomdaState.selectedCharacter = _savedChar;

(function preloadCharacterImages() {
  ['Character1', 'Character2'].forEach(function(c) {
    var img = new Image(); img.src = './assets/images/' + c + '.png';
  });
})();

/* Final assessment tracking (screens 43-52) */
let finalAssessmentScore = { correct: 0 };

let frcRevealed = [false, false, false];
let frcDone = false;

let s4VideoEnded = false;
let s4Playing = false;
let s4Timer = null;

let s7Timer = null;
let s8Timer = null;

/* ── Viewport scaling ──
   Width is locked to the 1280px design grid (screens anchor content to BOTH edges);
   the design HEIGHT is fluid. Since scale <= innerHeight / 720, the fluid height is
   always >= 720, so the scaled canvas exactly fills the viewport and .bottom-bar can
   never be pushed off-screen. See RESPONSIVENESS.md. */
function scaleApp() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  const left = (window.innerWidth - 1280 * scale) / 2;
  const el = document.getElementById('app');
  el.style.transform = `scale(${scale})`;
  el.style.height = (window.innerHeight / scale) + 'px';
  el.style.left = left + 'px';
  el.style.top = '0px';
}

window.addEventListener('resize', scaleApp);
scaleApp();

/* ── Navigation ── */
function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const nextScreen = document.querySelector(`[data-screen="${n}"]`);
  nextScreen.classList.add('active');
  currentScreen = n;
  try { xapiOnScreen(n); } catch (e) {}

  /* Keep an answered screen answered when the learner returns to it.
     sNNEnter() is an INITIALISER — here s35Enter() blanks #s35-input. Snapshot before it
     runs, re-apply after, then let restoreScreenUI() re-derive the widget and the continue
     button: the same steps applyExecutionState() already does for the landing screen, now
     applied to every navigation. That is what makes a REVISITED screen keep its final state,
     and what rebuilds it after a reload, when the DOM is pristine markup.
     With nothing typed the snapshot is an empty string, so re-applying is a no-op — a
     pristine screen is unaffected. */
  var _keep = null;
  if (!_restoring) { try { _keep = capturePartPayload(); } catch (e) { _keep = null; } }

  resetScreenState(n);

  if (_keep) {
    try {
      applyResumeVars(_keep);
      applyResumeDom(_keep);
      restoreScreenUI(n);
    } catch (e) { console.error('[resume] repaint on nav', e); }
  }

  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
  /* Resume: the screen change is the choke point that bounds how much a learner can lose.
     Debounced, and suppressed while restoring. */
  scheduleResumeSave();
}

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
  try { xapiFinishItems(); } catch (e) {}
  try { sendCompletedOnce('done', currentPartSlug(), 'onlinelesson', { success: true }); } catch (e) { console.error('[xAPI] completed component 03', e); }
  /* Resume: point the state document at the component being entered, before navigating. */
  if (RESUME_ENABLED) writeForwardState('methodica-math-scale-01-04');
  window.location.href = '../methodica-math-scale-01-04/index.html' + window.location.search;
}

/* ── Dev tool bridge (index_dev.html postMessage) ── */
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'DEV_GOTO') { goTo(e.data.screen); }
});
window.addEventListener('load', function() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'DEV_READY', total: TOTAL_SCREENS }, '*');
  }
});

/* ── Keyboard accessibility ── */
document.addEventListener('DOMContentLoaded', function () {
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
});



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
function xapiItemId(suffix){ return XAPI_COMP_ID + XAPI_COMP_SLUG + '-' + suffix + '/'; }
function _xapiTrim(u){ return String(u == null ? '' : u).replace(/\/+$/, ''); }

/* Visible answer text for result.response. Clones first so the live DOM is untouched, and drops
   the ⓘ tooltip nodes that textContent would otherwise splice into the middle of a label. */
function xapiAnswerText(el){
  if (!el) return '';
  var c = el.cloneNode(true);
  var drop = c.querySelectorAll('.scq-info, .scq-tooltip, .s5-opt-info, .opt-tooltip');
  for (var i = 0; i < drop.length; i++) { drop[i].remove(); }
  return c.textContent.replace(/\s+/g, ' ').trim();
}

/* Question context. metadata/<component>.json is the single source of truth for question ids:
   look up subContent[<suffix>].questions[<qKey>] and return that questionId as-is when it is
   already absolute. Item matching is by '-NNN' suffix with trailing slashes normalised away, so
   re-syncing metadata from Kata can change the URL prefix without touching code. */
function xapiQ(suffix, qKey){
  var itemId = xapiItemId(suffix);
  var qid = null;
  try {
    var sc = (window.METADATA && window.METADATA.subContent) || [];
    for (var i = 0; i < sc.length; i++) {
      if (_xapiTrim(sc[i].id).slice(-(suffix.length + 1)) !== '-' + suffix) continue;
      var qs = sc[i].questions || [];
      for (var j = 0; j < qs.length; j++) {            // match the key, bare or in URL form
        var v = _xapiTrim(qs[j].questionId);
        if (v === qKey || v.slice(-(qKey.length + 1)) === '/' + qKey) { qid = qs[j].questionId; break; }
      }
      if (qid == null) {                               // fallback: positional, 'q3' -> index 2
        var n = parseInt(String(qKey).replace(/\D/g, ''), 10);
        if (n >= 1 && n <= qs.length) qid = qs[n - 1].questionId;
      }
      break;
    }
  } catch (e) {}
  if (qid == null) { console.warn('[xAPI] no metadata question', suffix, qKey); qid = qKey; }
  return { questionId: /^https?:\/\//.test(qid) ? qid : itemId + qid, parentId: itemId };
}

/* Items that carry a graded question IN CODE. */
var XAPI_EVAL_ITEMS = {};
var xapiCurrentItem = null;

/* Item-level initialized/completed pairs, driven from goTo(). Paging inside one item emits
   nothing; the item closes when the learner enters a screen belonging to a different item. */
function xapiOnScreen(screen){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  var map = (typeof SCREEN_TO_SUBCONTENT !== 'undefined') ? SCREEN_TO_SUBCONTENT[screen] : null;
  var item = map ? map[0] : null;
  if (item === xapiCurrentItem) return;
  if (xapiCurrentItem) {
    try { sendCompletedOnce('doneItems', itemLedgerKey(xapiCurrentItem), 'question', null, { objectId: xapiItemId(xapiCurrentItem), expectsAnswer: !!XAPI_EVAL_ITEMS[xapiCurrentItem] }); } catch (e) {}
  }
  xapiCurrentItem = item;
  if (item) {
    try { sendStatement720('initialized', 'question', null, { objectId: xapiItemId(item), isEvaluationItem: !!XAPI_EVAL_ITEMS[item] }); } catch (e) {}
  }
}
/* Close the last open item — called immediately before every component 'completed'. */
function xapiFinishItems(){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  if (xapiCurrentItem) {
    try { sendCompletedOnce('doneItems', itemLedgerKey(xapiCurrentItem), 'question', null, { objectId: xapiItemId(xapiCurrentItem), expectsAnswer: !!XAPI_EVAL_ITEMS[xapiCurrentItem] }); } catch (e) {}
    /* Cleared whether or not the statement was suppressed: a latch left set would make the next
       xapiOnScreen try to close the same item all over again. */
    xapiCurrentItem = null;
  }
}
/* HTML5 <video> played/paused. */
function xapiWireVideos(){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  document.querySelectorAll('video').forEach(function(v){
    if (v.__xapiWired) return; v.__xapiWired = true;
    var pausedOnce = false;
    v.addEventListener('pause', function(){ if (v.ended || v.currentTime === 0) return; pausedOnce = true; try { sendStatement720('paused', 'question', null, { time: v.currentTime }); } catch (e) {} });
    v.addEventListener('play',  function(){ if (!pausedOnce) return; try { sendStatement720('played', 'question', null, { time: v.currentTime }); } catch (e) {} });
  });
}

// ============================================================
//  REPORT MODAL
// ============================================================
/* Google Form that collects learner problem reports for THIS unit (math-scale-01). */
var REPORT_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/formResponse';
/* Problem-type labels. Module scope because both the custom select and submitReport need them —
   the form records the human-readable label, not the internal key. */
var REPORT_TYPE_LABELS = {
  'technical': 'תקלה טכנית או שמשהו לא עובד',
  'unclear':   'משהו לא ברור לי',
  'other':     'אחר'
};
function openReportModal() {
  resetReportForm();
  document.getElementById('report-modal').removeAttribute('hidden');
}

function tryCloseReportModal() {
  var typeVal = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();

  if (typeVal || textVal) {
    document.getElementById('report-modal').setAttribute('hidden', '');
    document.getElementById('report-confirm-modal').removeAttribute('hidden');
  } else {
    forceCloseReportModal();
  }
}

function forceCloseReportModal() {
  document.getElementById('report-modal').setAttribute('hidden', '');
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  resetReportForm();
}

function backToReportForm() {
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() {
    var el = document.getElementById('report-type');
    if (el) el.focus();
  }, 40);
}

function showReportThanks() {
  document.getElementById('report-modal').setAttribute('hidden', '');
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  var thanks = document.getElementById('report-thanks-modal');
  if (thanks) {
    thanks.removeAttribute('hidden');
    announce('הדיווח נשלח, תודה');
    var btn = thanks.querySelector('.report-submit-btn');
    if (btn) setTimeout(function(){ btn.focus(); }, 40);
  }
  resetReportForm();
}

function closeReportThanks() {
  var thanks = document.getElementById('report-thanks-modal');
  if (thanks) thanks.setAttribute('hidden', '');
}

function submitReport() {
  var typeKey = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();
  /* The submit button is already gated by reportCheckSubmit(); this is the belt-and-braces path
     for keyboard/programmatic submits. */
  if (!typeKey || !textVal) { reportCheckSubmit(); return; }

  var now  = new Date();
  var meta = window.METADATA || {};
  var body = new URLSearchParams();
  body.append('entry.301404029_year',    now.getFullYear());
  body.append('entry.301404029_month',   now.getMonth() + 1);
  body.append('entry.301404029_day',     now.getDate());
  body.append('entry.2066097581_hour',   now.getHours());
  body.append('entry.2066097581_minute', now.getMinutes());
  body.append('entry.1933069481', shortId(meta.learningUnitId));   // unit slug
  body.append('entry.2070680092', shortId(meta.id));               // component slug
  /* Item + page-in-item come from the same screen map the xAPI item scope uses, so a report and
     a statement always name the same place. Unmapped screens report the raw screen number. */
  var mapEntry = SCREEN_TO_SUBCONTENT[currentScreen];
  var itemId   = mapEntry ? shortId(meta.id) + '-' + mapEntry[0] : '';
  var itemPage = mapEntry ? String(mapEntry[1]) : String(currentScreen);
  body.append('entry.1555704258', itemId);
  body.append('entry.1671046914', itemPage);
  body.append('entry.1179822443', REPORT_TYPE_LABELS[typeKey] || typeKey);
  body.append('entry.806447525',  textVal);

  /* no-cors: Google Forms accepts the POST but returns an opaque response. A failure must never
     block the learner, so the modal closes either way. */
  fetch(REPORT_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: body })
    .catch(function (e) { console.error('[Report] send failed', e); });
  console.log('[Report Issue] sent');
  showReportThanks();
}

function reportCheckSubmit() {
  var typeVal = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();
  var btn = document.querySelector('.report-submit-btn');
  if (btn) btn.disabled = !(typeVal && textVal);
}

/* Custom select for report-type */
(function() {
  var LABELS = REPORT_TYPE_LABELS;   // hoisted to module scope so submitReport() can read it too
  var PLACEHOLDER = 'בחרו סוג בעיה';
  var wrapper = document.getElementById('report-type-wrapper');
  if (!wrapper) return;
  var btn        = wrapper.querySelector('.report-select-btn');
  var list       = wrapper.querySelector('.report-select-list');
  var hidden     = document.getElementById('report-type');
  var valSpan    = wrapper.querySelector('.report-select-value');
  var errEl      = document.getElementById('report-type-error');
  var wasOpened  = false;
  var pickingOpt = false;

  function showError() {
    btn.classList.add('has-error');
    if (errEl) errEl.style.display = 'block';
  }
  function clearError() {
    btn.classList.remove('has-error');
    if (errEl) errEl.style.display = 'none';
  }
  function closeList() {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function() {
    var opening = list.hidden;
    list.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    if (opening) {
      wasOpened = true;
    } else {
      if (!hidden.value) showError();
    }
  });

  list.addEventListener('mousedown', function() { pickingOpt = true; });
  list.addEventListener('mouseup',   function() { pickingOpt = false; });

  btn.addEventListener('blur', function() {
    if (!pickingOpt && wasOpened && !hidden.value) showError();
  });

  wrapper.querySelectorAll('.report-select-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      hidden.value = opt.getAttribute('data-value');
      valSpan.textContent = LABELS[hidden.value] || PLACEHOLDER;
      btn.classList.remove('is-placeholder');
      clearError();
      wasOpened = false;
      closeList();
      wrapper.querySelectorAll('.report-select-option').forEach(function(o) { o.classList.remove('is-selected'); });
      opt.classList.add('is-selected');
      hidden.dispatchEvent(new Event('change'));
    });
  });

  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      if (wasOpened && !hidden.value) showError();
      closeList();
    }
  });

  wrapper._resetSelect = function() {
    wasOpened = false;
    hidden.value = '';
    valSpan.textContent = PLACEHOLDER;
    btn.classList.add('is-placeholder');
    btn.classList.remove('has-error');
    btn.setAttribute('aria-expanded', 'false');
    if (errEl) errEl.style.display = 'none';
    closeList();
    wrapper.querySelectorAll('.report-select-option').forEach(function(o) { o.classList.remove('is-selected'); });
  };
})();
function resetReportForm() {
  var wrapper = document.getElementById('report-type-wrapper');
  if (wrapper && wrapper._resetSelect) wrapper._resetSelect();
  document.getElementById('report-text').value = '';
  document.getElementById('report-char-count').textContent = '0 / 250';
  reportCheckSubmit();
}

// Character counter for report textarea
var reportTextarea = document.getElementById('report-text');
var reportCounter  = document.getElementById('report-char-count');
if (reportTextarea && reportCounter) {
  reportTextarea.addEventListener('input', function() {
    reportCounter.textContent = reportTextarea.value.length + ' / 250';
    reportCheckSubmit();
  });
}

var reportSelect = document.getElementById('report-type');
if (reportSelect) {
  reportSelect.addEventListener('change', function() {
    reportCheckSubmit();
    var field = document.querySelector('.report-field');
    var star = field ? field.querySelector('.required-star') : null;
    if (star) star.classList.toggle('is-error', !reportSelect.value);
  });
}

if (reportTextarea) {
  reportTextarea.addEventListener('blur', function() {
    var star = reportTextarea.closest('.report-field').querySelector('.required-star');
    if (star) star.classList.toggle('is-error', !reportTextarea.value.trim());
  });
  reportTextarea.addEventListener('input', function() {
    if (reportTextarea.value.trim()) {
      var star = reportTextarea.closest('.report-field').querySelector('.required-star');
      if (star) star.classList.remove('is-error');
    }
  });
}

// Escape key closes report modals
document.addEventListener('keydown', function(event) {
  if (event.key !== 'Escape') return;
  var confirmModal = document.getElementById('report-confirm-modal');
  var reportModal  = document.getElementById('report-modal');
  if (!confirmModal.hasAttribute('hidden')) { forceCloseReportModal(); return; }
  if (!reportModal.hasAttribute('hidden'))  { tryCloseReportModal();   return; }
});

/* ── Draggable inline feedback elements ── */
(function () {
  function liftFeedback(el) {
    if (el.dataset.lifted) return;
    el.dataset.lifted = '1';
    var w    = el.offsetWidth;
    var rect = el.getBoundingClientRect();
    el.style.width    = w + 'px';
    el.style.position = 'fixed';
    el.style.left     = rect.left  + 'px';
    el.style.top      = rect.top   + 'px';
    el.style.bottom   = 'auto';
    el.style.height   = 'auto';
    el.style.zIndex   = '9999';
    el.style.margin   = '0';
  }

  function attachDrag(el) {
    if (el.dataset.dragAttached) return;
    el.dataset.dragAttached = '1';
    el.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      e.preventDefault();
      if (!el.dataset.lifted) liftFeedback(el);
      var startX   = e.clientX;
      var startY   = e.clientY;
      var baseLeft = parseFloat(el.style.left)  || 0;
      var baseTop  = parseFloat(el.style.top)   || 0;
      el.style.cursor = 'grabbing';
      function onMove(e) {
        el.style.left = (baseLeft + e.clientX - startX) + 'px';
        el.style.top  = (baseTop  + e.clientY - startY) + 'px';
      }
      function onUp() {
        el.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  function initAll() {
    document.querySelectorAll('.s5-inline-feedback').forEach(attachDrag);
  }

  function resetFeedbacks() {
    document.querySelectorAll('.s5-inline-feedback[data-lifted]').forEach(function (el) {
      el.removeAttribute('data-lifted');
      el.style.position = '';
      el.style.left     = '';
      el.style.top      = '';
      el.style.width    = '';
      el.style.zIndex   = '';
      el.style.margin   = '';
      el.style.cursor   = '';
      el.style.height   = '';
      el.style.bottom   = '';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAll();
    var _orig = window.goTo;
    if (typeof _orig === 'function') {
      window.goTo = function (n) {
        resetFeedbacks();
        _orig(n);
        setTimeout(initAll, 150);
      };
    }
  });
})();

// Accessibility: aria-live on feedback regions + tabindex on screens for focus routing
document.querySelectorAll('.s5-inline-feedback').forEach(function(el) {
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
});
document.querySelectorAll('section.screen').forEach(function(s) {
  s.setAttribute('tabindex', '-1');
});

function openImgZoom(overlayId) {
  var overlay = document.getElementById(overlayId);
  if (!overlay) return;
  var activeScreen = document.querySelector('.screen.active');
  if (activeScreen && overlay.parentElement !== activeScreen) {
    activeScreen.appendChild(overlay);
  }
  overlay.removeAttribute('hidden');
}
function closeImgZoom(overlayId) {
  if (overlayId) {
    var overlay = document.getElementById(overlayId);
    if (overlay) overlay.setAttribute('hidden', '');
  } else {
    document.querySelectorAll('.img-zoom-overlay').forEach(function(el) {
      el.setAttribute('hidden', '');
    });
  }
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeImgZoom();
});


/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   One State document per unit, keyed by window.XAPI_UNIT_ID.
   The off-computer class task. Its only stateful screen is 2, the free-text scale the learner
   types — the DDQ block further up this file is dead copied code (resetScreenState dispatches
   three screens and there is no ddqCheck anywhere), so nothing about it is captured.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).

   Restore is a two-pass job, matching the other components: goTo() runs s35Enter(), which blanks
   the very input just restored, so the value is written again afterwards and restoreScreenUI()
   re-derives the widget and the continue button from it. goTo() now runs that same sequence on
   EVERY navigation, so returning to the reflection keeps the text the learner typed instead of
   finding it blanked.
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

function applyExecutionState(st) {
  if (!st) return;
  _restoring = true;
  /* Replaying answers must not re-report them, and the stub is held across goTo() as well so
     nothing a screen emits on entry can leak out during a replay. */
  var _origSend = window.sendStatement720;
  window.sendStatement720 = function () {};
  try {
    applyResumeVars(st);
    goTo((typeof st.currentScreen === 'number') ? st.currentScreen : 0);
    applyResumeVars(st);
    applyResumeDom(st);       // s35Enter() just blanked the input
    restoreScreenUI(currentScreen);
  } catch (e) {
    console.error('[resume] apply', e);
  } finally {
    window.sendStatement720 = _origSend;
    _restoring = false;
  }
  /* xapiOnScreen() latched xapiCurrentItem during the stubbed goTo without emitting anything.
     Clearing the latch is what lets the resumed screen report its item 'initialized' exactly
     once — and there is no prior item to close on a fresh page load. */
  xapiCurrentItem = null;
  try { xapiOnScreen(currentScreen); } catch (e) {}
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

/* ── Screen painters ────────────────────────────────────────────────
   Screen 2 is the only screen with anything to restore. Its whole "answered" appearance is what
   s35OnInput() derives from the input, so calling it is the faithful repaint — there is no
   grading, no feedback element and no lock. */
function restoreScreenUI(n) {
  try {
    if (n === 2) s35OnInput();
  } catch (e) { console.error('[resume] restoreScreenUI', e); }
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
window.addEventListener('beforeunload', flushResumeSaveOnLeave);
window.addEventListener('pagehide', flushResumeSaveOnLeave);
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') flushResumeSaveOnLeave();
});

/* ═══════════════════ xAPI — loader / init ═══════════════════ */
(function initXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';
  var METADATA_FILE = '../metadata/methodica-math-scale-01-03.json';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function () { console.error('[xAPI] failed to load', src); cb(); };
    document.head.appendChild(s);
  }
  function pollMetadataReady(cb) {
    if (window.jsXAPI_MetadataReady) { cb(); }
    else { setTimeout(function () { pollMetadataReady(cb); }, 200); }
  }
  /* -i is the production build (720 guidelines v2.4); -j is -i plus the State API transport that
     only resume uses, so -i is loaded while RESUME_ENABLED is false. On localhost only,
     ?xapiLib=<same-origin path> may override it to test a local build.
     window.XAPI_USING_G tells this component whether item-level statements are available — the
     regex must list every library letter that supports them, or xapiOnScreen and the video
     reporting go silent with no error. */
  var LIB720 = CDN + (RESUME_ENABLED ? 'xapi-720-j.js' : 'xapi-720-i.js');
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var _ovr = new URLSearchParams(location.search).get('xapiLib');
      if (_ovr && /^(\.\.?\/|\/)[^:]*$/.test(_ovr)) LIB720 = _ovr;   // same-origin relative only
    }
  } catch (e) {}
  window.XAPI_USING_G = /xapi-720-[ghij]\.js/.test(LIB720);

  loadScript(CDN + 'xapiwrapper.min.js', function () {
    loadScript(LIB720, function () {
      try {
        getXAPIParameters(METADATA_FILE);
        pollMetadataReady(function () {
          try {
            try { ADL.XAPIWrapper.changeConfig({ endpoint: window.slxapi.endpoint, auth: window.slxapi.auth }); } catch (e) {}
            /* Resume runs BEFORE the component 'initialized': a session that turns out to belong
               to another component hops away, and must not leave a statement behind for the part
               it merely passed through. */
            var _resumed = false;
            if (RESUME_ENABLED) {
              try {
                /* readUnitState migrates a v2 document and never returns null, so a stale shape
                   can neither redirect nor leave the ledger undefined. */
                var _saved = readUnitState();
                if (_saved.part && _saved.part !== currentPartSlug()) {
                  // Learner stopped in another component — hop there, carrying slxapi+registration.
                  window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
                  return;
                }
                _resumeReady = true;
                /* _resumed tracks whether a payload was actually applied, not whether a document
                   existed. A v3 document always exists; if it holds nothing for this part,
                   applyExecutionState is a no-op and the landing screen still owes its item
                   'initialized' below. */
                var _payload = _saved.parts[currentPartSlug()];
                if (_payload) { applyExecutionState(_payload); _resumed = true; }
                syncBackButton();
              } catch (e) {
                console.error('[resume] init', e);
                _resumeReady = true;
                if (!_unitState) _unitState = emptyUnitState();
              }
            }
            try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}
            try { xapiWireVideos(); } catch (e) {}
            /* Item-level init for the landing screen. On a resume, applyExecutionState already
               emitted it for the restored screen. */
            if (!_resumed) { try { xapiOnScreen(currentScreen); } catch (e) {} }
          } catch (e) { console.error('[xAPI] init', e); }
        });
      } catch (e) { console.error('[xAPI] load', e); }
    });
  });
})();
