'use strict';
/* ── iPad-shaped-viewport gate for the .screen-stage centering fix (component-local trial) ──
   Wraps the shared scaleApp() (../unit-js/15-ui.js) to also toggle a class on #app reporting
   whether the FLUID canvas height (set by scaleApp itself) is "meaningfully" taller than the
   720px design height right now.

   Why this exists: the .screen-stage wrap (see styles.css) vertically centers each screen's
   content instead of pinning it to the top, which fixes an empty-gap-below-content look on
   genuinely narrow/portrait-shaped viewports (iPad). But ANY viewport whose aspect ratio is even
   slightly narrower than 1280:720 (=1.778) already produces *some* extra fluid height under this
   architecture — e.g. a plain 16:10 (1.6) browser window yields ~80px of extra height, a 3:2
   window ~133px — and unconditionally centering shifts content down noticeably even on such
   perfectly ordinary desktop windows, not just tablets. That showed up in review: titles looked
   like they'd moved position in the reviewer's own regular (non-elongated) browser window.

   Fix: only flip on the centering behavior once the extra height crosses a threshold well past
   what an ordinary desktop window (16:9, 16:10, 3:2 — anything with aspect ratio down to ~1.47)
   would ever produce, so those keep the exact pre-existing top-pinned look. The threshold below
   (150px) corresponds to aspect ratio ~1.47 — a 4:3-ish or narrower viewport (iPad landscape
   1024x768 = 1.33, iPad portrait 768x1024 = 0.75) crosses it; typical desktop windows don't. */
var CANVAS_TALL_EXTRA_THRESHOLD = 150; // px of extra fluid height above the 720 design height

(function () {
  var orig = window.scaleApp;
  if (typeof orig !== 'function') return; // shared scaleApp not loaded yet — nothing to wrap

  window.scaleApp = function () {
    orig();
    var app = document.getElementById('app');
    if (!app) return;
    var h = parseFloat(app.style.height) || 720;
    var extra = h - 720;
    app.classList.toggle('canvas-tall', extra > CANVAS_TALL_EXTRA_THRESHOLD);
  };
})();
