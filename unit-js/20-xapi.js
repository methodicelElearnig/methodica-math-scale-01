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

/* ── B-2 (monday 13454123722, 2026-11-12): Back never closes an item ──
   The item closes only on a FORWARD move. A move is backward when the target screen ranks lower than the
   screen being left. A Back from a half-answered item used to send its 'completed' with the failed result
   at that moment, and the ledger then swallowed the real one after the learner came back and answered.
   The forward button is blocked until a question is finished, so the first forward close carries the final
   result. Rank: a numeric id is its number; a string id is its index in SCREEN_ORDER when the unit has one,
   else in SCREEN_TO_SUBCONTENT's key order. Screens in a part's XAPI_HUB_SCREENS are never backward — in
   part 01 the flip-cards screen, which the video screen's path toggle jumps back to: a path switch still
   closes the item it leaves. The item comparison is the fallback for the first call. */
var _xapiLastScreen = null;
function _xapiScreenRank(s) {
  if (s == null) return null;
  if (typeof s === 'number' || /^\d+$/.test(String(s))) return Number(s);
  var order = (typeof SCREEN_ORDER !== 'undefined' && Array.isArray(SCREEN_ORDER)) ? SCREEN_ORDER
    : (typeof SCREEN_TO_SUBCONTENT !== 'undefined' && SCREEN_TO_SUBCONTENT) ? Object.keys(SCREEN_TO_SUBCONTENT) : [];
  var i = order.indexOf(s);
  return i < 0 ? null : i;
}
function _xapiIsBackward(fromItem, toItem, toScreen, fromScreen) {
  if (typeof XAPI_HUB_SCREENS !== 'undefined' && XAPI_HUB_SCREENS && XAPI_HUB_SCREENS[toScreen]) return false;
  var a = _xapiScreenRank(fromScreen), b = _xapiScreenRank(toScreen);
  if (a != null && b != null) return b < a;
  return !!(fromItem && toItem && Number(toItem) < Number(fromItem));
}

/* Item-level initialized/completed pairs, driven from goTo(). Paging inside one item emits
   nothing; the item closes when the learner moves FORWARD into a screen belonging to a different
   item (a Back does not close it — B-2 above). */
