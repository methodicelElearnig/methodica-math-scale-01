#Requires -Version 7.0
<#
.SYNOPSIS
    One-time migration: rename every component and item uniqueKey in Kata from a bare
    slug to the full IRI that metadata/ already carries.

.DESCRIPTION
    720 v2.5 p.11 requires a component's and an item's id to be an IRI. Kata's 2026-09-15
    release began reporting `identifier_not_iri` on every slug-keyed row ("Advisory for
    now"), and in the same release shipped the query-string routes that make an IRI key
    routable at all — a key containing '/' cannot survive a URL path segment.

    This script does NOT invent identifiers. Every new key is read verbatim from
    metadata/*.json, which has always held the correct IRIs; Kata's slug was produced by
    Get-Slug in send-metadata.ps1, a lossy transformation applied on the way out.

    Per component: unpublish -> rename the component -> rename its items -> restore the
    original publish state. Every write is followed by a read-back, because "HTTP 200 and
    silently ignored" is a real failure mode of this API.

    IDEMPOTENT: a row already keyed by its IRI is detected and skipped, so a partial run
    can simply be re-run.

    REVERSIBLE: see rename-to-iri.md for the rollback direction.

    Runtime: PowerShell 7+ and curl.exe (bundled with Windows 10/11).

    SAFETY: never hard-code the API key here — this script is committed. Supply it via
    -ApiKey, $env:KATA_API_KEY, or the git-ignored kata-api-key.txt next to this script.

.PARAMETER DryRun
    Print every call WITHOUT touching the network. No key required.

.PARAMETER ApiKey
    The Kata API key. Overrides $env:KATA_API_KEY and kata-api-key.txt.

.PARAMETER BaseUrl
    Override the API base URL (default https://kata.cet.ac.il).

.PARAMETER MetadataDir
    Override the metadata folder (default: the metadata/ folder at the repo root).

.PARAMETER Revert
    Rename in the opposite direction — IRI back to slug — for rollback.

.EXAMPLE
    pwsh -File docs-and-tools/rename-to-iri.ps1 -DryRun
.EXAMPLE
    pwsh -File docs-and-tools/rename-to-iri.ps1
.EXAMPLE
    pwsh -File docs-and-tools/rename-to-iri.ps1 -Revert
#>
[CmdletBinding()]
param(
    [switch] $DryRun,
    [switch] $Revert,
    [string] $ApiKey,
    [string] $BaseUrl,
    [string] $MetadataDir
)

# The key file sits in docs-and-tools/ in some units and at the repo root in others
# (mass-measure-02 and the ratio pair vs scale-01, percent-02, mass-measure-01). Look in
# both rather than making the caller remember which convention a given unit follows.
$ApiKeyFile = @(
    (Join-Path $PSScriptRoot 'kata-api-key.txt'),
    (Join-Path (Split-Path -Parent $PSScriptRoot) 'kata-api-key.txt')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ApiKeyFile) { $ApiKeyFile = Join-Path $PSScriptRoot 'kata-api-key.txt' }  # for the error message
if (-not $BaseUrl)     { $BaseUrl     = 'https://kata.cet.ac.il' }
if (-not $MetadataDir) { $MetadataDir = Join-Path $PSScriptRoot '..\metadata' }
$LogFile = Join-Path $PSScriptRoot 'rename-to-iri.log'

$ErrorActionPreference = 'Stop'
$script:counts = @{ renamed = 0; skipped = 0; failed = 0 }

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

# Every key now travels in a query string, so it must be percent-encoded. This is the
# whole reason an IRI key works at all: '%2F' is ordinary data in a query parameter,
# whereas a path segment is split on '/' before routing.
function Enc {
    param([string] $Value)
    return [uri]::EscapeDataString($Value)
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

function Invoke-Kata {
    param([string] $Method, [string] $Path, $Body)
    $url = "$BaseUrl$Path"

    if ($DryRun) {
        Write-Log "DRY-RUN $Method $url"
        if ($null -ne $Body) { Write-Host ($Body | ConvertTo-Json -Depth 12 -Compress) }
        return @{ Code = '000'; Body = '' }
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

        $raw  = (& curl.exe @curlArgs 2>&1 | Out-String)
        $text = ($raw -replace "`r", '').TrimEnd("`n")
        $idx  = $text.LastIndexOf("`n")
        if ($idx -ge 0) {
            return @{ Code = $text.Substring($idx + 1).Trim(); Body = $text.Substring(0, $idx) }
        }
        return @{ Code = $text.Trim(); Body = '' }
    }
    finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

function Get-Json {
    param([string] $Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    try { return ($Text | ConvertFrom-Json) } catch { return $null }
}

# Read one component by key. Returns @{ Code; Obj }.
function Get-Component {
    param([string] $Key)
    $r = Invoke-Kata 'GET' ("/api/v1/component?componentKey=" + (Enc $Key)) $null
    return @{ Code = $r.Code; Obj = (Get-Json $r.Body) }
}

# Read one item by (componentKey, itemKey). Returns @{ Code; Obj }.
function Get-Item {
    param([string] $CompKey, [string] $ItemKey)
    $path = "/api/v1/component/item?componentKey=" + (Enc $CompKey) + "&itemKey=" + (Enc $ItemKey)
    $r = Invoke-Kata 'GET' $path $null
    return @{ Code = $r.Code; Obj = (Get-Json $r.Body) }
}

function Format-Warnings {
    param($Obj)
    if ($null -eq $Obj -or $null -eq $Obj.warnings -or $Obj.warnings.Count -eq 0) { return 'none' }
    return (($Obj.warnings | ForEach-Object { $_.code }) -join ',')
}

# ── Resolve the key ─────────────────────────────────────────────────────────
$ApiKey = Resolve-ApiKey
if (-not $ApiKey -and -not $DryRun) {
    Write-Log 'No API key. Supply -ApiKey, set $env:KATA_API_KEY, or create kata-api-key.txt.' 'ERROR'
    exit 1
}

# ── Load metadata ───────────────────────────────────────────────────────────
$MetadataDir = (Resolve-Path $MetadataDir).Path
$unitFile = Get-ChildItem -Path $MetadataDir -Filter '*_unit.json' | Select-Object -First 1
if (-not $unitFile) { Write-Log "No *_unit.json in $MetadataDir" 'ERROR'; exit 1 }
$unit     = Get-Content -Raw -Path $unitFile.FullName -Encoding UTF8 | ConvertFrom-Json
$unitKey  = Get-Slug $unit.id

$compFiles = Get-ChildItem -Path $MetadataDir -Filter '*.json' |
             Where-Object { $_.Name -notlike '*_unit.json' } |
             Sort-Object Name

$direction = if ($Revert) { 'IRI -> slug (REVERT)' } else { 'slug -> IRI' }
Write-Log ("=== rename-to-iri  unit={0}  components={1}  direction={2}{3} ===" -f `
    $unitKey, $compFiles.Count, $direction, $(if ($DryRun) { '  [DRY-RUN]' } else { '' }))

# ── Walk the components ─────────────────────────────────────────────────────
foreach ($f in $compFiles) {
    $comp     = Get-Content -Raw -Path $f.FullName -Encoding UTF8 | ConvertFrom-Json
    $slugKey  = Get-Slug $comp.id
    $iriKey   = $comp.id
    $fromKey  = if ($Revert) { $iriKey }  else { $slugKey }
    $toKey    = if ($Revert) { $slugKey } else { $iriKey }

    Write-Log ("--- component {0}" -f $slugKey)

    # Where does this component actually live right now? Tolerate a half-finished run.
    $cur = Get-Component $fromKey
    if ($DryRun) {
        $cur = @{ Code = '200'; Obj = [pscustomobject]@{ status = 'published' } }
    } elseif ($cur.Code -ne '200') {
        $already = Get-Component $toKey
        if ($already.Code -eq '200') {
            Write-Log ("  component already keyed '{0}' — skipping rename" -f $toKey)
            $script:counts.skipped++
            $cur = $already
            $fromKey = $toKey
        } else {
            Write-Log ("  component not found under '{0}' (HTTP {1}) nor '{2}' (HTTP {3}) — SKIPPING" -f `
                $fromKey, $cur.Code, $toKey, $already.Code) 'ERROR'
            $script:counts.failed++
            continue
        }
    }

    $wasPublished = ($cur.Obj -and $cur.Obj.status -eq 'published')

    # 1. Unpublish, so every write happens while the component is down.
    if ($wasPublished) {
        $r = Invoke-Kata 'POST' ("/api/v1/component/unpublish?componentKey=" + (Enc $fromKey)) $null
        Write-Log ("  unpublish            HTTP {0}" -f $r.Code)
    }

    # 2. Rename the component itself, unless it is already where we want it.
    if ($fromKey -ne $toKey) {
        $r = Invoke-Kata 'PATCH' ("/api/v1/component?componentKey=" + (Enc $fromKey)) ([ordered]@{ uniqueKey = $toKey })
        if (-not $DryRun -and $r.Code -notmatch '^2\d\d$') {
            Write-Log ("  RENAME FAILED        HTTP {0}  {1}" -f $r.Code, $r.Body) 'ERROR'
            $script:counts.failed++
            if ($wasPublished) { [void] (Invoke-Kata 'POST' ("/api/v1/component/publish?componentKey=" + (Enc $fromKey)) $null) }
            continue
        }
        # Read back: the rename is only real if the new key resolves.
        $back = Get-Component $toKey
        if (-not $DryRun -and $back.Code -ne '200') {
            Write-Log ("  READ-BACK FAILED     HTTP {0} on '{1}'" -f $back.Code, $toKey) 'ERROR'
            $script:counts.failed++
            continue
        }
        Write-Log ("  renamed -> {0}   warnings: {1}" -f $toKey, (Format-Warnings $back.Obj))
        $script:counts.renamed++
    }

    # 3. Rename this component's items, addressed under the component's NEW key.
    foreach ($item in @($comp.subContent)) {
        $iSlug = Get-Slug $item.id
        $iIri  = $item.id
        $iFrom = if ($Revert) { $iIri }  else { $iSlug }
        $iTo   = if ($Revert) { $iSlug } else { $iIri }

        if (-not $DryRun) {
            $probe = Get-Item $toKey $iFrom
            if ($probe.Code -ne '200') {
                $done = Get-Item $toKey $iTo
                if ($done.Code -eq '200') {
                    Write-Log ("  item {0}  already keyed — skipping" -f $iSlug)
                    $script:counts.skipped++
                    continue
                }
                Write-Log ("  item {0}  not found under either key (HTTP {1}/{2}) — SKIPPING" -f `
                    $iSlug, $probe.Code, $done.Code) 'ERROR'
                $script:counts.failed++
                continue
            }
        }

        $path = "/api/v1/component/item?componentKey=" + (Enc $toKey) + "&itemKey=" + (Enc $iFrom)
        $r = Invoke-Kata 'PATCH' $path ([ordered]@{ uniqueKey = $iTo })
        if (-not $DryRun -and $r.Code -notmatch '^2\d\d$') {
            Write-Log ("  item {0}  RENAME FAILED  HTTP {1}  {2}" -f $iSlug, $r.Code, $r.Body) 'ERROR'
            $script:counts.failed++
            continue
        }
        $iback = Get-Item $toKey $iTo
        if (-not $DryRun -and $iback.Code -ne '200') {
            Write-Log ("  item {0}  READ-BACK FAILED  HTTP {1}" -f $iSlug, $iback.Code) 'ERROR'
            $script:counts.failed++
            continue
        }
        Write-Log ("  item {0}  renamed   warnings: {1}" -f $iSlug, (Format-Warnings $iback.Obj))
        $script:counts.renamed++
    }

    # 4. Restore the publish state we found it in.
    if ($wasPublished) {
        $r = Invoke-Kata 'POST' ("/api/v1/component/publish?componentKey=" + (Enc $toKey)) $null
        Write-Log ("  republish            HTTP {0}" -f $r.Code)
    }
}

# ── recommendedAfterFail: a cross-reference held BY KEY, so it does not follow ──
# the rename and would dangle. Applied last, once every target key exists.
#
# The value is read back from KATA and only RE-FORMATTED, never taken from metadata/.
# This migration changes the FORM of an identifier, not which component a rule points at,
# and the two sources do disagree in the wild: on methodica-math-ratio-01, metadata says
# component 03 -> 01 while KATA holds 03 -> 02. Taking metadata's value would silently
# "fix" that — a content decision this script has no business making. Report it instead.
#
# Metadata is used only to RESOLVE a slug to its IRI, which also handles the other per-unit
# difference: some units store recommendedAfterFail as a full IRI (mass-measure-02) and
# others as a bare slug (ratio-01).
Write-Log '--- recommendedAfterFail'

# slug -> component IRI, from metadata/, for resolving whatever KATA currently holds.
$slugToIri = @{}
foreach ($f in $compFiles) {
    $c = Get-Content -Raw -Path $f.FullName -Encoding UTF8 | ConvertFrom-Json
    $slugToIri[(Get-Slug $c.id)] = $c.id
}

foreach ($f in $compFiles) {
    $comp = Get-Content -Raw -Path $f.FullName -Encoding UTF8 | ConvertFrom-Json
    $slugKey = Get-Slug $comp.id
    $key  = if ($Revert) { $slugKey } else { $comp.id }

    # What does KATA hold right now? That is the value we preserve.
    $cur  = Get-Component $key
    $refs = @()
    if ($cur.Obj -and $cur.Obj.recommendedAfterFail) { $refs = @($cur.Obj.recommendedAfterFail) }
    if ($DryRun -and $refs.Count -eq 0) {
        # A dry run cannot read KATA, so it falls back to metadata/ purely to show the SHAPE of
        # the call. Where the two sources disagree the live run will emit a different value —
        # KATA's, re-formatted. Say so, rather than letting the dry run quietly mislead.
        $refs = @($comp.recommendedAfterFail)
        if ($refs.Count) {
            Write-Log ("  {0}: [DRY-RUN] value shown is metadata's; the live run preserves whatever KATA holds" -f $slugKey)
        }
    }
    if ($refs.Count -eq 0) { continue }

    $vals = @($refs | ForEach-Object {
        $s = Get-Slug ([string] $_)
        if ($Revert) { $s }
        elseif ($slugToIri.ContainsKey($s)) { $slugToIri[$s] }
        else {
            Write-Log ("  {0}: reference '{1}' matches no component in metadata/ — left as-is" -f $slugKey, $_) 'ERROR'
            [string] $_
        }
    })

    $r = Invoke-Kata 'PATCH' ("/api/v1/component?componentKey=" + (Enc $key)) ([ordered]@{ recommendedAfterFail = $vals })
    if (-not $DryRun -and $r.Code -notmatch '^2\d\d$') {
        Write-Log ("  {0}  FAILED  HTTP {1}  {2}" -f $slugKey, $r.Code, $r.Body) 'ERROR'
        $script:counts.failed++
        continue
    }
    $back = Get-Component $key
    $got  = if ($back.Obj) { ($back.Obj.recommendedAfterFail -join ', ') } else { '(dry-run)' }
    Write-Log ("  {0}  -> {1}" -f $slugKey, $got)
}

Write-Log ("=== done: renamed={0} skipped={1} failed={2} ===" -f `
    $script:counts.renamed, $script:counts.skipped, $script:counts.failed)
if ($script:counts.failed -gt 0) { exit 1 }
