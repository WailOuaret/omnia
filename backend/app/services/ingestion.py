from __future__ import annotations

import json
import re
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import UploadFile

from experiment import preprocess

from ..config import (
    BENCHMARK_SAMPLE_PREFIX,
    CODEX_REPO_ROOT,
    COVIDFACT_REPO_ROOT,
    DEFAULT_BENCHMARK_SAMPLING_LIMIT,
    DEFAULT_SAMPLE_PROPORTION,
    KNOWLEDGE_EMBEDDING_ROOT,
    LARGE_DATASET_WARNING_THRESHOLD,
)
from ..models import DemoSession
from ..store import init_steps, log_event, new_session_id, put_session, update_step


CANONICAL_COLUMNS = ["Head", "Relation", "Tail"]
COLUMN_ALIASES = {
    "Head": {"head", "subject", "source", "src", "entity1", "node1"},
    "Relation": {"relation", "predicate", "edge", "label", "rel", "property"},
    "Tail": {"tail", "object", "target", "dst", "entity2", "node2"},
}

REAL_DATASET_SETUP_HINT = "Run python scripts/setup_real_datasets.py"

# Keep OMNIA paper metadata counts in the demo cards even when we load true triples
# from local cloned repositories.
OMNIA_PAPER_COUNTS: dict[str, dict[str, int]] = {
    "omnia_covid_fact": {"entities": 1416, "relations": 28, "triples": 908},
    "omnia_codex_m": {"entities": 16759, "relations": 49, "triples": 60000},
    "omnia_fb15k-237": {"entities": 12993, "relations": 29, "triples": 59270},
    "omnia_wn18rr": {"entities": 40943, "relations": 11, "triples": 93003},
}


def _normalize_name(value: str) -> str:
    return "".join(ch.lower() for ch in value.strip() if ch.isalnum())


def guess_mapping(columns: list[str]) -> dict[str, str]:
    guessed: dict[str, str] = {}
    normalized = {_normalize_name(column): column for column in columns}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                guessed[canonical] = normalized[alias]
                break
    return guessed


def _read_json_payload(raw: bytes) -> pd.DataFrame:
    payload = json.loads(raw.decode("utf-8"))
    if isinstance(payload, list):
        return pd.DataFrame(payload)
    if isinstance(payload, dict) and "data" in payload:
        return pd.DataFrame(payload["data"])
    raise ValueError("Unsupported JSON triple payload.")


def _looks_like_headerless_triples(columns: list[str]) -> bool:
    if len(columns) != 3:
        return False

    normalized_columns = {_normalize_name(column) for column in columns}
    known_names = {
        _normalize_name(alias)
        for values in COLUMN_ALIASES.values()
        for alias in values
    } | {_normalize_name(column) for column in CANONICAL_COLUMNS}

    if normalized_columns & known_names:
        return False

    suspicious_columns = 0
    for column in columns:
        text = str(column).strip()
        if not text:
            suspicious_columns += 1
            continue
        if text.startswith(("/", "_", "m/")) or any(char in text for char in "/._:-"):
            suspicious_columns += 1
            continue
        if text.isdigit():
            suspicious_columns += 1
            continue
    return suspicious_columns >= 2


def _read_tabular_bytes(raw: bytes, *, sep: str) -> pd.DataFrame:
    inferred_df = pd.read_csv(BytesIO(raw), sep=sep)
    if not _looks_like_headerless_triples(inferred_df.columns.astype(str).tolist()):
        return inferred_df
    return pd.read_csv(BytesIO(raw), sep=sep, header=None, names=CANONICAL_COLUMNS)


def read_dataframe_from_bytes(raw: bytes, filename: str) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    if suffix in {".csv", ".txt"}:
        return _read_tabular_bytes(raw, sep=",")
    if suffix == ".tsv":
        return _read_tabular_bytes(raw, sep="\t")
    if suffix == ".json":
        return _read_json_payload(raw)
    raise ValueError(f"Unsupported dataset format: {suffix}")