function xapiOnScreen(screen){
  var fromScreen = _xapiLastScreen;
  _xapiLastScreen = screen;
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  var map = (typeof SCREEN_TO_SUBCONTENT !== 'undefined') ? SCREEN_TO_SUBCONTENT[screen] : null;
  var item = map ? map[0] : null;
  if (item === xapiCurrentItem) return;
  if (xapiCurrentItem && !_xapiIsBackward(xapiCurrentItem, item, screen, fromScreen)) {
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

/* ═══════════════════ result.response = Kata's correctXapiResponsesPattern form ═══════════════════
   MOE runbook (10.11.26): a right answer must send exactly the string Kata keeps in the question's
   correctXapiResponsesPattern, character by character — '[,]' between choices / pairs, '[.]' between
   a step (or source) and its value, the metadata's own wording and number formatting ('1,000').
   Until 2026-11-11 this unit sent home-made strings: values joined with ' | ' without step names,
   multi-select with ' | ', drop-target ids ('drag-12 -> target-yuval-gova'), and on-screen labels
   with a trailing U+200B. Ported from mass-density-01 (unit-js/20-xapi.js), with the Arabic twin's
   bidi strip (ar volume-liquid-01) plus U+200B / U+061C / U+FEFF; the screen's gershayim (U+05F4)
   reads as the metadata's '"'.
   The call sites pass WHAT the learner chose (an option index, a value, a pair); the builders below
   turn it into the metadata's strings, so a re-sync of metadata/ from Kata changes the wording
   without touching code. The library (xapi-720-l.js, answered block) passes result.response
   through verbatim. The retired xapiZoneAnswer / xapiFieldsAnswer / xapiMultiAnswer (the
   'id=value | …' producers) must not come back — _test/verify-report.js greps for them. */

/* The metadata question object for (item suffix, qKey) — or null. Same matching as xapiQ. */
function _xapiFindQuestion(suffix, qKey) {
  try {
    var sc = (window.METADATA && window.METADATA.subContent) || [];
    for (var i = 0; i < sc.length; i++) {
      if (_xapiTrim(sc[i].id).slice(-(suffix.length + 1)) !== '-' + suffix) continue;
      var qs = sc[i].questions || [];
      for (var j = 0; j < qs.length; j++) {
        var v = _xapiTrim(qs[j].questionId);
        if (v === qKey || v.slice(-(qKey.length + 1)) === '/' + qKey) return qs[j];
      }
      var n = parseInt(String(qKey).replace(/\D/g, ''), 10);
      return (n >= 1 && n <= qs.length) ? qs[n - 1] : null;
    }
  } catch (e) {}
  return null;
}

/* performance steps as [{name, correctAnswer}]. Two metadata shapes: an explicit steps[], or the
   Kata shape: answers null, correctAnswers [{stepId, response}] — the stepId is the step name, in
   correctAnswers order. */
function _xapiSteps(q) {
  if (q.steps) return q.steps;
  var ca = q.correctAnswers || [];
  if (!ca.length || !ca.every(function (c) { return c && c.stepId != null; })) return null;
  return ca.map(function (c) { return { name: c.stepId, correctAnswer: c.response }; });
}

/* {questionId, parentId, questionType, answers, correctAnswers, steps} — one lookup. */
function xapiQMeta(suffix, qKey) {
  var ids = xapiQ(suffix, qKey), q = _xapiFindQuestion(suffix, qKey) || {};
  return { questionId: ids.questionId, parentId: ids.parentId,
           questionType: q.questionType || null,
           answers: q.answers == null ? null : q.answers,
           correctAnswers: q.correctAnswers || null,
           steps: _xapiSteps(q) };
}

var XAPI_SEP_LIST = '[,]', XAPI_SEP_PAIR = '[.]';
var _XAPI_DELIMS = /\[,\]|\[\.\]|\[:\]/g;

/* Invisible marks: bidi (LRM / RLM / ALM, embeddings, isolates), the zero-width space the screen
   labels end with (01-01 010, 01-05 001/q3) and a stray BOM. Lookup only — what is emitted is
   always the metadata string, or the learner's own text with these removed. */
var _XAPI_BIDI = /[\u200B\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF]/g;
function _xapiNorm(s) {
  s = String(s == null ? '' : s);
  if (s.normalize) s = s.normalize('NFC');
  return s.replace(_XAPI_BIDI, '').replace(/[\u05F3\u2019\u02BC]/g, "'").replace(/\u05F4/g, '"')
          .replace(/\s+/g, ' ').trim();
}
/* The same value with spaces, thousands commas and a closing full stop dropped: '1000' finds
   '1,000', '25000:1' finds '25,000 : 1', an option ending in '.' finds its metadata text.
   Second-chance lookup only. */
function _xapiLoose(s) { return _xapiNorm(s).replace(/[\s,]/g, '').replace(/\.$/, ''); }
/* learner-typed text: the delimiters cannot be escaped in xAPI, so they are blanked */
function _xapiFree(s) { return _xapiNorm(s).replace(_XAPI_DELIMS, ' ').replace(/\s+/g, ' ').trim(); }

/* Resolve one UI value to the metadata entry it names. pool = array of metadata strings.
   value: a string (matched by _xapiNorm, then _xapiLoose) or a number (index into the pool).
   Returns {text, idx} — text is the METADATA string, byte for byte, when found. */
function _xapiPick(value, pool, item, qKey, where) {
  pool = pool || [];
  if (typeof value === 'number') {
    if (pool[value] != null) return { text: String(pool[value]), idx: value };
    console.warn('[xAPI] response: index ' + value + ' outside metadata ' + where, item, qKey);
    return { text: '', idx: 1e9 };
  }
  var n = _xapiNorm(value), i;
  for (i = 0; i < pool.length; i++) if (_xapiNorm(pool[i]) === n) return { text: String(pool[i]), idx: i };
  var l = _xapiLoose(value);
  for (i = 0; i < pool.length; i++) if (l !== '' && _xapiLoose(pool[i]) === l) return { text: String(pool[i]), idx: i };
  if (n !== '') console.warn('[xAPI] response: "' + n + '" not in metadata ' + where, item, qKey);
  return { text: _xapiFree(n), idx: 1e9 };
}

/* choice: selected → [text | index]; emitted in answers order, whatever the click order */
function xapiChoiceResponse(item, qKey, selected) {
  var m = xapiQMeta(item, qKey), pool = Array.isArray(m.answers) ? m.answers : [];
  var picks = (selected || []).map(function (v) { return _xapiPick(v, pool, item, qKey, 'answers'); });
  picks.sort(function (a, b) { return a.idx - b.idx; });
  var texts = picks.map(function (p) { return p.text; }).filter(function (t) { return t !== ''; });
  return { response: texts.join(XAPI_SEP_LIST), readable: texts.join(', ') };
}

/* matching: pairs → [{source, target}] (strings or indexes). Only the pairs the learner PLACED are
   emitted. Order: the pairs that are in correctAnswers first, in correctAnswers order — the order
   Kata builds correctXapiResponsesPattern in, so a right answer is byte-identical to it — then the
   wrong pairs in answers.source, answers.target order. One entry per placed pair. */
function xapiMatchingResponse(item, qKey, pairs) {
  var m = xapiQMeta(item, qKey);
  var src = (m.answers && m.answers.source) || [], tgt = (m.answers && m.answers.target) || [];
  var placed = [];   // [{s: {text, idx}, t: {text, idx}}]
  (pairs || []).forEach(function (p) {
    var s = _xapiPick(p.source, src, item, qKey, 'answers.source');
    var t = _xapiPick(p.target, tgt, item, qKey, 'answers.target');
    if (s.text !== '') placed.push({ s: s, t: t });   // an empty slot / an unplaced card is not a pair
  });
  /* rank = position in correctAnswers (each entry claimed once); wrong pairs rank after every right one */
  var ca = Array.isArray(m.correctAnswers) ? m.correctAnswers : [], claimed = {};
  placed.forEach(function (p) {
    p.rank = 1e9;
    for (var j = 0; j < ca.length; j++) {
      if (claimed[j] || !ca[j] || String(ca[j].source) !== p.s.text || String(ca[j].target) !== p.t.text) continue;
      claimed[j] = true; p.rank = j; break;
    }
  });
  placed.sort(function (a, b) { return (a.rank - b.rank) || (a.s.idx - b.s.idx) || (a.t.idx - b.t.idx); });
  var out = [], readable = [];
  placed.forEach(function (p) { out.push(p.s.text + XAPI_SEP_PAIR + p.t.text); readable.push((p.s.text || '—') + ' → ' + (p.t.text || '—')); });
  return { response: out.join(XAPI_SEP_LIST), readable: readable.join(' | ') };
}

/* performance: values → [text, …] in steps order (or { <step name>: text }). A value equal to the
   step's correct answer up to spaces / thousands commas is sent in the metadata's own form. */
function xapiPerformanceResponse(item, qKey, values) {
  var m = xapiQMeta(item, qKey), steps = m.steps || [];
  if (!steps.length) console.warn('[xAPI] performance: no steps[] / correctAnswers[].stepId in metadata', item, qKey);
  var out = [], readable = [];
  steps.forEach(function (st, i) {
    var name = String(st.name == null ? i + 1 : st.name);
    var v = values == null ? '' : (Array.isArray(values) ? values[i] : (values[name] != null ? values[name] : values[i]));
    v = _xapiFree(v);
    if (st.correctAnswer != null && v !== '' && _xapiLoose(v) === _xapiLoose(st.correctAnswer)) v = String(st.correctAnswer);
    out.push(name + XAPI_SEP_PAIR + v); readable.push(name + ': ' + (v || '—'));
  });
  return { response: out.join(XAPI_SEP_LIST), readable: readable.join(' | ') };
}

/* fill-in: a typed value equal to one of correctAnswers up to spaces / thousands commas is sent as
   that entry (the first in correctAnswers order), so '25000:1' and '25,000 : 1' both match Kata. */
function xapiFillInResponse(item, qKey, values) {
  var m = xapiQMeta(item, qKey), ca = Array.isArray(m.correctAnswers) ? m.correctAnswers : [];
  var vs = (Array.isArray(values) ? values : [values]).map(function (v) {
    var s = _xapiFree(v), l = _xapiLoose(s);
    for (var j = 0; j < ca.length; j++) if (typeof ca[j] === 'string' && l !== '' && _xapiLoose(ca[j]) === l) return ca[j];
    return s;
  });
  return { response: vs.join(XAPI_SEP_LIST), readable: vs.join(' | ') };
}
function xapiNumericResponse(item, qKey, value) {
  var n = Number(_xapiLoose(value));
  var s = (isNaN(n) || _xapiLoose(value) === '') ? _xapiFree(value) : String(n);
  return { response: s, readable: s };
}
function xapiTrueFalseResponse(item, qKey, value) {
  var s = (value === true || value === 'true') ? 'true' : 'false';
  return { response: s, readable: s };
}
function xapiOtherResponse(item, qKey, text) {
  var s = _xapiFree(text);
  return { response: s, readable: s };
}
function _xapiNoShape(item, qKey, want) {
  console.warn('[xAPI] response: metadata type needs "' + want + '" but the call site passed none', item, qKey);
  return [];
}

/* Dispatcher. spec = string | { type?, choices | pairs | steps | values | value | text }.
   The METADATA type governs (Kata reads the metadata); spec.type is only a cross-check. */
function xapiResponse(item, qKey, spec) {
  var m = xapiQMeta(item, qKey), type = m.questionType;
  if (typeof spec === 'string' || spec == null) spec = { text: spec == null ? '' : spec };
  if (spec.type && type && spec.type !== type)
    console.warn('[xAPI] response: call site says "' + spec.type + '", metadata says "' + type + '"', item, qKey);
  if (!type) { type = spec.type || 'other'; console.warn('[xAPI] response: no questionType in metadata, using "' + type + '"', item, qKey); }
  try {
    switch (type) {
      case 'choice':      return xapiChoiceResponse(item, qKey, spec.choices != null ? spec.choices : [spec.text]);
      case 'matching':    return xapiMatchingResponse(item, qKey, spec.pairs || _xapiNoShape(item, qKey, 'pairs'));
      case 'performance': return xapiPerformanceResponse(item, qKey, spec.steps != null ? spec.steps : spec.values);
      case 'fill-in':     return xapiFillInResponse(item, qKey, spec.values != null ? spec.values : spec.text);
      case 'numeric':     return xapiNumericResponse(item, qKey, spec.value != null ? spec.value : spec.text);
      case 'true-false':  return xapiTrueFalseResponse(item, qKey, spec.value != null ? spec.value : spec.text);
      default:            return xapiOtherResponse(item, qKey, spec.text != null ? spec.text : JSON.stringify(spec));
    }
  } catch (e) {
    console.error('[xAPI] response formatting failed', item, qKey, e);
    return { response: _xapiFree(spec.text), readable: _xapiFree(spec.text) };
  }
}

/* Report one graded answer.
     item      the item suffix, e.g. '005'
     qKey      the question key, e.g. 'q1'
     correct   whether the answer is correct
     isLast    whether this is the final answer to the question (correct, or attempts exhausted).
               Only 'answered.last' enters the component score denominator.
     answer    spec for xapiResponse ({choices} | {pairs} | {steps} | {value} | {text}), or a plain
               string for a single-value type */
function xapiAnswered(item, qKey, correct, isLast, answer){
  XAPI_Q_RESULTS[item + '/' + qKey] = !!correct;
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  try {
    var r = xapiResponse(item, qKey, answer);
    sendStatement720(isLast ? 'answered.last' : 'answered', 'question',
      { success: !!correct,
        score: { scaled: correct ? 1 : 0 },
        response: r.response,
        extensions: { student_answer: [r.readable] } },
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

/* The learning-path choice — MOE v2.7 'selected', category learning-type (2026-11-02, after the
   monday.com issues of 28.10.26 on the units that never reported it). object = the component;
   result.response = the mediaFormat of the chosen path's item, from the part's XAPI_LEARNING_PATHS
   (agreed deviation from v2.7's contentType, which cannot tell video from reading; until 02.11.26 this
   unit sent the card's label). EVERY confirmed choice and every path switch reports (2026-11-12,
   monday 13451706244; as mass-weight-01 since 04.11): with the old once-per-path 'picks' ledger,
   video -> cards -> video sent two statements and the platform could not tell which path the learner
   ended on. Only the actions that call this report — המשך on the choice screen and a switch on the path
   toggle; a card click does not, and the active tab has no handler. Silent while a painter runs (a resume
   or a reload is not a choice) and behind the XAPI_USING_G guard.
   Guide: ADDING-REPORTING-AND-RESUME.md §6.3a. */
function xapiSelectedLearningType(path) {
  var p = (typeof XAPI_LEARNING_PATHS !== 'undefined') && XAPI_LEARNING_PATHS[path];
  if (!p || (typeof resumeIsPainting === 'function' && resumeIsPainting())) return;
  if (!window.XAPI_USING_G || typeof sendStatement720 !== 'function') return;
  try {
    sendStatement720('selected', 'onlinelesson', { response: p.mediaFormat }, { category: 'learning-type' });
  } catch (e) { console.error('[xAPI] selected learning-type', e); }
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
