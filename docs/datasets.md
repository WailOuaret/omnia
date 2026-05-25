# OMNIA+ Dataset Reference

This document describes which datasets the OMNIA+ demo uses, where they live on disk, and how the backend exposes them.

## Quick setup

```shell
python scripts/setup_omnia_datasets.py
```

Audit only:

```shell
python scripts/audit_omnia_datasets.py
```

Reports are written to `outputs/audits/dataset_audit_report.md` and `outputs/audits/dataset_setup_report.md`.

## Expected folder structure

```
data/
  _backup/                          # wrong/incomplete repos moved here (never deleted)
  codex/
    .git
    data/
      triples/
        codex-m/
          train.txt
          valid.txt
          test.txt
      entities/
      relations/
  datasets_knowledge_embedding/
    .git
    FB15k-237/
      train.txt
      valid.txt
      test.txt
    WN18RR/
      train.txt
      valid.txt
      test.txt
  covidfact/
    .git
    COVIDFACT_dataset.jsonl         # claim/evidence JSONL (not KG triples)
```

## Dataset table

| UI name | Backend sample ID | Official source | Local path | Backend session | Notes |
| --- | --- | --- | --- | --- | --- |
| CoDEx-M | `omnia_codex_m` | [tsafavi/codex](https://github.com/tsafavi/codex) | `data/codex/data/triples/codex-m` | **Yes** | Real KGE splits. UI shows OMNIA paper counts (60k triples), not full public repo totals. |
| FB15K-237 | `omnia_fb15k-237` | [villmow/datasets_knowledge_embedding](https://github.com/villmow/datasets_knowledge_embedding) | `data/datasets_knowledge_embedding/FB15k-237` | **Yes** | Freebase entity IDs. |
| WN18RR | `omnia_wn18rr` | [villmow/datasets_knowledge_embedding](https://github.com/villmow/datasets_knowledge_embedding) | `data/datasets_knowledge_embedding/WN18RR` | **Yes** | WordNet synsets. |
| COVID-Fact | `omnia_covid_fact` | [asaakyan/covidfact](https://github.com/asaakyan/covidfact) | `data/covidfact/COVIDFACT_dataset.jsonl` | **No** (source only) | **4,086 claim rows** (verified). JSONL claims + evidence. KG converter not implemented. Use static guided demo in `/paper-demo`. |
| Socio-Economic | *(none)* | Private (OMNIA paper) | *(none)* | **No** | Static/demo-only frontend config. Do not download. |

## OMNIA paper UI statistics (display only)

These counts appear in the paper demo UI regardless of how many rows exist in the cloned public repositories:

| Dataset | Entities | Relations | Triples |
| --- | ---: | ---: | ---: |
| COVID-Fact | 1,416 | 28 | 908 |
| CoDEx-M | 16,759 | 49 | 60,000 |
| FB15K-237 | 12,993 | 29 | 59,270 |
| WN18RR | 40,943 | 11 | 93,003 |
| Socio-Economic | 33,563 | 17,175 | 64,417 |

The demo never renders full graphs — only **bounded slices** (typically ≤80 nodes / ≤150 edges).

## Verify backend discovery

```shell
python -m uvicorn backend.app.main:app --reload --port 8000
curl http://127.0.0.1:8000/api/samples
```

Expected:

- `omnia_codex_m`: `"available": true`
- `omnia_fb15k-237`: `"available": true`
- `omnia_wn18rr`: `"available": true`
- `omnia_covid_fact`: `"source_available": true`, `"kg_loader_available": false`, `"available": false`, `"status_message": "Source JSONL available; KG converter pending."`

## Create real backend sessions

```shell
curl -X POST "http://127.0.0.1:8000/api/sessions/sample/omnia_codex_m?holdout_mode=true&sample_proportion=0.8"
curl -X POST "http://127.0.0.1:8000/api/sessions/sample/omnia_fb15k-237?holdout_mode=true&sample_proportion=0.8"
curl -X POST "http://127.0.0.1:8000/api/sessions/sample/omnia_wn18rr?holdout_mode=true&sample_proportion=0.8"
```

Open the returned URL in the browser:

```
http://localhost:5173/paper-demo?sessionId=<session_id>
```

You should see **Graph source: backend session slice** (not static demo fallback).

## Limitations

1. **Socio-Economic** — private LLM-generated KG; static frontend demo only.
2. **COVID-Fact** — source JSONL downloaded and verified (**4,086 rows** at `data/covidfact/COVIDFACT_dataset.jsonl`); no validated KG triple converter yet; live backend sessions cannot be created from it. Static guided demo available in `/paper-demo`.
3. **Large datasets** — backend loads real triples but the UI always shows bounded slices.
4. **In-memory sessions** — restarting the backend clears sessions; create a fresh one before each demo.
