/* ═══════════════════ true/false questions report 'true' / 'false' ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   Guide Documentation/reporting-and-resume/ADDING-REPORTING-AND-RESUME.md §6.3b: Kata compares
   result.response with the question's correctXapiResponsesPattern, which for a true-false question
   is ["true"] or ["false"]. The live library turns student_answer into result.response, so a unit
   that sends the button label ("נכון" / "לא נכון", "صحيح" / "غير صحيح") can never be scored.

   For every metadata question of type true-false (01-006 q1 here), each option is picked through
   the real handler (s16Select + s16Submit) on a fresh boot with the local library stub, and the
   answered statement must carry 'true' or 'false', equal to the metadata's correct answer exactly
   when success is true. The correct answer may still be the on-screen word in this repo's metadata
   (Arabic twin), so words map to booleans.

   Run (same jsdom as the other suites):
     NODE_PATH=/tmp/lomda-test/node_modules node _test/true-false.js [BASE] */

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

/* The metadata's true/false questions, keyed '<part>:<item>/<qKey>', correct answer as 'true'/'false'. */
const TRUE_WORDS = ['true', 'נכון', 'صحيح'];
const TF = {};
for (const c of ['01', '02', '03', '04', '05']) {
  const m = JSON.parse(fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^﻿/, ''));
  for (const it of m.subContent || []) for (const q of it.questions || []) {
    if (q.questionType !== 'true-false') continue;
    const parts = q.questionId.replace(/\/+$/, '').split('/');
    TF[c + ':' + parts[parts.length - 2].slice(-3) + '/' + parts[parts.length - 1]] =
      TRUE_WORDS.indexOf(String(q.correctAnswers[0])) !== -1 ? 'true' : 'false';
  }
}

/* How each true/false question is answered through its real handler: pick option i, submit. */
const WALK = {
  '01:006/q1': { screen: 16, options: 2, pick: i => 's16Select(' + i + '); s16Submit();' },
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
  exec('window.METADATA = ' + fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^﻿/, '') + ';');
  exec('_resumeReady = true; _unitState = emptyUnitState(); sendStatement720("initialized", "onlinelesson"); xapiOnScreen(currentScreen);');
  const stmts = () => JSON.parse(val('JSON.stringify(window.__stmts())'));
  return { dom, exec, val, stmts, errors };
}

ok('metadata', 'every true/false question of the metadata has a walk',
  Object.keys(TF).length > 0 && Object.keys(TF).every(k => WALK[k]), Object.keys(TF).join(' ') || 'none');

for (const key of Object.keys(TF)) {
  const walk = WALK[key];
  if (!walk) continue;
  const c = key.split(':')[0];
  for (let i = 0; i < walk.options; i++) {
    const b = boot(c);
    b.exec('goTo(' + walk.screen + '); window.__reset();');
    b.exec(walk.pick(i));
    const tag = key + ' option ' + i;
    const hits = b.stmts().filter(s => /^answered/.test(s.verb) && s.opts && s.opts.questionId &&
      s.opts.questionId.replace(/\/+$/, '').split('/').slice(-2).join('/').replace(/^.*-(\d{3})\//, '$1/') === key.split(':')[1]);
    ok(tag, 'exactly one answered statement', hits.length === 1, String(hits.length));
    for (const s of hits) {
      const r = s.result || {};
      const sent = r.response != null ? String(r.response) : ((r.extensions && r.extensions.student_answer) || []).join(' | ');
      ok(tag, 'reports "true" / "false"', sent === 'true' || sent === 'false', JSON.stringify(sent));
      ok(tag, 'the value matches the correct answer exactly when success', (sent === TF[key]) === (r.success === true),
        'sent ' + sent + ', correct ' + TF[key] + ', success ' + r.success);
    }
    ok(tag, 'no console error', b.errors.length === 0, b.errors.slice(0, 2).join(' | '));
    b.dom.window.close();
  }
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
