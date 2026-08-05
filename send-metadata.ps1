#Requires -Version 7.0
<#
.SYNOPSIS
    Send the metadata/ folder (1 unit + 5 components + their items) to the Kata
    (Katalog) catalog API at https://kata.cet.ac.il/api/v1.

.DESCRIPTION
    Walks the metadata tree top-down and UPSERTS each entity (GET by uniqueKey ->
    PATCH if it exists, else POST). Transforms the on-disk metadata into the API
    payloads, filling in required fields the metadata lacks (from the CONFIG block
    below) and remapping values that fall outside the API enums.

    Runtime: PowerShell 7+ and curl.exe (bundled with Windows 10/11).

    SAFETY: never hard-code the API key here — this script is committed. Supply it via
    -ApiKey, $env:KATA_API_KEY, or the git-ignored kata-api-key.txt next to this script
    (see SEND-METADATA.md). The script refuses to run without one and never logs it.

.PARAMETER DryRun
    Build and print every payload WITHOUT any network call. No key required.

.PARAMETER ApiKey
    The Kata API key. Overrides $env:KATA_API_KEY and kata-api-key.txt.

.PARAMETER BaseUrl
    Override the API base URL (default https://kata.cet.ac.il).

.PARAMETER MetadataDir
    Override the metadata folder (default: the metadata/ folder next to this script).

.EXAMPLE
    pwsh -File send-metadata.ps1 -DryRun
.EXAMPLE
    pwsh -File send-metadata.ps1
#>
[CmdletBinding()]
param(
    [switch] $DryRun,
    [string] $ApiKey,
    [string] $BaseUrl,
    [string] $MetadataDir
)

# ============================================================================
#  CONFIG  — edit these before running
# ----------------------------------------------------------------------------
#  REUSE GUIDE — running this for a DIFFERENT unit? Touch only what applies:
#    (1) ALWAYS: set the API key, and point $MetadataDir at the unit's folder.
#    (2) PER-UNIT: usually fine as-is (title language, manufacture, overrides).
#    (3) CONTENT VOCABULARY: adjust ONLY for a different subject or new metadata
#        values — the cognitiveLevel codes (subject-specific!) and the small
#        value-mapping tables. If the metadata contains a value not covered here,
#        the script STOPS with a clear message naming it, so you know what to add.
#    (4) 720 STANDARD ENUMS: rarely change — they mirror the KATA spec.
#  Sections are ordered (1)->(4) below.
# ============================================================================

# ── (1) PER-RUN / ENVIRONMENT — always check ────────────────────────────────
# API key from Kata -> "מפתחות API" (/api-credentials).
# NEVER hard-code it here — this script is committed. It is resolved at runtime, in
# order, from: the -ApiKey parameter, the KATA_API_KEY environment variable, or the
# git-ignored key file below (one line, just the key). See SEND-METADATA.md.
$ApiKeyFile = Join-Path $PSScriptRoot 'kata-api-key.txt'
# API base URL (override at launch with -BaseUrl).
if (-not $BaseUrl) { $BaseUrl = 'https://kata.cet.ac.il' }
# Metadata folder to send (override with -MetadataDir). Defaults to ./metadata.
if (-not $MetadataDir) { $MetadataDir = Join-Path $PSScriptRoot 'metadata' }
# Run log (git-ignored via *.log).
$LogFile = Join-Path $PSScriptRoot 'send-metadata.log'

# ── (2) PER-UNIT — usually fine as-is ───────────────────────────────────────
# Title language key: wraps a string title into the API object, e.g.
#   "מדידת מסה" -> { "Hebrew": "מדידת מסה" }. Change only for non-Hebrew content.
$TitleLangKey = 'Hebrew'
# Manufacture value sent on the unit (the metadata unit file carries none).
$UnitManufacture = 'methodica'
# Fallback depthLevel — used ONLY if a component's metadata omits it (components
# normally carry their own relativeDifficulty / depthLevel / cognitiveLevel).
$DefaultDepthLevel = 'core-curriculum-basic'
# Optional per-component overrides, keyed by uniqueKey (URL slug). An override
# WINS over the metadata value; unlisted components use their metadata value.
#   e.g. 'methodica-math-scale-01-05' = @{ relativeDifficulty = 4; depthLevel = 'core-curriculum-advanced' }
$ComponentOverrides = @{
}

# ── (3) CONTENT VOCABULARY — ADJUST PER UNIT / SUBJECT ───────────────────────
# These translate values found in the metadata into what KATA accepts. This is
# THE section to review when reusing. Unmapped/invalid values -> the script stops
# and names the offender (see Map-Enum / New-ComponentBody).
#
# Since metadata v2.3 the metadata files store the SAME kebab-case vocabulary the
# API uses, so these maps are only needed for legacy values left over from the
# pre-v2.3 files. Everything else passes through and is checked against the
# $Valid* lists in section (4).

# 3a. componentPurpose: metadata value -> API enum (see $ValidComponentPurpose).
$ComponentPurposeMap = @{
    'assessment' = 'practice'   # an assessment component (isAssessment already flags it)
}
# 3b. contentType (items): metadata value -> API enum (see $ValidContentType).
#     Both keys are pre-v2.3 spellings; current metadata needs no mapping.
$ContentTypeMap = @{
    'ClassroomTask' = 'project-or-inquiry-task'
    'Assessment'    = 'practice'
}
# 3c. cognitiveLevel: metadata value -> official MOE code — SUBJECT-SPECIFIC.
#     KATA validates against GET /api/v1/cognitive-levels. The codes turned out to
#     be kebab-case slugs identical to what the metadata stores, so this map only
#     translates the pre-v2.3 Title Case labels; a different subject (e.g. math)
#     has a different code set, so replace $ValidCognitiveLevel when reusing.
$CognitiveLevelMap = @{
    'Identifying'                    = 'identifying'                    # זיהוי
    'Describing'                     = 'describing'                     # תיאור
    'Retrieving Information'         = 'retrieving-information'          # איתור מידע
    'Providing Examples'             = 'providing-examples'              # מתן דוגמאות
    'Making Connections'             = 'making-connections'              # קישור
    'Interpreting'                   = 'interpreting'                    # פירוש
    'Applying a Model or Procedure'  = 'applying-a-model-or-procedure'   # שימוש במודל או בפרוצדורה
    'Explaining'                     = 'explaining'                      # הסבר
    'Providing Scientific Reasoning' = 'providing-scientific-reasoning'   # הנמקה מדעית — NOT in KATA yet
    'Analyzing'                      = 'analyzing'                       # ניתוח — NOT in KATA yet
    'Synthesizing'                   = 'synthesizing'                    # סינתזה — NOT in KATA yet
    'Evaluating and Justifying'      = 'evaluating-and-justifying'        # הערכה והצדקה — NOT in KATA yet
}
# The SCIENCE codes KATA actually holds — verified live 2026-07-25 via
# GET /api/v1/cognitive-levels (12 codes total: 8 `science` plus 4 `mathematics`).
# THIS UNIT IS MATHEMATICS, so the four `mathematics` codes are the relevant ones; the
# science codes are kept because the endpoint accepts them and a shared unit could use them.
#
# ⚠️ VOCABULARY MISMATCH — the metadata/ files in this repo currently carry word-reversed
#    spellings that the API will reject with 422 "code does not exist", e.g.
#        metadata says            KATA/720 vocabulary
#        thinking-algorithmic  -> algorithmic-thinking
#        content-interactive   -> interactive-content
#        basic-curriculum-core -> core-curriculum-basic
#        advanced-curriculum-core -> core-curriculum-advanced
#        exercise-solved       -> solved-exercise
#        task-inquiry-or-project  -> project-or-inquiry-task
#    The lists here deliberately hold the LIVE vocabulary rather than the metadata's, so that
#    `send-metadata.ps1 -DryRun` names every offending value instead of failing later against
#    the real API. Confirm the canonical spelling with CET, fix metadata/, then push.
#
# VERIFIED against GET /api/v1/cognitive-levels on 2026-08-05 — 16 codes live, 4 mathematics and
# 12 science. The mathematics four, with their Hebrew titles:
#     algorithmic-thinking         חשיבה אלגוריתמית      (Algorithmic Thinking)
#     process-thinking             חשיבה תהליכית          (Procedural Thinking)
#     interpretation-and-reasoning חיפוש פתוח והנמקה      (Open Interpretation and Reasoning)
#     knowledge-and-recall         ידע וזיהוי             (Knowledge and Recognition)
# Note 'interpretation-and-reasoning' — NOT 'reasoning-and-interpretation', which is what this
# repo's metadata originally carried (the same word-order fault as the rest; see METADATA-FIXES.md).
$ValidCognitiveLevel = @(
    # mathematics — used by this unit
    'algorithmic-thinking'
    'process-thinking'
    'interpretation-and-reasoning'
    'knowledge-and-recall'
    # science — retained for cross-subject reuse. All 12 are live as of the 2026-08-05 check
    # (the four that used to 422 have since been released).
    'identifying'
    'describing'
    'retrieving-information'
    'providing-examples'
    'making-connections'
    'interpreting'
    'applying-a-model-or-procedure'
    'explaining'
    'analyzing'
    'synthesizing'
    'evaluating-and-justifying'
    'providing-scientific-reasoning'
)
# 720 science levels that exist in the spec but NOT in KATA — used only to give a
# clearer error than "unmapped value" when the metadata legitimately uses one.
# Empty as of the 2026-08-05 check: the four science levels that used to 422 are now live and have
# moved up into $ValidCognitiveLevel. Kept as a mechanism — if a future spec level is not yet
# loaded in KATA, list it here to get a clear message instead of "unknown value".
$PendingCognitiveLevel = @()

# ── (4) 720 STANDARD ENUMS — rarely change (mirror the KATA spec) ────────────
# Used to fail fast on any value that maps outside the standard vocabulary.
# NOTE: these are kebab-case, matching what the live API returns and accepts —
# the Title Case tables in KATA-API.md's "Controlled Vocabularies" are stale.
$ValidComponentPurpose = @('instruction','practice','both')
$ValidContentType      = @('instruction','practice','project-or-inquiry-task','educational-game','reading-text','simulation','motivational','solved-exercise','summary')
$ValidMediaFormat      = @('text','image','audio','video','animation','interactive-content','presentation')
# depthLevel is a plain enum (720 v2.2 p.16), not a coded taxonomy.
$ValidDepthLevel       = @('core-curriculum-basic','core-curriculum-advanced','core-curriculum-enrichment','non-core-basic','non-core-advanced','non-core-enrichment')
# masteryLevel (720 v2.2) — this unit's metadata sets it per component. It was previously dropped
# on the floor: the payload never carried it, so the values never reached the catalog.
$ValidMasteryLevel     = @('basic','intermediate','advanced')
# Unit audience vocabularies. These were previously forwarded unvalidated, so a bad value only
# surfaced as a 422 from the live API — after the unit had already been created.
$ValidTargetSector     = @('state-general','state-religious','orthodox','arab-sector','druze-sector','bedouin-sector','special-education')
$ValidTargetAudience   = @('general','excellent','disadvantaged-populations','new-immigrants','students-with-special-needs','students-with-language-gaps','at-risk-students')

# ============================================================================
#  End of CONFIG
# ============================================================================

$ErrorActionPreference = 'Stop'
$script:counts = @{ created = 0; updated = 0; failed = 0 }

function Write-Log {
    param([string] $Message, [string] $Level = 'INFO')
    $line = "[{0}] {1}" -f $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Get-Slug {
    param([string] $Url)
    # Trim any trailing slash(es) first so a URL like ".../foo/" yields "foo", not "".
    return (($Url.TrimEnd('/')) -split '/')[-1]
}

# -ApiKey > $env:KATA_API_KEY > the git-ignored key file. Returns '' if none is set.
function Resolve-ApiKey {
    if ($ApiKey)            { return $ApiKey.Trim() }
    if ($env:KATA_API_KEY)  { return $env:KATA_API_KEY.Trim() }
    if (Test-Path $ApiKeyFile) {
        return ((Get-Content -Raw -Path $ApiKeyFile -Encoding UTF8) -replace '\s', '')
    }
    return ''
}

function Map-Enum {
    param([string] $Value, [hashtable] $Map, [string[]] $Valid, [string] $FieldName, [string] $Where)
    $mapped = if ($Map.ContainsKey($Value)) { $Map[$Value] } else { $Value }
    if ($Valid -notcontains $mapped) {
        throw "Unmapped $FieldName value '$Value' at $Where — add it to the enum map or fix the metadata."
    }
    return $mapped
}

function Remove-Key {
    param([System.Collections.Specialized.OrderedDictionary] $Dict, [string] $Key)
    $copy = [ordered]@{}
    foreach ($k in $Dict.Keys) { if ($k -ne $Key) { $copy[$k] = $Dict[$k] } }
    return $copy
}

function Invoke-Kata {
    param([string] $Method, [string] $Path, $Body)
    $url = "$BaseUrl$Path"

    if ($DryRun) {
        Write-Log "DRY-RUN $Method $url"
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 12
            Write-Host $json
        }
        return @{ Code = '000'; Body = '(dry-run)' }
    }

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $curlArgs = @('-sS', '-X', $Method, $url, '-H', "X-API-Key: $ApiKey")
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 12
            [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
            $curlArgs += @('-H', 'Content-Type: application/json; charset=utf-8', '--data-binary', "@$tmp")
        }
        $curlArgs += @('-w', '\n%{http_code}')

        $raw = (& curl.exe @curlArgs 2>&1 | Out-String)
        $text = ($raw -replace "`r", '').TrimEnd("`n")
        $idx  = $text.LastIndexOf("`n")
        if ($idx -ge 0) {
            $code = $text.Substring($idx + 1).Trim()
            $bodyText = $text.Substring(0, $idx)
        } else {
            $code = $text.Trim()
            $bodyText = ''
        }
        return @{ Code = $code; Body = $bodyText }
    }
    finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

function Test-Exists {
    param([string] $Path)
    if ($DryRun) { return $false }
    $code = (& curl.exe -s -o NUL -w '%{http_code}' -X GET "$BaseUrl$Path" -H "X-API-Key: $ApiKey")
    return ($code -eq '200')
}

# Upsert one entity. Returns $true on success (so children may proceed).
function Send-Entity {
    param(
        [string] $Label,
        [string] $GetPath,
        [string] $CreateMethod,
        [string] $CreatePath,
        $CreateBody,
        [string] $PatchPath,
        $PatchBody
    )
    $exists = Test-Exists $GetPath
    if ($exists) {
        $r = Invoke-Kata 'PATCH' $PatchPath $PatchBody
        $action = 'UPDATED'
    } else {
        $r = Invoke-Kata $CreateMethod $CreatePath $CreateBody
        $action = 'CREATED'
    }

    $ok = $DryRun -or ($r.Code -match '^2\d\d$')
    if ($ok) {
        if ($action -eq 'UPDATED') { $script:counts.updated++ } else { $script:counts.created++ }
        Write-Log ("{0,-7} {1} (HTTP {2})" -f $action, $Label, $r.Code)
    } else {
        $script:counts.failed++
        $snippet = ($r.Body -replace '\s+', ' ')
        if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) + '…' }
        Write-Log ("FAILED  {0} — {1} {2} (HTTP {3}) {4}" -f $Label, $CreateMethod, $CreatePath, $r.Code, $snippet) 'ERROR'
    }
    return $ok
}

