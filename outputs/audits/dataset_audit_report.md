# OMNIA+ Dataset Audit Report

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
