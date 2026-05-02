from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services import ingestion
from candidates_generation import triple_gen
from experiment import preprocess


def balanced_candidate_sample(
    candidates_df: pd.DataFrame,
    missing_df: pd.DataFrame,
    *,
    sample_size: int,
    true_ratio: float,
    seed: int,
) -> pd.DataFrame:
    candidates_df = candidates_df.copy()
    candidates_df["Missing"] = candidates_df.apply(tuple, axis=1).isin(missing_df.apply(tuple, axis=1)).astype(int)

    true_df = candidates_df[candidates_df["Missing"] == 1]
    false_df = candidates_df[candidates_df["Missing"] == 0]
    true_count = min(int(sample_size * true_ratio), len(true_df))
    false_count = min(sample_size - true_count, len(false_df))

    if true_count <= 0 or false_count <= 0:
        raise ValueError(
            "Could not build a balanced candidate sample. "
            f"Available true={len(true_df)}, false={len(false_df)}. "
            "Try a larger dataset or a different sample proportion."
        )

    sampled = pd.concat(
        [
            true_df.sample(true_count, random_state=seed),
            false_df.sample(false_count, random_state=seed),
        ],
        ignore_index=True,
    )
    return sampled.sample(frac=1, random_state=seed).reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare triple splits from CoDEx or villmow/datasets_knowledge_embedding for the OMNIA CLI "
            "(train.txt / valid.txt / test.txt, tab-separated, no header)."
        )
    )
    parser.add_argument(
        "--dataset-dir",
        required=True,
        type=Path,
        help="Folder with train.txt (and valid/test), e.g. external_data/codex/data/triples/codex-m",
    )
    parser.add_argument("--output-dir", required=True, type=Path, help="Output directory for OMNIA CSV files")
    parser.add_argument(
        "--sample-proportion", type=float, default=0.8, help="Known graph proportion used before candidate generation"
    )
    parser.add_argument("--candidate-sample-size", type=int, default=200, help="Number of candidates to write to cand_sample.csv")
    parser.add_argument("--true-ratio", type=float, default=0.5, help="Fraction of sampled candidates that are true missing triples")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not 0 < args.sample_proportion < 1:
        raise ValueError("--sample-proportion must be between 0 and 1.")
    if not 0 < args.true_ratio < 1:
        raise ValueError("--true-ratio must be between 0 and 1.")

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    df, _split_sizes = ingestion._read_split_triple_dataset(args.dataset_dir)
    data_path = output_dir / "data.csv"
    df.to_csv(data_path, index=False)

    sample_df = df.sample(frac=args.sample_proportion, random_state=args.seed).reset_index(drop=True)
    missing_df = preprocess.compute_missing_df(df, sample_df).reset_index(drop=True)
    candidates_df = triple_gen.generate_all_candidates(sample_df)

    sample_df.to_csv(output_dir / "known_sample.csv", index=False)
    missing_df.to_csv(output_dir / "missing.csv", index=False)
    candidates_df.to_csv(output_dir / "candidates.csv", index=False)

    cand_sample = balanced_candidate_sample(
        candidates_df,
        missing_df,
        sample_size=args.candidate_sample_size,
        true_ratio=args.true_ratio,
        seed=args.seed,
    )
    cand_path = output_dir / "cand_sample.csv"
    cand_sample.to_csv(cand_path, index=False)

    print(f"Wrote full dataset: {data_path}")
    print(f"Wrote candidate sample: {cand_path}")
    print(f"Triples={len(df)} known_sample={len(sample_df)} missing={len(missing_df)} candidates={len(candidates_df)}")


if __name__ == "__main__":
    main()
