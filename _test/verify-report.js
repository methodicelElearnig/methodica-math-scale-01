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
  'getUnitCharacter', 'setUnitCharacter', 'getUnitResult', 'setUnitResult',
  'applyUnitProfile', 'drainPendingUnitState', 'recordForwardEdge',
  'previousPartHref', 'goBackToPreviousPart', 'writeForwardState',
  'resumeIsPainting', 'xapiAnswered', 'xapiRequestedHint',
  'xapiCompleteComponent', 'xapiCompleteUnit'
];

const failures = [];
let passes = 0;

function ok(tag, what, cond, detail) {
  if (cond) { passes++; return; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
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

  ok('state', 'emptyUnitState is v4', val('emptyUnitState().v') === 4);
  ok('state', 'emptyUnitState carries ui.character',
    val('JSON.stringify(emptyUnitState().ui)') === '{"character":null}');
  ok('state', 'emptyUnitState carries results',
    val('JSON.stringify(emptyUnitState().results)') === '{}');

  ok('state', 'currentPartSlug returns this part',
    val('currentPartSlug()') === PART_DIR(c), String(val('currentPartSlug()')));

  /* ── The slug-case invariant, tested against a capitalised URL ──
     currentPartSlug derives from location.pathname, i.e. from how the learner
     ARRIVED. A URL differing only in case would produce a SECOND key for the
     same part under parts[] — split progress, a `done` ledger that misses, and
     therefore a duplicate 'completed'.
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

  /* applyUnitProfile reports whether it changed anything, and must not write. */
  exec("_unitState = emptyUnitState(); _unitState.ui.character = 'text'; window.lomdaState.selectedCharacter = 'video';");
  ok('unit', 'applyUnitProfile returns true when it changes the character',
    val('applyUnitProfile(_unitState)') === true);
  ok('unit', 'and applies it', val('window.lomdaState.selectedCharacter') === 'text');
  ok('unit', 'applyUnitProfile returns false when nothing changes',
    val('applyUnitProfile(_unitState)') === false);

  dom.window.close();
}

/* ══════════════ 9. Cross-part back edges ══════════════ */

function checkBackEdges() {
  /* Part 03 is reachable from 02 (normal) and from 01 (the >=4/5 skip). A
     hard-coded back button sends the skipper into content they never saw. */
  const { dom, val, exec } = loadComponent('03');
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

  /* Layer 1: the document wins over sessionStorage. */
  exec("_unitState.prev['" + UNIT + "-03'] = { from: '" + UNIT + "-02', hash: '#screen=8' };");
  ok('edges', 'the document edge beats the sessionStorage edge',
    /methodica-math-scale-01-02\/index\.html.*#screen=8$/.test(
      val("previousPartHref('" + UNIT + "-02', '#screen=1')")),
    String(val("previousPartHref('" + UNIT + "-02', '#screen=1')")));

  /* writeForwardState records the edge itself, so the two cannot come apart. */
  exec("window.sessionStorage.removeItem('" + NAV_KEY + "');");
  exec("writeForwardState('" + UNIT + "-04', '#screen=2');");
  ok('edges', 'writeForwardState records the sessionStorage edge',
    val("JSON.parse(window.sessionStorage.getItem('" + NAV_KEY + "'))['" + UNIT + "-04'].from") === UNIT + '-03');
  ok('edges', 'writeForwardState records the document edge with its hash',
    val("_unitState.prev['" + UNIT + "-04'].hash") === '#screen=2');
  ok('edges', 'writeForwardState moves the landing pointer',
    val('_unitState.part') === UNIT + '-04');
  ok('edges', 'writeForwardState seeds an unvisited destination at screen 0',
    val("_unitState.parts['" + UNIT + "-04'].currentScreen") === 0);

  /* Fail-closed back: a failed write must NOT navigate. Navigating anyway
     reintroduces the ping-pong that re-sends 'completed' every cycle. */
  exec('window.__navigated = null; window.saveState720 = function () { return false; };');
  exec("var _before = _unitState.part; goBackToPreviousPart('" + UNIT + "-02', '#screen=8'); window.__partAfter = _unitState.part; window.__partBefore = _before;");
  ok('edges', 'a failed state write leaves the landing pointer where it was',
    val('window.__partAfter') === val('window.__partBefore'),
    val('window.__partBefore') + ' -> ' + val('window.__partAfter'));

  dom.window.close();

  /* Every back button must be wired to goBackToPreviousPart with a fallback. */
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
    fs.existsSync(path.join(BASE, '_test', 'xapi-720-' + lib + '.js')),
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

/* ══════════════ run ══════════════ */

function main() {
  checkLoadAndSharedLayer();
  checkBootCover();
  checkIds();
  checkScreenMap();
  checkNavigation();
  checkResumeHashOverride();
  checkStateDocument();
  checkUnitLevelState();
  checkBackEdges();
  checkResetHatch();
  checkCommitmentFlush();
  checkDeployContract();
  checkHintDedupe();
  checkVideoAllowlist();

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
