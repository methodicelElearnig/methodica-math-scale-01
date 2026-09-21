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

/* ── Re-arm the library's per-page-load 'answered' memory after a restore ──────────────
   xapi-720-k.js gates an item's 'completed' on xapiItemAnswered[itemId], a map it fills ONLY
   from an 'answered' passing through in the SAME page load:

       if (sttmContext?.expectsAnswer && !xapiItemAnswered[_cid]) {
           console.log("[XAPI] item left unanswered — deferring 'completed': " + _cid);
           return;          // "deferring" is a DROP — there is no queue, flush or retry

   That guard is right within a session: it stops a learner who leaves a question backwards
   through goBack() from emitting a resultless 'completed' that would then block the real,
   scored one. But a resume deliberately does NOT re-send the answers it restores, so without
   the seeding below the library treats every previously answered item as unanswered and drops
   its 'completed' — while sendStatementOnce, having called the sender, marks the ledger sent.
   The lomda then never asks again, the library never retries, and the statement is lost for
   good. Verified live against Kata on 07.09.26: the ledger said sent while the library's own
   xapiCompletedObjects was still empty.

   Seeding puts the library back where it would have been had the learner never left. It emits
   nothing itself — it only unblocks the guard, and the 'completed' that follows carries the
   explicit result xapiItemResult() supplies, so nothing rides on the library's own scoring.

   Only items with a RECORDED ANSWER are seeded, so an item the learner never answered is still
   deferred and the goBack protection above is preserved.

   ⚠️ Must run after applyResumeVars (which repopulates XAPI_Q_RESULTS) and before any item
   boundary can be crossed. applyExecutionState calls it as its last act. */
function xapiSeedAnsweredFromResume(){
  if (!window.XAPI_USING_G) return;
  /* A silent no-op here would reintroduce the bug invisibly, so say so: the map is a plain
     global today, and would stop being reachable if the library moved it to const/let. */
  if (!window.xapiItemAnswered) {
    console.warn('[xAPI] xapiItemAnswered unreachable — item "completed" will be dropped after a resume');
    return;
  }
  Object.keys(XAPI_Q_RESULTS).forEach(function(k){
    var item = k.split('/')[0];
    if (item) window.xapiItemAnswered[xapiItemId(item)] = true;
  });
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

   ── Scope: the whole unit attempt ──
   XAPI_HINTS_SENT alone is cleared on reload, which used to mean a learner who refreshed and
   reopened the same hint reported 'requested.1' a second time. Every cross-part 'חזרה' is also a
   fresh page load, so this happened in normal use and not only on a manual refresh. The keys now
   live in the state document too, under `hints`, through the same sendStatementOnce the
   'completed' ledger uses — so they survive a reload, a cross-part hop and a tab close.
   XAPI_HINTS_SENT stays in front of it as the in-memory fast path, so a repeat click costs no
   document read.

   Two orderings matter:
   - The memory latch is set only when sendStatementOnce reports the key SETTLED. While a restore
     is in flight it returns false and sends nothing, so latching there would swallow the
     learner's first real hint of the session.
   - Both latches sit after the XAPI_USING_G guard, so neither records a statement that never
     left. */
function xapiRequestedHint(item, qKey){
  var _k = item + '/' + qKey;
  if (XAPI_HINTS_SENT[_k]) return;
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  try {
    if (typeof sendStatementOnce === 'function') {
      /* Fails OPEN: with no document alreadySent() is false, so the hint is still reported. */
      if (sendStatementOnce('hints', _k, 'requested.1', 'question', null, xapiQ(item, qKey))) {
        XAPI_HINTS_SENT[_k] = true;
      }
      return;
    }
    sendStatement720('requested.1', 'question', null, xapiQ(item, qKey));
    XAPI_HINTS_SENT[_k] = true;
  } catch (e) { console.error('[xAPI] requested ' + _k, e); }
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

/* The last screen's button: report the component, then stop. Kata removes the component on
   'completed' (v2.7 p.23) and routes on it; outside Kata the disabled button is the only sign the
   click landed. Every former route function ends here — the hop that used to follow lives on only
   under DEV_NAV (10-identity.js). There is no unit-level statement any more (the xapiCompleteUnit
   that stood here until 2026-09-16): v2.5/v2.7 define object as item or component only, and the
   platform derives unit state itself. See REPORT-XAPI.md §12. */
function xapiEndComponent(result, btn){
  xapiCompleteComponent(result);
  if (btn) { btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); }
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
   data-xapi-report="003"). No element in this unit carries it, so video
   reporting is off in practice — the mechanism stays ready for real content video.
   ── TWO RULES BIND ANYTHING EVER OPTED IN (17.09.26) ──
   The machine below reports a 'played' on every start, so:
     - do NOT load() or swap src on a reported video while it is playing. That is what s53Enter
       does to #s53-gif on every entry, and the pause it fires is not the learner's. The
       'emptied' guard catches the common ordering but is not a guarantee — the measurement in
       mass-measure-01 shows currentTime still holding its OLD value when pause fired, i.e. that
       engine dispatched pause before tearing the element down, so 'emptied' may arrive after it.
     - NEVER opt in a `loop` video — #s53-gif is one. Every iteration would report a played.
   ── objectId: the ITEM, not the question (15.09.26) ──
   Reported by the test team: these statements went out against the PART. Carrying xapiQ() was
   never enough. The library builds object.id from sttmContext.objectId, else from a questionId
   but ONLY for answered/selected/requested, else from window.METADATA.id. played/paused are in
   neither allowlist, so the questionId and parentId were discarded and the component id was sent
   (xapi-720-k.js, the object block). They now pass objectId: xapiItemId(item) — the same helper
   that anchors item initialized/completed.
   xapiQ() and data-xapi-q are gone from this path: the object is the ITEM, and a video item need
   not carry a question at all (mass-measure-01's item 006 has none).
   ⚠️ MOE's own "דוגמאות XAPI" §6/§7 show a COMPONENT id in object for Played/Paused. We follow
   the test team, because a component-level video event cannot say which video. Written
   confirmation from MOE is still open — ask it together with the same question for 'requested'. */
function xapiWireVideos(){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  document.querySelectorAll('video[data-xapi-report]').forEach(function(v){
    if (v.__xapiWired) return; v.__xapiWired = true;
    var item = v.getAttribute('data-xapi-report');
    var ctx  = { objectId: xapiItemId(item) };   // the ITEM this video belongs to
    var playing   = false;  // a 'played' is open, not yet closed by a 'paused'
    var reloading = false;  // a load()/src swap is in flight: its 'pause' is not the learner
    function send(verb) {
      try { sendStatement720(verb, 'question', null, Object.assign({ time: v.currentTime }, ctx)); } catch (e) {}
    }
    v.addEventListener('emptied', function(){ reloading = true; });
    v.addEventListener('play', function(){
      reloading = false;
      if (playing) return;                           // already open: nothing started
      playing = true;
      send('played');
    });
    v.addEventListener('pause', function(){
      if (!playing) return;                          // nothing open -> an orphan is impossible
      playing = false;
      if (v.ended) return;                           // end of clip, not a learner pause
      if (reloading || v.readyState === 0) return;   // load()/src swap, not a learner pause
      send('paused');
    });
    /* Some engines fire 'ended' without a preceding 'pause'. Close the state either way. */
    v.addEventListener('ended', function(){ playing = false; });
  });
}
