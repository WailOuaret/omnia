from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import pandas as pd


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class DemoSession:
    session_id: str
    dataset_name: str
    source_type: str
    source_path: str | None
    holdout_mode: bool
    sample_proportion: float
    uploaded_df: pd.DataFrame
    pipeline_source_df: pd.DataFrame
    known_df: pd.DataFrame
    missing_df: pd.DataFrame
    column_mapping: dict[str, str]
    diagnostics: dict[str, Any]
    entity_labels: dict[str, str] = field(default_factory=dict)
    relation_labels: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    logs: list[dict[str, Any]] = field(default_factory=list)
    steps: dict[str, dict[str, Any]] = field(default_factory=dict)
    artifacts: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)


STEP_ORDER = [
    "kg_loaded",
    "sparsity_analysis",
    "relation_tail_clustering",
    "candidate_generation",
    "transe_filtering",
    "llm_validation",
    "completed_kg",
]
