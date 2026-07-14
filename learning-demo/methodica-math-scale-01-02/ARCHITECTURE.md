# ARCHITECTURE — לומדה קנה מידה

## סטאק טכנולוגי

- **HTML5** — סמנטי, RTL מהשורש
- **CSS3** — ללא framework, ללא CDN חיצוני
- **Vanilla JavaScript** — ES6+, `'use strict'`
- **פונטים** — `Assistant` (עברית), טעינה מקומית בלבד מ-`assets/fonts/` דרך `@font-face` ב-`styles.css`
- **אין**: React, Vue, jQuery, Tailwind, build tools, CDN scripts

---

## מבנה קבצים

```
learning-demo/
├── index.html          ← כל המסכים, single-page
├── styles.css          ← כל הסטיילים
├── script.js           ← כל הלוגיקה
└── assets/
    ├── fonts/          ← קבצי פונט מקומיים (אם נדרש offline)
    ├── images/         ← תמונות ורקעים (ייצוא מפיגמה + אספקת משתמש)
    │   └── README.md   ← מניפסט assets
    └── icons/          ← אייקונים SVG/PNG
        └── README.md   ← מניפסט אייקונים
```

---

## גודל קנבס וסקיילינג

```
קנבס קבוע: 1280 × 710 px
```

```css
#app {
  width: 1280px;
  height: 710px;
  position: absolute;
  transform-origin: top left;
  overflow: hidden;
}
```

```js
function scaleApp() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 710;
  const scale = Math.min(scaleX, scaleY);
  const left = (window.innerWidth - 1280 * scale) / 2;
  const top = (window.innerHeight - 710 * scale) / 2;
  document.getElementById('app').style.transform = `scale(${scale})`;
  document.getElementById('app').style.left = left + 'px';
  document.getElementById('app').style.top = top + 'px';
}
window.addEventListener('resize', scaleApp);
scaleApp();
```

---

## מבנה HTML בסיסי

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>קנה מידה — לומדה</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <!-- Screen 0: בחירת דמות -->
    <section class="screen active" data-screen="0">…</section>

    <!-- Screen 1: הוק — קנה מידה -->
    <section class="screen" data-screen="1">…</section>
  </div>
  <script src="script.js"></script>
</body>
</html>
```

---

## Screen 0 — בחירת דמות (TwoOptionSelection)

### HTML Pattern

```html
<section class="screen active" data-screen="0">
  <div class="select-content">
    <div class="select-head">
      <h1 class="select-title">איזו דמות תרצו שתלווה אתכם?</h1>
    </div>
    <div class="option-cards" role="radiogroup" aria-label="בחרו דמות מלווה">
      <div class="option-card" role="radio" aria-checked="false"
           tabindex="0" data-value="text" onclick="selectOption(this)">
        <div class="option-card-img">
          <img src="./assets/images/char-placeholder.png" alt="דמות טקסטים">
        </div>
        <div class="option-card-labels">
          <span class="option-card-name">טקסטים קצרים</span>
          <span class="option-card-desc">שמסבירים את המושגים</span>
        </div>
      </div>
      <div class="option-card" role="radio" aria-checked="false"
           tabindex="0" data-value="video" onclick="selectOption(this)">
        <div class="option-card-img">
          <img src="./assets/images/char-placeholder.png" alt="דמות סרטון">
        </div>
        <div class="option-card-labels">
          <span class="option-card-name">סרטון קצר (מאוד)</span>
          <span class="option-card-desc">שמסביר את המושגים</span>
        </div>
      </div>
    </div>
  </div>
  <!-- Bottom Bar -->
  <div class="bottom-bar">
    <button class="btn-continue" id="s0-continue" disabled onclick="advanceFromS0()">
      להמשיך
    </button>
  </div>
