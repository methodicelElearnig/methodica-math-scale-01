'use strict';
// ============================================================
//  REPORT MODAL — "מצאתם בעיה?"
// ============================================================
/* Shared by all five components. Definition-only: 90-boot.js calls initReportModal().
   See REPORT-ISSUE.md for what this feature is and how to give a NEW unit its own form.

   Per-part seams this file reads at call time, not load time:
     SCREEN_TO_SUBCONTENT   screen -> [item suffix, page-in-item]
     currentScreen          the learner's position
   Both come from the component's own script.js.

   Two components (04, 05) ship a newer modal that adds #report-text-error and wires
   onblur="reportTextBlur()"; 01, 02 and 03 have the older markup. The versions below are the
   NEWER ones, which guard every lookup — in the older markup those elements are absent, the
   guards short-circuit, and behaviour is unchanged. */

/* Google Form that collects learner problem reports for THIS unit (math-scale-01).
   Pointing a new unit at this endpoint would silently deliver its reports here — see
   REPORT-ISSUE.md §3. */
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

function resetReportForm() {
  var wrapper = document.getElementById('report-type-wrapper');
  if (wrapper && wrapper._resetSelect) wrapper._resetSelect();
  var ta = document.getElementById('report-text');
  var taErr = document.getElementById('report-text-error');
  if (ta)    { ta.value = ''; ta.classList.remove('has-error'); }
  if (taErr) taErr.hidden = true;
  document.getElementById('report-char-count').textContent = '0 / 250';
  reportCheckSubmit();
}

/* Wired from the markup as onblur="reportTextBlur()" in components 04 and 05 only. Harmless
   elsewhere: without #report-text-error it returns immediately, and nothing calls it. */
function reportTextBlur() {
  var ta    = document.getElementById('report-text');
  var taErr = document.getElementById('report-text-error');
  if (!ta || !taErr) return;
  if (!ta.value.trim()) {
    ta.classList.add('has-error');
    taErr.style.display = 'block';
  } else {
    ta.classList.remove('has-error');
    taErr.style.display = 'none';
  }
}

/* Everything with a side effect lives here, called once from 90-boot.js.
   The markup uses a hidden input plus a custom select, NOT a native <select>, so the usual
   options[selectedIndex].text idiom does not apply and REPORT_TYPE_LABELS has to be readable
   from submitReport() too — which is why it sits at module scope above. */
function initReportModal() {
  /* Custom select for report-type */
  (function() {
    var LABELS = REPORT_TYPE_LABELS;
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
}
