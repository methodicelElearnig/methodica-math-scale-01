/* ═══════════════════ headless regression oracle ═══════════════════
   NOT DEPLOYED. Dev tooling only — exclude from any release package.

   This loads the REAL index.html, script.js and unit-js/*.js of all five
   components into jsdom, executes the script tags in document order from disk,
   and asserts against what actually ran. It does not call the code in
   isolation — it runs it.

   Ported from methodica-science-mass-measure-02/_test/verify-report.js, which
   is the older sibling of this unit's shared layer. Science-specific checks
   (the drag factory, stationProgress, the moed gates, its report-modal shape)
   are not carried; everything generic is, plus the checks this unit needs for
   the v4 upgrade — the boot cover, the loader gates, the id-mismatch gate and
   the reset hatch.

   Run (jsdom is not in the repo and there is no package.json — do NOT install
   it inside the project folder, which is OneDrive-synced):

     mkdir -p /tmp/lomda-test && cd /tmp/lomda-test && npm install jsdom
     NODE_PATH=/tmp/lomda-test/node_modules node _test/verify-report.js

   Exit 0 = everything passed. A base path may be passed as the first argument;
   without one the harness assumes its own parent directory.

   ⚠️ Real script tags put top-level `function`/`var` on window, which is what
   makes `val()` work. `let`/`const` bindings (TOTAL_SCREENS is `var`, but e.g.
   ddqPlacement is `let`) never reach window even in a real page, so those are
   read by executing an expression in page scope rather than off `window`. */

'use strict';

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE       = process.argv[2] || path.join(__dirname, '..');

/* BASE is the CONTENT under test and may be a deployment package. This harness's own
   files are not content: a package correctly contains no _test/, so resolving the stub
   from BASE made the one assertion below fail on every package run for a reason that
   was the exclusion working. The stub belongs to the harness, so it resolves from here. */
const HARNESS_DIR = __dirname;
const UNIT       = 'methodica-math-scale-01';
const COMPONENTS = ['01', '02', '03', '04', '05'];
const PART_DIR   = c => UNIT + '-' + c;

/* Screens a cross-part "back" is expected to land on. Mirrors the fallback
   arguments in each part's #back-to-prev-part onclick, and the return hash each
   forward router now writes. */
const INBOUND_HASH = { '01': 23, '02': 8, '03': 2, '04': 5 };

/* ── Two documented pre-existing gaps, allowlisted so the suite stays green ──
   Neither was introduced by the v4 upgrade and neither is in its scope; they are
   listed in docs-and-tools/REPORT-XAPI.md §9. They are encoded here rather than
   ignored so that the assertions still run against everything else, and so that
   closing a gap makes this list shrink rather than the suite stay quiet.

   1. PHANTOM SCREENS. Component 01 declares TOTAL_SCREENS = 24, but screens 5
      and 13 have no markup at all — goTo() rejects them via its null-screen
      guard. SCREEN_TO_SUBCONTENT therefore has 22 keys, not 24. The fix is to
      delete the dead s5 and s13 code and renumber, which is a content change.
   2. DEAD COMMITTING FUNCTIONS. Four functions latch a commitment flag and
      never flush, because they belong to screens that no longer exist (s5, s16
      q2, s42) and are unreachable. They are not resume bugs — they are dead
      code that has not been removed yet.
   Removing an entry here must make the corresponding assertion pass, not fail. */
const KNOWN_PHANTOM_SCREENS = { '01': [5, 13] };
const KNOWN_UNFLUSHED = new Set([
  '01/s5Submit', '01/s5Q2Submit',   // screen 5 has no markup
  '01/s16Q2Submit',                 // the second question of screen 16 was cut
  '04/s42Check',                    // screen 7 of a six-screen component
]);

/* Reveal-only flags are deliberately left on the debounce rather than flushed:
   nothing is graded, so the worst case is re-revealing one card after a reload.
   Same rule as the science unit's RESUME.md §6ג. */
const REVEAL_ONLY_FLAGS = /^(?:frcDone|s4VideoEnded)$/;

/* The ten shared-layer functions every component must have after the split. */
const SHARED_FNS = [
  'shortId', 'initReportModal', 'bootXAPI', 'goTo', 'xapiOnScreen',
  'sendCompletedOnce', 'itemLedgerKey', 'currentPartSlug',
  'readUnitState', 'captureUnitState', 'persistUnitState', 'emptyUnitState',
  'applyExecutionState', 'scheduleResumeSave', 'flushResumeSave',
  'initResumeLeaveHandlers', 'initResumeResetHatch', 'dropBootCover',
  'dropBootCoverWhenPainted', 'setImgSrc', 'preloadImages',
  'getUnitCharacter', 'setUnitCharacter', 'getUnitResult', 'setUnitResult',
  'adoptUnitCharacter', 'migrateState', 'drainPendingUnitState', 'recordForwardEdge',
  'previousPartHref', 'goBackToPreviousPart', 'writeForwardState',
  'resumeIsPainting', 'xapiAnswered', 'xapiRequestedHint',
  'xapiCompleteComponent', 'xapiEndComponent'
];

const failures = [];
let passes = 0;

function ok(tag, what, cond, detail) {
  if (cond) { passes++; return true; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
  return false;
}

function readJSON(p) {
  /* metadata files may carry a UTF-8 BOM; JSON.parse chokes on it. */
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
}

function makeRunner(w) {
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
  return { exec, val };
}

/* Build a component's DOM and run its real script tags from disk. */
function loadComponent(c, opts) {
  opts = opts || {};
  const dir  = path.join(BASE, PART_DIR(c));
  const file = path.join(dir, 'index.html');
  const consoleErrors = [];

  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: 'http://localhost:8777/' + PART_DIR(c) + '/index.html' + (opts.search || '') + (opts.hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const { exec, val } = makeRunner(w);

  w.console.error = (...a) => consoleErrors.push(a.join(' '));
  w.console.warn  = () => {};
  w.console.log   = () => {};
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

  /* jsdom does not implement HTMLMediaElement load/play/pause, and play()
     returns undefined — so `video.play().catch(...)` throws. Replace all three
     with the browser contract, to test the real code path rather than a jsdom
     gap. */
  w.HTMLMediaElement.prototype.load  = function () {};
  w.HTMLMediaElement.prototype.play  = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};

  const tags = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const src of tags) {
    /* Absolute URLs are third-party (component 01 loads the YouTube iframe API)
       and are never fetched in jsdom. Only local files are executed here. */
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (!fs.existsSync(p)) { consoleErrors.push('missing script ' + src); continue; }
    try { exec(fs.readFileSync(p, 'utf8')); }
    catch (e) { consoleErrors.push('threw in ' + src + ': ' + e.message); }
  }
  return { dom, w, exec, val, tags, dir, consoleErrors };
}

/* ══════════════ 1. Clean load, shared layer, regression gate ══════════════ */

function checkLoadAndSharedLayer() {
  for (const c of COMPONENTS) {
    const { dom, val, tags, consoleErrors } = loadComponent(c);

    ok('load', c + ' loads with no console errors',
      consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    for (const fn of SHARED_FNS) {
      ok('shared', c + ' defines ' + fn, val('typeof ' + fn) === 'function',
        String(val('typeof ' + fn)));
    }

    /* ── The regression gate ──
       With no ?slxapi the lomda must behave exactly as it did before reporting
       existed: the library never loads, so sendStatement720 does not exist,
       XAPI_USING_G is false, and every reporting entry point is an inert no-op
       that does not throw. */
    ok('gate', c + ': sendStatement720 absent without ?slxapi',
      val('typeof sendStatement720') === 'undefined');
    /* XAPI_USING_G is deliberately NOT asserted false here: bootXAPI derives it
       from the library filename synchronously, before the script is fetched, so
       it is true even when nothing ever loads. The invariant that actually
       protects the lomda is the one above and the three below — every reporting
       entry point is inert while sendStatement720 does not exist. The
       filename/regex agreement is checked separately in checkDeployContract. */
    ok('gate', c + ': xapiOnScreen is a no-op that does not throw',
      val('(function(){ try { xapiOnScreen(0); return "ok"; } catch (e) { return e.message; } })()') === 'ok');
    ok('gate', c + ': xapiAnswered does not throw without the library',
      val('(function(){ try { xapiAnswered("001","q1",true,true,"x"); return "ok"; } catch (e) { return e.message; } })()') === 'ok');
    ok('gate', c + ': xapiCompleteComponent does not throw without the library',
      val('(function(){ try { xapiCompleteComponent({success:true}); return "ok"; } catch (e) { return e.message; } })()') === 'ok');

    /* Script tag order: script.js before 90-boot.js, and 90-boot.js in its own
       tag — a top-level throw in script.js must not take the boot with it. */
    const iScript = tags.findIndex(t => /(^|\/)script\.js/.test(t));
    const iBoot   = tags.findIndex(t => /90-boot\.js/.test(t));
    ok('order', c + ': script.js precedes 90-boot.js', iScript > -1 && iBoot > iScript,
      tags.join(', '));

    dom.window.close();
  }
}

/* ══════════════ 2. The boot cover ══════════════ */

function checkBootCover() {
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');

    ok('cover', c + ': #boot-cover exists in the markup',
      /id="boot-cover"/.test(html));
    ok('cover', c + ': the cover is inline-styled, so a stale CSS cache cannot hide it',
      /id="boot-cover"[^>]*style="[^"]*position:fixed/.test(html));

    /* A SIBLING of #app, not a child: #app carries scaleApp's transform, and a
       child would inherit it and stop covering the viewport. */
    const iCover = html.indexOf('id="boot-cover"');
    const iApp   = html.indexOf('id="app"');
    ok('cover', c + ': the cover precedes #app and is not inside it',
      iCover > -1 && iApp > -1 && iCover < iApp);

    ok('cover', c + ': the markup safety net is present and honours __resumeInFlight',
      /__resumeInFlight/.test(html) && /setTimeout\(tick, 800\)/.test(html));

    /* And it must actually be gone after a normal boot. */
    const { dom, w, exec } = loadComponent(c);
    exec('dropBootCover();');
    ok('cover', c + ': dropBootCover removes it',
      !w.document.getElementById('boot-cover'));
    ok('cover', c + ': dropBootCover is idempotent',
      (() => { try { exec('dropBootCover();'); return true; } catch (e) { return false; } })());
    dom.window.close();
  }
}

