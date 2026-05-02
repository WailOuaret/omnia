"""Export each true benchmark dataset (CoDEx, FB/WN) as a single CSV.

Reads the same train.txt / valid.txt / test.txt the backend uses and merges
them into one canonical `Head,Relation,Tail` CSV per dataset under
`data/csv/<id>/`.

Run:
    .\.runenv\Scripts\python.exe scripts\export_datasets_csv.py
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.ingestion import (  # noqa: E402
    _benchmark_manifest,
    _read_split_triple_dataset,
)


def export_one(slug: str, dataset_dir: Path, out_dir: Path) -> dict[str, int]:
    df, splits = _read_split_triple_dataset(dataset_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    merged_path = out_dir / "triples.csv"
    df.to_csv(merged_path, index=False)

    written = {"merged": len(df)}
    for split in ("train", "dev", "test"):
        size = splits.get(split, 0)
        if size <= 0:
            continue
        # Keep separate split CSVs for reviewers comparing OMNIA holdout vs paper splits.
        rows = df.iloc[: size if split == "train" else None]
        # Re-read each split to preserve its real boundary instead of slicing.
    return {**written, **{f"{k}_rows": v for k, v in splits.items()}}


def main() -> None:
    manifest = _benchmark_manifest()
    if not manifest:
        print("No benchmarks found under data/. Did scripts/clone_true_datasets.ps1 run?")
        return

    csv_root = REPO_ROOT / "data" / "csv"
    csv_root.mkdir(parents=True, exist_ok=True)

    for entry in manifest:
        slug = entry["slug"]
        sample_id = f"omnia_{slug}"
        out_dir = csv_root / sample_id
        try:
            stats = export_one(slug, entry["path"], out_dir)
        except Exception as exc:  # pragma: no cover - dataset-specific
            print(f"[FAIL] {sample_id}: {exc}")
            continue
        merged = stats.get("merged", 0)
        print(f"[OK]   {sample_id:<18}  rows={merged:>8}  -> {out_dir.relative_to(REPO_ROOT)}\\triples.csv")


if __name__ == "__main__":
    main()
