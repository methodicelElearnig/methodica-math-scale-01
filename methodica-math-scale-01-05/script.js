'use strict';




var TOTAL_SCREENS = 11;
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


/* ── Navigation ── */
function closeLomda() {
  window.close();
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
  /* finalAssessmentScore is not zeroed here. It is write-only in this component — peakResult()
     scores from XAPI_Q_RESULTS — and zeroing it on every unguarded entry to this screen would
     discard the running tally the moment restored state puts the learner back here. */
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
  xapiAnswered('001', 'q1', correct, correct || s45Attempts >= 2,
    String(val));

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
  /* Resume: commit the answer synchronously. A debounced save here could still be in flight
     when the learner navigates, and land after the next screen's own write. */
  flushResumeSave();
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
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      xapiRequestedHint('001', 'q1');
    }
  }
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
  xapiAnswered('001', 'q2', correct, correct || s47Attempts >= 2,
    Array.from(s47Selected).sort(function(a,b){ return a - b; }).map(function(i){ return xapiAnswerText(document.querySelectorAll('[data-screen="4"] .s47-option')[i]); }).join(' | '));

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
  flushResumeSave();   // see s45Check
}

function s47ToggleHint() {
  var popup = document.getElementById('s47-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      xapiRequestedHint('001', 'q2');
    }
  }
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
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      xapiRequestedHint('001', 'q3');
    }
  }
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
  xapiAnswered('001', 'q3', correct, correct || s49Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="6"] .s5-opt')[s49Selected]));

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
  flushResumeSave();   // see s45Check
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
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      xapiRequestedHint('001', 'q4');
    }
  }
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
  xapiAnswered('001', 'q4', correct, correct || s51Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="8"] .s5-opt')[s51Selected]));

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
  flushResumeSave();   // see s45Check
}

/* ════════════════════════════════════════════
   Screen 53 — Final Assessment Result
   ════════════════════════════════════════════ */

function s53Enter() {
  var vid       = document.getElementById('s53-gif');
  var character = ((typeof getUnitCharacter === 'function')
    ? getUnitCharacter()
    : localStorage.getItem('lomdaCharacter')) || 'text';
  var charNum   = character === 'video' ? '2' : '1';

  if (vid) {
    vid.src = './assets/videos/Character' + charNum + ' VID Happy.mp4';
    vid.play();
  }

  /* xAPI: this is the last screen of the last component, so it closes both the component and the
     whole unit. goTo() already ran xapiOnScreen(10) — screen 10 maps to null, which emitted the
     item 'completed' carrying peakResult() — so only the component and unit remain.
     The unit statement deliberately carries no result: the library reports unit scope without one,
     and a unit-wide score would have to invent a weighting across five components. */
  /* The finale is entered on screen arrival, not on a button, so a learner who backs out of the
     unit and walks forward again lands here a second time. Both statements are one-shot: 'unit'
     is a ledger key of its own because it belongs to the unit, not to this component. */
  xapiCompleteComponent(peakResult());
  xapiCompleteUnit(null);
}



/* ═══════════════════ xAPI (720) — item scope + question ids ═══════════════════
   Everything below is generic across the five components except SCREEN_TO_SUBCONTENT,
   XAPI_COMP_SLUG and XAPI_EVAL_ITEMS. */

/* One catalog item (שאלת השיא) spans the whole component. The narrative interstitials
   (1,3,5,7,9) map to the SAME item on purpose: that keeps the item open across all four
   sub-questions, so the single allowed item 'completed' carries the full 4-part result
   instead of latching a partial score the first time the learner steps onto a narrative
   screen. */
var SCREEN_TO_SUBCONTENT = {
  0: null,           // recap / intro
  1: ['001', 1],     // scenario setup
  2: ['001', 2],     // sub-question א
  3: ['001', 3],
  4: ['001', 4],     // sub-question ב
  5: ['001', 5],
  6: ['001', 6],     // sub-question ג
  7: ['001', 7],
  8: ['001', 8],     // sub-question ד
  9: ['001', 9],
  10: null           // unit finale
};