/* ══════════════ 3. Ids match metadata byte for byte ══════════════ */

function checkIds() {
  const unit = readJSON(path.join(BASE, 'metadata', UNIT + '_unit.json'));

  for (const c of COMPONENTS) {
    const { dom, val } = loadComponent(c);
    const meta = readJSON(path.join(BASE, 'metadata', PART_DIR(c) + '.json'));

    const compId = val('typeof XAPI_COMP_ID !== "undefined" ? XAPI_COMP_ID : null');
    ok('ids', c + ': XAPI_COMP_ID equals metadata id exactly',
      compId === meta.id, compId + ' vs ' + meta.id);

    const unitId = val('window.XAPI_UNIT_ID');
    ok('ids', c + ': XAPI_UNIT_ID equals the unit metadata id exactly',
      unitId === unit.id, unitId + ' vs ' + unit.id);

    /* Every item this component reports must resolve to a real subContent id. */
    const map = val('JSON.stringify(typeof SCREEN_TO_SUBCONTENT !== "undefined" ? SCREEN_TO_SUBCONTENT : {})');
    const suffixes = new Set(Object.values(JSON.parse(map)).filter(Boolean).map(v => v[0]).filter(Boolean));
    const known = new Set((meta.subContent || []).map(s => String(s.id).replace(/\/+$/, '').split('-').pop()));
    for (const s of suffixes) {
      ok('ids', c + ': item ' + s + ' exists in metadata', known.has(s),
        'metadata has ' + [...known].join(', '));
    }

    dom.window.close();
  }
}

/* ══════════════ 4. SCREEN_TO_SUBCONTENT completeness ══════════════ */

function checkScreenMap() {
  for (const c of COMPONENTS) {
    const { dom, val } = loadComponent(c);
    const total   = val('TOTAL_SCREENS');
    const phantom = KNOWN_PHANTOM_SCREENS[c] || [];
    const real    = total - phantom.length;
    const map     = JSON.parse(val('JSON.stringify(typeof SCREEN_TO_SUBCONTENT !== "undefined" ? SCREEN_TO_SUBCONTENT : {})'));
    const keys    = Object.keys(map).map(Number).sort((a, b) => a - b);

    ok('map', c + ': SCREEN_TO_SUBCONTENT has one entry per real screen',
      keys.length === real, keys.length + ' keys vs ' + real +
      ' real screens (TOTAL_SCREENS ' + total + ' minus phantom ' + phantom.join(',') + ')');

    const holes = [];
    for (let i = 0; i < total; i++) if (!(i in map) && !phantom.includes(i)) holes.push(i);
    ok('map', c + ': the map covers every real screen with no holes',
      holes.length === 0, 'missing ' + holes.join(', '));

    /* A screen the map names but the markup does not have makes goTo() return
       early and leaves currentScreen stale — which is exactly what the phantom
       screens do, and why they are allowlisted rather than ignored. */
    const inDom = dom.window.document.querySelectorAll('.screen').length;
    ok('map', c + ': .screen count in the DOM equals the real screen count',
      inDom === real, inDom + ' vs ' + real);

    ok('map', c + ': every allowlisted phantom screen really is absent',
      phantom.every(i => !dom.window.document.querySelector('[data-screen="' + i + '"]')),
      'phantom ' + phantom.join(',') + ' — if one now exists, remove it from KNOWN_PHANTOM_SCREENS');

    dom.window.close();
  }
}

/* ══════════════ 5. Navigation sweep and #screen=N landing ══════════════ */

function checkNavigation() {
  for (const c of COMPONENTS) {
    const { dom, val, exec } = loadComponent(c);
    const total   = val('TOTAL_SCREENS');
    const phantom = KNOWN_PHANTOM_SCREENS[c] || [];
    let bad = [];
    for (let i = 0; i < total; i++) {
      if (phantom.includes(i)) continue;
      exec('goTo(' + i + ');');
      if (val('currentScreen') !== i) bad.push(i);
    }
    ok('nav', c + ': goTo() reaches every real screen and currentScreen tracks',
      bad.length === 0, 'stuck at ' + bad.join(', '));

    /* The null-screen guard: a phantom must be rejected BEFORE currentScreen is
       written, so a rejected navigation leaves no inconsistent state behind. */
    for (const p of phantom) {
      exec('goTo(0); goTo(' + p + ');');
      ok('nav', c + ': goTo(' + p + ') (phantom) is rejected without moving currentScreen',
        val('currentScreen') === 0, String(val('currentScreen')));
    }

    /* Out of range must be rejected without moving currentScreen. */
    exec('goTo(0); goTo(' + (total + 5) + ');');
    ok('nav', c + ': goTo() rejects out-of-range without moving currentScreen',
      val('currentScreen') === 0, String(val('currentScreen')));

    dom.window.close();
  }

  /* Landing on '#screen=N' — the screen a cross-part "back" returns to. The
     hash selects the screen; §8.4b of the port guide is that it must NOT cancel
     the restore, which checkResumeHashOverride below covers. */
  for (const c of Object.keys(INBOUND_HASH)) {
    const n = INBOUND_HASH[c];
    const { dom, val, exec } = loadComponent(c, { hash: '#screen=' + n });
    exec('applyExecutionState({ currentScreen: 0 }, ' + n + ');');
    ok('hash', c + ': #screen=' + n + ' lands on screen ' + n,
      val('currentScreen') === n, 'landed on ' + val('currentScreen'));
    dom.window.close();
  }
}

/* ══════════════ 6. The hash is an override, not a veto ══════════════
   Until this was fixed upstream, a '#screen=N' in the URL made the loader skip
   applyExecutionState entirely — so arriving via cross-part "back" lost the
   whole restore, including the score map the forward routing is derived from,
   and a learner who had met the threshold was sent into remediation. */

function checkResumeHashOverride() {
  const c = '01';
  const { dom, val, exec } = loadComponent(c, { hash: '#screen=23' });
  exec('XAPI_Q_RESULTS = {};');
  exec("applyExecutionState({ currentScreen: 18, qResults: { '005/q1': true, '006/q1': true } }, 23);");
  ok('hash', c + ': the hash chooses the screen',
    val('currentScreen') === 23, String(val('currentScreen')));
  ok('hash', c + ': the hash does NOT cancel the state restore',
    val("XAPI_Q_RESULTS['005/q1']") === true && val("XAPI_Q_RESULTS['006/q1']") === true,
    val('JSON.stringify(XAPI_Q_RESULTS)'));

  /* An out-of-range hash (a part that got shorter) falls back to the document
     rather than landing nowhere. */
  exec('applyExecutionState({ currentScreen: 7 }, 999);');
  ok('hash', c + ': an out-of-range hash falls back to the stored screen',
    val('currentScreen') === 7, String(val('currentScreen')));
  dom.window.close();
}

/* ══════════════ 7. The state document and the ledger ══════════════ */

function checkStateDocument() {
  const c = '01';
  const { dom, val, exec } = loadComponent(c);

  exec('_resumeReady = true; _unitState = emptyUnitState();');

  ok('state', 'emptyUnitState is v5', val('emptyUnitState().v') === 5);
  ok('state', 'emptyUnitState carries ui.character',
    val('JSON.stringify(emptyUnitState().ui)') === '{"character":null}');
  ok('state', 'emptyUnitState carries results',
    val('JSON.stringify(emptyUnitState().results)') === '{}');

  ok('state', 'currentPartSlug returns this part',
    val('currentPartSlug()') === PART_DIR(c), String(val('currentPartSlug()')));

  /* ── The slug-case invariant, tested against a capitalised URL ──
     currentPartSlug derives from location.pathname, i.e. from how the learner
     ARRIVED. A URL differing only in case would not match the document's
     `component` and would key the ledger differently — vanished progress, a
     `done` ledger that misses, and therefore a duplicate 'completed'.
     This has to be driven through a capitalised URL: asserting against the
     normal lowercase one passes whether or not toLowerCase() is there at all,
     which is exactly the weak assertion this replaced. */
  const shouty = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost:8777/Methodica-Math-Scale-01-01/index.html',
    runScripts: 'dangerously',
  });
  const sr = makeRunner(shouty.window);
  sr.exec(fs.readFileSync(path.join(BASE, 'unit-js', '40-resume.js'), 'utf8'));
  ok('state', 'currentPartSlug lowercases a capitalised URL',
    sr.val('currentPartSlug()') === PART_DIR('01'),
    String(sr.val('currentPartSlug()')));
  shouty.window.close();

  /* ── The ledger's three orderings ── */
  exec('window.__sent = []; window.sendStatement720 = function (v, o, r, x) { window.__sent.push(v); };');

  exec("sendCompletedOnce('done', 'k1', 'onlinelesson', null);");
  ok('ledger', 'fails open: sends the first time', val('window.__sent.length') === 1);

  exec("sendCompletedOnce('done', 'k1', 'onlinelesson', null);");
  ok('ledger', 'dedupes the second time', val('window.__sent.length') === 1);

  exec("sendCompletedOnce('done', 'k2', 'onlinelesson', null);");
  ok('ledger', 'a different key still sends', val('window.__sent.length') === 2);

  ok('ledger', 'the mark is written into the state document',
    val('_unitState.done.k1') === true && val('_unitState.done.k2') === true);

  /* During a restore: neither send NOR mark. A mark taken while the sender is
     stubbed would permanently suppress a statement that never left. */
  exec("_restoring = true; sendCompletedOnce('done', 'k3', 'onlinelesson', null); _restoring = false;");
  ok('ledger', 'restoring suppresses the send', val('window.__sent.length') === 2);
  ok('ledger', 'restoring does NOT mark the ledger',
    val('_unitState.done.k3') === undefined);

  dom.window.close();
}

/* ══════════════ 8. Unit-level state: character and results ══════════════ */