# ---- Payload builders -------------------------------------------------------

function New-UnitBody {
    param($Unit)

    # uniqueKey comes from the last path segment of the unit id. Guard against an id that stops at
    # the unit FOLDER (".../scale/01/"), which would silently key the unit as "01" and collide with
    # every other unit numbered 01.
    $unitKey = Get-Slug $Unit.id
    if ($unitKey -notmatch '^methodica-') {
        throw ("Unit uniqueKey resolves to '$unitKey' from id '$($Unit.id)' — expected a slug like " +
               "'methodica-math-scale-01'. The unit id must end with the unit slug, not the folder number.")
    }

    # targetSector / targetAudience: validated rather than forwarded blind.
    foreach ($v in @($Unit.targetSector)) {
        if ($ValidTargetSector -notcontains $v) {
            throw "Invalid targetSector '$v' on the unit — expected one of: $($ValidTargetSector -join ', ')."
        }
    }
    foreach ($v in @($Unit.targetAudience)) {
        if ($ValidTargetAudience -notcontains $v) {
            throw "Invalid targetAudience '$v' on the unit — expected one of: $($ValidTargetAudience -join ', ')."
        }
    }

    return [ordered]@{
        uniqueKey                     = $unitKey
        title                         = [ordered]@{ $TitleLangKey = $Unit.title }
        learningObjective             = $Unit.learningObjective
        targetSector                  = @($Unit.targetSector)
        targetAudience                = @($Unit.targetAudience)
        prerequisiteLearningObjective = @($Unit.prerequisiteLearningObjective)
        manufacture                   = $UnitManufacture
    }
}

