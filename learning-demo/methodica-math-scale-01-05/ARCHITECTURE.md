# ARCHITECTURE — לומדה קנה מידה — תיקייה 05

## סטאק טכנולוגי

- **HTML5** — סמנטי, RTL מהשורש
- **CSS3** — ללא framework, ללא CDN חיצוני
- **Vanilla JavaScript** — ES6+, `'use strict'`
- **פונטים** — `Assistant` (עברית), טעינה מקומית בלבד מ-`assets/fonts/` דרך `@font-face` ב-`styles.css`
- **אין**: React, Vue, jQuery, Tailwind, build tools, CDN scripts

---

## מבנה קבצים

```
methodica-math-scale-01-05/
├── index.html          ← כל 11 המסכים, single-page
├── index_dev.html      ← עוטף index.html ב-iframe, מוסיף סרגל ניווט למסכים (dev-only)
├── styles.css          ← כל הסטיילים
├── script.js           ← כל הלוגיקה
├── ARCHITECTURE.md      ← מסמך זה
├── PROJECT_BRIEF.md     ← תקציר פרויקט + מיפוי מסכים
└── assets/
    ├── fonts/          ← קבצי פונט מקומיים (Assistant, כל המשקלים)
    ├── images/         ← תמונות הרקע/דמויות/מפות הרלוונטיות ל-11 המסכים בלבד
    ├── gifs/           ← 4 קובצי GIF (Character1/2 × Happy/Sad) למסך הסיום
    └── icons/          ← (ריק כרגע) README.md מניפסט
```

זהו חילוץ (extraction) של מסכים 7–17 מתיקייה 04, ממוספר מחדש ל-0–10. **מסכים 7–17 הוסרו לגמרי מתיקייה 04** — תיקייה זו היא הגרסה היחידה שלהם כיום. תיקייה 04 מגיעה לכאן בסיום מסך 5 שלה, באמצעות ניווט דפים אמיתי (`window.location.href`, לא `goTo()` פנימי). ראו `PROJECT_BRIEF.md` לפירוט המקור וטבלת ההמרה.

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
const TOTAL_SCREENS = 11; // מסכים 0–10
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
  if (n === 0)  { /* מחליף תמונת דמות לפי window.lomdaState.selectedCharacter */ }
  if (n === 2)  { s45Enter(); }
  if (n === 4)  { s47Enter(); }
  if (n === 6)  { s49Enter(); }
  if (n === 8)  { s51Enter(); }
  if (n === 10) { s53Enter(); }
}
```

מזהי הפונקציות הפנימיים (`s45`, `s47`, `s49`, `s51`, `s53`, וכן `s14ToggleHelp` במסך 7) **אינם תואמים** את מספרי ה-`data-screen` — אלו שרידי מספור פנימי מהמודול המקורי (04) שנשמרו כמו שהם כדי לא לסבך את החילוץ. אין בזה בעיה תפקודית.

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
.btn-continue { /* כפתור סגלגל מלא, לוקח את הפינה השמאלית ב-RTL */ }
```

מסכי שאלה/סיפור מוסיפים את `.s3-bottom-bar` (מפעיל `justify-content: space-between`) + כפתור `.btn-back-s3` בצד ימין. **מסך 0 הוא היחיד בלי כפתור חזרה** — משתמש ב-`.bottom-bar` הבסיסי בלבד, כך שכפתור ה"המשך" היחיד נשאר בפינה השמאלית באופן טבעי.

---

## תבנית שאלה משותפת (`.s18-*`)

כל 4 מסכי השאלה (2, 4, 6, 8) חולקים את אותה תבנית עיצוב:

```html
<div class="s18-question">
  <div class="s18-q-layout">
    <div class="s18-q-right">…טקסט השאלה + תשובות/קלט…</div>
    <div class="s18-q-left">…תמונה + כפתור הגדלה…</div>
  </div>
</div>
<div class="s5-inline-feedback s18-feedback-bar" hidden>…</div>
<div class="s16-hint-popup" hidden>…</div>
```

