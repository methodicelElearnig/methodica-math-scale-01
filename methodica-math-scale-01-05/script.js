'use strict';

function announce(msg) {
  var el = document.getElementById('a11y-announcer');
  if (!el || !msg) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = msg; }, 50);
}

const TOTAL_SCREENS = 11;
let currentScreen = 0;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
const _savedChar = localStorage.getItem('lomdaCharacter');
if (_savedChar) window.lomdaState.selectedCharacter = _savedChar;

(function preloadCharacterImages() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    ['', '_workout'].forEach(function(v) {
      var img = new Image(); img.src = './assets/images/' + c + v + '.png';
    });
    ['Happy', 'Sad'].forEach(function(mood) {
      var gif = new Image(); gif.src = './assets/images/' + c + ' GIF ' + mood + '.gif';
    });
  });
})();

/* Final assessment tracking (screens 43-52) */
let finalAssessmentScore = { correct: 0 };

/* ── Viewport scaling ── */
function scaleApp() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  const left = (window.innerWidth - 1280 * scale) / 2;
  const top = (window.innerHeight - 720 * scale) / 2;
  const el = document.getElementById('app');
  el.style.transform = `scale(${scale})`;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

window.addEventListener('resize', scaleApp);
scaleApp();

/* ── Navigation ── */
function closeLomda() {
  window.close();
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
  if (n === 0)  {
    var _c7 = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
    var _img7 = document.getElementById('s43-char-img');
    if (_img7) {
      _img7.style.opacity = '0';
      var _newSrc7 = './assets/images/' + _c7 + '_workout.png';
      _img7.onload = function() { _img7.style.opacity = '1'; };
      _img7.src = _newSrc7;
      if (_img7.complete) _img7.style.opacity = '1';
    }
  }
  if (n === 2)  { s45Enter(); }
  if (n === 4)  { s47Enter(); }
  if (n === 6)  { s49Enter(); }
  if (n === 8)  { s51Enter(); }
  if (n === 10) { s53Enter(); }
}

/* ════════════════════════════════════════════
   Screen 45 — Q4: קנה מידה של המפה
   ════════════════════════════════════════════ */

var s45Attempts = 0;
var s45Done     = false;


