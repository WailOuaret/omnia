<# 
  Shallow clones for OMNIA benchmark authority:
  - CoDEx: https://github.com/tsafavi/codex
  - Standard FB/WN KGE splits: https://github.com/villmow/datasets_knowledge_embedding
  Output: repo-root/data/
#>
$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".."
$datasetsRoot = Join-Path $root "data"
New-Item -ItemType Directory -Force -Path $datasetsRoot | Out-Null

function Clone-One($url, $name) {
    $target = Join-Path $datasetsRoot $name
    if (Test-Path (Join-Path $target ".git")) {
        Write-Host "Skip (exists): $name"
        return
    }
    Write-Host "Cloning $url -> $target"
    git clone --depth 1 $url $target
}

Clone-One "https://github.com/tsafavi/codex.git" "codex"
Clone-One "https://github.com/villmow/datasets_knowledge_embedding.git" "datasets_knowledge_embedding"
Write-Host "Done. CoDEx triples under data/codex/data/triples/ ; FB/WN splits under data/datasets_knowledge_embedding/"
