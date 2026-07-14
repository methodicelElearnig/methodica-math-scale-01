# ARCHITECTURE — לומדה קנה מידה — תיקייה 04

## סטאק טכנולוגי

- **HTML5** — סמנטי, RTL מהשורש
- **CSS3** — ללא framework, ללא CDN חיצוני
- **Vanilla JavaScript** — ES6+, `'use strict'`
- **פונטים** — `Assistant` (עברית), טעינה מקומית בלבד מ-`assets/fonts/` דרך `@font-face` ב-`styles.css`
- **אין**: React, Vue, jQuery, Tailwind, build tools, CDN scripts

---

## מבנה קבצים

```
methodica-math-scale-01-04/
├── index.html          ← 6 מסכים (0–5), single-page
├── index_dev.html       ← עוטף index.html ב-iframe, מוסיף סרגל ניווט למסכים (dev-only)
├── styles.css           ← כל הסטיילים
├── script.js            ← כל הלוגיקה
├── ARCHITECTURE.md       ← מסמך זה
├── PROJECT_BRIEF.md      ← תקציר פרויקט + מיפוי מסכים
└── assets/
    ├── fonts/           ← קבצי פונט מקומיים (Assistant, כל המשקלים)
    ├── images/          ← תמונות הרקע/דמויות/מפות הרלוונטיות ל-6 המסכים
    └── icons/           ← (ריק כרגע) README.md מניפסט
```

> **עדכון:** מסכים 7–17 (שאלת השיא — "סיירת הרחפנים") הועברו לתיקייה עצמאית נפרדת, `methodica-math-scale-01-05`. הם הוסרו מ-`index.html`/`styles.css`/`script.js` של תיקייה זו. כפתור ה"המשך" במסך 5 מנווט אליהם בעזרת `window.location.href` (ניווט אמיתי בין דפים, לא `goTo()` פנימי) — ראו `goToNextModule()` ב-`script.js`.

---

## גודל קנבס וסקיילינג

```
קנבס קבוע: 1280 × 720 px
```

```css
#app {
  width: 1280px;
  height: 720px;
  position: absolute;
  transform-origin: top left;
  overflow: hidden;
  background: #ffffff;
}
```

```js
function scaleApp() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 710;
  const scale = Math.min(scaleX, scaleY);
  const left = (window.innerWidth - 1280 * scale) / 2;
  const top = (window.innerHeight - 710 * scale) / 2;
  const el = document.getElementById('app');
  el.style.transform = `scale(${scale})`;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}
window.addEventListener('resize', scaleApp);
scaleApp();
```

---

## ניווט גלובלי

```js
const TOTAL_SCREENS = 6; // מסכים 0–5
let currentScreen = 0;

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const nextScreen = document.querySelector(`[data-screen="${n}"]`);
  if (!nextScreen) return;
  nextScreen.classList.add('active');
  currentScreen = n;
  resetScreenState(n);
  nextScreen.focus();
  const heading = nextScreen.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());
}

function resetScreenState(n) {
  if (n === 0) { s36Enter(); }
  if (n === 1) { s37Enter(); }
  if (n === 2) { s38Enter(); }
  if (n === 3) { s39Enter(); }
  if (n === 4) { s40Enter(); }
  if (n === 5) { s41Enter(); }
}

// יציאה מהתיקייה — ניווט דפים אמיתי, לא goTo() פנימי
function goToNextModule() {
  window.location.href = '../methodica-math-scale-01-05/index.html';
}
```

מזהי הפונקציות הפנימיים (`s36`–`s41`) **אינם תואמים** את מספרי ה-`data-screen` בהכרח באופן ישיר לאורך שאר הקוד (למשל `.s0-content`/`.s6-char-img`/`.s17-img-wrap` הם שמות מחלקות גנריים המשמשים גם במסך 0) — אלו שרידי מספור פנימי היסטורי. אין בזה בעיה תפקודית.

---

