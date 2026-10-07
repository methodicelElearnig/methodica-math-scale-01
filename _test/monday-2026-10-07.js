/* The three MOE monday items of 06.10, in real Chrome (puppeteer-core + local Chrome):
 *
 *   1. 02 — the stop after basic Q4 ("ענו נכון על 3 שאלות ומעלה (75%) כדי להתקדם"): through the real
 *      dropdowns, options, field and check buttons. Under 3 of 4 -> "שנמשיך?" on screen 5 ends the
 *      component (completed success:false once, button disabled) and stays ended after a restore;
 *      3 or 4 -> screen 6. Q4 is screens 4+5 and counts only when both are right.
 *   2. Number-only fields, in all five components: letters typed with real key events are dropped;
 *      the two ratio fields (01 s21, 03 s35) keep ":".
 *   3. The first screen's continue button sits on the left in every component (as on every other
 *      screen), with the first screen's "חזרה" hidden as in production.
 *
 *   NODE_PATH=/tmp/lomda-test/node_modules node _test/monday-2026-10-07.js [baseUrl]
 *
 * Without a base URL the repo is served locally. Exit 1 on any failure.
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
const BASE_ARG = process.argv[2];
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const P = 'methodica-math-scale-01-';

let pass = 0; const failures = [];
const ok = (scope, name, cond, detail) => { if (cond) pass++; else failures.push('  [' + scope + '] ' + name + (detail ? '\n      -> ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.webp': 'image/webp', '.gif': 'image/gif' };
const server = BASE_ARG ? null : http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

const RECORDER = () => {
  window.__log = [];
  window.sendStatement720 = function (verb, t, result, ctx) { window.__log.push({ verb: verb, id: (ctx && (ctx.objectId || ctx.questionId)) || null, result: result || null }); };
};

async function open(browser, url) {
  const ctx = await browser.createBrowserContext();   // own storage: the off-platform resume store
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle0' });
  await sleep(300);
  await page.evaluate(RECORDER);
  page.__ctx = ctx;
  return page;
}

/* Answer one basic screen of 02 (1..5) right or wrong (wrong = two different wrong answers). */
const ANSWER = async (n, right) => {
  const S = (t) => new Promise((r) => setTimeout(r, t));
  const sid = 's' + (25 + n);
  const scr = document.querySelector('[data-screen="' + n + '"]');
  const cont = document.getElementById(sid + '-continue');
  const check = async () => { cont.click(); await S(150); };
  const CORRECT = { 1: S26_CORRECT, 2: S27_CORRECT, 5: S30_CORRECT }[n];
  if (CORRECT) {
    const rows = {};
    scr.querySelectorAll('[onclick^="' + sid + 'Pick("]').forEach((b) => {
      const m = b.getAttribute('onclick').match(/Pick\((\d+),\s*'([^']*)'/);
      (rows[m[1]] = rows[m[1]] || []).push(m[2]);
    });
    const pick = (row, val) => window[sid + 'Pick'](+row, val, val);
    const attempt = (k) => Object.keys(rows).forEach((row) => {
      const vals = rows[row];
      if (right) return pick(row, CORRECT[row]);
      const wrong = vals.filter((v) => v !== CORRECT[row]);
      pick(row, wrong[k % wrong.length]);
    });
    attempt(0); await check();
    if (!right) { attempt(1); await check(); }
  } else if (n === 3) {
    const sel = (i) => s28Select(i);
    if (right) { S28_CORRECT.forEach(sel); await check(); }
    else { sel(2); await check(); sel(2); sel(0); sel(2); await check(); }
  } else if (n === 4) {
    const inp = document.getElementById('s29-answer-input');
    const put = (v) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    if (right) { put('4'); await check(); }
    else { put('7'); await check(); put('8'); await check(); }
  }
  return { solved: window[sid + 'Solved'], correct: window[sid + 'Correct'] };
};

