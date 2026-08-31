# Responsiveness — `methodica-math-scale-01`

The unit renders on a **1280px-wide canvas whose design height is fluid**. The canvas is uniformly
scaled to fit the viewport; after scaling it exactly fills the viewport height, so the bottom bar —
which carries the **המשך / בחרתי** button — always sits on the bottom edge and is always reachable.
On viewports wider than 16:9 the canvas is letterboxed left and right on white.

**Scope: all five components** (`-01` … `-05`). Two CSS values and one function per part.

> **Supersedes** `_methodica-math-scale-01/RESPONSIVITY.md`. That document described the same idea
> but covered component **-01 only** and targeted the older **710px** design height. This unit's
> design height is **720px**. Do not port numbers from it.

> **The science unit uses a different model.** `methodica-science-mass-measure-01` makes **both**
> axes fluid (`scaleApp()` sets `width = innerWidth / scale` as well) and never letterboxes. That
> does not work here: this unit's screens anchor content to **both** horizontal edges —
> `.flag-btn { left: 32px }`, `#s21-char-widget { right: 40px }`, and ten `left: 0; right: 0`
> full-width bars. A canvas wider than 1280 would pull those apart on every wide viewport. The width
> stays locked deliberately; if you ever want the science model here, every screen's content must
> first be wrapped in a centred 1280-wide box.

---

## 1. The problem this solves

The previous model fixed the canvas at **1280×720** and centred it vertically:

```js
const top = (window.innerHeight - 720 * scale) / 2;   // removed
```

On any viewport taller than 16:9 that leaves dead bands above **and** below the canvas, and the
bottom bar floats in the middle of the screen instead of at its bottom. At 1024×600 — a real
classroom-laptop size — the wasted band was 60px; on a 1280×1000 window it was 280px, with the
המשך button 140px above the bottom of the screen.

## 2. The model

Keep the scale formula unchanged. Make the canvas **design height** fluid instead.

```
scale        = min(innerWidth / 1280, innerHeight / 720)   // unchanged
appHeightCss = innerHeight / scale                         // fluid design height
left         = (innerWidth - 1280 * scale) / 2             // unchanged
top          = 0                                           // was: vertical centring
```

**Key property.** Because `scale ≤ innerHeight / 720`:

```
appHeightCss = innerHeight / scale ≥ innerHeight / (innerHeight / 720) = 720
```

**The canvas can never be shorter than the 720px design height.** Consequences:

1. The scaled canvas exactly fills the viewport height — no vertical overflow, nothing clipped.
2. The bottom bar (`position: absolute; bottom: 0`) sits on the true bottom edge at every size.
3. `top: Npx; bottom: 74px` containers grow and redistribute their flex content into the extra space.
4. Purely top-anchored screens can never *collide* with the bottom bar — that would require a
   sub-720px canvas, which cannot happen. They gain empty space below instead (see §6).
5. When the viewport is wider than 16:9, the canvas is letterboxed left/right on the white `body`.

At exactly **1280×720** the model is arithmetically identical to the old one (`scale = 1`,
`left = 0`, `top = 0`, `height = 720`). That makes 1280×720 the fastest regression check: it must
render pixel-identically to the previous build.

## 3. The changes

### 3.1 `script.js` — `scaleApp()`

Part 01 `:120`, part 02 `:54`, part 03 `:50`, part 04 `:75`, part 05 `:47`.

```js
function scaleApp() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  const left = (window.innerWidth - 1280 * scale) / 2;
  const el = document.getElementById('app');
  el.style.transform = `scale(${scale})`;
  el.style.height = (window.innerHeight / scale) + 'px';
  el.style.left = left + 'px';
  el.style.top = '0px';
  document.documentElement.style.setProperty('--sb-width', (12 / scale) + 'px');  // part 01 only
}
```

The `const top = …` line is gone; `top` is pinned to `'0px'`. **Width is not set here** — it lives in
CSS, single source of truth. The `resize` listener and the initial call were already present.

### 3.2 `styles.css` — `#app`

```css
#app {
  width: 1280px;
  height: 720px;        /* fallback while JS boots; scaleApp() overrides with the fluid height */
  min-height: 720px;    /* defensive floor */
  position: absolute;
  transform-origin: top left;
  overflow: hidden;
  background: #ffffff;
}
```

### 3.3 `styles.css` — `.screen`

```css
.screen {
  display: none;
  width: 1280px;
  height: 100%;         /* was 720px */
  min-height: 720px;
  position: relative;
}
```

**This is the load-bearing edit.** Without it the screens stay 720px inside a taller `#app`, the
bottom bar does not move, and a white band opens below it. `.screen` is a direct child of
`<main id="app">`, so `height: 100%` resolves against the fluid height.

### 3.4 `styles.css` — `body`

```css
body { background: #ffffff; overflow: hidden; font-family: 'Assistant', sans-serif; }
```

Added to parts 01–04; part 05 already had it. This is the left/right letterbox colour.

### 3.5 Nothing else

No per-screen CSS, no HTML structure changes, no changes to the drag/ruler code, and no changes to
the xAPI or bug-report blocks.

