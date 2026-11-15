[CmdletBinding()]
param([string]$ZBrushPath = 'C:\Program Files\Maxon ZBrush 2023', [switch]$PlanOnly)
$ErrorActionPreference='Stop'
function Get-Sha256([string]$Path) {
    $algorithm=[Security.Cryptography.SHA256]::Create()
    $stream=[IO.File]::OpenRead($Path)
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)) }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
$zbRoot=[IO.Path]::GetFullPath($ZBrushPath).TrimEnd('\')
if (-not (Test-Path -LiteralPath (Join-Path $zbRoot 'ZBrush.exe'))) { throw 'ZBrush.exe not found.' }
# Only this package's files. No stock Maxon plugins, models or saved banks.
$relativePaths=@(
    'ZStartup\ZPlugs64\CameraBank25.zsc',
    'ZStartup\ZPlugs64\RenderCapture.zsc',
    'ZStartup\ZPlugs64\MakCameraBankData\CameraBank25.txt',
    'ZStartup\ZPlugs64\MakCameraBankData\CameraBank25.zsc',
    'ZStartup\ZPlugs64\MakCameraBankData\ZFileUtils64.dll',
    'ZStartup\ZPlugs64\RenderCaptureData\RenderCapture.txt',
    'ZStartup\ZPlugs64\RenderCaptureData\RenderCapture.zsc',
    'ZStartup\ZPlugs64\RenderCaptureData\ZFileUtils64.dll',
    'ZStartup\Macros\Mak Plugins\Load Camera Bank.txt',
    'ZStartup\Macros\Mak Plugins\Load Camera Bank.zsc',
    'ZStartup\Macros\Mak Plugins\Load Render Capture.txt',
    'ZStartup\Macros\Mak Plugins\Load Render Capture.zsc'
)
$targets=@(foreach($relative in $relativePaths) {
    $full=[IO.Path]::GetFullPath((Join-Path $zbRoot $relative))
    if (-not $full.StartsWith($zbRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe uninstall path.' }
    if(Test-Path -LiteralPath $full) {
        if((Get-Item -LiteralPath $full).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Unexpected link: $full" }
        [pscustomobject]@{Relative=$relative;Path=$full;Hash=(Get-Sha256 $full)}
    }
})
if($PlanOnly) { $targets | ConvertTo-Json; exit 0 }
$backupRoot=Join-Path $PSScriptRoot ('Recovery\Uninstalled-'+[DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff'))
# Back up and verify every file before removing any installed file.
foreach($target in $targets) {
    $backup=Join-Path $backupRoot $target.Relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
    Copy-Item -LiteralPath $target.Path -Destination $backup
    if((Get-Sha256 $backup) -ne $target.Hash) { throw "Backup verification failed: $backup" }
}
foreach($target in $targets) {
    if((Get-Sha256 $target.Path) -ne $target.Hash) { throw "Installed file changed during uninstall: $($target.Path)" }
    Remove-Item -LiteralPath $target.Path
    if(Test-Path -LiteralPath $target.Path) { throw "Removal failed: $($target.Path)" }
}
foreach($relative in @('ZStartup\ZPlugs64\MakCameraBankData','ZStartup\ZPlugs64\RenderCaptureData','ZStartup\Macros\Mak Plugins')) {
    $folder=[IO.Path]::GetFullPath((Join-Path $zbRoot $relative))
    if(-not $folder.StartsWith($zbRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe directory.' }
    if((Test-Path -LiteralPath $folder) -and @(Get-ChildItem -LiteralPath $folder -Force).Count -eq 0) { Remove-Item -LiteralPath $folder }
}
if($targets.Count -gt 0) { $targets | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot 'removed-files.json') -Encoding UTF8 }
Write-Output "Removed $($targets.Count) package files. Backup: $backupRoot"
Write-Output 'No application was closed or restarted. Stock Maxon plugins and saved work were preserved.'