function New-ComponentBody {
    param($Comp)
    $slug = Get-Slug $Comp.id
    $ov   = if ($ComponentOverrides.ContainsKey($slug)) { $ComponentOverrides[$slug] } else { @{} }

    # relativeDifficulty: override > metadata value > (last resort) component order.
    $relDiff = if ($ov.ContainsKey('relativeDifficulty')) { $ov.relativeDifficulty }
               elseif ($null -ne $Comp.relativeDifficulty)  { $Comp.relativeDifficulty }
               else { $Comp.order }

    # depthLevel: override > metadata value > fallback. Validated against the enum.
    $depth = if ($ov.ContainsKey('depthLevel')) { $ov.depthLevel }
             elseif ($Comp.depthLevel)          { $Comp.depthLevel }
             else { $DefaultDepthLevel }
    if ($ValidDepthLevel -notcontains $depth) {
        throw "Invalid depthLevel '$depth' at $slug — expected one of: $($ValidDepthLevel -join ', ')."
    }

    # cognitiveLevel: override wins; otherwise the metadata value already IS the MOE
    # code (kebab-case), and $CognitiveLevelMap only rewrites pre-v2.3 labels.
    if ($ov.ContainsKey('cognitiveLevel')) {
        $cog = $ov.cognitiveLevel
    } else {
        $label = $Comp.cognitiveLevel
        $cog   = if ($CognitiveLevelMap.ContainsKey($label)) { $CognitiveLevelMap[$label] } else { $label }
        if ($PendingCognitiveLevel -contains $cog) {
            throw ("cognitiveLevel '$cog' ($slug) is a 720 science level (v2.2 pp.17-18) that KATA has NOT loaded yet — " +
                   'it would fail with 422 "cognitiveLevel code does not exist". Only 8 of the 12 science levels are ' +
                   'available (verified 2026-07-25). Re-check GET /api/v1/cognitive-levels; once the code appears, move it ' +
                   'from $PendingCognitiveLevel into $ValidCognitiveLevel and re-run. Meanwhile either pick a released ' +
                   'level in the metadata, or set an override in $ComponentOverrides.')
        }
        if ($ValidCognitiveLevel -notcontains $cog) {
            throw ("Unknown cognitiveLevel '$label' at $slug — not one of the codes KATA holds for this subject: " +
                   "$($ValidCognitiveLevel -join ', '). Check GET /api/v1/cognitive-levels.")
        }
    }

    $purpose = Map-Enum $Comp.componentPurpose $ComponentPurposeMap $ValidComponentPurpose 'componentPurpose' $slug

    # masteryLevel: optional in the metadata, but when present it must reach the catalog — this
    # field used to be silently dropped. Absent stays absent rather than being defaulted.
    $mastery = $null
    if ($null -ne $Comp.masteryLevel -and "$($Comp.masteryLevel)".Trim() -ne '') {
        $mastery = $ValidMasteryLevel | Where-Object { $_ -ieq $Comp.masteryLevel } | Select-Object -First 1
        if (-not $mastery) {
            throw "Invalid masteryLevel '$($Comp.masteryLevel)' at $slug — expected one of: $($ValidMasteryLevel -join ', ')."
        }
    }

    # NOTE: recommendedAfterFail is intentionally NOT set here. Those references can
    # point to components created later in the run (e.g. part 01 -> part 02), which
    # KATA rejects at create time ("... is not a component"). It's applied in a
    # separate PATCH pass after every component exists — see the Main section.

    $body = [ordered]@{
        uniqueKey              = $slug
        title                  = $Comp.title
        componentPurpose       = $purpose
        isAssessment           = [bool] $Comp.isAssessment
        isRequired             = [bool] $Comp.isRequired
        relativeDifficulty     = [int] $relDiff
        order                  = [int] $Comp.order
        depthLevel             = $depth
        cognitiveLevel         = $cog
        languages              = @($Comp.languages)
        skills                 = @($Comp.skills)
        estimatedTimeInMinutes = [int] $Comp.estimatedTimeInMinutes
        # "כתובת תוכן מתארח" — the component's hosted URL (folder + /index.html).
        hostedContentRef       = ($Comp.id.TrimEnd('/')) + '/index.html'
    }
    if ($mastery) { $body.masteryLevel = $mastery }
    return $body
}