function checkUnitLevelState() {
  const { dom, val, exec } = loadComponent('01');

  /* Before _resumeReady, a choice must be QUEUED — not lost. The character
     picker is screen 0 and the document is two CDN scripts away. */
  exec('_resumeReady = false; _unitState = null; _pendingProfile = null;');
  exec("setUnitCharacter('video');");
  ok('unit', 'a choice made before the document arrives is queued',
    val('JSON.stringify(_pendingProfile)') === '{"character":"video"}');
  ok('unit', 'and is applied to memory immediately',
    val('window.lomdaState.selectedCharacter') === 'video');

  /* Draining must beat the document: this session's choice is newer. */
  exec("_resumeReady = true; _unitState = emptyUnitState(); _unitState.ui.character = 'text';");
  exec('drainPendingUnitState();');
  ok('unit', 'the queued choice wins over what the document held',
    val('_unitState.ui.character') === 'video', String(val('_unitState.ui.character')));

  /* Read precedence: the document wins when ui EXISTS, even holding null —
     otherwise ?resetState is not a reset. */
  exec("_unitState = emptyUnitState(); window.localStorage.setItem('lomdaCharacter', 'stale');");
  ok('unit', 'a reset document (ui.character null) beats a stale cache',
    val('getUnitCharacter()') === null, String(val('getUnitCharacter()')));

  exec('_unitState = null;');
  ok('unit', 'with no document at all the cache is used',
    val('getUnitCharacter()') === 'stale', String(val('getUnitCharacter()')));

  /* adoptUnitCharacter reports whether it changed anything, and must not write to the store. */
  exec("_unitState = emptyUnitState(); _unitState.ui.character = 'text'; window.lomdaState.selectedCharacter = 'video';");
  ok('unit', 'adoptUnitCharacter returns true when it changes the character',
    val('adoptUnitCharacter(_unitState)') === true);
  ok('unit', 'and applies it', val('window.lomdaState.selectedCharacter') === 'text');
  ok('unit', 'adoptUnitCharacter returns false when nothing changes',
    val('adoptUnitCharacter(_unitState)') === false);

  dom.window.close();
}

/* ══════════════ 8b. One document per component (v5, 2026-09-16) ══════════════
   Kata's registration is per {learner, component} and the platform may clear one component's
   document on a re-take. The document is flat — `component` + `payload` — migrated from v4 in
   place, never applied when it names another part, and the character travels 01 → 02..05 through
   the same-browser mirror only. Groups: shape / isolation / retake / character. The store below is
   keyed by registration + state id, exactly as two Kata launches would be. */