</section>
```

### CSS Classes — Screen 0

| Class | תפקיד |
|---|---|
| `.select-content` | wrapper ראשי, flex column, centered |
| `.select-head` | אזור כותרת |
| `.select-title` | H1, Assistant Bold 40px, #303030 |
| `.option-cards` | flex row, gap 24px, justify-center |
| `.option-card` | כרטיסייה 296px, border 3px solid rgba(201,206,216,0.4), radius 16px |
| `.option-card:hover` | border-color: #1CB0F6 |
| `.option-card.selected` | border-color: #1CB0F6, background: #EAF6FF |
| `.option-card-img` | wrapper תמונה, border-radius 16px, overflow hidden |
| `.option-card-name` | Assistant Bold 32px, #303030 |
| `.option-card-desc` | Assistant Regular 24px, #303030 |

### JS — Screen 0

```js
function selectOption(cardEl) {
  // הסרת בחירה קודמת
  document.querySelectorAll('#app [data-screen="0"] .option-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  // בחירה חדשה
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');
  window.lomdaState.selectedCharacter = cardEl.dataset.value;
  // הפעלת כפתור המשך
  document.getElementById('s0-continue').disabled = false;
}

function advanceFromS0() {
  if (!window.lomdaState.selectedCharacter) return;
  goTo(1);
}
```

---

## Screen 1 — הוק: קנה מידה (Scrollable Hook)

### HTML Pattern

```html
<section class="screen" data-screen="1">
  <!-- Header -->
  <div class="screen-header">
    <button class="btn-back" onclick="goTo(0)" aria-label="חזרה">
      <img src="./assets/icons/icon-back.svg" alt="">
    </button>
  </div>

  <!-- Scrollable Card -->
  <div class="hook-card">
    <div class="hook-card-inner">

      <!-- Section A: טקסט + מגרש + סליידר -->
      <div class="hook-section hook-section-top">
        <p class="hook-intro">
          אתם רוצים לצלם עם רחפן את משחק גמר ליגת הכדורגל של קבוצת הנוער העירונית.
          הגדירו את גובה הרחפן באמצעות הכפתור ובדקו:
          <strong>באיזה יחס נוכל לראות את מספר החולצה של השחקן במרכז המגרש?</strong>
        </p>
        <div class="scale-widget">
          <div class="scale-field">
            <img id="field-img" src="./assets/images/field-zoom-1000.png" alt="תצוגת מגרש">
          </div>
          <div class="scale-slider" role="group" aria-label="בחרו יחס קנה מידה">
            <button class="scale-stop active" data-ratio="1000" onclick="setScale(1000)">1:1,000</button>
            <button class="scale-stop" data-ratio="100"  onclick="setScale(100)">1:100</button>
            <button class="scale-stop" data-ratio="10"   onclick="setScale(10)">1:10</button>
          </div>
        </div>
      </div>

      <!-- Section B: גילינו + מפת עיר (TBD) -->
      <div class="hook-section hook-section-mid">
        <!-- טקסט + city-map.png — תוכן ממתין לאישור -->
      </div>

      <!-- Section C: אדריכלות (TBD) -->
      <div class="hook-section hook-section-bottom">
        <!-- טקסט + architectural-plan.png — תוכן ממתין לאישור -->
      </div>

    </div>
  </div>

  <!-- Bottom Bar -->
  <div class="bottom-bar">
    <button class="btn-continue" onclick="goTo(2)">להמשיך</button>
  </div>
</section>
```

### CSS Classes — Screen 1

| Class | תפקיד |
|---|---|
| `.screen-header` | sticky top, height 64px, back button |
| `.hook-card` | wrapper חיצוני, background #F3F4F5, overflow hidden |
| `.hook-card-inner` | white bg, radius 48px, padding 40px, `overflow-y: auto`, `max-height: calc(710px - 64px - 74px)` |
| `.hook-section` | flex column, gap 24px |
| `.hook-intro` | Assistant Regular 26px, #303030, text-align: right |
| `.hook-intro strong` | font-weight: 700 |
| `.scale-widget` | flex row, gap 24px, align-items: center |
| `.scale-field` | container תמונת מגרש |
| `#field-img` | 573×381px, object-fit: cover |
| `.scale-slider` | flex column, gap 16px |
| `.scale-stop` | button כפתור עגול, Regular, default style |
| `.scale-stop.active` | צבע active: #8900E1, bold |

### JS — Screen 1

```js
function setScale(ratio) {
  const imgMap = {
    1000: './assets/images/field-zoom-1000.png',
    100:  './assets/images/field-zoom-100.png',
    10:   './assets/images/field-zoom-10.png',
  };
  document.getElementById('field-img').src = imgMap[ratio];

  document.querySelectorAll('.scale-stop').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.ratio) === ratio);
  });
}
```

---

## ניווט גלובלי

```js
'use strict';
const TOTAL_SCREENS = 2; // יעודכן כשמסכים נוספים יתווספו

let currentScreen = 0;
window.lomdaState = { selectedCharacter: null };

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-screen="${n}"]`).classList.add('active');
  currentScreen = n;
  resetScreenState(n);
}

