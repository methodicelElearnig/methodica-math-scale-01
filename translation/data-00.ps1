# Part 00 = module root: the LMS-entry redirect page + the shared unit-js/ layer.
# Per the task spec, module-root shared content gets pseudo-part 00, pseudo-screen 99.

Scr -Id '01-00-99' -Title 'Module root — LMS redirect + shared unit-js chrome' -Type 'other (redirect + shared infra)' `
    -SourceFile 'index.html; unit-js/25-report.js' -Selector 'document root; unit-js/25-report.js' `
    -ManualReview 'unit-js/25-report.js:69 announce string lacks the exclamation mark present on the modal heading with identical wording elsewhere — flagged, not fixed.'

U -ScreenId '01-00-99' -Seq 1 -ElementRole 'other' -ScreenTitle 'Module root — LMS redirect' -ScreenType 'other (redirect + fallback link)' `
  -SourceLocation 'index.html:5' -Source 'יחידות מידה לצורך יישום יחס' `
  -DeveloperNote 'Page <title> of the module-root LMS-entry redirect page. This page auto-redirects to methodica-math-scale-01-01/ via JS; this title/body only render if JS is slow or blocked.'

U -ScreenId '01-00-99' -Seq 2 -ElementRole 'body-text' -ScreenTitle 'Module root — LMS redirect' -ScreenType 'other (redirect + fallback link)' `
  -SourceLocation 'index.html:16' -Source 'מעבירים אותך ללומדה… &lt;br /&gt;' `
  -DeveloperNote 'Fallback message shown briefly before/if the JS redirect (toFirstComponent()) fires. Contains an ellipsis character (…), not three periods — preserve. Joined onto one line per the multi-line-element convention; original source has the <br /> on its own visual line via indentation, text content unchanged.'

U -ScreenId '01-00-99' -Seq 3 -ElementRole 'other' -ScreenTitle 'Module root — LMS redirect' -ScreenType 'other (redirect + fallback link)' `
  -SourceLocation 'index.html:17' -Source 'לחצו כאן אם הדף לא נטען' `
  -DeveloperNote 'Clickable fallback link text (span with onclick=toFirstComponent()); underlined/blue via inline style, styled as a hyperlink though it is a <span>, not <a>.'

U -ScreenId '01-00-99' -Seq 4 -ElementRole 'other' -ScreenTitle 'Shared report-modal a11y announcement' -ScreenType 'other (shared unit-js chrome)' `
  -SourceLocation 'unit-js/25-report.js:69' -Source 'הדיווח נשלח, תודה' `
  -DeveloperNote 'Passed to announce(), which writes it into #a11y-announcer (screen-reader live region) after report submission, shared by all 5 parts. NOT the same string as the report-thanks modal heading "הדיווח נשלח, תודה!" (with exclamation mark) shown in every part — that heading is a separate unit captured under each part''s own chrome (screen 99).' `
  -ManualReview 'Missing the exclamation mark present on the visually-identical report-thanks modal heading in every part (e.g. 01-01-99, 01-02-99, ...). Likely an oversight rather than a deliberate distinction between the spoken/announced form and the visual heading — flagged, not corrected.'