## תבנית שאלה משותפת (`.s18-*`)

מסכים 1–5 (חלקם או כולם) חולקים תבנית עיצוב משותפת לשאלות:

```html
<div class="s18-nav" dir="rtl">…נקודות התקדמות…</div>
<div class="s18-question">
  <div class="s18-q-layout">
    <div class="s18-q-right">…טקסט השאלה + תשובות/קלט…</div>
    <div class="s18-q-left">…תמונה + כפתור הגדלה…</div>
  </div>
</div>
<div class="s5-inline-feedback s18-feedback-bar" hidden>…</div>
<div class="s16-hint-popup" hidden>…</div>
```

- תשובות MCQ משתמשות ב-`.s5-answers`/`.s5-opt`.
- קלט מספרי משתמש ב-`.s18-fill-row`/`.s18-answer-box`.
- מסך 2–3 (Q2) כולל גם Drag & Drop (`.ddq-*` / `.s39-*`) לגרירת מידות לטבלה.
- מסך 4–5 (Q3) כולל כלי סרגל גרירה (`.s18-ruler`) למדידה על תמונה.
- הגדלת תמונה: `.img-zoom-btn` פותח overlay גלובלי (`#img-zoom-v04-sN`).

---

## Bottom Bar — Pattern משותף

```css
.bottom-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 74px;
  background: #FFFFFF;
  border-top: 0.4px solid #AEAEAE;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 24px;
}
```

מסכי שאלה מוסיפים `.s3-bottom-bar` (מפעיל `justify-content: space-between`) + כפתור `.btn-back-s3` בצד ימין.

---

## כללי RTL

- `<html dir="rtl" lang="he">` — RTL גלובלי
- "הבא"/"המשך" = כפתור בצד **שמאל**; "חזרה" = כפתור בצד **ימין**
- **אסור** `direction: ltr` על container שלם — רק על אלמנט בודד עם סיבה

---

## נגישות (Accessibility)

- `#a11y-announcer` — `aria-live="polite"`, מקבל טקסט הכותרת בכל מעבר מסך (`goTo`)
- כל `.s5-inline-feedback` מקבל `role="status"`/`aria-live="polite"` (הגדרה גלובלית ב-JS)
- כל `section.screen` מקבל `tabindex="-1"` לצורך `.focus()` תכנותי
- כפתור דיווח על תקלה (`#flag-btn`) עם `aria-label`, ומודל דיווח מלא (`role="dialog"`, `aria-modal`)

---

## תכונות גלובליות (chrome)

| תכונה | קבצים מרכזיים |
|---|---|
| דיווח על תקלה | `#flag-btn`, `#report-modal`, `#report-confirm-modal` (HTML) + `openReportModal`/`submitReport`/... (JS) |
| הגדלת תמונה | `.img-zoom-btn`/`.img-zoom-overlay` (HTML+CSS) + `openImgZoom`/`closeImgZoom` (JS) |
| גרירת תיבות פידבק | IIFE ב-`script.js` שמאזין ל-`mousedown`/`touchstart` על `.s5-inline-feedback` |
| כלי פיתוח (`index_dev.html`) | `postMessage` דו-כיווני עם `script.js` (`DEV_GOTO`/`DEV_READY`) |

---

## מוסכמות נתיבי Assets

כל הנתיבים יחסיים — ללא `/` מוביל, ללא URL מוחלט. ראו `PROJECT_BRIEF.md` לרשימת הקבצים בשימוש בפועל.

> **הערה:** קיים בקובץ `styles.css`/`script.js` קוד מת שלא היה בשימוש כבר לפני הפיצול לתיקייה 05 (לדוגמה `.s7-*`/`.s8-*`, פונקציות `s42*`, בלוק `[data-screen="43"]`) — שרידים ממודול-מקור משותף. לא טופלו כחלק מהפיצול הזה כי אינם קשורים אליו; ניקוי נפרד אם רלוונטי.