function resetScreenState(n) {
  if (n === 0) {
    // שחזור בחירת דמות אם כבר נבחרה
    if (window.lomdaState.selectedCharacter) {
      const card = document.querySelector(`.option-card[data-value="${window.lomdaState.selectedCharacter}"]`);
      if (card) {
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        document.getElementById('s0-continue').disabled = false;
      }
    }
  }
  // מסכים נוספים יתווספו כאן
}
```

---

## Bottom Bar / Feedback — Pattern משותף

```css
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 74px;
  background: #FFFFFF;
  border-top: 0.4px solid #AEAEAE;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.btn-continue {
  background: linear-gradient(180deg, #8900E1 9%, #6500A5 100%);
  color: #FFFFFF;
  font-family: 'Assistant', sans-serif;
  font-size: 20px;
  font-weight: 400;
  border: none;
  border-radius: 1000px;
  width: 140px;
  height: 39px;
  cursor: pointer;
}

.btn-continue:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

---

## כללי RTL

- `<html dir="rtl" lang="he">` — RTL גלובלי
- `flex-direction: row` עם RTL הופך כיוון: ראשון מימין
- "הבא" (forward) = כפתור בצד **שמאל**; "חזרה" (back) = כפתור בצד **ימין**
- אייקון חץ "חזרה": `transform: scaleX(-1)` אם SVG מוטה לכיוון לא נכון
- **אסור** `direction: ltr` על container שלם — רק על אלמנט בודד עם סיבה

---

## נגישות (Accessibility)

- `<div role="radiogroup" aria-label="בחרו דמות מלווה">` על wrapper הכרטיסיות
- `role="radio" aria-checked="false/true"` על כל כרטיסייה
- `tabindex="0"` על כרטיסיות
- keyboard: `keydown` event — Enter/Space מפעיל `selectOption(this)`
- כפתורים עם `aria-label` כשאין טקסט גלוי (כפתור חזרה)

```js
// הוסף ל-DOMContentLoaded
document.querySelectorAll('.option-card').forEach(card => {
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectOption(card);
    }
  });
});
```

---

## מוסכמות נתיבי Assets

```
./assets/images/char-placeholder.png
./assets/images/football-yard.png
./assets/images/field-zoom-1000.png
./assets/images/field-zoom-100.png
./assets/images/field-zoom-10.png
./assets/images/city-map.png
./assets/images/architectural-plan.png
./assets/icons/icon-back.svg
```

כל הנתיבים יחסיים — ללא `/` מוביל, ללא URL מוחלט.

---

## Screen 4 — נגן וידאו (VideoPlayer) ⬅ חדש

> **⚠️ Figma node `10:3859` לא נגיש (rate limit)** — המבנה מתבסס על תיאור המשתמש + קונבנציות פרויקט. יש לאמת מול פיגמה לפני מימוש.

---

### HTML Pattern

```html
<section class="screen" data-screen="4" id="s4">

  <!-- Content area -->
  <div class="s4-content">

    <!-- Header text (כותרת + תיאור — TBD מפיגמה) -->
    <div class="s4-head">
      <h1 class="s4-title"><!-- כותרת מפיגמה --></h1>
    </div>

    <!-- Video / Placeholder -->
    <div class="s4-player-wrap">

      <!-- Placeholder state (נראה לפני לחיצה על "להתחיל") -->
      <div class="s4-placeholder" id="s4-placeholder">
        <div class="s4-placeholder-icon">▶</div>
      </div>

      <!-- Playing state (נראה לאחר לחיצה) -->
      <div class="s4-playing" id="s4-playing" hidden>
        <!-- כאן יכנס <video> אמיתי כשיהיה קובץ:
             <video id="s4-video" src="./assets/video/video-lesson.mp4"
                    controls controlsList="nodownload noplaybackrate"
                    disablepictureinpicture>
             </video>
        -->
        <div class="s4-placeholder-progress">
          <div class="s4-progress-bar" id="s4-progress-bar"></div>
        </div>
        <p class="s4-playing-label">הסרטון מתנגן...</p>
      </div>

      <!-- כפתור "להתחיל" — תמיד נגיש (re-watch) -->
      <button class="s4-start-btn" id="s4-start-btn" type="button" onclick="s4Start()">
        להתחיל
      </button>

    </div>
  </div>

  <!-- Bottom bar -->
  <div class="bottom-bar s4-bottom-bar">
    <!-- כיוון מסך 4: חזרה=שמאל, הבא=ימין (שונה ממסך 3) -->
    <button class="btn-continue" id="s4-next" disabled onclick="s4Advance()">
      הבא
    </button>
    <div class="s4-mode-toggle" role="group" aria-label="מצב למידה">
      <!-- "לצפות בסרטון" פעיל במסך זה -->
      <button class="s4-toggle-opt s4-toggle-opt--active" data-view="video" type="button">לצפות בסרטון</button>
      <button class="s4-toggle-opt" data-view="cards" type="button">להפוך קלפים</button>
    </div>
    <button class="btn-back-s4" type="button" onclick="goTo(2)">חזרה</button>
  </div>

</section>
```

