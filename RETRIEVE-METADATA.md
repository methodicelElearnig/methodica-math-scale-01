# Retrieving metadata from the Kata catalog

`retrieve-metadata.ps1` is the opposite direction of [`send-metadata.ps1`](SEND-METADATA.md):
it reads a content unit out of the Katalog (Kata) catalog at `https://kata.cet.ac.il/api/v1`
and writes it back out as metadata files — same schema, same key order, same formatting
as the `metadata/` folder — into **`metadata-from/`**. It never writes to `metadata/`.

The point is comparison. Diff the two folders to see exactly where the catalog and the
repo disagree:

```bash
git diff --no-index metadata metadata-from
```

See [KATA-API-DETAILED.md](../../KATA-API-DETAILED.md) for the endpoint schemas.

## Requirements

- **PowerShell 7+** (`pwsh`). PowerShell 7.5+ additionally keeps `createdAt`/`updatedAt`
  exactly as KATA sent them; on 7.0–7.4 they are re-serialized to microsecond precision
  (`ConvertFrom-Json` converts ISO-8601 strings to `[datetime]` and there is no
  `-DateKind` to switch it off before 7.5).
- **curl.exe** — bundled with Windows 10/11.
- An API key, resolved in this order: the `-ApiKey` parameter, the `KATA_API_KEY`
  environment variable, or **`kata-api-key.txt`** next to the script (one line, just the
  key — git-ignored, and shared with `send-metadata.ps1`). See
  [SEND-METADATA.md → One-time setup](SEND-METADATA.md#one-time-setup). Never hard-code
  a key in the script; it is committed.

## Usage

```powershell
# Unit key is taken from metadata/*_unit.json
pwsh -File retrieve-metadata.ps1

# Also save the untouched API response under metadata-from/_raw/
pwsh -File retrieve-metadata.ps1 -KeepRaw

# Any other unit / server / destination
pwsh -File retrieve-metadata.ps1 -UnitKey some-other-unit -OutDir .\snapshot
```

Progress prints to the console and to `retrieve-metadata.log` (git-ignored). The run
ends with a `unit=1 components=N items=M warnings=W` summary.

`-UnitKey` is resolved in this order: the parameter → the `id` in `metadata/*_unit.json`
→ `GET /api/v1/content-units` when the account owns exactly one unit (otherwise it
stops and lists the available keys).

## How it maps KATA back to the metadata format

A single `GET /api/v1/content-units/{unitKey}` returns the whole tree — unit,
`components[]`, each component's `subContent[]`, and each item's `questions[]` — so
there is one request per run regardless of size.

**Enum values are passed through untouched.** KATA now stores the same kebab-case
vocabulary the metadata files use (`state-general`, `core-curriculum-basic`,
`project-or-inquiry-task`, `interactive-content`, …), so unlike the sender this script
has no enum-mapping tables. *(Note that the Title-Case vocabularies still documented in
`KATA-API.md` — and still used by `send-metadata.ps1` — are stale.)*

| Metadata | Rebuilt from KATA |
|---|---|
| `id` (full URL) | component `hostedContentRef` minus `/index.html`; the unit's `id` and each item's `id` are derived from that same prefix. Falls back to `-IdBase` with a warning if no component has one. |
| unit `title` (string) | `title.Hebrew` (`$TitleLangKey`) |
| component `learningUnitId` | the unit's `id` URL (KATA returns the bare key) |
| component `manufacture` | the `$Manufacture` constant, `'methodica'` — KATA returns the provider display name (`מתודיקה`) instead. Set `$Manufacture = $null` to pass KATA's value through. |
| `recommendedAfterFail` | each key expanded back to `<prefix>/<key>/` |
| item `id` | `<component id>/<item uniqueKey>` |
| `questions[]` | verbatim, minus each question's `order` |

**Dropped**, because the metadata format has no place for them — use `-KeepRaw` if you
need them: unit `kind`, `providerName`, `providerLogoUrl`, `componentCount`, `createdAt`,
`updatedAt`; component `status`, `manufacturerGroupId`, `masteryLevel`,
`hostedContentRef`; item `uniqueKey`, `hostedContentRef`, `order`; question `order`.

Component `createdAt`/`updatedAt` **are** kept — they are KATA's real timestamps, so
they always differ from the placeholder dates in `metadata/`.

## Output formatting

Files are written **UTF-8 without BOM, CRLF, 2-space indent, trailing newline**, and the
formatter reproduces the hand-authored style of `metadata/` rather than using
`ConvertTo-Json` (which expands every array and would add whitespace noise to every
diff). The rule, all of it configurable in the CONFIG block:

- an empty array is `[]`; an empty object is `{}`
- an array of primitives goes on one line while its compact form is ≤ `$InlineArrayMaxChars`
  (8) — so `answers`, `correctAnswers`, `targetSector`, `skills` and
  `recommendedAfterFail` get one element per line, and each element shows up as its own
  line in a diff
- arrays under `languages` / `source` / `target` (`$InlineArrayKeys`) are short tuples and
  get a larger budget, `$InlineTupleMaxChars` (62)
- a flat object of at most `$InlineObjectMaxProps` (3) primitive values goes on one line —
  that's how the `matching` questions' `correctAnswers` pairs are stored

**Fidelity.** The two array budgets were fitted by parsing each `metadata/*.json` and
re-emitting it through this formatter: 8 / 62 reproduces **5 of the 6 files byte for
byte**. The one residual line is `"answers": ["כן", "לא"]` in part 04, which `metadata/`
inlines at 12 characters — but a 12-character budget re-formats more lines elsewhere
than it fixes, because the hand-authored files aren't self-consistent about it. Re-measure
before changing either number.

## What a first run showed (2026-07-25)

Every file's diff against `metadata/` was genuine drift, not noise — the catalog holds
different values from the repo for `title` (all 5 components), `cognitiveLevel` (all 5 —
KATA has `algorithmic-thinking`, the metadata has the 720 science labels),
`estimatedTimeInMinutes`, `skills` (KATA has `MOE.SKILL.*` codes, the metadata has none),
`contentType`, `mediaFormat`, `questionType`, `questionText`, `answers`,
`correctAnswers`, and `recommendedAfterFail`.
