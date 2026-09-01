'use strict';
/* ═══════════════════ xAPI (720) — item scope + question ids ═══════════════════
   Shared by all five components. Definition-only; 90-boot.js drives startup via bootXAPI().
   See REPORT-XAPI.md for what each statement means and RESUME.md §8a for the 'completed' ledger.

   Per-part seams read at CALL time (each component's own script.js declares them):
     SCREEN_TO_SUBCONTENT   screen -> [item suffix, page-in-item]; null = no catalog item
     XAPI_COMP_SLUG         e.g. 'methodica-math-scale-01-02'
     XAPI_COMP_ID           XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/'
     XAPI_EVAL_ITEMS        items that carry a graded question IN CODE
     XAPI_ITEM_RESULT       optional; item suffix -> function returning an explicit result
   Every read is guarded with typeof, so a component that omits an optional one degrades to the
   neutral value instead of throwing inside a statement path — where the surrounding try/catch
   would swallow it and the statement would vanish silently. */

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

/* Per-question outcome, keyed '<item>/<q>'. Written by every answered site (outside its
   try/catch, so a reporting failure cannot corrupt the score) and read when the component
   'completed' is assembled. The library's own aggregate is an all-correct AND, which would
   report success:false for any partial pass, so a component that needs a partial score supplies
   its result explicitly. Components 01 and 03 never write to this; it stays empty and unused. */
var XAPI_Q_RESULTS = {};
function xapiCorrectCount(){ return Object.keys(XAPI_Q_RESULTS).filter(function(k){ return XAPI_Q_RESULTS[k]; }).length; }

var xapiCurrentItem = null;

/* An explicit result for an item's 'completed', when the library's all-correct AND is wrong for
   it. Only component 05 defines XAPI_ITEM_RESULT (its שאלת-שיא passes at >= 3 of 4); everywhere
   else this returns null, which is exactly what those components passed literally before. */
function xapiItemResult(item){
  var map = (typeof XAPI_ITEM_RESULT !== 'undefined') ? XAPI_ITEM_RESULT : null;
  var f = map && map[item];
  return f ? f() : null;
}

function _xapiIsEval(item){
  return (typeof XAPI_EVAL_ITEMS !== 'undefined') && !!XAPI_EVAL_ITEMS[item];
}

/* Item-level initialized/completed pairs, driven from goTo(). Paging inside one item emits
   nothing; the item closes when the learner enters a screen belonging to a different item. */
function xapiOnScreen(screen){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  var map = (typeof SCREEN_TO_SUBCONTENT !== 'undefined') ? SCREEN_TO_SUBCONTENT[screen] : null;
  var item = map ? map[0] : null;
  if (item === xapiCurrentItem) return;
  if (xapiCurrentItem) {
    try { sendCompletedOnce('doneItems', itemLedgerKey(xapiCurrentItem), 'question', xapiItemResult(xapiCurrentItem), { objectId: xapiItemId(xapiCurrentItem), expectsAnswer: _xapiIsEval(xapiCurrentItem) }); } catch (e) {}
  }
  xapiCurrentItem = item;
  if (item) {
    try { sendStatement720('initialized', 'question', null, { objectId: xapiItemId(item), isEvaluationItem: _xapiIsEval(item) }); } catch (e) {}
  }
}

/* Close the last open item — called immediately before every component 'completed'. */
function xapiFinishItems(){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  if (xapiCurrentItem) {
    try { sendCompletedOnce('doneItems', itemLedgerKey(xapiCurrentItem), 'question', xapiItemResult(xapiCurrentItem), { objectId: xapiItemId(xapiCurrentItem), expectsAnswer: _xapiIsEval(xapiCurrentItem) }); } catch (e) {}
    /* Cleared whether or not the statement was suppressed: a latch left set would make the next
       xapiOnScreen try to close the same item all over again. */
    xapiCurrentItem = null;
  }
}

