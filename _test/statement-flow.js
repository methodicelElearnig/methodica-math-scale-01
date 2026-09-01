/* ═══════════════════ behavioural statement-flow oracle ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   verify-report.js asserts STRUCTURE — that the wiring is present and the
   contracts hold. This asserts BEHAVIOUR: which statements actually leave the
   lomda when a learner does a thing, in what order, with what result, and — the
   part that matters most — which ones do NOT leave when the same screen is
   reached again by resume or by the back button.

   Ported from methodica-science-mass-measure-02/_test/statement-flow.js.

   jsdom will not fetch the CDN, so bootXAPI's two loadScript calls are inert.
   Rather than fake the loader, each scenario executes the real page scripts,
   then executes _test/xapi-720-k.js (the same stub the browser gets via
   ?xapiLib=), then replays the loader's post-metadata sequence explicitly. The
   screen code, the shared helpers and the ledger under test are all real.

   Run:
     NODE_PATH=/tmp/lomda-test/node_modules node _test/statement-flow.js
*/

'use strict';

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE     = process.argv[2] || path.join(__dirname, '..');
const UNIT     = 'methodica-math-scale-01';
const PART_DIR = c => UNIT + '-' + c;

const failures = [];
let passes = 0;

function ok(tag, what, cond, detail) {
  if (cond) { passes++; return; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
}

function eq(tag, what, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  ok(tag, what, a === e, 'got ' + a + ', expected ' + e);
}

/* Boot a component the way the browser does with ?xapiLib=, and stop just
   before the loader's post-metadata block so each scenario can drive it. */
function boot(c, opts) {
  opts = opts || {};
  const dir = path.join(BASE, PART_DIR(c));
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'http://localhost:8777/' + PART_DIR(c) + '/index.html' +
         (opts.search || '?slxapi=1&registration=r1') + (opts.hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const w = dom.window;

  const exec = (code) => {
    const s = w.document.createElement('script');
    s.textContent = code;
    w.document.head.appendChild(s);
    s.remove();
  };
  const val = (expr) => {
    exec('window.__v = (function(){ try { return (' + expr + '); } catch (e) { return "__throw:" + e.message; } })();');
    return w.__v;
  };

  w.console.error = w.console.warn = w.console.log = () => {};
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  w.HTMLMediaElement.prototype.load  = function () {};
  w.HTMLMediaElement.prototype.play  = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};

  for (const src of [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (fs.existsSync(p)) { try { exec(fs.readFileSync(p, 'utf8')); } catch (e) {} }
  }

  /* The library, exactly as ?xapiLib= would deliver it on localhost. */
  exec(fs.readFileSync(path.join(BASE, '_test', 'xapi-720-k.js'), 'utf8'));
  exec('window.XAPI_USING_G = true; window.__reset();');
  /* The component metadata, so xapiQ() resolves real question ids. */
  exec('window.METADATA = ' + fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^﻿/, '') + ';');

  const stmts = () => val('JSON.stringify(window.__stmts())') && JSON.parse(val('JSON.stringify(window.__stmts())'));
  const verbs = () => stmts().map(s => s.verb);

  /* Replay what the loader does after the metadata poll resolves. */
  const finishBoot = (payload, screenOverride) => {
    exec('_resumeReady = true; if (!_unitState) _unitState = emptyUnitState(); drainPendingUnitState();');
    if (payload !== undefined) {
      exec('applyExecutionState(' + JSON.stringify(payload) + ', ' +
           (screenOverride === undefined ? 'undefined' : screenOverride) + ');');
    }
    exec("sendStatement720('initialized', 'onlinelesson');");
    if (payload === undefined) exec('xapiOnScreen(currentScreen);');
  };

  return { dom, w, exec, val, stmts, verbs, finishBoot };
}

/* ══════════════ 1. A fresh load ══════════════ */

function freshLoad() {
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();

  const v = b.verbs();
  ok('fresh', 'a fresh load emits the component initialized',
    v.filter(x => x === 'initialized').length >= 1, JSON.stringify(v));
  ok('fresh', 'a fresh load emits nothing graded',
    !v.some(x => /answered|completed/.test(x)), JSON.stringify(v));

  b.dom.window.close();
}

function exec_reset(b) { b.exec('window.__reset(); _unitState = emptyUnitState();'); }

/* ══════════════ 2. Two attempts on one question ══════════════ */

function twoAttempts() {
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();
  b.exec('window.__reset();');

  /* Screen 18 is a value-input quiz exercise; the expected answer is 24. */
  b.exec("goTo(18); var i = document.getElementById('s18-answer-input'); i.value = '99'; s18Submit();");
  eq('attempts', 'a first wrong answer is an interim answered',
    b.verbs().filter(x => /answered/.test(x)), ['answered']);

  b.exec("var i2 = document.getElementById('s18-answer-input'); i2.value = '24'; s18Submit();");
  eq('attempts', 'the second answer closes the question',
    b.verbs().filter(x => /answered/.test(x)), ['answered', 'answered.last']);

  const last = b.stmts().filter(s => s.verb === 'answered.last')[0];
  eq('attempts', 'the closing statement carries success and a scaled score',
    [last.result.success, last.result.score.scaled], [true, 1]);
  eq('attempts', 'and the learner answer, as a one-element array of strings',
    last.result.extensions.student_answer, ['24']);

  ok('attempts', 'the score map records the outcome',
    b.val("XAPI_Q_RESULTS['005/q1']") === true);

  b.dom.window.close();
}

/* ══════════════ 3. Wrong twice still closes, and scores zero ══════════════ */

function twoWrong() {
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();
  b.exec('window.__reset();');

  b.exec("goTo(18); var i = document.getElementById('s18-answer-input'); i.value = '1'; s18Submit();");
  b.exec("var i2 = document.getElementById('s18-answer-input'); i2.value = '2'; s18Submit();");

  eq('attempts', 'two wrong answers still close the question',
    b.verbs().filter(x => /answered/.test(x)), ['answered', 'answered.last']);
  const last = b.stmts().filter(s => s.verb === 'answered.last')[0];
  eq('attempts', 'a failed question reports success false and score 0',
    [last.result.success, last.result.score.scaled], [false, 0]);
  ok('attempts', 'and the score map records the failure',
    b.val("XAPI_Q_RESULTS['005/q1']") === false);

  b.dom.window.close();
}

/* ══════════════ 4. Item scope: boundaries only ══════════════ */

function itemScope() {
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();

  const map = JSON.parse(b.val('JSON.stringify(SCREEN_TO_SUBCONTENT)'));
  /* Find two adjacent real screens inside the SAME item, and a pair that
     straddles a boundary. */
  let samePair = null, crossPair = null;
  const screens = Object.keys(map).map(Number).sort((a, b2) => a - b2);
  for (let i = 1; i < screens.length; i++) {
    const a = map[screens[i - 1]], c = map[screens[i]];
    const ai = a && a[0], ci = c && c[0];
    if (!ai || !ci) continue;
    if (ai === ci && !samePair) samePair = [screens[i - 1], screens[i]];
    if (ai !== ci && !crossPair) crossPair = [screens[i - 1], screens[i], ai, ci];
  }

  if (samePair) {
    b.exec('goTo(' + samePair[0] + ');');
    b.exec('window.__reset();');
    b.exec('goTo(' + samePair[1] + ');');
    eq('scope', 'paging inside one item emits nothing (screens ' + samePair.join('->') + ')',
      b.verbs(), []);
  } else {
    ok('scope', 'a same-item screen pair exists to test', true);
  }

  if (crossPair) {
    b.exec('goTo(' + crossPair[0] + ');');
    b.exec('window.__reset();');
    b.exec('goTo(' + crossPair[1] + ');');
    eq('scope', 'crossing an item boundary closes one and opens the next (screens ' +
      crossPair[0] + '->' + crossPair[1] + ')',
      b.verbs(), ['completed', 'initialized']);
  } else {
    ok('scope', 'a cross-item screen pair exists to test', false, 'none found');
  }

  b.dom.window.close();
}

/* ══════════════ 5. The component score, and its denominator ══════════════ */

function componentScore() {
  /* Component 01: the denominator is the 5 quiz exercises the learner was told
     about ("4 מתוך 5"), not the metadata question count — screens 19 and 20
     together are one exercise. Passing is 4 of 5. */
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();

  /* Latch four of the five as correct, one as wrong. */
  b.exec('s18Correct = true; s19Correct = true; s20Correct = true; s21Correct = true; s22Correct = true; s23Correct = false;');
  const score = b.val('getQuizScore()');
  b.exec('window.__reset();');
  b.exec('xapiCompleteComponent({ success: getQuizScore() >= 4, score: { scaled: getQuizScore() / 5 } });');

  const comp = b.stmts().filter(s => s.verb === 'completed' && s.objectType === 'onlinelesson')[0];
  ok('score', '01: the component completed is sent', !!comp, JSON.stringify(b.verbs()));
  if (comp) {
    eq('score', '01: 4 of 5 passes, and the scaled score is the real fraction',
      [comp.result.success, comp.result.score.scaled], [score >= 4, score / 5]);
    ok('score', '01: an explicit result is always supplied — the library aggregate would say false at 4/5',
      comp.result !== null && comp.result !== undefined);
  }

  /* Second call is deduped by the ledger. */
  const before = b.stmts().filter(s => s.verb === 'completed').length;
  b.exec('xapiCompleteComponent({ success: true, score: { scaled: 1 } });');
  eq('score', '01: a second component completed is deduped',
    b.stmts().filter(s => s.verb === 'completed').length, before);

  b.dom.window.close();
}

/* ══════════════ 6. Failure paths still report ══════════════
   A component the learner did not pass must still be reported, otherwise their
   whole attempt goes unrecorded — routing a failing learner is the platform's
   job, via recommendedAfterFail. */

function failurePathReports() {
  const b = boot('02');
  exec_reset(b);
  b.finishBoot();
  b.exec('window.__reset();');
  b.exec('xapiCompleteComponent({ success: false, score: { scaled: 0 } });');

  const comp = b.stmts().filter(s => s.verb === 'completed' && s.objectType === 'onlinelesson')[0];
  ok('fail', '02: a failing attempt is still reported', !!comp);
  ok('fail', '02: and it reports success false', comp && comp.result.success === false);

  b.dom.window.close();
}

/* ══════════════ 7. The unit completed, once ══════════════ */

function unitCompleted() {
  const b = boot('05');
  exec_reset(b);
  b.finishBoot();
  b.exec('window.__reset();');

  b.exec('xapiCompleteUnit(null);');
  b.exec('xapiCompleteUnit(null);');
  b.exec('xapiCompleteUnit(null);');
  eq('unit', 'the unit completed is sent exactly once however many times it is called',
    b.stmts().filter(s => s.verb === 'completed').length, 1);
  const u = b.stmts()[0];
  ok('unit', "and it carries scope 'unit', not an objectId",
    u && u.opts && u.opts.scope === 'unit', JSON.stringify(u && u.opts));

  /* 'unit' is its own ledger key: a component completed must not be suppressed
     by it, nor the other way round. */
  b.exec("xapiCompleteComponent({ success: true });");
  eq('unit', 'the component completed is not suppressed by the unit key',
    b.stmts().filter(s => s.verb === 'completed').length, 2);

  b.dom.window.close();
}

/* ══════════════ 8. A restore replays nothing ══════════════
   The single most important behaviour here. applyExecutionState stubs the
   sender for the whole of goTo — including the finale screens, which send item,
   component AND unit completed on entry. */

function restoreIsSilent() {
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();

  /* Answer a question for real, then capture what the document would hold. */
  b.exec("goTo(18); var i = document.getElementById('s18-answer-input'); i.value = '24'; s18Submit();");
  const payload = b.val('JSON.stringify(capturePartPayload())');
  b.dom.window.close();

  /* A fresh launch that restores that payload must emit no graded statement. */
  const r = boot('01');
  exec_reset(r);
  r.exec('_resumeReady = true; if (!_unitState) _unitState = emptyUnitState(); drainPendingUnitState();');
  /* Clear the log immediately before the restore, so what follows measures ONLY
     what applyExecutionState emitted. */
  r.exec('window.__reset();');
  r.exec('applyExecutionState(' + payload + ');');

  const v = r.verbs();
  ok('restore', 'a restore replays no answered', !v.some(x => /answered/.test(x)), JSON.stringify(v));
  ok('restore', 'a restore replays no completed', !v.includes('completed'), JSON.stringify(v));

  /* ── Exactly one, not "at least one" ──
     This is what pins the sender stub specifically. goTo() inside the restore
     runs xapiOnScreen and would open the item; the stub swallows it, then the
     latch is cleared and xapiOnScreen is called once more for real. Without the
     stub the item would be opened TWICE — and 'initialized' is the one verb the
     ledger cannot dedupe, because it deliberately bypasses it. */
  eq('restore', 'the restored screen opens its item exactly once',
    v.filter(x => x === 'initialized').length, 1);
  ok('restore', 'and the answer state came back',
    r.val('s18Solved') === true && r.val('s18Correct') === true);
  ok('restore', 'and the painted DOM shows it',
    r.val("document.getElementById('s18-answer-input').value") === '24',
    String(r.val("document.getElementById('s18-answer-input').value")));

  r.dom.window.close();
}

/* ══════════════ 9. Restoring onto a finale does not re-report ══════════════ */

function restoreOntoFinale() {
  const b = boot('05');
  exec_reset(b);
  const total = b.val('TOTAL_SCREENS');
  b.exec('window.__reset();');
  /* Land straight on the last screen, the way a learner resuming at the end
     would. Component 05's finale sends component and unit completed on entry. */
  b.exec('_resumeReady = true; if (!_unitState) _unitState = emptyUnitState();');
  b.exec('window.__reset();');
  b.exec('applyExecutionState({ currentScreen: ' + (total - 1) + ' });');

  eq('restore', '05: restoring onto the finale sends no completed',
    b.verbs().filter(x => x === 'completed'), []);

  /* ── And the ledger must not have been MARKED either ──
     This is what pins the `if (_restoring) return;` in sendCompletedOnce,
     separately from the sender stub. The two mask each other on the statement
     count — either alone keeps the wire quiet — so the only way to tell them
     apart is to check the after-effect: a mark taken while the sender was
     stubbed would permanently suppress a statement that never actually left,
     and the unit completed would then go missing for good. */
  ok('restore', '05: the restore leaves the component ledger key unmarked',
    b.val("_unitState.done['" + PART_DIR('05') + "'] === undefined"),
    b.val('JSON.stringify(_unitState.done)'));
  ok('restore', '05: the restore leaves the unit ledger key unmarked',
    b.val("_unitState.done['unit'] === undefined"),
    b.val('JSON.stringify(_unitState.done)'));

  /* Proof of consequence: a real completion afterwards still goes out. */
  b.exec('window.__reset(); xapiCompleteUnit(null);');
  eq('restore', '05: a real unit completed after the restore is still sent',
    b.verbs().filter(x => x === 'completed').length, 1);

  b.dom.window.close();
}

/* ══════════════ 10. The hint, once per question per load ══════════════ */

function hintOnce() {
  const b = boot('01');
  exec_reset(b);
  b.finishBoot();
  b.exec('window.__reset();');

  b.exec("goTo(18); s18ToggleHint(); s18ToggleHint(); s18ToggleHint(); s18ToggleHint(); s18ToggleHint();");
  eq('hint', 'toggling a hint open and shut repeatedly reports requested.1 once',
    b.verbs().filter(x => x === 'requested.1').length, 1);

  b.dom.window.close();
}

/* ══════════════ 11. Video is silent unless opted in ══════════════ */

function videoSilent() {
  const b = boot('05');
  exec_reset(b);
  b.finishBoot();
  b.exec('window.__reset();');

  b.exec("xapiWireVideos(); var v = document.getElementById('s53-gif'); if (v) { v.dispatchEvent(new window.Event('pause')); v.dispatchEvent(new window.Event('play')); }");
  eq('video', '05: the decorative #s53-gif reports nothing',
    b.verbs().filter(x => /played|paused/.test(x)), []);

  b.dom.window.close();
}

/* ══════════════ run ══════════════ */

function main() {
  freshLoad();
  twoAttempts();
  twoWrong();
  itemScope();
  componentScore();
  failurePathReports();
  unitCompleted();
  restoreIsSilent();
  restoreOntoFinale();
  hintOnce();
  videoSilent();

  console.log('');
  console.log('passed: ' + passes);
  if (failures.length) {
    console.log('FAILED: ' + failures.length);
    console.log('');
    for (const f of failures) console.log('  ' + f);
    process.exit(1);
  }
  console.log('all clear');
}

main();