- תשובות MCQ/checkbox משתמשות ב-`.s5-answers`/`.s5-opt` (בחירה בודדת) או `.s47-option`/`.s47-checkbox` (multi-select).
- קלט מספרי משתמש ב-`.s18-fill-row`/`.s18-answer-box`.
- הגדלת תמונה: `.img-zoom-btn` פותח overlay גלובלי (`#img-zoom-v05-sN`).
- כל מסך שאלה מגדיר override ממוקד (`#sN .s18-q-left { width: ...px }` וכו') לפי גודל התמונה הספציפית שלו.

---

## תבנית שקופית סיפור (`.s44-*`)

מסכי הגשר העלילתי (1, 3, 5, 7, 9) חולקים תבנית "רקע מלא + תיבת טקסט":

```html
<div class="s44-bg"><img class="s44-bg-img" src="..."></div>
<div class="s44-content">
  <div class="s44-text-box"><p>…</p></div>
</div>
```

`.s44-content`/`.s44-text-box` מקבלים override של מיקום/רוחב פר-מסך (`#sN .s44-content { justify-content: ... }`).

---

## כללי RTL

- `<html dir="rtl" lang="he">` — RTL גלובלי
- "הבא"/"המשך" = כפתור בצד **שמאל**; "חזרה" = כפתור בצד **ימין**
- **אסור** `direction: ltr` על container שלם — רק על אלמנט בודד עם סיבה

---

## נגישות (Accessibility)

- `#a11y-announcer` — `aria-live="polite"`, מקבל טקסט הכותרת בכל מעבר מסך (`goTo`)
- כל תיבת `.s5-inline-feedback` מקבלת `role="status"`/`aria-live="polite"` (הגדרה גלובלית, לא ב-HTML הסטטי)
- כל `section.screen` מקבל `tabindex="-1"` כדי לאפשר `.focus()` תכנותי בכל מעבר מסך
- כפתור דיווח על תקלה (`#flag-btn`) עם `aria-label`, ומודל דיווח מלא (`role="dialog"`, `aria-modal`)

---

## תכונות גלובליות (chrome) שנשמרות מהמודול המקורי

| תכונה | קבצים מרכזיים |
|---|---|
| דיווח על תקלה | `#flag-btn`, `#report-modal`, `#report-confirm-modal` (HTML) + `openReportModal`/`submitReport`/... (JS) |
| הגדלת תמונה | `.img-zoom-btn`/`.img-zoom-overlay` (HTML+CSS) + `openImgZoom`/`closeImgZoom` (JS) |
| גרירת תיבות פידבק | IIFE ב-`script.js` שמאזין ל-`mousedown`/`touchstart` על `.s5-inline-feedback` |
| כלי פיתוח (`index_dev.html`) | `postMessage` דו-כיווני עם `script.js` (`DEV_GOTO`/`DEV_READY`) |

---

## מוסכמות נתיבי Assets

```
./assets/images/Character1_workout.png
./assets/images/Character2_workout.png
./assets/images/Rescue team.jpg
./assets/images/Area.jpg
./assets/images/Team.jpg
./assets/images/Area 2.jpg
./assets/images/Noa.jpg
./assets/images/Elicopter.jpg
./assets/images/Elicopter2.png
./assets/images/Happy Team.jpg
./assets/gifs/Character1 GIF Happy.gif
./assets/gifs/Character1 GIF Sad.gif
./assets/gifs/Character2 GIF Happy.gif
./assets/gifs/Character2 GIF Sad.gif
```

כל הנתיבים יחסיים — ללא `/` מוביל, ללא URL מוחלט.

> **הערה ידועה**: ה-preloader (`preloadCharacterImages` ב-`script.js`) מנסה לטעון מראש את קובצי ה-GIF מ-`./assets/images/` במקום מ-`./assets/gifs/` — זו באגה קיימת שכבר הייתה במודול המקורי (04), לא נוצרה בחילוץ הזה. היא שקטה (`new Image().src` שנכשל לא זורק שגיאה חוסמת) ואינה משפיעה על הצגת ה-GIF בפועל במסך הסיום, שמשתמש בנתיב הנכון.