var XAPI_COMP_SLUG = 'methodica-math-scale-01-05';
/* Component and item ids must match metadata/*.json byte-for-byte — that convention keeps a
   TRAILING SLASH on unit, component and item ids (but not on question ids). */
var XAPI_COMP_ID   = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';



/* Items that carry a graded question IN CODE. */
var XAPI_EVAL_ITEMS = { '001': 1 };


/* The שאלת-שיא item passes at >= 3 of its 4 sub-questions (stated in the item's own
   metadata). Supplying an explicit result overrides the library's all-correct AND, which
   would report success:false at 3/4. */
var PEAK_PASS_MIN = 3;
function peakResult(){
  var n = xapiCorrectCount();
  return { success: n >= PEAK_PASS_MIN, score: { scaled: n / 4 } };
}
/* Read by ../unit-js/20-xapi.js when it closes an item. This is the only component that defines
   it; everywhere else xapiItemResult() returns null. */
var XAPI_ITEM_RESULT = { '001': peakResult };


/* Report modal, draggable feedback, a11y wiring and image zoom: ../unit-js/ */

/* Screen 0 is active by default (module entry point) — run its enter logic
   once on load, since goTo() (which normally triggers it) never fires for it. */


/* ── Per-part boot hook ──
   Called by ../unit-js/90-boot.js, the single place startup side effects run from.
   These used to be a top-level IIFE and DOMContentLoaded handlers. */
function partBoot() {
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

  resetScreenState(currentScreen);
}

/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   One State document per unit, keyed by window.XAPI_UNIT_ID.
   One four-part peak question; s47 keeps its selection in a Set, which JSON cannot hold.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).











/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every finished
   screen re-reachable, and the library's dedupe only spans a single page load. `initialized` is
   deliberately NOT guarded: the platform asks for it on every entry.





/* Variables copied verbatim in both directions. */
var RESUME_PLAIN_VARS = ['s45Attempts', 's45Done', 's47Attempts', 's47Solved', 's49Selected', 's49Attempts', 's49Solved', 's51Selected', 's51Attempts', 's51Solved'];

/* Typed answers live only in the DOM — no variable holds them — so they travel by element
   id. Reading them at capture time is safe: no submit branch clears these inputs, it only
   disables them. */
var RESUME_INPUT_IDS = ['s45-answer-input'];

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
    s47Selected: Array.from(s47Selected),
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

/* Both restore passes run through here, so they can never drift apart. The parameter must
   stay named `st` — the eval below assigns through that name. */
