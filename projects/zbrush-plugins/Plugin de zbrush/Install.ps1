[CmdletBinding()]
param(
    [string]$ZBrushPath,
    [ValidateSet('RenderID','All','Both','Render','ID')][string]$Component = 'RenderID',
    [switch]$PlanOnly
)
$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot

function Get-Sha256([string]$Path) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)) }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}

function Find-ZBrush {
    if ($ZBrushPath) { return [IO.Path]::GetFullPath($ZBrushPath.Trim('"')) }
    $candidates = @()
    foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($root -and (Test-Path -LiteralPath $root)) {
            $candidates += @(Get-ChildItem -LiteralPath $root -Directory -Filter '*ZBrush*' -ErrorAction SilentlyContinue |
                Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'ZBrush.exe') } |
                ForEach-Object FullName)
            $vendor = Join-Path $root 'Pixologic'
            if (Test-Path -LiteralPath $vendor) {
                $candidates += @(Get-ChildItem -LiteralPath $vendor -Directory -Filter '*ZBrush*' |
                    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'ZBrush.exe') } |
                    ForEach-Object FullName)
            }
        }
    }
    $candidates = @($candidates | Sort-Object -Unique)
    if ($candidates.Count -eq 1) { return $candidates[0] }
    if ($PlanOnly) { throw 'Specify -ZBrushPath; automatic detection did not find exactly one installation.' }
    if ($candidates.Count -gt 1) {
        Write-Host 'Installed ZBrush versions:'
        for ($i=0; $i -lt $candidates.Count; $i++) { Write-Host ("{0}. {1}" -f ($i+1),$candidates[$i]) }
    }
    return [IO.Path]::GetFullPath((Read-Host 'Enter the folder containing ZBrush.exe').Trim('"'))
}

$zbRoot = Find-ZBrush
if (-not (Test-Path -LiteralPath (Join-Path $zbRoot 'ZBrush.exe'))) { throw "ZBrush.exe not found in $zbRoot" }
$versionText = (Get-Item -LiteralPath (Join-Path $zbRoot 'ZBrush.exe')).VersionInfo.FileVersion
if ($versionText -match '^2026\.(?:[1-9]|[1-9][0-9])') {
    throw 'This installer targets ZBrush 2023-2026.0. For 2026.1+, use the manual user-content installation described in README.txt.'
}
$plugRoot = Join-Path $zbRoot 'ZStartup\ZPlugs64'
$macroRoot = Join-Path $zbRoot 'ZStartup\Macros\Mak Plugins'
if (-not (Test-Path -LiteralPath $plugRoot)) { throw "ZStartup\ZPlugs64 not found in $zbRoot" }

