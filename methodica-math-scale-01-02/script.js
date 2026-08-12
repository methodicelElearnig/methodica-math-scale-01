'use strict';




var TOTAL_SCREENS = 9;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
const _savedChar = localStorage.getItem('lomdaCharacter');
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
  if (n === 0) { s25Enter(); }
  if (n === 1) { s26Enter(); }
  if (n === 2) { s27Enter(); }
  if (n === 3) { s28Enter(); }
  if (n === 4) { s29Enter(); }
  if (n === 5) { s30Enter(); }
  if (n === 6) { s31Enter(); }
  if (n === 7) { s32Enter(); }
  if (n === 8) { s33Enter(); }
}




/* ── Screen 26 ── */
var s26Solved    = false;
var s26Correct   = false;
var s26Attempts  = 0;
var s26Vals = { 1: null, 2: null, 3: null };
var S26_CORRECT = { 1: '5', 2: '1000', 3: '5000' };

function s26Enter() {
  updateNavBar(
    document.querySelector('#s1 .s18-nav'), 1,
    [null, null, null, null],
    [1, 2, 3, 4]
  );
  s26Solved   = false;
  s26Correct  = false;
  s26Attempts = 0;
  s26Vals = { 1: null, 2: null, 3: null };
  [1, 2, 3].forEach(function(n) {
    var valEl = document.getElementById('s26-val' + n);
    var panel = document.getElementById('s26-panel' + n);
    var wrap  = document.getElementById('s26-wrap' + n);
    var trig  = wrap ? wrap.querySelector('.s5-dd-trigger') : null;
    if (valEl)  valEl.textContent = '-';
    if (panel)  panel.hidden = true;
    if (wrap)   wrap.classList.remove('is-open', 'is-correct', 'is-incorrect');
    if (trig)   trig.disabled = false;
  });
  var cont = document.getElementById('s26-continue');
  if (cont) cont.disabled = true;
  var fb = document.getElementById('s26-feedback');
  if (fb) { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
}

function s26ToggleDd(n) {
  if (s26Solved) return;
  var wrap  = document.getElementById('s26-wrap' + n);
  var panel = document.getElementById('s26-panel' + n);
  if (!wrap || !panel) return;
  var isOpen = wrap.classList.contains('is-open');
  [1, 2, 3].forEach(function(i) {
    var w = document.getElementById('s26-wrap' + i);
    var p = document.getElementById('s26-panel' + i);
    if (w) w.classList.remove('is-open');
    if (p) p.hidden = true;
  });
  if (!isOpen) { wrap.classList.add('is-open'); panel.hidden = false; }
}

function s26ToggleHint() {
  var popup = document.getElementById('s26-hint-popup');
  if (popup) {
    popup.hidden = false;
    announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('001', 'q1')); } catch (e) {}
  }
}