function New-ItemBody {
    param($Item, [int] $Order)
    $slug = Get-Slug $Item.id
    $contentType = Map-Enum $Item.contentType $ContentTypeMap $ValidContentType 'contentType' $slug
    # Canonicalize mediaFormat casing to the exact API enum value. The API is
    # case-SENSITIVE ('Interactive-Content' -> 422), but PowerShell -contains is
    # case-insensitive, so match case-insensitively and send the canonical form.
    $mediaFormat = $ValidMediaFormat | Where-Object { $_ -ieq $Item.mediaFormat } | Select-Object -First 1
    if (-not $mediaFormat) {
        throw "Invalid mediaFormat '$($Item.mediaFormat)' at $slug — expected one of: $($ValidMediaFormat -join ', ')."
    }
    $body = [ordered]@{
        uniqueKey        = $slug
        title            = $Item.title
        informationToBot = $Item.informationToBot
        contentType      = $contentType
        mediaFormat      = $mediaFormat
        order            = $Order
    }
    if ($null -ne $Item.questions -and @($Item.questions).Count -gt 0) {
        $body.questions = @($Item.questions)
    }
    return $body
}

# ---- Main -------------------------------------------------------------------

# Fresh log per run.
$modeLabel = if ($DryRun) { 'DRY-RUN (no network)' } else { 'LIVE' }
Set-Content -Path $LogFile -Value ("=== send-metadata {0} ===" -f $modeLabel) -Encoding UTF8

