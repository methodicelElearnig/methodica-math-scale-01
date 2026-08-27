chcp 65001 > $null
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

. (Join-Path $here 'lib.ps1')
. (Join-Path $here 'data-00.ps1')
. (Join-Path $here 'data-01.ps1')
. (Join-Path $here 'data-02.ps1')
. (Join-Path $here 'data-03.ps1')
. (Join-Path $here 'data-04.ps1')
. (Join-Path $here 'data-05.ps1')

function PartFolder([string]$screenId) {
    $part = $screenId.Substring(3,2)
    if ($part -eq '00') { return '' }  # module root — source-location already file-relative
    return "methodica-math-scale-01-$part/"
}

# ---------- Validate IDs are unique ----------
$dupIds = $global:Units | Group-Object Id | Where-Object { $_.Count -gt 1 }
if ($dupIds) {
    Write-Host "DUPLICATE UNIT IDS FOUND:"
    $dupIds | ForEach-Object { Write-Host " - $($_.Name) x$($_.Count)" }
    throw "Duplicate trans-unit ids — fix before generating XLIFF."
}
$dupScreens = $global:Screens | Group-Object Id | Where-Object { $_.Count -gt 1 }
if ($dupScreens) {
    Write-Host "DUPLICATE SCREEN IDS FOUND:"
    $dupScreens | ForEach-Object { Write-Host " - $($_.Name) x$($_.Count)" }
    throw "Duplicate screen ids — fix before generating."
}

# every unit's ScreenId must exist in the screen manifest
$screenIdSet = @{}
foreach ($s in $global:Screens) { $screenIdSet[$s.Id] = $true }
$orphanUnits = $global:Units | Where-Object { -not $screenIdSet.ContainsKey($_.ScreenId) }
if ($orphanUnits) {
    Write-Host "UNITS REFERENCING UNKNOWN SCREEN IDS:"
    $orphanUnits | ForEach-Object { Write-Host " - $($_.Id) -> $($_.ScreenId)" }
    throw "Fix screen-id references before generating."
}
# every screen should have at least one unit (informational, not fatal)
$unitScreenIds = @{}
foreach ($u in $global:Units) { $unitScreenIds[$u.ScreenId] = $true }
$emptyScreens = $global:Screens | Where-Object { -not $unitScreenIds.ContainsKey($_.Id) }
if ($emptyScreens) {
    Write-Host "WARNING - screens with no units:"
    $emptyScreens | ForEach-Object { Write-Host " - $($_.Id) ($($_.Title))" }
}

# ---------- Build XLIFF ----------
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.AppendLine('<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">')

$byPart = $global:Units | Group-Object { $_.ScreenId.Substring(3,2) } | Sort-Object Name
foreach ($partGroup in $byPart) {
    $part = $partGroup.Name
    $folder = PartFolder ("01-$part-00")
    $original = if ($folder -eq '') { 'index.html (module root); unit-js/25-report.js' } else { "$folder" + "index.html; $folder" + "script.js" }
    [void]$sb.AppendLine("  <file original=`"$(XmlEscape $original)`" source-language=`"he`" target-language=`"he`" datatype=`"html`">")
    [void]$sb.AppendLine('    <body>')
    foreach ($u in ($partGroup.Group | Sort-Object Id)) {
        [void]$sb.AppendLine("      <trans-unit id=`"$($u.Id)`">")
        [void]$sb.AppendLine("        <source>$(XmlEscape $u.Source)</source>")
        [void]$sb.AppendLine('        <target></target>')
        [void]$sb.AppendLine("        <note from=`"screen-id`">$(XmlEscape $u.ScreenId)</note>")
        if ($u.ScreenTitle) { [void]$sb.AppendLine("        <note from=`"screen-title`">$(XmlEscape $u.ScreenTitle)</note>") }
        if ($u.ScreenType)  { [void]$sb.AppendLine("        <note from=`"screen-type`">$(XmlEscape $u.ScreenType)</note>") }
        if ($u.ElementRole) { [void]$sb.AppendLine("        <note from=`"element-role`">$(XmlEscape $u.ElementRole)</note>") }
        if ($u.SourceLocation) {
            $loc = if ($folder -eq '') { $u.SourceLocation } else { "$folder$($u.SourceLocation)" }
            [void]$sb.AppendLine("        <note from=`"source-location`">$(XmlEscape $loc)</note>")
        }
        if ($u.DeveloperNote) { [void]$sb.AppendLine("        <note from=`"developer-note`">$(XmlEscape $u.DeveloperNote)</note>") }
        if ($u.ManualReview)  { [void]$sb.AppendLine("        <note from=`"manual-review`">$(XmlEscape $u.ManualReview)</note>") }
        [void]$sb.AppendLine('      </trans-unit>')
    }
    [void]$sb.AppendLine('    </body>')
    [void]$sb.AppendLine('  </file>')
}
[void]$sb.AppendLine('</xliff>')

$xliffPath = Join-Path $here 'methodica-math-scale-01_target-01_he.xlf'
[System.IO.File]::WriteAllText($xliffPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote XLIFF: $xliffPath ($($global:Units.Count) units)"

# ---------- Build CSV manifest ----------
$csvLines = New-Object System.Collections.Generic.List[string]
$csvLines.Add('screen_id,screen_title,screen_type,source_file,container_or_selector,manual_review')
function CsvEsc([string]$s) {
    if ($null -eq $s) { $s = '' }
    if ($s -match '[",\r\n]') { return '"' + ($s -replace '"','""') + '"' }
    return $s
}
foreach ($s in ($global:Screens | Sort-Object Id)) {
    $csvLines.Add( (CsvEsc $s.Id) + ',' + (CsvEsc $s.Title) + ',' + (CsvEsc $s.Type) + ',' + (CsvEsc $s.SourceFile) + ',' + (CsvEsc $s.Selector) + ',' + (CsvEsc $s.ManualReview) )
}
$csvPath = Join-Path $here 'translation-screen-manifest.csv'
[System.IO.File]::WriteAllText($csvPath, ($csvLines -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote manifest: $csvPath ($($global:Screens.Count) screens)"

# ---------- Stats for the report ----------
$stats = [PSCustomObject]@{
    TotalScreens = $global:Screens.Count
    TotalUnits   = $global:Units.Count
    UnitsBySourceLocationFile = ($global:Units | ForEach-Object { ($_.SourceLocation -split ':')[0] -split ',' | Select-Object -First 1 } | Group-Object | Sort-Object Count -Descending | ForEach-Object { "$($_.Name): $($_.Count)" }) -join '; '
    UnitsWithManualReview = ($global:Units | Where-Object { $_.ManualReview }).Count
    ScreensWithManualReview = ($global:Screens | Where-Object { $_.ManualReview }).Count
}
$stats | ConvertTo-Json | Out-File -FilePath (Join-Path $here 'stats.json') -Encoding utf8
Write-Host "Total screens: $($stats.TotalScreens)"
Write-Host "Total units:   $($stats.TotalUnits)"
Write-Host "Units flagged manual-review: $($stats.UnitsWithManualReview)"