function s26CloseHint() {
  var popup = document.getElementById('s26-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s26Pick(n, val, label) {
  s26Vals[n] = val;
  var valEl = document.getElementById('s26-val' + n);
  if (valEl) valEl.textContent = label;
  var wrap  = document.getElementById('s26-wrap' + n);
  var panel = document.getElementById('s26-panel' + n);
  if (wrap)  wrap.classList.remove('is-open');
  if (panel) panel.hidden = true;
  var cont = document.getElementById('s26-continue');
  if (cont) cont.disabled = !(s26Vals[1] && s26Vals[2] && s26Vals[3]);
}

function s26Submit() {
  if (s26Solved) { goTo(2); return; }
  if (!s26Vals[1] || !s26Vals[2] || !s26Vals[3]) return;

  var correct = (s26Vals[1] === S26_CORRECT[1] && s26Vals[2] === S26_CORRECT[2] && s26Vals[3] === S26_CORRECT[3]);
  /* xAPI: item 001 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : ((s26Attempts + 1) >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [[s26Vals[1], s26Vals[2], s26Vals[3]].join(' | ')] } },
      xapiQ('001', 'q1'));
  } catch (e) { console.error('[xAPI] answered 001/q1', e); }
  XAPI_Q_RESULTS['001/q1'] = !!correct;
  var labels  = { 1: '5', 2: '1,000', 3: '5,000' };

  var fb      = document.getElementById('s26-feedback');
  var fbBold  = document.getElementById('s26-fb-bold');
  var fbReg   = document.getElementById('s26-fb-regular');
  var cont    = document.getElementById('s26-continue');
  var explanation = '1 ס"מ במפה שווה 1,000 ס"מ במציאות. ​<br>' +
                    'כדי למצוא את אורך השביל במציאות עלינו לכפול את המרחק במפה, שהוא 5 ס"מ ב-1,000. ​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s26Solved  = true;
    s26Correct = true;
    var checkIco26 = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    [1, 2, 3].forEach(function(n) {
      var wrap   = document.getElementById('s26-wrap' + n);
      var trig   = wrap ? wrap.querySelector('.s5-dd-trigger') : null;
      var iconEl = document.getElementById('s26-dd-icon-' + n);
      if (trig)   trig.disabled = true;
      if (wrap)   wrap.classList.add('is-correct');
      if (iconEl) iconEl.innerHTML = checkIco26;
    });
    fbBold.textContent = 'נהדר!​';
    fbReg.innerHTML    = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    announce('נהדר!​');
  } else {
    s26Attempts++;
    if (s26Attempts === 1) {
      s26Vals = { 1: null, 2: null, 3: null };
      [1, 2, 3].forEach(function(n) {
        var valEl = document.getElementById('s26-val' + n);
        var wrap  = document.getElementById('s26-wrap' + n);
        var iconEl = document.getElementById('s26-dd-icon-' + n);
        if (valEl)  valEl.textContent = '-';
        if (wrap)   wrap.classList.remove('is-open', 'is-correct', 'is-incorrect');
        if (iconEl) iconEl.innerHTML = '';
      });
      cont.disabled = true;
      fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
      fbReg.innerHTML    = '';
      fb.classList.add('s5-fb--incorrect');
      fb.hidden = false;
      announce('זה לא מדויק, ננסה שוב?');
    } else {
      s26Solved = true;
      var checkIco = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var xIco     = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      [1, 2, 3].forEach(function(n) {
        var valEl  = document.getElementById('s26-val' + n);
        var wrap   = document.getElementById('s26-wrap' + n);
        var trig   = wrap ? wrap.querySelector('.s5-dd-trigger') : null;
        var iconEl = document.getElementById('s26-dd-icon-' + n);
        if (trig)  trig.disabled = true;
        if (valEl) valEl.textContent = labels[n];
        var isOk = (s26Vals[n] === S26_CORRECT[n]);
        if (wrap) {
          if (isOk) { wrap.classList.remove('is-incorrect'); wrap.classList.add('is-correct'); }
          else      { wrap.classList.remove('is-correct');   wrap.classList.add('is-incorrect'); }
        }
        if (iconEl) iconEl.innerHTML = isOk ? checkIco : xIco;
      });
      fbBold.textContent = 'זו טעות, לא נורא – בואו נלמד ממנה:​';
      announce('זו טעות, לא נורא – בואו נלמד ממנה:​');
      fbReg.innerHTML    = 'התרגיל הנכון מוצג כעת.​<br>' + explanation;
      fb.classList.add('s5-fb--incorrect');
      fb.hidden     = false;
      cont.textContent = 'שנמשיך?';
      cont.disabled = false;
    }
  }
  /* Resume: commit the answer synchronously. A debounced save here could still be in flight when
     the learner navigates, and land after the next screen's own write. */
  flushResumeSave();
}


/* ── Screen 25 ── */
function s25Enter() {
  var charImg = document.getElementById('s25-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
  }
}


/* ── Screen 27 ── */
var s27Solved    = false;
var s27Correct   = false;
var s27Attempts  = 0;
var s27Vals = { 1: null, 2: null };
var S27_CORRECT = { 1: '35000', 2: '350' };

function s27Enter() {
  updateNavBar(
    document.querySelector('#s2 .s18-nav'), 2,
    [s26Solved ? (s26Correct ? 'correct' : 'wrong') : null, null, null, null],
    [1, 2, 3, 4]
  );
  s27Solved    = false;
  s27Correct   = false;
  s27Attempts  = 0;
  s27Vals = { 1: null, 2: null };

  [1, 2].forEach(function(n) {
    var valEl = document.getElementById('s27-val' + n);
    var wrap  = document.getElementById('s27-wrap' + n);
    var panel = document.getElementById('s27-panel' + n);
    if (valEl)  valEl.textContent = '-';
    if (wrap)   { wrap.classList.remove('is-correct', 'is-incorrect', 'is-open'); }
    if (panel)  panel.hidden = true;
  });

  var fb   = document.getElementById('s27-feedback');
  var cont = document.getElementById('s27-continue');
  var hint = document.getElementById('s27-hint-popup');
  if (fb)   { fb.hidden = true; fb.classList.remove('s5-fb--incorrect'); }
  if (cont) { cont.disabled = true; cont.onclick = function() { s27Submit(); }; }
  if (hint) hint.hidden = true;
}

function s27ToggleDd(n) {
  if (s27Solved) return;
  var panel  = document.getElementById('s27-panel' + n);
  var wrap   = document.getElementById('s27-wrap' + n);
  var isOpen = !panel.hidden;
  [1, 2].forEach(function(i) {
    var p = document.getElementById('s27-panel' + i);
    var w = document.getElementById('s27-wrap' + i);
    if (p) p.hidden = true;
    if (w) w.classList.remove('is-open');
  });
  if (!isOpen) {
    panel.hidden = false;
    wrap.classList.add('is-open');
  }
}

function s27Pick(n, val, label) {
  s27Vals[n] = val;
  var valEl = document.getElementById('s27-val' + n);
  var panel = document.getElementById('s27-panel' + n);
  var wrap  = document.getElementById('s27-wrap' + n);
  if (valEl) valEl.textContent = label;
  if (panel) panel.hidden = true;
  if (wrap)  wrap.classList.remove('is-open');
  var cont = document.getElementById('s27-continue');
  if (cont)  cont.disabled = !(s27Vals[1] !== null && s27Vals[2] !== null);
}

function s27Submit() {
  if (s27Solved) { goTo(3); return; }
  if (s27Vals[1] === null || s27Vals[2] === null) return;

  var fb     = document.getElementById('s27-feedback');
  var fbBold = document.getElementById('s27-fb-bold');
  var fbReg  = document.getElementById('s27-fb-regular');
  var cont   = document.getElementById('s27-continue');

  var explanation   = 'הפעולה מורכבת משני שלבים: ​<br>1. נכפול 7 ס"מ ב-5,000 כדי למצוא את המרחק במציאות ונקבל 35,000 ס"מ. ​<br>2. כדי להמיר את הסנטימטרים למטרים, נחלק ב-100 ונקבל 350 מטרים. ​';
  var correctLabels = { 1: '35,000', 2: '350' };
  var isCorrect     = s27Vals[1] === S27_CORRECT[1] && s27Vals[2] === S27_CORRECT[2];
  /* xAPI: item 002 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(isCorrect ? 'answered.last' : ((s27Attempts + 1) >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 },
        extensions: { student_answer: [[s27Vals[1], s27Vals[2]].join(' | ')] } },
      xapiQ('002', 'q1'));
  } catch (e) { console.error('[xAPI] answered 002/q1', e); }
  XAPI_Q_RESULTS['002/q1'] = !!isCorrect;

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (isCorrect) {
    s27Solved  = true;
    s27Correct = true;
    var checkIco27 = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    [1, 2].forEach(function(n) {
      var wrap   = document.getElementById('s27-wrap' + n);
      var iconEl = document.getElementById('s27-dd-icon-' + n);
      if (wrap)   wrap.classList.add('is-correct');
      if (iconEl) iconEl.innerHTML = checkIco27;
    });
    fbBold.textContent = 'יופי!​';
    fbReg.innerHTML    = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    cont.onclick  = function() { goTo(3); };
    announce('יופי!​');
  } else {
    s27Attempts++;
    if (s27Attempts === 1) {
      s27Vals = { 1: null, 2: null };
      [1, 2].forEach(function(n) {
        var valEl  = document.getElementById('s27-val' + n);
        var wrap   = document.getElementById('s27-wrap' + n);
        var iconEl = document.getElementById('s27-dd-icon-' + n);
        if (valEl)  valEl.textContent = '-';
        if (wrap)   wrap.classList.remove('is-open', 'is-correct', 'is-incorrect');
        if (iconEl) iconEl.innerHTML = '';
      });
      cont.disabled = true;
      fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
      fbReg.innerHTML    = '';
      fb.classList.add('s5-fb--incorrect');
      fb.hidden = false;
      announce('זה לא מדויק, ננסה שוב?');
    } else {
      s27Solved = true;
      var checkIco27b = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var xIco27b     = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      [1, 2].forEach(function(n) {
        var valEl  = document.getElementById('s27-val' + n);
        var wrap   = document.getElementById('s27-wrap' + n);
        var iconEl = document.getElementById('s27-dd-icon-' + n);
        if (valEl) valEl.textContent = correctLabels[n];
        var isOk = (s27Vals[n] === S27_CORRECT[n]);
        if (wrap) {
          if (isOk) { wrap.classList.remove('is-incorrect'); wrap.classList.add('is-correct'); }
          else      { wrap.classList.remove('is-correct');   wrap.classList.add('is-incorrect'); }
        }
        if (iconEl) iconEl.innerHTML = isOk ? checkIco27b : xIco27b;
      });
      fbBold.textContent = 'זה לא נכון, אבל מכל טעות אפשר ללמוד:​';
      announce('זה לא נכון, אבל מכל טעות אפשר ללמוד:​');
      fbReg.innerHTML    = explanation;
      fb.classList.add('s5-fb--incorrect');
      fb.hidden     = false;
      cont.textContent = 'שנמשיך?';
      cont.disabled = false;
      cont.onclick  = function() { goTo(3); };
    }
  }
  flushResumeSave();   // see s26Submit
}

function s27ToggleHint() {
  var popup = document.getElementById('s27-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('002', 'q1')); } catch (e) {}
    }
  }
}

function s27CloseHint() {
  var popup = document.getElementById('s27-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}


/* ── Screen 28 ── */
var s28Solved    = false;
var s28Correct   = false;
var s28Attempts  = 0;
var s28Selected  = []; // indices of checked options
var S28_CORRECT  = [0, 1, 3]; // א, ב, ד

function s28Enter() {
  updateNavBar(
    document.querySelector('#s3 .s18-nav'), 3,
    [
      s26Solved ? (s26Correct ? 'correct' : 'wrong') : null,
      s27Solved ? (s27Correct ? 'correct' : 'wrong') : null,
      null, null
    ],
    [1, 2, 3, 4]
  );
  s28Solved    = false;
  s28Correct   = false;
  s28Attempts  = 0;
  s28Selected  = [];

  document.querySelectorAll('[data-screen="3"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });

  var fb   = document.getElementById('s28-feedback');
  var cont = document.getElementById('s28-continue');
  var hint = document.getElementById('s28-hint-popup');
  if (fb)   { fb.hidden = true; fb.classList.remove('s5-fb--incorrect'); }
  if (cont) cont.disabled = true;
  if (hint) hint.hidden = true;
}

function s28Select(idx) {
  if (s28Solved) return;
  var pos  = s28Selected.indexOf(idx);
  var opts = document.querySelectorAll('[data-screen="3"] .s5-opt');
  if (pos >= 0) {
    s28Selected.splice(pos, 1);
    opts[idx].classList.remove('is-selected');
  } else {
    s28Selected.push(idx);
    opts[idx].classList.add('is-selected');
  }
  var cont = document.getElementById('s28-continue');
  if (cont) cont.disabled = (s28Selected.length === 0);
}

function s28ToggleHint() {
  var popup = document.getElementById('s28-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('003', 'q1')); } catch (e) {}
    }
  }
}

function s28CloseHint() {
  var popup = document.getElementById('s28-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s28Submit() {
  if (s28Solved) { goTo(4); return; }
  if (s28Selected.length === 0) return;

  var fb     = document.getElementById('s28-feedback');
  var fbBold = document.getElementById('s28-fb-bold');
  var fbReg  = document.getElementById('s28-fb-regular');
  var cont   = document.getElementById('s28-continue');
  var opts   = document.querySelectorAll('[data-screen="3"] .s5-opt');

  var hasGimel  = s28Selected.indexOf(2) >= 0;
  var hasAll    = S28_CORRECT.every(function(i) { return s28Selected.indexOf(i) >= 0; });
  var isCorrect = hasAll && !hasGimel;
  /* xAPI: item 003 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(isCorrect ? 'answered.last' : ((s28Attempts + 1) >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 },
        extensions: { student_answer: [s28Selected.slice().sort(function(a,b){ return a - b; }).map(function(i){ return xapiAnswerText(document.querySelectorAll('[data-screen="3"] .s5-opt')[i]); }).join(' | ')] } },
      xapiQ('003', 'q1'));
  } catch (e) { console.error('[xAPI] answered 003/q1', e); }
  XAPI_Q_RESULTS['003/q1'] = !!isCorrect;

  var explanation = '<strong>סעיפים א ו-ב</strong> נכונים, כיוון שכפלנו את קנה המידה ב-4 וב-10 בהתאמה.​<br>' +
                    '<strong>סעיף ג</strong> אינו נכון, כיוון ש-1 ס"מ במפה מייצג 50 ס"מ במציאות ולא 50 מטרים. ​<br>' +
                    '<strong>סעיף ד</strong> נכון, כיוון ש-50 ס"מ בתרשים מייצגים 2,500 ס"מ במציאות, שהם 25 מטרים.​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (isCorrect) {
    s28Solved  = true;
    s28Correct = true;
    opts.forEach(function(opt, i) {
      opt.classList.remove('is-selected');
      opt.disabled = true;
      opt.classList.add(S28_CORRECT.indexOf(i) >= 0 ? 'is-correct' : 'is-incorrect');
    });
    fbBold.textContent = 'מעולה! ​';
    fbReg.innerHTML    = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    cont.onclick  = function() { goTo(4); };
    announce('מעולה! ​');
  } else {
    s28Attempts++;
    if (s28Attempts === 1) {
      // first wrong — clear selection, keep interactive
      opts.forEach(function(opt) {
        opt.classList.remove('is-selected');
      });
      s28Selected = [];
      cont.disabled = true;
      fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
      fbReg.innerHTML    = '';
      fb.classList.add('s5-fb--incorrect');
      fb.hidden = false;
      announce('זה לא מדויק, ננסה שוב?');
    } else {
      // second wrong — show all correct/incorrect, lock
      s28Solved = true;
      opts.forEach(function(opt, i) {
        opt.classList.remove('is-selected');
        opt.disabled = true;
        opt.classList.add(S28_CORRECT.indexOf(i) >= 0 ? 'is-correct' : 'is-incorrect');
      });
      fbBold.textContent = 'זה לא נכון, אבל מכל טעות אפשר ללמוד:​';
      announce('זה לא נכון, אבל מכל טעות אפשר ללמוד:​');
      fbReg.innerHTML    = explanation;
      fb.classList.add('s5-fb--incorrect');
      fb.hidden     = false;
      cont.textContent = 'שנמשיך?';
      cont.disabled = false;
      cont.onclick  = function() { goTo(4); };
    }
  }
  flushResumeSave();   // see s26Submit
}

/* ── Screen 29 ── */
var s29Attempts = 0;
var s29Solved   = false;
var s29Correct  = false;

function s29Enter() {
  updateNavBar(
    document.querySelector('#s4 .s18-nav'), 4,
    [
      s26Solved ? (s26Correct ? 'correct' : 'wrong') : null,
      s27Solved ? (s27Correct ? 'correct' : 'wrong') : null,
      s28Solved ? (s28Correct ? 'correct' : 'wrong') : null,
      null
    ],
    [1, 2, 3, 4]
  );
  s29Attempts = 0;
  s29Solved   = false;
  s29Correct  = false;
  var input = document.getElementById('s29-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var cont = document.getElementById('s29-continue');
  if (cont) cont.disabled = true;
  var hint = document.getElementById('s29-hint-popup');
  if (hint) hint.hidden = true;
  var fb = document.getElementById('s29-feedback');
  if (fb) { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
}

function s29CheckInput() {
  if (s29Solved) return;
  var input = document.getElementById('s29-answer-input');
  var cont  = document.getElementById('s29-continue');
  if (cont) cont.disabled = !(input && input.value.trim().length > 0);
}

function s29ToggleHint() {
  var popup = document.getElementById('s29-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('004', 'q1')); } catch (e) {}
    }
  }
}

function s29CloseHint() {
  var popup = document.getElementById('s29-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s29Submit() {
  if (s29Solved) { goTo(5); return; }

  var input   = document.getElementById('s29-answer-input');
  var answer  = input ? input.value.trim() : '';
  var numVal  = parseFloat(answer.replace(',', '.'));
  var correct = (numVal === 4);

  s29Attempts++;
  /* xAPI: item 004 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s29Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [answer] } },
      xapiQ('004', 'q1'));
  } catch (e) { console.error('[xAPI] answered 004/q1', e); }
  XAPI_Q_RESULTS['004/q1'] = !!correct;

  var fb      = document.getElementById('s29-feedback');
  var fbBold  = document.getElementById('s29-fb-bold');
  var fbReg   = document.getElementById('s29-fb-regular');
  var cont    = document.getElementById('s29-continue');

  var explanation = 'כדי למצוא מהו גודל קיר הסלון במציאות, נשתמש בקנה המידה ונכפול:​<br>' +
                    '400 ס"מ = 2 · 200​<br>' +
                    'כדי להמיר למטרים, נחלק את 400 ב-100 (כי בכל מטר יש 100 ס"מ), ונקבל שהסלון הוא באורך 4 מטרים. ​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s29Solved  = true;
    s29Correct = true;
    input.disabled  = true;
    fbBold.textContent = 'מעולה! ​';
    fbReg.innerHTML    = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    announce('מעולה! ​');
  } else if (s29Attempts === 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.innerHTML    = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden       = false;
    cont.disabled   = true;
    announce('זה לא מדויק, ננסה שוב?');
  } else {
    s29Solved = true;
    input.disabled  = true;
    fbBold.textContent = 'זה לא מדוייק, אבל כל הכבוד על הניסיון!​';
    announce('זה לא מדוייק, אבל כל הכבוד על הניסיון!​');
    fbReg.innerHTML    = explanation;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
  }
  flushResumeSave();   // see s26Submit
}


/* ── Screen 30 ── */
var s30Solved   = false;
var s30Correct  = false;
var s30Attempts = 0;
var s30Vals     = { 1: null, 2: null, 3: null, 4: null };
var S30_CORRECT = { 1: '600', 2: 'חילוק', 3: '200', 4: '3' };

function s30Enter() {
  updateNavBar(
    document.querySelector('#s5 .s18-nav'), 4,
    [
      s26Solved ? (s26Correct ? 'correct' : 'wrong') : null,
      s27Solved ? (s27Correct ? 'correct' : 'wrong') : null,
      s28Solved ? (s28Correct ? 'correct' : 'wrong') : null,
      null
    ],
    [1, 2, 3, 4]
  );
  s30Solved   = false;
  s30Correct  = false;
  s30Attempts = 0;
  s30Vals     = { 1: null, 2: null, 3: null, 4: null };

  [1, 2, 3, 4].forEach(function(n) {
    var valEl = document.getElementById('s30-val' + n);
    var wrap  = document.getElementById('s30-wrap' + n);
    var panel = document.getElementById('s30-panel' + n);
    if (valEl)  valEl.textContent = '-';
    if (wrap)  wrap.classList.remove('is-correct', 'is-incorrect', 'is-open');
    if (panel) panel.hidden = true;
  });

  var fb   = document.getElementById('s30-feedback');
  var cont = document.getElementById('s30-continue');
  var hint = document.getElementById('s30-hint-popup');
  if (fb)   { fb.hidden = true; fb.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  if (cont) cont.disabled = true;
  if (hint) hint.hidden = true;
}

function s30ToggleDd(n) {
  if (s30Solved) return;
  var isOpen = !document.getElementById('s30-panel' + n).hidden;
  [1, 2, 3, 4].forEach(function(i) {
    var p = document.getElementById('s30-panel' + i);
    var w = document.getElementById('s30-wrap' + i);
    if (p) p.hidden = true;
    if (w) w.classList.remove('is-open');
  });
  if (!isOpen) {
    document.getElementById('s30-panel' + n).hidden = false;
    document.getElementById('s30-wrap' + n).classList.add('is-open');
  }
}

function s30Pick(n, val, label) {
  s30Vals[n] = val;
  var valEl = document.getElementById('s30-val' + n);
  var panel = document.getElementById('s30-panel' + n);
  var wrap  = document.getElementById('s30-wrap' + n);
  if (valEl) valEl.textContent = label;
  if (panel) panel.hidden = true;
  if (wrap)  wrap.classList.remove('is-open');
  var cont = document.getElementById('s30-continue');
  if (cont) cont.disabled = !(s30Vals[1] && s30Vals[2] && s30Vals[3] && s30Vals[4]);
}

function s30ToggleHint() {
  var popup = document.getElementById('s30-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('005', 'q1')); } catch (e) {}
    }
  }
}

function s30CloseHint() {
  var popup = document.getElementById('s30-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s30Submit() {
  if (s30Solved) { routeAfterBasicPractice(); return; }
  if (!s30Vals[1] || !s30Vals[2] || !s30Vals[3] || !s30Vals[4]) return;

  var isCorrect = (s30Vals[1] === S30_CORRECT[1] && s30Vals[2] === S30_CORRECT[2] &&
                   s30Vals[3] === S30_CORRECT[3] && s30Vals[4] === S30_CORRECT[4]);

  var correctLabels = { 1: '600', 2: 'חילוק', 3: '200', 4: '3' };
  /* xAPI: item 005 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(isCorrect ? 'answered.last' : ((s30Attempts + 1) >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 },
        extensions: { student_answer: [[s30Vals[1], s30Vals[2], s30Vals[3], s30Vals[4]].join(' | ')] } },
      xapiQ('005', 'q1'));
  } catch (e) { console.error('[xAPI] answered 005/q1', e); }
  XAPI_Q_RESULTS['005/q1'] = !!isCorrect;

  var fb     = document.getElementById('s30-feedback');
  var fbBold = document.getElementById('s30-fb-bold');
  var fbReg  = document.getElementById('s30-fb-regular');
  var cont   = document.getElementById('s30-continue');

  var explanation = 'נמיר 6 מטרים לס״מ ונקבל 600 ס״מ.​<br>' +
                    'מכיוון שהתכנית מוקטנת ביחס למציאות, נשתמש בפעולת חילוק.​<br>' +
                    'בקנה מידה 1:200, כל 1 ס"מ בתכנית מייצג 200 ס"מ במציאות, ולכן נחלק ב־200.​<br>' +
                    'נחלק 600 ס״מ במציאות ב-200 ונקבל שאורך הקיר בתכנית הוא 3 ס"מ.​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (isCorrect) {
    s30Solved  = true;
    s30Correct = true;
    var checkIco30 = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    [1, 2, 3, 4].forEach(function(n) {
      var wrap   = document.getElementById('s30-wrap' + n);
      var trig   = wrap ? wrap.querySelector('.s5-dd-trigger') : null;
      var iconEl = document.getElementById('s30-dd-icon-' + n);
      if (trig)   trig.disabled = true;
      if (wrap)   wrap.classList.add('is-correct');
      if (iconEl) iconEl.innerHTML = checkIco30;
    });
    fbBold.textContent = 'מעולה! ​';
    fbReg.innerHTML    = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    cont.onclick  = function() { routeAfterBasicPractice(); };
    announce('מעולה! ​');
  } else {
    s30Attempts++;
    if (s30Attempts === 1) {
      s30Vals = { 1: null, 2: null, 3: null, 4: null };
      [1, 2, 3, 4].forEach(function(n) {
        var valEl  = document.getElementById('s30-val' + n);
        var wrap   = document.getElementById('s30-wrap' + n);
        var iconEl = document.getElementById('s30-dd-icon-' + n);
        if (valEl)  valEl.textContent = '-';
        if (wrap)   wrap.classList.remove('is-open', 'is-correct', 'is-incorrect');
        if (iconEl) iconEl.innerHTML = '';
      });
      cont.disabled = true;
      fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
      fbReg.innerHTML    = '';
      fb.classList.add('s5-fb--incorrect');
      fb.hidden = false;
      announce('זה לא מדויק, ננסה שוב?');
    } else {
      s30Solved = true;
      var checkIco30b = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var xIco30b     = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      [1, 2, 3, 4].forEach(function(n) {
        var valEl  = document.getElementById('s30-val' + n);
        var wrap   = document.getElementById('s30-wrap' + n);
        var trig   = wrap ? wrap.querySelector('.s5-dd-trigger') : null;
        var iconEl = document.getElementById('s30-dd-icon-' + n);
        if (trig)  trig.disabled = true;
        if (valEl) valEl.textContent = correctLabels[n];
        var isOk = (s30Vals[n] === S30_CORRECT[n]);
        if (wrap) {
          if (isOk) { wrap.classList.remove('is-incorrect'); wrap.classList.add('is-correct'); }
          else      { wrap.classList.remove('is-correct');   wrap.classList.add('is-incorrect'); }
        }
        if (iconEl) iconEl.innerHTML = isOk ? checkIco30b : xIco30b;
      });
      fbBold.textContent = 'זה לא מדוייק, אבל בואו נלמד מזה:';
      announce('זה לא מדוייק, אבל בואו נלמד מזה:');
      fbReg.innerHTML    = explanation;
      fb.classList.add('s5-fb--incorrect');
      fb.hidden     = false;
      cont.textContent = 'שנמשיך?';
      cont.disabled = false;
      cont.onclick  = function() { routeAfterBasicPractice(); };
    }
  }
  flushResumeSave();   // see s26Submit
}

/* ── Screen 31 ── */
function s31Enter() {
  var charImg = document.getElementById('s31-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
  }
}


function routeAfterBasicPractice() {
  goTo(6);
}



/* ── Screen 32: תרגול מתקדם — שאלה 1 ── */
var s32Solved   = false;
var s32Correct  = false;
var s32Attempts = 0;

function s32Enter() {
  s32Solved   = false;
  s32Correct  = false;
  s32Attempts = 0;
  var input = document.getElementById('s32-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var fb = document.getElementById('s32-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  document.getElementById('s32-fb-bold').textContent    = '';
  document.getElementById('s32-fb-regular').textContent = '';
  var cont = document.getElementById('s32-continue');
  if (cont) { cont.disabled = true; cont.onclick = function() { s32Submit(); }; }
  var hintBtn = document.getElementById('s32-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s32-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s32CheckInput() {
  var val = document.getElementById('s32-answer-input').value.trim();
  document.getElementById('s32-continue').disabled = (val === '');
}

function s32ToggleHint() {
  var popup = document.getElementById('s32-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('006', 'q1')); } catch (e) {}
    }
  }
}

function s32CloseHint() {
  var popup = document.getElementById('s32-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function s32Submit() {
  if (s32Solved) { goTo(8); return; }

  var rawVal = document.getElementById('s32-answer-input').value.trim();
  var answer = parseFloat(rawVal.replace(',', '.'));
  /* xAPI: item 006 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720((answer === 25) ? 'answered.last' : ((s32Attempts + 1) >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!(answer === 25), score: { scaled: (answer === 25) ? 1 : 0 },
        extensions: { student_answer: [rawVal] } },
      xapiQ('006', 'q1'));
  } catch (e) { console.error('[xAPI] answered 006/q1', e); }
  XAPI_Q_RESULTS['006/q1'] = !!(answer === 25);
  var fb     = document.getElementById('s32-feedback');
  var fbBold = document.getElementById('s32-fb-bold');
  var fbReg  = document.getElementById('s32-fb-regular');
  var cont   = document.getElementById('s32-continue');
  var hintBtn = document.getElementById('s32-hint-btn');

  var explanationCorrect = 'כדי לחשב, נמיר קודם את אורך המכונית במציאות לסנטימטרים:<br>4.5 · 100 = 450 ס"מ. ​<br>' +
                           'מכיוון שהדגם המודפס מוקטן פי 18 ​<br>' +
                           '(קנה מידה 18 : 1), נחלק את האורך במציאות לפי קנה המידה:<br>' +
                           '18 ÷ 450 = 25 ס"מ.​';
  var explanationWrong = 'כדי לחשב, נמיר קודם את אורך המכונית במציאות לסנטימטרים:<br>4.5 · 100 = 450 ס"מ. ​<br>' +
                          'מכיוון שהדגם המודפס מוקטן פי 18 (קנה מידה 18 : 1), נחלק את האורך במציאות לפי קנה המידה:​<br>' +
                          ' 18 ÷ 450 = 25 ס"מ.';

  if (answer === 25) {
    s32Solved  = true;
    s32Correct = true;
    document.getElementById('s32-answer-input').disabled = true;
    fbBold.textContent  = 'כל הכבוד! ​';
    fbReg.innerHTML     = explanationCorrect;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    cont.onclick  = function() { goTo(8); };
    announce('כל הכבוד! ​');
  } else {
    s32Attempts++;
    if (s32Attempts < 2) {
      // First wrong — brief message + reveal hint button
      fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
      fbReg.textContent   = '';
      fb.classList.remove('s5-fb--correct');
      fb.classList.add('s5-fb--incorrect');
      fb.hidden           = false;
      if (hintBtn) hintBtn.hidden = false;
      document.getElementById('s32-answer-input').value = '';
      cont.disabled = true;
      announce('זה לא מדויק, ננסה שוב?');
    } else {
      // Second wrong — explanation + lock
      s32Solved = true;
      document.getElementById('s32-answer-input').disabled = true;
      fbBold.textContent  = 'זו טעות, אבל יש לנו הזדמנות ללמוד:​';
      announce('זו טעות, אבל יש לנו הזדמנות ללמוד:​');
      fbReg.innerHTML     = explanationWrong;
      fb.classList.remove('s5-fb--correct');
      fb.classList.add('s5-fb--incorrect');
      fb.hidden     = false;
      cont.textContent = 'שנמשיך?';
      cont.disabled = false;
      cont.onclick  = function() { goTo(8); };
    }
  }
  flushResumeSave();   // see s26Submit
}

/* ── Screen 33: תרגול מתקדם — שאלה 2 ── */
var s33Selected = null;
var s33Attempts = 0;
var s33Solved   = false;
var s33Correct  = false;
var S33_CORRECT = 2;

function s33Enter() {
  updateNavBar(
    document.querySelector('#s8 .s18-nav'), 2,
    [s32Solved ? (s32Correct ? 'correct' : 'wrong') : null, null],
    [7, 8]
  );
  s33Selected = null;
  s33Attempts = 0;
  s33Solved   = false;
  s33Correct  = false;
  document.querySelectorAll('[data-screen="8"] .s5-opt').forEach(function(o) {
    o.disabled = false;
    o.classList.remove('is-selected', 'is-correct', 'is-incorrect');
  });
  var fb = document.getElementById('s33-feedback');
  if (fb) { fb.hidden = true; fb.className = 's5-inline-feedback s18-feedback-bar'; }
  document.getElementById('s33-fb-bold').textContent    = '';
  document.getElementById('s33-fb-regular').textContent = '';
  var cont = document.getElementById('s33-continue');
  if (cont) { cont.disabled = true; cont.onclick = function() { s33Submit(); }; }
  var hintBtn = document.getElementById('s33-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s33-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
}

function s33Select(idx) {
  if (s33Solved) return;
  s33Selected = idx;
  document.querySelectorAll('[data-screen="8"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  document.getElementById('s33-continue').disabled = false;
}

function s33ToggleHint() {
  var popup = document.getElementById('s33-hint-popup');
  if (popup) {
    popup.hidden = !popup.hidden;
    if (!popup.hidden) {
      announce('רמז נפתח');
      try { sendStatement720('requested.1', 'question', null, xapiQ('007', 'q1')); } catch (e) {}
    }
  }
}

function s33CloseHint() {
  var popup = document.getElementById('s33-hint-popup');
  if (popup) { popup.hidden = true; announce('רמז נסגר'); }
}

function getAdvancedPracticeScore() {
  return (s32Correct ? 1 : 0) + (s33Correct ? 1 : 0);
}

/* תרגול בסיסי — 4 exercises, pass mark 3. Screens 29 and 30 are parts א+ב of one exercise, so
   they count together. This is the same rule part 01 states for the same five screens.
   It was missing here, and routeAfterAdvancedPractice() calls it: the ReferenceError was
   swallowed by the try around it, so this component never reported its 'completed' at all. */
function getBasicPracticeScore() {
  var count = 0;
  if (s26Correct)                count++; // שאלה 1
  if (s27Correct)                count++; // שאלה 2
  if (s28Correct)                count++; // שאלה 3
  if (s29Correct && s30Correct)  count++; // שאלה 4 (א+ב יחד)
  return count;
}

// 2/2 נכון → תרגול כיתה (03) | פחות → ללא מעבר כרגע
function routeAfterAdvancedPractice() {
  /* xAPI: report the component before deciding whether the learner may move on. This runs
     on BOTH paths — a learner who does not clear 2/2 stays on this screen, and without a
     'completed' here their whole attempt would never be reported. That branch does not navigate,
     so it is the reason the ledger persists its mark synchronously: nothing else would write it,
     and the library's own dedupe lasts only one page load — it cannot survive the reload or the
     back-navigation that now bring the learner through here again. */
  try { xapiFinishItems(); } catch (e) {}
  try {
    var _n = xapiCorrectCount();
    sendCompletedOnce('done', currentPartSlug(), 'onlinelesson',
      { success: getBasicPracticeScore() >= 3 && getAdvancedPracticeScore() >= 2,
        score: { scaled: _n / 7 } });
  } catch (e) { console.error('[xAPI] completed component 02', e); }
  if (getAdvancedPracticeScore() >= 2) {
    /* Resume: point the state document forward only on the branch that actually navigates. A
       learner who never clears 2/2 stays on this screen and must resume back to it. */
    if (RESUME_ENABLED) writeForwardState('methodica-math-scale-01-03');
    window.location.href = '../methodica-math-scale-01-03/index.html' + window.location.search;
  }
}

function s33Submit() {
  if (s33Solved) { routeAfterAdvancedPractice(); return; }
  if (s33Selected === null) return;

  var correct = (s33Selected === S33_CORRECT);
  s33Attempts++;
  /* xAPI: item 007 / q1. Two attempts allowed — the first wrong answer is an interim
     'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s33Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="8"] .s5-opt')[s33Selected])] } },
      xapiQ('007', 'q1'));
  } catch (e) { console.error('[xAPI] answered 007/q1', e); }
  XAPI_Q_RESULTS['007/q1'] = !!correct;

  var fb      = document.getElementById('s33-feedback');
  var fbBold  = document.getElementById('s33-fb-bold');
  var fbReg   = document.getElementById('s33-fb-regular');
  var cont    = document.getElementById('s33-continue');
  var hintBtn = document.getElementById('s33-hint-btn');
  var opts    = document.querySelectorAll('[data-screen="8"] .s5-opt');

  var explanation = '25 מטרים הם 2,500 ס"מ, לכן היחס בין אורך הבריכה בתכנית לאורכה במציאות הוא 2,500 : 5 .​<br>' +
                   'נחלק ב-5 ונקבל את קנה המידה  500 : 1 . ​';

  fb.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s33Solved  = true;
    s33Correct = true;
    opts[s33Selected].classList.remove('is-selected');
    opts[s33Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent  = 'יופי! ​';
    fbReg.innerHTML     = explanation;
    fb.classList.add('s5-fb--correct');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    cont.onclick  = function() { routeAfterAdvancedPractice(); };
    announce('יופי! ​');
  } else if (s33Attempts === 1) {
    opts[s33Selected].classList.remove('is-selected');
    fbBold.textContent  = 'זה לא מדויק, ננסה שוב?';
    fbReg.textContent   = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden           = false;
    if (hintBtn) hintBtn.hidden = false;
    s33Selected = null;
    cont.disabled = true;
    announce('זה לא מדויק, ננסה שוב?');
  } else {
    s33Solved = true;
    opts.forEach(function(o, i) {
      o.disabled = true;
      o.classList.remove('is-selected');
      if (i === S33_CORRECT) o.classList.add('is-correct');
      else if (i === s33Selected) o.classList.add('is-incorrect');
    });
    fbBold.textContent  = 'זו טעות, לא נורא – בואו נלמד ממנה:​';
    announce('זו טעות, לא נורא – בואו נלמד ממנה:​');
    fbReg.innerHTML     = explanation;
    fb.classList.add('s5-fb--incorrect');
    fb.hidden     = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled = false;
    cont.onclick  = function() { routeAfterAdvancedPractice(); };
  }
  flushResumeSave();   // see s26Submit
}





/* ═══════════════════ xAPI (720) — item scope + question ids ═══════════════════
   Everything below is generic across the five components except SCREEN_TO_SUBCONTENT,
   XAPI_COMP_SLUG and XAPI_EVAL_ITEMS. */

/* Screen (data-screen index) -> [subContent suffix, page-in-item]; null = no catalog item.
   Read by xapiOnScreen (element 0) and by submitReport (both elements). */
var SCREEN_TO_SUBCONTENT = {
  0: null,            // intro to basic practice
  1: ['001', 1],      // basic 1
  2: ['002', 1],      // basic 2
  3: ['003', 1],      // basic 3
  4: ['004', 1],      // basic 4
  5: ['005', 1],      // basic 5
  6: null,            // transition to the two advanced exercises
  7: ['006', 1],      // advanced 1
  8: ['007', 1]       // advanced 2
};

var XAPI_COMP_SLUG = 'methodica-math-scale-01-02';
/* Component and item ids must match metadata/*.json byte-for-byte — that convention keeps a
   TRAILING SLASH on unit, component and item ids (but not on question ids). */
var XAPI_COMP_ID   = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';



/* Items that carry a graded question IN CODE. */
var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1, '004': 1, '005': 1, '006': 1, '007': 1 };



/* Report modal, draggable feedback, a11y wiring and image zoom: ../unit-js/ */


/* ── Per-part boot hook ──
   Called by ../unit-js/90-boot.js, the single place startup side effects run from.
   These used to be a top-level IIFE and DOMContentLoaded handlers. */
function partBoot() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    ['', '_holdhands'].forEach(function(v) {
      var img = new Image(); img.src = './assets/images/' + c + v + '.png';
    });
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
   Gen-A: five basic exercises (dropdown/multi-select/value) + two advanced ones.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).











/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every finished
   screen re-reachable, and the library's dedupe only spans a single page load. `initialized` is
   deliberately NOT guarded: the platform asks for it on every entry.





/* Variables copied verbatim in both directions. */
var RESUME_PLAIN_VARS = ['s26Solved', 's26Correct', 's26Attempts', 's27Solved', 's27Correct', 's27Attempts', 's28Solved', 's28Correct', 's28Attempts', 's29Solved', 's29Correct', 's29Attempts', 's30Solved', 's30Correct', 's30Attempts', 's32Solved', 's32Correct', 's32Attempts', 's33Solved', 's33Correct', 's33Attempts', 's33Selected'];

/* Typed answers live only in the DOM — no variable holds them — so they travel by element id.
   Reading them at capture time is safe: no submit branch clears these inputs, only disables. */
var RESUME_INPUT_IDS = ['s29-answer-input', 's32-answer-input'];

/* The dropdown screens keep the machine value in sNNVals but the LABEL only in the DOM, so the
   displayed text travels the same way. '-' is a legitimate captured value: it is what an unset
   row (and a row cleared by a first wrong answer) shows. */
var RESUME_TEXT_IDS = ['s26-val1', 's26-val2', 's26-val3', 's27-val1', 's27-val2',
                       's30-val1', 's30-val2', 's30-val3', 's30-val4'];

function captureResumeInputs() {
  var out = {};
  RESUME_INPUT_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) out[id] = el.value;
  });
  return out;
}

function captureResumeTexts() {
  var out = {};
  RESUME_TEXT_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) out[id] = el.textContent;
  });
  return out;
}

/* This part's payload only. `v` and `part` live on the enclosing v3 document, not in here. */
function capturePartPayload() {
  var st = {
    currentScreen: currentScreen,
    qResults: Object.assign({}, XAPI_Q_RESULTS),
    s26Vals: Object.assign({}, s26Vals),
    s27Vals: Object.assign({}, s27Vals),
    s30Vals: Object.assign({}, s30Vals),
    s28Selected: s28Selected.slice(),
    inputs: captureResumeInputs(),
    texts: captureResumeTexts(),
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
  if (st.s26Vals) s26Vals = Object.assign({}, st.s26Vals);
  if (st.s27Vals) s27Vals = Object.assign({}, st.s27Vals);
  if (st.s30Vals) s30Vals = Object.assign({}, st.s30Vals);
  if (st.s28Selected) s28Selected = st.s28Selected.slice();
  if (st.vars) {
    Object.keys(st.vars).forEach(function (k) {
      if (RESUME_PLAIN_VARS.indexOf(k) === -1) return;   // never assign an unlisted name
      try { eval(k + ' = st.vars[k];'); } catch (e) {}
    });
  }
}

function applyResumeDom(st) {
  RESUME_INPUT_IDS.forEach(function (id) {
    if (!st.inputs || typeof st.inputs[id] !== 'string') return;
    var el = document.getElementById(id);
    if (el) el.value = st.inputs[id];
  });
  RESUME_TEXT_IDS.forEach(function (id) {
    if (!st.texts || typeof st.texts[id] !== 'string') return;
    var el = document.getElementById(id);
    if (el) el.textContent = st.texts[id];
  });
}



/* ── Screen painters ────────────────────────────────────────────────
   Every screen here except 0 and 6 is a question screen. Each painter mirrors the DOM writes of
   its sNNSubmit branches and NOTHING else — no state mutation, no statements, no announce().
   Two axes, not four branches: solved picks the terminal look, otherwise an attempt already spent
   shows the interim feedback AND the current selection is repainted, because those co-occur.
   Correctness comes from sNNCorrect. NOTE this component counts attempts differently from the
   others — sNNAttempts is incremented only in the wrong branch — so correctness must never be
   inferred from it. The nav bars need no painting: sNNEnter() already builds them from
   sNNSolved/sNNCorrect, which the second assignment pass has restored by then. */
function restoreScreenUI(n) {
  try {
    if (n === 1) s26RestoreUI();
    if (n === 2) s27RestoreUI();
    if (n === 3) s28RestoreUI();
    if (n === 4) s29RestoreUI();
    if (n === 5) s30RestoreUI();
    if (n === 7) s32RestoreUI();
    if (n === 8) s33RestoreUI();
  } catch (e) { console.error('[resume] restoreScreenUI', e); }
}

var RESUME_ICO_OK  = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var RESUME_ICO_ERR = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* Explanation bodies, copied from the branches they mirror. */
var S26_RESTORE_EXPLANATION = '1 ס"מ במפה שווה 1,000 ס"מ במציאות. ​<br>' +
                              'כדי למצוא את אורך השביל במציאות עלינו לכפול את המרחק במפה, שהוא 5 ס"מ ב-1,000. ​';
var S27_RESTORE_EXPLANATION = 'הפעולה מורכבת משני שלבים: ​<br>1. נכפול 7 ס"מ ב-5,000 כדי למצוא את המרחק במציאות ונקבל 35,000 ס"מ. ​<br>2. כדי להמיר את הסנטימטרים למטרים, נחלק ב-100 ונקבל 350 מטרים. ​';
var S28_RESTORE_EXPLANATION = '<strong>סעיפים א ו-ב</strong> נכונים, כיוון שכפלנו את קנה המידה ב-4 וב-10 בהתאמה.​<br>' +
                              '<strong>סעיף ג</strong> אינו נכון, כיוון ש-1 ס"מ במפה מייצג 50 ס"מ במציאות ולא 50 מטרים. ​<br>' +
                              '<strong>סעיף ד</strong> נכון, כיוון ש-50 ס"מ בתרשים מייצגים 2,500 ס"מ במציאות, שהם 25 מטרים.​';
var S29_RESTORE_EXPLANATION = 'כדי למצוא מהו גודל קיר הסלון במציאות, נשתמש בקנה המידה ונכפול:​<br>' +
                              '400 ס"מ = 2 · 200​<br>' +
                              'כדי להמיר למטרים, נחלק את 400 ב-100 (כי בכל מטר יש 100 ס"מ), ונקבל שהסלון הוא באורך 4 מטרים. ​';
var S30_RESTORE_EXPLANATION = 'נמיר 6 מטרים לס״מ ונקבל 600 ס״מ.​<br>' +
                              'מכיוון שהתכנית מוקטנת ביחס למציאות, נשתמש בפעולת חילוק.​<br>' +
                              'בקנה מידה 1:200, כל 1 ס"מ בתכנית מייצג 200 ס"מ במציאות, ולכן נחלק ב־200.​<br>' +
                              'נחלק 600 ס״מ במציאות ב-200 ונקבל שאורך הקיר בתכנית הוא 3 ס"מ.​';
var S32_RESTORE_EXPLANATION_OK = 'כדי לחשב, נמיר קודם את אורך המכונית במציאות לסנטימטרים:<br>4.5 · 100 = 450 ס"מ. ​<br>' +
                                 'מכיוון שהדגם המודפס מוקטן פי 18 ​<br>' +
                                 '(קנה מידה 18 : 1), נחלק את האורך במציאות לפי קנה המידה:<br>' +
                                 '18 ÷ 450 = 25 ס"מ.​';
var S32_RESTORE_EXPLANATION_ERR = 'כדי לחשב, נמיר קודם את אורך המכונית במציאות לסנטימטרים:<br>4.5 · 100 = 450 ס"מ. ​<br>' +
                                  'מכיוון שהדגם המודפס מוקטן פי 18 (קנה מידה 18 : 1), נחלק את האורך במציאות לפי קנה המידה:​<br>' +
                                  ' 18 ÷ 450 = 25 ס"מ.';
var S33_RESTORE_EXPLANATION = '25 מטרים הם 2,500 ס"מ, לכן היחס בין אורך הבריכה בתכנית לאורכה במציאות הוא 2,500 : 5 .​<br>' +
                              'נחלק ב-5 ונקבל את קנה המידה  500 : 1 . ​';

/* Screens 1, 2 and 5 — the dropdown-completion screens. Mirror s26Submit / s27Submit / s30Submit.
   The row labels are not recomputed here: applyResumeDom() already put the captured display text
   back, which is exactly what the correct branch leaves on screen. The final-wrong branch
   overwrites the rows with the correct labels, so that one is applied explicitly. */
function restoreDropdownScreenUI(cfg) {
  var fb     = document.getElementById(cfg.prefix + '-feedback');
  var fbBold = document.getElementById(cfg.prefix + '-fb-bold');
  var fbReg  = document.getElementById(cfg.prefix + '-fb-regular');
  var cont   = document.getElementById(cfg.prefix + '-continue');
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (cfg.solved) {
    cfg.rows.forEach(function (n) {
      var valEl  = document.getElementById(cfg.prefix + '-val' + n);
      var wrap   = document.getElementById(cfg.prefix + '-wrap' + n);
      var trig   = wrap ? wrap.querySelector('.s5-dd-trigger') : null;
      var iconEl = document.getElementById(cfg.prefix + '-dd-icon-' + n);
      if (cfg.lockTriggers && trig) trig.disabled = true;
      if (cfg.correct) {
        if (wrap)   wrap.classList.add('is-correct');
        if (iconEl) iconEl.innerHTML = RESUME_ICO_OK;
        return;
      }
      if (valEl) valEl.textContent = cfg.labels[n];
      var isOk = (cfg.vals[n] === cfg.correctVals[n]);
      if (wrap) {
        if (isOk) { wrap.classList.remove('is-incorrect'); wrap.classList.add('is-correct'); }
        else      { wrap.classList.remove('is-correct');   wrap.classList.add('is-incorrect'); }
      }
      if (iconEl) iconEl.innerHTML = isOk ? RESUME_ICO_OK : RESUME_ICO_ERR;
    });
    fbBold.textContent = cfg.correct ? cfg.boldCorrect : cfg.boldWrong;
    fbReg.innerHTML    = cfg.correct ? cfg.explanation : (cfg.wrongPrefix || '') + cfg.explanation;
    fb.classList.add(cfg.correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    if (cfg.onContinue) cont.onclick = cfg.onContinue;
    return;
  }

  if (cfg.attempts >= 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.innerHTML    = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
  }
  cont.disabled = !cfg.rows.every(function (n) { return cfg.vals[n]; });   // the live predicate
}

function s26RestoreUI() {
  restoreDropdownScreenUI({
    prefix: 's26', rows: [1, 2, 3], lockTriggers: true,
    solved: s26Solved, correct: s26Correct, attempts: s26Attempts,
    vals: s26Vals, correctVals: S26_CORRECT, labels: { 1: '5', 2: '1,000', 3: '5,000' },
    boldCorrect: 'נהדר!​', boldWrong: 'זו טעות, לא נורא – בואו נלמד ממנה:​',
    explanation: S26_RESTORE_EXPLANATION, wrongPrefix: 'התרגיל הנכון מוצג כעת.​<br>'
    /* no onContinue: s26Submit guards on s26Solved and forwards, as the live path relies on */
  });
}

function s27RestoreUI() {
  restoreDropdownScreenUI({
    prefix: 's27', rows: [1, 2], lockTriggers: false,
    solved: s27Solved, correct: s27Correct, attempts: s27Attempts,
    vals: s27Vals, correctVals: S27_CORRECT, labels: { 1: '35,000', 2: '350' },
    boldCorrect: 'יופי!​', boldWrong: 'זה לא נכון, אבל מכל טעות אפשר ללמוד:​',
    explanation: S27_RESTORE_EXPLANATION,
    onContinue: function () { goTo(3); }
  });
}

function s30RestoreUI() {
  restoreDropdownScreenUI({
    prefix: 's30', rows: [1, 2, 3, 4], lockTriggers: true,
    solved: s30Solved, correct: s30Correct, attempts: s30Attempts,
    vals: s30Vals, correctVals: S30_CORRECT,
    labels: { 1: '600', 2: 'חילוק', 3: '200', 4: '3' },
    boldCorrect: 'מעולה! ​', boldWrong: 'זה לא מדוייק, אבל בואו נלמד מזה:',
    explanation: S30_RESTORE_EXPLANATION,
    onContinue: function () { routeAfterBasicPractice(); }
  });
}

/* Screen 3 — multi-select. Mirrors s28Submit, whose two terminal branches paint the same marks. */
function s28RestoreUI() {
  var fb     = document.getElementById('s28-feedback');
  var fbBold = document.getElementById('s28-fb-bold');
  var fbReg  = document.getElementById('s28-fb-regular');
  var cont   = document.getElementById('s28-continue');
  var opts   = Array.prototype.slice.call(document.querySelectorAll('[data-screen="3"] .s5-opt'));
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (s28Solved) {
    opts.forEach(function (opt, i) {
      opt.classList.remove('is-selected');
      opt.disabled = true;
      opt.classList.add(S28_CORRECT.indexOf(i) >= 0 ? 'is-correct' : 'is-incorrect');
    });
    fbBold.textContent = s28Correct ? 'מעולה! ​' : 'זה לא נכון, אבל מכל טעות אפשר ללמוד:​';
    fbReg.innerHTML    = S28_RESTORE_EXPLANATION;
    fb.classList.add(s28Correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    cont.onclick     = function () { goTo(4); };
    return;
  }

  opts.forEach(function (opt, i) {
    opt.classList.toggle('is-selected', s28Selected.indexOf(i) >= 0);
  });
  if (s28Attempts >= 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.innerHTML    = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
  }
  cont.disabled = (s28Selected.length === 0);   // the live predicate
}

/* Screens 4 and 7 — value inputs. Mirror s29Submit / s32Submit. */
function restoreValueScreenUI(cfg) {
  var fb      = document.getElementById(cfg.prefix + '-feedback');
  var fbBold  = document.getElementById(cfg.prefix + '-fb-bold');
  var fbReg   = document.getElementById(cfg.prefix + '-fb-regular');
  var cont    = document.getElementById(cfg.prefix + '-continue');
  var hintBtn = document.getElementById(cfg.prefix + '-hint-btn');
  var input   = document.getElementById(cfg.prefix + '-answer-input');
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (cfg.solved) {
    if (input) input.disabled = true;
    fbBold.textContent = cfg.correct ? cfg.boldCorrect : cfg.boldWrong;
    fbReg.innerHTML    = cfg.correct ? cfg.explanationOk : cfg.explanationErr;
    fb.classList.add(cfg.correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    if (cfg.onContinue) cont.onclick = cfg.onContinue;
    return;
  }

  if (cfg.attempts >= 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (cfg.revealHint && hintBtn) hintBtn.hidden = false;
  }
  cont.disabled = !(input && input.value.trim() !== '');   // the live predicate
}

function s29RestoreUI() {
  restoreValueScreenUI({
    prefix: 's29', solved: s29Solved, correct: s29Correct, attempts: s29Attempts,
    boldCorrect: 'מעולה! ​', boldWrong: 'זה לא מדוייק, אבל כל הכבוד על הניסיון!​',
    explanationOk: S29_RESTORE_EXPLANATION, explanationErr: S29_RESTORE_EXPLANATION,
    revealHint: false
    /* no onContinue: s29Submit guards on s29Solved and forwards */
  });
}

function s32RestoreUI() {
  restoreValueScreenUI({
    prefix: 's32', solved: s32Solved, correct: s32Correct, attempts: s32Attempts,
    boldCorrect: 'כל הכבוד! ​', boldWrong: 'זו טעות, אבל יש לנו הזדמנות ללמוד:​',
    explanationOk: S32_RESTORE_EXPLANATION_OK, explanationErr: S32_RESTORE_EXPLANATION_ERR,
    revealHint: true,
    onContinue: function () { goTo(8); }
  });
}

/* Screen 8 — single choice. Mirrors s33Submit. */
function s33RestoreUI() {
  var fb      = document.getElementById('s33-feedback');
  var fbBold  = document.getElementById('s33-fb-bold');
  var fbReg   = document.getElementById('s33-fb-regular');
  var cont    = document.getElementById('s33-continue');
  var hintBtn = document.getElementById('s33-hint-btn');
  var opts    = Array.prototype.slice.call(document.querySelectorAll('[data-screen="8"] .s5-opt'));
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (s33Solved) {
    opts.forEach(function (o, i) {
      o.disabled = true;
      o.classList.remove('is-selected');
      if (s33Correct) {
        if (i === s33Selected) o.classList.add('is-correct');
      } else if (i === S33_CORRECT) {
        o.classList.add('is-correct');
      } else if (i === s33Selected) {
        o.classList.add('is-incorrect');
      }
    });
    fbBold.textContent = s33Correct ? 'יופי! ​' : 'זו טעות, לא נורא – בואו נלמד ממנה:​';
    fbReg.innerHTML    = S33_RESTORE_EXPLANATION;
    fb.classList.add(s33Correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    cont.onclick     = function () { routeAfterAdvancedPractice(); };
    return;
  }

  if (s33Selected !== null && s33Selected !== undefined) {
    opts.forEach(function (o, i) { o.classList.toggle('is-selected', i === s33Selected); });
    cont.disabled = false;
  }
  if (s33Attempts >= 1) {
    fbBold.textContent = 'זה לא מדויק, ננסה שוב?';
    fbReg.textContent  = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
  }
}



/* xAPI loader: ../unit-js/50-loader.js. This component supplies its metadata file
   and, where it needs one, an onXapiReady() hook. */
var XAPI_METADATA_FILE = '../metadata/methodica-math-scale-01-02.json';
