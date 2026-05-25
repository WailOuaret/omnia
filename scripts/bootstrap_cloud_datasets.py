"""Fetch CoDEx-M triples for cloud backend (sparse git clone). Idempotent."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CODEX_ROOT = REPO_ROOT / "data" / "codex"
CODEX_M = CODEX_ROOT / "data" / "triples" / "codex-m"


def main() -> int:
    if CODEX_M.exists() and any(CODEX_M.glob("*.txt")):
        print(f"[bootstrap] CoDEx-M already present at {CODEX_M}")
        return 0

    CODEX_ROOT.parent.mkdir(parents=True, exist_ok=True)
    if CODEX_ROOT.exists():
        print(f"[bootstrap] Removing incomplete clone at {CODEX_ROOT}")
        import shutil

        shutil.rmtree(CODEX_ROOT)

    print("[bootstrap] Sparse-cloning tsafavi/codex (codex-m triples only)…")
    subprocess.run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--filter=blob:none",
            "--sparse",
            "https://github.com/tsafavi/codex.git",
            str(CODEX_ROOT),
        ],
        check=True,
    )
    subprocess.run(
        ["git", "sparse-checkout", "set", "data/triples/codex-m"],
        cwd=CODEX_ROOT,
        check=True,
    )

    if not CODEX_M.exists():
        print("[bootstrap] ERROR: codex-m folder missing after clone", file=sys.stderr)
        return 1

    print(f"[bootstrap] OK — CoDEx-M ready at {CODEX_M}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
