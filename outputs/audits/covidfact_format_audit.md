# COVID-Fact Format Audit

**Path:** `data/covidfact/COVIDFACT_dataset.jsonl`
**File size:** 3,121,335 bytes
**Row count:** 4,086
**Invalid JSON lines:** 0
**Near expected (~4086):** Yes

## Field names

`claim`, `evidence`, `flair`, `gold_source`, `label`

## Field presence

| Field | Present | Missing |
|-------|--------:|--------:|
| `claim` | 4,086 | 0 |
| `evidence` | 4,086 | 0 |
| `flair` | 4,086 | 0 |
| `gold_source` | 4,086 | 0 |
| `label` | 4,086 | 0 |

## Label distribution

| Label | Count |
|-------|------:|
| REFUTED | 2,790 |
| SUPPORTED | 1,296 |

## Flair distribution (top 10)

| Flair | Count |
|-------|------:|
| Preprint | 1,294 |
| Press Release | 537 |
| Academic Report | 534 |
| Academic Comment | 306 |
| Vaccine Research | 268 |
| Clinical | 232 |
| Epidemiology | 224 |
| Antivirals | 195 |
| Diagnostics | 102 |
| Government Agency | 79 |

## Duplicate check

- Duplicate claim texts: 5
- Rows with explicit Head/Relation/Tail keys: 0

## Interpretation

COVID-Fact is successfully downloaded as a source JSONL claim-verification dataset. It is **not directly loadable as KG triples** until a validated converter is implemented.

Tables written: `outputs/tables/covidfact_field_summary.csv`, `outputs/tables/covidfact_label_distribution.csv`
