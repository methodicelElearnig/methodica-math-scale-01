'use strict';




var TOTAL_SCREENS = 6;
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



/* ── Navigation ── */
function goToNextModule() {
  var _n = xapiCorrectCount();
  xapiCompleteComponent({ success: _n >= 4, score: { scaled: _n / 5 } });
  /* Resume: point the state document at the component being entered, before navigating. */
  writeForwardState('methodica-math-scale-01-05', '#screen=5');
  window.location.href = '../methodica-math-scale-01-05/index.html' + window.location.search;
}


function resetScreenState(n) {
  if (n === 0)  { s36Enter(); }
  if (n === 1)  { s37Enter(); }
  if (n === 2)  { s38Enter(); }
  if (n === 3)  { s39Enter(); }
  if (n === 4)  { s40Enter(); }
  if (n === 5)  { s41Enter(); }
}




/* ── Screen 38: תרגול מתקדם — שאלה 2א ── */
var s38Selected = null;
var s38Attempts = 0;
var s38Solved   = false;
var s38Correct  = false;
var S38_CORRECT = 0;

function s38Enter() {
  if (s38Solved) {
    updateNavBar(
      document.querySelector('#s2 .s18-nav'), 2,
      [s37Solved ? (s37Correct ? 'correct' : 'wrong') : null, s38Correct ? 'correct' : 'wrong', null],
      [1, 2, 4]
    );
    return;
  }
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
      xapiRequestedHint('002', 'q1');
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
  xapiAnswered('002', 'q1', correct, correct || s38Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="2"] .s5-opt')[s38Selected]));

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
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent   = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden           = false;
    if (hintBtn) hintBtn.hidden = false;
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
  if (s37Solved) {
    updateNavBar(
      document.querySelector('#s1 .s18-nav'), 1,
      [s37Correct ? 'correct' : 'wrong', null, null],
      [1, 2, 4]
    );
    return;
  }
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
      xapiRequestedHint('001', 'q1');
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
  xapiAnswered('001', 'q1', correct, correct || s37Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="1"] .s5-opt')[s37Selected]));

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
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent   = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden           = false;
    if (hintBtn) hintBtn.hidden = false;
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
    t.classList.remove('s39-correct', 's39-incorrect');
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
      var cardText = document.createElement('span');
      cardText.className = 'ddq-placed-card-text';
      cardText.textContent = placedId.replace('drag-', '');
      card.appendChild(cardText);
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
  xapiAnswered('002', 'q2', allCorrect, allCorrect || ddqAttempts >= 2,
    Object.keys(ddqPlacement).filter(function(k){ return ddqPlacement[k] !== 'source'; }).map(function(k){ return k + ' -> ' + ddqPlacement[k]; }).join(' | '));

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
      t.classList.add(targetResults[tId] ? 's39-correct' : 's39-incorrect');
      var badge = document.createElement('div');
      badge.className = targetResults[tId] ? 'ddq-badge ddq-badge--correct' : 'ddq-badge ddq-badge--wrong';
      var badgeSvgOk  = '<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#609E12"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var badgeSvgErr = '<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      badge.innerHTML = targetResults[tId] ? badgeSvgOk : badgeSvgErr;
      var placedCard = t.querySelector('.ddq-placed-card');
      if (placedCard) placedCard.prepend(badge); else t.appendChild(badge);
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
      xapiRequestedHint('002', 'q2');
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
  xapiAnswered('003', 'q1', correct, correct || s40Attempts >= 2,
    String(val));

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
      xapiRequestedHint('003', 'q1');
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
      xapiRequestedHint('003', 'q2');
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
  xapiAnswered('003', 'q2', correct, correct || s41Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="5"] .s5-opt')[s41Selected]));

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
  try { ruler.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
}

document.addEventListener('pointermove', function(e) {
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

document.addEventListener('pointerup', function() {
  if (!s41RulerDrag) return;
  var ruler = document.getElementById('s41-ruler');
  if (ruler) ruler.style.cursor = 'grab';
  s41RulerDrag = null;
});
document.addEventListener('pointercancel', function() {
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



/* Items that carry a graded question IN CODE. */
var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1 };



/* Report modal, draggable feedback, a11y wiring and image zoom: ../unit-js/ */


/* ── Per-part boot hook ──
   Called by ../unit-js/90-boot.js, the single place startup side effects run from.
   These used to be a top-level IIFE and DOMContentLoaded handlers. */
function partBoot() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    var img = new Image(); img.src = './assets/images/' + c + '.png';
  });

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

/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   One State document per unit, keyed by window.XAPI_UNIT_ID.
   Three advanced questions; question 2 part ב is a drag-and-drop placement map.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).











/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every finished
   screen re-reachable, and the library's dedupe only spans a single page load. `initialized` is
   deliberately NOT guarded: the platform asks for it on every entry.





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

/* This part's payload only. `v` and `part` live on the enclosing v3 document, not in here. */
function capturePartPayload() {
  var st = {
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

function applyResumeDom(st) {
  if (!st || !st.inputs) return;
  RESUME_INPUT_IDS.forEach(function (id) {
    if (typeof st.inputs[id] !== 'string') return;
    var el = document.getElementById(id);
    if (el) el.value = st.inputs[id];
  });
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
    t.classList.add(correct ? 's39-correct' : (ddqTargetResults[tId] ? 's39-correct' : 's39-incorrect'));
    if (correct) return;
    var badge = document.createElement('div');
    badge.className = ddqTargetResults[tId] ? 'ddq-badge ddq-badge--correct' : 'ddq-badge ddq-badge--wrong';
    var badgeSvgOk  = '<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#609E12"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var badgeSvgErr = '<svg width="26" height="26" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    badge.innerHTML = ddqTargetResults[tId] ? badgeSvgOk : badgeSvgErr;
    var placedCard = t.querySelector('.ddq-placed-card');
    if (placedCard) placedCard.prepend(badge); else t.appendChild(badge);
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



/* xAPI loader: ../unit-js/50-loader.js. This component supplies its metadata file
   and, where it needs one, an onXapiReady() hook. */
var XAPI_METADATA_FILE = '../metadata/methodica-math-scale-01-04.json';