function s45Enter() {
  if (s45Done) return;
  finalAssessmentScore.correct = 0;
  s45Attempts = 0;
  var input = document.getElementById('s45-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var fb = document.getElementById('s45-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  var fbBold = document.getElementById('s45-fb-bold');
  var fbReg  = document.getElementById('s45-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';
  var btn = document.getElementById('s45-check');
  if (btn) { btn.disabled = true; btn.textContent = 'צדקתי?'; btn.onclick = function() { s45Check(); }; }
  var hintBtn = document.getElementById('s45-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s45-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s45OnInput() {
  if (s45Done) return;
  var input = document.getElementById('s45-answer-input');
  var btn   = document.getElementById('s45-check');
  if (btn) btn.disabled = !(input && input.value.trim() !== '');
}

function s45Check() {
  if (s45Done) { goTo(3); return; }
  var input   = document.getElementById('s45-answer-input');
  var val     = parseFloat((input ? input.value : '').replace(',', ''));
  var correct = (val === 25000);
  s45Attempts++;

  var fb      = document.getElementById('s45-feedback');
  var fbBold  = document.getElementById('s45-fb-bold');
  var fbReg   = document.getElementById('s45-fb-regular');
  var btn     = document.getElementById('s45-check');
  var hintBtn = document.getElementById('s45-hint-btn');

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s45Done = true;
    finalAssessmentScore.correct++;
    if (input) input.disabled = true;
    fbBold.textContent = 'תשובה יפה!​';
    announce('תשובה יפה!​');
    fbReg.innerHTML    = 'המרחק במציאות הוא 2 ק"מ, שהם 2,000 מטרים, שהם 200,000 ס"מ, ואורך המסלול על המסך הוא 8 ס"מ. ​<br>לכן, היחס בין אורך המסלול במפה לאורך המסלול במציאות הוא 200,000 : 8 .​<br>נצמצם ב-8, ונקבל שקנה המידה הוא 25,000 : 1 .​';
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(3); };

  } else if (s45Attempts === 1) {
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    announce('לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;

  } else {
    s45Done = true;
    if (input) input.disabled = true;
    fbBold.textContent = 'זו טעות, אבל זה בסדר גמור, כך בדיוק לומדים!​';
    announce('זו טעות, אבל זה בסדר גמור, כך בדיוק לומדים!​');
    fbReg.innerHTML    = 'המרחק במציאות הוא 2 ק"מ, שהם 2,000 מטרים, שהם 200,000 ס"מ, ואורך המסלול על המסך הוא 8 ס"מ. ​<br>לכן, היחס בין אורך המסלול במפה לאורך המסלול במציאות הוא 200,000 : 8 .​<br>נצמצם ב-8, ונקבל שקנה המידה הוא 25,000 : 1 .​';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(3); };
  }
}

function s14ToggleHelp() {
  var tooltip = document.getElementById('s14-help-tooltip');
  if (tooltip) tooltip.classList.toggle('visible');
}

function s45ToggleHelp() {
  var tooltip = document.getElementById('s45-help-tooltip');
  if (tooltip) tooltip.classList.toggle('visible');
}

function s45ToggleHint() {
  var popup = document.getElementById('s45-hint-popup');
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
}

function s45CloseHint() {
  var popup = document.getElementById('s45-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

/* ════════════════════════════════════════════
   Screen 47 — Q5ב: Multiple choice (checkboxes)
   ════════════════════════════════════════════ */

var s47Selected  = new Set();
var s47Attempts  = 0;
var s47Solved    = false;
var S47_CORRECT  = new Set([0, 2]); // Options 1 and 3 in human terms = indices 0 and 2

function s47Enter() {
  if (s47Solved) return;
  s47Selected  = new Set();
  s47Attempts  = 0;

  document.querySelectorAll('[data-screen="4"] .s47-checkbox').forEach(function(checkbox) {
    checkbox.checked  = false;
    checkbox.disabled = false;
  });
  document.querySelectorAll('[data-screen="4"] .s47-option').forEach(function(opt) {
    opt.classList.remove('is-correct', 'is-incorrect');
  });

  var fb = document.getElementById('s47-feedback');
  if (fb) { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  var fbBold = document.getElementById('s47-fb-bold');
  var fbReg  = document.getElementById('s47-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';

  var btn = document.getElementById('s47-check');
  if (btn) { btn.disabled = true; btn.textContent = 'צדקתי?'; btn.onclick = function() { s47Check(); }; }
  var hintBtn = document.getElementById('s47-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s47-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s47Toggle(idx) {
  if (s47Solved) return;
  if (s47Selected.has(idx)) {
    s47Selected.delete(idx);
  } else {
    s47Selected.add(idx);
  }
  s47UpdateCheckBtn();
}

function s47UpdateCheckBtn() {
  var btn = document.getElementById('s47-check');
  if (btn) btn.disabled = (s47Selected.size === 0);
}

function s47Check() {
  if (s47Solved) { goTo(5); return; }

  var correct = (s47Selected.size === S47_CORRECT.size &&
                 Array.from(s47Selected).every(i => S47_CORRECT.has(i)));
  s47Attempts++;

  var fb      = document.getElementById('s47-feedback');
  var fbBold  = document.getElementById('s47-fb-bold');
  var fbReg   = document.getElementById('s47-fb-regular');
  var btn     = document.getElementById('s47-check');
  var hintBtn = document.getElementById('s47-hint-btn');
  var checkboxes = Array.from(document.querySelectorAll('[data-screen="4"] .s47-checkbox'));

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s47Solved = true;
    finalAssessmentScore.correct++;
    checkboxes.forEach(function(cb) { cb.disabled = true; });
    fbBold.textContent = 'מצוין!​';
    announce('מצוין!​');
    fbReg.innerHTML    = 'אורך הכבלים הכולל הוא 1,050 מטרים. מרחק הפריסה הנדרש הוא 1 ק"מ (שהם 1,000 מטרים), ולכן האפשרות הראשונה נכונה.​<br>קנה המידה הוא 25,000 : 1 . כלומר, כל 1 ס"מ במפה מייצג 250 מטרים במציאות.​<br>המרחק בין האוהל לאגם הוא 1 ק"מ, שהם 1,000 מטרים. ​<br>אם 250 מטרים במציאות הם 1 ס"מ במפה, ​<br>1,000 מטרים במציאות הם 4 ס"מ במפה.​';
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(5); };

  } else if (s47Attempts === 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    s47Selected = new Set();
    checkboxes.forEach(function(cb) { cb.checked = false; });
    s47UpdateCheckBtn();

  } else {
    s47Solved = true;
    checkboxes.forEach(function(cb) {
      var idx   = parseInt(cb.getAttribute('data-index'), 10);
      var label = cb.closest('.s47-option');
      if (S47_CORRECT.has(idx)) {
        cb.checked = true;
        if (label) label.classList.add('is-correct');
      } else if (s47Selected.has(idx)) {
        cb.checked = false;
        if (label) label.classList.add('is-incorrect');
      }
      cb.disabled = true;
    });
    fbBold.textContent = 'זה לא מדויק. נסביר:​';
    announce('זה לא מדויק. נסביר:​');
    fbReg.innerHTML    = 'אורך הכבלים הכולל הוא 1,050 מטרים. מרחק הפריסה הנדרש הוא 1 ק"מ (שהם 1,000 מטרים), ולכן האפשרות הראשונה נכונה.​<br>קנה המידה הוא 25,000 : 1 . כלומר, כל 1 ס"מ במפה מייצג 250 מטרים במציאות.​<br>המרחק בין האוהל לאגם הוא 1 ק"מ, שהם 1,000 מטרים. ​<br>אם 250 מטרים במציאות הם 1 ס"מ במפה, ​<br>1,000 מטרים במציאות הם 4 ס"מ במפה.​';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function() { goTo(5); };
  }
}

function s47ToggleHint() {
  var popup = document.getElementById('s47-hint-popup');
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
}

function s47CloseHint() {
  var popup = document.getElementById('s47-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

/* ════════════════════════════════════════════
   Screen 49 — ג: Zoom effect on scale
   ════════════════════════════════════════════ */

var s49Selected  = null;
var s49Attempts  = 0;
var s49Solved    = false;
var S49_CORRECT  = 1; // Noa (option index 1)

function s49Enter() {
  if (s49Solved) return;
  s49Selected  = null;
  s49Attempts  = 0;

  document.querySelectorAll('[data-screen="6"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });

  var fb = document.getElementById('s49-feedback');
  if (fb) { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  var fbBold = document.getElementById('s49-fb-bold');
  var fbReg  = document.getElementById('s49-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';

  var cont = document.getElementById('s49-continue');
  if (cont) { cont.disabled = true; cont.textContent = 'צדקתי?'; cont.onclick = function() { s49Submit(); }; }
  var hintBtn = document.getElementById('s49-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s49-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s49Select(idx) {
  if (s49Solved) return;
  s49Selected = idx;
  document.querySelectorAll('[data-screen="6"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var cont = document.getElementById('s49-continue');
  if (cont) cont.disabled = false;
}

function s49ToggleHint() {
  var popup = document.getElementById('s49-hint-popup');
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
}

function s49CloseHint() {
  var popup = document.getElementById('s49-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s49Submit() {
  if (s49Solved) { goTo(7); return; }
  if (s49Selected === null) return;

  var correct = (s49Selected === S49_CORRECT);
  s49Attempts++;

  var fb      = document.getElementById('s49-feedback');
  var fbBold  = document.getElementById('s49-fb-bold');
  var fbReg   = document.getElementById('s49-fb-regular');
  var cont    = document.getElementById('s49-continue');
  var hintBtn = document.getElementById('s49-hint-btn');
  var opts    = Array.from(document.querySelectorAll('[data-screen="6"] .s5-opt'));

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s49Solved = true;
    finalAssessmentScore.correct++;
    opts[s49Selected].classList.remove('is-selected');
    opts[s49Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent = 'זה נכון מאוד!​';
    announce('זה נכון מאוד!​');
    fbReg.innerHTML    = 'זום הגדלה עובד הפוך מהאינטואיציה: ​<br>אם התמונה גדלה פי 4, המספר בקנה המידה המייצג את המציאות קטן פי 4. ​<br> במקום קנה מידה של 25,000 : 1 נקבל קנה מידה של <br>6,250 : 1 (6,250 = 4 : 25,000)';
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'שנמשיך?';
    cont.onclick     = function() { goTo(7); };

  } else if (s49Attempts === 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    opts[s49Selected].classList.remove('is-selected');
    s49Selected = null;
    cont.disabled = true;

  } else {
    s49Solved = true;
    opts.forEach(function(o, i) {
      if (i === S49_CORRECT)      o.classList.add('is-correct');
      else if (i === s49Selected) o.classList.add('is-incorrect');
      o.disabled = true;
    });
    fbBold.textContent = 'זה לא מדויק. נסביר:​';
    announce('זה לא מדויק. נסביר:​');
    fbReg.innerHTML    = 'זום הגדלה עובד הפוך מהאינטואיציה: ​<br>אם התמונה גדלה פי 4, המספר בקנה המידה המייצג את המציאות קטן פי 4. ​<br> במקום קנה מידה של 25,000 : 1 נקבל קנה מידה של <br>6,250 : 1 (6,250 = 4 : 25,000)​​';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'שנמשיך?';
    cont.onclick     = function() { goTo(7); };
  }
}

/* ════════════════════════════════════════════
   Screen 51 — ד: Helicopter landing clearance
   ════════════════════════════════════════════ */

var s51Selected  = null;
var s51Attempts  = 0;
var s51Solved    = false;
var S51_CORRECT  = 0; // Option 1 (רחפן א')

function s51Enter() {
  if (s51Solved) return;
  s51Selected  = null;
  s51Attempts  = 0;

  document.querySelectorAll('[data-screen="8"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });

  var fb = document.getElementById('s51-feedback');
  if (fb) { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  var fbBold = document.getElementById('s51-fb-bold');
  var fbReg  = document.getElementById('s51-fb-regular');
  if (fbBold) fbBold.textContent = '';
  if (fbReg)  fbReg.textContent  = '';

  var cont = document.getElementById('s51-continue');
  if (cont) { cont.disabled = true; cont.textContent = 'צדקתי?'; cont.onclick = function() { s51Submit(); }; }
  var hintBtn = document.getElementById('s51-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s51-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s51Select(idx) {
  if (s51Solved) return;
  s51Selected = idx;
  document.querySelectorAll('[data-screen="8"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var cont = document.getElementById('s51-continue');
  if (cont) cont.disabled = false;
}

function s51ToggleHint() {
  var popup = document.getElementById('s51-hint-popup');
  if (popup) { popup.hidden = !popup.hidden; if (!popup.hidden) announce('רמז נפתח'); }
}

function s51CloseHint() {
  var popup = document.getElementById('s51-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s51Submit() {
  if (s51Solved) { goTo(9); return; }
  if (s51Selected === null) return;

  var correct = (s51Selected === S51_CORRECT);
  s51Attempts++;

  var fb      = document.getElementById('s51-feedback');
  var fbBold  = document.getElementById('s51-fb-bold');
  var fbReg   = document.getElementById('s51-fb-regular');
  var cont    = document.getElementById('s51-continue');
  var hintBtn = document.getElementById('s51-hint-btn');
  var opts    = Array.from(document.querySelectorAll('[data-screen="8"] .s5-opt'));

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s51Solved = true;
    finalAssessmentScore.correct++;
    opts[s51Selected].classList.remove('is-selected');
    opts[s51Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent = 'בדיוק!​';
    announce('בדיוק!​');
    fbReg.innerHTML    = 'רחפן א: ס"מ אחד בצילום מייצג 6,250 ס"מ במציאות, שהם 62.5 מטרים. ​<br>רחפן ב: ס"מ אחד בצילום מייצג 2,000 ס"מ במציאות, ולכן ​2 ס"מ בצילום מייצגים 4,000 ס"מ במציאות, שהם 40 מטרים. ​<br>האורך של קרחת היער שצילם רחפן א גדול מ-50  מטרים, ולכן היא זו שמתאימה להנחתה.​';
    fb.classList.add('s5-fb--correct');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'שנמשיך?';
    cont.onclick     = function() { goTo(9); };

  } else if (s51Attempts === 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    announce('זה לא מדויק, ננסה שוב?');
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    opts[s51Selected].classList.remove('is-selected');
    s51Selected = null;
    cont.disabled = true;

  } else {
    s51Solved = true;
    opts.forEach(function(o, i) {
      if (i === S51_CORRECT)      o.classList.add('is-correct');
      else if (i === s51Selected) o.classList.add('is-incorrect');
      o.disabled = true;
    });
    fbBold.textContent = 'זה לא מדויק. בואו נראה למה:​';
    announce('זה לא מדויק. בואו נראה למה:​');
    fbReg.innerHTML    = 'רחפן א: ס"מ אחד בצילום מייצג 6,250 ס"מ במציאות, שהם 62.5 מטרים. ​<br>רחפן ב: ס"מ אחד בצילום מייצג 2,000 ס"מ במציאות, ולכן​2 ס"מ בצילום מייצגים 4,000 ס"מ במציאות, שהם 40 מטרים. ​<br>האורך של קרחת היער שצילם רחפן א גדול מ-50  מטרים, ולכן היא זו שמתאימה להנחתה.​';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'שנמשיך?';
    cont.onclick     = function() { goTo(9); };
  }
}

/* ════════════════════════════════════════════
   Screen 53 — Final Assessment Result
   ════════════════════════════════════════════ */

function s53Enter() {
  var vid       = document.getElementById('s53-gif');
  var character = localStorage.getItem('lomdaCharacter') || 'text';
  var charNum   = character === 'video' ? '2' : '1';

  if (vid) {
    vid.src = './assets/videos/Character' + charNum + ' VID Happy.mp4';
    vid.play();
  }
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

// Escape key closes report modals
document.addEventListener('keydown', function(event) {
  if (event.key !== 'Escape') return;
  var confirmModal = document.getElementById('report-confirm-modal');
  var reportModal  = document.getElementById('report-modal');
  if (!confirmModal.hasAttribute('hidden')) { forceCloseReportModal(); return; }
  if (!reportModal.hasAttribute('hidden'))  { tryCloseReportModal();   return; }
});

function s5FbClose(id) {
  var el = document.getElementById(id);
  if (el) el.hidden = true;
}

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

/* Screen 0 is active by default (module entry point) — run its enter logic
   once on load, since goTo() (which normally triggers it) never fires for it. */
document.addEventListener('DOMContentLoaded', function() {
  resetScreenState(currentScreen);
});