/* ═══════════════════ The call-site helpers ═══════════════════
   Every `answered` site used to be a 6–8 line block, duplicated 25 times across five files, and
   every hint site a 1-line raw send duplicated 23 times. These helpers turn each into one call.
   Less duplication means fewer places to get it wrong — and that is exactly the class of mistake
   the swallowing try/catch around each site was hiding.

   ⚠️ The write to XAPI_Q_RESULTS happens BEFORE the try/catch and outside it, not inside. That is
   an invariant from docs-and-tools/REPORT-XAPI.md §2: a reporting failure must not be able to
   corrupt the score. It is now enforced in one place rather than relied on at 25 call sites. */

/* ── Answer-text builders, for question types that are not single choice ──
   result.response should carry what the learner actually answered. For single choice that is
   xapiAnswerText(optEl); drag and field questions need to describe a state rather than one
   element. All three are deliberately generic so they can move between units unchanged. */

/* A drag board: for each zone, the items the learner dropped in it.
   'ton: locomotive | kg: giant turtle | gram: apple, grain of salt'
   ⚠️ Unused in this unit — component 04's drag question serialises its own ddqPlacement map,
   because its markup has no <prefix>-zone-<id> containers. Kept so this file stays identical
   across units; delete it only if the whole family stops using zone markup. */
function xapiZoneAnswer(prefix, zoneIds){
  try {
    return zoneIds.map(function(z){
      var el = document.getElementById(prefix + '-zone-' + z);
      var items = el ? el.querySelectorAll('[class*="drag-item"], [class*="placed-card"]') : [];
      var names = [];
      for (var i = 0; i < items.length; i++) names.push(xapiAnswerText(items[i]));
      return z + ': ' + (names.join(', ') || '—');
    }).join(' | ');
  } catch (e) { return ''; }
}

/* A group of inputs or dropdowns. `values` is optional — without it .value is read from the DOM.
   's18-input-1=1400 | s18-input-2=900' */
function xapiFieldsAnswer(ids, values){
  try {
    return ids.map(function(id){
      var v = values ? values[id] : (document.getElementById(id) || {}).value;
      return id + '=' + (v == null || v === '' ? '—' : v);
    }).join(' | ');
  } catch (e) { return ''; }
}

/* Multiple choice: the labels of the selected options, via the screen's own lookup function. */
function xapiMultiAnswer(ids, optElFn){
  try {
    return (ids || []).map(function(id){
      return xapiAnswerText(optElFn(id)) || String(id);
    }).join(', ');
  } catch (e) { return ''; }
}

/* Report one graded answer.
     item      the item suffix, e.g. '005'
     qKey      the question key, e.g. 'q1'
     correct   whether the answer is correct
     isLast    whether this is the final answer to the question (correct, or attempts exhausted).
               Only 'answered.last' enters the component score denominator.
     answer    the learner's answer text, as they see it */
function xapiAnswered(item, qKey, correct, isLast, answer){
  XAPI_Q_RESULTS[item + '/' + qKey] = !!correct;
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  try {
    sendStatement720(isLast ? 'answered.last' : 'answered', 'question',
      { success: !!correct,
        score: { scaled: correct ? 1 : 0 },
        extensions: { student_answer: [answer == null ? '' : String(answer)] } },
      xapiQ(item, qKey));
  } catch (e) { console.error('[xAPI] answered ' + item + '/' + qKey, e); }
}

/* The (item/qKey) pairs already reported with 'requested.1' during THIS page load. Same key
   xapiAnswered uses for XAPI_Q_RESULTS. */
var XAPI_HINTS_SENT = {};

/* A hint request. ⚠️ Place only in the branch where the hint is actually being OPENED. Hints here
   are overlays whose `hidden` is toggled, and calling this on the toggle would report a second
   request on every close.

   ── Dedupe: once per question ──
   Opening alone is not enough. Each overlay closes three ways (its close button, a click on the
   backdrop, and Escape) and all three leave the hint button live, so a learner who opened a hint
   twice reported 'requested.1' twice. The check lives here rather than at the call sites because
   there are 23 of them across four components and every one goes through this function.

   ── Scope: one page load ──
   The map is cleared on reload, so a learner who refreshes and reopens the same hint reports
   again. That is a deliberate trade (the alternative is holding these keys in the state
   document). The restore itself is not at risk: applyExecutionState replaces sendStatement720
   with a no-op for as long as _restoring is set. */
