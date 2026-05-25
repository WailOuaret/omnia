# OMNIA+ Dataset Setup Report

Generated: 2026-05-24T23:03:55

## Repository actions

- Pulled latest codex
- Pulled latest datasets_knowledge_embedding
- Pulled latest covidfact

## Before setup

# Pre-setup audit

Generated: 2026-05-24 22:03 UTC

Repository root: `C:\Users\wailo\Desktop\omnia-correct`

## Summary

| Dataset | Status | Backend usable | Source available | KG loader | Action |
| --- | --- | --- | --- | --- | --- |
| CoDEx-M | FOUND | yes | yes | yes | **KEEP** |
| FB15K-237 | FOUND | yes | yes | yes | **KEEP** |
| WN18RR | FOUND | yes | yes | yes | **KEEP** |
| COVID-Fact | FOUND | no | yes | no | **NEEDS_CONVERTER** |

## Details

### CoDEx-M

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\codex\data\triples\codex-m`
- **Git remote:** `https://github.com/tsafavi/codex.git` (OK)
- **Files / splits:** 5 files; splits: test.txt, train.txt, valid.txt
- **Row counts:** `{"test": 10311, "train": 185584, "valid": 10310}` (total ≈ 206,205)
- **Recommended action:** **KEEP**
- entities dir: C:\Users\wailo\Desktop\omnia-correct\data\codex\data\entities
- relations dir: C:\Users\wailo\Desktop\omnia-correct\data\codex\data\relations

### FB15K-237

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\datasets_knowledge_embedding\FB15k-237`
- **Git remote:** `https://github.com/villmow/datasets_knowledge_embedding.git` (OK)
- **Files / splits:** 5 files; splits: test.txt, train.txt, valid.txt
- **Row counts:** `{"test": 20466, "train": 272115, "valid": 17535}` (total ≈ 310,116)
- **Recommended action:** **KEEP**

### WN18RR

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\datasets_knowledge_embedding\WN18RR`
- **Git remote:** `https://github.com/villmow/datasets_knowledge_embedding.git` (OK)
- **Files / splits:** 2 files; splits: test.txt, train.txt, valid.txt, test.txt, train.txt, valid.txt
- **Row counts:** `{"test": 3134, "train": 86835, "valid": 3034}` (total ≈ 93,003)
- **Recommended action:** **KEEP**

### COVID-Fact

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\covidfact\COVIDFACT_dataset.jsonl`
- **Git remote:** `https://github.com/asaakyan/covidfact.git` (OK)
- **Files / splits:** 1 files; splits: COVIDFACT_dataset.jsonl
- **Row counts:** `{"jsonl_claims": 4086}` (total ≈ 4,086)
- **Recommended action:** **NEEDS_CONVERTER**
- COVIDFACT_dataset.jsonl is claim/evidence JSONL — not KG triples. Backend session creation requires a KG converter (not yet implemented).

## Socio-Economic

- **Status:** STATIC/DEMO-ONLY (private LLM-generated KG in OMNIA paper)
- **Action:** Do not download — use frontend static config only.

## OMNIA paper UI counts (display only)

| Dataset | Entities | Relations | Triples |
| --- | ---: | ---: | ---: |
| CoDEx-M | 16,759 | 49 | 60,000 |
| FB15K-237 | 12,993 | 29 | 59,270 |
| WN18RR | 40,943 | 11 | 93,003 |
| COVID-Fact | 1,416 | 28 | 908 |
| Socio-Economic | 33,563 | 17,175 | 64,417 |


## After setup

# Post-setup audit

Generated: 2026-05-24 22:03 UTC

Repository root: `C:\Users\wailo\Desktop\omnia-correct`

## Summary

| Dataset | Status | Backend usable | Source available | KG loader | Action |
| --- | --- | --- | --- | --- | --- |
| CoDEx-M | FOUND | yes | yes | yes | **KEEP** |
| FB15K-237 | FOUND | yes | yes | yes | **KEEP** |
| WN18RR | FOUND | yes | yes | yes | **KEEP** |
| COVID-Fact | FOUND | no | yes | no | **NEEDS_CONVERTER** |

## Details

### CoDEx-M

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\codex\data\triples\codex-m`
- **Git remote:** `https://github.com/tsafavi/codex.git` (OK)
- **Files / splits:** 5 files; splits: test.txt, train.txt, valid.txt
- **Row counts:** `{"test": 10311, "train": 185584, "valid": 10310}` (total ≈ 206,205)
- **Recommended action:** **KEEP**
- entities dir: C:\Users\wailo\Desktop\omnia-correct\data\codex\data\entities
- relations dir: C:\Users\wailo\Desktop\omnia-correct\data\codex\data\relations

### FB15K-237

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\datasets_knowledge_embedding\FB15k-237`
- **Git remote:** `https://github.com/villmow/datasets_knowledge_embedding.git` (OK)
- **Files / splits:** 5 files; splits: test.txt, train.txt, valid.txt
- **Row counts:** `{"test": 20466, "train": 272115, "valid": 17535}` (total ≈ 310,116)
- **Recommended action:** **KEEP**

