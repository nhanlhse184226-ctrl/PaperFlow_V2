$ErrorActionPreference = 'Stop'
$paperflowRoot = Split-Path -Parent $PSScriptRoot
Start-Process -FilePath "$paperflowRoot\.venv\Scripts\python.exe" -WorkingDirectory "$paperflowRoot\BE" -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WindowStyle Hidden -RedirectStandardOutput "$paperflowRoot\BE\server.log" -RedirectStandardError "$paperflowRoot\BE\server-error.log"
Start-Process -FilePath 'cmd.exe' -WorkingDirectory "$paperflowRoot\FE" -ArgumentList @('/c','npm.cmd run dev') -WindowStyle Hidden -RedirectStandardOutput "$paperflowRoot\FE\server.log" -RedirectStandardError "$paperflowRoot\FE\server-error.log"
Write-Output 'PaperFlow is starting at http://127.0.0.1:5173. Logs are in FE and BE.'
