'use strict';



var TOTAL_SCREENS = 24;
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

let frcRevealed = [false, false, false];
let frcDone = false;

let s4VideoEnded = false;
/* Set on the first real pause, so a 'played' only reports after one - see s4OnPlayerStateChange. */
let s4PausedOnce = false;
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

/* Watchdog: if the YouTube iframe API script itself never loads (blocked by an ad-blocker,
   corporate network, or a flaky connection), window.onYouTubeIframeAPIReady never fires and
   s4PlayerReady silently stays false forever. Surface that instead of leaving a blank player. */
setTimeout(function () {
  if (s4PlayerReady) return;
  var errMsg = document.getElementById('s4-player-error');
  if (errMsg) {
    errMsg.textContent = 'לא ניתן לטעון את נגן הסרטון. בדקו את החיבור לאינטרנט ורעננו את הדף.';
    errMsg.style.display = 'block';
  }
}, 8000);

function s4OnPlayerError(e) {
  s4PlayerReady = false;
  console.warn('YouTube player error', e && e.data);
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
      /* Both statements carry the question object. Screen 4 is the video path through item
         002 (see SCREEN_TO_SUBCONTENT), and xapiWireVideos anchors video statements the
         same way. Without it these went out as objectType 'question' with no objectId and
         no questionId - nothing to hang off. That was fixed inside xapiWireVideos and never
         applied here, because YouTube drives this screen and never touches that helper.
         s4PausedOnce is the same noise filter xapiWireVideos uses: YouTube emits
         BUFFERING -> PLAYING on every seek and on autoplay recovery, so without it a single
         viewing reports 'played' several times. The flag is CLEARED on each reported 'played',
         making the pair strictly alternating - slightly stricter than xapiWireVideos, whose
         latch is one-way and therefore still reports a 'played' per seek once the learner has
         paused at least once. Worth aligning that helper the next time it is touched; it is
         dormant today (no element in this unit carries data-xapi-report). */
      if (e.data === YT.PlayerState.PAUSED) {
        s4PausedOnce = true;
        sendStatement720('paused', 'question', null,
          Object.assign({ time: _t }, xapiQ('002', 'q1')));
      } else if (e.data === YT.PlayerState.PLAYING && s4PausedOnce) {
        s4PausedOnce = false;
        sendStatement720('played', 'question', null,
          Object.assign({ time: _t }, xapiQ('002', 'q1')));
      }
    }
  } catch (err) {}
  if (e.data === YT.PlayerState.ENDED) {
    s4VideoEnded = true;
    var sqSection = document.getElementById('s4-sq-section');
    if (sqSection) {
      sqSection.classList.remove('sq-locked');
      sqEnter(4);
    }
  }
}

let s8Timer = null;

/* â”€â”€ Custom floating scrollbar for s1/s3/s4 (mirrors native scroll of .hook-card-inner) â”€â”€ */
const HOOK_SCROLLBAR_SCREENS = ['1', '3', '4'];

function syncHookScrollbar(screenNum) {
  const inner = document.querySelector('[data-screen="' + screenNum + '"] .hook-card-inner');
  const track = document.getElementById('s' + screenNum + '-hook-scrollbar');
  if (!inner || !track) return;
  const thumb = track.querySelector('.hook-scrollbar-thumb');
  const trackH = track.clientHeight;
  const maxScroll = inner.scrollHeight - inner.clientHeight;
  if (maxScroll <= 0) {
    track.style.display = 'none';
    return;
  }
  track.style.display = 'block';
  const ratio = inner.clientHeight / inner.scrollHeight;
  const thumbH = Math.max(40, Math.min(trackH, trackH * ratio));
  const thumbTop = (inner.scrollTop / maxScroll) * (trackH - thumbH);
  thumb.style.height = thumbH + 'px';
  thumb.style.transform = 'translateY(' + thumbTop + 'px)';
}

function syncAllHookScrollbars() {
  HOOK_SCROLLBAR_SCREENS.forEach(syncHookScrollbar);
}

function restartScrollHint(screenNum) {
  const hint = document.getElementById('s' + screenNum + '-scroll-hint');
  if (!hint) return;
  hint.classList.remove('is-hidden');
  const cursorEl = hint.querySelector('.scroll-hint-cursor');
  if (cursorEl) {
    cursorEl.style.animation = 'none';
    void cursorEl.offsetHeight;
    cursorEl.style.animation = '';
  }
}

