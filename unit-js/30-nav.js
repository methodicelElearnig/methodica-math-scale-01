'use strict';
/* ═══════════════════ Navigation + resume replay ═══════════════════
   Shared by all five components. Definition-only.

   currentScreen lives HERE, not in each script.js: goTo() writes it and the report modal, the
   xAPI item scope and the resume payload all read it. A shared function writing a part-declared
   `let` across files is exactly the coupling this layer exists to remove.

   Per-part seams, all read at CALL time:
     TOTAL_SCREENS          number of screens in this component
     resetScreenState(n)    dispatches to the screen's sNNEnter()
     capturePartPayload()   this component's payload, including currentScreen
     applyResumeVars(st)    assigns the payload's answer variables — parameter MUST be named `st`
     applyResumeDom(st)     restores DOM-only answers, taking the WHOLE payload
     restoreScreenUI(n)     repaints the answered look
*/

var currentScreen = 0;

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const nextScreen = document.querySelector(`[data-screen="${n}"]`);
  /* A screen the map names but the markup does not have. Components 04 and 05 already guarded
     this; without it goTo() throws inside an onclick — which is what component 01's screens 5
     and 13 did. Placed BEFORE currentScreen = n, so a rejected navigation leaves no
     inconsistent state behind. */
  if (!nextScreen) return;
  nextScreen.classList.add('active');
  currentScreen = n;
  try { xapiOnScreen(n); } catch (e) {}

  /* Keep an answered screen answered when the learner returns to it.
     sNNEnter() is an INITIALISER: it zeroes this screen's answer variables and wipes its DOM.
     Snapshot before it runs, re-apply after, then let the existing painter rebuild the answered
     look — the same three steps applyExecutionState() does for the landing screen, now applied
     to every navigation. That is what makes a REVISITED screen keep its final state, and what
     rebuilds it after a reload, when the DOM is pristine markup and only the restored variables
     know the answer.
     Some enters already early-return on a solved flag, so for those the re-apply is a no-op and
     only the painter matters; the ones without such a guard rely on both halves.
     A never-answered screen snapshots falsy values, so re-applying is a no-op and every painter
     early-returns — pristine screens are unaffected. */
  var _keep = null;
  if (!_restoring) { try { _keep = capturePartPayload(); } catch (e) { _keep = null; } }

  resetScreenState(n);

  if (_keep) {
    try {
      applyResumeVars(_keep);
      applyResumeDom(_keep);
      restoreScreenUI(n);
    } catch (e) { console.error('[resume] repaint on nav', e); }
  }

  nextScreen.focus();
  var heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
  /* Resume: the screen change is the choke point that bounds how much a learner can lose.
     Debounced, and suppressed while restoring. */
  scheduleResumeSave();
}

/* Replay a saved payload onto this component. Called by ../unit-js/50-loader.js on launch.

   The two-pass shape is load-bearing: goTo() runs the screen's sNNEnter(), which resets exactly
   what was just restored, so the variables are assigned again afterwards and only then painted. */
function applyExecutionState(st) {
  if (!st) return;
  _restoring = true;
  /* Replaying answers must not re-report them. The stub is held across goTo() too, which is what
     keeps a finale screen from re-emitting the item, component and unit 'completed' when the
     learner resumes onto it — the library's one-per-page-load rule cannot help across a page
     load. */
  var _origSend = window.sendStatement720;
  window.sendStatement720 = function () {};
  try {
    applyResumeVars(st);
    goTo((typeof st.currentScreen === 'number') ? st.currentScreen : 0);
    applyResumeVars(st);   // undo the reset that this screen's sNNEnter() just did
    applyResumeDom(st);    // before the painter, which locks/disables the inputs
    restoreScreenUI(currentScreen);
  } catch (e) {
    console.error('[resume] apply', e);
  } finally {
    window.sendStatement720 = _origSend;
    _restoring = false;
  }
  /* xapiOnScreen() latched xapiCurrentItem during the stubbed goTo without emitting anything.
     Clearing the latch is what lets the resumed screen report its item 'initialized' exactly
     once — and there is no prior item to close on a fresh page load. */
  xapiCurrentItem = null;
  try { xapiOnScreen(currentScreen); } catch (e) {}
}