async def read_upload(upload: UploadFile) -> pd.DataFrame:
    raw = await upload.read()
    if not raw:
        raise ValueError("Uploaded dataset is empty.")
    return read_dataframe_from_bytes(raw, upload.filename or "dataset.csv")


def build_preview(df: pd.DataFrame) -> dict[str, Any]:
    guessed_mapping = guess_mapping(df.columns.tolist())
    preview_rows = df.head(8).fillna("").to_dict("records")
    malformed_mask = df.isnull().any(axis=1)
    diagnostics = {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "columns": df.columns.tolist(),
        "guessed_mapping": guessed_mapping,
        "preview_rows": preview_rows,
        "duplicate_rows": int(df.duplicated().sum()),
        "malformed_rows": int(malformed_mask.sum()),
    }
    return diagnostics


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _read_text_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    mapping: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        key, _, text = line.partition("\t")
        if key and text:
            mapping[key.strip()] = text.strip()
    return mapping


_SPLIT_FILE_ALIASES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("train", ("train.txt", "train.tsv")),
    ("dev", ("dev.txt", "dev.tsv", "valid.txt")),
    ("test", ("test.txt", "test.tsv")),
)


def _pick_split_path(dataset_dir: Path, logical: str) -> Path | None:
    for log_name, filenames in _SPLIT_FILE_ALIASES:
        if log_name != logical:
            continue
        for name in filenames:
            candidate = dataset_dir / name
            if candidate.exists():
                return candidate
    return None


def _read_triple_split_file(path: Path) -> pd.DataFrame:
    """Load a headerless tab-separated triple file (CoDEx / standard KGE splits)."""
    df = pd.read_csv(path, sep="\t", header=None, names=CANONICAL_COLUMNS, dtype=str, encoding="utf-8")
    df = df.replace({pd.NA: None}).dropna(how="any")
    for col in CANONICAL_COLUMNS:
        df[col] = df[col].astype(str).str.strip()
    df = df[(df != "").all(axis=1)]
    return df.reset_index(drop=True)


def _read_split_triple_dataset(dataset_dir: Path) -> tuple[pd.DataFrame, dict[str, int]]:
    frames: list[pd.DataFrame] = []
    split_sizes: dict[str, int] = {}
    for logical, _ in _SPLIT_FILE_ALIASES:
        path = _pick_split_path(dataset_dir, logical)
        if path is None:
            continue
        split_df = _read_triple_split_file(path)
        split_sizes[logical] = len(split_df)
        frames.append(split_df)
    if not frames:
        raise FileNotFoundError(
            f"No train/dev/test splits found in {dataset_dir} "
            f"(expected tab-separated files such as train.txt / valid.txt / test.txt)."
        )
    merged = pd.concat(frames, ignore_index=True).drop_duplicates().reset_index(drop=True)
    return merged, split_sizes


def _count_rows(path: Path) -> int:
    with path.open("rb") as handle:
        return sum(1 for _ in handle)


def _benchmark_split_sizes(dataset_dir: Path) -> dict[str, int]:
    split_sizes: dict[str, int] = {}
    for logical, _ in _SPLIT_FILE_ALIASES:
        path = _pick_split_path(dataset_dir, logical)
        if path:
            split_sizes[logical] = _count_rows(path)
    return split_sizes


def _resolve_first_existing(base: Path, choices: list[str]) -> Path | None:
    for choice in choices:
        candidate = base / choice
        if candidate.exists():
            return candidate
    return None


