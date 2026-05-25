#!/usr/bin/env python3
"""Audit COVID-Fact JSONL source and write verification reports + CSV tables."""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
JSONL_PATH = REPO_ROOT / "data" / "covidfact" / "COVIDFACT_dataset.jsonl"
AUDITS = REPO_ROOT / "outputs" / "audits"
TABLES = REPO_ROOT / "outputs" / "tables"
EXPECTED_ROWS = 4086
TOLERANCE = 50


def main() -> int:
    AUDITS.mkdir(parents=True, exist_ok=True)
    TABLES.mkdir(parents=True, exist_ok=True)

    if not JSONL_PATH.exists():
        print(f"ERROR: missing {JSONL_PATH}", file=sys.stderr)
        return 1

    rows: list[dict] = []
    bad_json = 0
    with JSONL_PATH.open(encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rows.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                bad_json += 1
                if bad_json <= 5:
                    print(f"JSON error line {line_no}: {exc}", file=sys.stderr)

    field_presence: Counter[str] = Counter()
    missing_by_field: Counter[str] = Counter()
    label_counts: Counter[str] = Counter()
    flair_counts: Counter[str] = Counter()
    claims: list[str] = []
    has_triple_keys = 0

    for row in rows:
        keys = set(row.keys())
        if {"Head", "Relation", "Tail"}.issubset(keys) or {"head", "relation", "tail"}.issubset(keys):
            has_triple_keys += 1
        for field in ("claim", "label", "evidence", "gold_source", "flair"):
            if field in row and row[field] not in (None, "", []):
                field_presence[field] += 1
            else:
                missing_by_field[field] += 1
        label_counts[str(row.get("label", ""))] += 1
        flair_counts[str(row.get("flair", ""))] += 1
        claim = row.get("claim")
        if isinstance(claim, str):
            claims.append(claim.strip())

    duplicate_claims = len(claims) - len(set(claims))
    row_count = len(rows)
    file_size = JSONL_PATH.stat().st_size
    all_fields = sorted({k for row in rows for k in row.keys()})

    # Field summary CSV
    field_csv = TABLES / "covidfact_field_summary.csv"
    with field_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["field", "present_count", "missing_count", "present_pct"])
        for field in sorted(set(field_presence) | set(missing_by_field)):
            present = field_presence.get(field, 0)
            missing = missing_by_field.get(field, 0)
            pct = (present / row_count * 100) if row_count else 0
            writer.writerow([field, present, missing, f"{pct:.2f}"])

    # Label distribution CSV
    label_csv = TABLES / "covidfact_label_distribution.csv"
    with label_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["label", "count", "pct"])
        for label, count in label_counts.most_common():
            pct = (count / row_count * 100) if row_count else 0
            writer.writerow([label, count, f"{pct:.2f}"])

    near_expected = abs(row_count - EXPECTED_ROWS) <= TOLERANCE
    complete = row_count > 0 and bad_json == 0 and file_size > 0

    format_md = AUDITS / "covidfact_format_audit.md"
    format_md.write_text(
        "\n".join(
            [
                "# COVID-Fact Format Audit",
                "",
                f"**Path:** `{JSONL_PATH.relative_to(REPO_ROOT).as_posix()}`",
                f"**File size:** {file_size:,} bytes",
                f"**Row count:** {row_count:,}",
                f"**Invalid JSON lines:** {bad_json}",
                f"**Near expected (~{EXPECTED_ROWS}):** {'Yes' if near_expected else 'No'}",
                "",
                "## Field names",
                "",
                ", ".join(f"`{f}`" for f in all_fields),
                "",
                "## Field presence",
                "",
                "| Field | Present | Missing |",
                "|-------|--------:|--------:|",
                *[
                    f"| `{field}` | {field_presence.get(field, 0):,} | {missing_by_field.get(field, 0):,} |"
                    for field in sorted(set(field_presence) | set(missing_by_field))
                ],
                "",
                "## Label distribution",
                "",
                "| Label | Count |",
                "|-------|------:|",
                *[f"| {label} | {count:,} |" for label, count in label_counts.most_common()],
                "",
                "## Flair distribution (top 10)",
                "",
                "| Flair | Count |",
                "|-------|------:|",
                *[f"| {flair} | {count:,} |" for flair, count in flair_counts.most_common(10)],
                "",
                "## Duplicate check",
                "",
                f"- Duplicate claim texts: {duplicate_claims:,}",
                f"- Rows with explicit Head/Relation/Tail keys: {has_triple_keys}",
                "",
                "## Interpretation",
                "",
                "COVID-Fact is successfully downloaded as a source JSONL claim-verification dataset. "
                "It is **not directly loadable as KG triples** until a validated converter is implemented.",
                "",
                f"Tables written: `{field_csv.relative_to(REPO_ROOT).as_posix()}`, "
                f"`{label_csv.relative_to(REPO_ROOT).as_posix()}`",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(f"Rows: {row_count}, bad_json: {bad_json}, size: {file_size}")
    print(f"Wrote {format_md}")
    return 0 if complete and near_expected else 1


if __name__ == "__main__":
    raise SystemExit(main())
