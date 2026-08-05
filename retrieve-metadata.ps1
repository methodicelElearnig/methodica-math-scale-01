#Requires -Version 7.0
<#
.SYNOPSIS
    Retrieve a content unit from the Kata (Katalog) catalog API and write it back out
    as metadata files, in exactly the format of the metadata/ folder.

.DESCRIPTION
    The opposite direction of send-metadata.ps1. One GET of
    /api/v1/content-units/{unitKey} returns the whole tree (unit + components +
    their subContent items + questions); this script splits it into the same file
    layout the metadata/ folder uses — <unitKey>_unit.json plus one <componentKey>.json
    per component — and writes them to metadata-from/ (never touching metadata/).

    Because output formatting matches the hand-authored style of metadata/ byte for
    byte (2-space indent, CRLF, UTF-8 without BOM, short arrays and flat objects
    inlined), you can diff the two folders and see only real content differences:

        git diff --no-index metadata metadata-from

    Enum values are passed through verbatim: KATA now stores the same kebab-case
    vocabulary the metadata files use (state-general, core-curriculum-basic,
    project-or-inquiry-task, interactive-content ...), so no remapping is needed in
    this direction. Fields KATA adds and the metadata format has no place for
    (status, masteryLevel, manufacturerGroupId, hostedContentRef, kind, providerName,
    providerLogoUrl, componentCount, per-item/per-question order) are dropped — use
    -KeepRaw to also save the untouched API response.

    Runtime: PowerShell 7+ and curl.exe (bundled with Windows 10/11).

    SAFETY: never hard-code the API key here — this script is committed. Supply it via
    -ApiKey, $env:KATA_API_KEY, or the git-ignored kata-api-key.txt next to this script,
    shared with send-metadata.ps1 (see SEND-METADATA.md). Never logged.

.PARAMETER ApiKey
    The Kata API key. Overrides $env:KATA_API_KEY and kata-api-key.txt.

.PARAMETER UnitKey
    The unit's uniqueKey in KATA. Omitted: taken from metadata/*_unit.json, or from
    GET /api/v1/content-units when the account owns exactly one unit.

