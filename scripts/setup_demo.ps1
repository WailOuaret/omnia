$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$venvPath = Join-Path $repoRoot ".runenv"
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

if ((Test-Path $venvPath) -and (-not (Test-Path (Join-Path $venvPath "Scripts\python.exe")))) {
    Remove-Item -Recurse -Force $venvPath
}

if (-not (Test-Path $venvPath)) {
    py -3.12 -m venv $venvPath
}

$python = Join-Path $venvPath "Scripts\python.exe"
$pip = Join-Path $venvPath "Scripts\pip.exe"

& $python -m pip install --upgrade pip wheel setuptools

# Install CUDA-enabled PyTorch for RTX 4060 filtering runs.
& $pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Install backend demo requirements.
& $pip install -r (Join-Path $repoRoot "requirements-demo.txt")

# Install frontend dependencies.
Push-Location (Join-Path $repoRoot "frontend")
& $npm install
Pop-Location

Write-Host "OMNIA demo environment is ready."
