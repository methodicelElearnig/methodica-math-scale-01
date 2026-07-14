'use strict';

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

/* ── Viewport scaling ── */
function scaleApp() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 710;
  const scale = Math.min(scaleX, scaleY);
  const left = (window.innerWidth - 1280 * scale) / 2;
  const top = (window.innerHeight - 710 * scale) / 2;
  const el = document.getElementById('app');
  el.style.transform = `scale(${scale})`;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
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
  resetScreenState(n);
  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
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
  window.location.href = '../methodica-math-scale-01-04/index.html';
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



// ============================================================
//  REPORT MODAL
// ============================================================
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

function submitReport() {
  var report = {
    type:      document.getElementById('report-type').value || '(לא נבחר)',
    text:      document.getElementById('report-text').value.trim() || '(ללא תיאור)',
    screen:    currentScreen,
    timestamp: new Date().toISOString()
  };
  console.log('[Report Issue]', report);
  forceCloseReportModal();
}

function reportCheckSubmit() {
  var typeVal = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();
  var btn = document.querySelector('.report-submit-btn');
  if (btn) btn.disabled = !(typeVal && textVal);
}

/* Custom select for report-type */
(function() {
  var LABELS = {
    'technical': 'תקלה טכנית או שמשהו לא עובד',
    'unclear':   'משהו לא ברור לי',
    'other':     'אחר'
  };
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
