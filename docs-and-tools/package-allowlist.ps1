#Requires -Version 7.0
<#
.SYNOPSIS
    THE ALLOWLIST: the single definition of what a deployment package contains.

.DESCRIPTION
    Dot-sourced by build-package.ps1 and verify-package.ps1. It is not runnable on
    its own and produces no output.

    ⚠️ This is an ALLOWLIST and must never become a denylist. kata-api-key.txt sits at
    the REPO ROOT in this unit — a denylist with one missing entry publishes a live key.
    Here a root file ships only if $RootFiles names it, and $RootFiles is index.html.

    That is not a hypothetical failure mode. Every package before 2026-09-07 was cut by
    hand from an exclusion list written in prose inside DEPLOY.md and re-derived from
    memory each release, and the 2026-09-02 DEPLOY.md records an earlier package cut the
    same day being destroyed: "it is gone, and nothing from it should be uploaded."

    ⚠️ EDIT THIS FILE AND NOTHING ELSE when what ships changes. The builder and the
    verifier both read it, which is what stops a package from being built to one
    definition and checked against another.

        build-package.ps1   — copies exactly the files Test-Ships accepts
        verify-package.ps1  — asserts the package IS exactly those files

    This file never ships: docs-and-tools/ is excluded wholesale, and *.ps1 twice over.

.NOTES
    "Allowlist" here means packaging only. It is unrelated to KNOWN_PHANTOM_SCREENS and
    KNOWN_UNFLUSHED in _test/verify-report.js, which the test suite's README also calls
    allowlists — those record dead code, not deliverables.

    Adapted from the methodica-math-ratio-01/-02 copy. build-package.ps1 and
    verify-package.ps1 ARE byte-identical here; only this file differs. What differs, and
    why, all forced by this unit's shape:

      1. $ComponentFiles gains canvas-tall-gate.js. Every index.html loads it, and the
         ratio list of three would drop it from all five components. Nothing would catch
         that: the string "canvas-tall-gate" appears in no test and no doc in this repo.
      2. $ExcludeTopLevel gains translation/ — an XLIFF deliverable for the localisation
         vendor, not for the CDN.
      3. $ExcludeExt gains .bat and .test (preview.bat, script.js.test).
      4. $ExcludeRelPaths names 11 files nothing loads.

    Note $ComponentGlob: the ratio value 'methodica-math-*-[0-9][0-9]' DOES match this
    unit, unlike the science units. It is spelled out below anyway.
#>

# ── Directories that never contribute a single file, whatever is inside them ──
#    translation/ holds the XLIFF export plus data-00..05.ps1 — the ONLY copy of the
#    hand-maintained string tables. Excluded from the package; never delete it.
$ExcludeTopLevel = @('_test', 'docs-and-tools', 'metadata-from', 'translation', '.git')

# ── File names that never ship, wherever they appear ──
#    README.md must stay a GLOBAL rule, not a directory-scoped one: it catches the repo
#    root, unit-js/README.md, and the five stale assets/icons/README.md that ship today.
$ExcludeNames = @('index_dev.html', 'README.md', '.gitignore', '.gitattributes', '.DS_Store',
                  'ARCHITECTURE.md', 'PROJECT_BRIEF.md', 'script.js.test', 'preview.bat')

# ── Extensions that never ship ──
$ExcludeExt = @('.ps1', '.log', '.bat', '.test')

# ── Any path segment starting with an underscore is a SOURCE, not a deliverable. ──
$ExcludeUnderscoreSegment = $true

