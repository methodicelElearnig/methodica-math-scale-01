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

const TOTAL_SCREENS = 6;
let currentScreen = 0;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
const _savedChar = localStorage.getItem('lomdaCharacter');
if (_savedChar) window.lomdaState.selectedCharacter = _savedChar;

(function preloadCharacterImages() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    var img = new Image(); img.src = './assets/images/' + c + '.png';
  });
})();

let frcRevealed = [false, false, false];
let frcDone = false;

let s4VideoEnded = false;
let s4Playing = false;
let s4Timer = null;

let s7Timer = null;
let s8Timer = null;

/* ── Screen 3 (s39) Drag-and-drop ── */
const DDQ = {
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
let ddqPlacement = {
  'drag-6': 'source', 'drag-12': 'source', 'drag-15': 'source',
  'drag-24': 'source', 'drag-30': 'source', 'drag-48': 'source', 'drag-60': 'source'
};
let ddqDone        = false;
let ddqChecked     = false;
let ddqAttempts    = 0;
let ddqDragActive  = null;
let ddqDropHandled = false;
let ddqKeySelected = null;
/* Which targets the learner had right on the closing attempt. ddqRevealCorrect() overwrites
   ddqPlacement with the correct map, so the ✓/✗ badges cannot be recomputed after the fact —
   ddqCheck records them here so resume can repaint them. */
let ddqTargetResults = {};

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

/* ── Nav bar helper ── */
function updateNavBar(navEl, currentQ, results, screens) {
  if (!navEl) return;
  var items = navEl.querySelectorAll('.s18-nav-item');
  var lines = navEl.querySelectorAll('.s18-nav-line');
  items.forEach(function(item, i) {
    var icon  = item.querySelector('.s18-nav-icon');
    var label = item.querySelector('.s18-nav-label');
    icon.className = 's18-nav-icon';
    item.onclick = null;
    item.style.cursor = '';
    var result = results[i];
    if (i + 1 === currentQ) {
      icon.classList.add('s18-nav-icon--active');
      label.className = 's18-nav-label s18-nav-label--on';
    } else if (result === 'correct') {
      icon.classList.add('s18-nav-icon--done');
      label.className = 's18-nav-label s18-nav-label--on';
      if (screens && screens[i] != null) {
        (function(sc) { item.onclick = function() { goTo(sc); }; })(screens[i]);
        item.style.cursor = 'pointer';
      }
    } else if (result === 'wrong') {
      icon.classList.add('s18-nav-icon--wrong');
      label.className = 's18-nav-label s18-nav-label--on';
      if (screens && screens[i] != null) {
        (function(sc) { item.onclick = function() { goTo(sc); }; })(screens[i]);
        item.style.cursor = 'pointer';
      }
    } else {
      icon.classList.add('s18-nav-icon--off');
      label.className = 's18-nav-label s18-nav-label--off';
    }
  });
  lines.forEach(function(line, i) {
    var r = results[i];
    if (r === 'correct' || r === 'wrong') {
      line.classList.add('s18-nav-line--done');
    } else {
      line.classList.remove('s18-nav-line--done');
    }
  });
}

/* ── Navigation ── */
function goToNextModule() {
  try { xapiFinishItems(); } catch (e) {}
  try {
    var _n = xapiCorrectCount();
    sendStatement720('completed', 'onlinelesson', { success: _n >= 4, score: { scaled: _n / 5 } });
  } catch (e) { console.error('[xAPI] completed component 04', e); }
  /* Resume: point the state document at the component being entered, before navigating. */
  if (RESUME_ENABLED) writeForwardState('methodica-math-scale-01-05');
  window.location.href = '../methodica-math-scale-01-05/index.html' + window.location.search;
}

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const nextScreen = document.querySelector(`[data-screen="${n}"]`);
  if (!nextScreen) return;
  nextScreen.classList.add('active');
  currentScreen = n;
  try { xapiOnScreen(n); } catch (e) {}
  resetScreenState(n);
  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
  /* Resume: the screen change is the choke point that bounds how much a learner can lose.
     Debounced, and suppressed while restoring. */
  scheduleResumeSave();
}

function resetScreenState(n) {
  if (n === 0)  { s36Enter(); }
  if (n === 1)  { s37Enter(); }
  if (n === 2)  { s38Enter(); }
  if (n === 3)  { s39Enter(); }
  if (n === 4)  { s40Enter(); }
  if (n === 5)  { s41Enter(); }
}


/* ── Ratio helper ── */
function checkRatio(input, a, b) {
  var s = input.replace(/\s/g, '').replace(/,/g, '');
  var parts = s.split(':');
  if (parts.length !== 2) return false;
  return (parts[0] === String(a) && parts[1] === String(b)) ||
         (parts[0] === String(b) && parts[1] === String(a));
}


/* ── Screen 38: תרגול מתקדם — שאלה 2א ── */
var s38Selected = null;
var s38Attempts = 0;
var s38Solved   = false;
var s38Correct  = false;
var S38_CORRECT = 0;

