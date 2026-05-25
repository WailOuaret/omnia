# COVID-Fact Backend Status Report

**Date:** 2026-05-24  
**Endpoint:** `GET /api/samples` → sample id `omnia_covid_fact`

## Current status (verified after ingestion update)

| Field | Expected | Actual |
|-------|----------|--------|
| `source_available` | `true` | `true` |
| `kg_loader_available` | `false` | `false` |
| `available` | `false` | `false` |
| `status_message` | Source JSONL available; KG converter pending. | Matches when JSONL on disk |
| `stats.jsonl_claim_rows` | ~4,086 | 4,086 |

## Correctness

**Yes** — COVID-Fact is honestly reported as:

- Source JSONL is present and counted.
- KG loader/converter is **not** implemented.
- Backend KG sessions cannot be created from COVID-Fact.
- Static guided demo remains the supported path.

## Backend changes made

**File:** `backend/app/services/ingestion.py`

- Added `status_message` field to `/api/samples` response for COVID-Fact:
  - `"Source JSONL available; KG converter pending."` when JSONL exists
  - Missing-file message when JSONL absent

No change to `available`, `kg_loader_available`, or `_load_real_dataset_dataframe` rejection of JSONL-as-KG.

## Other benchmarks unchanged

- `omnia_codex_m`: `available=true`
- `omnia_fb15k-237`: `available=true`
- `omnia_wn18rr`: `available=true`
