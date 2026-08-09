'use strict';
/* ── Dev tool bridge (index_dev.html postMessage) ──
   Shared by all five components. Definition-only: 90-boot.js calls initDevBridge().

   index_dev.html is a development harness and is NOT deployed, so nothing here reaches a
   learner. It only acts when the page is inside a frame.

   Two harmless unifications: components 01 and 02 announced DEV_READY on DOMContentLoaded while
   03, 04 and 05 used load — this uses load for all five, which fires last. And the Ctrl+arrow
   forwarding existed only in component 01; it is inert elsewhere because the parent tool simply
   ignores a DEV_KEY it did not ask for. */
function initDevBridge() {
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'DEV_GOTO') { goTo(e.data.screen); }
  });

  window.addEventListener('load', function () {
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
}
