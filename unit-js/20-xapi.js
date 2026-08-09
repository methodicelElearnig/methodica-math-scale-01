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

/* HTML5 <video> played/paused. */
function xapiWireVideos(){
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  document.querySelectorAll('video').forEach(function(v){
    if (v.__xapiWired) return; v.__xapiWired = true;
    var pausedOnce = false;
    v.addEventListener('pause', function(){ if (v.ended || v.currentTime === 0) return; pausedOnce = true; try { sendStatement720('paused', 'question', null, { time: v.currentTime }); } catch (e) {} });
    v.addEventListener('play',  function(){ if (!pausedOnce) return; try { sendStatement720('played', 'question', null, { time: v.currentTime }); } catch (e) {} });
  });
}
