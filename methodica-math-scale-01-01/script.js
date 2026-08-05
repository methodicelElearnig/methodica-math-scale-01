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

const TOTAL_SCREENS = 24;
let currentScreen = 0;
window.lomdaState = { selectedCharacter: null, selectedDesign: null };
const _savedChar = localStorage.getItem('lomdaCharacter');
if (_savedChar) window.lomdaState.selectedCharacter = _savedChar;

(function preloadCharacterImages() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    ['', '_binoculars', '_roller', '_popcorn', '_cards', '_holdhands', '_workout'].forEach(function(v) {
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
let s4YTPlayer = null;
let s4PlayerReady = false;

window.onYouTubeIframeAPIReady = function () {
  var playerConfig = {
    videoId: 'Bk9KunjWSiA',
    host: 'https://www.youtube.com',
    playerVars: {
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      enablejsapi: 1
    },
    events: {
      onReady: s4OnPlayerReady,
      onStateChange: s4OnPlayerStateChange,
      onError: s4OnPlayerError
    }
  };

  if (window.location && window.location.origin && window.location.origin !== 'null') {
    playerConfig.origin = window.location.origin;
  }

  s4YTPlayer = new YT.Player('s4-yt-player', playerConfig);
};

function s4OnPlayerReady() {
  s4PlayerReady = true;
  console.log('s4 YouTube player ready', window.location.origin);
}

function s4OnPlayerError(e) {
  s4PlayerReady = false;
  s4Playing = false;
  console.warn('YouTube player error', e && e.data);
  var cover = document.getElementById('s4-video-cover');
  var playBtn = document.getElementById('s4-play-btn');
  if (cover) cover.style.display = '';
  if (playBtn) playBtn.style.display = '';
  var errMsg = document.getElementById('s4-player-error');
  if (errMsg) {
    errMsg.textContent = 'שגיאת נגן YouTube: ' + (e && e.data ? e.data : 'Unknown');
    errMsg.style.display = 'block';
  }
}

function s4OnPlayerStateChange(e) {
  /* xAPI video: YouTube drives this screen, so played/paused come from the player state rather
     than xapiWireVideos() (which only sees HTML5 <video>). Guarded on XAPI_USING_G like every
     other item-level call, and never allowed to break playback. */
  try {
    if (window.XAPI_USING_G && typeof sendStatement720 === 'function' && s4YTPlayer) {
      var _t = (typeof s4YTPlayer.getCurrentTime === 'function') ? s4YTPlayer.getCurrentTime() : 0;
      if (e.data === YT.PlayerState.PLAYING)     sendStatement720('played', 'question', null, { time: _t });
      else if (e.data === YT.PlayerState.PAUSED) sendStatement720('paused', 'question', null, { time: _t });
    }
  } catch (err) {}
  if (e.data === YT.PlayerState.ENDED) {
    s4Playing = false;
    s4VideoEnded = true;
    var sqSection = document.getElementById('s4-sq-section');
    if (sqSection) {
      sqSection.classList.remove('sq-locked');
      sqEnter(4);
    }
  }
}

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
  document.documentElement.style.setProperty('--sb-width', (12 / scale) + 'px');
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
  resetScreenState(n);
  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
}

function resetScreenState(n) {
  if (n === 0) {
    if (window.lomdaState.selectedCharacter) {
      const card = document.querySelector(`.option-card[data-value="${window.lomdaState.selectedCharacter}"]`);
      if (card) {
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        document.getElementById('s0-continue').disabled = false;
      }
    }
  }

  if (n === 1) {
    const char = window.lomdaState.selectedCharacter;
    const src1 = char === 'text'
      ? './assets/images/Character1_binoculars.png'
      : './assets/images/Character2_binoculars.png';
    const src2 = char === 'text'
      ? './assets/images/Character1_roller.png'
      : './assets/images/Character2_roller.png';
    document.getElementById('s1-char-img-1').src = src1;
    document.getElementById('s1-char-img-1').alt = 'דמות עם משקפת';
    document.getElementById('s1-char-img-2').src = src2;
    document.getElementById('s1-char-img-2').alt = 'דמות עם סרגל';
    setScale(1000);

    const inner = document.querySelector('.hook-card-inner');
    inner.scrollTop = 0;

    const widget1 = document.getElementById('s1-char-widget-1');
    const widget2 = document.getElementById('s1-char-widget-2');
    widget1.classList.remove('hidden');
    widget2.classList.add('s1-char-hidden');

    const s1Btn = document.getElementById('s1-continue');
    s1Btn.disabled = true;

    inner.onscroll = null;
    inner.addEventListener('scroll', function onScroll() {
      const sectionB = document.querySelector('.hook-section-b');
      const sectionC = document.querySelector('.hook-section-c');
      const scrollTop = inner.scrollTop;
      const containerH = inner.clientHeight;

      const sectionBVisible = sectionB.offsetTop - scrollTop < containerH * 0.75;
      const sectionCVisible = sectionC.offsetTop - scrollTop < containerH * 0.75;

      if (sectionCVisible) {
        widget1.classList.add('hidden');
        widget2.classList.remove('s1-char-hidden');
      } else if (sectionBVisible) {
        widget1.classList.add('hidden');
        widget2.classList.add('s1-char-hidden');
      } else {
        widget1.classList.remove('hidden');
        widget2.classList.add('s1-char-hidden');
      }

      const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 8;
      s1Btn.disabled = !atBottom;
    });
  }

  if (n === 2) {
    document.querySelectorAll('[data-screen="2"] .option-card').forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });
    document.getElementById('s2-continue').disabled = true;
    window.lomdaState.selectedDesign = null;

    const char = window.lomdaState.selectedCharacter;
    const isChar1 = char === 'text';
    document.getElementById('s2-char-a').src = isChar1
      ? './assets/images/Character1_popcorn.png'
      : './assets/images/Character2_popcorn.png';
    document.getElementById('s2-char-a').alt = 'דמות עם פופקורן';
    document.getElementById('s2-char-b').src = isChar1
      ? './assets/images/Character1_cards.png'
      : './assets/images/Character2_cards.png';
    document.getElementById('s2-char-b').alt = 'דמות עם קלפים';
  }

  if (n === 3) { frcEnter(); }
  if (n === 4) { s4Enter(); }
  if (n === 6) {
    var s6Img = document.getElementById('s6-char-img');
    if (s6Img) {
      s6Img.src = window.lomdaState.selectedCharacter === 'text'
        ? './assets/images/Character1_holdhands.png'
        : './assets/images/Character2_holdhands.png';
      s6Img.alt = 'דמויות מחזיקות ידיים';
    }
  }
  if (n === 7) { s7Enter(); }
  if (n === 8) { s8Enter(); }
  if (n === 9)  { s9Enter();  }
  if (n === 10) { s10Enter(); }
  if (n === 11) { s11Enter(); }
  if (n === 12) { s12Enter(); }

  if (n === 14) { s14Enter(); }
  if (n === 15) {
    var s15Img = document.getElementById('s15-char-img');
    if (s15Img) {
      s15Img.src = window.lomdaState.selectedCharacter === 'text'
        ? './assets/images/Character1_workout.png'
        : './assets/images/Character2_workout.png';
      s15Img.alt = 'דמות מתאמנת';
    }
  }
  if (n === 17) {
    var s17Img = document.getElementById('s17-char-img');
    if (s17Img) {
      s17Img.src = window.lomdaState.selectedCharacter === 'text'
        ? './assets/images/Character1.png'
        : './assets/images/Character2.png';
      s17Img.alt = 'דמות מלווה';
    }
  }
  if (n === 16) { s16Enter(); }
  if (n === 18) { s18Enter(); }
  if (n === 19) { s19Enter(); }
  if (n === 20) { s20Enter(); }
  if (n === 21) { s21Enter(); }
  if (n === 22) { s22Enter(); }
  if (n === 23) { s23Enter(); }
}

/* ── Screen 0: character selection ── */
function selectOption(cardEl) {
  document.querySelectorAll('[data-screen="0"] .option-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');
  window.lomdaState.selectedCharacter = cardEl.dataset.value;
  localStorage.setItem('lomdaCharacter', cardEl.dataset.value);
  document.getElementById('s0-continue').disabled = false;
}

function advanceFromS0() {
  if (!window.lomdaState.selectedCharacter) return;
  goTo(1);
}

/* ── Screen 2: design sub-selection ── */
function selectDesign(cardEl) {
  document.querySelectorAll('[data-screen="2"] .option-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');
  window.lomdaState.selectedDesign = cardEl.dataset.value;
  document.getElementById('s2-continue').disabled = false;
}

function advanceFromS2() {
  if (!window.lomdaState.selectedDesign) return;
  /* xAPI: the learner picked how to learn the concept — video (screen 4) or flip cards (screen 3).
     Reported as 'selected' under the learning-type category, not as a graded answer.
     (The screen-0 avatar choice stays unreported: it is decoration, not a learning preference.) */
  try {
    var _card = document.querySelector('[data-screen="2"] .option-card.selected');
    sendStatement720('selected', 'onlinelesson',
      { response: xapiAnswerText(_card) || String(window.lomdaState.selectedDesign) },
      { category: 'learning-type' });
  } catch (e) { console.error('[xAPI] selected learning-type', e); }
  goTo(window.lomdaState.selectedDesign === 'video' ? 4 : 3);
}

/* ── Screen 3: flip cards ── */
function frcFlip(cardEl) {
  const idx = parseInt(cardEl.dataset.index);
  const nowFlipped = !cardEl.classList.contains('is-flipped');
  cardEl.classList.toggle('is-flipped');
  cardEl.setAttribute('aria-expanded', nowFlipped ? 'true' : 'false');
  cardEl.querySelector('.frc-card-back')[nowFlipped ? 'removeAttribute' : 'setAttribute']('aria-hidden', 'true');
  cardEl.querySelector('.frc-card-front')[nowFlipped ? 'setAttribute' : 'removeAttribute']('aria-hidden', 'true');
  if (nowFlipped) {
    frcRevealed[idx] = true;
    frcCheckUnlock();
  }
}

function frcCheckUnlock() {
  if (frcRevealed.every(Boolean)) {
    frcDone = true;
    var sqSection = document.getElementById('s3-sq-section');
    if (sqSection) {
      sqSection.classList.remove('sq-locked');
      sqEnter(3);
    }
  }
}

