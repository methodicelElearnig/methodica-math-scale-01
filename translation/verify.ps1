chcp 65001 > $null
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here

. (Join-Path $here 'lib.ps1')
. (Join-Path $here 'data-00.ps1')
. (Join-Path $here 'data-01.ps1')
. (Join-Path $here 'data-02.ps1')
. (Join-Path $here 'data-03.ps1')
. (Join-Path $here 'data-04.ps1')
. (Join-Path $here 'data-05.ps1')

function PartFolderPath([string]$screenId) {
    $part = $screenId.Substring(3,2)
    if ($part -eq '00') { return $root }
    return (Join-Path $root "methodica-math-scale-01-$part")
}

$fileCache = @{}
function GetLines([string]$fullPath) {
    if (-not $fileCache.ContainsKey($fullPath)) {
        if (Test-Path $fullPath) {
            $fileCache[$fullPath] = (Get-Content -Encoding UTF8 -Path $fullPath)
        } else {
            $fileCache[$fullPath] = $null
        }
    }
    return $fileCache[$fullPath]
}

function NormalizeForCompare([string]$s) {
    if ($null -eq $s) { return '' }
    $s = $s -replace '\{tooltip:([^}]*)\}', '$1'
    $s = $s -replace '\{[a-zA-Z]+\}', ''   # runtime placeholders like {number},{targetLabel},{code}
    $s = $s -replace '&lt;', '<'
    $s = $s -replace '&gt;', '>'
    # strip ALL whitespace AND any Unicode "format" control character (category Cf — covers every
    # zero-width-space variant regardless of exact codepoint), so invisible-character drift between
    # the extraction report's rendering and the actual file bytes never causes a false FAIL.
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $s.ToCharArray()) {
        if ([char]::IsWhiteSpace($ch)) { continue }
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -eq [System.Globalization.UnicodeCategory]::Format) { continue }
        [void]$sb.Append($ch)
    }
    return $sb.ToString()
}

# ---------- SWEEP 1: every unit's source appears at its recorded location ----------
$sweep1Results = New-Object System.Collections.Generic.List[object]
foreach ($u in $global:Units) {
    $skip = $false
    $reason = ''
    if ($u.SourceLocation -match ',' -or $u.SourceLocation -match 'identical on all') {
        $skip = $true; $reason = 'consolidated multi-location (reused string) — spot-checked manually, not auto-verified'
    }
    if ($u.ManualReview -match 'Dead code') {
        $skip = $true; $reason = 'dead/unreachable code block — line ranges approximate per agent report'
    }
    if ($u.Id -eq '01-01-04-003') {
        $skip = $true; $reason = 'structural placeholder unit, not real content'
    }
    if ($u.Id -eq '01-01-22-007') {
        $skip = $true; $reason = 'sentence is interrupted mid-line by an inline info-icon widget (button+svg+tooltip-panel) in the raw file, breaking substring contiguity — manually verified against source in the transcript'
    }
    if ($u.Source -match '\{[a-zA-Z]+\}') {
        $skip = $true; $reason = 'runtime-concatenated value placeholder — the JS source builds this string with a variable/method-call in the middle at runtime, so it can never literally match static source text; manually verified against source in the transcript'
    }
    if ($u.Source -match '\{tooltip:') {
        $skip = $true; $reason = 'tooltip-embedded widget markup interrupts substring adjacency in the raw file — manually verified against source instead'
    }

    # extract folder + file + line/range from the FIRST location token
    $loc = $u.SourceLocation
    $m = [regex]::Match($loc, '([a-zA-Z0-9_./-]+\.(?:html|js)):(\d+)(?:-(\d+))?')
    if (-not $m.Success) {
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status='SKIP'; Reason='no parsable file:line'; Loc=$loc})
        continue
    }
    if ($skip) {
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status='SKIP'; Reason=$reason; Loc=$loc})
        continue
    }
    $file = $m.Groups[1].Value
    $lineStart = [int]$m.Groups[2].Value
    $lineEnd = if ($m.Groups[3].Success) { [int]$m.Groups[3].Value } else { $lineStart }

    $folder = PartFolderPath $u.ScreenId
    $fullPath = if ($file -match '^unit-js/') { Join-Path $root $file } else { Join-Path $folder $file }
    $lines = GetLines $fullPath
    if ($null -eq $lines) {
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status='FAIL'; Reason="file not found: $fullPath"; Loc=$loc})
        continue
    }
    if ($lineEnd -gt $lines.Count -or $lineStart -lt 1) {
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status='FAIL'; Reason="line range $lineStart-$lineEnd out of bounds (file has $($lines.Count) lines)"; Loc=$loc})
        continue
    }
    $excerpt = ($lines[($lineStart-1)..($lineEnd-1)] -join "`n")
    $normExcerpt = NormalizeForCompare $excerpt
    $normSource = NormalizeForCompare $u.Source

    if ($normSource -eq '') {
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status='SKIP'; Reason='empty after normalization'; Loc=$loc})
        continue
    }

    if ($file -match '\.js$') {
        # JS multi-line strings are often built as '...' + '...' across source lines — after
        # whitespace-stripping that leaves a bare '+' (or "+") quote-joint in the excerpt that is
        # pure syntax, not part of the runtime string value. Strip it so the join point disappears,
        # same as it does at runtime when JS concatenates the two literals.
        $normExcerpt = $normExcerpt -replace "['""]\+['""]", ''
        # a literal \n escape sequence inside a JS string literal is a real line break at runtime,
        # not the two characters backslash+n — drop it so it lines up with the real newline our
        # stored source uses for the same multi-line explanation string.
        $normExcerpt = $normExcerpt -replace '\\n', ''
    }
    if ($normExcerpt.Contains($normSource)) {
        $byteMatch = ($excerpt.Trim() -eq ($u.Source -replace '&lt;','<' -replace '&gt;','>').Trim())
        $status = if ($byteMatch -and $lineStart -eq $lineEnd) { 'MATCH-EXACT' } else { 'MATCH-NORMALIZED' }
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status=$status; Reason=''; Loc=$loc})
    } else {
        $sweep1Results.Add([PSCustomObject]@{Id=$u.Id; Status='FAIL'; Reason='normalized source not found in referenced line(s)'; Loc=$loc})
    }
}