## 4. Why the existing layout absorbs the extra height

The screens were already written in a stretch idiom, which is why this change needed no per-screen
work. Verified live at 1280×1000 (design height 1000, i.e. 280px of extra space):

| Pattern | Examples | Behaviour on a taller canvas |
|---|---|---|
| `top: Npx; bottom: 74px` | `.hook-card`, `.s4-content`, `.s5-body`, `.s8-layout`, `.s16-content` | **Grows.** Absorbs the extra height; internal flex redistributes |
| `bottom: 84px` | `.character-widget`, `#s7-char-widget`, `#s12-char-widget`, `#s21-char-widget` | Follows the bar down, keeping its 10px gap above it |
| `bottom: 96px` | `.s18-feedback-bar` (part 05) | Follows the bar down |
| `bottom: 0` | `.bottom-bar`, `.s3-bottom-bar`, `#s5-bottom-bar`, `.s18-bottom-bar` | Lands on the true canvas bottom |
| `inset: 0` + `object-fit: cover` | `.s44-bg` / `.s44-bg-img` (part 05, 5 screens) | Fills the taller canvas, no distortion, no inner letterbox |
| `height: 100%` inside a fixed-size card | `.option-card-img img`, `.frc-card-inner`, `.s5-img-wrap img`, … | Unaffected — none is a direct child of `.screen` |

**Measured benefit on the scrolling screens.** Going from a 720 to a 1000 design height on part 01:

| Screen | Scroll container | Visible height 720 → 1000 | Content hidden below the fold |
|---|---|---|---|
| 1 (hook) | `.hook-card-inner` | 558 → **838** | 1234 → **954** |
| s3 (cards path) | `#s3-body` | 614 → **894** | 1446 → **1166** |
| s4 (video path) | `#s4-body` | 614 → **894** | 1354 → **1074** |

Each gains exactly the 280px the canvas gained. All three container boxes still end at design-y 910,
above the bar top at 926 — nothing paints into the bar's band.

## 5. Verified behaviour

Served from this repo over `http://localhost` and measured in-browser with
`getBoundingClientRect()` on `#app` and on the active screen's bottom bar.

| Viewport | scale | canvas design-h | canvas visual-h | vert. overflow | letterbox each side | המשך button |
|---|---|---|---|---|---|---|
| 1280×720 | 1.00 | 720 | 720 | 0 | 0 | ✅ hit-test passes |
| 1600×900 | 1.25 | 720 | 900 | 0 | 0 | ✅ |
| 1920×1080 | 1.50 | 720 | 1080 | 0 | 0 | ✅ hit-test passes |
| 2560×1440 | 2.00 | 720 | 1440 | 0 | 0 | ✅ |
| 1024×600 | 0.80 | **750** | 600 | 0 | 0 | ✅ |
| 1920×720 | 1.00 | 720 | 720 | 0 | **320** | ✅ |
| 1280×1000 | 1.00 | **1000** | 1000 | 0 | 0 | ✅ |
| 1600×1000 | 1.25 | **800** | 1000 | 0 | 0 | ✅ |

At every size: `document.documentElement` reports **zero** scroll overflow in both axes, and the
design height is ≥ 720 as the proof in §2 requires.

**All 51 screens, all five parts, at design height 1000:**

| Part | Screens | All at full canvas height | Bottom bar on the canvas bottom |
|---|---|---|---|
| 01 | 22 | ✅ | 22 / 22 |
| 02 | 9 | ✅ | 9 / 9 |
| 03 | 3 | ✅ | 3 / 3 |
| 04 | 6 | ✅ | 6 / 6 |
| 05 | 11 | ✅ | 11 / 11 |

Also confirmed:

- **Hit-test, not just visibility.** `document.elementFromPoint()` at the centre of the המשך button
  returns the button itself (`BUTTON#s0-continue.btn-continue`) at 1024×600 through 2560×1440. The
  original bug was a button that was *painted* but unreachable, so visibility alone is not enough.
- **Ruler drags stay 1:1.** Part 01's s18 ruler: at scale 1.0 a 100px viewport drag moves it 100
  design px; at scale 1.5 a 150px viewport drag moves it exactly 100 design px (= 150 visual px).
  `s18GetScale()` returns exactly the applied scale at both sizes.
- **Draggable feedback popups** (parts 02/04/05) still convert coordinates correctly. Their
  `getAppTransform()` reads `app.style.top` live, so pinning it to `0` needed no code change.
- **The report modal** covers the full fluid canvas (800px at 1600×1000) and its panel stays centred
  within it (top 122 / bottom 678) and fully inside the canvas.
- **Mid-flow resize is safe.** Resizing after navigating to another screen re-fits the canvas without
  losing `currentScreen` or any screen state.
- **Gating unaffected.** `#s0-continue` is disabled until a card is picked, then enables and advances.
- **No console errors** in any part.

### Not verified here

- **Real devices / real browser chrome.** All sizes were CDP viewport overrides in one engine.
- **A visual, eyes-on pass of all 51 screens.** The checks above are geometric: they prove nothing
  is clipped, unreachable, or colliding, but they cannot judge whether a composition *looks* right
  with more air in it. See §6.

