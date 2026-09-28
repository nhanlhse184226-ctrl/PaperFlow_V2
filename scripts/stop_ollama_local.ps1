# Stop only the temporary local PaperFlow listeners, then restore Docker frontend.
$ErrorActionPreference = 'Stop'
Get-NetTCPConnection -LocalPort 8000,8080 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
Set-Location 'C:\PaperFlow'
docker compose up -d frontend