$total = $sweep1Results.Count
$exact = ($sweep1Results | Where-Object Status -eq 'MATCH-EXACT').Count
$norm  = ($sweep1Results | Where-Object Status -eq 'MATCH-NORMALIZED').Count
$fail  = ($sweep1Results | Where-Object Status -eq 'FAIL').Count
$skip  = ($sweep1Results | Where-Object Status -eq 'SKIP').Count

Write-Host "===== SWEEP 1 ====="
Write-Host "Total units: $total"
Write-Host "Exact byte match: $exact"
Write-Host "Normalized match (multi-line join / whitespace / entity form): $norm"
Write-Host "FAIL (source not found at recorded location): $fail"
Write-Host "SKIP (consolidated/dead-code/placeholder, not auto-checked): $skip"
Write-Host ""
if ($fail -gt 0) {
    Write-Host "--- FAILURES ---"
    $sweep1Results | Where-Object Status -eq 'FAIL' | ForEach-Object { Write-Host "$($_.Id) | $($_.Loc) | $($_.Reason)" }
}
$sweep1Results | Export-Csv -Path (Join-Path $here 'sweep1-results.csv') -NoTypeInformation -Encoding UTF8

# ---------- SWEEP 2: no Hebrew left uncovered ----------
Write-Host ""
Write-Host "===== SWEEP 2 ====="

$hebrewPattern = '[֐-׿]'
$coveredNormalized = New-Object System.Collections.Generic.HashSet[string]
foreach ($u in $global:Units) {
    $n = NormalizeForCompare $u.Source
    if ($n -ne '') { [void]$coveredNormalized.Add($n) }
    # also add smaller fragments split by common separators so partial containment checks work later
}

$partFolders = @('') + (1..5 | ForEach-Object { "methodica-math-scale-01-0$_" })
$uncovered = New-Object System.Collections.Generic.List[object]
$checkedFragments = 0

foreach ($pf in $partFolders) {
    $base = if ($pf -eq '') { $root } else { (Join-Path $root $pf) }
    $targets = @()
    if ($pf -eq '') {
        $targets = @((Join-Path $base 'index.html'))
    } else {
        $targets = @((Join-Path $base 'index.html'), (Join-Path $base 'script.js'))
    }
    foreach ($fp in $targets) {
        if (-not (Test-Path $fp)) { continue }
        $lines = Get-Content -Encoding UTF8 -Path $fp
        $inBlockComment = $false
        for ($i=0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            $trimmed = $line.Trim()
            if ($inBlockComment) {
                if ($line -match '\*/') { $inBlockComment = $false }
                if ($line -match $hebrewPattern) {
                    foreach ($cfrag in [regex]::Matches($line, '[֐-׿][֐-׿0-9 .,:;!?"''​׳״()%+-]{1,}[֐-׿0-9]')) {
                        $uncovered.Add([PSCustomObject]@{ File = $fp.Substring($root.Length+1); Line = ($i+1); Fragment = $cfrag.Value; Classification = 'excluded - block comment' })
                    }
                }
                continue
            }
            if ($trimmed.StartsWith('/*') -and $line -notmatch '\*/') { $inBlockComment = $true }
            # skip full-line comments (simple heuristic: line consists mostly of // or is inside <!-- --> or /* */ start)
            if ($trimmed.StartsWith('//') -or $trimmed.StartsWith('/*') -or $trimmed.StartsWith('*') -or $trimmed.StartsWith('<!--')) { continue }
            if ($line -notmatch $hebrewPattern) { continue }
            # if the file is JS, strip a trailing inline // comment before scanning (still report what
            # was stripped separately as an excluded-by-comment fragment, so nothing goes unclassified)
            $codePart = $line
            $commentPart = ''
            if ($fp -match '\.js$') {
                $cm = [regex]::Match($line, '(?<!:)//(.*)$')
                if ($cm.Success) {
                    $codePart = $line.Substring(0, $cm.Index)
                    $commentPart = $cm.Groups[1].Value
                }
            }
            foreach ($cfrag in [regex]::Matches($commentPart, '[֐-׿][֐-׿0-9 .,:;!?"''​׳״()%+-]{1,}[֐-׿0-9]')) {
                $relFile = $fp.Substring($root.Length+1)
                $uncovered.Add([PSCustomObject]@{ File = $relFile; Line = ($i+1); Fragment = $cfrag.Value; Classification = 'excluded - inline comment' })
            }
            $matches = [regex]::Matches($codePart, '[֐-׿][֐-׿0-9 .,:;!?"''​׳״()%-]{2,}[֐-׿0-9]')
            foreach ($mm in $matches) {
                $frag = $mm.Value
                $checkedFragments++
                $normFrag = NormalizeForCompare $frag
                if ($normFrag.Length -lt 3) { continue }
                $isCovered = $false
                foreach ($cov in $coveredNormalized) {
                    if ($cov.Contains($normFrag) -or $normFrag.Contains($cov)) { $isCovered = $true; break }
                }
                if (-not $isCovered) {
                    $uncovered.Add([PSCustomObject]@{ File = $fp.Substring($root.Length+1); Line = ($i+1); Fragment = $frag; Classification = 'GENUINE MISS - needs review' })
                }
            }
        }
    }
}