function s38Enter() {
  updateNavBar(
    document.querySelector('#s2 .s18-nav'), 2,
    [s37Solved ? (s37Correct ? 'correct' : 'wrong') : null, null, null],
    [1, 2, 4]
  );
  s38Selected = null;
  s38Attempts = 0;
  s38Solved   = false;
  s38Correct  = false;
  document.querySelectorAll('[data-screen="2"] .s5-opt').forEach(function(o) {
    o.disabled = false;
    o.classList.remove('is-selected', 'is-correct', 'is-incorrect');
  });
  var fb = document.getElementById('s38-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  document.getElementById('s38-fb-bold').textContent    = '';
  document.getElementById('s38-fb-regular').textContent = '';
  var cont = document.getElementById('s38-continue');
  if (cont) { cont.disabled = true; cont.onclick = function() { s38Submit(); }; }
  var hintBtn = document.getElementById('s38-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s38-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s38Select(idx) {
  if (s38Solved) return;
  s38Selected = idx;
  document.querySelectorAll('[data-screen="2"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  document.getElementById('s38-continue').disabled = false;
}

function s38ToggleHint() {
  var popup = document.getElementById('s38-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('002', 'q1')); } catch (e) {}
    }
  }
}

function s38CloseHint() {
  var popup = document.getElementById('s38-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s38Submit() {
  if (s38Solved) { goTo(3); return; }
  if (s38Selected === null) return;

  var correct = (s38Selected === S38_CORRECT);
  s38Attempts++;
  /* xAPI: item 002 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s38Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="2"] .s5-opt')[s38Selected])] } },
      xapiQ('002', 'q1'));
  } catch (e) { console.error('[xAPI] answered 002/q1', e); }
  XAPI_Q_RESULTS['002/q1'] = !!correct;

  var fb      = document.getElementById('s38-feedback');
  var fbBold  = document.getElementById('s38-fb-bold');
  var fbReg   = document.getElementById('s38-fb-regular');
  var cont    = document.getElementById('s38-continue');
  var hintBtn = document.getElementById('s38-hint-btn');
  var opts    = document.querySelectorAll('[data-screen="2"] .s5-opt');

  var explanation = 'יובל הגדיל את התמונה פי 2 ואז הגדיל את התמונה החדשה פי 3. ​\nלכן, שתי הלחיצות על כפתור הזום הגדילו את התמונה פי 6, ומכאן שקנה המידה לאחר ההגדלה הוא 50 : 1 (50 = 6 ÷ 300). ​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s38Solved  = true;
    s38Correct = true;
    opts[s38Selected].classList.remove('is-selected');
    opts[s38Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent  = 'נכון מאוד!​';
    announce('נכון מאוד!​');
    fbReg.innerHTML     = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(3); };
  } else if (s38Attempts === 1) {
    opts[s38Selected].classList.remove('is-selected');
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent   = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden           = false;
    if (hintBtn) hintBtn.hidden = false;
    s38Selected = null;
    cont.disabled = true;
  } else {
    s38Solved = true;
    opts.forEach(function(o, i) {
      o.disabled = true;
      o.classList.remove('is-selected');
      if (i === S38_CORRECT) o.classList.add('is-correct');
      else if (i === s38Selected) o.classList.add('is-incorrect');
    });
    fbBold.textContent  = 'זו טעות – בואו נבין למה:​';
    announce('זו טעות – בואו נבין למה:​');
    fbReg.innerHTML     = explanation;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(3); };
  }
  flushResumeSave();   // see s37Submit
}


/* ── Screen 37: תרגול מתקדם — שאלה 1 ── */
var s37Selected = null;
var s37Attempts = 0;
var s37Solved   = false;
var s37Correct  = false;
var S37_CORRECT = 2;

function s37Enter() {
  updateNavBar(
    document.querySelector('#s1 .s18-nav'), 1,
    [null, null, null],
    [1, 2, 4]
  );
  s37Selected = null;
  s37Attempts = 0;
  s37Solved   = false;
  s37Correct  = false;
  document.querySelectorAll('[data-screen="1"] .s5-opt').forEach(function(o) {
    o.disabled = false;
    o.classList.remove('is-selected', 'is-correct', 'is-incorrect');
  });
  var fb = document.getElementById('s37-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  document.getElementById('s37-fb-bold').textContent    = '';
  document.getElementById('s37-fb-regular').textContent = '';
  var cont = document.getElementById('s37-continue');
  if (cont) { cont.disabled = true; cont.onclick = function() { s37Submit(); }; }
  var hintBtn = document.getElementById('s37-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s37-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s37Select(idx) {
  if (s37Solved) return;
  s37Selected = idx;
  document.querySelectorAll('[data-screen="1"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  document.getElementById('s37-continue').disabled = false;
}

function s37ToggleHint() {
  var popup = document.getElementById('s37-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('001', 'q1')); } catch (e) {}
    }
  }
}

function s37CloseHint() {
  var popup = document.getElementById('s37-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s37Submit() {
  if (s37Solved) { goTo(2); return; }
  if (s37Selected === null) return;

  var correct = (s37Selected === S37_CORRECT);
  s37Attempts++;
  /* xAPI: item 001 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s37Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="1"] .s5-opt')[s37Selected])] } },
      xapiQ('001', 'q1'));
  } catch (e) { console.error('[xAPI] answered 001/q1', e); }
  XAPI_Q_RESULTS['001/q1'] = !!correct;

  var fb      = document.getElementById('s37-feedback');
  var fbBold  = document.getElementById('s37-fb-bold');
  var fbReg   = document.getElementById('s37-fb-regular');
  var cont    = document.getElementById('s37-continue');
  var hintBtn = document.getElementById('s37-hint-btn');
  var opts    = document.querySelectorAll('[data-screen="1"] .s5-opt');

  var explanation = 'גובה המגדל במציאות הוא 828.8 מטרים, שהם 82,880 ס"מ. נחלק את הגובה ב-3,000, ונקבל שרטוט באורך של קצת יותר מ-27.6 ס"מ, ש"נכנס" בשלמותו בתוך 29.7 הסנטימטרים של הדף. ​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s37Solved  = true;
    s37Correct = true;
    opts[s37Selected].classList.remove('is-selected');
    opts[s37Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent  = 'יופי של תשובה! ​';
    announce('יופי של תשובה! ​');
    fbReg.innerHTML     = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(2); };
  } else if (s37Attempts === 1) {
    opts[s37Selected].classList.remove('is-selected');
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent   = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden           = false;
    if (hintBtn) hintBtn.hidden = false;
    s37Selected = null;
    cont.disabled = true;
  } else {
    s37Solved = true;
    opts.forEach(function(o, i) {
      o.disabled = true;
      o.classList.remove('is-selected');
      if (i === S37_CORRECT) o.classList.add('is-correct');
      else if (i === s37Selected) o.classList.add('is-incorrect');
    });
    fbBold.textContent  = 'זו טעות, לא נורא – בואו נלמד ממנה:​';
    announce('זו טעות, לא נורא – בואו נלמד ממנה:​');
    fbReg.innerHTML     = explanation;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(2); };
  }
  /* Resume: commit the answer synchronously. A debounced save here could still be in flight when
     the learner navigates, and land after the next screen's own write. */
  flushResumeSave();
}


/* ── Screen 36 ── */
function s36Enter() {
  var charImg = document.getElementById('s36-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
  }
}


function s39Enter() {
  updateNavBar(
    document.querySelector('#s3 .s18-nav'), 2,
    [s37Solved ? (s37Correct ? 'correct' : 'wrong') : null, null, null],
    [1, 2, 4]
  );
  if (ddqDone) return;
  Object.keys(ddqPlacement).forEach(function(k) { ddqPlacement[k] = 'source'; });
  ddqDragActive  = null;
  ddqDropHandled = false;
  ddqChecked     = false;
  ddqAttempts    = 0;
  ddqRender();
  var fb = document.getElementById('s39-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  var fbBold = document.getElementById('s39-fb-bold');
  var fbReg  = document.getElementById('s39-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  s39GateSatisfied = true;
  var s39FbCloseBtn = document.getElementById('s39-fb-close');
  if (s39FbCloseBtn) s39FbCloseBtn.disabled = false;
  var btn = document.getElementById('ddq-check');
  if (btn) { btn.disabled = true; btn.textContent = 'צדקתי?'; btn.onclick = function() { ddqCheck(); }; }
  var hintBtn = document.getElementById('s39-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s39-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  Object.keys(DDQ.correctMap).forEach(function(tId) {
    var t = document.getElementById(tId);
    if (!t) return;
    t.classList.remove('s39-correct');
    t.querySelectorAll('.ddq-badge').forEach(function(b) { b.remove(); });
  });
}

function ddqRender() {
  Object.keys(ddqPlacement).forEach(function(dragId) {
    var card = document.getElementById(dragId);
    if (!card) return;
    var inSource = (ddqPlacement[dragId] === 'source');
    card.classList.toggle('ghost', !inSource);
    if (ddqChecked) {
      card.classList.add('locked');
      card.draggable = false;
    } else {
      card.classList.remove('locked');
      card.draggable = true;
    }
  });

  Object.keys(DDQ.correctMap).forEach(function(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;
    var placedId = null;
    Object.keys(ddqPlacement).forEach(function(id) {
      if (ddqPlacement[id] === targetId) placedId = id;
    });
    var existing = target.querySelector('.ddq-placed-card');
    if (existing) existing.remove();
    target.classList.remove('occupied');
    if (placedId) {
      target.classList.add('occupied');
      var card = document.createElement('div');
      card.className = 'ddq-placed-card ddq-num-chip';
      card.textContent = placedId.replace('drag-', '');
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'מספר ' + placedId.replace('drag-', '') + ', לחץ להחזרה למגש');
      if (!ddqChecked) {
        card.draggable = true;
        (function(id) {
          card.addEventListener('dragstart', function(ev) { ddqPlacedDragStart(ev, id); });
          card.addEventListener('dragend',   function(ev) { ddqDragEnd(ev); });
          card.addEventListener('keydown',   function(ev) { ddqChipKeyDown(ev, id); });
        })(placedId);
      } else {
        card.classList.add('locked');
      }
      target.appendChild(card);
    }
  });

  ddqUpdateCheckBtn();
}

function ddqDragStart(event, dragId) {
  if (ddqChecked) { event.preventDefault(); return; }
  ddqDragActive  = dragId;
  ddqDropHandled = false;
  event.dataTransfer.setData('text/plain', dragId);
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(function() {
    var card = document.getElementById(dragId);
    if (card) card.classList.add('dragging');
  }, 0);
}

function ddqPlacedDragStart(event, dragId) {
  if (ddqChecked) { event.preventDefault(); return; }
  ddqDragActive  = dragId;
  ddqDropHandled = false;
  event.dataTransfer.setData('text/plain', dragId);
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(function() {
    ddqPlacement[dragId] = 'source';
    ddqRender();
    var card = document.getElementById(dragId);
    if (card) card.classList.add('dragging');
  }, 0);
}

function ddqDragEnd(event) {
  if (!ddqDropHandled && ddqDragActive) {
    ddqPlacement[ddqDragActive] = 'source';
    ddqRender();
  }
  if (ddqDragActive) {
    var card = document.getElementById(ddqDragActive);
    if (card) card.classList.remove('dragging');
  }
  ddqDragActive  = null;
  ddqDropHandled = false;
}

function ddqAnnounce(msg) {
  var el = document.getElementById('ddq-announcer');
  if (el) { el.textContent = ''; setTimeout(function(){ el.textContent = msg; }, 50); }
}

function ddqUpdateKeyState() {
  Object.keys(ddqPlacement).forEach(function(dragId) {
    var chip = document.getElementById(dragId);
    if (chip) chip.setAttribute('aria-pressed', ddqKeySelected === dragId ? 'true' : 'false');
  });
}

function ddqChipKeyDown(event, dragId) {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  if (ddqChecked) return;
  if (ddqKeySelected === dragId) {
    ddqKeySelected = null;
    ddqUpdateKeyState();
    ddqAnnounce('הבחירה בוטלה');
    return;
  }
  if (ddqPlacement[dragId] !== 'source') {
    ddqPlacement[dragId] = 'source';
    ddqRender();
  }
  ddqKeySelected = dragId;
  ddqUpdateKeyState();
  ddqAnnounce('בחרת מספר ' + dragId.replace('drag-', '') + '. עכשיו לחץ על יעד להנחה.');
}

function ddqTargetKeyDown(event, targetId) {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
  if (!ddqKeySelected || ddqChecked) return;
  var dragId = ddqKeySelected;
  Object.keys(ddqPlacement).forEach(function(id) {
    if (ddqPlacement[id] === targetId) ddqPlacement[id] = 'source';
  });
  ddqPlacement[dragId] = targetId;
  ddqKeySelected = null;
  ddqRender();
  ddqUpdateKeyState();
  var targetEl = document.getElementById(targetId);
  var label = targetEl ? targetEl.getAttribute('aria-label') : targetId;
  ddqAnnounce('הנחת ' + dragId.replace('drag-', '') + ' ב' + label);
}

function ddqDragOver(event, targetId) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  var t = document.getElementById(targetId);
  if (t) t.classList.add('drag-over');
}

function ddqDragLeave(event, targetId) {
  var t = document.getElementById(targetId);
  if (t) t.classList.remove('drag-over');
}

function ddqDrop(event, targetId) {
  event.preventDefault();
  if (ddqChecked) return;
  var dragId = event.dataTransfer.getData('text/plain') || ddqDragActive;
  if (!dragId) return;
  ddqDropHandled = true;
  var target = document.getElementById(targetId);
  if (target) target.classList.remove('drag-over');
  Object.keys(ddqPlacement).forEach(function(id) {
    if (ddqPlacement[id] === targetId) ddqPlacement[id] = 'source';
  });
  ddqPlacement[dragId] = targetId;
  ddqRender();
}

function ddqUpdateCheckBtn() {
  if (ddqChecked) return;
  var allFilled = Object.keys(DDQ.correctMap).every(function(tId) {
    return Object.keys(ddqPlacement).some(function(id) {
      return ddqPlacement[id] === tId;
    });
  });
  var btn = document.getElementById('ddq-check');
  if (btn) btn.disabled = !allFilled;
}

var s39GateSatisfied = true;

/* Long feedback on this screen (correct / final-wrong explanations): fixed-
   height popup body scrolls, and the close/continue buttons stay locked
   until the learner has scrolled to the bottom (or the text never
   overflowed in the first place). See /720-templates ValueInputQuestion.md
   -> Long-feedback variant. Not used for the short "try again" state. */
function s39ShowFeedbackGated() {
  var fb       = document.getElementById('s39-feedback');
  var body     = document.getElementById('s39-fb-body');
  var closeBtn = document.getElementById('s39-fb-close');
  var btn      = document.getElementById('ddq-check');
  fb.classList.add('is-scroll');
  s39GateSatisfied = false;
  if (closeBtn) closeBtn.disabled = true;
  if (btn) btn.disabled = true;
  fb.hidden = false;
  if (body) body.scrollTop = 0;
  s39CheckScrollGate();
}

function s39CheckScrollGate() {
  if (s39GateSatisfied) return;
  var body = document.getElementById('s39-fb-body');
  if (!body || body.scrollHeight - body.scrollTop - body.clientHeight > 2) return;
  s39GateSatisfied = true;
  var closeBtn = document.getElementById('s39-fb-close');
  var btn      = document.getElementById('ddq-check');
  if (closeBtn) closeBtn.disabled = false;
  if (btn) btn.disabled = false;
}

function ddqCheck() {
  if (ddqChecked) { goTo(4); return; }
  ddqAttempts++;

  var allCorrect = Object.keys(DDQ.correctMap).every(function(tId) {
    var placed = null;
    Object.keys(ddqPlacement).forEach(function(id) {
      if (ddqPlacement[id] === tId) placed = id;
    });
    return placed === DDQ.correctMap[tId];
  });
  /* xAPI: item 002 / q2. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(allCorrect ? 'answered.last' : (ddqAttempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 },
        extensions: { student_answer: [Object.keys(ddqPlacement).filter(function(k){ return ddqPlacement[k] !== 'source'; }).map(function(k){ return k + ' -> ' + ddqPlacement[k]; }).join(' | ')] } },
      xapiQ('002', 'q2'));
  } catch (e) { console.error('[xAPI] answered 002/q2', e); }
  XAPI_Q_RESULTS['002/q2'] = !!allCorrect;

  var fb      = document.getElementById('s39-feedback');
  var fbBold  = document.getElementById('s39-fb-bold');
  var fbReg   = document.getElementById('s39-fb-regular');
  var btn     = document.getElementById('ddq-check');
  var hintBtn = document.getElementById('s39-hint-btn');

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect', 's5-fb--try-again', 'is-scroll');

  if (allCorrect) {
    ddqChecked = true;
    ddqDone    = true;
    ddqRender();
    Object.keys(DDQ.correctMap).forEach(function(tId) {
      var t = document.getElementById(tId);
      if (t) t.classList.add('s39-correct');
    });
    fbBold.textContent = 'נכון מאוד!​';
    announce('נכון מאוד!​');
    fbReg.innerHTML  = 'נמיר את המידות במציאות לסנטימטרים ונקבל אורך 1,200 ס"מ וגובה 600 ס"מ. ​<br>בתמונה של יובל (קנה מידה 50 : 1) נחלק את המידות ב-50 ונקבל: אורך 24 ס"מ, גובה 12 ס"מ.​<br>בתמונה של ליאור (קנה מידה 20 : 1) נחלק את המידות ב-20 ונקבל: אורך 60 ס"מ, גובה 30 ס"מ.​';
    fb.classList.add('s5-fb--correct');
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(4); };
    s39ShowFeedbackGated();

  } else if (ddqAttempts === 1) {
    /* First wrong — reset chips to source so learner starts fresh */
    Object.keys(ddqPlacement).forEach(function(k) { ddqPlacement[k] = 'source'; });
    ddqRender();
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    announce('לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect', 's5-fb--try-again');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;

  } else {
    /* Second wrong — capture what user had before revealing */
    var targetResults = {};
    Object.keys(DDQ.correctMap).forEach(function(tId) {
      var placed = null;
      Object.keys(ddqPlacement).forEach(function(id) {
        if (ddqPlacement[id] === tId) placed = id;
      });
      targetResults[tId] = (placed === DDQ.correctMap[tId]);
    });
    ddqTargetResults = targetResults;   // resume repaints the badges from this

    ddqChecked = true;
    ddqDone    = true;
    ddqRevealCorrect();
    ddqRender();

    /* Green targets + ✓/✗ badges */
    Object.keys(DDQ.correctMap).forEach(function(tId) {
      var t = document.getElementById(tId);
      if (!t) return;
      t.classList.add('s39-correct');
      var badge = document.createElement('div');
      badge.className = targetResults[tId] ? 'ddq-badge ddq-badge--correct' : 'ddq-badge ddq-badge--wrong';
      var badgeSvgOk  = '<svg width="24" height="24" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var badgeSvgErr = '<svg width="24" height="24" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      badge.innerHTML = targetResults[tId] ? badgeSvgOk : badgeSvgErr;
      t.appendChild(badge);
    });

    fbBold.textContent = 'לא מדויק, בואו נבין למה:​';
    announce('לא מדויק, בואו נבין למה:​');
    fbReg.innerHTML  = 'נמיר את המידות במציאות לסנטימטרים ונקבל אורך 1,200 ס"מ וגובה 600 ס"מ. ​<br>בתמונה של יובל (קנה מידה 50 : 1) נחלק את המידות ב-50 ונקבל: אורך 24 ס"מ, גובה 12 ס"מ.​<br>בתמונה של ליאור (קנה מידה 20 : 1) נחלק את המידות ב-20 ונקבל: אורך 60 ס"מ, גובה 30 ס"מ.​';
    fb.classList.add('s5-fb--incorrect');
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(4); };
    s39ShowFeedbackGated();
  }
  flushResumeSave();   // see s37Submit
}

function ddqRevealCorrect() {
  var assigned = new Set(Object.values(DDQ.revealMap));
  Object.keys(ddqPlacement).forEach(function(id) {
    if (!assigned.has(id)) ddqPlacement[id] = 'source';
  });
  Object.keys(DDQ.revealMap).forEach(function(tId) {
    ddqPlacement[DDQ.revealMap[tId]] = tId;
  });
}

function ddqToggleHint() {
  var popup = document.getElementById('s39-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('002', 'q2')); } catch (e) {}
    }
  }
}

function ddqCloseHint() {
  var popup = document.getElementById('s39-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

/* ════════════════════════════════════════════
   Screen 40 — Q3א: text-input distance question
   ════════════════════════════════════════════ */

var s40Attempts = 0;
var s40Done     = false;

function s40Enter() {
  updateNavBar(
    document.querySelector('#s4 .s18-nav'), 3,
    [
      s37Solved ? (s37Correct ? 'correct' : 'wrong') : null,
      s38Solved ? (s38Correct ? 'correct' : 'wrong') : null,
      null
    ],
    [1, 2, 4]
  );
  if (s40Done) return;
  s40Attempts = 0;
  var input = document.getElementById('s40-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var fb = document.getElementById('s40-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  var fbBold = document.getElementById('s40-fb-bold');
  var fbReg  = document.getElementById('s40-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  var btn = document.getElementById('s40-check');
  if (btn) { btn.disabled = true; btn.textContent = 'צדקתי?'; btn.onclick = function() { s40Check(); }; }
  var hintBtn = document.getElementById('s40-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s40-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s40OnInput() {
  if (s40Done) return;
  var input = document.getElementById('s40-answer-input');
  var btn   = document.getElementById('s40-check');
  if (btn) btn.disabled = !(input && input.value.trim() !== '');
}

function s40Check() {
  if (s40Done) { goTo(5); return; }
  var input   = document.getElementById('s40-answer-input');
  var val     = parseFloat(input ? input.value : '');
  var correct = (val === 6);
  s40Attempts++;
  /* xAPI: item 003 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s40Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [String(val)] } },
      xapiQ('003', 'q1'));
  } catch (e) { console.error('[xAPI] answered 003/q1', e); }
  XAPI_Q_RESULTS['003/q1'] = !!correct;

  var fb      = document.getElementById('s40-feedback');
  var fbBold  = document.getElementById('s40-fb-bold');
  var fbReg   = document.getElementById('s40-fb-regular');
  var btn     = document.getElementById('s40-check');
  var hintBtn = document.getElementById('s40-hint-btn');

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s40Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'נכון מאוד!​';
    announce('נכון מאוד!​');
    fbReg.innerHTML    = 'קנה המידה הוא 200 : 1, לכן 12 ס״מ בתמונה מייצגים  2,400 ס"מ שהם 24 מטרים במציאות. העמדה צריכה להיות ברבע הדרך, ולכן נחשב <sup>1</sup>/<sub>4</sub> מ-24 מטרים, ונקבל 6 מטרים.​';
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(5); };

  } else if (s40Attempts === 1) {
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    announce('לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    if (input) { input.disabled = false; }
    btn.disabled = true;

  } else {
    s40Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'לא מדויק, בואו נבין למה:​';
    announce('לא מדויק, בואו נבין למה:​');
    fbReg.innerHTML    = 'קנה המידה הוא 200 : 1, לכן 12 ס״מ בתמונה מייצגים  2,400 ס"מ שהם 24 מטרים במציאות. העמדה צריכה להיות ברבע הדרך, ולכן נחשב <sup>1</sup>/<sub>4</sub> מ-24 מטרים ונקבל 6 מטרים.​';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(5); };
  }
  flushResumeSave();   // see s37Submit
}

function s40ToggleHint() {
  var popup = document.getElementById('s40-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('003', 'q1')); } catch (e) {}
    }
  }
}

function s40CloseHint() {
  var popup = document.getElementById('s40-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

/* ════════════════════════════════════════════
   Screen 41 — Q3ב: MCQ area + draggable ruler
   ════════════════════════════════════════════ */

var s41Selected  = null;
var s41Attempts  = 0;
var s41Solved    = false;
var S41_CORRECT  = 3;
var s41RulerDrag = null;

function s41Enter() {
  updateNavBar(
    document.querySelector('#s5 .s18-nav'), 3,
    [
      s37Solved ? (s37Correct ? 'correct' : 'wrong') : null,
      s38Solved ? (s38Correct ? 'correct' : 'wrong') : null,
      null
    ],
    [1, 2, 4]
  );
  if (s41Solved) return;
  s41Selected  = null;
  s41Attempts  = 0;
  s41RulerDrag = null;

  document.querySelectorAll('[data-screen="5"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });

  var ruler = document.getElementById('s41-ruler');
  if (ruler) { ruler.style.left = ''; ruler.style.top = ''; }

  var fb = document.getElementById('s41-feedback');
  if (fb) { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  var fbBold = document.getElementById('s41-fb-bold');
  var fbReg  = document.getElementById('s41-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';

  var cont = document.getElementById('s41-continue');
  if (cont) { cont.disabled = true; cont.textContent = 'צדקתי?'; cont.onclick = function() { s41Submit(); }; }
  var hintBtn = document.getElementById('s41-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s41-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s41Select(idx) {
  if (s41Solved) return;
  s41Selected = idx;
  document.querySelectorAll('[data-screen="5"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var cont = document.getElementById('s41-continue');
  if (cont) cont.disabled = false;
}

function s41ToggleHint() {
  var popup = document.getElementById('s41-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('003', 'q2')); } catch (e) {}
    }
  }
}

function s41CloseHint() {
  var popup = document.getElementById('s41-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s41Submit() {
  if (s41Solved) { goToNextModule(); return; }
  if (s41Selected === null) return;

  var correct = (s41Selected === S41_CORRECT);
  s41Attempts++;
  /* xAPI: item 003 / q2. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s41Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="5"] .s5-opt')[s41Selected])] } },
      xapiQ('003', 'q2'));
  } catch (e) { console.error('[xAPI] answered 003/q2', e); }
  XAPI_Q_RESULTS['003/q2'] = !!correct;

  var fb      = document.getElementById('s41-feedback');
  var fbBold  = document.getElementById('s41-fb-bold');
  var fbReg   = document.getElementById('s41-fb-regular');
  var cont    = document.getElementById('s41-continue');
  var hintBtn = document.getElementById('s41-hint-btn');
  var opts    = Array.from(document.querySelectorAll('[data-screen="5"] .s5-opt'));

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s41Solved = true;
    opts[s41Selected].classList.remove('is-selected');
    opts[s41Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent = 'יופי!​';
    announce('יופי!​');
    fbReg.innerHTML    = 'אורך צלע המתחם בתמונה הוא 8 ס”מ, וקנה המידה הוא 200 : 1 .​\n לכן, אורך צלע המתחם במציאות הוא 1,600 ס”מ שהם 16 מטרים. ​\nכעת, נחשב את שטח הריבוע:  256 מ”ר =  16 · 16​';
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'המשך';
    cont.onclick  = function() { goToNextModule(); };

  } else if (s41Attempts === 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    opts[s41Selected].classList.remove('is-selected');
    s41Selected = null;
    cont.disabled = true;

  } else {
    s41Solved = true;
    opts.forEach(function(o, i) {
      if (i === S41_CORRECT)      o.classList.add('is-correct');
      else if (i === s41Selected) o.classList.add('is-incorrect');
      o.disabled = true;
    });
    fbBold.textContent = 'לא מדויק, בואו נבין למה:​';
    announce('לא מדויק, בואו נבין למה:​');
    fbReg.innerHTML    = 'אורך צלע המתחם בתמונה הוא 8 ס”מ, וקנה המידה הוא 200 : 1 .​\n לכן, אורך צלע המתחם במציאות הוא 1,600 ס”מ שהם 16 מטרים. ​\nכעת, נחשב את שטח הריבוע:  256 מ”ר =  16 · 16​';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'המשך';
    cont.onclick  = function() { goToNextModule(); };
  }
  flushResumeSave();   // see s37Submit
}

function s41RulerDown(e) {
  var ruler = document.getElementById('s41-ruler');
  if (!ruler) return;
  var transform = getComputedStyle(document.getElementById('app')).transform;
  var scale = 1;
  if (transform && transform !== 'none') {
    var m = transform.match(/matrix\(([^,]+)/);
    if (m) scale = parseFloat(m[1]) || 1;
  }
  s41RulerDrag = {
    scale:     scale,
    startX:    e.clientX,
    startY:    e.clientY,
    startLeft: ruler.offsetLeft,
    startTop:  ruler.offsetTop
  };
  ruler.style.cursor = 'grabbing';
  e.preventDefault();
}

document.addEventListener('mousemove', function(e) {
  if (!s41RulerDrag) return;
  var ruler = document.getElementById('s41-ruler');
  if (!ruler) return;
  var dx = (e.clientX - s41RulerDrag.startX) / s41RulerDrag.scale;
  var dy = (e.clientY - s41RulerDrag.startY) / s41RulerDrag.scale;
  var newLeft = s41RulerDrag.startLeft + dx;
  var newTop  = s41RulerDrag.startTop  + dy;

  /* הסרגל מסתובב 90 מעלות — התיבה החזותית שלו הפוכה (רוחב/גובה מוחלפים) */
  var w = ruler.offsetWidth, h = ruler.offsetHeight;
  var off = (w - h) / 2;
  var minLeft = Math.min(-off, 1280 - h - off);
  var maxLeft = Math.max(-off, 1280 - h - off);
  var minTop  = Math.min(off, 720 - w + off);
  var maxTop  = Math.max(off, 720 - w + off);
  newLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);
  newTop  = Math.min(Math.max(newTop, minTop), maxTop);

  ruler.style.left = newLeft + 'px';
  ruler.style.top  = newTop  + 'px';
});

document.addEventListener('mouseup', function() {
  if (!s41RulerDrag) return;
  var ruler = document.getElementById('s41-ruler');
  if (ruler) ruler.style.cursor = 'grab';
  s41RulerDrag = null;
});

/* ════════════════════════════════════════════
   Screen 42 — Q3ג: text-input stations question
   ════════════════════════════════════════════ */

var s42Attempts = 0;
var s42Done     = false;

function s42Enter() {
  updateNavBar(
    document.querySelector('#s6 .s18-nav'), 3,
    [
      s37Solved ? (s37Correct ? 'correct' : 'wrong') : null,
      s38Solved ? (s38Correct ? 'correct' : 'wrong') : null,
      null
    ],
    [1, 2, 4]
  );
  if (s42Done) return;
  s42Attempts = 0;
  var input = document.getElementById('s42-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var fb = document.getElementById('s42-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  var fbBold = document.getElementById('s42-fb-bold');
  var fbReg  = document.getElementById('s42-fb-regular');
  var fbIcon = document.getElementById('s42-fb-icon');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  if (fbIcon) fbIcon.innerHTML   = '';
  var btn = document.getElementById('s42-check');
  if (btn) { btn.disabled = true; btn.textContent = 'צדקתי?'; btn.onclick = function() { s42Check(); }; }
  var hintBtn = document.getElementById('s42-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s42-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s42OnInput() {
  if (s42Done) return;
  var input = document.getElementById('s42-answer-input');
  var btn   = document.getElementById('s42-check');
  if (btn) btn.disabled = !(input && input.value.trim() !== '');
}

function s42Check() {
  if (s42Done) { goTo(7); return; }
  var input   = document.getElementById('s42-answer-input');
  var val     = parseFloat(input ? input.value : '');
  var correct = (val === 16);
  s42Attempts++;

  var fb      = document.getElementById('s42-feedback');
  var fbBold  = document.getElementById('s42-fb-bold');
  var fbReg   = document.getElementById('s42-fb-regular');
  var fbIcon  = document.getElementById('s42-fb-icon');
  var btn     = document.getElementById('s42-check');
  var hintBtn = document.getElementById('s42-hint-btn');

  var checkSvg = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var xSvg     = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s42Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'טוב מאוד!';
    announce('טוב מאוד!');
    fbReg.innerHTML    = 'כל עמדת VR מצריכה 4 מ״ר. נחלק את שטח המתחם (64 מ"ר) בשטח הדרוש לעמדה אחת: 16 = 4 ÷ 64, ונקבל שניתן להציב במתחם 16 עמדות.';
    fbIcon.innerHTML   = checkSvg;
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(7); };

  } else if (s42Attempts === 1) {
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    announce('לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fbIcon.innerHTML   = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    if (input) { input.disabled = false; }
    btn.disabled = true;

  } else {
    s42Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'זו טעות, לא נורא, בואו נלמד ממנה:';
    announce('זו טעות, לא נורא, בואו נלמד ממנה:');
    fbReg.innerHTML    = 'כל עמדת VR מצריכה 4 מ״ר. נחלק את שטח המתחם (64 מ"ר) בשטח הדרוש לעמדה אחת: 16 = 4 ÷ 64, ונקבל שניתן להציב במתחם 16 עמדות.';
    fbIcon.innerHTML   = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(7); };
  }
}

function s42ToggleHint() {
  var popup = document.getElementById('s42-hint-popup');
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
}

function s42CloseHint() {
  var popup = document.getElementById('s42-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
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
  0: null,            // intro to the advanced questions
  1: ['001', 1],      // advanced 1
  2: ['002', 1],      // advanced 2 - part א
  3: ['002', 2],      // advanced 2 - part ב (drag & drop)
  4: ['003', 1],      // advanced 3 - part א
  5: ['003', 2]       // advanced 3 - part ב
  /* Metadata item 005 (the post-failure reinforcement screen) has no screen in this
     component — see REPORTING-ADDING.md. Nothing maps to it. */
};

var XAPI_COMP_SLUG = 'methodica-math-scale-01-04';
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
var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1 };

/* Per-question outcome, keyed '<item>/<q>'. Written by every answered site (outside its
   try/catch, so a reporting failure cannot corrupt the score) and read when the component
   'completed' is assembled. The library's own aggregate is an all-correct AND, which would
   report success:false for any partial pass, so this component supplies its result explicitly. */
var XAPI_Q_RESULTS = {};
function xapiCorrectCount(){ return Object.keys(XAPI_Q_RESULTS).filter(function(k){ return XAPI_Q_RESULTS[k]; }).length; }
var xapiCurrentItem = null;

/* Item-level initialized/completed pairs, driven from goTo(). Paging inside one item emits
   nothing; the item closes when the learner enters a screen belonging to a different item. */
function xapiOnScreen(screen){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  var map = (typeof SCREEN_TO_SUBCONTENT !== 'undefined') ? SCREEN_TO_SUBCONTENT[screen] : null;
  var item = map ? map[0] : null;
  if (item === xapiCurrentItem) return;
  if (xapiCurrentItem) {
    try { sendStatement720('completed', 'question', null, { objectId: xapiItemId(xapiCurrentItem), expectsAnswer: !!XAPI_EVAL_ITEMS[xapiCurrentItem] }); } catch (e) {}
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
    try { sendStatement720('completed', 'question', null, { objectId: xapiItemId(xapiCurrentItem), expectsAnswer: !!XAPI_EVAL_ITEMS[xapiCurrentItem] }); } catch (e) {}
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
  var ta = document.getElementById('report-text');
  var taErr = document.getElementById('report-text-error');
  if (ta)    { ta.value = ''; ta.classList.remove('has-error'); }
  if (taErr) taErr.hidden = true;
  document.getElementById('report-char-count').textContent = '0 / 250';
  reportCheckSubmit();
}

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

// Escape key closes report modals / cancels D&D keyboard selection
document.addEventListener('keydown', function(event) {
  if (event.key !== 'Escape') return;
  if (ddqKeySelected) {
    ddqKeySelected = null;
    ddqUpdateKeyState();
    ddqAnnounce('הבחירה בוטלה');
    return;
  }
  var confirmModal = document.getElementById('report-confirm-modal');
  var reportModal  = document.getElementById('report-modal');
  if (!confirmModal.hasAttribute('hidden')) { forceCloseReportModal(); return; }
  if (!reportModal.hasAttribute('hidden'))  { tryCloseReportModal();   return; }
});


function s5FbClose(id) {
  var el = document.getElementById(id);
  if (el) el.hidden = true;
}

/* ── Draggable inline feedback elements ── */
(function () {
  /* #app has an active transform:scale(...), which makes it the containing
     block for position:fixed descendants — so drag math must convert viewport
     (clientX/clientY) coordinates into #app's own local, pre-scale space. */
  function getAppTransform() {
    var app = document.getElementById('app');
    var m = app.style.transform.match(/scale\(([^)]+)\)/);
    return {
      scale: m ? parseFloat(m[1]) : 1,
      left:  parseFloat(app.style.left) || 0,
      top:   parseFloat(app.style.top)  || 0,
    };
  }

  var BOTTOM_BAR_H = 74; /* .bottom-bar height — keep the popup from covering it */

  function liftFeedback(el) {
    if (el.dataset.lifted) return;
    el.dataset.lifted = '1';
    var w    = el.offsetWidth;
    var rect = el.getBoundingClientRect();
    var t    = getAppTransform();
    el.style.width    = w + 'px';
    el.style.position = 'fixed';
    el.style.left     = ((rect.left - t.left) / t.scale) + 'px';
    el.style.top      = ((rect.top  - t.top)  / t.scale) + 'px';
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
      if (e.target.closest('.s5-fb-body')) return;
      e.preventDefault();
      if (!el.dataset.lifted) liftFeedback(el);
      var t0 = getAppTransform();
      var startLocalX = (e.clientX - t0.left) / t0.scale;
      var startLocalY = (e.clientY - t0.top)  / t0.scale;
      var baseLeft = parseFloat(el.style.left)  || 0;
      var baseTop  = parseFloat(el.style.top)   || 0;
      el.style.cursor = 'grabbing';
      function onMove(e) {
        var t = getAppTransform();
        var curLocalX = (e.clientX - t.left) / t.scale;
        var curLocalY = (e.clientY - t.top)  / t.scale;
        var nx = baseLeft + (curLocalX - startLocalX);
        var ny = baseTop  + (curLocalY - startLocalY);
        el.style.left = Math.max(0, Math.min(nx, 1280 - el.offsetWidth))  + 'px';
        el.style.top  = Math.max(0, Math.min(ny, 720 - BOTTOM_BAR_H - el.offsetHeight)) + 'px';
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

  function resetOne(el) {
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
  }

  function resetFeedbacks() {
    document.querySelectorAll('.s5-inline-feedback[data-lifted]').forEach(resetOne);
  }

  /* Every submit handler updates the feedback's class list (correct/incorrect)
     on each new attempt, even when re-showing the SAME element for a retry
     without ever hiding it in between — a user-dragged position would
     otherwise persist across attempts. Watching the class attribute (rather
     than editing every submit function) resets a lifted element back to its
     original layout position the moment new feedback content is about to
     appear, before the browser paints the next frame. */
  var feedbackClassObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.target.dataset.lifted) resetOne(m.target);
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    initAll();
    document.querySelectorAll('.s5-inline-feedback').forEach(function (el) {
      feedbackClassObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
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
   Three advanced questions; question 2 part ב is a drag-and-drop placement map.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).

   Restore is a two-pass job. goTo() runs the screen's sNNEnter(), and every one of them is an
   INITIALISER, not a restorer: s37/s38 reset the very variables just restored, and s39/s40/s41
   early-return on their solved flag, so on a fresh page load they leave the pristine markup on
   screen. So the variables are assigned, goTo() runs, the variables are assigned AGAIN, and then
   restoreScreenUI() paints the answered look. goTo() and the sNNEnter() functions are
   deliberately left untouched — the live answer path must not change.
   ═══════════════════════════════════════════════════════════════════ */
var RESUME_STATE_VERSION = 2;
var RESUME_STATE_ID      = 'execution-state';
var _resumeReady         = false;
var _restoring           = false;
var _leavingToNextPart   = false;

function currentPartSlug() {
  var p = window.location.pathname.replace(/\/index\.html.*$/, '').replace(/\/+$/, '');
  return p.split('/').pop() || '';
}

/* Variables copied verbatim in both directions. */
var RESUME_PLAIN_VARS = ['s37Selected', 's37Attempts', 's37Solved', 's37Correct', 's38Selected', 's38Attempts', 's38Solved', 's38Correct', 'ddqDone', 'ddqAttempts', 'ddqChecked', 's40Attempts', 's40Done', 's41Selected', 's41Attempts', 's41Solved'];

/* Typed answers live only in the DOM — no variable holds them — so they travel by element id.
   Reading them at capture time is safe: no submit branch clears these inputs, only disables. */
var RESUME_INPUT_IDS = ['s40-answer-input'];

function captureResumeInputs() {
  var out = {};
  RESUME_INPUT_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) out[id] = el.value;
  });
  return out;
}

function captureExecutionState() {
  var st = {
    v: RESUME_STATE_VERSION,
    part: currentPartSlug(),
    currentScreen: currentScreen,
    qResults: Object.assign({}, XAPI_Q_RESULTS),
    ddqPlacement: Object.assign({}, ddqPlacement),
    ddqTargetResults: Object.assign({}, ddqTargetResults),
    inputs: captureResumeInputs(),
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
  if (st.qResults) XAPI_Q_RESULTS = Object.assign({}, st.qResults);
  if (st.ddqPlacement) { Object.keys(st.ddqPlacement).forEach(function(k){ ddqPlacement[k] = st.ddqPlacement[k]; }); }
  if (st.ddqTargetResults) ddqTargetResults = Object.assign({}, st.ddqTargetResults);
  if (st.vars) {
    Object.keys(st.vars).forEach(function (k) {
      if (RESUME_PLAIN_VARS.indexOf(k) === -1) return;   // never assign an unlisted name
      try { eval(k + ' = st.vars[k];'); } catch (e) {}
    });
  }
}

function applyResumeInputs(map) {
  if (!map) return;
  RESUME_INPUT_IDS.forEach(function (id) {
    if (typeof map[id] !== 'string') return;
    var el = document.getElementById(id);
    if (el) el.value = map[id];
  });
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
    applyResumeVars(st);            // undo the reset that this screen's sNNEnter() just did
    applyResumeInputs(st.inputs);   // before the painter, which disables the inputs
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

/* Writes the state document for the component the learner is about to enter, so the next launch
   resumes forward instead of back into the part they just finished. Re-arming the debounced save
   first replaces any payload still pending for THIS part — the page stays alive while the next
   document loads, long enough for a stale timer to fire and clobber this write. */
function writeForwardState(destSlug) {
  var blob = { v: RESUME_STATE_VERSION, part: destSlug, currentScreen: 0 };
  try {
    if (typeof window.saveState720Debounced === 'function') window.saveState720Debounced(RESUME_STATE_ID, blob);
    if (typeof window.saveState720 === 'function') window.saveState720(RESUME_STATE_ID, blob);
  } catch (e) { console.error('[resume] forward', e); }
  _leavingToNextPart = true;
}

/* ── Screen painters ────────────────────────────────────────────────
   Question screens only (the agreed first step); narrative screens land at their start.
   Each painter mirrors the DOM writes of its submit/check branches and NOTHING else — no state
   mutation, no statements, no announce(). Two axes, not four branches: solved picks the terminal
   look, otherwise an attempt already spent shows the interim feedback AND the current selection
   is repainted, because those co-occur. Correctness comes from sNNCorrect where the variable
   exists and from XAPI_Q_RESULTS where it does not (s39/s40/s41) — never from the attempt count,
   which counts differently from part 02's. */
function restoreScreenUI(n) {
  try {
    if (n === 1) s37RestoreUI();
    if (n === 2) s38RestoreUI();
    if (n === 3) s39RestoreUI();
    if (n === 4) s40RestoreUI();
    if (n === 5) s41RestoreUI();
  } catch (e) { console.error('[resume] restoreScreenUI', e); }
}

/* Explanation bodies, copied from the branches they mirror. */
var S37_RESTORE_EXPLANATION = 'גובה המגדל במציאות הוא 828.8 מטרים, שהם 82,880 ס"מ. נחלק את הגובה ב-3,000, ונקבל שרטוט באורך של קצת יותר מ-27.6 ס"מ, ש"נכנס" בשלמותו בתוך 29.7 הסנטימטרים של הדף. ​';
var S38_RESTORE_EXPLANATION = 'יובל הגדיל את התמונה פי 2 ואז הגדיל את התמונה החדשה פי 3. ​\nלכן, שתי הלחיצות על כפתור הזום הגדילו את התמונה פי 6, ומכאן שקנה המידה לאחר ההגדלה הוא 50 : 1 (50 = 6 ÷ 300). ​';
var S39_RESTORE_EXPLANATION = 'נמיר את המידות במציאות לסנטימטרים ונקבל אורך 1,200 ס"מ וגובה 600 ס"מ. ​<br>בתמונה של יובל (קנה מידה 50 : 1) נחלק את המידות ב-50 ונקבל: אורך 24 ס"מ, גובה 12 ס"מ.​<br>בתמונה של ליאור (קנה מידה 20 : 1) נחלק את המידות ב-20 ונקבל: אורך 60 ס"מ, גובה 30 ס"מ.​';
var S40_RESTORE_EXPLANATION = 'קנה המידה הוא 200 : 1, לכן 12 ס״מ בתמונה מייצגים  2,400 ס"מ שהם 24 מטרים במציאות. העמדה צריכה להיות ברבע הדרך, ולכן נחשב <sup>1</sup>/<sub>4</sub> מ-24 מטרים, ונקבל 6 מטרים.​';
var S41_RESTORE_EXPLANATION = 'אורך צלע המתחם בתמונה הוא 8 ס”מ, וקנה המידה הוא 200 : 1 .​\n לכן, אורך צלע המתחם במציאות הוא 1,600 ס”מ שהם 16 מטרים. ​\nכעת, נחשב את שטח הריבוע:  256 מ”ר =  16 · 16​';

/* Screens 1, 2 and 5 — single-choice, same shape. Mirrors s37Submit / s38Submit / s41Submit. */
function restoreChoiceScreenUI(cfg) {
  var fb      = document.getElementById(cfg.prefix + '-feedback');
  var fbBold  = document.getElementById(cfg.prefix + '-fb-bold');
  var fbReg   = document.getElementById(cfg.prefix + '-fb-regular');
  var cont    = document.getElementById(cfg.prefix + '-continue');
  var hintBtn = document.getElementById(cfg.prefix + '-hint-btn');
  var opts    = Array.prototype.slice.call(document.querySelectorAll('[data-screen="' + cfg.screen + '"] .s5-opt'));
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (cfg.solved) {
    opts.forEach(function (o, i) {
      o.disabled = true;
      if (cfg.correct) {
        if (i === cfg.selected) { o.classList.remove('is-selected'); o.classList.add('is-correct'); }
      } else {
        o.classList.remove('is-selected');
        if (i === cfg.correctIndex)   o.classList.add('is-correct');
        else if (i === cfg.selected)  o.classList.add('is-incorrect');
      }
    });
    fbBold.textContent = cfg.correct ? cfg.boldCorrect : cfg.boldWrong;
    fbReg.innerHTML    = cfg.explanation;
    fb.classList.add(cfg.correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden     = false;
    cont.disabled = false;
    if (cfg.contText) cont.textContent = cfg.contText;
    cont.onclick  = cfg.onContinue;
    return;
  }

  if (cfg.selected !== null && cfg.selected !== undefined) {
    opts.forEach(function (o, i) { o.classList.toggle('is-selected', i === cfg.selected); });
    cont.disabled = false;
  }
  if (cfg.attempts >= 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
  }
}

function s37RestoreUI() {
  restoreChoiceScreenUI({
    prefix: 's37', screen: 1,
    solved: s37Solved, correct: s37Correct, selected: s37Selected, attempts: s37Attempts,
    correctIndex: S37_CORRECT,
    boldCorrect: 'יופי של תשובה! ​', boldWrong: 'זו טעות, לא נורא – בואו נלמד ממנה:​',
    explanation: S37_RESTORE_EXPLANATION,
    onContinue: function () { goTo(2); }
  });
}

function s38RestoreUI() {
  restoreChoiceScreenUI({
    prefix: 's38', screen: 2,
    solved: s38Solved, correct: s38Correct, selected: s38Selected, attempts: s38Attempts,
    correctIndex: S38_CORRECT,
    boldCorrect: 'נכון מאוד!​', boldWrong: 'זו טעות – בואו נבין למה:​',
    explanation: S38_RESTORE_EXPLANATION,
    onContinue: function () { goTo(3); }
  });
}

function s41RestoreUI() {
  restoreChoiceScreenUI({
    prefix: 's41', screen: 5,
    solved: s41Solved, correct: (XAPI_Q_RESULTS['003/q2'] === true),
    selected: s41Selected, attempts: s41Attempts,
    correctIndex: S41_CORRECT,
    boldCorrect: 'יופי!​', boldWrong: 'לא מדויק, בואו נבין למה:​',
    explanation: S41_RESTORE_EXPLANATION,
    contText: 'המשך',
    onContinue: function () { goToNextModule(); }
  });
}

/* Screen 4 — value input. Mirrors s40Check. */
function s40RestoreUI() {
  var fb      = document.getElementById('s40-feedback');
  var fbBold  = document.getElementById('s40-fb-bold');
  var fbReg   = document.getElementById('s40-fb-regular');
  var btn     = document.getElementById('s40-check');
  var hintBtn = document.getElementById('s40-hint-btn');
  var input   = document.getElementById('s40-answer-input');
  if (!fb || !fbBold || !fbReg || !btn) return;

  if (s40Done) {
    var correct = (XAPI_Q_RESULTS['003/q1'] === true);
    if (input) input.disabled = true;
    fbBold.textContent = correct ? 'נכון מאוד!​' : 'לא מדויק, בואו נבין למה:​';
    fbReg.innerHTML    = S40_RESTORE_EXPLANATION;
    fb.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function () { goTo(5); };
    return;
  }

  if (s40Attempts >= 1) {
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
  }
  s40OnInput();   // the live predicate for the check button
}

/* Screen 3 — drag-and-drop. Mirrors ddqCheck. ddqRender() is the replay primitive: it rebuilds
   the placed chips from ddqPlacement and locks them when ddqChecked, so the board comes back
   whether the learner was mid-placement or finished.
   The feedback is shown WITHOUT s39ShowFeedbackGated(): that gate makes the learner scroll the
   explanation before they may continue, and they already passed it in the previous session —
   re-imposing it can also strand them if scrollHeight is mismeasured before webfonts settle. */
function s39RestoreUI() {
  var fb       = document.getElementById('s39-feedback');
  var fbBold   = document.getElementById('s39-fb-bold');
  var fbReg    = document.getElementById('s39-fb-regular');
  var btn      = document.getElementById('ddq-check');
  var hintBtn  = document.getElementById('s39-hint-btn');
  var closeBtn = document.getElementById('s39-fb-close');
  if (!fb || !fbBold || !fbReg || !btn) return;

  ddqRender();

  if (!ddqDone) {
    if (ddqAttempts >= 1) {
      fbBold.textContent = 'לא מדויק, ננסה שוב?';
      fbReg.textContent  = '';
      fb.classList.add('s5-fb--incorrect', 's5-fb--try-again');
      fb.hidden = false;
      if (hintBtn) hintBtn.hidden = false;
    }
    return;   // ddqRender already set the check button from the live all-filled predicate
  }

  var correct = (XAPI_Q_RESULTS['002/q2'] === true);
  Object.keys(DDQ.correctMap).forEach(function (tId) {
    var t = document.getElementById(tId);
    if (!t) return;
    t.classList.add('s39-correct');
    if (correct) return;
    var badge = document.createElement('div');
    badge.className = ddqTargetResults[tId] ? 'ddq-badge ddq-badge--correct' : 'ddq-badge ddq-badge--wrong';
    var badgeSvgOk  = '<svg width="24" height="24" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var badgeSvgErr = '<svg width="24" height="24" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    badge.innerHTML = ddqTargetResults[tId] ? badgeSvgOk : badgeSvgErr;
    t.appendChild(badge);
  });

  fbBold.textContent = correct ? 'נכון מאוד!​' : 'לא מדויק, בואו נבין למה:​';
  fbReg.innerHTML    = S39_RESTORE_EXPLANATION;
  fb.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect', 'is-scroll');
  fb.hidden = false;
  s39GateSatisfied = true;
  if (closeBtn) closeBtn.disabled = false;
  btn.disabled    = false;
  btn.textContent = 'שנמשיך?';
  btn.onclick     = function () { goTo(4); };
}

function scheduleResumeSave() {
  if (!RESUME_ENABLED || !_resumeReady || _restoring) return;
  if (typeof window.saveState720Debounced !== 'function') return;
  try { window.saveState720Debounced(RESUME_STATE_ID, captureExecutionState()); } catch (e) {}
}
function flushResumeSave() {
  if (!RESUME_ENABLED || !_resumeReady || _restoring) return;
  if (typeof window.saveState720 !== 'function') return;
  try { window.saveState720(RESUME_STATE_ID, captureExecutionState()); } catch (e) {}
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
  var METADATA_FILE = '../metadata/methodica-math-scale-01-04.json';

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
                var _saved = (typeof window.loadState720 === 'function')
                  ? window.loadState720(RESUME_STATE_ID) : null;
                /* A document from an older build has a different shape — discard it before the
                   part comparison, so a stale blob can never redirect. */
                if (_saved && _saved.v !== RESUME_STATE_VERSION) _saved = null;
                if (_saved && _saved.part && _saved.part !== currentPartSlug()) {
                  // Learner stopped in another component — hop there, carrying slxapi+registration.
                  window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
                  return;
                }
                _resumeReady = true;
                if (_saved) { applyExecutionState(_saved); _resumed = true; }
              } catch (e) { console.error('[resume] init', e); _resumeReady = true; }
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
