/* ═══════════════════ answered result.response = Kata's correctXapiResponsesPattern ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   MOE runbook (10.11.26): a right answer must send exactly the string Kata keeps in the question's
   correctXapiResponsesPattern, character by character ('[,]' between choices / pairs, '[.]' between a
   step and its value). metadata/ carries Kata's patterns since 2026-11-11, so this suite reads them
   from there. For every metadata question with a pattern, the real handlers are driven on a fresh
   boot with the local library stub:
     - the right answer: one answered, success true, response === one of the pattern's entries;
     - a choice question: EVERY option — the response is one of the metadata answers, verbatim, and
       success is true exactly when it equals the pattern; a multi-select clicked in reverse order
       sends the same string;
     - no response contains ' | ', '->', an input / drop-target id or an invisible mark.
   Mutation check: with the 20-xapi.js and script.js files from before 2026-11-11 most of these fail.

   Run (same jsdom as the other suites):
     NODE_PATH=/tmp/lomda-test/node_modules node _test/responses.js [BASE] */

'use strict';

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE        = process.argv[2] || path.join(__dirname, '..');
const HARNESS_DIR = __dirname;
const UNIT        = fs.readdirSync(path.join(BASE, 'metadata')).find(f => /_unit\.json$/.test(f)).replace(/_unit\.json$/, '');
const PART_DIR    = c => UNIT + '-' + c;

const failures = [];
let passes = 0;
function ok(tag, what, cond, detail) {
  if (cond) { passes++; return; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
}

/* metadata questions with a pattern, keyed '<part>:<item>/<qKey>' */
const Q = {};
for (const c of ['01', '02', '03', '04', '05']) {
  const m = JSON.parse(fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^\uFEFF/, ''));
  for (const it of m.subContent || []) for (const q of it.questions || []) {
    if (!q.correctXapiResponsesPattern || !q.correctXapiResponsesPattern.length) continue;
    const parts = q.questionId.replace(/\/+$/, '').split('/');
    Q[c + ':' + parts[parts.length - 2].slice(-3) + '/' + parts[parts.length - 1]] = q;
  }
}

/* How each question is answered through its real handlers.
     right: page code that answers it right; choice: { select: i => code, submit } for every option;
     reverse: a multi-select's right answer clicked in reverse order. */
