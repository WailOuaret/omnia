$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$venvPath = Join-Path $repoRoot ".runenv"
$python = Join-Path $venvPath "Scripts\python.exe"
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

if (-not (Test-Path $python)) {
    throw "Virtual environment not found. Run scripts/setup_demo.ps1 first."
}

Push-Location (Join-Path $repoRoot "frontend")
& $npm run build
Pop-Location

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$repoRoot'; & '$python' scripts/run_backend_server.py --host 127.0.0.1 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$repoRoot'; & '$python' scripts/serve_frontend.py --root frontend/dist --host 127.0.0.1 --port 5173"

Write-Host "Backend started on http://127.0.0.1:8000"
Write-Host "Frontend started on http://127.0.0.1:5173"