def _real_dataset_manifest() -> list[dict[str, Any]]:
    codex_m_path = CODEX_REPO_ROOT / "data" / "triples" / "codex-m"
    fb15k_path = _resolve_first_existing(
        KNOWLEDGE_EMBEDDING_ROOT, ["FB15k-237", "FB15K-237", "fb15k-237"]
    )
    wn18rr_path = _resolve_first_existing(
        KNOWLEDGE_EMBEDDING_ROOT, ["WN18RR", "wn18rr"]
    )
    covidfact_path = COVIDFACT_REPO_ROOT

    return [
        {
            "id": "omnia_codex_m",
            "aliases": {"omnia_codex_m", f"{BENCHMARK_SAMPLE_PREFIX}codex_m"},
            "label": "CoDEx-M",
            "repo": "codex",
            "path": codex_m_path,
            "description": "Real CoDEx-M triples from github.com/tsafavi/codex.",
            "paper_counts": OMNIA_PAPER_COUNTS["omnia_codex_m"],
        },
        {
            "id": "omnia_fb15k-237",
            "aliases": {
                "omnia_fb15k-237",
                "omnia_fb15k_237",
                f"{BENCHMARK_SAMPLE_PREFIX}fb15k_237",
                f"{BENCHMARK_SAMPLE_PREFIX}fb15k-237",
            },
            "label": "FB15K-237",
            "repo": "datasets_knowledge_embedding",
            "path": fb15k_path or (KNOWLEDGE_EMBEDDING_ROOT / "FB15k-237"),
            "description": "Real FB15K-237 triples from github.com/villmow/datasets_knowledge_embedding.",
            "paper_counts": OMNIA_PAPER_COUNTS["omnia_fb15k-237"],
        },
        {
            "id": "omnia_wn18rr",
            "aliases": {"omnia_wn18rr", f"{BENCHMARK_SAMPLE_PREFIX}wn18rr"},
            "label": "WN18RR",
            "repo": "datasets_knowledge_embedding",
            "path": wn18rr_path or (KNOWLEDGE_EMBEDDING_ROOT / "WN18RR"),
            "description": "Real WN18RR triples from github.com/villmow/datasets_knowledge_embedding.",
            "paper_counts": OMNIA_PAPER_COUNTS["omnia_wn18rr"],
        },
        {
            "id": "omnia_covid_fact",
            "aliases": {"omnia_covid_fact", "covid_fact"},
            "label": "COVID-Fact",
            "repo": "covidfact",
            "path": covidfact_path,
            "description": "COVID-Fact repository clone (format may vary; availability is best-effort).",
            "paper_counts": OMNIA_PAPER_COUNTS["omnia_covid_fact"],
        },
    ]


def _resolve_dataset_entry(sample_id: str) -> dict[str, Any]:
    for entry in _real_dataset_manifest():
        if sample_id == entry["id"] or sample_id in entry["aliases"]:
            return entry
    available = ", ".join(item["id"] for item in _real_dataset_manifest())
    raise FileNotFoundError(f"Unknown sample '{sample_id}'. Available: {available}")