(function setupHookScrollbarDrag() {
  HOOK_SCROLLBAR_SCREENS.forEach(function (screenNum) {
    const track = document.getElementById('s' + screenNum + '-hook-scrollbar');
    if (!track) return;
    const thumb = track.querySelector('.hook-scrollbar-thumb');
    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    thumb.style.touchAction = 'none'; /* iPad: let pointerdown/move drive the drag instead of the page scrolling */
    thumb.addEventListener('pointerdown', function (e) {
      const inner = document.querySelector('[data-screen="' + screenNum + '"] .hook-card-inner');
      if (!inner) return;
      dragging = true;
      startY = e.clientY;
      startScroll = inner.scrollTop;
      document.body.style.userSelect = 'none';
      try { thumb.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });

    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const inner = document.querySelector('[data-screen="' + screenNum + '"] .hook-card-inner');
      if (!inner) return;
      const trackH = track.clientHeight;
      const thumbH = thumb.offsetHeight;
      const maxScroll = inner.scrollHeight - inner.clientHeight;
      if (maxScroll <= 0 || trackH === thumbH) return;
      const scrollDelta = (e.clientY - startY) * (maxScroll / (trackH - thumbH));
      inner.scrollTop = startScroll + scrollDelta;
    });

    window.addEventListener('pointerup', function () {
      dragging = false;
      document.body.style.userSelect = '';
    });
    window.addEventListener('pointercancel', function () {
      dragging = false;
      document.body.style.userSelect = '';
    });
  });

  window.addEventListener('resize', syncAllHookScrollbars);
})();

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

    const inner = document.querySelector('[data-screen="1"] .hook-card-inner');
    inner.scrollTop = 0;

    restartScrollHint(1);

    const widget1 = document.getElementById('s1-char-widget-1');
    const widget2 = document.getElementById('s1-char-widget-2');
    widget1.classList.remove('hidden');
    widget2.classList.add('s1-char-hidden');

    const s1Btn = document.getElementById('s1-continue');
    s1Btn.disabled = true;

    syncHookScrollbar(1);

    inner.onscroll = null;
    inner.addEventListener('scroll', function onScroll() {
      const scrollHint = document.getElementById('s1-scroll-hint');
      if (scrollHint) scrollHint.classList.add('is-hidden');
      syncHookScrollbar(1);

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

    const clickHint = document.getElementById('s2-click-hint');
    if (clickHint) {
      clickHint.classList.remove('is-hidden');
      clickHint.querySelectorAll('.click-hint-ring, .click-hint-cursor').forEach(function (el) {
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = '';
      });
    }
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
  /* setUnitCharacter writes all three: window.lomdaState, the localStorage cache and the Kata
     document. It is chosen on this screen, read again in part 05, and therefore unit-level
     state — it cannot live in parts[], which captureUnitState replaces on every save.
     If the document has not been read yet the choice is queued and drained in loader phase B. */
  if (typeof setUnitCharacter === 'function') {
    setUnitCharacter(cardEl.dataset.value);
  } else {
    window.lomdaState.selectedCharacter = cardEl.dataset.value;
    localStorage.setItem('lomdaCharacter', cardEl.dataset.value);
  }
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

  const clickHint = document.getElementById('s2-click-hint');
  if (clickHint) clickHint.classList.add('is-hidden');
}

function advanceFromS2() {
  if (!window.lomdaState.selectedDesign) return;
  /* xAPI: the learner picked how to learn the concept — video (screen 4) or flip cards (screen 3).
     Reported as 'selected' under the learning-type category, not as a graded answer.
     (The screen-0 avatar choice stays unreported: it is decoration, not a learning preference.) */
  try {
    var _card = document.querySelector('[data-screen="2"] .option-card.selected');
    var _pick = String(window.lomdaState.selectedDesign);
    var _res  = { response: xapiAnswerText(_card) || _pick };
    /* Once per distinct choice, through the same ledger as 'completed' and the hints.
       Until screen 2 had a painter, every resume onto it forced the learner to re-pick and
       emitted a second 'selected'. Keying on the chosen value rather than on the screen is
       deliberate: re-picking the SAME option stays silent, while a learner who genuinely
       changes their mind still reports it. Fails open like every other ledger call. */
    if (typeof sendStatementOnce === 'function') {
      sendStatementOnce('picks', 'learning-type/' + _pick, 'selected', 'onlinelesson', _res,
        { category: 'learning-type' });
    } else {
      sendStatement720('selected', 'onlinelesson', _res, { category: 'learning-type' });
    }
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
    s3body.scrollTop = 0;
    restartScrollHint(3);
    syncHookScrollbar(3);
    s3body.onscroll = function() {
      var infoSec = document.querySelector('[data-screen="3"] .s5-info-section');
      if (!infoSec) return;
      var infoVisible = infoSec.offsetTop < s3body.scrollTop + s3body.clientHeight - 40;
      charWidget3.classList.toggle('hidden', !infoVisible);

      var scrollHint3 = document.getElementById('s3-scroll-hint');
      if (scrollHint3) scrollHint3.classList.add('is-hidden');
      syncHookScrollbar(3);
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

  updateScaleTrackFill();
}

function updateScaleTrackFill() {
  var fill = document.getElementById('scale-track-fill');
  var wrap = document.querySelector('.scale-track-wrap');
  var checkedMarker = document.querySelector('.scale-input:checked + .scale-marker');
  if (!fill || !wrap || !checkedMarker) return;
  var wrapRect = wrap.getBoundingClientRect();
  var markerRect = checkedMarker.getBoundingClientRect();
  var markerBottom = (markerRect.bottom - wrapRect.top);
  fill.style.height = Math.max(0, markerBottom - 10) + 'px';

  var steps = Array.from(document.querySelectorAll('.scale-step'));
  var checkedStep = checkedMarker.closest('.scale-step');
  var checkedIndex = steps.indexOf(checkedStep);
  steps.forEach(function (step, i) {
    step.classList.toggle('is-passed', i < checkedIndex);
  });
}

/* ── Screen 4: video player ── */
function s4Enter() {
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
    s4body.scrollTop = 0;
    restartScrollHint(4);
    syncHookScrollbar(4);
    s4body.onscroll = function() {
      var infoSec = document.querySelector('[data-screen="4"] .s5-info-section');
      if (!infoSec) return;
      var infoVisible = infoSec.offsetTop < s4body.scrollTop + s4body.clientHeight - 40;
      charWidget.classList.toggle('hidden', infoVisible);
      if (charWidgetRoller) charWidgetRoller.classList.toggle('hidden', !infoVisible);

      var scrollHint4 = document.getElementById('s4-scroll-hint');
      if (scrollHint4) scrollHint4.classList.add('is-hidden');
      syncHookScrollbar(4);
    };
  }
}

function s4Back() {
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
  xapiAnswered('002', 'q1', correct, true,
    xapiAnswerText(opts[sqSelected]));
  sqCheckBothDone();
  flushResumeSave();   // see s16Submit
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
  xapiAnswered('002', 'q2', allCorrect, true,
    _q2Answer);
  sqCheckBothDone();
  flushResumeSave();   // see s16Submit
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
    xapiRequestedHint('004', 'q1');
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
  ruler.style.touchAction = 'none'; /* iPad: let pointerdown/move drive the drag instead of the page scrolling */
  ruler.addEventListener('pointerdown', function(e) {
    s18RulerDragging = true;
    s18RulerStartX = e.clientX;
    s18RulerStartY = e.clientY;
    s18RulerStartLeft = ruler.offsetLeft;
    s18RulerStartTop  = ruler.offsetTop;
    ruler.style.cursor = 'grabbing';
    try { ruler.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  document.addEventListener('pointermove', function(e) {
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
  document.addEventListener('pointerup', function() {
    if (!s18RulerDragging) return;
    s18RulerDragging = false;
    var r = document.getElementById('s18-ruler');
    if (r) r.style.cursor = 'grab';
  });
  document.addEventListener('pointercancel', function() {
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
    xapiRequestedHint('005', 'q1');
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
  xapiAnswered('005', 'q1', correct, correct || s18Attempts >= 2,
    answer);

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
    continueBtn.disabled = true;   /* retry lock: s18CheckInput re-enables it when the answer changes */
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
  flushResumeSave();   // see s16Submit
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
    xapiRequestedHint('006', 'q1');
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
  xapiAnswered('006', 'q1', correct, correct || s19Attempts >= 2,
    answer);

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
    announce('זה לא מדוייק, ננסה שוב?');
    continueBtn.disabled = true;   /* retry lock: s19CheckInput re-enables it when the answer changes */
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
  flushResumeSave();   // see s16Submit
}

/* ── Screen 20 ── */
var s20Selected = null;
var s20Attempts = 0;
var s20Solved = false;
var s20Correct = false;
var S20_CORRECT = 1;

function s20Enter() {
  if (s20Solved) { s18UpdateNav(2, 's20'); return; }
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
    xapiRequestedHint('006', 'q2');
  } }
function s20CloseHint()  { var p = document.getElementById('s20-hint-popup'); if (p) { p.hidden = true; announce('רמז נסגר'); } }

function s20Submit() {
  if (s20Solved) { goTo(21); return; }
  if (s20Selected === null) return;
  var correct = (s20Selected === S20_CORRECT);
  s20Attempts++;
  /* xAPI: item 006 / q2 (quiz exercise 2, part ב). Reported before the wrong-answer branch below
     clears s20Selected, which would otherwise lose the learner's answer text. */
  xapiAnswered('006', 'q2', correct, correct || s20Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="20"] .s5-opt')[s20Selected]));
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
    document.getElementById('s20-hint-btn').hidden = false;
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?'; fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false;
    announce('זה לא מדוייק, ננסה שוב?');
    continueBtn.disabled = true;   /* retry lock: s20Select re-enables it when the answer changes */
  } else {
    s20Solved = true; s18QuizResults[3] = 'wrong';
    opts.forEach(function(o,i){ o.disabled=true; o.classList.toggle('is-correct',i===S20_CORRECT); o.classList.toggle('is-incorrect',i===s20Selected&&i!==S20_CORRECT); });
    fbBold.textContent = 'זו טעות, בואו נדייק​'; fbRegular.innerHTML = explanationWrong;
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false;
    continueBtn.textContent = 'שנמשיך?';
    continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
  flushResumeSave();   // see s16Submit
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
    xapiRequestedHint('007', 'q1');
  } }
function s21CloseHint()  { var p = document.getElementById('s21-hint-popup'); if (p) { p.hidden = true; announce('רמז נסגר'); } }

function s21Submit() {
  if (s21Solved) { goTo(22); return; }
  var input = document.getElementById('s21-answer-input');
  var answer = input ? input.value : '';
  var correct = checkRatio(answer, 1, 25000);
  s21Attempts++;
  xapiAnswered('007', 'q1', correct, correct || s21Attempts >= 2,
    String(answer).trim());
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
    document.getElementById('s21-hint-btn').hidden = false;
    announce('זה לא מדוייק, ננסה שוב?');
    continueBtn.disabled = true;   /* retry lock: s21CheckInput re-enables it when the answer changes */
  } else {
    s21Solved = true; s18QuizResults[4] = 'wrong';
    fbBold.textContent = 'זו טעות, בואו נדייק'; fbRegular.innerHTML = explanation;
    feedback.classList.add('s5-fb--incorrect'); feedback.hidden = false; input.disabled = true; continueBtn.textContent = 'שנמשיך?'; continueBtn.disabled = false;
    announce('זו טעות, בואו נדייק');
  }
  flushResumeSave();   // see s16Submit
}

/* ── Screen 22 ── */
var s22Selected = null;
var s22Attempts = 0;
var s22Solved = false;
var s22Correct = false;
var S22_CORRECT = 1;

function s22Enter() {
  if (s22Solved) { s18UpdateNav(4, 's22'); return; }
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
    xapiRequestedHint('008', 'q1');
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

  xapiAnswered('008', 'q1', correct, correct || s22Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="22"] .s5-opt')[s22Selected]));

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
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    document.getElementById('s22-hint-btn').hidden = false;
    announce('זה לא מדוייק, ננסה שוב?');
    continueBtn.disabled = true;   /* retry lock: s22Select re-enables it when the answer changes */
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
  flushResumeSave();   // see s16Submit
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
  xapiAnswered('004', 'q1', correct, true,
    xapiAnswerText(opts[s16Selected]));

  var contBtn = document.getElementById('s16-continue');
  if (contBtn) {
    contBtn.textContent = 'שנמשיך?';
    contBtn.disabled = false;
    contBtn.onclick = function() { goTo(17); };
  }
  /* Resume: commit the answer synchronously. A debounced save here could still be in flight when
     the learner navigates, and land after the next screen's own write. */
  flushResumeSave();
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
  if (cont) cont.disabled = false;
}

/* ── Screen 8: Guided Practice step 2 ── */
function s8Enter() {
  var cont = document.getElementById('s8-continue');
  if (cont) cont.disabled = true;

  document.querySelectorAll('#s8 .s8-btn').forEach(function (b) { b.disabled = false; b.classList.remove('s8-btn-highlight'); });

  var mark = document.getElementById('s8-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s8Answer(answer, btn) {
  document.querySelectorAll('#s8 .s8-btn').forEach(function (b) { b.disabled = true; });
  if (btn) btn.classList.add('s8-btn-highlight');

  var mark = document.getElementById('s8-correct-mark');
  var correctBtn = mark ? mark.closest('.s8-btn') : null;
  setTimeout(function () {
    if (btn) btn.classList.remove('s8-btn-highlight');
    if (correctBtn) correctBtn.classList.add('s8-btn-highlight');
    if (mark) mark.classList.add('s8-mark-visible');
    announce('התשובה הנכונה סומנה');
  }, 900);

  var cont = document.getElementById('s8-continue');
  if (cont) cont.disabled = false;
}

/* ── Screen 9: Guided Practice step 3 ── */
function s9Enter() {
  var cont = document.getElementById('s9-continue');
  if (cont) cont.disabled = true;

  document.querySelectorAll('#s9 .s8-btn').forEach(function (b) { b.disabled = false; b.classList.remove('s8-btn-highlight'); });

  var mark = document.getElementById('s9-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s9Answer(answer, btn) {
  document.querySelectorAll('#s9 .s8-btn').forEach(function (b) { b.disabled = true; });
  if (btn) btn.classList.add('s8-btn-highlight');

  var mark = document.getElementById('s9-correct-mark');
  var correctBtn = mark ? mark.closest('.s8-btn') : null;
  setTimeout(function () {
    if (btn) btn.classList.remove('s8-btn-highlight');
    if (correctBtn) correctBtn.classList.add('s8-btn-highlight');
    if (mark) mark.classList.add('s8-mark-visible');
    announce('התשובה הנכונה סומנה');
  }, 900);

  var cont = document.getElementById('s9-continue');
  if (cont) cont.disabled = false;
}

/* ── Screen 10: Guided Practice step 4 ── */
function s10Enter() {
  var cont = document.getElementById('s10-continue');
  if (cont) cont.disabled = true;

  var btn1000 = document.getElementById('s10-btn-1000');
  var btn100  = document.getElementById('s10-btn-100');
  if (btn1000) { btn1000.disabled = false; btn1000.classList.remove('s8-btn-highlight'); }
  if (btn100)  { btn100.disabled  = false; btn100.classList.remove('s8-btn-highlight'); }

  var mark = document.getElementById('s10-correct-mark');
  if (mark) mark.classList.remove('s8-mark-visible');
}

function s10Answer(answer, btn) {
  var btn1000 = document.getElementById('s10-btn-1000');
  var btn100  = document.getElementById('s10-btn-100');
  if (btn1000) btn1000.disabled = true;
  if (btn100)  btn100.disabled  = true;
  if (btn) btn.classList.add('s8-btn-highlight');

  var mark = document.getElementById('s10-correct-mark');
  var correctBtn = mark ? mark.closest('.s8-btn') : null;
  setTimeout(function () {
    if (btn) btn.classList.remove('s8-btn-highlight');
    if (correctBtn) correctBtn.classList.add('s8-btn-highlight');
    if (mark) mark.classList.add('s8-mark-visible');
    announce('התשובה הנכונה סומנה');
  }, 900);

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
  if (s23Solved) { s18UpdateNav(5, 's23'); return; }
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
    xapiRequestedHint('009', 'q1');
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
  xapiAnswered('009', 'q1', correct, correct || s23Attempts >= 2,
    xapiAnswerText(document.querySelectorAll('[data-screen="23"] .s5-opt')[s23Selected]));

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
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbRegular.innerHTML = '';
    feedback.classList.add('s5-fb--incorrect');
    feedback.hidden = false;
    document.getElementById('s23-hint-btn').hidden = false;
    announce('זה לא מדוייק, ננסה שוב?');
    continueBtn.disabled = true;   /* retry lock: s23Select re-enables it when the answer changes */
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
  flushResumeSave();   // see s16Submit
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
  var _n = getQuizScore();
  xapiCompleteComponent({ success: _n >= 4, score: { scaled: _n / 5 } });
  /* Carry ?slxapi (and ?registration) into the next component — without this the LRS
     configuration is lost and every later part reports nothing. */
  var _q = window.location.search;
  /* Resume: point the state document at the component being entered — inside each branch, because
     the destination differs. Without it the next launch would come back to this finished quiz. */
  if (getQuizScore() >= 4) {
    writeForwardState('methodica-math-scale-01-03', '#screen=23');
    window.location.href = '../methodica-math-scale-01-03/index.html' + _q;
  } else {
    writeForwardState('methodica-math-scale-01-02', '#screen=23');
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



/* Items that carry a graded question IN CODE. 001 is the hook and 003 the Socratic worked
   example — both are walked through, neither is answered, so they are absent here. */
var XAPI_EVAL_ITEMS = { '002': 1, '004': 1, '005': 1, '006': 1, '007': 1, '008': 1, '009': 1 };


/* Report modal, draggable feedback, a11y wiring and image zoom: ../unit-js/ */


/* ── Per-part boot hook ──
   Called by ../unit-js/90-boot.js, the single place startup side effects run from.
   These used to be a top-level IIFE and DOMContentLoaded handlers. */
function partBoot() {
  var char = window.lomdaState.selectedCharacter === 'video' ? 'Character2' : 'Character1';
  var other = char === 'Character1' ? 'Character2' : 'Character1';
  [char, other].forEach(function(c) {
    ['', '_binoculars', '_roller', '_popcorn', '_cards', '_holdhands', '_workout'].forEach(function(v) {
      var img = new Image(); img.src = './assets/images/' + c + v + '.png';
    });
  });

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
}

/* ═══════════════════════════════════════════════════════════════════
   RESUME — save / restore execution state to KATA (xAPI State API)
   One State document per unit, keyed by window.XAPI_UNIT_ID.

   Enabled by RESUME_ENABLED at the top of this file, which also switches the loader to
   xapi-720-j.js (the State transport -i lacks).











/* ── The 'completed' ledger ──────────────────────────────────────────
   One 'completed' per component, per item, per unit attempt — the back button makes every finished
   screen re-reachable, and the library's dedupe only spans a single page load. `initialized` is
   deliberately NOT guarded: the platform asks for it on every entry.





/* Typed answers live only in the DOM — no variable holds them — so they travel by element id.
   Reading them at capture time is safe: no submit branch clears these inputs, only disables. */
var RESUME_INPUT_IDS = ['s18-answer-input', 's19-answer-input', 's21-answer-input'];

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
  return {
    currentScreen: currentScreen,
    /* Component 01 scores from its own sNNCorrect flags (getQuizScore), not from this map — but
       xapiAnswered writes it at every answered site, so persist it like the other components do.
       Without this a resumed learner has restored answers and an empty map, which is a trap for
       anyone who later switches the score here to xapiCorrectCount(). */
    qResults: Object.assign({}, XAPI_Q_RESULTS),
    /* selectedDesign only. The CHARACTER is unit-level state from v4 on and lives in doc.ui —
       it is chosen here and read again in part 05, and captureUnitState replaces this slot on
       every save, so a copy here would be a second, shorter-lived source of authority for the
       same value. Restored by applyUnitProfile in loader phase A instead.
       selectedDesign genuinely is part-local: nothing outside part 01 reads it. */
    lomdaState: { selectedDesign: window.lomdaState.selectedDesign },
    frc:  { revealed: frcRevealed.slice(), done: frcDone },
    s4:   { videoEnded: s4VideoEnded },
    sq:   { screen: (typeof sqScreen !== 'undefined' ? sqScreen : null),
            selected: sqSelected, submitted: sqSubmitted,
            q2: sqQ2Selections.slice(), q2Submitted: sqQ2Submitted },
    s16:  { selected: s16Selected, submitted: s16Submitted },
    inputs: captureResumeInputs(),
    quiz: {
      /* s18QuizResults is an OBJECT ({1:null,…}), not an array. This used to call .slice() on it,
         which threw on every capture — and both callers swallow the error, so this component
         silently never wrote a single state document. */
      results: Object.assign({}, s18QuizResults),
      s18: { a: s18Attempts, solved: s18Solved, correct: s18Correct },
      s19: { a: s19Attempts, solved: s19Solved, correct: s19Correct },
      s20: { a: s20Attempts, solved: s20Solved, correct: s20Correct, sel: s20Selected },
      s21: { a: s21Attempts, solved: s21Solved, correct: s21Correct },
      s22: { a: s22Attempts, solved: s22Solved, correct: s22Correct, sel: s22Selected },
      s23: { a: s23Attempts, solved: s23Solved, correct: s23Correct, sel: s23Selected }
    }
  };
}

/* Both restore passes run through here, so they can never drift apart. */
function applyResumeVars(state) {
  if (state.qResults) XAPI_Q_RESULTS = Object.assign({}, state.qResults);
  /* selectedCharacter is deliberately NOT restored here — see capturePartPayload. It is
     unit-level state, already applied from doc.ui by applyUnitProfile before this runs, and
     re-assigning it from a part payload would let a stale slot override the newer unit value. */
  if (state.lomdaState) {
    window.lomdaState.selectedDesign = state.lomdaState.selectedDesign;
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
  if (q.results) s18QuizResults = Object.assign({}, q.results);
  if (q.s18) { s18Attempts = q.s18.a; s18Solved = q.s18.solved; s18Correct = q.s18.correct; }
  if (q.s19) { s19Attempts = q.s19.a; s19Solved = q.s19.solved; s19Correct = q.s19.correct; }
  if (q.s20) { s20Attempts = q.s20.a; s20Solved = q.s20.solved; s20Correct = q.s20.correct; s20Selected = q.s20.sel; }
  if (q.s21) { s21Attempts = q.s21.a; s21Solved = q.s21.solved; s21Correct = q.s21.correct; }
  if (q.s22) { s22Attempts = q.s22.a; s22Solved = q.s22.solved; s22Correct = q.s22.correct; s22Selected = q.s22.sel; }
  if (q.s23) { s23Attempts = q.s23.a; s23Solved = q.s23.solved; s23Correct = q.s23.correct; s23Selected = q.s23.sel; }
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
   Question screens only (the agreed first step). Screens 3 and 4 need no painter — frcEnter() and
   s4Enter() call sqRestoreUI(), which genuinely renders from state and is the model these follow.
   Screens 7–14 (the guided worked example) keep no JS state at all, so they land un-answered and
   the learner re-clicks; the same goes for screen 1's scroll gate and screen 7's timer.
   Each painter mirrors the DOM writes of its sNNSubmit branches and NOTHING else — no state
   mutation, no statements, no announce(), and never s18QuizResults. The quiz nav dots need no
   painting: sNNEnter() calls s18UpdateNav()/s23UpdateNav(), which build them from s18QuizResults,
   restored by the second assignment pass. */
/* Screen 2 painter - the "how do you want to learn" choice (video vs flip cards).
   selectedDesign is in the resume payload, but resetScreenState(2) strips '.selected',
   nulls the variable and disables the continue button, so without this painter a resumed
   learner was forced to pick again - and each re-pick emitted another 'selected'
   statement. The second applyResumeVars pass has already put selectedDesign back by the
   time this runs. Mirrors selectDesign's DOM writes ONLY: no state mutation, no statement,
   no announce(). */
function s2RestoreUI() {
  var chosen = window.lomdaState && window.lomdaState.selectedDesign;
  if (!chosen) return;
  var hit = null;
  document.querySelectorAll('[data-screen="2"] .option-card').forEach(function (c) {
    var on = (c.dataset.value === chosen);
    c.classList.toggle('selected', on);
    c.setAttribute('aria-checked', on ? 'true' : 'false');
    if (on) hit = c;
  });
  /* An unrecognised value must not enable the button: advanceFromS2 would then navigate on
     a design this screen cannot express. */
  if (!hit) return;
  var cont = document.getElementById('s2-continue');
  if (cont) cont.disabled = false;
  var clickHint = document.getElementById('s2-click-hint');
  if (clickHint) clickHint.classList.add('is-hidden');
}

function restoreScreenUI(n) {
  try {
    if (n === 2)  s2RestoreUI();
    if (n === 16) s16RestoreUI();
    if (n === 18) s18RestoreUI();
    if (n === 19) s19RestoreUI();
    if (n === 20) s20RestoreUI();
    if (n === 21) s21RestoreUI();
    if (n === 22) s22RestoreUI();
    if (n === 23) s23RestoreUI();
  } catch (e) { console.error('[resume] restoreScreenUI', e); }
}

/* Explanation bodies, copied from the branches they mirror. */
var S16_RESTORE_EXPLANATION = 'קנה מידה נקרא משמאל לימין:​ המספר השמאלי מייצג את הגודל בסרטוט, והמספר הימני מייצג את הגודל המתאים במציאות. ​';
var S18_RESTORE_EXPLANATION = 'לפי קנה המידה הנתון, אורך הנעל במציאות גדול פי 6 מאורך הנעל בתמונה. ​<br>' +
                              'ראינו שאורך הנעל בתמונה הוא 4 ס"מ, נכפול אותו ב-6 ונקבל:​<br>' +
                              ' 24 ס"מ = 6 · 4​<br>' +
                              'מכאן שאורך הנעל במציאות הוא 24 ס"מ.​';
var S19_RESTORE_EXPLANATION = '1.4 מטרים שווים ל-140 ס"מ,​ ולכן היחס בין האורכים הוא 140 : 7 .​<br>' +
                              'נצמצם את היחס ב-7 ​ונקבל שקנה המידה הוא 20 : 1 .​';
var S20_RESTORE_EXPLANATION = 'נמיר את מידות השטיח במציאות לסנטימטרים: 180 ס"מ ו-240 ס"מ. ​<br>' +
                              'מכיוון שקנה המידה הוא 20 : 1 (הקטנה פי 20 של מידות השטיח בתרשים), נחלק כל מידה ב-20 ונקבל שרוחב השטיח בתרשים הוא 9 ס"מ ואורכו 12 ס"מ.​';
var S21_RESTORE_EXPLANATION = '2 ק"מ הם 200,000 ס"מ .<br>' +
                              'מכאן שהיחס בין אורך כל קטע במפה לבין אורך כל קטע במציאות הוא 200,000 : 8 .<br>' +
                              'נצמצם ב-8, ונקבל את קנה המידה: 25,000 : 1';
var S22_RESTORE_EXPLANATION = 'לפי קנה המידה כל ס"מ על המפה מייצג 100,000,000 ס"מ במציאות. ​<br>' +
                              'נתון שהמרחק על המפה הוא 7 ס"מ, ולכן המרחק במציאות הוא 700,000,000 ס"מ, שהם 7,000 ק"מ.​';
var S23_RESTORE_EXPLANATION = 'קנה מידה מייצג את היחס בין האורך במפה לאורך המתאים במציאות. ​<br>' +
                              'המסלול במציאות זהה. אם קנה המידה היה זהה, גם אורך המסלול בשתי המפות היה צריך להיות זהה. לכן נסיק שקני המידה שונים.  ​';

/* Screen 16 — the true/false warm-up. Mirrors s16Submit.
   The onclick rebind is NOT cosmetic: s16Submit has no solved-guard that forwards, and the markup
   calls it directly, so a restored s16Submitted would leave a continue button that does nothing.
   There is no s16Correct variable, so correctness comes from the recorded selection. */
function s16RestoreUI() {
  var fb      = document.getElementById('s16-inline-feedback');
  var fbBold  = document.getElementById('s16-fb-bold');
  var fbReg   = document.getElementById('s16-fb-regular');
  var contBtn = document.getElementById('s16-continue');
  var opts    = Array.prototype.slice.call(document.querySelectorAll('[data-screen="16"] .s5-opt'));
  if (!fb || !fbBold || !fbReg || !contBtn) return;

  if (!s16Submitted) {
    if (s16Selected !== null && s16Selected !== undefined) {
      opts.forEach(function (o, i) { o.classList.toggle('is-selected', i === s16Selected); });
      contBtn.disabled = false;
    }
    return;
  }

  var correct = (s16Selected === S16_CORRECT);
  if (opts[s16Selected]) {
    opts[s16Selected].classList.remove('is-selected');
    opts[s16Selected].classList.add(correct ? 'is-correct' : 'is-incorrect');
  }
  opts.forEach(function (o) { o.disabled = true; });
  fbBold.textContent = correct ? 'נכון!' : 'זו טעות, אבל חשוב שניסית!';
  fbReg.innerHTML    = S16_RESTORE_EXPLANATION;
  fb.classList.add(correct ? 's5-fb--correct' : 's5-fb--incorrect');
  fb.hidden = false;
  contBtn.textContent = 'שנמשיך?';
  contBtn.disabled    = false;
  contBtn.onclick     = function () { goTo(17); };
}

/* Screens 18, 19 and 21 — value inputs. Mirror s18Submit / s19Submit / s21Submit. */
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
    fbReg.innerHTML    = cfg.explanation;
    fb.classList.add(cfg.correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    return;
  }

  if (cfg.attempts >= 1) {
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbReg.innerHTML    = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    /* Retry lock, mirroring the live branch. A wrong non-final attempt leaves the check
       button dead until the answer actually changes; the screen's own input/select handler
       re-enables it. Recomputing from the answer's presence here would hand a resumed
       learner a LIVE button on an UNCHANGED answer - the second identical submission the
       lock exists to prevent, which also silently burns their last attempt. */
    cont.disabled = true;
    return;
  }
  cont.disabled = !(input && input.value.trim().length > 0);   // the live predicate
}

function s18RestoreUI() {
  restoreValueScreenUI({
    prefix: 's18', solved: s18Solved, correct: s18Correct, attempts: s18Attempts,
    boldCorrect: 'יפה מאוד!​', boldWrong: 'זו טעות, בואו נדייק​',
    explanation: S18_RESTORE_EXPLANATION
  });
}

function s19RestoreUI() {
  restoreValueScreenUI({
    prefix: 's19', solved: s19Solved, correct: s19Correct, attempts: s19Attempts,
    boldCorrect: 'יפה מאוד!​', boldWrong: 'זו טעות, בואו נדייק​',
    explanation: S19_RESTORE_EXPLANATION
  });
}

function s21RestoreUI() {
  restoreValueScreenUI({
    prefix: 's21', solved: s21Solved, correct: s21Correct, attempts: s21Attempts,
    boldCorrect: 'יפה מאוד!', boldWrong: 'זו טעות, בואו נדייק',
    explanation: S21_RESTORE_EXPLANATION
  });
}

/* Screen 20 — single choice. Mirrors s20Submit, which keeps is-selected on the picked option in
   both terminal branches (it only toggles is-correct / is-incorrect on top). */
function s20RestoreUI() {
  var fb      = document.getElementById('s20-feedback');
  var fbBold  = document.getElementById('s20-fb-bold');
  var fbReg   = document.getElementById('s20-fb-regular');
  var cont    = document.getElementById('s20-continue');
  var hintBtn = document.getElementById('s20-hint-btn');
  var opts    = Array.prototype.slice.call(document.querySelectorAll('[data-screen="20"] .s5-opt'));
  if (!fb || !fbBold || !fbReg || !cont) return;

  if (s20Solved) {
    opts.forEach(function (o, i) {
      o.disabled = true;
      o.classList.toggle('is-selected', i === s20Selected);
      o.classList.toggle('is-correct', i === S20_CORRECT);
      if (!s20Correct) o.classList.toggle('is-incorrect', i === s20Selected && i !== S20_CORRECT);
    });
    fbBold.textContent = s20Correct ? 'יפה!​' : 'זו טעות, בואו נדייק​';
    fbReg.innerHTML    = S20_RESTORE_EXPLANATION;
    fb.classList.add(s20Correct ? 's5-fb--correct' : 's5-fb--incorrect');
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    return;
  }

  if (s20Selected !== null && s20Selected !== undefined) {
    opts.forEach(function (o, i) { o.classList.toggle('is-selected', i === s20Selected); });
    cont.disabled = false;
  }
  if (s20Attempts >= 1) {
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbReg.innerHTML    = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    /* Retry lock - see the live branch, and restoreValueScreenUI for the reasoning. */
    cont.disabled = true;
  }
}

/* Screens 22 and 23 — single choice, same shape. Mirror s22Submit / s23Submit. */
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
      o.classList.remove('is-selected');
      if (cfg.correct) {
        if (i === cfg.selected) o.classList.add('is-correct');
      } else if (i === cfg.correctIndex) {
        o.classList.add('is-correct');
      } else if (i === cfg.selected) {
        o.classList.add('is-incorrect');
      }
    });
    fbBold.textContent = cfg.correct ? cfg.boldCorrect : cfg.boldWrong;
    fbReg.innerHTML    = cfg.explanation;
    fb.classList.add(cfg.correct ? 's5-fb--correct' : 's5-fb--incorrect');
    if (cfg.finalClass) fb.classList.add(cfg.finalClass);
    fb.hidden        = false;
    cont.textContent = 'שנמשיך?';
    cont.disabled    = false;
    return;
  }

  if (cfg.selected !== null && cfg.selected !== undefined) {
    opts.forEach(function (o, i) { o.classList.toggle('is-selected', i === cfg.selected); });
    cont.disabled = false;
  }
  if (cfg.attempts >= 1) {
    fbBold.textContent = 'זה לא מדוייק, ננסה שוב?';
    fbReg.innerHTML    = '';
    fb.classList.add('s5-fb--incorrect');
    fb.hidden = false;
    if (hintBtn) hintBtn.hidden = false;
    /* Retry lock - see the live branch, and restoreValueScreenUI for the reasoning. */
    cont.disabled = true;
  }
}

function s22RestoreUI() {
  restoreChoiceScreenUI({
    prefix: 's22', screen: 22,
    solved: s22Solved, correct: s22Correct, selected: s22Selected, attempts: s22Attempts,
    correctIndex: S22_CORRECT,
    boldCorrect: 'יפה!​', boldWrong: 'זו טעות, בואו נדייק​',
    explanation: S22_RESTORE_EXPLANATION
  });
}

function s23RestoreUI() {
  restoreChoiceScreenUI({
    prefix: 's23', screen: 23,
    solved: s23Solved, correct: s23Correct, selected: s23Selected, attempts: s23Attempts,
    correctIndex: S23_CORRECT,
    boldCorrect: 'טוב מאוד!', boldWrong: 'זו טעות, לא נורא – בואו נלמד ממנה:​',
    explanation: S23_RESTORE_EXPLANATION,
    finalClass: 's23-fb--final'
  });
}




/* xAPI loader: ../unit-js/50-loader.js. This component supplies its metadata file
   and, where it needs one, an onXapiReady() hook. */
var XAPI_METADATA_FILE = '../metadata/methodica-math-scale-01-01.json';

/* Entry component: this is the launch target every session passes through, so it also
   opens the unit. Runs from the loader's ready hook, after the resume hop can no longer
   happen — a session belonging to another part must not leave a unit statement here. */
function onXapiReady() {
  loadUnitMetadata('../metadata/methodica-math-scale-01_unit.json', function () {
    try { sendStatement720('initialized', 'onlinelesson', null, { scope: 'unit' }); } catch (e) {}
  });
}