function xapiRequestedHint(item, qKey){
  var _k = item + '/' + qKey;
  if (XAPI_HINTS_SENT[_k]) return;
  XAPI_HINTS_SENT[_k] = true;
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  try { sendStatement720('requested.1', 'question', null, xapiQ(item, qKey)); } catch (e) {}
}

/* The component 'completed'. Closes the open item first, then reports through the ledger.
   ⚠️ Must be called on failure paths too. A component the learner did not pass still has to be
   reported, otherwise their whole attempt goes unrecorded — routing a failing learner is the
   platform's job, via the component's recommendedAfterFail. See REPORT-XAPI.md §5. */
function xapiCompleteComponent(result){
  try { xapiFinishItems(); } catch (e) {}
  try {
    sendCompletedOnce('done', currentPartSlug(), 'onlinelesson', result || null);
  } catch (e) { console.error('[xAPI] completed component', e); }
}

/* The unit 'completed'. Sent once per attempt, from the finale screen in component 05.
   'unit' is a ledger key of its own, because the statement belongs to the unit and not to the
   component that happens to send it.

   ⚠️ opts is { scope: 'unit' }, NOT { objectId: window.XAPI_UNIT_ID }. Both reach the same object,
   but this unit has used `scope` since its first version — including for the unit 'initialized'
   in component 01's onXapiReady — and that is the shape its live statements have been reviewed
   against. The science unit uses objectId; do not "harmonise" one into the other without checking
   what the library does with each, because the two are resolved by different code paths. */
function xapiCompleteUnit(result){
  try {
    sendCompletedOnce('done', 'unit', 'onlinelesson', result || null, { scope: 'unit' });
  } catch (e) { console.error('[xAPI] completed unit', e); }
}

/* played/paused for HTML5 <video> — CONTENT VIDEO ONLY, by explicit opt-in.
   ── Why an allowlist rather than every <video> ──
   The previous version selected querySelectorAll('video') with no filter. The only <video> in
   this unit is #s53-gif in component 05 — a decorative autoplay/loop/muted clip of the companion
   character, not content — and it was wired and reporting. Components 01–04 were silent only
   because they have no <video> element, not because anything filtered them.
   It was not quiet reporting either: an element that is playing emits a pause event followed by a
   play whenever .load() or a src swap happens, i.e. a fabricated paused/played pair on every
   entry to the screen, including on back-navigation and on resume.
   Only elements carrying data-xapi-report are wired now, its value being the item suffix (e.g.
   data-xapi-report="003" data-xapi-q="q1"). No element in this unit carries it, so video
   reporting is off in practice — the mechanism stays ready for real content video.
   ── objectId ──
   The previous version sent objectType 'question' with no objectId and no questionId, so those
   statements had no question to hang off. They now carry xapiQ() like every other question-scoped
   statement. */
function xapiWireVideos(){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  document.querySelectorAll('video[data-xapi-report]').forEach(function(v){
    if (v.__xapiWired) return; v.__xapiWired = true;
    var item = v.getAttribute('data-xapi-report');
    var qKey = v.getAttribute('data-xapi-q') || 'q1';
    var pausedOnce = false;
    v.addEventListener('pause', function(){ if (v.ended || v.currentTime === 0) return; pausedOnce = true; try { sendStatement720('paused', 'question', null, Object.assign({ time: v.currentTime }, xapiQ(item, qKey))); } catch (e) {} });
    v.addEventListener('play',  function(){ if (!pausedOnce) return; try { sendStatement720('played', 'question', null, Object.assign({ time: v.currentTime }, xapiQ(item, qKey))); } catch (e) {} });
  });
}