# ── Individual files that look shippable and are not ─────────────────────────
#    Every one grep-verified AND cross-checked against the eight runtime path-building
#    sites in the component script.js files.
#
#    ⚠️ Do NOT extend this list by eye. The two largest files in the unit —
#    05/assets/videos/Character{1,2} VID Happy.mp4, 24.5 MB together — are invisible to a
#    plain grep and are reached only by 05/script.js:555:
#        vid.src = './assets/videos/Character' + charNum + ' VID Happy.mp4';
#    An asset that merely looks unused may be built at runtime from a character number,
#    a colour or a screen index. A missing image costs more than its bytes.
$ExcludeRelPaths = @(
    # raw AI-generation output, name never cleaned up
    'methodica-math-scale-01-01/assets/images/ChatGPT Image Jul 27, 2026, 11_36_45 AM.png',
    # literal " - Copy" leftover beside the file it duplicates
    'methodica-math-scale-01-01/assets/images/Tel Aviv Map - Copy.jpg',
    # component 02's only runtime pattern is Character*; these three are unreachable there
    'methodica-math-scale-01-02/assets/images/Tel Aviv Map.jpg',
    'methodica-math-scale-01-02/assets/images/Bed Room.jpg',
    'methodica-math-scale-01-02/assets/images/Architacture plan.jpg',
    # component 04's preload loop is c + '.png' only — it has no _workout variant
    'methodica-math-scale-01-04/assets/images/Character1_workout.png',
    'methodica-math-scale-01-04/assets/images/Character2_workout.png',
    # component 04 contains zero occurrences of "videos", "GIF" or ".mp4" in its html/js/css
    'methodica-math-scale-01-04/assets/videos/Character1 GIF Happy.mp4',
    'methodica-math-scale-01-04/assets/videos/Character1 GIF Sad.mp4',
    'methodica-math-scale-01-04/assets/videos/Character2 GIF Happy.mp4',
    'methodica-math-scale-01-04/assets/videos/Character2 GIF Sad.mp4'
)

# ── What each shipped area contributes ──
$RootFiles = @('index.html')             # the redirect into component 01

$UnitDirs = @{
    'metadata'    = '*.json'             # unit + per-component catalogue records
    'unit-js'     = '*.js'               # the shared layer (its README.md excluded above)
    'unit-assets' = '*'                  # fonts/images shared by more than one component
}

# Inside a component folder: these files, plus everything under assets/.
#    ⚠️ canvas-tall-gate.js is load-bearing. index.html loads it BEFORE script.js
#    (<script src="canvas-tall-gate.js?v=1">), and it wraps the shared scaleApp().
$ComponentFiles = @('index.html', 'script.js', 'styles.css', 'canvas-tall-gate.js')
$ComponentGlob  = 'methodica-math-scale-01-[0-9][0-9]'

# ── Hygiene: if any of these turn up INSIDE a package, it is unsafe to upload ──
$SecretPatterns = @('*key*', '*.ps1', '*.log', '*.bat', 'index_dev.html', 'README.md', '.git*', '_*')

# ── Files a package may contain that are NOT copied from the tree ──
$PackageOnlyFiles = @('DEPLOY.md')

<#
.SYNOPSIS
    Does this repo-relative path (forward slashes) belong in a deployment package?
#>
function Test-Ships([string] $rel) {
    $segs = $rel.Split('/')
    if ($rel -in $ExcludeRelPaths)                     { return $false }
    if ($segs[0] -in $ExcludeTopLevel)                 { return $false }
    if ($segs[-1] -in $ExcludeNames)                   { return $false }
    if ([IO.Path]::GetExtension($rel) -in $ExcludeExt) { return $false }
    if ($ExcludeUnderscoreSegment -and ($segs | Where-Object { $_.StartsWith('_') })) { return $false }

    if ($segs.Count -eq 1) { return $segs[0] -in $RootFiles }

    if ($UnitDirs.ContainsKey($segs[0])) {
        $glob = $UnitDirs[$segs[0]]
        if ($glob -eq '*') { return $true }              # unit-assets/: everything, at any depth
        return ($segs.Count -eq 2 -and $segs[1] -like $glob)
    }

    if ($segs[0] -like $ComponentGlob) {
        if ($segs.Count -eq 2) { return $segs[1] -in $ComponentFiles }
        return ($segs[1] -eq 'assets')                   # assets/ at any depth
    }
    return $false
}

<#
.SYNOPSIS
    Every repo-relative path in $root that ships, sorted.
#>
function Get-ShippableFiles([string] $root) {
    Get-ChildItem -LiteralPath $root -Recurse -File -Force |
        ForEach-Object { [IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/') } |
        Where-Object { Test-Ships $_ } |
        Sort-Object
}

<#
.SYNOPSIS
    Secret/dev files present in a package. Anything returned makes it unsafe to upload.
#>
function Get-HygieneHits([string[]] $rels) {
    $hits = @()
    foreach ($pat in $SecretPatterns) {
        $hits += @($rels | Where-Object {
            $_.Split('/')[-1] -like $pat -or ($_.Split('/') | Where-Object { $_ -like $pat })
        })
    }
    @($hits | Sort-Object -Unique | Where-Object { $_ -notin $PackageOnlyFiles })
}