## 6. Known cosmetic consequence — extra space on the top-anchored question screens

The `.s18-question` family is positioned purely from the top with no bottom anchor and no height:

```css
.s18-question { position: absolute; right: 40px; left: 40px; top: 139px; }
```

On a tall viewport these screens keep their design proportions at the top and the extra height opens
up as empty space between the content and the bottom bar. Nothing is clipped, nothing collides, and
the button stays reachable — it is purely a question of composition.

**This is deliberately left as-is.** Vertically centring these screens would change the look of the
graded questions, which is a content-design decision, not a technical one. If you decide to take it,
this is the whole change — it is **not applied**:

```css
/* NOT APPLIED — opt-in only. Centres the top-anchored question block in the extra
   vertical space instead of leaving it all below the content. */
.s18-question {
  top: 139px;
  bottom: 74px;                 /* stretch to the bar instead of auto height */
  display: flex;
  flex-direction: column;
  justify-content: center;      /* was: content sits at the top */
}
```

Apply it to one screen and review before rolling it across the family — several screens in the family
carry per-screen overrides (`#s20 .s18-feedback-bar`, `#s21 .s18-console-img`, `#s6 .s18-q-left`, …)
that interact with it.

## 7. Invariants to preserve

1. **`scaleApp()` and `s18GetScale()` must compute the same scale.** Both are
   `Math.min(innerWidth / 1280, innerHeight / 720)`. If one changes, change the other, or part 01's
   ruler stops tracking the cursor. The duplication is marked with a comment at
   `methodica-math-scale-01-01/script.js` above `s18GetScale()`.
2. **`transform-origin: top left`** on `#app` is required by the top-left-anchored transform.
3. **`top` must stay `0`.** Re-introducing vertical centring reopens the original bug.
4. **Keep applying `transform` / `left` / `top` as *inline* styles.** `getAppTransform()` in parts
   02/04/05 parses them off `app.style` to convert pointer coordinates into design space. Moving
   them into a stylesheet or a CSS custom property would silently break every drag interaction.
5. **`#app { overflow: hidden }`** is what guarantees nothing can paint outside the canvas.
6. **Part 01's `--sb-width`** (`12 / scale`) must keep being set — three rules consume it.
7. **Do not set `width` in `scaleApp()`.** The 1280 lock belongs in CSS; two sources would drift.

## 8. Cache-buster rule

Both files are served from the CDN, so **any** change to `script.js` or `styles.css` must bump its
query string in that part's `index.html` or returning learners keep the cached copy. `styles.css`
was previously referenced bare — this release gave it a query string for the first time, which is
mandatory here: stale CSS keeps `.screen` at 720px while the new JS grows `#app`, so the fix would
silently not apply.

| Part | `styles.css` | `script.js` |
|---|---|---|
| 01 | `?v=2` | `?v=4` |
| 02 | `?v=2` | `?v=4` |
| 03 | `?v=2` | `?v=4` |
| 04 | `?v=2` | `?v=5` |
| 05 | `?v=2` | `?v=3` |

`index_dev.html` needs no bump — it loads `index.html` in an iframe rather than referencing the
assets directly.

> ⚠️ All five `index.html`, `script.js` and `styles.css` are **CRLF with a UTF-8 BOM**. Edit them
> with tooling that preserves both — `[System.IO.File]::WriteAllText` drops the BOM by default,
> which has already caused one regression on this repo. Verify before committing:
>
> ```bash
> python -c "b=open('methodica-math-scale-01-01/index.html','rb').read(); print(b[:3]==b'\xef\xbb\xbf', b.count(b'\n')-b.count(b'\r\n'))"
> ```
>
> Expect `True 0` — BOM present, zero LF-only line endings.

## 9. How to re-verify

1. Serve the repo root over HTTP (`python -m http.server 8731`) and open
   `/methodica-math-scale-01-0N/index.html`.
2. **The viewport override does not fire `resize`.** After changing the window size, dispatch it
   yourself before measuring, or reload:
   ```js
   window.dispatchEvent(new Event('resize'));
   ```
   Forgetting this reads stale geometry and looks like the listener is broken.
3. For each size, assert `#app` visual height == `innerHeight`, `parseFloat(app.style.height) >= 720`,
   and zero scroll overflow on `document.documentElement`.
4. Hit-test the המשך button with `document.elementFromPoint()` at its centre — do not settle for
   `getBoundingClientRect()` being on-screen.
5. To audit every screen without walking the gates, toggle the `.active` class directly, measure, and
   restore. Convert rects to design space by dividing by the applied scale.
6. **Expect three false positives** in any "content extends past the canvas" audit: screens 1, s3 and
   s4 of part 01. Their content lives inside scroll containers (`.hook-card-inner`, `#s3-body`,
   `#s4-body`), so `getBoundingClientRect()` reports the full scroll extent. Check the *container's*
   box against the bar instead — and note the numbers **shrink** as the canvas grows (§4), which is
   the fix working.
7. Regression gate: at **1280×720** everything must be pixel-identical to the previous build.
