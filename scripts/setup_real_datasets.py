from __future__ import annotations

import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"

REPOS = [
    ("codex", "https://github.com/tsafavi/codex.git"),
    ("datasets_knowledge_embedding", "https://github.com/villmow/datasets_knowledge_embedding.git"),
    ("covidfact", "https://github.com/asaakyan/covidfact.git"),
]


def run_git(args: list[str], cwd: Path) -> None:
    subprocess.run(["git", *args], cwd=str(cwd), check=True)


def ensure_repo(name: str, url: str) -> Path:
    target = DATA_DIR / name
    if target.exists():
        print(f"[update] {name}: git pull")
        run_git(["pull", "--ff-only"], target)
    else:
        print(f"[clone] {name}: {url}")
        run_git(["clone", url, str(target)], REPO_ROOT)
    return target


def exists_any(base: Path, candidates: list[Path]) -> bool:
    return any((base / path).exists() for path in candidates)


def report_availability() -> None:
    codex_dir = DATA_DIR / "codex"
    kge_dir = DATA_DIR / "datasets_knowledge_embedding"
    covid_dir = DATA_DIR / "covidfact"

    codex_ok = exists_any(codex_dir, [Path("data/triples/codex-m/train.txt")])
    fb_ok = exists_any(
        kge_dir,
        [Path("FB15k-237/train.txt"), Path("FB15K-237/train.txt"), Path("fb15k-237/train.txt")],
    )
    wn_ok = exists_any(
        kge_dir,
        [Path("WN18RR/train.txt"), Path("wn18rr/train.txt"), Path("WN18RR/original/train.txt")],
    )
    covid_ok = exists_any(
        covid_dir,
        [
            Path("triples.tsv"),
            Path("triples.txt"),
            Path("data/triples.tsv"),
            Path("data/train.tsv"),
        ],
    )

    print("\n=== Dataset Availability Report ===")
    print(f"Found CoDEx files: {'YES' if codex_ok else 'NO'}")
    print(f"Found FB15K-237 files: {'YES' if fb_ok else 'NO'}")
    print(f"Found WN18RR files: {'YES' if wn_ok else 'NO'}")
    print(f"Found COVID-Fact files: {'YES' if covid_ok else 'PARTIAL/UNKNOWN'}")
    if not covid_ok:
        print("COVID-Fact note: repository cloned, but a direct triples file was not detected.")


def main() -> int:
    DATA_DIR.mkdir(exist_ok=True)
    for name, url in REPOS:
        ensure_repo(name, url)
    report_availability()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
