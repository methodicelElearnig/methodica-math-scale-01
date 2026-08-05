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
var RESUME_ENABLED = false;


function announce(msg) {
  var el = document.getElementById('a11y-announcer');
  if (!el || !msg) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = msg; }, 50);
}

const TOTAL_SCREENS = 9;
let currentScreen = 0;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
const _savedChar = localStorage.getItem('lomdaCharacter');
if (_savedChar) window.lomdaState.selectedCharacter = _savedChar;

(function preloadCharacterImages() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    ['', '_holdhands'].forEach(function(v) {
      var img = new Image(); img.src = './assets/images/' + c + v + '.png';
    });
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
function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const nextScreen = document.querySelector(`[data-screen="${n}"]`);
  nextScreen.classList.add('active');
  currentScreen = n;
  try { xapiOnScreen(n); } catch (e) {}
  resetScreenState(n);
  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
}

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


/* ── Ratio helper ── */
function checkRatio(input, a, b) {
  var s = input.replace(/\s/g, '').replace(/,/g, '');
  var parts = s.split(':');
  if (parts.length !== 2) return false;
  return (parts[0] === String(a) && parts[1] === String(b)) ||
         (parts[0] === String(b) && parts[1] === String(a));
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

/* ── Dev tool bridge (index_dev.html postMessage) ── */
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'DEV_GOTO') { goTo(e.data.screen); }
});

document.addEventListener('DOMContentLoaded', function () {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'DEV_READY', total: TOTAL_SCREENS }, '*');
  }
});


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

// 2/2 נכון → תרגול כיתה (03) | פחות → ללא מעבר כרגע
function routeAfterAdvancedPractice() {
  /* xAPI: report the component before deciding whether the learner may move on. This runs
     on BOTH paths — a learner who does not clear 2/2 stays on this screen, and without a
     'completed' here their whole attempt would never be reported. The library allows one
     'completed' per object per page load, so the repeat on a later retry is dropped. */
  try { xapiFinishItems(); } catch (e) {}
  try {
    var _n = xapiCorrectCount();
    sendStatement720('completed', 'onlinelesson',
      { success: getBasicPracticeScore() >= 3 && getAdvancedPracticeScore() >= 2,
        score: { scaled: _n / 7 } });
  } catch (e) { console.error('[xAPI] completed component 02', e); }
  if (getAdvancedPracticeScore() >= 2) {
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
}


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
var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1, '004': 1, '005': 1, '006': 1, '007': 1 };

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
   Gen-A: five basic exercises (dropdown/multi-select/value) + two advanced ones.

   SHIPPED GATED OFF (RESUME_ENABLED = false at the top of this file), so none of this
   runs today: _resumeReady stays false, which also neutralises the beforeunload flush.
   Before enabling: flip RESUME_ENABLED (that also loads xapi-720-j.js, which carries the
   State transport -i lacks), then verify restore on every screen of every component.
   Restore leans on this component's own design — resetScreenState(n) calls each
   sNNEnter(), which rebuilds its screen from these variables — so restoring the
   variables and calling goTo() is enough for the visuals to follow.
   ═══════════════════════════════════════════════════════════════════ */
var RESUME_STATE_ID    = 'execution-state';
var _resumeReady       = false;
var _restoring         = false;
var _leavingToNextPart = false;

function currentPartSlug() {
  var p = window.location.pathname.replace(/\/index\.html.*$/, '').replace(/\/+$/, '');
  return p.split('/').pop() || '';
}

/* Variables copied verbatim in both directions. */
var RESUME_PLAIN_VARS = ['s26Solved', 's26Correct', 's26Attempts', 's27Solved', 's27Correct', 's27Attempts', 's28Solved', 's28Correct', 's28Attempts', 's29Solved', 's29Correct', 's29Attempts', 's30Solved', 's30Correct', 's30Attempts', 's32Solved', 's32Correct', 's32Attempts', 's33Solved', 's33Correct', 's33Attempts', 's33Selected'];

function captureExecutionState() {
  var st = {
    v: 1,
    part: currentPartSlug(),
    currentScreen: currentScreen,
    qResults: Object.assign({}, XAPI_Q_RESULTS),
    s26Vals: Object.assign({}, s26Vals),
    s27Vals: Object.assign({}, s27Vals),
    s30Vals: Object.assign({}, s30Vals),
    s28Selected: s28Selected.slice(),
    vars: {}
  };
  /* eval keeps this list-driven: these are file-scope `var`/`let` bindings, so they are
     not reachable as window properties. */
  RESUME_PLAIN_VARS.forEach(function (k) {
    try { st.vars[k] = eval(k); } catch (e) {}
  });
  return st;
}

function applyExecutionState(st) {
  if (!st) return;
  _restoring = true;
  /* Replaying answers must not re-report them. */
  var _origSend = window.sendStatement720;
  window.sendStatement720 = function () {};
  try {
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
  } finally {
    window.sendStatement720 = _origSend;
    _restoring = false;
  }
  goTo((typeof st.currentScreen === 'number') ? st.currentScreen : 0);
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

window.addEventListener('beforeunload', function () {
  if (_leavingToNextPart) return;
  flushResumeSave();
});

/* ═══════════════════ xAPI — loader / init ═══════════════════ */
(function initXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';
  var METADATA_FILE = '../metadata/methodica-math-scale-01-02.json';

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
            try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}
            try { xapiWireVideos(); } catch (e) {}
            /* Resume: gated off, so _resumeReady stays false and nothing is written. */
            var _resumed = false;
            if (RESUME_ENABLED) {
              try {
                var _saved = (typeof window.loadState720 === 'function')
                  ? window.loadState720(RESUME_STATE_ID) : null;
                if (_saved && _saved.part && _saved.part !== currentPartSlug()) {
                  // Learner stopped in another component — hop there, carrying slxapi+registration.
                  window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
                  return;
                }
                _resumeReady = true;
                if (_saved) { applyExecutionState(_saved); _resumed = true; }
              } catch (e) { console.error('[resume] init', e); _resumeReady = true; }
            }
            /* Item-level init for the landing screen. applyExecutionState's goTo already reported
               the resumed screen, so only emit here on a fresh start. */
            if (!_resumed) { try { xapiOnScreen(currentScreen); } catch (e) {} }
          } catch (e) { console.error('[xAPI] init', e); }
        });
      } catch (e) { console.error('[xAPI] load', e); }
    });
  });
})();
