chcp 65001 > $null
# Shared helpers for building the XLIFF export. Loaded by build.ps1.

$global:Screens = New-Object System.Collections.Generic.List[object]
$global:Units   = New-Object System.Collections.Generic.List[object]

function Scr {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$Type,
        [Parameter(Mandatory)][string]$SourceFile,
        [Parameter(Mandatory)][string]$Selector,
        [string]$ManualReview = ''
    )
    $global:Screens.Add([PSCustomObject]@{
        Id = $Id; Title = $Title; Type = $Type; SourceFile = $SourceFile; Selector = $Selector; ManualReview = $ManualReview
    })
}

# U: register one translation unit. $Seq is assigned by the caller per-screen (001,002,...).
function U {
    param(
        [Parameter(Mandatory)][string]$ScreenId,
        [Parameter(Mandatory)][int]$Seq,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$SourceLocation,
        [Parameter(Mandatory)][string]$ElementRole,
        [string]$ScreenTitle = '',
        [string]$ScreenType = '',
        [string]$DeveloperNote = '',
        [string]$ManualReview = ''
    )
    $seqStr = '{0:D3}' -f $Seq
    $id = "$ScreenId-$seqStr"
    $global:Units.Add([PSCustomObject]@{
        Id             = $id
        ScreenId       = $ScreenId
        ScreenTitle    = $ScreenTitle
        ScreenType     = $ScreenType
        ElementRole    = $ElementRole
        SourceLocation = $SourceLocation
        DeveloperNote  = $DeveloperNote
        ManualReview   = $ManualReview
        Source         = $Source
    })
}

function XmlEscape([string]$s) {
    if ($null -eq $s) { return '' }
    $s = $s -replace '&', '&amp;'
    $s = $s -replace '<', '&lt;'
    $s = $s -replace '>', '&gt;'
    return $s
}
