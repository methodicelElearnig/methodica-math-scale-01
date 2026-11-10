# Image re-encode — 2026-11-10

Per `Documentation/reporting-and-resume/BOOT-AND-RESUME-HARDENING-2026-11-03.md` §2.4 (the unit is heavy:
part 01 carried 18.6 MB of referenced images, every one fetched at load before the 2026-11-10 lazy
attributes). Tool: `docs-and-tools/reencode-media.py` (ported from methodica-math-percent-06), boxes in
`docs-and-tools/media-display-boxes.json`, one row per file in `reencode-rows.md`.

| | Before | After |
|---|---|---|
| Files re-encoded | 38 (all parts) | 38, every one renamed `<stem>-opt.<ext>`, references rewritten |
| Bytes | 24,457,197 | 5,007,912 |
| Part 01 images | 18.1 MB | 2.4 MB |

- **Boxes** were measured in Chrome, not read from the CSS: every screen of every part at 1280×800,
  every zoom panel opened, `getBoundingClientRect` over the `#app` scale, object-fit applied (a
  `contain` box is the fitted image). The poses are drawn in the same elements for both characters.
- **Type kept** (PNG → PNG quantized 256 colours + oxipng, JPEG → JPEG q82 progressive); the 1280-wide
  backgrounds of part 05 and the zoomable JPEGs keep their pixels (2 × the 660 zoom panel exceeds them).
- **Not touched:** `Character1.png` / `Character2.png` (the parts build them as `char + '.png'`, and
  Character2.png is under the 100 KB floor; renaming one family would break the other), two files
  referenced nowhere and never shipped (`ChatGPT Image …png`, `Tel Aviv Map - Copy.jpg`), files under
  100 KB, SVGs, `unit-assets/`, and part 05's two `VID Happy.mp4` clips (12 MB each, set by script on
  the last screen, outside the boot window — §2.5 leaves such clips).
- **Runtime-built names** carry `-opt` by hand: part 01 and 05 `preloadImages`, part 05 s43
  `setImgSrc`; `_test/verify-report.js` `PRELOAD_VARIANTS` checks every built name exists.
- **Visual pass** (Chrome, both characters): every image of every screen loaded (`naturalWidth > 0`,
  no 4xx), poses, guided-practice and football images inspected at full size: no banding, no halo.