function checkPerComponentState() {
  const stores = {};
  const warns = [];
  const bootS = (c, search) => {
    const r = loadComponent(c, { search });
    const w = r.dom.window;
    w.console.warn = (m) => warns.push(String(m));
    const reg = new URL(w.location.href).searchParams.get('registration') || '';
    const key = (id) => reg + '::' + id;
    w.loadState720 = function (id) { const k = key(id); return stores[k] ? JSON.parse(stores[k]) : null; };
    w.saveState720 = function (id, doc) { stores[key(id)] = JSON.stringify(doc); return true; };
    w.saveState720Debounced = w.saveState720;
    w.__stmts2 = [];
    w.sendStatement720 = function (v, t, res, o) { w.__stmts2.push({ v, t, res, o }); };
    const seed = (doc) => { stores[key(r.val('RESUME_STATE_ID'))] = JSON.stringify(doc); };
    const stored = () => { const s = stores[key(r.val('RESUME_STATE_ID'))]; return s ? JSON.parse(s) : null; };
    return { ...r, w, seed, stored, slug: PART_DIR(c), close: () => r.dom.window.close() };
  };
  const q = (r, extra) => '?slxapi=1&registration=' + r + (extra || '');

  // ── shape ──
  let b = bootS('01', q('r1'));
  ok('shape', 'emptyUnitState() has exactly the v5 fields',
    b.val('Object.keys(emptyUnitState()).sort().join()') === 'component,done,doneItems,hints,payload,picks,results,ui,v',
    String(b.val('Object.keys(emptyUnitState()).sort().join()')));
  ok('shape', 'a fresh document names this part', b.val('emptyUnitState().component') === b.slug);
  ok('shape', 'RESUME_STATE_ID carries the part slug',
    b.val('RESUME_STATE_ID') === 'execution-state::' + b.slug, String(b.val('RESUME_STATE_ID')));
  b.seed({ v: 4, part: 'x', parts: { [b.slug]: { currentScreen: 3 }, other: { currentScreen: 9 } }, prev: { a: 1 },
           done: { a: true }, doneItems: { b: true }, hints: { h: true }, picks: { p: true }, ui: { character: 'text' }, results: { k: 'pass' } });
  b.exec('readUnitState();');
  ok('shape', 'v4 → v5 migration keeps this part\'s slot as payload',
    b.val('_unitState.v') === 5 && b.val('_unitState.component') === b.slug && b.val('_unitState.payload.currentScreen') === 3,
    String(b.val('JSON.stringify(_unitState)')));
  ok('shape', 'v4 → v5 migration keeps the four ledgers, the character and the results',
    b.val('_unitState.done.a') === true && b.val('_unitState.doneItems.b') === true && b.val('_unitState.hints.h') === true &&
    b.val('_unitState.picks.p') === true && b.val('_unitState.ui.character') === 'text' && b.val('_unitState.results.k') === 'pass',
    String(b.val('JSON.stringify(_unitState)')));
  ok('shape', 'v4 → v5 migration drops part, prev and parts',
    b.val("'part' in _unitState") === false && b.val("'prev' in _unitState") === false && b.val("'parts' in _unitState") === false);
  b.seed({ v: 4, part: 'x', parts: { other: { currentScreen: 9 } } });
  b.exec('readUnitState();');
  ok('shape', 'a v4 document with no slot for this part migrates to payload:null',
    b.val('_unitState.payload') === null && b.val('_unitState.v') === 5);
  b.seed({ v: 3, parts: { [b.slug]: { currentScreen: 3 } } });
  b.exec('readUnitState();');
  ok('shape', 'any other version is discarded', b.val('_unitState.payload') === null && b.val('_unitState.v') === 5);
  warns.length = 0;
  b.seed({ v: 5, component: 'other-slug', payload: { currentScreen: 7 }, done: { z: true } });
  b.exec('readUnitState();');
  ok('shape', 'a document that names another part is discarded…',
    b.val('_unitState.payload') === null && b.val('_unitState.component') === b.slug && b.val('Object.keys(_unitState.done).length') === 0);
  ok('shape', '…with a console.warn naming both parts',
    warns.some(m => /\[resume\] document belongs to "other-slug", not "/.test(m)), JSON.stringify(warns));
  b.exec('_resumeReady = true; readUnitState(); goTo(2);');
  ok('shape', 'captureUnitState().payload is capturePartPayload()',
    b.val('JSON.stringify(captureUnitState().payload) === JSON.stringify(capturePartPayload())') === true);
  b.close();

  // ── isolation ──
  const A = bootS('01', q('r1')), B = bootS('03', q('r2'));
  A.exec('_resumeReady = true; readUnitState(); goTo(3); flushResumeSave(); markSent("done", currentPartSlug());');
  B.exec('readUnitState();');
  ok('isolation', 'part B under its own registration sees an empty document',
    B.val('_unitState.payload') === null && B.val('Object.keys(_unitState.done).length') === 0);
  ok('isolation', 'part A\'s stored document never mentions part B',
    JSON.stringify(A.stored()).indexOf(B.slug) === -1 && A.stored().component === A.slug && A.stored().done[A.slug] === true,
    JSON.stringify(A.stored()));
  ok('isolation', 'only registrations that wrote have a document',
    Object.keys(stores).filter(k => k.indexOf('r2::') === 0).length === 0, Object.keys(stores).join());
  warns.length = 0;
  B.seed(A.stored());
  B.exec('readUnitState();');
  ok('isolation', 'another part\'s document under my registration is discarded, not applied',
    B.val('_unitState.payload') === null && warns.some(m => /document belongs to "/.test(m)));
  A.close(); B.close();

  // ── retake: Kata cleared the document; the same-browser mirror still holds the last attempt ──
  b = bootS('05', q('r5'));
  b.exec("localStorage.setItem('lomdaCharacter', 'Character2'); window.lomdaState.selectedCharacter = null;");
  b.exec('readUnitState(); window.__changed = adoptUnitCharacter(_unitState);');
  ok('retake', 'an absent document leaves every verdict null', b.val("getUnitResult('anything')") === null);
  ok('retake', 'the ledger is empty again, so the re-take will report completed',
    b.val("alreadySent('done', currentPartSlug())") === false);
  b.exec("_resumeReady = true; sendCompletedOnce('done', currentPartSlug(), 'onlinelesson', null);");
  ok('retake', 'the re-take\'s completed goes out', b.w.__stmts2.filter(s => s.v === 'completed').length === 1);
  ok('retake', 'nothing is restored', b.val('_unitState.payload === null || _unitState.payload.currentScreen === 0') === true);
  ok('retake', 'the character IS adopted from the mirror (decision 2026-09-16)',
    b.val('window.lomdaState.selectedCharacter') === 'Character2' && b.val('_unitState.ui.character') === 'Character2' && b.w.__changed === true);
  b.close();

  // ── character: four steps, both stores ──
  b = bootS('01', q('r1'));
  b.exec("_resumeReady = true; readUnitState(); setUnitCharacter('Character2');");
  ok('character', '01: the choice lands in the mirror AND in this part\'s document',
    b.val("localStorage.getItem('lomdaCharacter')") === 'Character2' && b.val('_unitState.ui.character') === 'Character2' &&
    b.stored() && b.stored().ui.character === 'Character2', JSON.stringify(b.stored()));
  b.close();
  b = bootS('03', q('r3'));
  b.seed({ v: 5, component: b.slug, ui: { character: 'text' } });
  b.exec("localStorage.setItem('lomdaCharacter', 'Character2'); readUnitState(); adoptUnitCharacter(_unitState);");
  ok('character', '03 step 1: the document wins over the mirror, and the mirror follows',
    b.val('window.lomdaState.selectedCharacter') === 'text' && b.val("localStorage.getItem('lomdaCharacter')") === 'text');
  b.close();
  b = bootS('03', q('r3b'));
  b.exec("localStorage.setItem('lomdaCharacter', 'Character2'); window.lomdaState.selectedCharacter = null; readUnitState(); window.__changed = adoptUnitCharacter(_unitState);");
  ok('character', '03 steps 2+3: an empty document adopts the mirror into memory and into the document',
    b.val('window.lomdaState.selectedCharacter') === 'Character2' && b.val('_unitState.ui.character') === 'Character2' &&
    b.val('getUnitCharacter()') === 'Character2' && b.w.__changed === true);
  ok('character', '03 step 3: the mirror is NOT deleted (the old applyUnitProfile did)',
    b.val("localStorage.getItem('lomdaCharacter')") === 'Character2');
  ok('character', '03 step 3: nothing is written before phase B…', b.stored() === null);
  b.exec('_resumeReady = true; drainPendingUnitState();');
  ok('character', '…and phase B persists the adopted character into this part\'s document',
    b.stored() && b.stored().ui.character === 'Character2' && b.stored().component === b.slug, JSON.stringify(b.stored()));
  b.close();
  b = bootS('03', q('r3c'));
  b.exec("readUnitState(); adoptUnitCharacter(_unitState);");
  ok('character', '03 step 4: no document, no mirror → null, default stays',
    b.val('getUnitCharacter()') === null && b.val("localStorage.getItem('lomdaCharacter')") === null);
  b.close();
  b = bootS('03', q('r3d', '&resetState'));
  ok('character', '?resetState: the hatch ran at boot and cleared the mirror',
    b.val('_resetRequested') === true && b.val("localStorage.getItem('lomdaCharacter')") === null);
  b.exec("localStorage.setItem('lomdaCharacter', 'Character2'); readUnitState(); adoptUnitCharacter(_unitState);");
  ok('character', '?resetState: a mirror that reappears is NOT adopted — a reset adopts nothing',
    b.val('getUnitCharacter()') === null && b.val('window.lomdaState.selectedCharacter') === null);
  b.close();
}

/* ── Source scan for the v5 shape ── */
function checkStateShapeSource() {
  const files = fs.readdirSync(path.join(BASE, 'unit-js')).filter(n => /\.js$/.test(n)).map(n => 'unit-js/' + n)
    .concat(COMPONENTS.map(c => PART_DIR(c) + '/script.js'));
  for (const rel of files) {
    const src = stripComments(fs.readFileSync(path.join(BASE, rel), 'utf8'));
    ok('shape', rel + ': no landing pointer, no prev map, no parts map',
      !/\.prev\b/.test(src) && !/(?<!old)\.parts\[/.test(src) && !/\b(doc|_unitState|_saved|st)\.part\b/.test(src));
    ok('shape', rel + ': applyUnitProfile is gone', !/applyUnitProfile/.test(src));
  }
  const rs = stripComments(fs.readFileSync(path.join(BASE, 'unit-js/40-resume.js'), 'utf8'));
  ok('shape', '40-resume.js: RESUME_STATE_VERSION is 5', /var RESUME_STATE_VERSION = 5;/.test(rs));
  ok('shape', '40-resume.js: RESUME_STATE_ID is per part',
    /var RESUME_STATE_ID\s*=\s*'execution-state::' \+ currentPartSlug\(\);/.test(rs));
  ok('shape', '40-resume.js: readUnitState migrates, then refuses another part\'s document with a warning',
    /doc = migrateState\(doc\);[\s\S]{0,200}doc\.component !== currentPartSlug\(\)[\s\S]{0,200}console\.warn\(/.test(rs));
  const adopt = /function adoptUnitCharacter\(doc\)\s*\{[\s\S]*?\n\}/.exec(rs);
  ok('shape', '40-resume.js: adoptUnitCharacter never deletes the mirror',
    !!adopt && !/_lsDel/.test(adopt[0]) && /_lsGet\(UI_CHARACTER_KEY\)/.test(adopt[0]) && /_pendingProfile = \{ character: c \}/.test(adopt[0]));
  const ld = stripComments(fs.readFileSync(path.join(BASE, 'unit-js/50-loader.js'), 'utf8'));
  ok('shape', '50-loader.js: phase A restores payload and adopts the character',
    /_payload = _saved\.payload;/.test(ld) && /adoptUnitCharacter\(_saved\)/.test(ld));
}

/* ══════════════ 9. Cross-part back edges ══════════════ */

function checkBackEdges() {
  /* Part 03 is reachable from 02 (normal) and from 01 (the >=4/5 skip). A
     hard-coded back button sends the skipper into content they never saw.
     Since 2026-09-16 the whole edge machinery is DEV-ONLY (the platform owns
     routing — checkPlatformRouting below asserts the production side), so this
     group boots with ?dev=1 to reach it. */
  const { dom, val, exec } = loadComponent('03', { search: '?dev=1' });
  ok('edges', 'the group runs under DEV_NAV', val('DEV_NAV') === true);
  const NAV_KEY = 'lomda_nav_edges::' + UNIT;

  exec('_resumeReady = true; _unitState = emptyUnitState();');
  exec("window.sessionStorage.removeItem('" + NAV_KEY + "');");

  /* Layer 3: no edge anywhere -> the hard-coded fallback. */
  ok('edges', 'with no edge, previousPartHref uses the fallback',
    /methodica-math-scale-01-02\/index\.html.*#screen=8$/.test(
      val("previousPartHref('" + UNIT + "-02', '#screen=8')")),
    String(val("previousPartHref('" + UNIT + "-02', '#screen=8')")));

  /* Layer 2: a sessionStorage edge, readable synchronously before the document
     arrives — the window in which the back button is already clickable. */
  exec("window.sessionStorage.setItem('" + NAV_KEY + "', JSON.stringify({ '" + UNIT + "-03': { from: '" + UNIT + "-01', hash: '#screen=23' } }));");
  ok('edges', 'a sessionStorage edge beats the fallback',
    /methodica-math-scale-01-01\/index\.html.*#screen=23$/.test(
      val("previousPartHref('" + UNIT + "-02', '#screen=8')")),
    String(val("previousPartHref('" + UNIT + "-02', '#screen=8')")));

  /* v5: no document tier — the edge map is the only layer above the fallback. writeForwardState
     records the edge itself and saves THIS part synchronously; there is no landing pointer, no
     prev map and no seeding of the destination (its document is another part's). */
  exec("window.sessionStorage.removeItem('" + NAV_KEY + "');");
  exec("window.__saves = 0; window.__lastDoc = null; window.saveState720 = function (id, doc) { window.__saves++; window.__lastDoc = JSON.stringify(doc); window.__lastId = id; return true; };");
  exec("writeForwardState('" + UNIT + "-04', '#screen=2');");
  ok('edges', 'writeForwardState records the sessionStorage edge',
    val("JSON.parse(window.sessionStorage.getItem('" + NAV_KEY + "'))['" + UNIT + "-04'].from") === UNIT + '-03');
  ok('edges', 'writeForwardState saves this part synchronously, once',
    val('window.__saves') === 1 && val('window.__lastId') === 'execution-state::' + UNIT + '-03',
    'saves=' + val('window.__saves') + ' id=' + val('window.__lastId'));
  ok('edges', 'the saved document is this part\'s, with no landing pointer / prev / parts (v5)',
    val("(function(){ var d = JSON.parse(window.__lastDoc); return d.component === '" + UNIT + "-03' && !('part' in d) && !('prev' in d) && !('parts' in d) && ('payload' in d); })()") === true,
    String(val('Object.keys(JSON.parse(window.__lastDoc)).join()')));

  /* v5: dev back navigation saves this part once and navigates (jsdom reports the navigation as
     not implemented). There is no pointer write that could fail any more. */
  exec("window.__saves = 0; goBackToPreviousPart('" + UNIT + "-02', '#screen=8');");
  ok('edges', 'dev back navigation saves this part synchronously first',
    val('window.__saves') === 1 && val("JSON.parse(window.__lastDoc).component") === UNIT + '-03',
    'saves=' + val('window.__saves'));

  dom.window.close();

  /* Every back button must be wired to goBackToPreviousPart with a fallback —
     it still is, for the dev walkthrough; production hides it (checkPlatformRouting). */
  for (const c of ['02', '03', '04', '05']) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    const m = html.match(/id="back-to-prev-part"[^>]*onclick="goBackToPreviousPart\('([^']+)',\s*'([^']+)'\)"/);
    ok('edges', c + ': the back button passes a fallback slug and hash', !!m,
      (html.match(/id="back-to-prev-part"[^>]*>/) || [''])[0]);
    if (m) {
      ok('edges', c + ': its fallback slug is a real component folder',
        fs.existsSync(path.join(BASE, m[1])), m[1]);
      ok('edges', c + ': its fallback hash is #screen=N',
        /^#screen=\d+$/.test(m[2]), m[2]);
    }
  }
}

/* ══════════════ 9b. The platform owns routing (2026-09-16) ══════════════
   Kata launches each component on its own URL with its own ?registration and
   routes on our 'completed'. So: no unit-level statement anywhere; every
   location.href= / location.replace( sits inside an `if (DEV_NAV)` block (or
   behind goBackToPreviousPart's `if (!DEV_NAV) return;`); the loader's resume
   hop is gone; DEV_NAV needs ?dev=1 AND no ?registration; every former route
   function ends via xapiEndComponent; and in a production boot the back button
   is hidden and goBackToPreviousPart moves nothing. REPORT-XAPI.md §12. */

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

function checkPlatformRouting() {
  const files = ['unit-js/10-identity.js', 'unit-js/20-xapi.js', 'unit-js/40-resume.js',
                 'unit-js/50-loader.js', 'unit-js/90-boot.js',
                 ...COMPONENTS.map(c => PART_DIR(c) + '/script.js')];

  for (const rel of files) {
    const src  = fs.readFileSync(path.join(BASE, rel), 'utf8');
    const code = stripComments(src);
    ok('routing', rel + ': no unit-level statement (xapiCompleteUnit / scope unit)',
      !/xapiCompleteUnit\s*\(/.test(code) && !/scope\s*:\s*['"]unit['"]/.test(code));

    /* Every cross-part hop must be gated. Brace-count from the last `if (DEV_NAV) {` —
       a try/catch sits between it and the hop in every route function. */
    for (const m of code.matchAll(/location\.(href\s*=(?!=)|replace\s*\()/g)) {
      const before = code.slice(Math.max(0, m.index - 1200), m.index);
      const at = before.lastIndexOf('if (DEV_NAV) {');
      let openBlock = false;
      if (at !== -1) {
        const tail = before.slice(at + 'if (DEV_NAV) {'.length);
        openBlock = (tail.split('{').length - 1) - (tail.split('}').length - 1) >= 0;
      }
      const guarded = /if \(!DEV_NAV\) return;(?![\s\S]*\nfunction )/.test(before);
      ok('routing', rel + ': the hop at offset ' + m.index + ' is gated on DEV_NAV',
        openBlock || guarded, m[0]);
    }
  }

  const ident = fs.readFileSync(path.join(BASE, 'unit-js', '10-identity.js'), 'utf8');
  ok('routing', "10-identity.js: DEV_NAV needs ?dev=1 AND no ?registration",
    /get\('dev'\)\s*===\s*'1'\s*&&\s*!\w+\.has\('registration'\)/.test(ident));

  const loader = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', '50-loader.js'), 'utf8'));
  ok('routing', '50-loader.js: the resume hop to _saved.part is gone',
    !/_saved\.part\s*!==\s*currentPartSlug\(\)/.test(loader) && !/location\.replace/.test(loader));

  const resume = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', '40-resume.js'), 'utf8'));
  ok('routing', '40-resume.js: goBackToPreviousPart returns unless DEV_NAV',
    /function goBackToPreviousPart\([^)]*\)\s*\{\s*if \(!DEV_NAV\) return;/.test(resume));
  ok('routing', '40-resume.js: hideCrossPartBack hides #back-to-prev-part unless DEV_NAV',
    /function hideCrossPartBack\(\)\s*\{\s*if \(DEV_NAV\) return;[\s\S]{0,200}back-to-prev-part/.test(resume));
  const boot = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', '90-boot.js'), 'utf8'));
  ok('routing', '90-boot.js calls hideCrossPartBack() before bootXAPI()',
    boot.indexOf('hideCrossPartBack()') > -1 && boot.indexOf('hideCrossPartBack()') < boot.indexOf('bootXAPI()'));

  /* Every former route function ends via xapiEndComponent, with its button. */
  const ROUTE = { '01': ['routeAfterQuiz', 's23-continue'], '02': ['routeAfterAdvancedPractice', 's33-continue'],
                  '03': ['goToAdvanced', 's35-continue'], '04': ['goToNextModule', 's41-continue'],
                  '05': ['closeLomda', 's53-finish'] };
  for (const c of COMPONENTS) {
    const [fn, btn] = ROUTE[c];
    const code = stripComments(fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8'));
    const m = code.match(new RegExp('function ' + fn + '\\(\\)\\s*\\{([\\s\\S]*?)\\n\\}'));
    ok('routing', c + ': ' + fn + '() ends the component via xapiEndComponent(…, #' + btn + ')',
      !!m && m[1].includes('xapiEndComponent(') && m[1].includes("getElementById('" + btn + "')"),
      m ? m[1].slice(0, 120) : 'function not found');
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    ok('routing', c + ': #' + btn + ' exists in the markup', html.includes('id="' + btn + '"'));
  }
  /* B2: component 05 reports on the click, not on arrival. */
  const s05 = stripComments(fs.readFileSync(path.join(BASE, PART_DIR('05'), 'script.js'), 'utf8'));
  const s53 = s05.match(/function s53Enter\(\)\s*\{([\s\S]*?)\n\}/);
  ok('routing', '05: s53Enter() no longer sends the component completed on arrival',
    !!s53 && !s53[1].includes('xapiCompleteComponent(') && !s53[1].includes('xapiEndComponent('));
  ok('routing', '05: closeLomda() calls window.close() only under DEV_NAV',
    /if \(DEV_NAV\) window\.close\(\);/.test(s05));

  /* Production boots: flag off, back hidden, back function inert, no unit helper. */
  for (const c of COMPONENTS) {
    const { dom, val, exec, consoleErrors } = loadComponent(c);
    ok('routing', c + ': DEV_NAV is false in a production boot', val('DEV_NAV') === false, String(val('DEV_NAV')));
    ok('routing', c + ': xapiCompleteUnit no longer exists', val('typeof xapiCompleteUnit') === 'undefined');
    ok('routing', c + ': xapiEndComponent is defined', val('typeof xapiEndComponent') === 'function');
    if (c !== '01') {
      ok('routing', c + ': #back-to-prev-part is hidden by hideCrossPartBack — attribute AND display',
        val("document.getElementById('back-to-prev-part').hidden") === true &&
        val("getComputedStyle(document.getElementById('back-to-prev-part')).display") === 'none');
      exec("_resumeReady = true; _unitState = emptyUnitState(); window.__saves = 0; window.saveState720 = function () { window.__saves++; return true; };");
      const errsBefore = consoleErrors.length;
      exec("goBackToPreviousPart('" + UNIT + "-01', '#screen=1');");
      ok('routing', c + ': goBackToPreviousPart() writes nothing in production',
        val('window.__saves') === 0 && consoleErrors.length === errsBefore,
        'saves=' + val('window.__saves') + ' / ' + consoleErrors.slice(errsBefore).join(' | '));
    }
    dom.window.close();
  }

  /* The flag's two conditions, live. */
  const flag = (search) => {
    const { dom, val } = loadComponent('04', { search });
    const r = { DEV_NAV: val('DEV_NAV'),
                backHidden: val("document.getElementById('back-to-prev-part').hidden") === true &&
                            val("getComputedStyle(document.getElementById('back-to-prev-part')).display") === 'none' };
    dom.window.close();
    return r;
  };
  let r = flag('');
  ok('devnav', 'no query: DEV_NAV false, back hidden', r.DEV_NAV === false && r.backHidden === true, JSON.stringify(r));
  r = flag('?dev=1');
  ok('devnav', '?dev=1 alone: DEV_NAV true, back shown', r.DEV_NAV === true && r.backHidden === false, JSON.stringify(r));
  r = flag('?dev=1&registration=r1');
  ok('devnav', '?dev=1&registration: DEV_NAV false, back hidden — a launch URL never opens navigation',
    r.DEV_NAV === false && r.backHidden === true, JSON.stringify(r));
}

/* ══════════════ 10. The reset hatch ══════════════ */

function checkResetHatch() {
  const { dom, w, val, exec } = loadComponent('01', { search: '?slxapi=1&resetState' });
  const NAV_KEY = 'lomda_nav_edges::' + UNIT;

  /* 90-boot.js already ran the hatch during load. It must have stripped itself
     from the URL — every cross-part hop copies window.location.search verbatim,
     so a ?resetState left in place would re-fire on every hop and resume would
     never work at all. */
  ok('reset', 'the hatch strips ?resetState from the URL',
    !/resetState/.test(w.location.search), w.location.search);
  ok('reset', 'and keeps the rest of the query string',
    /slxapi=1/.test(w.location.search), w.location.search);
  ok('reset', 'it raises _resetRequested for readUnitState, which runs later',
    val('_resetRequested') === true);
  ok('reset', 'it clears the character cache',
    val("window.localStorage.getItem('lomdaCharacter')") === null);
  ok('reset', 'it clears the nav-edge map',
    val("window.sessionStorage.getItem('" + NAV_KEY + "')") === null);

  dom.window.close();

  /* Without ?resetState nothing is touched. */
  const clean = loadComponent('01');
  ok('reset', 'without ?resetState the flag stays down',
    clean.val('_resetRequested') === false);
  clean.dom.window.close();
}

/* ══════════════ 11. The flush-before-return contract ══════════════
   A function that commits an answer must flush, and no `return` may sit between
   the commitment and the flush. In the science unit 13 of 25 committing
   functions had `if (correct) { ...; return; }` before the tail flush for
   months: wrong answers persisted, correct ones did not.

   Brace-matched rather than name-matched on purpose — a `*Check`-name-based
   audit missed four questions committed inside a factory closure named plain
   `check`. A `return` placed after a flush is a false positive, hence the
   ordering test and the line numbers in the message. */

function checkCommitmentFlush() {
  for (const c of COMPONENTS) {
    const rel = path.join(PART_DIR(c), 'script.js');
    const src = fs.readFileSync(path.join(BASE, rel), 'utf8');
    let found = 0;

    for (const m of src.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
      const name = m[1];
      let i = m.index + m[0].length - 1, depth = 0, j = i;
      while (j < src.length) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (depth === 0) break; }
        j++;
      }
      const body = src.slice(i, j);

      /* A commitment is a *Solved/*Done/*Submitted flag being latched true, or
         an xapiAnswered() call — the helper writes XAPI_Q_RESULTS, which IS the
         score. */
      /* A commitment is an xapiAnswered() call — the single place the score is
         now written — or a *Solved/*Submitted latch, which gates whether the
         screen can be answered again. Bare *Done is excluded: in this unit it
         means "the reveal finished", not "an answer was committed". */
      const commits = [
        ...body.matchAll(/(\w+(?:Solved|Submitted))\s*=\s*true/g),
        ...body.matchAll(/xapiAnswered\s*\(/g),
      ].filter(x => !x[1] || !REVEAL_ONLY_FLAGS.test(x[1]))
       .map(x => x.index).sort((a, b) => a - b);
      if (!commits.length) continue;
      if (KNOWN_UNFLUSHED.has(c + '/' + name)) continue;
      found++;

      const flushes = [...body.matchAll(/flushResumeSave\s*\(/g)].map(x => x.index);
      const lineOf = off => src.slice(0, i + off).split('\n').length;

      ok('flush', c + '/' + name + ' flushes at all',
        flushes.length > 0, 'commits at line ' + lineOf(commits[0]) + ', no flushResumeSave');

      const firstCommit = commits[0];
      const escaping = [...body.matchAll(/\breturn\b/g)].map(x => x.index)
        .filter(r => r > firstCommit && !flushes.some(f => f < r))
        /* Ignore returns inside nested function expressions — a `return a - b`
           in a .sort() comparator is not an escape from the outer function. */
        .filter(r => {
          const before = body.slice(firstCommit, r);
          const opens  = (before.match(/function\s*\w*\s*\([^)]*\)\s*\{/g) || []).length;
          if (!opens) return true;
          let d = 0;
          for (let k = firstCommit; k < r; k++) {
            if (body[k] === '{') d++;
            else if (body[k] === '}') d--;
          }
          return d <= 0;
        })
        .map(lineOf);

      ok('flush', c + '/' + name + ' has no return between a commitment and its flush',
        escaping.length === 0, 'escaping return(s) at line ' + escaping.join(', '));
    }

    /* Component 03 has one free-text screen and grades nothing. */
    ok('flush', rel + ' has committing functions to check', found > 0 || c === '03',
      found + ' found');
  }
}

/* ══════════════ 12. Deploy-contract statics ══════════════ */

function checkDeployContract() {
  /* ?v= must be identical across all five index.html for every shared file. A
     mismatch means two parts run different versions of the same logic in one
     session — and a stale 40-resume.js reading a v4 document DELETES it. */
  const versions = {};
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    for (const m of html.matchAll(/\.\.\/unit-js\/([0-9a-z-]+\.js)\?v=(\d+)/g)) {
      (versions[m[1]] = versions[m[1]] || {})[c] = m[2];
    }
  }
  for (const f of Object.keys(versions)) {
    const vs = new Set(Object.values(versions[f]));
    ok('deploy', 'unit-js/' + f + ' carries one ?v= across all parts',
      vs.size === 1, JSON.stringify(versions[f]));
    ok('deploy', 'unit-js/' + f + ' is referenced by all five parts',
      Object.keys(versions[f]).length === COMPONENTS.length,
      Object.keys(versions[f]).join(','));
  }

  /* Lowercase everything. On a case-sensitive host (production is one; Windows
     is not, which is why this went unnoticed upstream for so long) a
     capitalised cross-part path 404s — and because currentPartSlug derives from
     location.pathname, it also splits the state document in two. */
  for (const c of COMPONENTS) {
    for (const f of ['script.js', 'index.html']) {
      const src = fs.readFileSync(path.join(BASE, PART_DIR(c), f), 'utf8');
      const bad = [...src.matchAll(/\.\.\/(methodica-[A-Za-z0-9-]*[A-Z][A-Za-z0-9-]*)\//g)].map(m => m[1]);
      ok('case', c + '/' + f + ': cross-part paths are lowercase',
        bad.length === 0, [...new Set(bad)].join(', '));
    }
  }

  /* Every cross-part navigation must carry the query string, or the LRS
     configuration is lost from that point on and every later part reports
     nothing — silently. */
  for (const c of COMPONENTS) {
    const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    /* Some routers hoist it: `var _q = window.location.search;` then `+ _q`.
       Collect those aliases first so they count as carrying the query string. */
    const aliases = [...src.matchAll(/(?:var|let|const)\s+(\w+)\s*=\s*window\.location\.search/g)]
      .map(m => m[1]);
    const carries = new RegExp('location\\.search' +
      (aliases.length ? '|\\b(?:' + aliases.join('|') + ')\\b' : ''));
    const bad = [];
    for (const m of src.matchAll(/location\.(?:href|replace)\s*(?:=|\()\s*['"]\.\.\/[^'"]+['"]([^;\n]*)/g)) {
      if (!carries.test(m[1])) bad.push(m[0].slice(0, 70));
    }
    ok('deploy', c + ': every cross-part navigation carries location.search',
      bad.length === 0, bad.join(' | '));
  }

  /* The library letter gate. LIB720 and the XAPI_USING_G regex must agree — a
     letter missing from the regex silences every item-level statement with no
     error at all. */
  const loader = fs.readFileSync(path.join(BASE, 'unit-js', '50-loader.js'), 'utf8');
  const lib    = (loader.match(/RESUME_ENABLED \? '(xapi-720-([a-z])\.js)'/) || [])[2];
  const rx     = (loader.match(/xapi-720-\[([a-z]+)\]/) || [])[1];
  ok('lib', 'the library letter is listed in the XAPI_USING_G regex',
    !!lib && !!rx && rx.includes(lib), 'loads -' + lib + ', regex [' + rx + ']');
  ok('lib', 'the test stub matches a letter the regex knows',
    fs.existsSync(path.join(HARNESS_DIR, 'xapi-720-' + lib + '.js')),
    '_test/xapi-720-' + lib + '.js');

  /* No identifier declared at top level in BOTH layers. let/const is a loud
     SyntaxError, but var/function is a SILENT last-wins overwrite — and
     script.js loads after the shared layer, so a leftover part-local copy wins. */
  const shared = new Map();
  for (const f of fs.readdirSync(path.join(BASE, 'unit-js')).filter(f => f.endsWith('.js'))) {
    for (const l of fs.readFileSync(path.join(BASE, 'unit-js', f), 'utf8').split('\n')) {
      const m = l.match(/^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/);
      if (m) shared.set(m[1], f);
    }
  }
  for (const c of COMPONENTS) {
    const hits = [];
    fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8').split('\n').forEach((l, i) => {
      const m = l.match(/^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/);
      if (m && shared.has(m[1])) hits.push(m[1] + '@' + (i + 1));
    });
    ok('dup', c + ': no top-level identifier collides with the shared layer',
      hits.length === 0, hits.join(', '));
  }
}

/* ══════════════ 13. Hint dedupe ══════════════ */

function checkHintDedupe() {
  const { dom, val, exec } = loadComponent('01');
  exec('window.XAPI_USING_G = true; window.__sent = []; window.sendStatement720 = function (v) { window.__sent.push(v); };');
  exec('window.METADATA = { subContent: [] };');
  exec("xapiRequestedHint('004', 'q1'); xapiRequestedHint('004', 'q1'); xapiRequestedHint('004', 'q1');");
  ok('hint', 'reopening a hint reports requested.1 only once',
    val('window.__sent.length') === 1, String(val('window.__sent.length')));
  exec("xapiRequestedHint('005', 'q1');");
  ok('hint', 'a different question still reports',
    val('window.__sent.length') === 2, String(val('window.__sent.length')));
  dom.window.close();
}

/* ══════════════ 14. Video is opt-in only ══════════════ */

function checkVideoAllowlist() {
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    const videos = [...html.matchAll(/<video[^>]*>/g)].map(m => m[0]);
    const reported = videos.filter(v => /data-xapi-report/.test(v));
    /* Decorative avatar clips must NOT be wired. Nothing in this unit opts in
       yet; if that changes, this assertion is the place to notice. */
    ok('video', c + ': no decorative <video> is wired for reporting',
      reported.length === 0 || reported.every(v => /data-xapi-report="\d+"/.test(v)),
      reported.join(' | '));
  }
  const x = fs.readFileSync(path.join(BASE, 'unit-js', '20-xapi.js'), 'utf8');
  ok('video', 'xapiWireVideos selects only opted-in elements',
    /querySelectorAll\('video\[data-xapi-report\]'\)/.test(x));
}

/* ══════════════ 15. The retry lock ══════════════
   A wrong non-final attempt must leave the check button dead until the answer changes. Without
   it the learner can press "צדקתי?" again on an UNCHANGED answer, which burns their last attempt
   and sends a second `answered` carrying an identical student_answer. Reproduced in the browser
   on 2026-09-02 across every 2-attempt question; 18 of the 22 were affected.

   Two halves, and BOTH are needed: the live retry branch, and the painter that mirrors it. A
   painter that recomputes the button from "is an answer present" hands a resumed learner a live
   button on an unchanged answer, i.e. re-opens the same hole. */

/* s42* in component 04 is dead code with no markup — see the dead-code list in RESUME.md. */
const KNOWN_DEAD_QUESTIONS = new Set(['04/s42']);

function branchBodyAt(src, openBraceIdx) {
  let depth = 0, j = openBraceIdx;
  while (j < src.length) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
    j++;
  }
  return src.slice(openBraceIdx, j);
}

function checkRetryLock() {
  /* ── half 1: the live branches ── */
  let seen = 0;
  for (const c of COMPONENTS) {
    const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    /* Both spellings are in use: `=== 1` in four components, `< 2` for s32 in component 02.
       Matching only the first form is how s32 was missed on the first pass. */
    for (const m of src.matchAll(/(\w+?)Attempts\s*(?:===\s*1|<\s*2)\s*\)\s*\{/g)) {
      const name = m[1];
      if (KNOWN_DEAD_QUESTIONS.has(c + '/' + name)) continue;
      const body = branchBodyAt(src, src.indexOf('{', m.index + m[0].length - 1));
      seen++;
      ok('retry-lock', c + '/' + name + ' retry branch re-locks the check button',
        /\.disabled\s*=\s*true/.test(body),
        'no ".disabled = true" in the attempt-1 branch');
    }
  }
  ok('retry-lock', 'every 2-attempt question was inspected', seen === 22,
    seen + ' retry branches found, expected 22');

  /* ── half 2: the painters that mirror them ── */
  const PAINTERS = [
    ['01', 'restoreValueScreenUI'],  ['01', 'restoreChoiceScreenUI'], ['01', 's20RestoreUI'],
    ['02', 'restoreValueScreenUI'],  ['02', 's33RestoreUI'], ['02', 's28RestoreUI'],
    ['04', 'restoreChoiceScreenUI'], ['04', 's39RestoreUI'], ['04', 's40RestoreUI'],
    ['05', 'sqRestoreChoiceUI'],     ['05', 's45RestoreUI'], ['05', 's47RestoreUI'],
  ];
  for (const [c, fn] of PAINTERS) {
    const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    const at = src.search(new RegExp('function\\s+' + fn + '\\s*\\('));
    if (!ok('retry-lock', c + '/' + fn + ' exists', at !== -1)) continue;
    const fnBody = branchBodyAt(src, src.indexOf('{', at));
    const am = fnBody.match(/(?:cfg\.attempts|\w+Attempts)\s*>=\s*1\s*\)\s*\{/);
    if (!ok('retry-lock', c + '/' + fn + ' has an attempts>=1 branch', !!am)) continue;
    const block = branchBodyAt(fnBody, fnBody.indexOf('{', am.index + am[0].length - 1));
    ok('retry-lock', c + '/' + fn + ' repaints the retry lock',
      /\.disabled\s*=\s*true/.test(block),
      'the painter leaves the check button live on an unchanged answer');
  }
}

/* ══════════════ 16. Every commitment is latched ══════════════
   xapiAnswered() has no dedupe of its own, and it must not: a learner's SECOND attempt is a real
   answer and has to report. So the only thing standing between a resume and a replayed `answered`
   is a latch early-return at the top of each committing function. Nothing checked that those
   guards exist, which is exactly the kind of omission that reappears when a question is added. */

function checkLatchGuards() {
  let checked = 0;
  for (const c of COMPONENTS) {
    const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    for (const m of src.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
      const name = m[1];
      const body = branchBodyAt(src, m.index + m[0].length - 1);
      const firstCommit = body.search(/xapiAnswered\s*\(/);
      if (firstCommit === -1) continue;
      if (KNOWN_DEAD_QUESTIONS.has(c + '/' + name.replace(/(Submit|Check).*$/, ''))) continue;
      checked++;
      /* A guard is `if (<something>Solved|Done|Submitted|Checked) { ... return; }` standing
         BEFORE the first commitment. Position is the whole point: a guard after the send would
         not stop the send. */
      /* Both spellings count: `if (x) { ...; return; }` and the brace-less
         `if (sqSelected === null || sqSubmitted) return;`. Requiring braces rejected three
         perfectly good guards in component 01. */
      const guards = [...body.matchAll(/if\s*\([^)]*(?:Solved|Done|Submitted|Checked)[^)]*\)\s*(?:\{[^{}]*\breturn\b[^{}]*\}|[^;{}]*\breturn\b[^;]*;)/g)]
        .map(g => g.index)
        .filter(i => i < firstCommit);
      ok('latch', c + '/' + name + ' latches before it reports',
        guards.length > 0,
        'xapiAnswered at offset ' + firstCommit + ' with no preceding latch guard');
    }
  }
  ok('latch', 'committing functions were found to check', checked >= 20,
    checked + ' found');
}

/* ══════════════ 17. The hint ledger outlives the page ══════════════
   XAPI_HINTS_SENT alone is per page load, so before this the learner reported `requested.1`
   again after any refresh — and every cross-part "חזרה" is a fresh page load, so it happened in
   ordinary use. The keys now also sit in the state document under `hints`. */

function checkHintLedgerPersists() {
  const r = fs.readFileSync(path.join(BASE, 'unit-js', '40-resume.js'), 'utf8');
  const x = fs.readFileSync(path.join(BASE, 'unit-js', '20-xapi.js'), 'utf8');

  ok('hint', 'emptyUnitState declares a hints ledger', /hints:\s*\{\}/.test(r));
  ok('hint', 'readUnitState back-fills hints by presence', /doc\.hints\s*=\s*doc\.hints\s*\|\|\s*\{\}/.test(r));
  ok('hint', 'sendStatementOnce carries the invariants for any verb',
    /function\s+sendStatementOnce\s*\(\s*ledger\s*,\s*key\s*,\s*verb\s*,/.test(r));
  ok('hint', 'sendStatementOnce bails out entirely while restoring',
    /function\s+sendStatementOnce[\s\S]{0,200}?if\s*\(_restoring\)\s*return\s+false;/.test(r));
  ok('hint', 'sendCompletedOnce still goes through it',
    /function\s+sendCompletedOnce[\s\S]{0,220}?sendStatementOnce\(\s*ledger\s*,\s*key\s*,\s*'completed'/.test(r));
  ok('hint', 'xapiRequestedHint routes through the hints ledger',
    /sendStatementOnce\(\s*'hints'\s*,\s*_k\s*,\s*'requested\.1'/.test(x));
  /* The memory latch must be set only when the ledger reports the key settled, and only after
     the XAPI_USING_G guard — otherwise a statement that never left is recorded as sent. */
  const fn = x.slice(x.indexOf('function xapiRequestedHint'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 1);
  ok('hint', 'the memory latch is set after the USING_G guard',
    body.indexOf('XAPI_USING_G') < body.indexOf('XAPI_HINTS_SENT[_k] = true'));
  ok('hint', 'the memory latch is gated on the ledger reporting settled',
    /if\s*\(sendStatementOnce\([\s\S]{0,140}?\)\)\s*\{\s*\n?\s*XAPI_HINTS_SENT\[_k\]\s*=\s*true;/.test(body));

  /* Behavioural: a document that already records the hint must suppress a fresh page load's
     first click — the case a per-page-load map cannot cover. */
  const { dom, val, exec } = loadComponent('01');
  exec('window.XAPI_USING_G = true; window.__sent = []; window.sendStatement720 = function (v) { window.__sent.push(v); };');
  exec('window.METADATA = { subContent: [] };');
  exec("_unitState = { v: 5, component: currentPartSlug(), payload: null, done: {}, doneItems: {}, hints: { '004/q1': true }, picks: {}, ui: {}, results: {} };");
  exec("xapiRequestedHint('004', 'q1');");
  ok('hint', 'a hint already in the document is not reported again after a reload',
    val('window.__sent.length') === 0, String(val('window.__sent.length')));
  /* Fail OPEN: with no document at all the hint must still report. A blocked or absent state
     document must never be able to silence a statement. */
  exec('_unitState = null; XAPI_HINTS_SENT = {};');
  exec("xapiRequestedHint('004', 'q1');");
  ok('hint', 'with no state document the hint still reports (fail open)',
    val('window.__sent.length') === 1, String(val('window.__sent.length')));
  dom.window.close();
}

/* ══════════════ 18. Screen 2's pick is painted and reported once ══════════════ */

function checkLearningTypePick() {
  const src = fs.readFileSync(path.join(BASE, PART_DIR('01'), 'script.js'), 'utf8');
  ok('pick', 'screen 2 has a painter', /function\s+s2RestoreUI\s*\(/.test(src));
  ok('pick', 'restoreScreenUI dispatches screen 2',
    /if\s*\(n\s*===\s*2\)\s*s2RestoreUI\(\)/.test(src));
  ok('pick', "the painter does not mutate state or send",
    (() => {
      const at = src.search(/function\s+s2RestoreUI\s*\(/);
      const body = branchBodyAt(src, src.indexOf('{', at));
      return !/sendStatement|selectedDesign\s*=|announce\s*\(/.test(body);
    })());
  ok('pick', "advanceFromS2 reports 'selected' through the picks ledger",
    /sendStatementOnce\(\s*'picks'\s*,\s*'learning-type\/'\s*\+\s*_pick\s*,\s*'selected'/.test(src));
  const r = fs.readFileSync(path.join(BASE, 'unit-js', '40-resume.js'), 'utf8');
  ok('pick', 'emptyUnitState declares a picks ledger', /picks:\s*\{\}/.test(r));
}

/* ══════════════ 19. The YouTube path is anchored and filtered ══════════════
   xapiWireVideos was fixed to filter churn; component 01's YouTube player never went through
   that helper and kept the old unfiltered form.

   15.09.26 — the anchor changed from the question to the ITEM. Both producers used to pass
   xapiQ(), and both still reported against the COMPONENT, because the library's questionId
   branch is allowlisted to answered/selected/requested and played/paused fall through it to
   METADATA.id. objectId is the only key it honours for these verbs. This file can only read
   the source; the emitted statement is asserted in 720-common-lib/_test/video-object-id.js. */

function checkYouTubeReporting() {
  const src = fs.readFileSync(path.join(BASE, PART_DIR('01'), 'script.js'), 'utf8');
  const at = src.search(/function\s+s4OnPlayerStateChange\s*\(/);
  ok('video', 'component 01 has the YouTube state handler', at !== -1);
  if (at === -1) return;
  const body = branchBodyAt(src, src.indexOf('{', at));
  for (const verb of ['played', 'paused']) {
    const m = body.match(new RegExp("sendStatement720\\('" + verb + "'[\\s\\S]{0,160}?\\)\\s*;"));
    ok('video', "the YouTube '" + verb + "' carries the ITEM as its object",
      !!m && /objectId:\s*xapiItemId\('002'\)/.test(m[0]),
      m ? m[0].replace(/\s+/g, ' ') : 'not found');
    ok('video', "the YouTube '" + verb + "' no longer passes xapiQ() — the library drops it here",
      !!m && !/xapiQ\(/.test(m[0]),
      m ? m[0].replace(/\s+/g, ' ') : 'not found');
  }
  /* 17.09.26 — what stood here asserted the LATCH: "'played' only reports after a real pause"
     and "the pause/play pair strictly alternates" (/PLAYING && s4PausedOnce/). That assertion
     was the defect MOE reported — the first 'played' of a viewing was never sent, so the first
     'paused' had nothing before it. Both are gone; a revert net replaces them, and the emitted
     sequence is now driven rather than pattern-matched. */
  ok('video', 'the pausedOnce latch is gone from the handler',
    !/s4PausedOnce/.test(stripComments(body)),
    'the first played of a viewing would be suppressed again');

  /* Drive the real handler. YT is never defined in jsdom (the IFrame API is not fetched), so
     the probe supplies the three state constants it reads. s4YTPlayer is a top-level `let` —
     a global LEXICAL binding, not a window property — so it is assigned from another script in
     the same realm rather than through window. sqEnter is stubbed because the UI-side ENDED
     branch runs OUTSIDE the handler's try/catch and would throw out of the probe. */
  const b = loadComponent('01');
  const probe = b.val(
    "(function(){ var realUsing = window.XAPI_USING_G, realSend = window.sendStatement720," +
    "             realYT = window.YT, realEnter = window.sqEnter, log = [];" +
    "  window.XAPI_USING_G = true;" +
    "  window.sendStatement720 = function(v, t, r, o){ log.push({ v: v, o: o }); };" +
    "  window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } };" +
    "  window.sqEnter = function(){};" +
    "  s4YTPlayer = { getCurrentTime: function(){ return 4.5; } };" +
    "  try {" +
    "    s4OnPlayerStateChange({ data: 1 });" +   // 1 first start -> played
    "    var beforeAnyPause = log.length;" +
    "    s4OnPlayerStateChange({ data: 1 });" +   // 2 a seek      -> silent
    "    s4OnPlayerStateChange({ data: 2 });" +   // 3 PAUSED      -> paused
    "    s4OnPlayerStateChange({ data: 2 });" +   // 4 duplicate   -> silent
    "    s4OnPlayerStateChange({ data: 1 });" +   // 5 resume      -> played
    "    s4OnPlayerStateChange({ data: 0 });" +   // 6 ENDED       -> silent, re-arms
    "    s4OnPlayerStateChange({ data: 2 });" +   // 7 pauseVideo() on an ended clip -> silent
    "    var afterEnded = log.length;" +
    "    s4OnPlayerStateChange({ data: 1 });" +   // 8 replay      -> played
    "    return JSON.stringify({ beforeAnyPause: beforeAnyPause, afterEnded: afterEnded," +
    "      log: log, itemId: xapiItemId('002') });" +
    "  } finally { window.XAPI_USING_G = realUsing; window.sendStatement720 = realSend;" +
    "             window.YT = realYT; window.sqEnter = realEnter; } })()");
  const y = JSON.parse(probe || '{}');
  const log = y.log || [];

  ok('video', "the first start reports 'played', autoplay included",
    y.beforeAnyPause === 1 && log[0] && log[0].v === 'played',
    JSON.stringify(log.map(e => e.v)));
  ok('video', 'no statement is an orphan (every paused follows a played)',
    orphanScan(log) === null, orphanScan(log) + ': ' + JSON.stringify(log.map(e => e.v)));
  ok('video', 'a seek and a duplicate pause emit nothing',
    log.length === 4, JSON.stringify(log.map(e => e.v)));
  ok('video', "ENDED emits nothing and re-arms the replay's 'played'",
    y.afterEnded === 3 && log[3] && log[3].v === 'played',
    'afterEnded=' + y.afterEnded + ' ' + JSON.stringify(log.map(e => e.v)));
  ok('video', 'every driven statement carries the ITEM as objectId',
    log.length === 4 && log.every(e => e.o && e.o.objectId === y.itemId),
    JSON.stringify(log.map(e => e.o && e.o.objectId)) + ' vs item ' + y.itemId);
  ok('video', 'every driven statement carries the video time',
    log.length === 4 && log.every(e => e.o && e.o.time === 4.5),
    JSON.stringify(log.map(e => e.o && e.o.time)));

  b.dom.window.close();
}

/* The defect MOE reported on 17.09.26, named: a 'paused' with no 'played' before it. A walk
   rather than a compare against a literal sequence, so it keeps its meaning when a probe is
   extended. Only the orphan is checked — a 'played' after a 'played' is NOT a defect, because
   end of clip closes the stream and emits nothing, so a replay legitimately opens a second one.
   That a seek does not do the same is pinned by the statement COUNT. Returns null when clean. */
function orphanScan(log) {
  let open = false, bad = null;
  for (const e of log) {
    if (e.v === 'played') open = true;
    if (e.v === 'paused') { if (!open && !bad) bad = 'orphan paused'; open = false; }
  }
  return bad;
}

/* ══════════════ run ══════════════ */

/* ══════════════ The asset contract ══════════════
   Every failure mode here is SILENT in a browser. A missing font renders in a fallback face
   that looks plausible; a missing <img> renders as nothing at all. There is no exception and
   no console message beyond a 404 nobody is watching.

   Nothing else in this file could see any of it. The JSDOM instances are built with default
   `resources`, so jsdom never fetches a stylesheet, an image or a video — it only hand-executes
   <script src>. Before this section existed, every asset in the unit could have moved without
   one assertion changing.

   Three rules specific to this unit:

   1. Case. fs.existsSync is not enough: Windows resolves any casing and the CDN does not, so
      every path segment is checked against the real directory listing.
   2. The dynamic families. Five preload loops build names as
      './assets/images/' + c + variant + '.png', one base path per family. A static sweep cannot
      see those, and they are exactly what a partial hoist would break, so the variant arrays are
      expanded and checked explicitly below.
   3. canvas-tall-gate.js. Every index.html loads it before script.js, and until 2026-09-07 the
      string appeared in no test and no document in this repo — so nothing would have noticed if
      it stopped shipping. package-allowlist.ps1 now lists it; this pins it from the other side. */

/* Resolve `url` from `fromDir`, confirming every segment exists with EXACTLY that case.
   Returns '' when it resolves, or the first segment that does not match. */
function resolveExact(fromDir, url) {
  const clean = url.split('?')[0].split('#')[0];
  let dir = fromDir;
  const segs = clean.split('/').filter(s => s !== '' && s !== '.');
  for (let i = 0; i < segs.length; i++) {
    if (segs[i] === '..') { dir = path.dirname(dir); continue; }
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { return segs.slice(0, i + 1).join('/'); }
    if (!names.includes(segs[i])) return segs.slice(0, i + 1).join('/');
    dir = path.join(dir, segs[i]);
  }
  return '';
}

const ASSET_RE = /\.(png|jpe?g|gif|svg|mp4|webm|woff2?|ttf)$/i;

/* Block comments only. The comment left where the phantom .gif preload used to be names the
   very string the assertion below looks for, and stripping // as well would truncate any
   'https://…' literal. */
const stripBlockComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* The variant arrays each component's preloadCharacterAvatars() actually iterates. Keep in
   step with the loops in the five script.js — that is the point of the assertion. */
const PRELOAD_VARIANTS = {
  '01': ['', '_binoculars', '_roller', '_popcorn', '_cards', '_holdhands', '_workout'],
  '02': [''],
  '03': [''],
  '04': [''],
  '05': ['', '_workout'],
};

function checkAssetContract() {
  /* ── the shared root ── */
  const fontsDir = path.join(BASE, 'unit-assets', 'fonts');
  const faces = fs.existsSync(fontsDir)
    ? fs.readdirSync(fontsDir).filter(f => /\.ttf$/i.test(f)) : [];
  ok('assets', 'unit-assets/fonts holds the seven Assistant faces', faces.length === 7,
    faces.length + ': ' + faces.join(','));
  ok('assets', 'unit-assets/img holds the hoisted Ruller.png',
    fs.existsSync(path.join(BASE, 'unit-assets', 'img', 'Ruller.png')));

  /* ── no component may re-grow its own copy of either ── */
  for (const c of COMPONENTS) {
    const d = path.join(BASE, PART_DIR(c), 'assets', 'fonts');
    const local = fs.existsSync(d) ? fs.readdirSync(d).filter(f => /\.ttf$/i.test(f)) : [];
    ok('assets', c + ' has no local copy of the Assistant faces', local.length === 0,
      local.join(','));
    ok('assets', c + ' has no local copy of Ruller.png',
      !fs.existsSync(path.join(BASE, PART_DIR(c), 'assets', 'images', 'Ruller.png')));
  }

  /* ── every literal asset reference resolves, with exact case ── */
  const skipDirs = ['.git', '_test', 'docs-and-tools', 'metadata-from', 'translation', 'node_modules'];
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!skipDirs.includes(e.name)) walk(p); }
      else if (/\.(html|js|css)$/.test(e.name) && e.name !== 'index_dev.html') files.push(p);
    }
  })(BASE);

  let refs = 0;
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    const found = new Set();
    for (const re of [/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, /(?:src|href)="([^"]+)"/g,
                      /'((?:\.\.\/)*\.?\/?(?:unit-)?assets\/[^']+)'/g]) {
      for (const m of txt.matchAll(re)) {
        const u = m[1].trim();
        /* component 01 loads the YouTube iframe API — third-party, nothing to resolve */
        if (/^data:|^https?:|^\/\//.test(u)) continue;
        if (!ASSET_RE.test(u.split('?')[0])) continue;
        found.add(u);
      }
    }
    for (const u of found) {
      refs++;
      const bad = resolveExact(path.dirname(f), u);
      ok('assets', path.relative(BASE, f).replace(/\\/g, '/') + ' -> ' + u,
        bad === '', bad ? 'no such path (exact case): ' + bad : '');
    }
  }
  /* A floor, not a target: it guards against the sweep silently matching nothing after a
     regex edit and then reporting a clean run over zero references. */
  ok('assets', 'the sweep actually found references', refs > 80, String(refs));

  /* ── the dynamic preload families ──
     Every name these loops build must exist. Two did not until 2026-09-07: 02 preloaded a
     _holdhands variant that lives only in 01, and 05 preloaded four ' GIF Happy/Sad.gif'
     files that exist nowhere in this unit. */
  for (const c of COMPONENTS) {
    const dir = path.join(BASE, PART_DIR(c), 'assets', 'images');
    for (const ch of ['Character1', 'Character2']) {
      for (const v of PRELOAD_VARIANTS[c]) {
        ok('assets', c + ' preloads ' + ch + v + '.png and it exists',
          fs.existsSync(path.join(dir, ch + v + '.png')));
      }
    }
    const src = stripBlockComments(
      fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8'));
    ok('assets', c + ' preloads no .gif (this unit contains none)',
      !/\.gif'/.test(src), (src.match(/'[^']*\.gif'/) || [''])[0]);
  }

  /* ── canvas-tall-gate.js: shipped, and loaded before script.js ── */
  for (const c of COMPONENTS) {
    ok('assets', c + '/canvas-tall-gate.js exists',
      fs.existsSync(path.join(BASE, PART_DIR(c), 'canvas-tall-gate.js')));
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    const gate = html.indexOf('canvas-tall-gate.js');
    const main = html.indexOf('src="script.js');
    ok('assets', c + ' loads canvas-tall-gate.js before script.js',
      gate > -1 && main > -1 && gate < main, 'gate@' + gate + ' script@' + main);
  }

  /* ── per-component cache-busters ──
     checkDeployContract() only looks at ../unit-js/. These three are per-component and were
     unguarded; in the sibling unit the same gap left styles.css referenced bare, which would
     have served a cached stylesheet pointing at fonts that no longer exist. */
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    for (const [label, re] of [['styles.css', /href="styles\.css(\?v=\d+)?"/],
                               ['script.js', /src="script\.js(\?v=\d+)?"/],
                               ['canvas-tall-gate.js', /src="canvas-tall-gate\.js(\?v=\d+)?"/]]) {
      const m = html.match(re);
      ok('assets', c + '/' + label + ' carries a ?v=', !!(m && m[1]), m ? m[0] : 'not referenced');
    }
  }
}

function main() {
  checkLoadAndSharedLayer();
  checkBootCover();
  checkIds();
  checkScreenMap();
  checkNavigation();
  checkResumeHashOverride();
  checkStateDocument();
  checkUnitLevelState();
  checkPerComponentState();
  checkStateShapeSource();
  checkBackEdges();
  checkPlatformRouting();
  checkResetHatch();
  checkCommitmentFlush();
  checkDeployContract();
  checkAssetContract();
  checkHintDedupe();
  checkVideoAllowlist();
  checkRetryLock();
  checkLatchGuards();
  checkHintLedgerPersists();
  checkLearningTypePick();
  checkYouTubeReporting();

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
