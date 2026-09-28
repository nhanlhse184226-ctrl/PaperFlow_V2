# Temporary local PaperFlow runtime. It does not rebuild Docker images.
$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\PaperFlow'
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
$backendLog = Join-Path $projectRoot 'artifacts\ollama-local-backend.log'
$backendErrorLog = Join-Path $projectRoot 'artifacts\ollama-local-backend-error.log'
$frontendLog = Join-Path $projectRoot 'artifacts\ollama-local-frontend.log'
$frontendErrorLog = Join-Path $projectRoot 'artifacts\ollama-local-frontend-error.log'

# Free port 8080 from the Docker frontend while retaining its data volume.
docker compose -f (Join-Path $projectRoot 'compose.yaml') stop frontend

$env:AI_PROVIDER = 'ollama'
$env:OLLAMA_MODEL = 'qwen2.5:3b'
$env:OLLAMA_URL = 'http://127.0.0.1:11434'
$env:DATA_DIR = Join-Path $projectRoot 'artifacts\ollama-local-data'
$env:ALLOWED_ORIGINS = 'http://localhost:8080'
$env:ALLOWED_HOSTS = 'localhost,127.0.0.1'

Start-Process -FilePath $python -WorkingDirectory (Join-Path $projectRoot 'BE') -WindowStyle Hidden `
  -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' `
  -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog
if (-not (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath 'npm.cmd' -WorkingDirectory (Join-Path $projectRoot 'FE') -WindowStyle Hidden `
    -ArgumentList 'run','dev','--','--port','8080' `
    -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrorLog
}

Write-Output 'Started local PaperFlow with Ollama at http://localhost:8080.'
