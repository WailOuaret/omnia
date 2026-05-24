# Pack OMNIA+ frontend, backend, and core logic for external analysis (e.g. ChatGPT).
# Output: Desktop\omnia-for-chatgpt-analysis.zip

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutZip = Join-Path ([Environment]::GetFolderPath("Desktop")) "omnia-for-chatgpt-analysis.zip"
$Stage = Join-Path $env:TEMP "omnia-chatgpt-pack-$(Get-Date -Format 'yyyyMMddHHmmss')"

function Copy-Tree {
    param([string]$Source, [string]$Dest)
    if (-not (Test-Path $Source)) { return }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    robocopy $Source $Dest /E /XD node_modules dist __pycache__ .pytest_cache test-results playwright-report .git /XF *.pyc *.pyo /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $Source" }
}

Remove-Item $OutZip -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

# Backend API
Copy-Tree (Join-Path $RepoRoot "backend\app") (Join-Path $Stage "backend\app")

# Frontend (source + config, no node_modules)
Copy-Tree (Join-Path $RepoRoot "frontend\src") (Join-Path $Stage "frontend\src")
Copy-Tree (Join-Path $RepoRoot "frontend\scripts") (Join-Path $Stage "frontend\scripts")
Copy-Tree (Join-Path $RepoRoot "frontend\e2e") (Join-Path $Stage "frontend\e2e")
foreach ($f in @("package.json", "package-lock.json", "tsconfig.json", "tsconfig.app.json", "vite.config.ts", "index.html", "playwright.config.ts")) {
    $src = Join-Path $RepoRoot "frontend\$f"
    if (Test-Path $src) { Copy-Item $src (Join-Path $Stage "frontend\$f") -Force }
}

# Core OMNIA pipeline modules (imported by backend)
foreach ($dir in @("candidates_generation", "candidates_filtering", "candidates_evaluation", "llm_eval")) {
    Copy-Tree (Join-Path $RepoRoot $dir) (Join-Path $Stage $dir)
}

# Root OMNIA scripts
foreach ($f in @("omnia.py", "omnia_top_k.py", "cand_gen.py", "requirements.txt", "requirements-demo.txt", "README.md", "DEMO_CHECKLIST.md", "vercel.json")) {
    $src = Join-Path $RepoRoot $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $Stage $f) -Force }
}

# Paper text (optional context)
$paper = Join-Path $RepoRoot "paper_2603_11820v1.txt"
if (Test-Path $paper) { Copy-Item $paper (Join-Path $Stage "paper_2603_11820v1.txt") -Force }

# Setup / test scripts
Copy-Tree (Join-Path $RepoRoot "scripts") (Join-Path $Stage "scripts")
Copy-Tree (Join-Path $RepoRoot "tests") (Join-Path $Stage "tests")
Copy-Tree (Join-Path $RepoRoot "docs") (Join-Path $Stage "docs")

@'
# OMNIA+ codebase pack for analysis

## What this zip contains
- **backend/app/** — FastAPI demo server (sessions, graph slices, pipeline orchestration)
- **frontend/src/** — React paper demo UI (live backend session mode + static fallback)
- **candidates_generation/**, **candidates_filtering/**, **candidates_evaluation/** — core OMNIA logic
- **tests/** — backend unit/integration tests
- **scripts/** — dataset setup, diagnostics, this pack script

## Excluded (too large or not source)
- data/ (real datasets), node_modules/, .runenv/, dist/, __pycache__/

## Key entry points
- Backend: backend/app/main.py
- Pipeline: backend/app/services/pipeline.py
- Graph slices: backend/app/services/graph_slice.py
- Dataset ingestion: backend/app/services/ingestion.py
- Paper demo page: frontend/src/pages/PaperDemoPage.tsx
- Live session hook: frontend/src/hooks/usePaperDemoSession.ts
- Session adapter: frontend/src/lib/sessionToDemoDataset.ts

## Recent focus
Live mode (?sessionId=) must use backend session artifacts only; static DATASETS config is fallback when no sessionId.
'@ | Set-Content (Join-Path $Stage "CHATGPT_README.md") -Encoding UTF8

Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $OutZip -Force
Remove-Item $Stage -Recurse -Force

$sizeMb = [math]::Round((Get-Item $OutZip).Length / 1MB, 2)
Write-Host "Created: $OutZip ($sizeMb MB)"
