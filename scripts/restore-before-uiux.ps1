# Restore the exact pre-UI/UX source, preserving current source in another backup.
$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\PaperFlow'
$snapshotRoot = 'C:\PaperFlow-backups\before-uiux-20260928-150236'
$rescueRoot = Join-Path 'C:\PaperFlow-backups' ('before-restore-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($relative in @('FE\src', 'BE\app')) {
  if (-not (Test-Path -LiteralPath (Join-Path $snapshotRoot $relative))) { throw "Missing backup: $relative" }
}
foreach ($relative in @('FE\src', 'BE\app')) {
  $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
  if ($target -notin @('C:\PaperFlow\FE\src', 'C:\PaperFlow\BE\app')) { throw 'Unexpected restore path' }
  $rescue = Join-Path $rescueRoot $relative
  New-Item -ItemType Directory -Path (Split-Path $rescue) -Force | Out-Null
  Move-Item -LiteralPath $target -Destination $rescue
  Copy-Item -LiteralPath (Join-Path $snapshotRoot $relative) -Destination $target -Recurse
}
Write-Output "Source restored. Previous working source preserved at $rescueRoot"
Write-Output 'To run the restored version: cd C:\PaperFlow; docker compose up -d --build'
