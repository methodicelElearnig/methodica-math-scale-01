'use strict';

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
  window.location.href = '../methodica-math-scale-01-05/index.html';
}

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const nextScreen = document.querySelector(`[data-screen="${n}"]`);
  if (!nextScreen) return;
  nextScreen.classList.add('active');
  currentScreen = n;
  resetScreenState(n);
  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
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
  document.getElementById('s38-fb-icon').innerHTML      = '';
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
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
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

  var fb      = document.getElementById('s38-feedback');
  var fbBold  = document.getElementById('s38-fb-bold');
  var fbReg   = document.getElementById('s38-fb-regular');
  var fbIcon  = document.getElementById('s38-fb-icon');
  var cont    = document.getElementById('s38-continue');
  var hintBtn = document.getElementById('s38-hint-btn');
  var opts    = document.querySelectorAll('[data-screen="2"] .s5-opt');

  var checkSvg    = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var xSvg        = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
    fbIcon.innerHTML    = checkSvg;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(3); };
  } else if (s38Attempts === 1) {
    opts[s38Selected].classList.remove('is-selected');
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent   = '';
    fbIcon.innerHTML    = xSvg;
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
    fbIcon.innerHTML    = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(3); };
  }
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
  document.getElementById('s37-fb-icon').innerHTML      = '';
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
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
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

  var fb      = document.getElementById('s37-feedback');
  var fbBold  = document.getElementById('s37-fb-bold');
  var fbReg   = document.getElementById('s37-fb-regular');
  var fbIcon  = document.getElementById('s37-fb-icon');
  var cont    = document.getElementById('s37-continue');
  var hintBtn = document.getElementById('s37-hint-btn');
  var opts    = document.querySelectorAll('[data-screen="1"] .s5-opt');

  var checkSvg    = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var xSvg        = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
    fbIcon.innerHTML    = checkSvg;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(2); };
  } else if (s37Attempts === 1) {
    opts[s37Selected].classList.remove('is-selected');
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent   = '';
    fbIcon.innerHTML    = xSvg;
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
    fbIcon.innerHTML    = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden     = false;
    cont.disabled = false;
    cont.onclick  = function() { goTo(2); };
  }
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
  var fbIcon = document.getElementById('s39-fb-icon');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  if (fbIcon) fbIcon.innerHTML   = '';
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

  var fb      = document.getElementById('s39-feedback');
  var fbBold  = document.getElementById('s39-fb-bold');
  var fbReg   = document.getElementById('s39-fb-regular');
  var fbIcon  = document.getElementById('s39-fb-icon');
  var btn     = document.getElementById('ddq-check');
  var hintBtn = document.getElementById('s39-hint-btn');

  var checkSvg = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var xSvg     = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect', 's5-fb--try-again');

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
    fbReg.innerHTML  = 'נמיר את המידות במציאות לסנטימטרים ונקבל אורך 1,200 ס"מ וגובה 600 ס"מ. ​<br>בתמונה של יובל (קנה מידה 1:50) נחלק את המידות ב-50 ונקבל: אורך 24 ס"מ, גובה 12 ס"מ.​<br>בתמונה של ליאור (קנה מידה 1:20) נחלק את המידות ב-20 ונקבל: אורך 60 ס"מ, גובה 30 ס"מ.​';
    fbIcon.innerHTML   = checkSvg;
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(4); };

  } else if (ddqAttempts === 1) {
    /* First wrong — reset chips to source so learner starts fresh */
    Object.keys(ddqPlacement).forEach(function(k) { ddqPlacement[k] = 'source'; });
    ddqRender();
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    announce('לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fbIcon.innerHTML   = xSvg;
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
    fbReg.innerHTML  = 'נמיר את המידות במציאות לסנטימטרים ונקבל אורך 1,200 ס"מ וגובה 600 ס"מ. ​<br>בתמונה של יובל (קנה מידה 1:50) נחלק את המידות ב-50 ונקבל: אורך 24 ס"מ, גובה 12 ס"מ.​<br>בתמונה של ליאור (קנה מידה 1:20) נחלק את המידות ב-20 ונקבל: אורך 60 ס"מ, גובה 30 ס"מ.​';
    fbIcon.innerHTML   = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(4); };
  }
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
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
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
  var fbIcon = document.getElementById('s40-fb-icon');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  if (fbIcon) fbIcon.innerHTML   = '';
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

  var fb      = document.getElementById('s40-feedback');
  var fbBold  = document.getElementById('s40-fb-bold');
  var fbReg   = document.getElementById('s40-fb-regular');
  var fbIcon  = document.getElementById('s40-fb-icon');
  var btn     = document.getElementById('s40-check');
  var hintBtn = document.getElementById('s40-hint-btn');

  var checkSvg = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var xSvg     = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s40Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'נכון מאוד!​';
    announce('נכון מאוד!​');
    fbReg.innerHTML    = 'קנה המידה הוא 1:200, לכן 12 ס״מ בתמונה מייצגים  2,400 ס"מ שהם 24 מטרים במציאות. העמדה צריכה להיות ברבע הדרך, ולכן נחשב <sup>1</sup>/<sub>4</sub> מ-24 מטרים, ונקבל 6 מטרים.​';
    fbIcon.innerHTML   = checkSvg;
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(5); };

  } else if (s40Attempts === 1) {
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    announce('לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fbIcon.innerHTML   = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    if (input) { input.value = ''; input.disabled = false; }
    btn.disabled = true;

  } else {
    s40Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'לא מדויק, בואו נבין למה:​';
    announce('לא מדויק, בואו נבין למה:​');
    fbReg.innerHTML    = 'קנה המידה הוא 1:200, לכן 12 ס״מ בתמונה מייצגים  2,400 ס"מ שהם 24 מטרים במציאות. העמדה צריכה להיות ברבע הדרך, ולכן נחשב <sup>1</sup>/<sub>4</sub> מ-24 מטרים ונקבל 6 מטרים.​';
    fbIcon.innerHTML   = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(5); };
  }
}