const typed = (id, v, submit) => `document.getElementById('${id}').value = ${JSON.stringify(v)}; ${submit}`;
const pick = (fn, n, map) => Array.from({ length: n }, (_, i) => `${fn}(${i + 1}, ${map}[${i + 1}], String(${map}[${i + 1}]));`).join(' ');
const WALK = {
  '01:003/q1': { screen: 4, enter: 's4VideoEnded = true; s4Enter();', choice: { select: i => `sqSelect(${i});`, submit: 'sqSubmit();' } },
  '01:004/q1': { screen: 3, choice: { select: i => `sqSelect(${i});`, submit: 'sqSubmit();' } },
  '01:003/q2': { screen: 4, enter: 's4VideoEnded = true; s4Enter();', right: 'SQ_Q2_CORRECT.forEach(function (v, i) { sqQ2Select(i, v); }); sqQ2Submit();' },
  '01:004/q2': { screen: 3, right: 'SQ_Q2_CORRECT.forEach(function (v, i) { sqQ2Select(i, v); }); sqQ2Submit();' },
  '01:006/q1': { screen: 16, choice: { select: i => `s16Select(${i});`, submit: 's16Submit();' } },
  '01:007/q1': { screen: 18, right: typed('s18-answer-input', '24', 's18Submit();') },
  '01:008/q1': { screen: 19, right: typed('s19-answer-input', '20', 's19Submit();') },
  '01:008/q2': { screen: 20, choice: { select: i => `s20Select(${i});`, submit: 's20Submit();' } },
  '01:009/q1': { screen: 21, right: typed('s21-answer-input', '25000:1', 's21Submit();'),
                 also: [typed('s21-answer-input', '1 : 25,000', 's21Submit();')] },
  '01:010/q1': { screen: 22, choice: { select: i => `s22Select(${i});`, submit: 's22Submit();' } },
  '01:011/q1': { screen: 23, choice: { select: i => `s23Select(${i});`, submit: 's23Submit();' } },
  '02:001/q1': { screen: 1, right: pick('s26Pick', 3, 'S26_CORRECT') + ' s26Submit();' },
  '02:002/q1': { screen: 2, right: pick('s27Pick', 2, 'S27_CORRECT') + ' s27Submit();' },
  '02:003/q1': { screen: 3, right: 'S28_CORRECT.forEach(function (i) { s28Select(i); }); s28Submit();',
                 reverse: 'S28_CORRECT.slice().reverse().forEach(function (i) { s28Select(i); }); s28Submit();' },
  '02:004/q1': { screen: 4, right: typed('s29-answer-input', '4', 's29Submit();') },
  '02:005/q1': { screen: 5, right: pick('s30Pick', 4, 'S30_CORRECT') + ' s30Submit();' },
  '02:006/q1': { screen: 7, right: typed('s32-answer-input', '25', 's32Submit();') },
  '02:007/q1': { screen: 8, choice: { select: i => `s33Select(${i});`, submit: 's33Submit();' } },
  '04:001/q1': { screen: 1, choice: { select: i => `s37Select(${i});`, submit: 's37Submit();' } },
  '04:002/q1': { screen: 2, choice: { select: i => `s38Select(${i});`, submit: 's38Submit();' } },
  '04:002/q2': { screen: 3, right: 'Object.keys(DDQ.correctMap).forEach(function (t) { ddqSelectChip(DDQ.correctMap[t]); ddqPlaceSelected(t); }); ddqCheck();' },
  '04:003/q1': { screen: 4, right: typed('s40-answer-input', '6', 's40Check();') },
  '04:003/q2': { screen: 5, choice: { select: i => `s41Select(${i});`, submit: 's41Submit();' } },
  '05:001/q1': { screen: 2, right: typed('s45-answer-input', '25000', 's45Check();') },
  '05:001/q2': { screen: 4, right: 'S47_CORRECT.forEach(function (i) { s47Toggle(i); }); s47Check();',
                 reverse: 'Array.from(S47_CORRECT).reverse().forEach(function (i) { s47Toggle(i); }); s47Check();' },
  '05:001/q3': { screen: 6, choice: { select: i => `s49Select(${i});`, submit: 's49Submit();' } },
  '05:001/q4': { screen: 8, choice: { select: i => `s51Select(${i});`, submit: 's51Submit();' } },
};

function boot(c) {
  const dir = path.join(BASE, PART_DIR(c));
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'http://localhost:8777/' + PART_DIR(c) + '/index.html?slxapi=1&registration=r1',
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
  const errors = [];
  w.console.error = (...a) => errors.push(a.join(' '));
  w.console.warn = w.console.log = () => {};
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  w.HTMLMediaElement.prototype.load  = function () {};
  w.HTMLMediaElement.prototype.play  = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  for (const src of [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (fs.existsSync(p)) { try { exec(fs.readFileSync(p, 'utf8')); } catch (e) { errors.push(src + ': ' + e.message); } }
  }
  exec(fs.readFileSync(path.join(HARNESS_DIR, 'xapi-720-k.js'), 'utf8'));
  exec('window.XAPI_USING_G = true; window.__reset();');
  exec('window.METADATA = ' + fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^\uFEFF/, '') + ';');
  exec('_resumeReady = true; _unitState = emptyUnitState(); sendStatement720("initialized", "onlinelesson"); xapiOnScreen(currentScreen);');
  const stmts = () => JSON.parse(val('JSON.stringify(window.__stmts())'));
  return { dom, exec, val, stmts, errors };
}

