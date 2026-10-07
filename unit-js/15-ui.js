'use strict';
/* ═══════════════════ Shared UI helpers ═══════════════════
   Viewport scaling, the a11y announcer, image-zoom overlays and three small helpers that more
   than one component uses. Definition-only: 90-boot.js calls the init* functions.

   Every function here was byte-identical across the components that had it, with one exception
   noted on scaleApp. */

function announce(msg) {
  var el = document.getElementById('a11y-announcer');
  if (!el || !msg) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = msg; }, 50);
}

/* ── Viewport scaling ──
   Width is locked to the 1280px design grid (screens anchor content to BOTH edges);
   the design HEIGHT is fluid. Since scale <= innerHeight / 720, the fluid height is
   always >= 720, so the scaled canvas exactly fills the viewport and .bottom-bar can
   never be pushed off-screen. See RESPONSIVENESS.md.

   The --sb-width line came from component 01, the only one whose CSS reads the property. It is
   inert in the others (an unused custom property costs nothing), so one version serves all five
   rather than leaving 01 with a private copy that has to be kept in sync by hand. */
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

/* ── Image zoom overlays ── */
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

function initImgZoomEscape() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeImgZoom();
  });
}

/* Accessibility: aria-live on feedback regions + tabindex on screens for focus routing. */
function initA11yWiring() {
  document.querySelectorAll('.s5-inline-feedback').forEach(function(el) {
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
  });
  document.querySelectorAll('section.screen').forEach(function(s) {
    s.setAttribute('tabindex', '-1');
  });
}

/* ── Small helpers used by more than one component ── */

/* Closes an inline feedback bar. Components 01, 02, 04, 05. */
function s5FbClose(id) {
  var el = document.getElementById(id);
  if (el) el.hidden = true;
}

/* Accepts "a:b" in either order, ignoring spaces and thousands separators. Components 01, 02, 04. */
function checkRatio(input, a, b) {
  var s = input.replace(/\s/g, '').replace(/,/g, '');
  var parts = s.split(':');
  if (parts.length !== 2) return false;
  return (parts[0] === String(a) && parts[1] === String(b)) ||
         (parts[0] === String(b) && parts[1] === String(a));
}

/* Question-progress nav bar. Components 02 and 04. Component 01 has its own s18UpdateNav and
   s23UpdateNav, which differ; they stay per-part. */
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

/* ── Paint-safe image source swap ──────────────────────────────────────
   Assigning img.src does NOT clear the frame the browser has already decoded: the OLD image keeps
   painting until the new bytes arrive and decode. On a 1.3MB avatar over school Wi-Fi that is
   hundreds of ms of a visibly WRONG picture — "an image that does not belong to the content is
   displayed first, then the correct one appears", as the tester put it.

   So: hide the box, swap, reveal once the bytes are in. Two invariants matter more than the fade.

     1. FAIL VISIBLE. The image must end up visible on EVERY exit path — same src, already cached,
        load, error. A 404 shows the broken-image box and the Hebrew alt text; it must never leave
        a hole the learner cannot describe.
     2. LAST CALL WINS. Rapid repeated calls on one element (setScale's three zoom levels, a goTo
        storm) must not let a slow earlier fetch reveal a stale frame. __imgSwapSeq is the
        generation stamp that makes the loser's callback a no-op.

   opacity, not display/visibility: the element stays in the layout, so nothing reflows and no
   geometry read elsewhere changes its answer.

   Component 05 carried this by hand on one element (its resetScreenState(0)); this is that code
   generalised, so the other ~23 swap sites do not each grow a copy of it.

   ⚠️ This OWNS img.onload / img.onerror on the elements it touches. Nothing in this unit assigns
   those today; anything added later must use addEventListener, not the property. */
