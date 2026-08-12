'use strict';
/* ═══════════════════ xAPI — loader / init ═══════════════════
   Shared by all five components. Definition-only; 90-boot.js calls bootXAPI() LAST, because this
   is the step that may window.location.replace() to another component.

   Per-part seams:
     XAPI_METADATA_FILE   required — '../metadata/<component>.json'
     onXapiReady()        optional — runs after the component 'initialized' and the landing
                          screen's item init. Components 01 and 05 use it to open the unit
                          metadata; the other three do not define it. */

function bootXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function () { console.error('[xAPI] failed to load', src); cb(); };
    document.head.appendChild(s);
  }
  function pollMetadataReady(cb) {
    if (window.jsXAPI_MetadataReady) { cb(); }
    else { setTimeout(function () { pollMetadataReady(cb); }, 200); }
  }
  /* -i is the production build (720 guidelines v2.4); -j is -i plus the State API transport that
     only resume uses, so -i is loaded while RESUME_ENABLED is false. On localhost only,
     ?xapiLib=<same-origin path> may override it to test a local build.
     window.XAPI_USING_G tells the components whether item-level statements are available — the
     regex must list every library letter that supports them, or xapiOnScreen and the video
     reporting go silent with no error. */
  var LIB720 = CDN + (RESUME_ENABLED ? 'xapi-720-j.js' : 'xapi-720-i.js');
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var _ovr = new URLSearchParams(location.search).get('xapiLib');
      if (_ovr && /^(\.\.?\/|\/)[^:]*$/.test(_ovr)) LIB720 = _ovr;   // same-origin relative only
    }
  } catch (e) {}
  window.XAPI_USING_G = /xapi-720-[ghij]\.js/.test(LIB720);

  loadScript(CDN + 'xapiwrapper.min.js', function () {
    loadScript(LIB720, function () {
      try {
        getXAPIParameters(XAPI_METADATA_FILE);
        pollMetadataReady(function () {
          try {
            try { ADL.XAPIWrapper.changeConfig({ endpoint: window.slxapi.endpoint, auth: window.slxapi.auth }); } catch (e) {}
            /* Resume runs BEFORE the component 'initialized': a session that turns out to belong
               to another component hops away, and must not leave a statement behind for the part
               it merely passed through. For component 01 — the entry component every launch
               passes through — that is also why the unit is opened in onXapiReady() below,
               after the hop can no longer happen. */
            var _resumed = false;
            if (RESUME_ENABLED) {
              try {
                /* readUnitState migrates a v2 document and never returns null, so a stale shape
                   can neither redirect nor leave the ledger undefined. */
                var _saved = readUnitState();
                if (_saved.part && _saved.part !== currentPartSlug()) {
                  // Learner stopped in another component — hop there, carrying slxapi+registration.
                  window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
                  return;
                }
                _resumeReady = true;
                /* _resumed tracks whether a payload was actually applied, not whether a document
                   existed. A v3 document always exists; if it holds nothing for this part,
                   applyExecutionState is a no-op and the landing screen still owes its item
                   'initialized' below. */
                var _payload = _saved.parts[currentPartSlug()];
                if (_payload) { applyExecutionState(_payload); _resumed = true; }
                syncBackButton();
              } catch (e) {
                console.error('[resume] init', e);
                _resumeReady = true;
                if (!_unitState) _unitState = emptyUnitState();
              }
            }
            try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}
            try { xapiWireVideos(); } catch (e) {}
            /* Item-level init for the landing screen. On a resume, applyExecutionState already
               emitted it for the restored screen. */
            if (!_resumed) { try { xapiOnScreen(currentScreen); } catch (e) {} }
            if (typeof onXapiReady === 'function') {
              try { onXapiReady(); } catch (e) { console.error('[xAPI] ready hook', e); }
            }
          } catch (e) { console.error('[xAPI] init', e); }
        });
      } catch (e) { console.error('[xAPI] load', e); }
    });
  });
}