### WN18RR

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\datasets_knowledge_embedding\WN18RR`
- **Git remote:** `https://github.com/villmow/datasets_knowledge_embedding.git` (OK)
- **Files / splits:** 2 files; splits: test.txt, train.txt, valid.txt, test.txt, train.txt, valid.txt
- **Row counts:** `{"test": 3134, "train": 86835, "valid": 3034}` (total ≈ 93,003)
- **Recommended action:** **KEEP**

### COVID-Fact

- **Status:** FOUND
- **Path:** `C:\Users\wailo\Desktop\omnia-correct\data\covidfact\COVIDFACT_dataset.jsonl`
- **Git remote:** `https://github.com/asaakyan/covidfact.git` (OK)
- **Files / splits:** 1 files; splits: COVIDFACT_dataset.jsonl
- **Row counts:** `{"jsonl_claims": 4086}` (total ≈ 4,086)
- **Recommended action:** **NEEDS_CONVERTER**
- COVIDFACT_dataset.jsonl is claim/evidence JSONL — not KG triples. Backend session creation requires a KG converter (not yet implemented).

## Socio-Economic

- **Status:** STATIC/DEMO-ONLY (private LLM-generated KG in OMNIA paper)
- **Action:** Do not download — use frontend static config only.

## OMNIA paper UI counts (display only)

| Dataset | Entities | Relations | Triples |
| --- | ---: | ---: | ---: |
| CoDEx-M | 16,759 | 49 | 60,000 |
| FB15K-237 | 12,993 | 29 | 59,270 |
| WN18RR | 40,943 | 11 | 93,003 |
| COVID-Fact | 1,416 | 28 | 908 |
| Socio-Economic | 33,563 | 17,175 | 64,417 |


## Backend /api/samples

```json
[
  {
    "id": "omnia_codex_m",
    "name": "CoDEx-M",
    "label": "CoDEx-M",
    "source": "real_dataset",
    "path": "C:\\Users\\wailo\\Desktop\\omnia-correct\\data\\codex\\data\\triples\\codex-m",
    "available": true,
    "source_available": true,
    "kg_loader_available": true,
    "entities": 16759,
    "relations": 49,
    "triples": 60000,
    "description": "Real CoDEx-M triples from github.com/tsafavi/codex.",
    "setup_hint": null,
    "load_error": null,
    "status_message": null,
    "recommended_sampling_limit": 1500,
    "stats": {
      "rows": 206205,
      "columns": 3,
      "train_rows": 185584,
      "dev_rows": 10310,
      "test_rows": 10311,
      "jsonl_claim_rows": 0
    }
  },
  {
    "id": "omnia_fb15k-237",
    "name": "FB15K-237",
    "label": "FB15K-237",
    "source": "real_dataset",
    "path": "C:\\Users\\wailo\\Desktop\\omnia-correct\\data\\datasets_knowledge_embedding\\FB15k-237",
    "available": true,
    "source_available": true,
    "kg_loader_available": true,
    "entities": 12993,
    "relations": 29,
    "triples": 59270,
    "description": "Real FB15K-237 triples from github.com/villmow/datasets_knowledge_embedding.",
    "setup_hint": null,
    "load_error": null,
    "status_message": null,
    "recommended_sampling_limit": 1500,
    "stats": {
      "rows": 310116,
      "columns": 3,
      "train_rows": 272115,
      "dev_rows": 17535,
      "test_rows": 20466,
      "jsonl_claim_rows": 0
    }
  },
  {
    "id": "omnia_wn18rr",
    "name": "WN18RR",
    "label": "WN18RR",
    "source": "real_dataset",
    "path": "C:\\Users\\wailo\\Desktop\\omnia-correct\\data\\datasets_knowledge_embedding\\WN18RR",
    "available": true,
    "source_available": true,
    "kg_loader_available": true,
    "entities": 40943,
    "relations": 11,
    "triples": 93003,
    "description": "Real WN18RR triples from github.com/villmow/datasets_knowledge_embedding.",
    "setup_hint": null,
    "load_error": null,
    "status_message": null,
    "recommended_sampling_limit": 1500,
    "stats": {
      "rows": 93003,
      "columns": 3,
      "train_rows": 86835,
      "dev_rows": 3034,
      "test_rows": 3134,
      "jsonl_claim_rows": 0
    }
  },
  {
    "id": "omnia_covid_fact",
    "name": "COVID-Fact",
    "label": "COVID-Fact",
    "source": "real_dataset",
    "path": "C:\\Users\\wailo\\Desktop\\omnia-correct\\data\\covidfact\\COVIDFACT_dataset.jsonl",
    "available": false,
    "source_available": true,
    "kg_loader_available": false,
    "entities": 1416,
    "relations": 28,
    "triples": 908,
    "description": "COVID-Fact claim/evidence JSONL from github.com/asaakyan/covidfact. Source file COVIDFACT_dataset.jsonl; KG session requires a converter.",
    "setup_hint": null,
    "load_error": "COVID-Fact JSONL source is present but KG loader/converter is not implemented. Use static /paper-demo COVID-Fact guided demo.",
    "status_message": "Source JSONL available; KG converter pending.",
    "recommended_sampling_limit": null,
    "stats": {
      "rows": 4086,
      "columns": 1,
      "train_rows": 0,
      "dev_rows": 0,
      "test_rows": 0,
      "jsonl_claim_rows": 4086
    }
  }
]
```
