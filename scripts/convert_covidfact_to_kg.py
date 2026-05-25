#!/usr/bin/env python3
"""
Experimental COVID-Fact JSONL → claim-evidence graph scaffold.

IMPORTANT:
- Does NOT produce an official OMNIA KG benchmark.
- Does NOT invent biomedical entity triples.
- Output is labeled experimental only.

Usage:
  python scripts/convert_covidfact_to_kg.py --inspect
  python scripts/convert_covidfact_to_kg.py --write-experimental --limit 100
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
JSONL_PATH = REPO_ROOT / "data" / "covidfact" / "COVIDFACT_dataset.jsonl"
OUT_DIR = REPO_ROOT / "data" / "processed" / "covidfact_kg_experimental"
REQUIRED_FIELDS = ("claim", "label")


def load_rows(limit: int | None = None) -> list[dict]:
    if not JSONL_PATH.exists():
        raise FileNotFoundError(f"Missing source JSONL: {JSONL_PATH}")
    rows: list[dict] = []
    with JSONL_PATH.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
            if limit and len(rows) >= limit:
                break
    return rows


def inspect_fields(rows: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        for key in row:
            counts[key] = counts.get(key, 0) + 1
    return counts


def build_experimental_edges(rows: list[dict]) -> list[tuple[str, str, str]]:
    """Map claims to simple claim-metadata edges (not biomedical KG triples)."""
    edges: list[tuple[str, str, str]] = []
    for idx, row in enumerate(rows):
        missing = [f for f in REQUIRED_FIELDS if f not in row or row[f] in (None, "")]
        if missing:
            raise ValueError(f"Row {idx} missing required fields: {missing}")
        claim_id = f"claim_{idx:05d}"
        label = str(row["label"])
        edges.append((claim_id, "has_label", label))
        claim_text = str(row["claim"]).strip()
        if claim_text:
            edges.append((claim_id, "has_text", claim_text[:512]))
        source = row.get("gold_source")
        if source:
            edges.append((claim_id, "has_source", str(source)[:512]))
        evidence = row.get("evidence") or []
        if isinstance(evidence, list):
            for ev_idx, passage in enumerate(evidence[:3]):
                if passage:
                    edges.append((claim_id, f"has_evidence_{ev_idx}", str(passage)[:512]))
    return edges


def write_experimental(rows: list[dict]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    readme = OUT_DIR / "README.md"
    readme.write_text(
        "\n".join(
            [
                "# Experimental COVID-Fact claim-evidence graph",
                "",
                "This is an **experimental** claim-evidence graph derived from COVID-Fact JSONL.",
                "It is **not** an official KG benchmark and must not be used as `omnia_covid_fact` backend triples.",
                "",
                "Edge design (metadata only):",
                "- `claim_id --has_label--> label`",
                "- `claim_id --has_text--> claim_text` (truncated)",
                "- `claim_id --has_source--> gold_source`",
                "- `claim_id --has_evidence_N--> evidence passage`",
                "",
                "No biomedical entity extraction is performed.",
            ]
        ),
        encoding="utf-8",
    )
    edges = build_experimental_edges(rows)
    out_tsv = OUT_DIR / "experimental_edges.tsv"
    with out_tsv.open("w", encoding="utf-8") as handle:
        handle.write("Head\tRelation\tTail\n")
        for head, relation, tail in edges:
            handle.write(f"{head}\t{relation}\t{tail}\n")
    meta = OUT_DIR / "experimental_meta.json"
    meta.write_text(
        json.dumps(
            {
                "source": str(JSONL_PATH),
                "row_count": len(rows),
                "edge_count": len(edges),
                "status": "experimental_not_official_kg",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return out_tsv


def main() -> int:
    parser = argparse.ArgumentParser(description="COVID-Fact experimental converter scaffold")
    parser.add_argument("--inspect", action="store_true", help="Print field summary and exit")
    parser.add_argument("--write-experimental", action="store_true", help="Write experimental TSV")
    parser.add_argument("--limit", type=int, default=0, help="Limit rows (0 = all)")
    args = parser.parse_args()

    limit = args.limit if args.limit > 0 else None
    rows = load_rows(limit=limit)

    if args.inspect:
        print(f"Loaded {len(rows)} rows from {JSONL_PATH}")
        for field, count in sorted(inspect_fields(rows).items()):
            print(f"  {field}: {count}")
        return 0

    if args.write_experimental:
        out = write_experimental(rows)
        print(f"Wrote experimental edges to {out}")
        print("NOTE: experimental output only — not official KG.")
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