def _load_real_dataset_dataframe(entry: dict[str, Any]) -> tuple[pd.DataFrame, dict[str, int]]:
    dataset_path = Path(entry["path"])
    if entry["id"] == "omnia_covid_fact":
        # COVID-Fact format is not guaranteed; treat this as best-effort and do
        # not fail setup discovery when no loadable triples are found.
        candidates = [
            dataset_path / "triples.tsv",
            dataset_path / "triples.txt",
            dataset_path / "data" / "triples.tsv",
            dataset_path / "data" / "train.tsv",
        ]
        for path in candidates:
            if path.exists():
                df = _read_tabular_bytes(path.read_bytes(), sep="\t")
                canonical, _ = canonicalize_dataframe(df, mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"})
                return canonical, {"train": len(canonical), "dev": 0, "test": 0}
        raise FileNotFoundError(
            f"Could not find a directly loadable COVID-Fact triple file under {dataset_path}."
        )

    # CoDEx / FB15K-237 / WN18RR: split-based KGE triples.
    data_dir = dataset_path
    if entry["id"] == "omnia_wn18rr":
        if (dataset_path / "original" / "train.txt").exists():
            data_dir = dataset_path / "original"
        elif (dataset_path / "text" / "train.txt").exists():
            data_dir = dataset_path / "text"
    df, split_sizes = _read_split_triple_dataset(data_dir)
    return df, split_sizes


def canonicalize_dataframe(
    df: pd.DataFrame,
    mapping: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    mapping = mapping or guess_mapping(df.columns.tolist())
    missing_columns = [column for column in CANONICAL_COLUMNS if column not in mapping]
    if missing_columns:
        raise ValueError(
            f"Missing column mapping for: {', '.join(missing_columns)}. "
            "Provide explicit mappings for Head, Relation, and Tail."
        )

    canonical_df = df[[mapping["Head"], mapping["Relation"], mapping["Tail"]]].copy()
    canonical_df.columns = CANONICAL_COLUMNS
    canonical_df = canonical_df.replace({pd.NA: None})
    malformed_mask = canonical_df.isnull().any(axis=1)
    canonical_df = canonical_df[~malformed_mask].copy()
    canonical_df = canonical_df.astype(str)
    for column in CANONICAL_COLUMNS:
        canonical_df[column] = canonical_df[column].str.strip()
    empty_mask = (canonical_df == "").any(axis=1)
    canonical_df = canonical_df[~empty_mask].copy()
    before_dedup = len(canonical_df)
    canonical_df = canonical_df.drop_duplicates().reset_index(drop=True)

    diagnostics = {
        "dropped_malformed_rows": int(malformed_mask.sum() + empty_mask.sum()),
        "dropped_duplicates": int(before_dedup - len(canonical_df)),
        "triple_count": int(len(canonical_df)),
        "entity_count": int(pd.unique(pd.concat([canonical_df["Head"], canonical_df["Tail"]])).size),
        "relation_count": int(canonical_df["Relation"].nunique()),
    }
    return canonical_df, diagnostics


def list_samples() -> list[dict[str, Any]]:
    """Report real-dataset availability from local cloned repositories."""
    samples: list[dict[str, Any]] = []
    for entry in _real_dataset_manifest():
        dataset_path = Path(entry["path"])
        available = False
        split_sizes: dict[str, int] = {}
        load_error: str | None = None
        if dataset_path.exists():
            try:
                if entry["id"] == "omnia_covid_fact":
                    # Best-effort probe only.
                    _load_real_dataset_dataframe(entry)
                    available = True
                else:
                    _, split_sizes = _load_real_dataset_dataframe(entry)
                    available = True
            except Exception as exc:  # noqa: BLE001
                load_error = str(exc)
                available = False
        sample = {
            "id": entry["id"],
            "name": entry["label"],
            "label": entry["label"],
            "source": "real_dataset",
            "path": str(dataset_path),
            "available": available,
            "entities": int(entry["paper_counts"]["entities"]),
            "relations": int(entry["paper_counts"]["relations"]),
            "triples": int(entry["paper_counts"]["triples"]),
            "description": entry["description"],
            "setup_hint": None if available else REAL_DATASET_SETUP_HINT,
            "load_error": load_error,
            "recommended_sampling_limit": DEFAULT_BENCHMARK_SAMPLING_LIMIT if available else None,
            "stats": {
                "rows": int(sum(split_sizes.values()) if split_sizes else 0),
                "columns": 3,
                "train_rows": int(split_sizes.get("train", 0)),
                "dev_rows": int(split_sizes.get("dev", 0)),
                "test_rows": int(split_sizes.get("test", 0)),
            },
        }
        samples.append(sample)
    return samples


def create_session_from_dataframe(
    *,
    dataset_name: str,
    source_type: str,
    source_path: str | None,
    df: pd.DataFrame,
    mapping: dict[str, str] | None = None,
    holdout_mode: bool = True,
    sample_proportion: float = DEFAULT_SAMPLE_PROPORTION,
    sampling_limit: int | None = None,
    entity_labels: dict[str, str] | None = None,
    relation_labels: dict[str, str] | None = None,
) -> DemoSession:
    preview = build_preview(df)
    canonical_df, diagnostics = canonicalize_dataframe(df, mapping=mapping)
    pipeline_source_df = canonical_df
    warnings: list[str] = []

    if sampling_limit and sampling_limit < len(canonical_df):
        pipeline_source_df = canonical_df.sample(sampling_limit, random_state=42).reset_index(drop=True)
        warnings.append(
            f"Sampling mode enabled: pipeline runs on {len(pipeline_source_df)} of {len(canonical_df)} triples."
        )

    if len(canonical_df) > LARGE_DATASET_WARNING_THRESHOLD:
        warnings.append(
            "Large dataset detected. Graph visualization will be sampled, and pipeline runtimes may increase."
        )

    if holdout_mode:
        known_df, missing_df = preprocess.split_known_missing(
            pipeline_source_df, sample_proportion=sample_proportion, random_state=42
        )
    else:
        known_df = pipeline_source_df.copy().reset_index(drop=True)
        missing_df = pd.DataFrame(columns=CANONICAL_COLUMNS)

    session = DemoSession(
        session_id=new_session_id(),
        dataset_name=dataset_name,
        source_type=source_type,
        source_path=source_path,
        holdout_mode=holdout_mode,
        sample_proportion=sample_proportion,
        uploaded_df=canonical_df,
        pipeline_source_df=pipeline_source_df,
        known_df=known_df,
        missing_df=missing_df,
        column_mapping=mapping or preview["guessed_mapping"],
        diagnostics={**preview, **diagnostics},
        entity_labels=entity_labels or {},
        relation_labels=relation_labels or {},
        warnings=warnings,
    )
    init_steps(session)
    update_step(
        session,
        "kg_loaded",
        status="completed",
        input_count=len(canonical_df),
        output_count=len(known_df),
        explanation=(
            "The dataset was canonicalized to Head / Relation / Tail and prepared for the OMNIA pipeline."
        ),
    )
    log_event(
        session,
        "kg_loaded",
        "info",
        "Dataset ingested successfully.",
        {
            "uploaded_triples": len(canonical_df),
            "pipeline_triples": len(pipeline_source_df),
            "holdout_mode": holdout_mode,
            "missing_triples": len(missing_df),
        },
    )
    for warning in warnings:
        log_event(session, "kg_loaded", "warning", warning)
    return put_session(session)


def create_session_from_sample(
    sample_id: str,
    holdout_mode: bool = True,
    sample_proportion: float = DEFAULT_SAMPLE_PROPORTION,
    sampling_limit: int | None = None,
) -> DemoSession:
    entry = _resolve_dataset_entry(sample_id)
    dataset_path: Path = Path(entry["path"])
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset path not found: {dataset_path}. {REAL_DATASET_SETUP_HINT}"
        )

    df, split_sizes = _load_real_dataset_dataframe(entry)
    resolved_sampling_limit = sampling_limit
    if resolved_sampling_limit is None and len(df) > DEFAULT_BENCHMARK_SAMPLING_LIMIT:
        resolved_sampling_limit = DEFAULT_BENCHMARK_SAMPLING_LIMIT

    session = create_session_from_dataframe(
        dataset_name=str(entry["label"]),
        source_type="real_dataset",
        source_path=str(dataset_path),
        df=df,
        mapping={column: column for column in CANONICAL_COLUMNS},
        holdout_mode=holdout_mode,
        sample_proportion=sample_proportion,
        sampling_limit=resolved_sampling_limit,
        entity_labels={},
        relation_labels={},
    )
    session.diagnostics["benchmark_splits"] = split_sizes
    session.diagnostics["benchmark_source"] = entry["repo"]
    session.diagnostics["sample_id"] = entry["id"]
    session.diagnostics["dataset_repo_path"] = str(dataset_path)
    session.artifacts["sample_id"] = entry["id"]
    session.artifacts["paper_counts"] = entry["paper_counts"]
    if resolved_sampling_limit:
        session.warnings.append(
            f"Real dataset opened in focus-first mode: pipeline sampled to {resolved_sampling_limit} triples."
        )
    return session