const shortKey = (qid) => qid.replace(/\/+$/, '').split('/').slice(-2).join('/').replace(/^.*-(\d{3})\//, '$1/');
const sentOf = (s) => { const r = s.result || {}; return r.response != null ? String(r.response) : ((r.extensions && r.extensions.student_answer) || []).join(' | '); };
const BAD = /\s\|\s|->|\b(?:drag|target|s\d+)-[\w-]+|[\u200B\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF]/;

/* answer once on a fresh boot; returns the answered statements of this question */
function run(key, code, tag) {
  const c = key.split(':')[0], w = WALK[key];
  const b = boot(c);
  b.exec('goTo(' + w.screen + ');');
  if (w.enter) b.exec(w.enter);   // the screen's own entry where goTo does not run it (video path: video ended)
  b.exec('window.__reset();');
  b.exec(code);
  const hits = b.stmts().filter(s => /^answered/.test(s.verb) && s.opts && s.opts.questionId && shortKey(s.opts.questionId) === key.split(':')[1]);
  ok(tag, 'no console error', b.errors.length === 0, b.errors.slice(0, 2).join(' | '));
  b.dom.window.close();
  return hits;
}

ok('walks', 'every metadata question with a pattern has a walk', Object.keys(Q).every(k => WALK[k]),
  Object.keys(Q).filter(k => !WALK[k]).join(' ') || '');

for (const key of Object.keys(Q)) {
  const q = Q[key], w = WALK[key], pat = q.correctXapiResponsesPattern;
  if (!w) continue;
  const checkRight = (code, tag) => {
    const hits = run(key, code, tag);
    ok(tag, 'exactly one answered', hits.length === 1, String(hits.length));
    for (const s of hits) {
      const sent = sentOf(s);
      ok(tag, 'success true', s.result && s.result.success === true, JSON.stringify(s.result && s.result.success));
      ok(tag, 'response is Kata\'s pattern', pat.indexOf(sent) !== -1, JSON.stringify(sent) + ' vs ' + JSON.stringify(pat[0]));
      ok(tag, 'no home-made separator / id / invisible mark', !BAD.test(sent), JSON.stringify(sent));
    }
  };
  if (w.right) checkRight(w.right, key + ' right');
  for (const [i, code] of (w.also || []).entries()) checkRight(code, key + ' right, other spelling ' + (i + 1));
  if (w.reverse) checkRight(w.reverse, key + ' right, reverse click order');
  if (w.choice) {
    const pool = q.questionType === 'true-false' ? ['true', 'false'] : q.answers;
    let rights = 0;
    const seen = {};
    for (let i = 0; i < pool.length; i++) {
      const tag = key + ' option ' + i;
      const hits = run(key, w.choice.select(i) + ' ' + w.choice.submit, tag);
      ok(tag, 'exactly one answered', hits.length === 1, String(hits.length));
      for (const s of hits) {
        const sent = sentOf(s);
        ok(tag, 'response is a metadata answer, verbatim', pool.indexOf(sent) !== -1, JSON.stringify(sent));
        ok(tag, 'success exactly when the response is Kata\'s pattern', (pat.indexOf(sent) !== -1) === (s.result && s.result.success === true),
          JSON.stringify(sent) + ' success ' + (s.result && s.result.success));
        ok(tag, 'no home-made separator / id / invisible mark', !BAD.test(sent), JSON.stringify(sent));
        ok(tag, 'each option its own response', !seen[sent], JSON.stringify(sent));
        seen[sent] = true;
        if (s.result && s.result.success === true) rights++;
      }
    }
    ok(key, 'exactly one option is right', rights === 1, String(rights));
  }
}

/* the retired string builders must not come back */
const layer = fs.readFileSync(path.join(BASE, 'unit-js', '20-xapi.js'), 'utf8');
ok('layer', 'no xapiZoneAnswer / xapiFieldsAnswer / xapiMultiAnswer', !/function\s+xapi(?:Zone|Fields|Multi)Answer\b/.test(layer));
for (const c of ['01', '02', '04', '05']) {
  const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
  ok('callsites ' + c, "no answer joined with ' | '", !/xapiAnswered\([^;]*join\(\s*' \| '\s*\)/.test(src));
}

console.log('');
console.log('passed: ' + passes);
if (failures.length) {
  console.log('FAILED: ' + failures.length);
  console.log('');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('all clear');