function frcEnter() {
  document.querySelectorAll('[data-screen="3"] .frc-card').forEach((card, i) => {
    if (frcRevealed[i]) {
      card.classList.add('is-flipped');
      card.setAttribute('aria-expanded', 'true');
    } else {
      card.classList.remove('is-flipped');
      card.setAttribute('aria-expanded', 'false');
    }
  });
  var sqSection = document.getElementById('s3-sq-section');
  if (sqSection) sqSection.classList.toggle('sq-locked', !frcDone);
  sqScreen = 3; sqRestoreUI();
  document.getElementById('s3-continue').disabled = !(frcDone && sqSubmitted && sqQ2Submitted);

  var charImg3 = document.getElementById('s3-char-img');
  if (charImg3) {
    charImg3.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1_roller.png'
      : './assets/images/Character2_roller.png';
    charImg3.alt = 'דמות מלווה';
  }
  var s3body = document.getElementById('s3-body');
  var charWidget3 = document.getElementById('s3-char-widget');
  if (s3body && charWidget3) {
    charWidget3.classList.add('hidden');
    s3body.onscroll = function() {
      var infoSec = document.querySelector('[data-screen="3"] .s5-info-section');
      if (!infoSec) return;
      var infoVisible = infoSec.offsetTop < s3body.scrollTop + s3body.clientHeight - 40;
      charWidget3.classList.toggle('hidden', !infoVisible);
    };
  }
}

function advanceFromS3() {
  goTo(6);
}

/* ── Screen 1: scale widget ── */
function setScale(ratio) {
  const container = document.querySelector('.field-container');
  if (container) container.dataset.scale = String(ratio);

  const img = document.getElementById('field-img');
  if (img) {
    const newSrc = (ratio === 10)
      ? './assets/images/Football yard zoom.jpg'
      : (ratio === 100)
        ? './assets/images/Football yard med zoom.jpg'
        : './assets/images/Football yard.jpg';

    if (!img.src.endsWith(newSrc.replace('./', ''))) {
      img.src = newSrc;
    }
  }

  document.querySelectorAll('.scale-input').forEach(inp => {
    inp.checked = (parseInt(inp.value) === ratio);
  });
}

/* ── Screen 4: video player ── */
function s4Enter() {
  s4Playing = false;
  var cover = document.getElementById('s4-video-cover');
  if (cover) cover.style.display = '';
  var playBtn = document.getElementById('s4-play-btn');
  if (playBtn) playBtn.style.display = '';
  if (s4YTPlayer && typeof s4YTPlayer.pauseVideo === 'function') {
    s4YTPlayer.pauseVideo();
    s4YTPlayer.seekTo(0, true);
  }

  var sqSection = document.getElementById('s4-sq-section');
  if (sqSection) sqSection.classList.toggle('sq-locked', !s4VideoEnded);
  sqScreen = 4; sqRestoreUI();
  document.getElementById('s4-continue').disabled = !(s4VideoEnded && sqSubmitted && sqQ2Submitted);

  var charImg = document.getElementById('s4-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1_popcorn.png'
      : './assets/images/Character2_popcorn.png';
    charImg.alt = 'דמות עם פופקורן';
  }
  var charImgRoller = document.getElementById('s4-char-img-roller');
  if (charImgRoller) {
    charImgRoller.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1_roller.png'
      : './assets/images/Character2_roller.png';
    charImgRoller.alt = 'דמות עם סרגל';
  }

  var s4body = document.getElementById('s4-body');
  var charWidget = document.getElementById('s4-char-widget');
  var charWidgetRoller = document.getElementById('s4-char-widget-roller');
  if (s4body && charWidget) {
    charWidget.classList.remove('hidden');
    if (charWidgetRoller) charWidgetRoller.classList.add('hidden');
    s4body.onscroll = function() {
      var infoSec = document.querySelector('[data-screen="4"] .s5-info-section');
      if (!infoSec) return;
      var infoVisible = infoSec.offsetTop < s4body.scrollTop + s4body.clientHeight - 40;
      charWidget.classList.toggle('hidden', infoVisible);
      if (charWidgetRoller) charWidgetRoller.classList.toggle('hidden', !infoVisible);
    };
  }
}

function s4Start() {
  if (s4Playing) return;
  s4Playing = true;

  var cover = document.getElementById('s4-video-cover');
  if (cover) cover.style.display = 'none';
  var playBtn = document.getElementById('s4-play-btn');
  if (playBtn) playBtn.style.display = 'none';

  if (s4YTPlayer && typeof s4YTPlayer.playVideo === 'function') {
    s4YTPlayer.playVideo();
  }
}

function s4Back() {
  s4Playing = false;
  if (s4YTPlayer && typeof s4YTPlayer.pauseVideo === 'function') s4YTPlayer.pauseVideo();
  goTo(2);
}

function s4Advance() {
  if (!s4VideoEnded) return;
  goTo(6);
}

/* ── Screen 5: SingleChoiceQuestion ── */
let s5Selected = null;
let s5Submitted = false;
const S5_CORRECT = 0;

let s5Q2Selections = [null, null, null, null];
let s5Q2Submitted = false;
const S5_Q2_CORRECT = ['3,000', '1,700', '320', '700,000'];

function s5Enter() {
  s5Selected = null;
  s5Submitted = false;
  document.querySelectorAll('[data-screen="5"] .s5-opt').forEach(function (opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });

  // Reset inline feedback
  var feedback = document.getElementById('s5-inline-feedback');
  feedback.hidden = true;
  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  document.getElementById('s5-fb-bold').textContent = '';
  document.getElementById('s5-fb-regular').textContent = '';
  document.getElementById('s5-fb-icon').innerHTML = '';

  // Set toggle pill active state based on chosen design
  var design = window.lomdaState.selectedDesign;
  var btnVideo = document.getElementById('s5-toggle-video');
  var btnCards = document.getElementById('s5-toggle-cards');
  if (btnVideo && btnCards) {
    if (design === 'video') {
      btnVideo.classList.add('s3-toggle-opt--active');
      btnVideo.removeAttribute('onclick');
      btnCards.classList.remove('s3-toggle-opt--active');
      btnCards.setAttribute('onclick', 'goTo(3)');
    } else {
      btnCards.classList.add('s3-toggle-opt--active');
      btnCards.removeAttribute('onclick');
      btnVideo.classList.remove('s3-toggle-opt--active');
      btnVideo.setAttribute('onclick', 'goTo(4)');
    }
  }

  // Set character image based on chosen character
  var charImg = document.getElementById('s5-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
    charImg.alt = 'דמות מלווה';
  }

  // Reset check and continue buttons
  var checkBtn = document.getElementById('s5-check');
  if (checkBtn) checkBtn.disabled = true;
  document.getElementById('s5-continue').disabled = true;

  // Reset and scroll body to top
  var scrollEl = document.querySelector('[data-screen="5"] .s5-body');
  if (scrollEl) scrollEl.scrollTop = 0;

  // Character widget: hidden on enter, appears when scrolled into info section
  var charWidget = document.getElementById('s5-char-widget');
  if (charWidget) charWidget.classList.add('hidden');
  if (scrollEl) {
    scrollEl.onscroll = function () {
      var cw = document.getElementById('s5-char-widget');
      if (!cw) return;
      var infoSection = document.querySelector('[data-screen="5"] .s5-info-section');
      var q2wrap = document.getElementById('s5-q2-wrap');
      var infoTop = infoSection ? infoSection.offsetTop : Infinity;
      var q2Top = q2wrap ? q2wrap.offsetTop : Infinity;
      var infoVisible = scrollEl.scrollTop + scrollEl.clientHeight > infoTop + 40;
      var reachedQ2 = scrollEl.scrollTop + scrollEl.clientHeight > q2Top + 80;
      if (infoVisible && !reachedQ2) {
        cw.classList.remove('hidden');
      } else {
        cw.classList.add('hidden');
      }
    };
  }

  // Reset Q2
  s5Q2Selections = [null, null, null, null];
  s5Q2Submitted = false;
  var q2CheckBtn = document.getElementById('s5-q2-check');
  if (q2CheckBtn) q2CheckBtn.disabled = true;
  var q2feedback = document.getElementById('s5-q2-inline-feedback');
  if (q2feedback) {
    q2feedback.hidden = true;
    q2feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
    document.getElementById('s5-q2-fb-bold').textContent = '';
    document.getElementById('s5-q2-fb-regular').textContent = '';
    document.getElementById('s5-q2-fb-icon').innerHTML = '';
  }
  document.querySelectorAll('[data-screen="5"] .s5-dropdown').forEach(function (d) {
    d.classList.remove('is-open', 'is-correct', 'is-incorrect');
    var panel = document.getElementById('s5-dd-panel-' + d.dataset.row);
    if (panel) panel.hidden = true;
    var valEl = document.getElementById('s5-dd-val-' + d.dataset.row);
    if (valEl) valEl.textContent = '-';
    var iconEl = document.getElementById('s5-dd-icon-' + d.dataset.row);
    if (iconEl) iconEl.innerHTML = '';
  });
}