$specs = @()
if ($Component -in @('RenderID','All','Both','Render')) {
    $specs += [pscustomobject]@{ Folder='Render Capture'; Name='RenderCapture'; Data='RenderCaptureData'; Macro='Load Render Capture' }
}
if ($Component -in @('RenderID','All','Both','ID')) {
    $specs += [pscustomobject]@{ Folder='Generate and Export ID'; Name='GenerateExportID'; Data='GenerateExportIDData'; Macro='Load Generate and Export ID' }
}
$actions = @()
# Retire only the old writer's explicit installed files. Backups and rollback
# use the same verified mechanism as replacements; saved banks and Fast are kept.
foreach ($legacyRelative in @(
    'ZStartup\ZPlugs64\CameraBank25.zsc',
    'ZStartup\ZPlugs64\MakCameraBankData\CameraBank25.txt',
    'ZStartup\ZPlugs64\MakCameraBankData\CameraBank25.zsc',
    'ZStartup\ZPlugs64\MakCameraBankData\ZFileUtils64.dll',
    'ZStartup\Macros\Mak Plugins\Load Camera Bank.txt',
    'ZStartup\Macros\Mak Plugins\Load Camera Bank.zsc'
)) {
    $legacyTarget = [IO.Path]::GetFullPath((Join-Path $zbRoot $legacyRelative))
    if (-not $legacyTarget.StartsWith($zbRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe legacy retirement path.' }
    if (Test-Path -LiteralPath $legacyTarget) {
        if ((Get-Item -LiteralPath $legacyTarget).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Unexpected link: $legacyTarget" }
        $actions += [pscustomobject]@{ Kind='Retire'; Source=$null; Target=$legacyTarget }
    }
}
foreach ($spec in $specs) {
    $source = Join-Path (Join-Path $packageRoot $spec.Folder) ($spec.Name+'.txt')
    if (-not (Test-Path -LiteralPath $source)) { throw "Missing source: $source" }
    $compiled = [IO.Path]::ChangeExtension($source,'.zsc')
    $dataSource = Join-Path (Join-Path $plugRoot $spec.Data) ($spec.Name+'.txt')
    $installedCompiled = [IO.Path]::ChangeExtension($dataSource,'.zsc')
    $compiledCandidate = $null
    # Only promote a compiled file at least as recent as the editable source.
    foreach ($candidate in @($compiled,$installedCompiled)) {
        # An installed binary is eligible only when its adjacent source matches
        # this release. Its timestamp alone cannot establish source compatibility.
        $sourceMatches = ($candidate -eq $compiled) -or
            ((Test-Path -LiteralPath $dataSource) -and ((Get-Sha256 $dataSource) -eq (Get-Sha256 $source)))
        if ($sourceMatches -and (Test-Path -LiteralPath $candidate) -and
            ((Get-Item -LiteralPath $candidate).LastWriteTimeUtc -ge (Get-Item -LiteralPath $source).LastWriteTimeUtc)) {
            $compiledCandidate = $candidate
            break
        }
    }
    $actions += [pscustomobject]@{ Kind='Copy'; Source=$source; Target=$dataSource }
    if ($compiledCandidate) {
        $actions += [pscustomobject]@{ Kind='Copy'; Source=$compiledCandidate; Target=(Join-Path $plugRoot ($spec.Name+'.zsc')) }
        # Source reloads must not find a previous compiled consumer beside the
        # updated TXT. Keep the startup and adjacent native binaries identical.
        if ($spec.Name -in @('RenderCapture','GenerateExportID')) {
            $actions += [pscustomobject]@{ Kind='Copy'; Source=$compiledCandidate; Target=$installedCompiled }
        }
    } else {
        # Do not leave an older-format plugin auto-loading beside new sources.
        foreach ($obsolete in @((Join-Path $plugRoot ($spec.Name+'.zsc')),$installedCompiled)) {
            if (Test-Path -LiteralPath $obsolete) {
                $actions += [pscustomobject]@{ Kind='Retire'; Source=$null; Target=$obsolete }
            }
        }
    }
    # A documented ZBrush macro can load source with ZScript:Load. This works
    # without pretending a renamed text file is compiled ZScript bytecode.
    $pluginSource = ('ZBRUSH_ZSTARTUP/ZPlugs64/'+$spec.Data+'/'+$spec.Name+'.txt')
    $controlNames = @('1 - CREATE FOLDERS','2 - RENDER NON BPR','3 - RENDER BPR')
    $paletteName = 'ZPlugin:Render Capture:'
    if ($spec.Name -eq 'GenerateExportID') {
        $controlNames = @('Generar y exportar ID','Exportar ID')
        $paletteName = 'ZPlugin:Generar y exportar ID:'
    }
    $loaderReset = ''
    foreach ($controlName in $controlNames) {
        $controlPath = $paletteName + $controlName
        $loaderReset += (' [If,[IExists,"'+$controlPath+'"],[IClose,"'+$controlPath+'"]]') + "`r`n"
    }
    $macroText = "// Loader for $($spec.Name). Generated by Install.ps1.`r`n" +
        '[IButton,???,"Load this plugin into the current ZBrush session.",' + "`r`n" +
        $loaderReset +
        ' [FileNameSetNext,[FileNameResolvePath,"' + $pluginSource + '"]]' + "`r`n" +
        ' [IPress,"ZScript:Load"]' + "`r`n]`r`n"
    $macroTarget = Join-Path $macroRoot ($spec.Macro+'.txt')
    $macroCompiled = [IO.Path]::ChangeExtension($macroTarget,'.zsc')
    if ((Test-Path -LiteralPath $macroCompiled) -and
        ((-not (Test-Path -LiteralPath $macroTarget)) -or ([IO.File]::ReadAllText($macroTarget) -ne $macroText))) {
        $actions += [pscustomobject]@{ Kind='Retire'; Source=$null; Target=$macroCompiled }
    }
    $actions += [pscustomobject]@{ Kind='Text'; Source=$macroText; Target=$macroTarget }
    # Both consumers use the same reviewed Maxon utility.
    if ($spec.Name -in @('RenderCapture','GenerateExportID')) {
        $dll = Join-Path $packageRoot 'Render Capture\RenderCaptureData\ZFileUtils64.dll'
        if (-not (Test-Path -LiteralPath $dll)) { $dll = Join-Path $plugRoot 'MacroData\ZFileUtils64.dll' }
        if (-not (Test-Path -LiteralPath $dll)) { throw 'The ZBrush ZFileUtils64.dll dependency was not found.' }
        # Source can run from its data folder or from the normal ZPlugs64 root.
        $actions += [pscustomobject]@{ Kind='Copy'; Source=$dll; Target=(Join-Path (Join-Path $plugRoot $spec.Data) 'ZFileUtils64.dll') }
    }
}
if ($PlanOnly) {
    [pscustomobject]@{ ZBrush=$zbRoot; Component=$Component; Actions=$actions } | ConvertTo-Json -Depth 5
    exit 0
}

$backupRoot = Join-Path $env:LOCALAPPDATA ('MakZBrushPlugins\InstallBackups\'+[DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff'))
$changes = New-Object System.Collections.Generic.List[object]
try {
    foreach ($action in $actions) {
        # A loaded ZFileUtils DLL cannot be overwritten on Windows. Identical
        # files already satisfy the installation; do not open them for writing.
        if (Test-Path -LiteralPath $action.Target) {
            if (($action.Kind -eq 'Copy') -and ((Get-Sha256 $action.Source) -eq (Get-Sha256 $action.Target))) { continue }
            if (($action.Kind -eq 'Text') -and ([IO.File]::ReadAllText($action.Target) -eq $action.Source)) { continue }
        }
        $parent = Split-Path -Parent $action.Target
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        $backup = $null
        if (Test-Path -LiteralPath $action.Target) {
            $relative = $action.Target.Substring($zbRoot.TrimEnd('\').Length).TrimStart('\')
            $backup = Join-Path $backupRoot $relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
            Copy-Item -LiteralPath $action.Target -Destination $backup
            if ((Get-Sha256 $action.Target) -ne (Get-Sha256 $backup)) { throw 'Backup verification failed.' }
        }
        $changes.Add([pscustomobject]@{ Target=$action.Target; Backup=$backup })
        if ($action.Kind -eq 'Copy') {
            Copy-Item -LiteralPath $action.Source -Destination $action.Target -Force
            if ((Get-Sha256 $action.Source) -ne (Get-Sha256 $action.Target)) {
                throw "Copy verification failed: $($action.Target)"
            }
        } elseif ($action.Kind -eq 'Retire') {
            Remove-Item -LiteralPath $action.Target -Force
        } else {
            [IO.File]::WriteAllText($action.Target,$action.Source,[Text.Encoding]::ASCII)
            if ([IO.File]::ReadAllText($action.Target) -ne $action.Source) { throw 'Loader verification failed.' }
        }
    }
    Write-Host ''
    Write-Host 'Installed. No application was closed or restarted.' -ForegroundColor Green
    Write-Host 'Render Capture and ID use the separately installed Camera Bank Fast.'
    Write-Host 'In ZBrush: load Camera Bank Fast first, then Macro > Reload All Macros > Mak Plugins > Load Render Capture / Load Generate and Export ID.'
    Write-Host 'Legacy Camera Bank 25 installed files were retired with verified backups. Camera Bank Fast is the only camera writer.'
    Write-Host 'For automatic startup: load each package TXT once via ZScript > Load, then run INSTALAR.cmd again.'
    Write-Host 'The installer copies the real ZSC files generated by ZBrush when they are available.'
    if (Test-Path -LiteralPath $backupRoot) { Write-Host "Backups: $backupRoot" }
} catch {
    $installFailure = $_.Exception.Message
    $rollbackFailures = New-Object System.Collections.Generic.List[string]
    # Roll back only the explicit files this installer wrote, using one shell.
    foreach ($change in @($changes.ToArray()) | Sort-Object Target -Descending) {
        try {
            if ($change.Backup -and (Test-Path -LiteralPath $change.Backup)) {
                # A failed locked-file write may have left the original intact.
                if ((Test-Path -LiteralPath $change.Target) -and ((Get-Sha256 $change.Target) -eq (Get-Sha256 $change.Backup))) { continue }
                Copy-Item -LiteralPath $change.Backup -Destination $change.Target -Force
                if ((Get-Sha256 $change.Target) -ne (Get-Sha256 $change.Backup)) { throw 'Rollback verification failed.' }
            } elseif (Test-Path -LiteralPath $change.Target) {
                Remove-Item -LiteralPath $change.Target -Force
            }
        } catch {
            $rollbackFailures.Add("$($change.Target): $($_.Exception.Message)")
        }
    }
    Write-Host $installFailure -ForegroundColor Red
    if ($rollbackFailures.Count) {
        Write-Host "Some files need recovery from $backupRoot" -ForegroundColor Red
        $rollbackFailures | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    }
    Write-Host 'If access was denied, right-click INSTALAR.cmd and choose Run as administrator.'
    Write-Host 'A changed file that is in use must become available before updating it. No application was closed or restarted.'
    exit 1
}
