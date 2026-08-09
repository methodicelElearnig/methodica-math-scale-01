/* Local stand-in for the CDN xapi-720-j.js, for verifying resume/back navigation offline.
   NOT shipped — loaded only via ?xapiLib=../_test/xapi-720-j.js, which the parts honour on
   localhost alone. The filename must keep the "xapi-720-j.js" ending: each part sets
   window.XAPI_USING_G from a regex on it, and item-level statements go silent when it fails.

   State and the statement log live in sessionStorage, so both survive the cross-part navigations
   this harness exists to exercise. saveState720Debounced really does defer, so the stale-timer
   race that the handoff guards against is reproducible here. */
(function () {
  'use strict';

  var STATE_KEY = '__test_state';
  var LOG_KEY   = '__test_statements';
  var FAIL_KEY  = '__test_fail_writes';

  function readLog() {
    try { return JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeLog(a) { sessionStorage.setItem(LOG_KEY, JSON.stringify(a)); }

  window.sendStatement720 = function (verb, objectType, result, opts) {
    var log = readLog();
    log.push({
      verb: verb,
      objectType: objectType,
      part: (window.location.pathname.split('/').filter(Boolean).slice(-2)[0] || ''),
      objectId: (opts && opts.objectId) || null,
      scope: (opts && opts.scope) || null,
      result: result || null
    });
    writeLog(log);
    console.log('[stub] ' + verb + ' ' + objectType + (opts && opts.objectId ? ' ' + opts.objectId : '') + (opts && opts.scope ? ' scope=' + opts.scope : ''));
  };

  window.loadState720 = function () {
    try {
      var raw = sessionStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  /* Returns false on a simulated failure, which is what persistUnitState checks. */
  window.saveState720 = function (id, doc) {
    if (sessionStorage.getItem(FAIL_KEY) === '1') { console.warn('[stub] save FORCED FAIL'); return false; }
    sessionStorage.setItem(STATE_KEY, JSON.stringify(doc));
    return true;
  };

  var _t = null;
  window.saveState720Debounced = function (id, doc) {
    var snapshot = JSON.stringify(doc);          // closes over the payload, as the real one does
    if (_t) clearTimeout(_t);
    _t = setTimeout(function () {
      if (sessionStorage.getItem(FAIL_KEY) === '1') return;
      sessionStorage.setItem(STATE_KEY, snapshot);
      console.log('[stub] debounced write landed');
    }, 800);
  };

  window.getXAPIParameters = function () { window.jsXAPI_MetadataReady = true; };
  window.loadUnitMetadata = function (file, cb) { if (typeof cb === 'function') cb(); };

  window.ADL = window.ADL || { XAPIWrapper: { changeConfig: function () {} } };
  window.slxapi = window.slxapi || { endpoint: 'stub', auth: 'stub', actor: {} };

  /* Console helpers for the harness. */
  window.__stmts = readLog;
  window.__state = function () { return window.loadState720(); };
  window.__reset = function () {
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(LOG_KEY);
    sessionStorage.removeItem(FAIL_KEY);
    return 'cleared';
  };
  window.__failWrites = function (on) {
    sessionStorage.setItem(FAIL_KEY, on ? '1' : '0');
    return 'failWrites=' + !!on;
  };
  /* Counts duplicate 'completed' statements — the property the ledger exists to guarantee. */
  window.__dupes = function () {
    var seen = {}, dupes = [];
    readLog().forEach(function (s) {
      if (s.verb !== 'completed') return;
      var k = s.part + '|' + s.objectType + '|' + (s.objectId || '') + '|' + (s.scope || '');
      if (seen[k]) dupes.push(k); else seen[k] = 1;
    });
    return dupes;
  };
})();
