from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def _first_existing(paths: list[Path]) -> Path:
    for path in paths:
        if path.exists():
            return path
    return paths[0]


# Paper / benchmark sources (clone with scripts/clone_true_datasets.ps1 — see repo docs).
CODEX_REPO_ROOT = _first_existing(
    [
        REPO_ROOT / "data" / "codex",
        REPO_ROOT / "external_data" / "codex",
        REPO_ROOT / ".tmp" / "codex",
    ]
)
KNOWLEDGE_EMBEDDING_ROOT = _first_existing(
    [
        REPO_ROOT / "data" / "datasets_knowledge_embedding",
        REPO_ROOT / "external_data" / "datasets_knowledge_embedding",
        REPO_ROOT / ".tmp" / "datasets_knowledge_embedding",
    ]
)
COVIDFACT_REPO_ROOT = _first_existing(
    [
        REPO_ROOT / "data" / "covidfact",
        REPO_ROOT / "external_data" / "covidfact",
        REPO_ROOT / ".tmp" / "covidfact",
    ]
)

DEMO_CACHE_DIR = REPO_ROOT / ".omnia_demo_cache"
DEMO_CACHE_DIR.mkdir(exist_ok=True)

MAX_GRAPH_TRIPLES = 350
LARGE_DATASET_WARNING_THRESHOLD = 2000
BENCHMARK_SAMPLE_PREFIX = "omnia_"
DEFAULT_BENCHMARK_SAMPLING_LIMIT = 1500
DEFAULT_SAMPLE_PROPORTION = 0.8
DEFAULT_TOP_K = 2
DEFAULT_LLM_LIMIT = 24
DEFAULT_MODEL_NAME = "mistral"
DEMO_FAST_MODE = True