function setImgSrc(img, src, alt) {
  if (!img || !src) return;
  if (alt != null) img.alt = alt;

  /* Resolve before comparing: img.src always reads back absolute and percent-encoded, so a raw
     relative path containing a space (the Football yard photos) never equals it. The hand-rolled
     endsWith() guard at component 01's setScale() got exactly this wrong and therefore never
     fired — every click on the SAME zoom level re-requested a 0.6MB photo and re-flashed the
     previous one. */
  var resolved;
  try { resolved = new URL(src, document.baseURI).href; } catch (e) { resolved = src; }

  /* Same file → nothing is in flight and nothing to hide. This is the COMMON case: every goTo()
     re-runs the screen's sNNEnter(), which re-assigns the src it already has. Without this branch
     the avatar would blink on every single navigation — a new bug in place of the old one. The
     opacity is still asserted, because the markup or an interrupted earlier swap may have left it
     at 0. */
  if (img.src === resolved) { img.style.opacity = '1'; return; }

  var seq = (img.__imgSwapSeq = (window.__imgSwapSeq = (window.__imgSwapSeq || 0) + 1));
  function show() {
    if (img.__imgSwapSeq !== seq) return;   /* a newer swap owns this element now */
    img.style.opacity = '1';
  }

  img.style.transition = 'opacity 0.15s';   /* set here, so five styles.css files stay untouched */
  img.style.opacity    = '0';
  img.onload  = show;
  img.onerror = show;                       /* a missing file must not stay invisible */
  img.src     = resolved;

  /* Already in the memory cache. Browsers disagree about whether load fires for a cached image;
     .complete is the reliable answer and is true synchronously right after the assignment on that
     path. show() then runs in the SAME task, so the 0 is never painted and the transition never
     starts — a cached swap stays instantaneous, exactly as today.
     decode() is deliberately NOT used: it adds a promise per call that must be rejected on an
     aborted swap, and it rejects outright on some display:none elements, for no gain — onload for
     a same-document <img> already fires after the decode. */
  if (img.complete) show();
}

/* ── Preload, serialised ──
   What this replaces in each partBoot(): component 01 fired fourteen bare `new Image()` requests
   (~18MB, BOTH families, every pose) in one synchronous burst BEFORE the visible avatar had even
   been requested. School Wi-Fi is often HTTP/1.1, where the browser opens six connections per
   origin: those fourteen are a queue that the one image the learner is looking at has to wait
   behind. The preload was not mitigating the flash, it was lengthening it.

   Chained, and started after the load event, so a preload can never be ahead of a visible image.
   Callers pass their own family only — the other character is never shown, since the choice is
   made once on component 01 screen 0 and carried in the state document. */
function preloadImages(urls) {
  var i = 0;
  function next() {
    if (i >= urls.length) return;
    var im = new Image();
    im.onload = im.onerror = next;
    im.src = urls[i++];
  }
  function start() { try { setTimeout(next, 300); } catch (e) {} }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/* Number-only answer fields (MOE 06.10: "ניתן לכתוב אותיות איפה שמיועדים רק מספרים לאורך כל הרכיב").
   An <input data-numeric="number"> keeps digits, "." and ","; data-numeric="ratio" (a scale such as
   1:25000) also keeps ":" and spaces. Anything else is dropped as it is typed or pasted. One
   capture-phase listener on the document: it runs before the field's own oninput, so that handler,
   the check and the resume payload only ever see the cleaned value. */
var NUMERIC_FIELD_RE = { number: /[^0-9.,]/g, ratio: /[^0-9.,:\s]/g };
document.addEventListener('input', function (e) {
  var el = e.target;
  if (!el || !el.getAttribute) return;
  var re = NUMERIC_FIELD_RE[el.getAttribute('data-numeric')];
  if (!re) return;
  var v = el.value, clean = v.replace(re, '');
  if (clean === v) return;
  var pos = el.selectionStart;
  el.value = clean;
  if (pos != null) {
    var p = Math.max(0, pos - (v.length - clean.length));
    try { el.setSelectionRange(p, p); } catch (err) {}
  }
}, true);
