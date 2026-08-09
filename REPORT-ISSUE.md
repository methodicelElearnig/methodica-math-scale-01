# Adding learner problem reporting ("מצאתם בעיה?") to a unit

How to wire the learner-facing problem-report feature in a 720 לומדה: the flag button, the modal,
and the transport that delivers a report to a Google Form. Written as a working guide for the
**next** unit; `methodica-math-scale-01` is the reference implementation.

Companion: **[REPORT-XAPI.md](REPORT-XAPI.md)**. The two features are independent, but this one
reads `window.METADATA`, which the xAPI metadata layer provides — see §6.

---

## 1. What the learner sees

A persistent flag button (`#flag-btn`, "מצאתם בעיה?") on every screen → a modal with a problem-type
select and a free-text field → on submit, a thank-you state. Leaving with unsaved input raises a
discard-confirm prompt.

## 2. What already exists, and what you actually add

In a unit built from the standard templates the **entire modal UI is usually already there** —
flag button, form, custom select, validation, and the discard-confirm dialog — with `submitReport()`
stubbed to a `console.log`. Check before building anything.

**In this unit the whole layer now lives in [`unit-js/25-report.js`](unit-js/README.md)**, one copy
for all five components, wired up by `unit-js/90-boot.js` calling `initReportModal()`. A new unit
copies that file and changes one line — `REPORT_FORM_ACTION` (§3). The per-component seams it reads
are `SCREEN_TO_SUBCONTENT` and `currentScreen`, which the xAPI layer already defines.

If you are starting from an older unit where the layer is still per-part, what is typically missing
is only:

| Piece | Notes |
|---|---|
| `REPORT_FORM_ACTION` | the Google Form endpoint **for this unit** — see §3 |
| `REPORT_TYPE_LABELS` | at **module scope**, not inside the custom-select IIFE |
| `submitReport()` | the real transport — see §5 |
| A **report-sent** state | `#report-thanks-modal` + `showReportThanks()` / `closeReportThanks()` |

> **Watch for two markup generations.** This unit's components 04 and 05 have a newer modal with
> `#report-text-error` and `onblur="reportTextBlur()"`; 01, 02 and 03 do not. The shared file takes
> the newer code and guards every lookup, so the extra behaviour is inert in the older markup. When
> you unify drifted copies, take the superset and *prove* the difference cannot fire — do not
> average them.

Two details that bite:

- **`REPORT_TYPE_LABELS` must be hoisted to module scope.** The form records the human-readable
  label, so `submitReport()` needs to read it too — not just the select widget. The templates use a
  hidden input plus a custom select, **not** a native `<select>`, so the common
  `options[selectedIndex].text` idiom does not apply.
- **The pre-existing `#report-confirm-modal` is a *discard* prompt, not a thank-you.** They are
  different dialogs; do not reuse one for the other. The new thanks markup can reuse the existing
  `.report-*` classes, so **no CSS changes are needed**.

## 3. Give the unit its own Google Form

> ⚠️ **The single most important step.** `REPORT_FORM_ACTION` decides *where learner reports land*.
> A borrowed endpoint silently delivers this unit's reports into another unit's response sheet, and
> nothing in the UI or the console will tell you. This has already happened once between two 720
> units — reports were arriving under the wrong project until the endpoint was corrected.

For a new unit: create (or be given) its own form, then take the endpoint from the form's `action`
attribute, with `/formResponse` at the end:

```js
var REPORT_FORM_ACTION = 'https://docs.google.com/forms/d/e/<FORM_ID>/formResponse';
```

## 4. The field map

Each field posts to an `entry.<id>` key that is **specific to that form**. To discover them: open
the live form, view source (or the pre-filled-link URL), and read the `entry.*` names. Date and time
questions expand into `_year`/`_month`/`_day` and `_hour`/`_minute` sub-keys.

The reference unit's map:

| Field | Value |
|---|---|
| `entry.301404029_{year,month,day}` | date |
| `entry.2066097581_{hour,minute}` | time |
| `entry.1933069481` | unit slug — `shortId(META.learningUnitId)` |
| `entry.2070680092` | component slug — `shortId(META.id)` |
| `entry.1555704258` | item id, from `SCREEN_TO_SUBCONTENT` |
| `entry.1671046914` | page-in-item (raw screen number when unmapped) |
| `entry.1179822443` | problem type label |
| `entry.806447525` | free text |

**Item and page come from the same screen map the xAPI item scope uses** (`SCREEN_TO_SUBCONTENT`,
see [REPORT-XAPI.md](REPORT-XAPI.md) §2), so a report and a statement always name the same place.
Keep it that way — it is what makes a report traceable to the learner's exact position.

## 5. The transport

```js
fetch(REPORT_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: body })
  .catch(function (e) { console.error('[Report] send failed', e); });
showReportThanks();
```

Three rules:

- **`mode: 'no-cors'`.** Google Forms accepts the POST but returns an opaque response. You cannot
  read the status, so do not try to branch on it.
- **A failure must never block the learner.** Log it and close the modal either way.
- **Build the body with `URLSearchParams`**, not JSON — the form expects a normal form encoding.

## 6. Dependency on the metadata layer

The report body is enriched from `window.METADATA` — unit slug, component slug, item id. That comes
from the xAPI metadata layer, so **this feature depends on metadata loading, but not on statement
sending**.

That distinction matters: it works fine while `XAPI_DISABLED` is true (no `?slxapi` on the URL), so
problem reporting is fully testable off-platform. If `window.METADATA` is missing entirely the code
falls back to `{}` and posts empty slugs — a report still reaches the form, just without location
context.

## 7. Verification checklist

- [ ] Submit a report from **each** part and confirm a row arrives in **this unit's own** form
      response sheet — not another unit's.
- [ ] Unit slug and component slug are correct and differ per part.
- [ ] Item id and page-in-item match the screen the report was sent from, including an **unmapped**
      screen (should post the raw screen number).
- [ ] The problem type arrives as the **Hebrew label**, not the internal key (`technical` etc.).
- [ ] Date and time populate.
- [ ] The thank-you state appears; the discard-confirm dialog still works on abandoning input.
- [ ] Works with **no `?slxapi`** on the URL (`XAPI_DISABLED` true).
- [ ] A forced network failure still closes the modal and does not interrupt the learner.

## 8. Reference — `methodica-math-scale-01` as built

Form endpoint: `1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw`
(defined **once** for the whole unit, in `unit-js/25-report.js`).

Problem types: `technical` → `תקלה טכנית או שמשהו לא עובד` · `unclear` → `משהו לא ברור לי` ·
`other` → `אחר`.

Related documents: [REPORT-XAPI.md](REPORT-XAPI.md) · [RESUME.md](RESUME.md)

Origin of the pattern: `methodica-science-mass-measure-01` (branch `vadimr-1`) and the 720 technical
guidelines v2.4.