function s40ToggleHint() {
  var popup = document.getElementById('s40-hint-popup');
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
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
  var fbIcon = document.getElementById('s41-fb-icon');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  if (fbIcon) fbIcon.innerHTML   = '';

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
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
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

  var fb      = document.getElementById('s41-feedback');
  var fbBold  = document.getElementById('s41-fb-bold');
  var fbReg   = document.getElementById('s41-fb-regular');
  var fbIcon  = document.getElementById('s41-fb-icon');
  var cont    = document.getElementById('s41-continue');
  var hintBtn = document.getElementById('s41-hint-btn');
  var opts    = Array.from(document.querySelectorAll('[data-screen="5"] .s5-opt'));

  var checkSvg = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#58A700"/><path d="M8 16.5L13.5 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var xSvg     = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s41Solved = true;
    opts[s41Selected].classList.remove('is-selected');
    opts[s41Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent = 'יופי!​';
    announce('יופי!​');
    fbReg.innerHTML    = 'אורך צלע המתחם בתמונה הוא 8 ס”מ, וקנה המידה הוא 200 : 1.​\nלכן, אורך צלע המתחם במציאות הוא 1,600 ס”מ שהם 16 מטרים. ​\nכעת, נחשב את שטח הריבוע:  256 מ”ר =  16 · 16​';
    fbIcon.innerHTML   = checkSvg;
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'המשך';
    cont.onclick  = function() { goToNextModule(); };

  } else if (s41Attempts === 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fbIcon.innerHTML   = xSvg;
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
    fbReg.innerHTML    = 'אורך צלע המתחם בתמונה הוא 8 ס”מ, וקנה המידה הוא 200 : 1.​\nלכן, אורך צלע המתחם במציאות הוא 1,600 ס”מ שהם 16 מטרים. ​\nכעת, נחשב את שטח הריבוע:  256 מ”ר =  16 · 16​';
    fbIcon.innerHTML   = xSvg;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'המשך';
    cont.onclick  = function() { goToNextModule(); };
  }
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
  ruler.style.left = (s41RulerDrag.startLeft + dx) + 'px';
  ruler.style.top  = (s41RulerDrag.startTop  + dy) + 'px';
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
    if (input) { input.value = ''; input.disabled = false; }
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




