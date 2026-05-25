# COVID-Fact KG Converter — Pending

**Date:** 2026-05-24

## Status

A **validated KG converter does not exist**. COVID-Fact remains:

- `source_available = true`
- `kg_loader_available = false`
- `available = false`

## What exists today

| Asset | Purpose |
|-------|---------|
| `data/covidfact/COVIDFACT_dataset.jsonl` | Official claim/evidence JSONL (4,086 rows) |
| `scripts/convert_covidfact_to_kg.py` | **Scaffold only** — experimental metadata edges |
| `data/processed/covidfact_kg_experimental/` | Sample experimental output (50 rows); **not official KG** |

## Why conversion is pending

COVID-Fact JSONL fields are:

- `claim`, `label`, `evidence`, `gold_source`, `flair`

These are **claim-verification** records, not `(Head, Relation, Tail)` knowledge-graph triples. Mapping them to a biomedical entity KG would require:

1. A validated entity-linking strategy (not regex guessing).
2. Relation schema agreement with OMNIA paper demo counts.
3. Backend integration tests proving session creation works.
4. Teacher-facing documentation that distinguishes claim graphs from KG benchmarks.

## Safe claim

> COVID-Fact source data are downloaded and verified, but KG loading is pending.

## Claim to avoid

> COVID-Fact is fully available as a KG benchmark.

## Recommended next step

Implement `backend/app/services/covidfact_kg_converter.py` with explicit schema review before setting `kg_loader_available=true`.