**הבדל כיוון ממסך 3:**

| | מסך 3 (קלפים) | מסך 4 (וידאו) |
|---|---|---|
| כפתור ימין (DOM ראשון ב-RTL space-between) | חזרה | **הבא** |
| כפתור שמאל (DOM אחרון) | להמשיך | **חזרה** |
| toggle — active option | להפוך קלפים | **לצפות בסרטון** |

---

### CSS Classes — Screen 4

```css
/* Layout */
.s4-content {
  position: absolute;
  top: 0; left: 0; right: 0;
  bottom: 74px;                        /* מעל bottom bar */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 40px 80px;
}

.s4-head { text-align: center; }

.s4-title {
  font-family: 'Assistant', sans-serif;
  font-size: 40px;
  font-weight: 700;
  color: #7800C5;                      /* צבע accent כמו מסך 3 */
}

/* Player wrapper — aspect ratio ~16:9 */
.s4-player-wrap {
  position: relative;
  width: 760px;
  height: 428px;
  background: #1a1a2e;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Placeholder */
.s4-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.s4-placeholder-icon {
  font-size: 72px;
  color: rgba(255,255,255,0.25);
}

/* Playing state */
.s4-playing {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  color: #ffffff;
}

.s4-placeholder-progress {
  width: 80%;
  height: 6px;
  background: rgba(255,255,255,0.2);
  border-radius: 3px;
  overflow: hidden;
}

.s4-progress-bar {
  height: 100%;
  width: 0%;
  background: #1CB0F6;
  border-radius: 3px;
  transition: width 0.3s linear;
}

.s4-playing-label {
  font-family: 'Assistant', sans-serif;
  font-size: 22px;
  color: rgba(255,255,255,0.7);
}

/* Start button */
.s4-start-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #8900E1 9%, #6500A5 100%);
  color: #ffffff;
  font-family: 'Assistant', sans-serif;
  font-size: 20px;
  font-weight: 400;
  border: none;
  border-radius: 1000px;
  width: 140px;
  height: 39px;
  cursor: pointer;
  transition: opacity 0.2s;
  z-index: 2;
}

.s4-start-btn:hover { opacity: 0.88; }

/* Bottom bar */
.s4-bottom-bar {
  justify-content: space-between;
  position: relative;
}

/* כפתור חזרה — סגנון outline (זהה ל-.btn-back-s3) */
.btn-back-s4 {
  background: transparent;
  border: 1.5px solid #AEAEAE;
  border-radius: 1000px;
  color: #303030;
  font-family: 'Assistant', sans-serif;
  font-size: 20px;
  font-weight: 400;
  width: 100px;
  height: 39px;
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s;
}

.btn-back-s4:hover {
  border-color: #8900E1;
  color: #8900E1;
}

/* Toggle pill — זהה ל-s3, active option שונה */
.s4-mode-toggle {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  direction: rtl;
  background: #8900E1;
  border-radius: 1000px;
  padding: 5px;
  gap: 2px;
}

.s4-toggle-opt {
  border: none;
  border-radius: 1000px;
  padding: 7px 22px;
  font-family: 'Assistant', sans-serif;
  font-size: 18px;
  font-weight: 400;
  color: #ffffff;
  background: transparent;
  cursor: default;
  white-space: nowrap;
}

.s4-toggle-opt--active {
  background: #ffffff;
  color: #303030;
  font-weight: 700;
}
```

