'use strict';
/* ═══════════════════ xAPI — loader / init ═══════════════════
   Shared by all five components. Definition-only; 90-boot.js calls bootXAPI() LAST, because this
   is the step that may window.location.replace() to another component — nothing after it runs.

   Per-part seams:
     XAPI_METADATA_FILE   required — '../metadata/<component>.json'
     onXapiReady()        optional — runs after the component 'initialized' and the landing
                          screen's item init. Components 01 and 05 use it to open the unit
                          metadata; the other three do not define it. */

function bootXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';

  /* ── Hold the boot cover, BEFORE the CDN load ──
     The flag is set here rather than in phase A, and that is the point: phase A runs after two
     serial CDN scripts, which on a cold cache take more than 800ms — so the markup safety net
     would have exposed screen 0 before anyone knew there was anything to restore, and the flash
     comes back in exactly the scenario the cover was added for. Here, by contrast, we run
     synchronously from 90-boot.js during initial parse, well inside 800ms.
     This is an optimistic guess ("there is probably something to restore") that every exit path
     turns off: gate 1 below, the no-payload branch in phase A, the catches, and dropBootCover
     itself. */
  if (typeof RESUME_ENABLED !== 'undefined' && RESUME_ENABLED) {
    try { window.__resumeInFlight = true; } catch (e) {}
  }

  /* ── Gate 1: the per-part seam must be defined ──
     Without XAPI_METADATA_FILE, getXAPIParameters receives undefined, fails to fetch metadata,
     and jsXAPI_MetadataReady is never set — so pollMetadataReady would spin in a timer loop for
     the whole session with no visible error. A component that has not defined the seam gets a
     loud message and a clean exit instead. */
  if (typeof XAPI_METADATA_FILE === 'undefined' || !XAPI_METADATA_FILE) {
    console.warn('[xAPI] XAPI_METADATA_FILE is not defined in this component — reporting is off. ' +
      'See docs-and-tools/REPORT-XAPI.md §2.');
    dropBootCover();   // no resume on this path, and the cover must not be left in place
    return;
  }

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function () { console.error('[xAPI] failed to load', src); cb(); };
    document.head.appendChild(s);
  }

  /* ── Gate 2: the poll is time-bounded ──
     This used to poll forever. If the metadata file is missing or returns 404 — an entirely real
     deployment scenario — that is a silent timer loop for the length of the session.
     50 attempts x 200ms = 10 seconds, then an error explaining what to check. */
  var METADATA_POLL_MAX = 50;
  function pollMetadataReady(cb, tries) {
    tries = tries || 0;
    if (window.jsXAPI_MetadataReady) { cb(); return; }
    if (tries >= METADATA_POLL_MAX) {
      console.error('[xAPI] metadata did not load within ' + (METADATA_POLL_MAX * 200 / 1000) + 's — ' +
        'reporting is off in this component. Check that the file exists and is reachable: ' + XAPI_METADATA_FILE);
      dropBootCover();   // the callback will never run — the cover has to drop here
      return;
    }
    setTimeout(function () { pollMetadataReady(cb, tries + 1); }, 200);
  }

  /* -i is the production build (720 guidelines v2.4). -k is -j (which is -i plus the State API
     transport) plus diagnostics on the state layer. RESUME_ENABLED is true, so -k is loaded.

     Why -k and not -j: under -j every state failure came back as a single bit — loadState720
     returned null for a 404 ("no state yet", the normal first-read case), for a 401 (bad token),
     and for a 500 or an empty 200 alike; saveState720 returned false for a 412, for a 413
     (document over ~1MB) and for a network/CORS failure alike. A run that failed against the
     platform could not be interpreted — and this unit has never had such a run.
     -k adds stateLastResult720() with {op,status,ok,reason} and keeps the return contracts exactly
     as they were, so it is backward compatible with -j.

     On localhost only, ?xapiLib=<same-origin path> may override it to test a local build.

     ⚠️ The stub's filename must end in a library letter the regex below knows (xapi-720-k.js):
     the regex is what sets XAPI_USING_G, and a name that does not match silences every
     item-level statement with no error.

     ⚠️ window.XAPI_USING_G tells the components whether item-level statements are available at
     all. The regex must list every library letter that supports them — A NEW LETTER NOT ADDED
     HERE SILENCES xapiOnScreen AND THE VIDEO REPORTING WITH NO ERROR. Changing LIB720 and
     changing the regex must therefore happen in the same commit. */
  var LIB720 = CDN + (RESUME_ENABLED ? 'xapi-720-k.js' : 'xapi-720-i.js');
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var _ovr = new URLSearchParams(location.search).get('xapiLib');
      if (_ovr && /^(\.\.?\/|\/)[^:]*$/.test(_ovr)) LIB720 = _ovr;   // same-origin relative only
    }
  } catch (e) {}
  window.XAPI_USING_G = /xapi-720-[ghijk]\.js/.test(LIB720);

  loadScript(CDN + 'xapiwrapper.min.js', function () {
    loadScript(LIB720, function () {
      try {
        getXAPIParameters(XAPI_METADATA_FILE);

        /* ═══ Resume phase A — read the document, hop between parts, align the character ═══
           ── Why here, before the poll ──
           The cover (#boot-cover) hides screen 0 until it is known what to draw, so its lifetime
           is the learner's wait. This step sits before pollMetadataReady deliberately: the poll
           is bounded at 10 seconds, and a learner staring at a cover for 10 seconds is a worse
           regression than the flash the cover exists to fix.

           Running early is allowed because getXAPIParameters sets window.slxapi,
           XAPI_REGISTRATION and XAPI_DISABLED SYNCHRONOUSLY before it touches metadata, and
           loadState720 works over a raw XHR using window.slxapi.auth — not through
           ADL.XAPIWrapper, so it does not depend on the changeConfig below either. Nothing here
           depends on the metadata file.

           ⚠️ What was deliberately NOT moved early: _resumeReady. It stays in phase B. Setting it
           here would open a window in which any goTo() arms a save that overwrites
           doc.parts[slug] with a fresh payload — a write before the restore, which is exactly
           what every write path is built to prevent. Phase A is therefore READ-ONLY:
           applyUnitProfile aligns memory and cache, and does not touch the document. */
        var _saved   = null;
        var _payload = null;
        if (RESUME_ENABLED) {
          try {
            _saved = readUnitState();
            if (_saved.part && _saved.part !== currentPartSlug()) {
              /* replace(), not href: keeps the abandoned part out of the back-stack, where Back
                 would land on a URL that immediately hops forward again. The query string rides
                 along as on every hop — without it the registration is lost and every later part
                 reports nothing.
                 The cover is deliberately NOT dropped here: the page is leaving, and the cover
                 hides the glimpse of this part that the learner would otherwise see.
                 __resumeInFlight is set so the markup safety net does not expose screen 0 if the
                 navigation itself is slow. */
              window.__resumeInFlight = true;
              window.location.replace('../' + _saved.part + '/index.html' + window.location.search);
              return;
            }
            /* The character — the reason this whole phase exists. Until v4 it lived only in
               localStorage, so continuing from another machine painted the wrong avatar.
               Called unconditionally rather than only when there is a payload: a learner whose
               document has no slot for this part never enters applyExecutionState at all, and
               would miss the alignment. */
            if (applyUnitProfile(_saved)) {
              /* Screen 0 was already painted by the init block in script.js using the previous
                 character. Repaint here, behind the cover, before it is removed. */
              try { resetScreenState(currentScreen); } catch (e) {}
            }
            _payload = _saved.parts[currentPartSlug()];

            /* ── No payload → no screen to restore → no reason to hold the cover ──
               A first-time learner gets an empty document, therefore an empty parts[], therefore
               the cover drops here — at the earliest possible moment, without waiting for
               pollMetadataReady. The character fix, if there was one, was already painted
               synchronously one line above.
               dropBootCover also clears __resumeInFlight, so the safety net returns to its normal
               800ms behaviour. If there IS a payload the flag stays set and the cover is held
               until phase B. */
            if (!_payload) dropBootCover();
          } catch (e) {
            console.error('[resume] read', e);
            dropBootCover();
          }
        } else {
          /* Resume off — there is nothing to restore and never will be. */
          dropBootCover();
        }

        pollMetadataReady(function () {
          try {
            try { ADL.XAPIWrapper.changeConfig({ endpoint: window.slxapi.endpoint, auth: window.slxapi.auth }); } catch (e) {}

            /* ── The id verification gate ──
               XAPI_ID_PREFIX is the only value in the shared layer that was set by inference (see
               10-identity.js). Here it is checked against the source of truth on every load of
               every part: window.METADATA.id is this component's id as written in metadata/, and
               XAPI_COMP_ID is what the code will actually send. A mismatch here — including one
               trailing slash or one capital letter — means every statement this component sends
               points at an object that does not exist in the catalog. Without this check that is
               a completely silent failure: the library will happily send a wrong id and Kata will
               accept it.
               A warning, not a throw: bad reporting beats a lomda that falls over. */
            try {
              var _metaId = window.METADATA && window.METADATA.id;
              if (_metaId && typeof XAPI_COMP_ID !== 'undefined' && _metaId !== XAPI_COMP_ID) {
                console.error('[xAPI] ID MISMATCH — the code will send an id that is not in the catalog.\n' +
                  '  metadata/ says: ' + _metaId + '\n' +
                  '  the code sends: ' + XAPI_COMP_ID + '\n' +
                  '  Fix XAPI_ID_PREFIX in unit-js/10-identity.js or XAPI_COMP_SLUG in this component.');
              }
            } catch (e) {}

            /* ═══ Resume phase B — open the writes and run the restore ═══
               Reading the document and the cross-part hop already happened in phase A above. What
               is left here is exactly what has to run after the metadata is ready: the restore,
               which ends with applyExecutionState sending the item 'initialized' via xapiOnScreen.

               The position is unchanged — AFTER changeConfig and BEFORE the component
               'initialized' — because that is what stops a session merely PASSING THROUGH this
               part from leaving a statement behind: the early return in phase A jumps out before
               anything is sent.

               _resumeReady is set only here, never in phase A: it is the gate on every write
               path, and a write opened before the restore overwrites doc.parts[slug] with a fresh
               payload. It is also set in the catch — a failed read should not disable saving for
               the rest of the session, and certainly should not silence reporting. */
            var _resumed = false;
            if (RESUME_ENABLED) {
              try {
                _resumeReady = true;
                if (!_unitState) _unitState = emptyUnitState();
                /* A choice made in the window between the phases is waiting in the queue. Drained
                   BEFORE the restore, because it is newer than the document and therefore wins. */
                drainPendingUnitState();
                /* The hash wins over the document in choosing the SCREEN — '#screen=N' comes from
                   a "חזרה" click, i.e. from an explicit learner intent right now, whereas the
                   document describes where they once were.

                   ⚠️ But it does NOT win over the state RESTORE. A condition here that skipped
                   applyExecutionState whenever a hash was present would make cross-part "back"
                   lose the entire restore — including XAPI_Q_RESULTS, from which the forward
                   routing is derived (getQuizScore), so a learner who had met the threshold would
                   be sent into remediation. Always restore; pass the screen as an override.

                   parseInt rather than the raw capture: applyExecutionState checks
                   `typeof === 'number'`, and a string would fall through to the fallback and pull
                   the learner off the screen the hash brought them to. */
                var _hm = /^#screen=(\d+)$/.exec(window.location.hash);
                if (_payload) {
                  applyExecutionState(_payload, _hm ? parseInt(_hm[1], 10) : undefined);
                  _resumed = true;
                }
              } catch (e) {
                console.error('[resume] init', e);
                _resumeReady = true;
                if (!_unitState) _unitState = emptyUnitState();
              }
            }

            /* The normal path for removing the cover: by here it is known what to draw — the
               character was aligned in phase A and the target screen was painted in phase B.
               Called whether resume is off or there was no payload, so it is not inside any
               branch. The markup safety net (inline script, 800ms) sits above this and covers
               any path that does not reach here at all. */
            dropBootCover();

            try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}
            try { xapiWireVideos(); } catch (e) {}
            /* Item-level init for the landing screen. On a resume, applyExecutionState already
               emitted it for the restored screen. */
            if (!_resumed) { try { xapiOnScreen(currentScreen); } catch (e) {} }
            if (typeof onXapiReady === 'function') {
              try { onXapiReady(); } catch (e) { console.error('[xAPI] ready hook', e); }
            }
          } catch (e) { console.error('[xAPI] init', e); dropBootCover(); }
        });
      } catch (e) { console.error('[xAPI] load', e); dropBootCover(); }
    });
  });
}
