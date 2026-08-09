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