function s5Select(idx) {
  if (s5Submitted) return;
  if (s5Selected === idx) return;
  s5Selected = idx;
  document.querySelectorAll('[data-screen="5"] .s5-opt').forEach(function (opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var checkBtn = document.getElementById('s5-check');
  if (checkBtn) checkBtn.disabled = false;
}

function s5Continue() {
  goTo(6);
}

function s5Submit() {
  if (s5Selected === null || s5Submitted) return;
  s5Submitted = true;

  var correct = (s5Selected === S5_CORRECT);
  var opts = document.querySelectorAll('[data-screen="5"] .s5-opt');

  opts[s5Selected].classList.remove('is-selected');
  opts[s5Selected].classList.add(correct ? 'is-correct' : 'is-incorrect');
  opts.forEach(function (opt) { opt.disabled = true; });

  // Disable check button (stays visible in question area)
  var checkBtn = document.getElementById('s5-check');
  if (checkBtn) checkBtn.disabled = true;

  // Show feedback toast above bottom bar
  document.getElementById('s5-fb-bold').textContent = correct ? 'צדקת!' : 'זו טעות';
  document.getElementById('s5-fb-regular').textContent = 'המספר 100 שבצד ימין של קנה המידה מייצג את האורך במציאות. ​';
  var icon = document.getElementById('s5-fb-icon');
  if (correct) {
    icon.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#609E12"/><path d="M9 16.5L13.5 21L23 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else {
    icon.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  var feedback = document.getElementById('s5-inline-feedback');
  feedback.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
  feedback.hidden = false;

  // Enable continue button after feedback is shown
  var continueBtn = document.getElementById('s5-continue');
  if (continueBtn) continueBtn.disabled = false;

  s5CheckBothDone();
}

function s5CheckBothDone() {
  if (s5Submitted && s5Q2Submitted) {
    document.getElementById('s5-continue').disabled = false;
  }
}

function s5Q2Toggle(rowIdx) {
  if (s5Q2Submitted) return;
  var dd = document.querySelector('[data-screen="5"] .s5-dropdown[data-row="' + rowIdx + '"]');
  var isOpen = dd.classList.contains('is-open');
  document.querySelectorAll('[data-screen="5"] .s5-dropdown').forEach(function (d) {
    d.classList.remove('is-open');
    document.getElementById('s5-dd-panel-' + d.dataset.row).hidden = true;
  });
  if (!isOpen) {
    dd.classList.add('is-open');
    document.getElementById('s5-dd-panel-' + rowIdx).hidden = false;
  }
}

function s5Q2Select(rowIdx, value) {
  s5Q2Selections[rowIdx] = value;
  document.getElementById('s5-dd-val-' + rowIdx).textContent = value;
  var dd = document.querySelector('[data-screen="5"] .s5-dropdown[data-row="' + rowIdx + '"]');
  dd.classList.remove('is-open');
  document.getElementById('s5-dd-panel-' + rowIdx).hidden = true;
  if (s5Q2Selections.every(function (v) { return v !== null; })) {
    document.getElementById('s5-q2-check').disabled = false;
  }
}

function s5Q2Submit() {
  if (s5Q2Submitted) return;
  s5Q2Submitted = true;
  document.getElementById('s5-q2-check').disabled = true;

  var allCorrect = true;
  s5Q2Selections.forEach(function (val, i) {
    var dd = document.querySelector('[data-screen="5"] .s5-dropdown[data-row="' + i + '"]');
    var correct = (val === S5_Q2_CORRECT[i]);
    if (!correct) allCorrect = false;
    dd.classList.add(correct ? 'is-correct' : 'is-incorrect');
    // Show correct answer value in every dropdown
    var valEl = document.getElementById('s5-dd-val-' + i);
    if (valEl) valEl.textContent = S5_Q2_CORRECT[i];
    var iconEl = document.getElementById('s5-dd-icon-' + i);
    if (iconEl) {
      iconEl.innerHTML = correct
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  });

  // Show inline feedback
  document.getElementById('s5-q2-fb-bold').textContent = allCorrect ? 'צדקת!' : 'זו טעות';
  document.getElementById('s5-q2-fb-regular').textContent = 'התשובות הנכונות מוצגות כעת.';
  var q2icon = document.getElementById('s5-q2-fb-icon');
  if (q2icon) {
    q2icon.innerHTML = allCorrect
      ? '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#609E12"/><path d="M9 16.5L13.5 21L23 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#B20010"/><path d="M11 11L21 21M21 11L11 21" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  var feedback = document.getElementById('s5-q2-inline-feedback');
  feedback.classList.add(allCorrect ? 's5-fb--correct' : 's5-fb--incorrect');
  feedback.hidden = false;

  s5CheckBothDone();
}

/* ── Screens 3/4: embedded questions ── */
let sqScreen = 3;
let sqSelected = null;
let sqSubmitted = false;
const SQ_CORRECT = 0;
let sqQ2Selections = [null, null, null, null];
let sqQ2Submitted = false;
const SQ_Q2_CORRECT = ['3,000', '1,700', '320', '700,000'];

function sqEnter(screenNum) {
  sqScreen = screenNum;
  sqRestoreUI();
}

function sqRestoreUI() {
  var p = 's' + sqScreen + 'q-';
  var q1correct = (sqSelected === SQ_CORRECT);

  // Q1 options
  document.querySelectorAll('[data-screen="' + sqScreen + '"] .s5-opt').forEach(function(opt, i) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = sqSubmitted;
    if (sqSubmitted && i === sqSelected) {
      opt.classList.add(q1correct ? 'is-correct' : 'is-incorrect');
    } else if (!sqSubmitted && i === sqSelected) {
      opt.classList.add('is-selected');
    }
  });

  // Q1 check button
  var checkBtn = document.getElementById(p + 'check');
  if (checkBtn) checkBtn.disabled = sqSubmitted || sqSelected === null;

  // Q1 feedback
  var feedback = document.getElementById(p + 'inline-feedback');
  if (feedback) {
    feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
    if (sqSubmitted) {
      feedback.classList.add(q1correct ? 's5-fb--correct' : 's5-fb--incorrect');
      document.getElementById(p + 'fb-bold').textContent = q1correct ? 'צדקת!' : 'זו טעות';
      document.getElementById(p + 'fb-regular').textContent = 'המספר 100 שבצד ימין של קנה המידה מייצג את האורך במציאות. ​';
      feedback.hidden = false;
    } else {
      feedback.hidden = true;
      var fbBold = document.getElementById(p + 'fb-bold');
      if (fbBold) fbBold.textContent = '';
      var fbReg = document.getElementById(p + 'fb-regular');
      if (fbReg) fbReg.textContent = '';
    }
  }

  // Q2 dropdowns
  document.querySelectorAll('[data-screen="' + sqScreen + '"] .sq-dropdown').forEach(function(d) {
    var row = parseInt(d.dataset.row);
    d.classList.remove('is-open', 'is-correct', 'is-incorrect');
    var panel = document.getElementById(p + 'dd-panel-' + row);
    if (panel) panel.hidden = true;
    var valEl = document.getElementById(p + 'dd-val-' + row);
    var iconEl = document.getElementById(p + 'dd-icon-' + row);
    if (sqQ2Submitted) {
      var rowCorrect = (sqQ2Selections[row] === SQ_Q2_CORRECT[row]);
      if (valEl) valEl.textContent = SQ_Q2_CORRECT[row];
      d.classList.add(rowCorrect ? 'is-correct' : 'is-incorrect');
      if (iconEl) iconEl.innerHTML = rowCorrect
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (sqQ2Selections[row] !== null) {
      if (valEl) valEl.textContent = sqQ2Selections[row];
      if (iconEl) iconEl.innerHTML = '';
    } else {
      if (valEl) valEl.textContent = '-';
      if (iconEl) iconEl.innerHTML = '';
    }
  });

  // Q2 check button
  var q2Check = document.getElementById(p + 'q2-check');
  if (q2Check) q2Check.disabled = sqQ2Submitted || !sqQ2Selections.every(function(v) { return v !== null; });

  // Q2 feedback
  var q2feedback = document.getElementById(p + 'q2-inline-feedback');
  if (q2feedback) {
    q2feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
    if (sqQ2Submitted) {
      var allCorrect = sqQ2Selections.every(function(val, i) { return val === SQ_Q2_CORRECT[i]; });
      q2feedback.classList.add(allCorrect ? 's5-fb--correct' : 's5-fb--incorrect');
      var q2Bold = document.getElementById(p + 'q2-fb-bold');
      if (q2Bold) q2Bold.textContent = allCorrect ? 'צדקת!' : 'זו טעות';
      var q2Reg = document.getElementById(p + 'q2-fb-regular');
      if (q2Reg) q2Reg.textContent = 'התשובות הנכונות מוצגות כעת.';
      q2feedback.hidden = false;
    } else {
      q2feedback.hidden = true;
      var q2Bold2 = document.getElementById(p + 'q2-fb-bold');
      if (q2Bold2) q2Bold2.textContent = '';
      var q2Reg2 = document.getElementById(p + 'q2-fb-regular');
      if (q2Reg2) q2Reg2.textContent = '';
    }
  }

  // Continue button
  var activityDone = (sqScreen === 3) ? frcDone : s4VideoEnded;
  document.getElementById('s' + sqScreen + '-continue').disabled = !(activityDone && sqSubmitted && sqQ2Submitted);
}

function sqSelect(idx) {
  if (sqSubmitted) return;
  if (sqSelected === idx) return;
  sqSelected = idx;
  var p = 's' + sqScreen + 'q-';
  document.querySelectorAll('[data-screen="' + sqScreen + '"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var checkBtn = document.getElementById(p + 'check');
  if (checkBtn) checkBtn.disabled = false;
}

function sqSubmit() {
  if (sqSelected === null || sqSubmitted) return;
  sqSubmitted = true;
  var p = 's' + sqScreen + 'q-';
  var correct = (sqSelected === SQ_CORRECT);
  var opts = document.querySelectorAll('[data-screen="' + sqScreen + '"] .s5-opt');
  opts[sqSelected].classList.remove('is-selected');
  opts[sqSelected].classList.add(correct ? 'is-correct' : 'is-incorrect');
  opts.forEach(function(opt) { opt.disabled = true; });
  var checkBtn = document.getElementById(p + 'check');
  if (checkBtn) checkBtn.disabled = true;
  document.getElementById(p + 'fb-bold').textContent = correct ? 'צדקת!' : 'זו טעות';
  document.getElementById(p + 'fb-regular').textContent = 'המספר 100 שבצד ימין של קנה המידה מייצג את האורך במציאות. ​';
  var feedback = document.getElementById(p + 'inline-feedback');
  feedback.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
  feedback.hidden = false;
  /* xAPI: item 002 / q1. Single attempt (sqSubmitted latches), so always the last answer.
     Served from screen 3 (cards path) and screen 4 (video path) alike — same metadata item. */
  try {
    sendStatement720('answered.last', 'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(opts[sqSelected])] } },
      xapiQ('002', 'q1'));
  } catch (e) { console.error('[xAPI] answered 002/q1', e); }
  sqCheckBothDone();
}

function sqCheckBothDone() {
  if (sqSubmitted && sqQ2Submitted) {
    document.getElementById('s' + sqScreen + '-continue').disabled = false;
  }
}

function sqQ2Toggle(rowIdx) {
  if (sqQ2Submitted) return;
  var p = 's' + sqScreen + 'q-';
  var dd = document.querySelector('[data-screen="' + sqScreen + '"] .sq-dropdown[data-row="' + rowIdx + '"]');
  var isOpen = dd.classList.contains('is-open');
  document.querySelectorAll('[data-screen="' + sqScreen + '"] .sq-dropdown').forEach(function(d) {
    d.classList.remove('is-open');
    document.getElementById(p + 'dd-panel-' + d.dataset.row).hidden = true;
  });
  if (!isOpen) {
    dd.classList.add('is-open');
    document.getElementById(p + 'dd-panel-' + rowIdx).hidden = false;
  }
}

function sqQ2Select(rowIdx, value) {
  sqQ2Selections[rowIdx] = value;
  var p = 's' + sqScreen + 'q-';
  document.getElementById(p + 'dd-val-' + rowIdx).textContent = value;
  var dd = document.querySelector('[data-screen="' + sqScreen + '"] .sq-dropdown[data-row="' + rowIdx + '"]');
  dd.classList.remove('is-open');
  document.getElementById(p + 'dd-panel-' + rowIdx).hidden = true;
  if (sqQ2Selections.every(function(v) { return v !== null; })) {
    document.getElementById(p + 'q2-check').disabled = false;
  }
}

function sqQ2Submit() {
  if (sqQ2Submitted) return;
  sqQ2Submitted = true;
  var p = 's' + sqScreen + 'q-';
  document.getElementById(p + 'q2-check').disabled = true;
  /* xAPI: capture the learner's four dropdown values BEFORE the loop below overwrites every
     dd-val with the correct answer. Read from state, not the DOM, for exactly that reason. */
  var _q2Answer = sqQ2Selections.join(' | ');
  var allCorrect = true;
  sqQ2Selections.forEach(function(val, i) {
    var dd = document.querySelector('[data-screen="' + sqScreen + '"] .sq-dropdown[data-row="' + i + '"]');
    var correct = (val === SQ_Q2_CORRECT[i]);
    if (!correct) allCorrect = false;
    dd.classList.add(correct ? 'is-correct' : 'is-incorrect');
    var valEl = document.getElementById(p + 'dd-val-' + i);
    if (valEl) valEl.textContent = SQ_Q2_CORRECT[i];
    var iconEl = document.getElementById(p + 'dd-icon-' + i);
    if (iconEl) {
      iconEl.innerHTML = correct
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  });
  document.getElementById(p + 'q2-fb-bold').textContent = allCorrect ? 'צדקת!' : 'זו טעות';
  document.getElementById(p + 'q2-fb-regular').textContent = 'התשובות הנכונות מוצגות כעת.';
  var feedback = document.getElementById(p + 'q2-inline-feedback');
  feedback.classList.add(allCorrect ? 's5-fb--correct' : 's5-fb--incorrect');
  feedback.hidden = false;
  /* xAPI: item 002 / q2 — the 4-row unit-conversion matching. Single attempt. */
  try {
    sendStatement720('answered.last', 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 },
        extensions: { student_answer: [_q2Answer] } },
      xapiQ('002', 'q2'));
  } catch (e) { console.error('[xAPI] answered 002/q2', e); }
  sqCheckBothDone();
}

/* ── Screen 16: שאלת חימום (duplicate of screen 5) ── */
let s16Selected = null;
let s16Submitted = false;
const S16_CORRECT = 0;

let s16Q2Selections = [null, null, null, null];
let s16Q2Submitted = false;
const S16_Q2_CORRECT = ['3,000', '1,700', '320', '700,000'];

function s16Enter() {
  s16Selected = null;
  s16Submitted = false;
  document.querySelectorAll('[data-screen="16"] .s5-opt').forEach(function (opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });

  var feedback = document.getElementById('s16-inline-feedback');
  if (feedback) {
    feedback.hidden = true;
    feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
    document.getElementById('s16-fb-bold').textContent = '';
    document.getElementById('s16-fb-regular').textContent = '';
  }

  var charImg = document.getElementById('s16-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1_workout.png'
      : './assets/images/Character2_workout.png';
    charImg.alt = 'דמות מלווה';
  }

  var contBtn = document.getElementById('s16-continue');
  if (contBtn) contBtn.disabled = true;

}

function s16Select(idx) {
  if (s16Submitted) return;
  if (s16Selected === idx) return;
  s16Selected = idx;
  document.querySelectorAll('[data-screen="16"] .s5-opt').forEach(function (opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var contBtn = document.getElementById('s16-continue');
  if (contBtn) contBtn.disabled = false;
}

function s16ToggleHint() {
  var popup = document.getElementById('s16-hint-popup');
  if (popup) {
    popup.hidden = false;
    announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('004', 'q1')); } catch (e) {}
  }
}

function s16CloseHint() {
  var popup = document.getElementById('s16-hint-popup');
  if (popup) popup.hidden = true;
}

/* ── Quiz nav state (screens 18–22) ── */
var s18QuizResults = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
var s18QScreens    = [18, 19, 21, 22, 23];

function s18UpdateNav(currentQ, navScreenId) {
  var screenId = navScreenId || ('s' + s18QScreens[currentQ - 1]);
  var nav = document.querySelector('#' + screenId + ' .s18-nav');
  if (!nav) return;

  var items = nav.querySelectorAll('.s18-nav-item');
  var lines = nav.querySelectorAll('.s18-nav-line');

  // Q2 is compound (screens 19+20): dots 2+3 show combined result
  var q2a = s18QuizResults[2], q2b = s18QuizResults[3];
  var q2Combined = (q2a !== null && q2b !== null)
    ? ((q2a === 'correct' && q2b === 'correct') ? 'correct' : 'wrong')
    : null;

  items.forEach(function (item, i) {
    var q      = i + 1;
    var result = (q === 2) ? q2Combined
               : (q === 3) ? s18QuizResults[4]
               : (q === 4) ? s18QuizResults[5]
               : (q === 5) ? s18QuizResults[6]
               : s18QuizResults[q];
    var navDest = s18QScreens[i];
    var icon   = item.querySelector('.s18-nav-icon');
    var label  = item.querySelector('.s18-nav-label');

    icon.className   = 's18-nav-icon';
    item.onclick     = null;
    item.style.cursor = '';

    if (q === currentQ) {
      icon.classList.add('s18-nav-icon--active');
      label.className = 's18-nav-label s18-nav-label--on';
    } else if (result === 'correct') {
      icon.classList.add('s18-nav-icon--done');
      label.className = 's18-nav-label s18-nav-label--on';
      item.style.cursor = 'pointer';
      (function (sc) { item.onclick = function () { goTo(sc); }; })(navDest);
    } else if (result === 'wrong') {
      icon.classList.add('s18-nav-icon--wrong');
      label.className = 's18-nav-label s18-nav-label--on';
      item.style.cursor = 'pointer';
      (function (sc) { item.onclick = function () { goTo(sc); }; })(navDest);
    } else {
      icon.classList.add('s18-nav-icon--off');
      label.className = 's18-nav-label s18-nav-label--off';
    }

    if (i < 4) {
      var line = lines[i];
      if (result === 'correct' || result === 'wrong') {
        line.classList.add('s18-nav-line--done');
      } else {
        line.classList.remove('s18-nav-line--done');
      }
    }
  });
}

/* ── Screen 18 ── */
var s18Attempts = 0;
var s18Solved = false;
var s18Correct = false;
var s18RulerDragging = false;
var s18RulerInitialized = false;

/* INVARIANT: must return exactly the scale scaleApp() applies, or the ruler stops
   tracking the cursor 1:1. If the formula changes in one place, change it in both. */
function s18GetScale() {
  var scaleX = window.innerWidth / 1280;
  var scaleY = window.innerHeight / 720;
  return Math.min(scaleX, scaleY);
}

function s18InitRuler() {
  if (s18RulerInitialized) return;
  s18RulerInitialized = true;
  var ruler = document.getElementById('s18-ruler');
  if (!ruler) return;
  var s18RulerStartX = 0, s18RulerStartY = 0, s18RulerStartLeft = 0, s18RulerStartTop = 0;
  ruler.addEventListener('mousedown', function(e) {
    s18RulerDragging = true;
    s18RulerStartX = e.clientX;
    s18RulerStartY = e.clientY;
    s18RulerStartLeft = ruler.offsetLeft;
    s18RulerStartTop  = ruler.offsetTop;
    ruler.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!s18RulerDragging) return;
    var r = document.getElementById('s18-ruler');
    if (!r) return;
    var scale = s18GetScale();
    var dx2 = (e.clientX - s18RulerStartX) / scale;
    var dy2 = (e.clientY - s18RulerStartY) / scale;
    var newLeft = s18RulerStartLeft + dx2;
    var newTop  = s18RulerStartTop  + dy2;

    /* הסרגל מסתובב 90 מעלות — התיבה החזותית שלו הפוכה (רוחב/גובה מוחלפים) */
    var w = r.offsetWidth, h = r.offsetHeight;
    var dx = (w - h) / 2;
    var minLeft = Math.min(-dx, 1280 - h - dx);
    var maxLeft = Math.max(-dx, 1280 - h - dx);
    var minTop  = Math.min(dx, 720 - w + dx);
    var maxTop  = Math.max(dx, 720 - w + dx);
    newLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);
    newTop  = Math.min(Math.max(newTop, minTop), maxTop);

    r.style.left = newLeft + 'px';
    r.style.top  = newTop + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!s18RulerDragging) return;
    s18RulerDragging = false;
    var r = document.getElementById('s18-ruler');
    if (r) r.style.cursor = 'grab';
  });
}

function s18Enter() {
  s18Attempts = 0;
  s18Solved = false;
  s18Correct = false;
  s18UpdateNav(1);
  var ruler = document.getElementById('s18-ruler');
  if (ruler) { ruler.style.left = '250px'; ruler.style.top = '175px'; }
  s18InitRuler();
  var charImg = document.getElementById('s18-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
    charImg.alt = 'דמות מלווה';
  }
  var input = document.getElementById('s18-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var continueBtn = document.getElementById('s18-continue');
  if (continueBtn) continueBtn.disabled = true;
  var hintBtn = document.getElementById('s18-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s18-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  var feedback = document.getElementById('s18-feedback');
  if (feedback) {
    feedback.hidden = true;
    feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  }
}

function s18CheckInput() {
  if (s18Solved) return;
  var input = document.getElementById('s18-answer-input');
  var continueBtn = document.getElementById('s18-continue');
  if (continueBtn) continueBtn.disabled = !(input && input.value.trim().length > 0);
}

function s18ToggleHint() {
  var popup = document.getElementById('s18-hint-popup');
  if (popup) {
    popup.hidden = false;
    announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('005', 'q1')); } catch (e) {}
  }
}

function s18CloseHint() {
  var popup = document.getElementById('s18-hint-popup');
  if (popup) popup.hidden = true;
}

function s18Submit() {
  if (s18Solved) { goTo(19); return; }

  var input = document.getElementById('s18-answer-input');
  var answer = (input ? input.value.trim() : '').replace(/\s/g, '');
  var correct = (answer === '24');

  s18Attempts++;

  /* xAPI: item 005 / q1 (quiz exercise 1). Two attempts allowed — the first wrong answer is an
     interim 'answered'; a correct answer or the second wrong one closes the question. Only
     'answered.last' feeds the component score denominator. */
  try {
    sendStatement720(correct ? 'answered.last' : (s18Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [answer] } },
      xapiQ('005', 'q1'));
  } catch (e) { console.error('[xAPI] answered 005/q1', e); }

  var feedback  = document.getElementById('s18-feedback');
  var fbBold    = document.getElementById('s18-fb-bold');
  var fbRegular = document.getElementById('s18-fb-regular');
  var continueBtn = document.getElementById('s18-continue');

  var explanationCorrect = 'לפי קנה המידה הנתון, אורך הנעל במציאות גדול פי 6 מאורך הנעל בתמונה. ​<br>' +
                    'ראינו שאורך הנעל בתמונה הוא 4 ס"מ, נכפול אותו ב-6 ונקבל:​<br>' +
                    ' 24 ס"מ = 6 · 4​<br>' +
                    'מכאן שאורך הנעל במציאות הוא 24 ס"מ.​';
  var explanationWrong = explanationCorrect;

  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s18Solved = true;
    s18Correct = true;
    s18QuizResults[1] = 'correct';
    fbBold.textContent = 'יפה מאוד!​';
    fbRegular.innerHTML = explanationCorrect;
    feedback.classList.add('s5-fb--correct');
    feedback.hidden = false;
    input.disabled = true;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('יפה מאוד!');
  } else if (s18Attempts === 1) {
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    announce('זה לא מדוייק, ננסה שוב?');
    document.getElementById('s18-hint-btn').hidden = false;
    continueBtn.disabled = true;
  } else {
    s18Solved = true;
    s18QuizResults[1] = 'wrong';
    fbBold.textContent = 'זו טעות, בואו נדייק​';
    fbRegular.innerHTML = explanationWrong;
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    input.disabled = true;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
}

/* ── Ratio helper ── */
function checkRatio(input, a, b) {
  var s = input.replace(/\s/g, '').replace(/,/g, '');
  var parts = s.split(':');
  if (parts.length !== 2) return false;
  return (parts[0] === String(a) && parts[1] === String(b)) ||
         (parts[0] === String(b) && parts[1] === String(a));
}

/* ── Screen 19 ── */
var s19Attempts = 0;
var s19Solved = false;
var s19Correct = false;

function s19Enter() {
  s19Attempts = 0;
  s19Solved = false;
  s19Correct = false;
  s18UpdateNav(2);
  var input = document.getElementById('s19-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var continueBtn = document.getElementById('s19-continue');
  if (continueBtn) continueBtn.disabled = true;
  var hintBtn = document.getElementById('s19-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s19-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  var feedback = document.getElementById('s19-feedback');
  if (feedback) {
    feedback.hidden = true;
    feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  }
}

function s19CheckInput() {
  if (s19Solved) return;
  var input = document.getElementById('s19-answer-input');
  var continueBtn = document.getElementById('s19-continue');
  if (continueBtn) continueBtn.disabled = !(input && input.value.trim().length > 0);
}

function s19ToggleHint() {
  var popup = document.getElementById('s19-hint-popup');
  if (popup) {
    popup.hidden = false;
    announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('006', 'q1')); } catch (e) {}
  }
}

function s19CloseHint() {
  var popup = document.getElementById('s19-hint-popup');
  if (popup) popup.hidden = true;
}

function s19Submit() {
  if (s19Solved) { goTo(20); return; }

  var input = document.getElementById('s19-answer-input');
  var answer = input ? input.value.trim() : '';
  var correct = (answer === '20');

  s19Attempts++;

  /* xAPI: item 006 / q1 (quiz exercise 2, part א). */
  try {
    sendStatement720(correct ? 'answered.last' : (s19Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [answer] } },
      xapiQ('006', 'q1'));
  } catch (e) { console.error('[xAPI] answered 006/q1', e); }

  var feedback    = document.getElementById('s19-feedback');
  var fbBold      = document.getElementById('s19-fb-bold');
  var fbRegular   = document.getElementById('s19-fb-regular');
  var continueBtn = document.getElementById('s19-continue');

  var explanationCorrect = '1.4 מטרים שווים ל-140 ס"מ,​ ולכן היחס בין האורכים הוא 140 : 7 .​<br>' +
                    'נצמצם את היחס ב-7 ​ונקבל שקנה המידה הוא 20 : 1 .​';
  var explanationWrong = '1.4 מטרים שווים ל-140 ס"מ,​ ולכן היחס בין האורכים הוא 140 : 7 .​<br>' +
                    'נצמצם את היחס ב-7 ​ונקבל שקנה המידה הוא 20 : 1 .​';

  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');

  if (correct) {
    s19Solved = true;
    s19Correct = true;
    s18QuizResults[2] = 'correct';
    fbBold.textContent = 'יפה מאוד!​';
    fbRegular.innerHTML = explanationCorrect;
    feedback.classList.add('s5-fb--correct');
    feedback.hidden = false;
    input.disabled = true;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('יפה מאוד!');
  } else if (s19Attempts === 1) {
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    document.getElementById('s19-hint-btn').hidden = false;
    continueBtn.disabled = true;
    announce('זה לא מדוייק, ננסה שוב?');
  } else {
    s19Solved = true;
    s18QuizResults[2] = 'wrong';
    fbBold.textContent = 'זו טעות, בואו נדייק​';
    fbRegular.innerHTML = explanationWrong;
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    input.disabled = true;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
}

/* ── Screen 20 ── */
var s20Selected = null;
var s20Attempts = 0;
var s20Solved = false;
var s20Correct = false;
var S20_CORRECT = 1;

function s20Enter() {
  s20Selected = null;
  s20Attempts = 0;
  s20Solved = false;
  s20Correct = false;
  document.querySelectorAll('[data-screen="20"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });
  var continueBtn = document.getElementById('s20-continue');
  if (continueBtn) continueBtn.disabled = true;
  var hintBtn = document.getElementById('s20-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s20-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  var feedback = document.getElementById('s20-feedback');
  if (feedback) { feedback.hidden = true; feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  s18UpdateNav(2, 's20');
}

function s20Select(idx) {
  if (s20Solved) return;
  s20Selected = idx;
  document.querySelectorAll('[data-screen="20"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var continueBtn = document.getElementById('s20-continue');
  if (continueBtn) continueBtn.disabled = false;
}

function s20ToggleHint() { var p = document.getElementById('s20-hint-popup'); if (p) { p.hidden = false; announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('006', 'q2')); } catch (e) {}
  } }
function s20CloseHint()  { var p = document.getElementById('s20-hint-popup'); if (p) { p.hidden = true; announce('רמז נסגר'); } }

function s20Submit() {
  if (s20Solved) { goTo(21); return; }
  if (s20Selected === null) return;
  var correct = (s20Selected === S20_CORRECT);
  s20Attempts++;
  /* xAPI: item 006 / q2 (quiz exercise 2, part ב). Reported before the wrong-answer branch below
     clears s20Selected, which would otherwise lose the learner's answer text. */
  try {
    sendStatement720(correct ? 'answered.last' : (s20Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="20"] .s5-opt')[s20Selected])] } },
      xapiQ('006', 'q2'));
  } catch (e) { console.error('[xAPI] answered 006/q2', e); }
  var feedback    = document.getElementById('s20-feedback');
  var fbBold      = document.getElementById('s20-fb-bold');
  var fbRegular   = document.getElementById('s20-fb-regular');
  var continueBtn = document.getElementById('s20-continue');
  var explanationCorrect = 'נמיר את מידות השטיח במציאות לסנטימטרים: 180 ס"מ ו-240 ס"מ. ​<br>' +
    'מכיוון שקנה המידה הוא 20 : 1 (הקטנה פי 20 של מידות השטיח בתרשים), נחלק כל מידה ב-20 ונקבל שרוחב השטיח בתרשים הוא 9 ס"מ ואורכו 12 ס"מ.​';
  var explanationWrong = explanationCorrect;
  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  var opts = document.querySelectorAll('[data-screen="20"] .s5-opt');
  if (correct) {
    s20Solved = true; s20Correct = true; s18QuizResults[3] = 'correct';
    opts.forEach(function(o,i){ o.disabled=true; o.classList.toggle('is-correct', i===S20_CORRECT); });
    fbBold.textContent = 'יפה!​'; fbRegular.innerHTML = explanationCorrect;
    feedback.classList.add('s5-fb--correct'); feedback.hidden = false; continueBtn.textContent = 'שנמשיך?'; continueBtn.disabled = false;
    announce('יפה!');
  } else if (s20Attempts === 1) {
    opts.forEach(function(o) { o.classList.remove('is-selected'); });
    s20Selected = null;
    continueBtn.disabled = true;
    document.getElementById('s20-hint-btn').hidden = false;
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?'; fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false;
    announce('זה לא מדוייק, ננסה שוב?');
  } else {
    s20Solved = true; s18QuizResults[3] = 'wrong';
    opts.forEach(function(o,i){ o.disabled=true; o.classList.toggle('is-correct',i===S20_CORRECT); o.classList.toggle('is-incorrect',i===s20Selected&&i!==S20_CORRECT); });
    fbBold.textContent = 'זו טעות, בואו נדייק​'; fbRegular.innerHTML = explanationWrong;
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
}

/* ── Screen 21 ── */
var s21Attempts = 0;
var s21Solved = false;
var s21Correct = false;

function s21Enter() {
  s21Attempts = 0; s21Solved = false; s21Correct = false;
  var charImg = document.getElementById('s21-char-img');
  if (charImg) {
    charImg.src = window.lomdaState && window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
    charImg.alt = 'דמות מלווה';
  }
  var input = document.getElementById('s21-answer-input');
  if (input) { input.value = ''; input.disabled = false; }
  var continueBtn = document.getElementById('s21-continue');
  if (continueBtn) continueBtn.disabled = true;
  var hintBtn = document.getElementById('s21-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s21-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  var feedback = document.getElementById('s21-feedback');
  if (feedback) { feedback.hidden = true; feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect'); }
  s18UpdateNav(3, 's21');
}

function s21CheckInput() {
  if (s21Solved) return;
  var input = document.getElementById('s21-answer-input');
  var continueBtn = document.getElementById('s21-continue');
  if (continueBtn) continueBtn.disabled = !(input && input.value.trim().length > 0);
}

function s21ToggleHint() { var p = document.getElementById('s21-hint-popup'); if (p) { p.hidden = false; announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('007', 'q1')); } catch (e) {}
  } }
function s21CloseHint()  { var p = document.getElementById('s21-hint-popup'); if (p) { p.hidden = true; announce('רמז נסגר'); } }

function s21Submit() {
  if (s21Solved) { goTo(22); return; }
  var input = document.getElementById('s21-answer-input');
  var answer = input ? input.value : '';
  var correct = checkRatio(answer, 1, 25000);
  s21Attempts++;
  /* xAPI: item 007 / q1 (quiz exercise 3). */
  try {
    sendStatement720(correct ? 'answered.last' : (s21Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [String(answer).trim()] } },
      xapiQ('007', 'q1'));
  } catch (e) { console.error('[xAPI] answered 007/q1', e); }
  var feedback    = document.getElementById('s21-feedback');
  var fbBold      = document.getElementById('s21-fb-bold');
  var fbRegular   = document.getElementById('s21-fb-regular');
  var continueBtn = document.getElementById('s21-continue');
  var explanation = '2 ק"מ הם 200,000 ס"מ .<br>' +
                    'מכאן שהיחס בין אורך כל קטע במפה לבין אורך כל קטע במציאות הוא 200,000 : 8 .<br>' +
                    'נצמצם ב-8, ונקבל את קנה המידה: 25,000 : 1';
  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  if (correct) {
    s21Solved = true; s21Correct = true; s18QuizResults[4] = 'correct';
    fbBold.textContent = 'יפה מאוד!'; fbRegular.innerHTML = explanation;
    feedback.classList.add('s5-fb--correct'); feedback.hidden = false; input.disabled = true; continueBtn.textContent = 'שנמשיך?'; continueBtn.disabled = false;
    announce('יפה מאוד!');
  } else if (s21Attempts === 1) {
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?'; fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false;
    document.getElementById('s21-hint-btn').hidden = false; continueBtn.disabled = true;
    announce('זה לא מדוייק, ננסה שוב?');
  } else {
    s21Solved = true; s18QuizResults[4] = 'wrong';
    fbBold.textContent = 'זו טעות, בואו נדייק'; fbRegular.innerHTML = explanation;
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false; input.disabled = true; continueBtn.textContent = 'שנמשיך?'; continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
}

/* ── Screen 22 ── */
var s22Selected = null;
var s22Attempts = 0;
var s22Solved = false;
var s22Correct = false;
var S22_CORRECT = 1;

function s22Enter() {
  s22Selected = null;
  s22Attempts = 0;
  s22Solved = false;
  s22Correct = false;
  s18UpdateNav(4, 's22');
  document.querySelectorAll('[data-screen="22"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });
  var continueBtn = document.getElementById('s22-continue');
  if (continueBtn) continueBtn.disabled = true;
  var hintBtn = document.getElementById('s22-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s22-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  var feedback = document.getElementById('s22-feedback');
  if (feedback) {
    feedback.hidden = true;
    feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  }
  var tooltip = document.getElementById('s22-help-tooltip');
  if (tooltip) tooltip.classList.remove('visible');
}

function s22Select(idx) {
  if (s22Solved) return;
  if (s22Selected === idx) return;
  s22Selected = idx;
  document.querySelectorAll('[data-screen="22"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var continueBtn = document.getElementById('s22-continue');
  if (continueBtn) continueBtn.disabled = false;
}

function s22ToggleHelp() {
  var tooltip = document.getElementById('s22-help-tooltip');
  if (tooltip) tooltip.classList.toggle('visible');
}

function s22ToggleHint() {
  var popup = document.getElementById('s22-hint-popup');
  if (popup) {
    popup.hidden = false;
    announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('008', 'q1')); } catch (e) {}
  }
}

function s22CloseHint() {
  var popup = document.getElementById('s22-hint-popup');
  if (popup) popup.hidden = true;
}

function s22Submit() {
  if (s22Solved) { goTo(23); return; }
  if (s22Selected === null) return;

  var correct = (s22Selected === S22_CORRECT);
  s22Attempts++;

  /* xAPI: item 008 / q1 (quiz exercise 4). */
  try {
    sendStatement720(correct ? 'answered.last' : (s22Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="22"] .s5-opt')[s22Selected])] } },
      xapiQ('008', 'q1'));
  } catch (e) { console.error('[xAPI] answered 008/q1', e); }

  var feedback    = document.getElementById('s22-feedback');
  var fbBold      = document.getElementById('s22-fb-bold');
  var fbRegular   = document.getElementById('s22-fb-regular');
  var continueBtn = document.getElementById('s22-continue');

  var explanationCorrect = 'לפי קנה המידה כל ס"מ על המפה מייצג 100,000,000 ס"מ במציאות. ​<br>' +
                    'נתון שהמרחק על המפה הוא 7 ס"מ, ולכן המרחק במציאות הוא 700,000,000 ס"מ, שהם 7,000 ק"מ.​';
  var explanationWrong = explanationCorrect;

  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  var opts = document.querySelectorAll('[data-screen="22"] .s5-opt');

  if (correct) {
    s22Solved = true;
    s22Correct = true;
    s18QuizResults[5] = 'correct';
    opts[s22Selected].classList.remove('is-selected');
    opts[s22Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent = 'יפה!​';
    fbRegular.innerHTML = explanationCorrect;
    feedback.classList.add('s5-fb--correct');
    feedback.hidden = false;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('יפה!');
  } else if (s22Attempts === 1) {
    opts[s22Selected].classList.remove('is-selected');
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    document.getElementById('s22-hint-btn').hidden = false;
    s22Selected = null;
    continueBtn.disabled = true;
    announce('זה לא מדוייק, ננסה שוב?');
  } else {
    s22Solved = true;
    s18QuizResults[5] = 'wrong';
    opts.forEach(function(o, i) {
      o.disabled = true;
      o.classList.remove('is-selected');
      if (i === S22_CORRECT) o.classList.add('is-correct');
      else if (i === s22Selected) o.classList.add('is-incorrect');
    });
    fbBold.textContent = 'זו טעות, בואו נדייק​';
    fbRegular.innerHTML = explanationWrong;
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
}


function s16Submit() {
  if (s16Selected === null || s16Submitted) return;
  s16Submitted = true;

  var correct = (s16Selected === S16_CORRECT);
  var opts = document.querySelectorAll('[data-screen="16"] .s5-opt');
  opts[s16Selected].classList.remove('is-selected');
  opts[s16Selected].classList.add(correct ? 'is-correct' : 'is-incorrect');
  opts.forEach(function (opt) { opt.disabled = true; });

  var s16FbBoldText = correct ? 'נכון!' : 'זו טעות, אבל חשוב שניסית!';
  document.getElementById('s16-fb-bold').textContent = s16FbBoldText;
  document.getElementById('s16-fb-regular').innerHTML = 'קנה מידה נקרא משמאל לימין:​ המספר השמאלי מייצג את הגודל בסרטוט, והמספר הימני מייצג את הגודל המתאים במציאות. ​';
  announce(s16FbBoldText);

  var feedback = document.getElementById('s16-inline-feedback');
  feedback.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
  feedback.hidden = false;

  /* xAPI: item 004 / q1 — the true/false warm-up. Single attempt. */
  try {
    sendStatement720('answered.last', 'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(opts[s16Selected])] } },
      xapiQ('004', 'q1'));
  } catch (e) { console.error('[xAPI] answered 004/q1', e); }

  var contBtn = document.getElementById('s16-continue');
  if (contBtn) {
    contBtn.textContent = 'שנמשיך?';
    contBtn.disabled = false;
    contBtn.onclick = function() { goTo(17); };
  }
}

function s16CheckBothDone() {
  if (!s16Submitted) return;
  var contBtn = document.getElementById('s16-continue');
  if (contBtn) contBtn.disabled = false;
}

function s16Q2Toggle(rowIdx) {
  if (s16Q2Submitted) return;
  var dd = document.querySelector('[data-screen="16"] .s5-dropdown[data-row="' + rowIdx + '"]');
  var isOpen = dd.classList.contains('is-open');
  document.querySelectorAll('[data-screen="16"] .s5-dropdown').forEach(function (d) {
    d.classList.remove('is-open');
    document.getElementById('s16-dd-panel-' + d.dataset.row).hidden = true;
  });
  if (!isOpen) {
    dd.classList.add('is-open');
    document.getElementById('s16-dd-panel-' + rowIdx).hidden = false;
  }
}

function s16Q2Select(rowIdx, value) {
  s16Q2Selections[rowIdx] = value;
  document.getElementById('s16-dd-val-' + rowIdx).textContent = value;
  var dd = document.querySelector('[data-screen="16"] .s5-dropdown[data-row="' + rowIdx + '"]');
  dd.classList.remove('is-open');
  document.getElementById('s16-dd-panel-' + rowIdx).hidden = true;
  s16CheckBothDone();
}

function s16Q2Submit() {
  if (s16Q2Submitted) return;
  s16Q2Submitted = true;

  var allCorrect = true;
  s16Q2Selections.forEach(function (val, i) {
    var dd = document.querySelector('[data-screen="16"] .s5-dropdown[data-row="' + i + '"]');
    var correct = (val === S16_Q2_CORRECT[i]);
    if (!correct) allCorrect = false;
    dd.classList.add(correct ? 'is-correct' : 'is-incorrect');
    var valEl = document.getElementById('s16-dd-val-' + i);
    if (valEl) valEl.textContent = S16_Q2_CORRECT[i];
    var iconEl = document.getElementById('s16-dd-icon-' + i);
    if (iconEl) {
      iconEl.innerHTML = correct
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#609E12"/><path d="M4.5 8.25L6.75 10.5L11.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#B20010"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  });

  document.getElementById('s16-q2-fb-bold').textContent = allCorrect ? 'נכון!' : 'זו טעות, אבל חשוב שניסיתם!';
  document.getElementById('s16-q2-fb-regular').innerHTML = 'קנה מידה נקרא משמאל לימין:​ המספר השמאלי מייצג את הגודל בסרטוט, והמספר הימני מייצג את הגודל המתאים במציאות. ​';

  var feedback = document.getElementById('s16-q2-inline-feedback');
  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect');
  feedback.classList.add(allCorrect ? 's5-fb--correct' : 's5-fb--incorrect');
  feedback.hidden = false;

  s16CheckBothDone();
}

function s16Q2Continue() {
  if (!s16Q2Submitted) s16Q2Submit();
  goTo(17);
}

/* ── Screen 7: Guided Practice ── */
function s7Enter() {
  var charImg = document.getElementById('s7-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
    charImg.alt = 'דמות מלווה';
  }

  var cont = document.getElementById('s7-continue');
  if (cont) cont.disabled = true;
  if (s7Timer) { clearTimeout(s7Timer); s7Timer = null; }
  s7Timer = setTimeout(function () {
    if (currentScreen === 7 && cont) cont.disabled = false;
    s7Timer = null;
  }, 3000);
}

/* ── Screen 8: Guided Practice step 2 ── */
function s8Enter() {
  var cont = document.getElementById('s8-continue');
  if (cont) cont.disabled = true;

  document.querySelectorAll('#s8 .s8-btn').forEach(function (b) { b.disabled = false; });

  var mark = document.getElementById('s8-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s8Answer(answer) {
  document.querySelectorAll('#s8 .s8-btn').forEach(function (b) { b.disabled = true; });

  var mark = document.getElementById('s8-correct-mark');
  if (mark) {
    requestAnimationFrame(function () { mark.classList.add('s8-mark-visible'); });
  }
  announce('התשובה הנכונה סומנה');

  var cont = document.getElementById('s8-continue');
  if (cont) cont.disabled = false;
}

/* ── Screen 9: Guided Practice step 3 ── */
function s9Enter() {
  var cont = document.getElementById('s9-continue');
  if (cont) cont.disabled = true;

  document.querySelectorAll('#s9 .s8-btn').forEach(function (b) { b.disabled = false; });

  var mark = document.getElementById('s9-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s9Answer(answer) {
  document.querySelectorAll('#s9 .s8-btn').forEach(function (b) { b.disabled = true; });

  var mark = document.getElementById('s9-correct-mark');
  if (mark) {
    requestAnimationFrame(function () { mark.classList.add('s8-mark-visible'); });
  }
  announce('התשובה הנכונה סומנה');

  var cont = document.getElementById('s9-continue');
  if (cont) cont.disabled = false;
}

/* ── Screen 10: Guided Practice step 4 ── */
function s10Enter() {
  var cont = document.getElementById('s10-continue');
  if (cont) cont.disabled = true;

  var btn1000 = document.getElementById('s10-btn-1000');
  var btn100  = document.getElementById('s10-btn-100');
  if (btn1000) btn1000.disabled = false;
  if (btn100)  btn100.disabled  = false;

  var mark = document.getElementById('s10-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s10Answer(answer) {
  var btn1000 = document.getElementById('s10-btn-1000');
  var btn100  = document.getElementById('s10-btn-100');
  if (btn1000) btn1000.disabled = true;
  announce('התשובה הנכונה סומנה');
  if (btn100)  btn100.disabled  = true;

  var mark = document.getElementById('s10-correct-mark');
  if (mark) {
    requestAnimationFrame(function () { mark.classList.add('s8-mark-visible'); });
  }

  var cont = document.getElementById('s10-continue');
  if (cont) cont.disabled = false;
}

/* ── Screen 12: duplicate of screen 7 ── */
function s12Enter() {
  var charImg = document.getElementById('s12-char-img');
  if (charImg) {
    charImg.src = window.lomdaState.selectedCharacter === 'text'
      ? './assets/images/Character1.png'
      : './assets/images/Character2.png';
    charImg.alt = 'דמות מלווה';
  }
}

/* ── Screen 14: answer reveal, no buttons ── */
function s14Enter() {
  /* continue always enabled */
}

/* ── Screen 13: duplicate of screen 10 ── */
function s13Enter() {
  var cont = document.getElementById('s13-continue');
  if (cont) cont.disabled = true;

  var btnDiv  = document.getElementById('s13-btn-divide');
  var btnMult = document.getElementById('s13-btn-multiply');
  if (btnDiv)  btnDiv.disabled  = false;
  if (btnMult) btnMult.disabled = false;

  var mark = document.getElementById('s13-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s13Answer(answer) {
  var btnDiv  = document.getElementById('s13-btn-divide');
  var btnMult = document.getElementById('s13-btn-multiply');
  if (btnDiv)  btnDiv.disabled  = true;
  announce('התשובה הנכונה סומנה');
  if (btnMult) btnMult.disabled = true;

  var mark = document.getElementById('s13-correct-mark');
  if (mark) {
    requestAnimationFrame(function () { mark.classList.add('s8-mark-visible'); });
  }

  var cont = document.getElementById('s13-continue');
  if (cont) cont.disabled = false;
}

/* ── Screen 11: Guided Practice — answer reveal (no buttons) ── */
function s11Enter() {
  /* continue is always enabled — no interaction required */
}

/* ── Screen 23 ── */
var s23Selected = null;
var s23Attempts = 0;
var s23Solved = false;
var s23Correct = false;
var S23_CORRECT = 2;

function s23UpdateNav() {
  var nav = document.querySelector('#s23 .s18-nav');
  if (!nav) return;
  var items = nav.querySelectorAll('.s18-nav-item');
  var lines = nav.querySelectorAll('.s18-nav-line');

  // Q2 is compound (screens 19+20): dots 2+3 show combined result
  var q2a = s18QuizResults[2], q2b = s18QuizResults[3];
  var q2Combined = (q2a !== null && q2b !== null)
    ? ((q2a === 'correct' && q2b === 'correct') ? 'correct' : 'wrong')
    : null;

  items.forEach(function(item, i) {
    var icon  = item.querySelector('.s18-nav-icon');
    var label = item.querySelector('.s18-nav-label');
    icon.className = 's18-nav-icon';
    item.onclick = null;
    item.style.cursor = '';
    if (i === 4) {
      icon.classList.add('s18-nav-icon--active');
      label.className = 's18-nav-label s18-nav-label--on';
    } else {
      var result = (i === 1 || i === 2) ? q2Combined : s18QuizResults[i + 1];
      // dot 3 (i=2, Q2b) navigates back to screen 19 (Q2a = סעיף א)
      var navDest = (i === 2) ? 19 : s18QScreens[i];
      if (result === 'correct') {
        icon.classList.add('s18-nav-icon--done');
        label.className = 's18-nav-label s18-nav-label--on';
        item.style.cursor = 'pointer';
        (function(sc) { item.onclick = function() { goTo(sc); }; })(navDest);
      } else if (result === 'wrong') {
        icon.classList.add('s18-nav-icon--wrong');
        label.className = 's18-nav-label s18-nav-label--on';
        item.style.cursor = 'pointer';
        (function(sc) { item.onclick = function() { goTo(sc); }; })(navDest);
      } else {
        icon.classList.add('s18-nav-icon--off');
        label.className = 's18-nav-label s18-nav-label--off';
      }
    }
  });
  lines.forEach(function(line, i) {
    var result = (i === 1 || i === 2) ? q2Combined : s18QuizResults[i + 1];
    if (result === 'correct' || result === 'wrong') {
      line.classList.add('s18-nav-line--done');
    } else {
      line.classList.remove('s18-nav-line--done');
    }
  });
}

function s23Enter() {
  s23Selected = null;
  s23Attempts = 0;
  s23Solved = false;
  s23Correct = false;
  s18UpdateNav(5, 's23');
  document.querySelectorAll('[data-screen="23"] .s5-opt').forEach(function(opt) {
    opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    opt.disabled = false;
  });
  var continueBtn = document.getElementById('s23-continue');
  if (continueBtn) continueBtn.disabled = true;
  var hintBtn = document.getElementById('s23-hint-btn');
  if (hintBtn) hintBtn.hidden = true;
  var hintPopup = document.getElementById('s23-hint-popup');
  if (hintPopup) hintPopup.hidden = true;
  var feedback = document.getElementById('s23-feedback');
  if (feedback) {
    feedback.hidden = true;
    feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect', 's23-fb--final');
  }
}

function s23Select(idx) {
  if (s23Solved) return;
  if (s23Selected === idx) return;
  s23Selected = idx;
  document.querySelectorAll('[data-screen="23"] .s5-opt').forEach(function(opt, i) {
    opt.classList.toggle('is-selected', i === idx);
  });
  var continueBtn = document.getElementById('s23-continue');
  if (continueBtn) continueBtn.disabled = false;
}

function s23ToggleHint() {
  var popup = document.getElementById('s23-hint-popup');
  if (popup) {
    popup.hidden = false;
    announce('רמז נפתח');
    try { sendStatement720('requested.1', 'question', null, xapiQ('009', 'q1')); } catch (e) {}
  }
}

function s23CloseHint() {
  var popup = document.getElementById('s23-hint-popup');
  if (popup) popup.hidden = true;
}

function s23Submit() {
  if (s23Solved) { routeAfterQuiz(); return; }
  if (s23Selected === null) return;

  var correct = (s23Selected === S23_CORRECT);
  s23Attempts++;

  /* xAPI: item 009 / q1 (quiz exercise 5, the last one before routing). */
  try {
    sendStatement720(correct ? 'answered.last' : (s23Attempts >= 2 ? 'answered.last' : 'answered'),
      'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [xapiAnswerText(document.querySelectorAll('[data-screen="23"] .s5-opt')[s23Selected])] } },
      xapiQ('009', 'q1'));
  } catch (e) { console.error('[xAPI] answered 009/q1', e); }

  var feedback    = document.getElementById('s23-feedback');
  var fbBold      = document.getElementById('s23-fb-bold');
  var fbRegular   = document.getElementById('s23-fb-regular');
  var continueBtn = document.getElementById('s23-continue');

  var explanation = 'קנה מידה מייצג את היחס בין האורך במפה לאורך המתאים במציאות. ​<br>' +
                    'המסלול במציאות זהה. אם קנה המידה היה זהה, גם אורך המסלול בשתי המפות היה צריך להיות זהה. לכן נסיק שקני המידה שונים.  ​';

  feedback.classList.remove('s5-fb--correct', 's5-fb--incorrect', 's23-fb--final');
  var opts = document.querySelectorAll('[data-screen="23"] .s5-opt');

  if (correct) {
    s23Solved = true;
    s23Correct = true;
    s18QuizResults[6] = 'correct';
    opts[s23Selected].classList.remove('is-selected');
    opts[s23Selected].classList.add('is-correct');
    opts.forEach(function(o) { o.disabled = true; });
    fbBold.textContent = 'טוב מאוד!';
    fbRegular.innerHTML = explanation;
    feedback.classList.add('s5-fb--correct', 's23-fb--final');
    feedback.hidden = false;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('טוב מאוד!');
  } else if (s23Attempts === 1) {
    opts[s23Selected].classList.remove('is-selected');
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    document.getElementById('s23-hint-btn').hidden = false;
    s23Selected = null;
    continueBtn.disabled = true;
    announce('זה לא מדוייק, ננסה שוב?');
  } else {
    s23Solved = true;
    s18QuizResults[6] = 'wrong';
    opts.forEach(function(o, i) {
      o.disabled = true;
      o.classList.remove('is-selected');
      if (i === S23_CORRECT) o.classList.add('is-correct');
      else if (i === s23Selected) o.classList.add('is-incorrect');
    });
    fbBold.textContent = 'זו טעות, לא נורא – בואו נלמד ממנה:​';
    fbRegular.innerHTML = explanation;
    feedback.classList.add('s5-fb--incorrect', 's23-fb--final');
    feedback.hidden = false;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('זו טעות, לא נורא – בואו נלמד ממנה');
  }
}


/* ── Quiz score + routing ── */
// חידון — 5 תרגילים, סף מעבר לתרגול כיתה: 4/5
// תרגיל 1: מסך 18       (שאלה 1)
// תרגיל 2: מסך 19 + 20  (שאלה 2 — א+ב, שניהם יחד)
// תרגיל 3: מסך 21       (שאלה 3)
// תרגיל 4: מסך 22       (שאלה 4)
// תרגיל 5: מסך 23       (שאלה 5)
function getQuizScore() {
  var count = 0;
  if (s18Correct)                count++; // שאלה 1
  if (s19Correct && s20Correct)  count++; // שאלה 2 (א+ב יחד)
  if (s21Correct)                count++; // שאלה 3
  if (s22Correct)                count++; // שאלה 4
  if (s23Correct)                count++; // שאלה 5
  return count;
}

// ≥4 נכון → תרגול כיתה (03) | <4 → תרגול בסיסי (02)
function routeAfterQuiz() {
  /* xAPI: close the open content item, then report the component result. The denominator is the
     5 quiz exercises the learner was told about ("4 מתוך 5"), not the number of metadata
     questions — s19+s20 together are one exercise. Supplying the result explicitly overrides the
     library's all-correct aggregation, which would report success:false at 4/5. */
  try { xapiFinishItems(); } catch (e) {}
  try {
    var _n = getQuizScore();
    sendStatement720('completed', 'onlinelesson',
      { success: _n >= 4, score: { scaled: _n / 5 } });
  } catch (e) { console.error('[xAPI] completed component 01', e); }
  /* Carry ?slxapi (and ?registration) into the next component — without this the LRS
     configuration is lost and every later part reports nothing. */
  var _q = window.location.search;
  if (getQuizScore() >= 4) {
    window.location.href = '../methodica-math-scale-01-03/index.html' + _q;
  } else {
    window.location.href = '../methodica-math-scale-01-02/index.html' + _q;
  }
}

/* ── Basic practice score + routing ── */
// תרגול בסיסי — 4 תרגילים, סף מעבר לתרגול כיתה: 3/4
// תרגיל 1: מסך 26       (שאלה 1)
// תרגיל 2: מסך 27       (שאלה 2)
// תרגיל 3: מסך 28       (שאלה 3)
// תרגיל 4: מסך 29 + 30  (שאלה 4 — א+ב, שניהם יחד)
function getBasicPracticeScore() {
  var count = 0;
  if (s26Correct)                count++; // שאלה 1
  if (s27Correct)                count++; // שאלה 2
  if (s28Correct)                count++; // שאלה 3
  if (s29Correct && s30Correct)  count++; // שאלה 4 (א+ב יחד)
  return count;
}

// â‰¥3 נכון â†' תרגול כיתה (מסך 24) | <3 â†' תרגול סטנדרטי מתקדם (מסך 31)
function routeAfterBasicPractice() {
  goTo(getBasicPracticeScore() >= 3 ? 24 : 31);
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

/* forward Ctrl+← / Ctrl+→ from iframe to parent dev tool */
document.addEventListener('keydown', function (e) {
  if (window.parent !== window && e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    window.parent.postMessage({ type: 'DEV_KEY', key: e.key }, '*');
  }
});


/* ── Keyboard accessibility ── */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-screen="0"] .option-card').forEach(card => {
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectOption(card);
      }
    });
  });
  document.querySelectorAll('[data-screen="2"] .option-card').forEach(card => {
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectDesign(card);
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
   Read by xapiOnScreen (element 0) and by submitReport (both elements).
   Screens 3 and 4 are the two learning paths — cards vs video — over the SAME item 002.
   Screens 5 and 13 do not exist in this component. */
var SCREEN_TO_SUBCONTENT = {
  0: null,            // avatar choice
  1: ['001', 1],      // hook: drone-vs-reality widget (no question in the catalog)
  2: null,            // how-to-learn choice -> reported as 'selected'
  3: ['002', 1],      // concept via flip cards + q1/q2
  4: ['002', 1],      // concept via video + q1/q2 (same item, other path)
  6: null,            // transition
  7:  ['003', 1], 8:  ['003', 2], 9:  ['003', 3], 10: ['003', 4],
  11: ['003', 5], 12: ['003', 6], 14: ['003', 7],   // guided worked example (not graded)
  15: null,           // transition
  16: ['004', 1],     // warm-up true/false
  17: null,           // transition
  18: ['005', 1],     // quiz 1
  19: ['006', 1], 20: ['006', 2],                   // quiz 2 (א + ב)
  21: ['007', 1],     // quiz 3
  22: ['008', 1],     // quiz 4
  23: ['009', 1]      // quiz 5
};

var XAPI_COMP_SLUG = 'methodica-math-scale-01-01';
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

/* Items that carry a graded question IN CODE. 001 is the hook and 003 the Socratic worked
   example — both are walked through, neither is answered, so they are absent here. */
var XAPI_EVAL_ITEMS = { '002': 1, '004': 1, '005': 1, '006': 1, '007': 1, '008': 1, '009': 1 };
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
/* HTML5 <video> played/paused. This component's media is YouTube, handled in
   s4OnPlayerStateChange instead; kept for symmetry and any <video> added later. */
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

      /* אם עדיין לא שולף — שלוף עכשיו */
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

  /* איפוס כשעוברים עמוד */
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

   SHIPPED GATED OFF (RESUME_ENABLED = false at the top of this file), so none of this runs
   today: _resumeReady stays false, which also neutralises the beforeunload flush.
   Before enabling:
     - flip RESUME_ENABLED to true (that also loads xapi-720-j.js, which carries the State
       transport that -i lacks),
     - verify restore on every screen of every component, and
     - re-check that applyExecutionState() suppresses statements while replaying (it does —
       see the sendStatement720 stub below), or resuming will re-report answers.
   Restore leans on this component's own design: resetScreenState(n) calls each sNNEnter()/
   sqRestoreUI(), which already rebuild their screen from the state variables. So restoring the
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

function captureExecutionState() {
  return {
    v: 1,
    part: currentPartSlug(),
    currentScreen: currentScreen,
    lomdaState: { selectedCharacter: window.lomdaState.selectedCharacter,
                  selectedDesign:    window.lomdaState.selectedDesign },
    frc:  { revealed: frcRevealed.slice(), done: frcDone },
    s4:   { videoEnded: s4VideoEnded },
    sq:   { screen: (typeof sqScreen !== 'undefined' ? sqScreen : null),
            selected: sqSelected, submitted: sqSubmitted,
            q2: sqQ2Selections.slice(), q2Submitted: sqQ2Submitted },
    s16:  { selected: s16Selected, submitted: s16Submitted },
    quiz: {
      results: (typeof s18QuizResults !== 'undefined') ? s18QuizResults.slice() : null,
      s18: { a: s18Attempts, solved: s18Solved, correct: s18Correct },
      s19: { a: s19Attempts, solved: s19Solved, correct: s19Correct },
      s20: { a: s20Attempts, solved: s20Solved, correct: s20Correct, sel: s20Selected },
      s21: { a: s21Attempts, solved: s21Solved, correct: s21Correct },
      s22: { a: s22Attempts, solved: s22Solved, correct: s22Correct, sel: s22Selected },
      s23: { a: s23Attempts, solved: s23Solved, correct: s23Correct, sel: s23Selected }
    }
  };
}

function applyExecutionState(state) {
  if (!state) return;
  _restoring = true;
  /* Replaying answers must not re-report them. */
  var _origSend = window.sendStatement720;
  window.sendStatement720 = function () {};
  try {
    if (state.lomdaState) {
      window.lomdaState.selectedCharacter = state.lomdaState.selectedCharacter;
      window.lomdaState.selectedDesign    = state.lomdaState.selectedDesign;
    }
    if (state.frc) { frcRevealed = state.frc.revealed || frcRevealed; frcDone = !!state.frc.done; }
    if (state.s4)  { s4VideoEnded = !!state.s4.videoEnded; }
    if (state.sq) {
      if (state.sq.screen != null) sqScreen = state.sq.screen;
      sqSelected     = state.sq.selected;
      sqSubmitted    = !!state.sq.submitted;
      sqQ2Selections = state.sq.q2 || sqQ2Selections;
      sqQ2Submitted  = !!state.sq.q2Submitted;
    }
    if (state.s16) { s16Selected = state.s16.selected; s16Submitted = !!state.s16.submitted; }
    var q = state.quiz || {};
    if (q.results) s18QuizResults = q.results;
    if (q.s18) { s18Attempts = q.s18.a; s18Solved = q.s18.solved; s18Correct = q.s18.correct; }
    if (q.s19) { s19Attempts = q.s19.a; s19Solved = q.s19.solved; s19Correct = q.s19.correct; }
    if (q.s20) { s20Attempts = q.s20.a; s20Solved = q.s20.solved; s20Correct = q.s20.correct; s20Selected = q.s20.sel; }
    if (q.s21) { s21Attempts = q.s21.a; s21Solved = q.s21.solved; s21Correct = q.s21.correct; }
    if (q.s22) { s22Attempts = q.s22.a; s22Solved = q.s22.solved; s22Correct = q.s22.correct; s22Selected = q.s22.sel; }
    if (q.s23) { s23Attempts = q.s23.a; s23Solved = q.s23.solved; s23Correct = q.s23.correct; s23Selected = q.s23.sel; }
  } finally {
    window.sendStatement720 = _origSend;
    _restoring = false;
  }
  goTo((typeof state.currentScreen === 'number') ? state.currentScreen : 0);
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
  var METADATA_FILE = '../metadata/methodica-math-scale-01-01.json';

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
            /* This is the entry component, so it also opens the unit. */
            loadUnitMetadata('../metadata/methodica-math-scale-01_unit.json', function () {
              try { sendStatement720('initialized', 'onlinelesson', null, { scope: 'unit' }); } catch (e) {}
            });
          } catch (e) { console.error('[xAPI] init', e); }
        });
      } catch (e) { console.error('[xAPI] load', e); }
    });
  });
})();