.PARAMETER BaseUrl
    Override the API base URL (default https://kata.cet.ac.il).

.PARAMETER OutDir
    Override the output folder (default: metadata-from/ next to this script).

.PARAMETER IdBase
    URL prefix used to rebuild the `id` URLs when KATA carries no hostedContentRef
    to derive them from. Normally unused.

.PARAMETER KeepRaw
    Also save the untouched API response to <OutDir>/_raw/<unitKey>.json.

.EXAMPLE
    pwsh -File retrieve-metadata.ps1
.EXAMPLE
    pwsh -File retrieve-metadata.ps1 -UnitKey methodica-math-scale-01 -KeepRaw
#>
[CmdletBinding()]
param(
    [string] $UnitKey,
    [string] $ApiKey,
    [string] $BaseUrl,
    [string] $OutDir,
    [string] $IdBase,
    [switch] $KeepRaw
)

# ============================================================================
#  CONFIG  — check these before running
# ----------------------------------------------------------------------------
#  REUSE GUIDE — retrieving a DIFFERENT unit? Touch only what applies:
#    (1) ALWAYS: the API key (or leave it to be picked up from send-metadata.ps1),
#        and -UnitKey if it can't be auto-detected from metadata/.
#    (2) PER-UNIT: title language, the manufacture value written into components,
#        and the $IdBase fallback.
#    There is deliberately NO enum-mapping section: KATA returns the same
#    kebab-case vocabulary the metadata files store, so values pass through as-is.
# ============================================================================

# ── (1) PER-RUN / ENVIRONMENT — always check ────────────────────────────────
# API key from Kata -> "מפתחות API" (/api-credentials).
# NEVER hard-code it here — this script is committed. It is resolved at runtime, in
# order, from: the -ApiKey parameter, the KATA_API_KEY environment variable, or the
# git-ignored key file below (one line, just the key). Shared with send-metadata.ps1.
$ApiKeyFile = Join-Path $PSScriptRoot 'kata-api-key.txt'
# API base URL (override at launch with -BaseUrl).
if (-not $BaseUrl) { $BaseUrl = 'https://kata.cet.ac.il' }
# Where the retrieved metadata files go (override with -OutDir).
if (-not $OutDir)  { $OutDir  = Join-Path $PSScriptRoot 'metadata-from' }
# Run log (git-ignored via *.log).
$LogFile = Join-Path $PSScriptRoot 'retrieve-metadata.log'

# ── (2) PER-UNIT — usually fine as-is ───────────────────────────────────────
# Which language to unwrap the unit's title object with:
#   { "Hebrew": "מדידת מסה" } -> "מדידת מסה".
$TitleLangKey = 'Hebrew'
# Value written to each component's `manufacture`. KATA returns the provider's
# display name ("מתודיקה"); the metadata files use the slug. Set to $null to pass
# KATA's own value through instead.
$Manufacture = 'methodica'
# Fallback URL prefix for rebuilding `id` fields, used ONLY when no component
# carries a hostedContentRef to derive the real prefix from (override with -IdBase).
if (-not $IdBase) { $IdBase = 'https://lomdot.education.gov.il/metodica/720active/math/scale/01' }

# ── (3) OUTPUT FORMATTING — mirrors the hand-authored style of metadata/ ─────
# An empty array is always `[]`. A non-empty array of primitives goes on one line
# while its compact form stays within the budget below, otherwise it gets one
# element per line — so the content-bearing lists (answers, correctAnswers,
# targetSector, skills, recommendedAfterFail, …) show each element as its own line
# in a diff. The short tuples in $InlineArrayKeys get a longer allowance, because
# that's how metadata/ stores them.
#
# The two budgets were fitted by round-tripping metadata/ through this formatter:
# 8 / 62 reproduces 5 of the 6 files byte for byte. The single residual line is
# `"answers": ["כן", "לא"]` in part 04, which metadata/ inlines at 12 chars — but a
# 12-char budget re-formats more lines elsewhere than it fixes, because the
# hand-authored files aren't self-consistent there. Re-measure before changing.
$InlineArrayMaxChars = 8
$InlineArrayKeys     = @('languages', 'source', 'target')
$InlineTupleMaxChars = 62
# A small flat object (every value primitive) is written on one line — that's how
# the matching questions' correctAnswers pairs are stored. Bigger or nested
# objects always get one key per line.
$InlineObjectMaxProps = 3
$InlineObjectMaxChars = 200

# ============================================================================
#  End of CONFIG
# ============================================================================

$ErrorActionPreference = 'Stop'
$script:counts = @{ components = 0; items = 0; warnings = 0; failed = 0 }

function Write-Log {
    param([string] $Message, [string] $Level = 'INFO')
    $line = "[{0}] {1}" -f $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Write-Warn {
    param([string] $Message)
    $script:counts.warnings++
    Write-Log $Message 'WARN'
}

# Last path segment, tolerating a trailing slash (same helper as send-metadata.ps1).
function Get-Slug {
    param([string] $Url)
    return (($Url.TrimEnd('/')) -split '/')[-1]
}

# -ApiKey > $env:KATA_API_KEY > the git-ignored key file. Returns '' if none is set.
function Resolve-ApiKey {
    if ($ApiKey)           { return $ApiKey.Trim() }
    if ($env:KATA_API_KEY) { return $env:KATA_API_KEY.Trim() }
    if (Test-Path $ApiKeyFile) {
        return ((Get-Content -Raw -Path $ApiKeyFile -Encoding UTF8) -replace '\s', '')
    }
    return ''
}

# ---- API --------------------------------------------------------------------

function Get-Kata {
    param([string] $Path)
    $url = "$BaseUrl$Path"
    $curlArgs = @('-sS', '-X', 'GET', $url, '-H', "X-API-Key: $ApiKey", '-w', '\n%{http_code}')
    $raw  = (& curl.exe @curlArgs 2>&1 | Out-String)
    $text = ($raw -replace "`r", '').TrimEnd("`n")
    $idx  = $text.LastIndexOf("`n")
    if ($idx -ge 0) {
        return @{ Code = $text.Substring($idx + 1).Trim(); Body = $text.Substring(0, $idx) }
    }
    return @{ Code = $text.Trim(); Body = '' }
}

# ConvertFrom-Json helpfully turns anything ISO-8601-shaped (createdAt/updatedAt, and
# any timestamp inside a question) into a [datetime], losing the original text. PS 7.5+
# can be told not to; on older 7.x Format-JsonPrimitive re-serializes them instead.
$script:JsonDateKind = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')
function Convert-KataJson {
    param([string] $Json)
    if ($script:JsonDateKind) { return ($Json | ConvertFrom-Json -DateKind String) }
    return ($Json | ConvertFrom-Json)
}

function Get-Snippet {
    param([string] $Text)
    $s = ($Text -replace '\s+', ' ')
    if ($s.Length -gt 400) { $s = $s.Substring(0, 400) + '…' }
    return $s
}

# ---- JSON writer ------------------------------------------------------------
#  ConvertTo-Json expands every array, which would add whitespace noise to every
#  diff against metadata/. This formatter reproduces the existing style instead.

function Get-JsonKind {
    param($Value)
    if ($null -eq $Value)                                        { return 'primitive' }
    if ($Value -is [string] -or $Value -is [ValueType])          { return 'primitive' }
    if ($Value -is [System.Collections.IDictionary])             { return 'object' }
    if ($Value -is [System.Management.Automation.PSCustomObject]) { return 'object' }
    if ($Value -is [System.Collections.IEnumerable])             { return 'array' }
    return 'primitive'
}

function Format-JsonPrimitive {
    param($Value)
    if ($null -eq $Value)   { return 'null' }
    if ($Value -is [bool])  { return $(if ($Value) { 'true' } else { 'false' }) }
    if ($Value -is [string]) {
        $t = $Value -replace '\\', '\\' -replace '"', '\"'
        $t = $t -replace "`b", '\b' -replace "`f", '\f' -replace "`r", '\r' -replace "`n", '\n' -replace "`t", '\t'
        $t = [regex]::Replace($t, '[\x00-\x1f]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
        return '"' + $t + '"'
    }
    # ConvertFrom-Json turns ISO-8601 strings into [datetime] on PowerShell < 7.5
    # (see Convert-KataJson); put them back as quoted strings, not bare numbers.
    if ($Value -is [datetime] -or $Value -is [datetimeoffset]) {
        return (Format-JsonPrimitive $Value.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ', [System.Globalization.CultureInfo]::InvariantCulture))
    }
    if ($Value -is [ValueType]) {
        return [System.Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture)
    }
    return (Format-JsonPrimitive ([string] $Value))
}

# Name/Value pairs of an object, in source order.
function Get-JsonPairs {
    param($Value)
    if ($Value -is [System.Collections.IDictionary]) {
        return @(foreach ($k in $Value.Keys) { [pscustomobject]@{ Name = [string] $k; Value = $Value[$k] } })
    }
    return @($Value.PSObject.Properties | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Value = $_.Value } })
}

function ConvertTo-CompactJson {
    param($Value)
    $kind = Get-JsonKind $Value
    if ($kind -eq 'primitive') { return (Format-JsonPrimitive $Value) }
    if ($kind -eq 'array') {
        $items = @($Value)
        if ($items.Count -eq 0) { return '[]' }
        $parts = foreach ($it in $items) { ConvertTo-CompactJson $it }
        return '[' + ($parts -join ', ') + ']'
    }
    $pairs = @(Get-JsonPairs $Value)
    if ($pairs.Count -eq 0) { return '{}' }
    $parts = foreach ($p in $pairs) { (Format-JsonPrimitive $p.Name) + ': ' + (ConvertTo-CompactJson $p.Value) }
    return '{' + ($parts -join ', ') + '}'
}

# $Key is the property name this value sits under — it decides whether an array is
# written inline (see $InlineArrayKeys).
function Format-Json {
    param($Value, [int] $Indent = 0, [string] $Key = '')
    $kind = Get-JsonKind $Value
    if ($kind -eq 'primitive') { return (Format-JsonPrimitive $Value) }

    $pad  = ' ' * $Indent
    $pad2 = ' ' * ($Indent + 2)

    if ($kind -eq 'array') {
        $items = @($Value)
        if ($items.Count -eq 0) { return '[]' }
        if (-not ($items | Where-Object { (Get-JsonKind $_) -ne 'primitive' })) {
            $budget  = if ($InlineArrayKeys -contains $Key) { $InlineTupleMaxChars } else { $InlineArrayMaxChars }
            $compact = ConvertTo-CompactJson $Value
            if ($compact.Length -le $budget) { return $compact }
        }
        $lines = foreach ($it in $items) { $pad2 + (Format-Json $it ($Indent + 2)) }
        return "[`n" + ($lines -join ",`n") + "`n$pad]"
    }

    $pairs = @(Get-JsonPairs $Value)
    if ($pairs.Count -eq 0) { return '{}' }
    $isFlat = -not ($pairs | Where-Object { (Get-JsonKind $_.Value) -ne 'primitive' })
    if ($isFlat -and $pairs.Count -le $InlineObjectMaxProps) {
        $compact = ConvertTo-CompactJson $Value
        if ($compact.Length -le $InlineObjectMaxChars) { return $compact }
    }
    $lines = foreach ($p in $pairs) {
        $pad2 + (Format-JsonPrimitive $p.Name) + ': ' + (Format-Json $p.Value ($Indent + 2) $p.Name)
    }
    return "{`n" + ($lines -join ",`n") + "`n$pad}"
}

# UTF-8 without BOM, CRLF, trailing newline — matching the metadata/ files.
function Write-TextFile {
    param([string] $Path, [string] $Text)
    $crlf = ($Text -replace "`r`n", "`n") -replace "`n", "`r`n"
    if (-not $crlf.EndsWith("`r`n")) { $crlf += "`r`n" }
    [System.IO.File]::WriteAllText($Path, $crlf, (New-Object System.Text.UTF8Encoding($false)))
}

function Write-JsonFile {
    param([string] $Path, $Value)
    Write-TextFile $Path (Format-Json $Value 0)
}

# ---- Shaping KATA responses into the metadata format ------------------------

# $null / a scalar / an array -> always a real array (never @($null)). The leading
# comma is required: `return @()` collapses to $null and `return @($x)` to a scalar.
function ConvertTo-JsonArray {
    param($Value)
    if ($null -eq $Value) { return ,@() }
    return ,@($Value)
}

# "…/part-01/index.html" -> "…/part-01" (drops a trailing file name, if any).
function Get-ContentId {
    param([string] $Ref)
    if ([string]::IsNullOrWhiteSpace($Ref)) { return $null }
    $r = $Ref.TrimEnd('/')
    $last = $r.Substring($r.LastIndexOf('/') + 1)
    if ($last -match '\.[A-Za-z0-9]+$') { $r = $r.Substring(0, $r.LastIndexOf('/')) }
    return $r
}

function Get-UnitTitle {
    param($Unit)
    if ($Unit.title -is [string]) { return $Unit.title }
    $props = @(Get-JsonPairs $Unit.title)
    $match = $props | Where-Object { $_.Name -eq $TitleLangKey } | Select-Object -First 1
    if ($match) { return $match.Value }
    if ($props.Count -gt 0) {
        Write-Warn ("Unit title has no '{0}' key — using '{1}' instead." -f $TitleLangKey, $props[0].Name)
        return $props[0].Value
    }
    Write-Warn 'Unit has no title.'
    return ''
}

function New-UnitFileBody {
    param($Unit, [string] $UnitId)
    return [ordered]@{
        id                            = $UnitId
        title                         = (Get-UnitTitle $Unit)
        subTopic                      = $Unit.subTopic
        learningObjective             = $Unit.learningObjective
        targetSector                  = (ConvertTo-JsonArray $Unit.targetSector)
        targetAudience                = (ConvertTo-JsonArray $Unit.targetAudience)
        prerequisiteLearningObjective = (ConvertTo-JsonArray $Unit.prerequisiteLearningObjective)
    }
}

function New-ItemFileBody {
    param($Item, [string] $ComponentId)
    $questions = foreach ($q in (ConvertTo-JsonArray $Item.questions)) {
        # Verbatim except `order`, which the metadata format doesn't carry. The
        # answers/correctAnswers shapes differ per questionType (string arrays for
        # choice/fill-in/…, objects for matching), so nothing here is normalized.
        $out = [ordered]@{}
        foreach ($p in (Get-JsonPairs $q)) { if ($p.Name -ne 'order') { $out[$p.Name] = $p.Value } }
        $out
    }
    return [ordered]@{
        id               = "$ComponentId/$($Item.uniqueKey)"
        title            = $Item.title
        informationToBot = $Item.informationToBot
        contentType      = $Item.contentType
        mediaFormat      = $Item.mediaFormat
        questions        = (ConvertTo-JsonArray $questions)
    }
}

function New-ComponentFileBody {
    param($Comp, [string] $UnitId, [string] $UrlPrefix)

    $compId = Get-ContentId $Comp.hostedContentRef
    if (-not $compId) {
        $compId = "$UrlPrefix/$($Comp.uniqueKey)"
        Write-Warn ("Component {0} has no hostedContentRef — id rebuilt as {1}" -f $Comp.uniqueKey, $compId)
    }

    $afterFail = @(foreach ($r in (ConvertTo-JsonArray $Comp.recommendedAfterFail)) { "$UrlPrefix/$(Get-Slug ([string] $r))/" })

    $items = foreach ($it in ((ConvertTo-JsonArray $Comp.subContent) | Sort-Object { [int] $_.order })) {
        $script:counts.items++
        New-ItemFileBody $it $compId
    }

    return [ordered]@{
        id                     = $compId
        title                  = $Comp.title
        learningUnitId         = $UnitId
        componentPurpose       = $Comp.componentPurpose
        isAssessment           = [bool] $Comp.isAssessment
        manufacture            = $(if ($null -ne $Manufacture) { $Manufacture } else { $Comp.manufacture })
        recommendedAfterFail   = $afterFail
        isRequired             = [bool] $Comp.isRequired
        relativeDifficulty     = [int] $Comp.relativeDifficulty
        order                  = [int] $Comp.order
        depthLevel             = $Comp.depthLevel
        cognitiveLevel         = $Comp.cognitiveLevel
        languages              = (ConvertTo-JsonArray $Comp.languages)
        skills                 = (ConvertTo-JsonArray $Comp.skills)
        estimatedTimeInMinutes = [int] $Comp.estimatedTimeInMinutes
        createdAt              = $Comp.createdAt
        updatedAt              = $Comp.updatedAt
        subContent             = (ConvertTo-JsonArray $items)
    }
}

# ---- Main -------------------------------------------------------------------

# Fresh log per run.
Set-Content -Path $LogFile -Value '=== retrieve-metadata ===' -Encoding UTF8

$ApiKey = Resolve-ApiKey
if (-not $ApiKey) {
    Write-Log ("API key not set. Pass -ApiKey, set `$env:KATA_API_KEY, or put the key on one line in " +
               "$ApiKeyFile (get it from /api-credentials).") 'ERROR'
    exit 1
}

Write-Log ("Base URL   : {0}" -f $BaseUrl)
Write-Log ("Output dir : {0}" -f $OutDir)

# 1) Which unit? Parameter, else the local metadata folder, else ask the catalog.
if ($UnitKey) { Write-Log ("Unit key   : {0} (-UnitKey)" -f $UnitKey) }
if (-not $UnitKey) {
    $localUnit = Get-ChildItem -Path (Join-Path $PSScriptRoot 'metadata') -Filter '*_unit.json' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($localUnit) {
        $UnitKey = Get-Slug ((Get-Content -Raw -Path $localUnit.FullName -Encoding UTF8 | ConvertFrom-Json).id)
        Write-Log ("Unit key   : {0} (from {1})" -f $UnitKey, $localUnit.Name)
    }
}
if (-not $UnitKey) {
    $r = Get-Kata '/api/v1/content-units'
    if ($r.Code -ne '200') {
        Write-Log ("Cannot list content units (HTTP {0}) {1}" -f $r.Code, (Get-Snippet $r.Body)) 'ERROR'
        exit 1
    }
    $keys = @((Convert-KataJson $r.Body) | ForEach-Object { $_.uniqueKey })
    if ($keys.Count -eq 1) {
        $UnitKey = $keys[0]
        Write-Log ("Unit key   : {0} (only unit in the catalog)" -f $UnitKey)
    } else {
        Write-Log ("Cannot pick a unit automatically — pass -UnitKey. Available: {0}" -f ($keys -join ', ')) 'ERROR'
        exit 1
    }
}

# 2) One GET returns the whole tree.
$r = Get-Kata "/api/v1/content-units/$UnitKey"
if ($r.Code -ne '200') {
    Write-Log ("FAILED  GET /api/v1/content-units/{0} (HTTP {1}) {2}" -f $UnitKey, $r.Code, (Get-Snippet $r.Body)) 'ERROR'
    exit 1
}
$unit = Convert-KataJson $r.Body

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# 3) Optionally keep the untouched response — the dropped KATA-only fields live here.
if ($KeepRaw) {
    $rawDir = Join-Path $OutDir '_raw'
    New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
    $rawPath = Join-Path $rawDir "$UnitKey.json"
    Write-TextFile $rawPath $r.Body
    Write-Log ("RAW     {0}" -f (Split-Path -Leaf $rawPath))
}

# 4) Sanity check — the nested response is the only source of component keys.
$components = @((ConvertTo-JsonArray $unit.components) | Sort-Object { [int] $_.order })
if ($null -ne $unit.componentCount -and [int] $unit.componentCount -ne $components.Count) {
    Write-Warn ("Unit reports componentCount={0} but the response carries {1} components." -f $unit.componentCount, $components.Count)
}
if ($components.Count -eq 0) { Write-Warn 'Unit has no components — writing the unit file only.' }

# 5) Rebuild the URL prefix the `id` fields need, from any component's hostedContentRef.
$sample = $components | Where-Object { $_.hostedContentRef } | Select-Object -First 1
if ($sample) {
    $sampleId  = Get-ContentId $sample.hostedContentRef
    $urlPrefix = $sampleId.Substring(0, $sampleId.LastIndexOf('/'))
} else {
    $urlPrefix = $IdBase.TrimEnd('/')
    Write-Warn ("No component carries a hostedContentRef — rebuilding id URLs from -IdBase ({0})." -f $urlPrefix)
}
$unitId = "$urlPrefix/$UnitKey"

# 6) Write the files.
$unitPath = Join-Path $OutDir "$UnitKey`_unit.json"
Write-JsonFile $unitPath (New-UnitFileBody $unit $unitId)
Write-Log ("WROTE   {0}" -f (Split-Path -Leaf $unitPath))

foreach ($comp in $components) {
    $before = $script:counts.items
    $body   = New-ComponentFileBody $comp $unitId $urlPrefix
    $path   = Join-Path $OutDir "$($comp.uniqueKey).json"
    Write-JsonFile $path $body
    $script:counts.components++
    Write-Log ("WROTE   {0} ({1} items)" -f (Split-Path -Leaf $path), ($script:counts.items - $before))
}

Write-Log ("Done. unit=1 components={0} items={1} warnings={2}" -f
    $script:counts.components, $script:counts.items, $script:counts.warnings)
if ($script:counts.failed -gt 0) { exit 1 }