function applyResumeVars(st) {
  if (st.qResults) XAPI_Q_RESULTS = Object.assign({}, st.qResults);
  if (st.s47Selected) s47Selected = new Set(st.s47Selected);
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
   Each painter mirrors the DOM writes of its sNNCheck/sNNSubmit branches and NOTHING else —
   no state mutation, no statements, no announce(), and never finalAssessmentScore. Two axes,
   not four branches: solved picks the terminal look, otherwise an attempt already spent shows
   the interim feedback AND the current selection is repainted, because those co-occur.
   Correctness comes from XAPI_Q_RESULTS — this component declares no sNNCorrect variables,
   and the attempt count must never be used to infer it. */
function restoreScreenUI(n) {
  try {
    if (n === 2)  s45RestoreUI();
    if (n === 4)  s47RestoreUI();
    if (n === 6)  s49RestoreUI();
    if (n === 8)  s51RestoreUI();
  } catch (e) { console.error('[resume] restoreScreenUI', e); }
}

/* Explanation bodies, copied from the sNNCheck branches they mirror. */
var S45_RESTORE_EXPLANATION = 'המרחק במציאות הוא 2 ק"מ, שהם 2,000 מטרים, שהם 200,000 ס"מ, ואורך המסלול על המסך הוא 8 ס"מ. ​<br>לכן, היחס בין אורך המסלול במפה לאורך המסלול במציאות הוא 200,000 : 8 .​<br>נצמצם ב-8, ונקבל שקנה המידה הוא 25,000 : 1 .​';
var S47_RESTORE_EXPLANATION = 'אורך הכבלים הכולל הוא 1,050 מטרים. מרחק הפריסה הנדרש הוא 1 ק"מ (שהם 1,000 מטרים), ולכן האפשרות הראשונה נכונה.​<br>קנה המידה הוא 25,000 : 1 . כלומר, כל 1 ס"מ במפה מייצג 250 מטרים במציאות.​<br>המרחק בין האוהל לאגם הוא 1 ק"מ, שהם 1,000 מטרים. ​<br>אם 250 מטרים במציאות הם 1 ס"מ במפה, ​<br>1,000 מטרים במציאות הם 4 ס"מ במפה.​';
var S49_RESTORE_EXPLANATION = 'זום הגדלה עובד הפוך מהאינטואיציה: ​<br>אם התמונה גדלה פי 4, המספר בקנה המידה המייצג את המציאות קטן פי 4. ​<br> במקום קנה מידה של 25,000 : 1 נקבל קנה מידה של <br>6,250 : 1 (6,250 = 4 : 25,000)';
var S51_RESTORE_EXPLANATION = 'רחפן א: ס"מ אחד בצילום מייצג 6,250 ס"מ במציאות, שהם 62.5 מטרים. ​<br>רחפן ב: ס"מ אחד בצילום מייצג 2,000 ס"מ במציאות, ולכן ​2 ס"מ בצילום מייצגים 4,000 ס"מ במציאות, שהם 40 מטרים. ​<br>האורך של קרחת היער שצילם רחפן א גדול מ-50  מטרים, ולכן היא זו שמתאימה להנחתה.​';

/* Screen 2 — value input. Mirrors s45Check. */
function s45RestoreUI() {
  var fb      = document.getElementById('s45-feedback');
  var fbBold  = document.getElementById('s45-fb-bold');
  var fbReg   = document.getElementById('s45-fb-regular');
  var btn     = document.getElementById('s45-check');
  var hintBtn = document.getElementById('s45-hint-btn');
  var input   = document.getElementById('s45-answer-input');
  if (!fb || !fbBold || !fbReg || !btn) return;

  if (s45Done) {
    var correct = (XAPI_Q_RESULTS['001/q1'] === true);
    if (input) input.disabled = true;
    fbBold.textContent = correct ? 'תשובה יפה!​' : 'זו טעות, אבל זה בסדר גמור, כך בדיוק לומדים!​';
    fbReg.innerHTML    = S45_RESTORE_EXPLANATION;
    fb.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function () { goTo(3); };
    return;
  }

  if (s45Attempts >= 1) {
    fbBold.textContent = 'לא מדויק, ננסה שוב?';
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
  }
  s45OnInput();   // the live predicate for the check button
}

/* Screen 4 — multi-select checkboxes. Mirrors s47Check. */
function s47RestoreUI() {
  var fb      = document.getElementById('s47-feedback');
  var fbBold  = document.getElementById('s47-fb-bold');
  var fbReg   = document.getElementById('s47-fb-regular');
  var btn     = document.getElementById('s47-check');
  var hintBtn = document.getElementById('s47-hint-btn');
  var boxes   = Array.prototype.slice.call(document.querySelectorAll('[data-screen="4"] .s47-checkbox'));
  if (!fb || !fbBold || !fbReg || !btn) return;

  if (s47Solved) {
    var correct = (XAPI_Q_RESULTS['001/q2'] === true);
    boxes.forEach(function (cb) {
      var idx   = parseInt(cb.getAttribute('data-index'), 10);
      var label = cb.closest('.s47-option');
      if (correct) {
        cb.checked = s47Selected.has(idx);          // the learner's own ticks, which were right
      } else if (S47_CORRECT.has(idx)) {
        cb.checked = true;
        if (label) label.classList.add('is-correct');
      } else if (s47Selected.has(idx)) {
        cb.checked = false;
        if (label) label.classList.add('is-incorrect');
      }
      cb.disabled = true;
    });
    fbBold.textContent = correct ? 'מצוין!​' : 'זה לא מדויק. נסביר:​';
    fbReg.innerHTML    = S47_RESTORE_EXPLANATION;
    fb.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden = false;
    btn.disabled    = false;
    btn.textContent = 'שנמשיך?';
    btn.onclick     = function () { goTo(5); };
    return;
  }

  boxes.forEach(function (cb) {
    cb.checked = s47Selected.has(parseInt(cb.getAttribute('data-index'), 10));
  });
  if (s47Attempts >= 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
  }
  s47UpdateCheckBtn();
}

/* Screens 6 and 8 — single-choice. Mirror s49Submit / s51Submit, which are the same shape. */
function sqRestoreChoiceUI(cfg) {
  var fb      = document.getElementById(cfg.prefix + '-feedback');
  var fbBold  = document.getElementById(cfg.prefix + '-fb-bold');
  var fbReg   = document.getElementById(cfg.prefix + '-fb-regular');
  var cont    = document.getElementById(cfg.prefix + '-continue');
  var hintBtn = document.getElementById(cfg.prefix + '-hint-btn');
  var opts    = Array.prototype.slice.call(document.querySelectorAll('[data-screen="' + cfg.screen + '"] .s5-opt'));
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (cfg.solved) {
    var correct = (XAPI_Q_RESULTS[cfg.qKey] === true);
    opts.forEach(function (o, i) {
      if (correct) {
        if (i === cfg.selected) { o.classList.remove('is-selected'); o.classList.add('is-correct'); }
      } else if (i === cfg.correctIndex) {
        o.classList.add('is-correct');
      } else if (i === cfg.selected) {
        o.classList.add('is-incorrect');
      }
      o.disabled = true;
    });
    fbBold.textContent = correct ? cfg.boldCorrect : cfg.boldWrong;
    fbReg.innerHTML    = cfg.explanation;
    fb.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden = false;
    cont.disabled    = false;
    cont.textContent = 'שנמשיך?';
    cont.onclick     = function () { goTo(cfg.next); };
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

function s49RestoreUI() {
  sqRestoreChoiceUI({
    prefix: 's49', screen: 6, next: 7, qKey: '001/q3',
    solved: s49Solved, selected: s49Selected, attempts: s49Attempts,
    correctIndex: S49_CORRECT,
    boldCorrect: 'זה נכון מאוד!​', boldWrong: 'זה לא מדויק. נסביר:​',
    explanation: S49_RESTORE_EXPLANATION
  });
}

function s51RestoreUI() {
  sqRestoreChoiceUI({
    prefix: 's51', screen: 8, next: 9, qKey: '001/q4',
    solved: s51Solved, selected: s51Selected, attempts: s51Attempts,
    correctIndex: S51_CORRECT,
    boldCorrect: 'בדיוק!​', boldWrong: 'זה לא מדויק. בואו נראה למה:​',
    explanation: S51_RESTORE_EXPLANATION
  });
}



/* xAPI loader: ../unit-js/50-loader.js. This component supplies its metadata file
   and, where it needs one, an onXapiReady() hook. */
var XAPI_METADATA_FILE = '../metadata/methodica-math-scale-01-05.json';

/* Terminal component: load the unit metadata so the unit 'completed' can resolve its
   object id when the learner reaches the finale. */
function onXapiReady() {
  loadUnitMetadata('../metadata/methodica-math-scale-01_unit.json', function () {});
}
