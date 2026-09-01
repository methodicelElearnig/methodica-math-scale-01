'use strict';
/* ═══════════════════ BOOT ═══════════════════
   The ONLY file in unit-js/ with top-level side effects, and the LAST script tag on every page —
   after the component's own script.js, so every per-part hook it calls already exists.

   Before the split, each script.js interleaved definitions with side effects and the startup
   order was whatever the file happened to be in. It is now explicit, and the order below is
   load-bearing:

     0. initResumeResetHatch() before everything — it rewrites the URL and raises the reset flag,
        so it must run before anything reads the query or touches the state document.
     1. scaleApp() first — initFeedbackDrag's getAppTransform() parses #app.style.transform,
        which does not exist until scaleApp has written it.
     2. initFeedbackDrag() must be the LAST thing that wraps goTo. It replaces window.goTo with a
        wrapper; because a top-level `function goTo(){}` is also a window property, a bare goTo(n)
        call anywhere then reaches the wrapper too. Anything installed after it would be bypassed.
     3. partBoot() before bootXAPI() — a component's own wiring must be in place before a resume
        can replay onto it.
     4. bootXAPI() last, exactly as every script.js used to end. It may window.location.replace()
        to another component, and nothing after it would run.

   No DOMContentLoaded wrapper is needed: this file sits immediately before </body>, so the DOM
   is already complete. That is the same position the report-select and a11y code ran from before
   the split. */
(function boot () {
  /* FIRST, before anything reads the query string or touches the state document: the hatch strips
     ?resetState from the URL and raises the reset flag. Every cross-part navigation copies
     window.location.search verbatim, so a ?resetState left in place would re-fire on every hop
     and resume would never work at all. */
  try { initResumeResetHatch(); } catch (e) { console.error('[boot] initResumeResetHatch', e); }

  window.addEventListener('resize', scaleApp);
  scaleApp();

  try { initA11yWiring(); }    catch (e) { console.error('[boot] initA11yWiring', e); }
  try { initReportModal(); }   catch (e) { console.error('[boot] initReportModal', e); }
  try { initImgZoomEscape(); } catch (e) { console.error('[boot] initImgZoomEscape', e); }
  initFeedbackDrag();
  initDevBridge();
  initResumeLeaveHandlers();

  /* Optional per-part hook: anything only one component needs (character preloads, keydown
     wiring for cards it alone has, a first resetScreenState). Defined in that script.js. */
  if (typeof partBoot === 'function') {
    try { partBoot(); } catch (e) { console.error('[boot] partBoot', e); }
  }

  bootXAPI();
})();