# unit-js shared files
foreach ($jsf in (Get-ChildItem (Join-Path $root 'unit-js') -Filter *.js)) {
    $lines = Get-Content -Encoding UTF8 -Path $jsf.FullName
    $inBlockComment = $false
    for ($i=0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $trimmed = $line.Trim()
        if ($inBlockComment) {
            if ($line -match '\*/') { $inBlockComment = $false }
            if ($line -match $hebrewPattern) {
                foreach ($cfrag in [regex]::Matches($line, '[֐-׿][֐-׿0-9 .,:;!?"''​׳״()%+-]{1,}[֐-׿0-9]')) {
                    $uncovered.Add([PSCustomObject]@{ File = "unit-js/$($jsf.Name)"; Line = ($i+1); Fragment = $cfrag.Value; Classification = 'excluded - block comment' })
                }
            }
            continue
        }
        if ($trimmed.StartsWith('/*') -and $line -notmatch '\*/') { $inBlockComment = $true }
        if ($trimmed.StartsWith('//') -or $trimmed.StartsWith('/*') -or $trimmed.StartsWith('*')) { continue }
        if ($line -notmatch $hebrewPattern) { continue }
        $codePart = $line
        $commentPart = ''
        $cm = [regex]::Match($line, '(?<!:)//(.*)$')
        if ($cm.Success) { $codePart = $line.Substring(0, $cm.Index); $commentPart = $cm.Groups[1].Value }
        foreach ($cfrag in [regex]::Matches($commentPart, '[֐-׿][֐-׿0-9 .,:;!?"''​׳״()%+-]{1,}[֐-׿0-9]')) {
            $uncovered.Add([PSCustomObject]@{ File = "unit-js/$($jsf.Name)"; Line = ($i+1); Fragment = $cfrag.Value; Classification = 'excluded - inline comment' })
        }
        $matches = [regex]::Matches($codePart, '[֐-׿][֐-׿0-9 .,:;!?"''​׳״()%-]{2,}[֐-׿0-9]')
        foreach ($mm in $matches) {
            $frag = $mm.Value
            $checkedFragments++
            $normFrag = NormalizeForCompare $frag
            if ($normFrag.Length -lt 3) { continue }
            $isCovered = $false
            foreach ($cov in $coveredNormalized) {
                if ($cov.Contains($normFrag) -or $normFrag.Contains($cov)) { $isCovered = $true; break }
            }
            if (-not $isCovered) {
                $uncovered.Add([PSCustomObject]@{ File = "unit-js/$($jsf.Name)"; Line = ($i+1); Fragment = $frag; Classification = 'GENUINE MISS - needs review' })
            }
        }
    }
}

Write-Host "Hebrew-bearing fragments scanned (code, non-comment): $checkedFragments"
Write-Host "Total flagged fragments (all classifications): $($uncovered.Count)"
$byClass = $uncovered | Group-Object Classification | Sort-Object Count -Descending
foreach ($g in $byClass) { Write-Host "  $($g.Name): $($g.Count)" }
$uncovered | Export-Csv -Path (Join-Path $here 'sweep2-uncovered.csv') -NoTypeInformation -Encoding UTF8
$genuine = $uncovered | Where-Object { $_.Classification -eq 'GENUINE MISS - needs review' }
if ($genuine.Count -gt 0) {
    Write-Host "--- GENUINE MISSES ---"
    $genuine | ForEach-Object { Write-Host "$($_.File):$($_.Line) | $($_.Fragment)" }
} else {
    Write-Host "No genuine misses — all remaining flagged fragments are inside comments (excluded per spec)."
}