(async () => {
  let base = BASE_ARG;
  if (!base) { await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  if (!base.endsWith('/')) base += '/';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    /* ── 1. the stop ── pattern letters: Q1, Q2, Q3, s29 (Q4 א), s30 (Q4 ב) */
    const CASES = [['WWWWW', 0], ['RRWWW', 2], ['RRWRW', 2], ['WRRRW', 2], ['RRRWR', 3], ['RRRRR', 4], ['WRRRR', 3]];
    for (const [pat, score] of CASES) {
      const scope = '02 ' + pat + ' (' + score + '/4)';
      const page = await open(browser, base + P + '02/index.html');
      await page.evaluate(() => goTo(1)); await sleep(200);
      for (let n = 1; n <= 5; n++) {
        const r = await page.evaluate(ANSWER, n, pat[n - 1] === 'R');
        ok(scope, 's' + n + ' answered as planned', r.solved && r.correct === (pat[n - 1] === 'R'), JSON.stringify(r));
        if (n < 5) { await page.evaluate((sid) => document.getElementById(sid + '-continue').click(), 's' + (25 + n)); await sleep(200); }
      }
      ok(scope, 'on screen 5', await page.evaluate(() => currentScreen) === 5);
      ok(scope, 'score as the code counts it', await page.evaluate(() => getBasicPracticeScore()) === score);
      await page.evaluate(() => document.getElementById('s30-continue').click()); await sleep(250);
      const st = await page.evaluate(() => ({ screen: currentScreen, dis: document.getElementById('s30-continue').disabled,
        done: window.__log.filter((s) => s.verb === 'completed' && !s.id) }));
      if (score < 3) {
        ok(scope, '"שנמשיך?" stays on screen 5', st.screen === 5, 'screen=' + st.screen);
        ok(scope, 'one completed, success:false', st.done.length === 1 && st.done[0].result.success === false, JSON.stringify(st.done));
        ok(scope, 'button disabled', st.dis === true);
        await page.evaluate(() => { const b = document.getElementById('s30-continue'); b.disabled = false; b.click(); }); await sleep(150);
        ok(scope, 'a second click sends nothing', await page.evaluate(() => window.__log.filter((s) => s.verb === 'completed' && !s.id).length) === 1);
        const payload = await page.evaluate(() => JSON.stringify(capturePartPayload()));
        const fresh = await open(browser, base + P + '02/index.html');
        await fresh.evaluate((s) => applyExecutionState(JSON.parse(s), 5), payload); await sleep(300);
        const f = await fresh.evaluate(() => ({ screen: currentScreen, dis: document.getElementById('s30-continue').disabled }));
        ok(scope, 'after a restore (no ledger): still on 5, disabled', f.screen === 5 && f.dis === true, JSON.stringify(f));
        await fresh.evaluate(() => { goTo(4); goTo(5); }); await sleep(200);
        ok(scope, 'restore + back and forward: still disabled', await fresh.evaluate(() => document.getElementById('s30-continue').disabled) === true);
        ok(scope, 'no page errors', page.__errors.length === 0 && fresh.__errors.length === 0, page.__errors.concat(fresh.__errors).join(' | '));
        await fresh.__ctx.close();
      } else {
        ok(scope, '"שנמשיך?" goes to screen 6', st.screen === 6, 'screen=' + st.screen);
        ok(scope, 'nothing completed', st.done.length === 0, JSON.stringify(st.done));
        ok(scope, 'no page errors', page.__errors.length === 0, page.__errors.join(' | '));
      }
      await page.__ctx.close();
    }

    /* ── 2. number-only fields, real key events ── */
    const FIELDS = [['01', 18, 's18-answer-input', 'a2b4', '24'], ['01', 19, 's19-answer-input', '2x0', '20'],
                    ['01', 21, 's21-answer-input', '1:25000z', '1:25000'], ['02', 4, 's29-answer-input', 'four4', '4'],
                    ['02', 7, 's32-answer-input', '2a5', '25'], ['03', 2, 's35-input', 'ק1:500', '1:500'],
                    ['04', 4, 's40-answer-input', 'e6', '6'], ['05', 2, 's45-answer-input', '25,000ש', '25,000']];
    for (const [c, n, id, typed, expect] of FIELDS) {
      const page = await open(browser, base + P + c + '/index.html');
      await page.evaluate((n) => goTo(n), n); await sleep(300);
      await page.focus('#' + id);
      await page.keyboard.type(typed, { delay: 20 });
      const v = await page.evaluate((id) => document.getElementById(id).value, id);
      ok(c + ' ' + id, 'typed "' + typed + '" -> "' + expect + '"', v === expect, 'got "' + v + '"');
      await page.__ctx.close();
    }

    /* ── 3. first screen's continue on the left ── */
    for (const c of ['01', '02', '03', '04', '05']) {
      const page = await open(browser, base + P + c + '/index.html');
      const r = await page.evaluate(() => {
        if (typeof hideCrossPartBack === 'function') hideCrossPartBack();   // production state (DEV_NAV off)
        const b = [...document.querySelectorAll('[data-screen="0"] .btn-continue')].find((x) => x.getClientRects().length);
        const back = document.querySelector('[data-screen="1"] .btn-continue');
        return { left: b && Math.round(b.getBoundingClientRect().left), right: b && Math.round(b.getBoundingClientRect().right) };
      });
      ok(c + ' s0', 'continue button on the left (x < 200)', r.left !== undefined && r.left < 200, JSON.stringify(r));
      await page.__ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  console.log(failures.length ? failures.join('\n') + '\n' : '');
  console.log(failures.length ? `=== monday 07.10: ${pass} passed, ${failures.length} failed ===` : `All ${pass} monday-2026-10-07 checks passed.`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); if (server) server.close(); process.exit(2); });