$ApiKey = Resolve-ApiKey
if (-not $DryRun -and -not $ApiKey) {
    Write-Log ("API key not set. Pass -ApiKey, set `$env:KATA_API_KEY, or put the key on one line in " +
               "$ApiKeyFile (get it from /api-credentials). Or run with -DryRun.") 'ERROR'
    exit 1
}
if (-not (Test-Path $MetadataDir)) {
    Write-Log "Metadata folder not found: $MetadataDir" 'ERROR'
    exit 1
}

Write-Log ("Base URL     : {0}" -f $BaseUrl)
Write-Log ("Metadata dir : {0}" -f $MetadataDir)
Write-Log ("Mode         : {0}" -f $modeLabel)

# 1) Unit
$unitFile = Get-ChildItem -Path $MetadataDir -Filter '*_unit.json' | Select-Object -First 1
if (-not $unitFile) { Write-Log "No *_unit.json found in $MetadataDir" 'ERROR'; exit 1 }
$unit = Get-Content -Raw -Path $unitFile.FullName -Encoding UTF8 | ConvertFrom-Json
$unitKey = Get-Slug $unit.id

$unitBody  = New-UnitBody $unit
$unitPatch = Remove-Key $unitBody 'uniqueKey'
$unitOk = Send-Entity -Label "unit $unitKey" `
    -GetPath "/api/v1/content-units/$unitKey" `
    -CreateMethod 'POST' -CreatePath '/api/v1/content-units' -CreateBody $unitBody `
    -PatchPath "/api/v1/content-units/$unitKey" -PatchBody $unitPatch

if (-not $unitOk) {
    Write-Log "Unit upsert failed — skipping components (cannot nest under a missing unit)." 'ERROR'
} else {
    # 2) Components (sorted by order), then 3) their items
    $compFiles = Get-ChildItem -Path $MetadataDir -Filter '*.json' |
        Where-Object { $_.Name -notlike '*_unit.json' }
    $comps = foreach ($f in $compFiles) {
        Get-Content -Raw -Path $f.FullName -Encoding UTF8 | ConvertFrom-Json
    }
    $comps = $comps | Sort-Object { [int] $_.order }

    foreach ($comp in $comps) {
        $compKey   = Get-Slug $comp.id
        $compBody  = New-ComponentBody $comp
        $compPatch = Remove-Key $compBody 'uniqueKey'
        $compOk = Send-Entity -Label "component $compKey" `
            -GetPath "/api/v1/components/$compKey" `
            -CreateMethod 'POST' -CreatePath "/api/v1/content-units/$unitKey/components" -CreateBody $compBody `
            -PatchPath "/api/v1/components/$compKey" -PatchBody $compPatch

        if (-not $compOk) {
            Write-Log "Component $compKey failed — skipping its items." 'ERROR'
            continue
        }

        $order = 0
        foreach ($item in @($comp.subContent)) {
            $order++
            $itemKey   = Get-Slug $item.id
            $itemBody  = New-ItemBody $item $order
            $itemPatch = Remove-Key $itemBody 'uniqueKey'
            [void] (Send-Entity -Label "item $itemKey" `
                -GetPath "/api/v1/components/$compKey/items/$itemKey" `
                -CreateMethod 'POST' -CreatePath "/api/v1/components/$compKey/items" -CreateBody $itemBody `
                -PatchPath "/api/v1/components/$compKey/items/$itemKey" -PatchBody $itemPatch)
        }
    }

    # 4) recommendedAfterFail — second pass, now that every component exists so
    #    forward references (e.g. part 01 -> part 02) resolve.
    foreach ($comp in $comps) {
        if (-not $comp.recommendedAfterFail) { continue }
        $compKey = Get-Slug $comp.id
        $keys    = @($comp.recommendedAfterFail | ForEach-Object { Get-Slug $_ })
        $r = Invoke-Kata 'PATCH' "/api/v1/components/$compKey" ([ordered]@{ recommendedAfterFail = $keys })
        if ($DryRun -or ($r.Code -match '^2\d\d$')) {
            $script:counts.updated++
            Write-Log ("LINKED  component {0} recommendedAfterFail -> [{1}] (HTTP {2})" -f $compKey, ($keys -join ', '), $r.Code)
        } else {
            $script:counts.failed++
            $snippet = ($r.Body -replace '\s+', ' ')
            if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) + '…' }
            Write-Log ("FAILED  recommendedAfterFail on {0} (HTTP {1}) {2}" -f $compKey, $r.Code, $snippet) 'ERROR'
        }
    }
}

Write-Log ("Done. created={0} updated={1} failed={2}" -f $script:counts.created, $script:counts.updated, $script:counts.failed)
if ($script:counts.failed -gt 0) { exit 1 }