---

### JS — Screen 4

#### משתנים גלובליים (להוסיף לראש script.js)

```js
let s4VideoEnded = false;   // האם הסרטון/placeholder הסתיים לפחות פעם אחת
let s4Playing = false;      // האם מתנגן כעת
let s4Timer = null;         // timer לsimulate placeholder
```

#### resetScreenState — case n===4

```js
if (n === 4) { s4Enter(); }
```

```js
function s4Enter() {
  // איפוס UI אך שמירת s4VideoEnded ממפגש קודם
  document.getElementById('s4-placeholder').hidden = false;
  document.getElementById('s4-playing').hidden = true;
  document.getElementById('s4-next').disabled = !s4VideoEnded;
  s4Playing = false;
  clearInterval(s4Timer);
  // אם יש <video> אמיתי: document.getElementById('s4-video').pause();
}
```

#### s4Start() — הפעלת הנגן / placeholder

```js
function s4Start() {
  if (s4Playing) return;
  s4Playing = true;

  document.getElementById('s4-placeholder').hidden = true;
  document.getElementById('s4-playing').hidden = false;

  const bar = document.getElementById('s4-progress-bar');
  bar.style.width = '0%';

  /* ---- Placeholder simulation (להחליף ב-<video> events) ---- */
  const DURATION_MS = 5000;   // 5 שניות placeholder
  const start = Date.now();

  s4Timer = setInterval(() => {
    const pct = Math.min(100, ((Date.now() - start) / DURATION_MS) * 100);
    bar.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(s4Timer);
      s4Playing = false;
      s4VideoEnded = true;
      document.getElementById('s4-next').disabled = false;
    }
  }, 100);

  /* ---- כאשר יש <video> אמיתי, נחליף ב:
  const video = document.getElementById('s4-video');
  video.currentTime = 0;
  video.play();
  video.onended = () => {
    s4Playing = false;
    s4VideoEnded = true;
    document.getElementById('s4-next').disabled = false;
  };
  ---- */
}
```

#### s4Advance() — מעבר למסך הבא

```js
function s4Advance() {
  if (!s4VideoEnded) return;
  goTo(5);   // מסך 5 — TBD
}
```

#### עדכון advanceFromS2() — Branching

```js
function advanceFromS2() {
  if (!window.lomdaState.selectedDesign) return;
  if (window.lomdaState.selectedDesign === 'video') {
    goTo(4);
  } else {
    goTo(3);
  }
}
```

#### עדכון TOTAL_SCREENS

```js
const TOTAL_SCREENS = 5;   // 0,1,2,3,4
```

---

### Verification Checklist — Screen 4

- [ ] מסך 4 נגיש מ-advanceFromS2 כאשר selectedDesign === 'video'
- [ ] כפתור "להתחיל" → placeholder נעלם, progress bar רץ
- [ ] לאחר סיום placeholder (5 שניות) → "הבא" מופעל
- [ ] לחיצה חוזרת על "להתחיל" → re-watch, "הבא" נעלם שוב, חוזר לאחר סיום
- [ ] "חזרה" → goTo(2), ה-timer מבוטל
- [ ] חזרה למסך 4 → UI מאופס אך s4VideoEnded נשמר (אין צורך לצפות שוב)
- [ ] Toggle pill: "לצפות בסרטון" active (לבן), "להפוך קלפים" unselected (שקוף)
- [ ] RTL תקין בכל הטקסטים

---

## ⚠️ פערים שמחכים לתשובות

| # | שאלה | השפעה |
|---|---|---|
| 1 | **Figma node 10:3859** (מסך 4 — וידאו) לא נגיש (rate limit). כותרת, עיצוב נגן, פרופורציות מדויקות TBD. | יש לאמת לפני מימוש HTML |
| 2 | **סרטון בפועל** — `video-lesson.mp4` לא קיים. placeholder מדומה במקומו. | החלפה פשוטה: להחליף div ב-`<video>` |
| 3 | **כיוון כפתורים מסך 4** — user spec: חזרה=שמאל, הבא=ימין. יש לאמת מול פיגמה. | משפיע על DOM order בbottom bar |
| 4 | **מסכים 5+** — מסכים שאחרי הוידאו לא הוגדרו. advanceFromS4() כרגע goTo(5). | TBD |
