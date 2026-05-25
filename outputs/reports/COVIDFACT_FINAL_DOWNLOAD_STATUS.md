# COVID-Fact Final Download Status

## Source

Official repository: [https://github.com/asaakyan/covidfact](https://github.com/asaakyan/covidfact)

## Local path

`data/covidfact/COVIDFACT_dataset.jsonl`

## Download action

**Already present** — official git clone with correct remote.  
`git pull` run on 2026-05-24: **Already up to date** (commit `ceeb613`).

## File verification

| Check | Result |
|-------|--------|
| Rows | **4,086** |
| File size | **3,121,335 bytes** |
| Valid JSON lines | **4,086 / 4,086** (0 errors) |
| Fields | `claim`, `label`, `evidence`, `gold_source`, `flair` |
| Labels | SUPPORTED, REFUTED, NOT ENOUGH INFO (+ variants) |
| Duplicate claim texts | Present (contrastive/typo variants by design) |
| Head/Relation/Tail triples in JSONL | **None** |

Tables: `outputs/tables/covidfact_field_summary.csv`, `outputs/tables/covidfact_label_distribution.csv`

## Backend status

| Field | Value |
|-------|-------|
| `source_available` | `true` |
| `kg_loader_available` | `false` |
| `available` | `false` |
| `status_message` | `Source JSONL available; KG converter pending.` |

## Can it be opened as backend KG session?

**No.** Session creation for `omnia_covid_fact` remains blocked until a validated KG converter is implemented.

## What still needs work

- Validated KG converter (or continue using static guided demo in `/paper-demo`).
- Experimental scaffold only: `scripts/convert_covidfact_to_kg.py` → `data/processed/covidfact_kg_experimental/` (not official KG).

## Safe claim

COVID-Fact source data are downloaded and verified, but KG loading is pending.

## Claim to avoid

COVID-Fact is fully available as a KG benchmark.

## Audit artifacts

- `outputs/audits/covidfact_download_pre_audit.md`
- `outputs/audits/covidfact_download_report.md`
- `outputs/audits/covidfact_format_audit.md`
- `outputs/audits/covidfact_backend_status_report.md`
- `outputs/reports/covidfact_converter_pending.md`

## Tests

```shell
python -m unittest discover -s tests -p "test_covidfact*.py" -v
python scripts/audit_covidfact.py
python scripts/setup_omnia_datasets.py
```
