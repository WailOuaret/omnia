# COVID-Fact Download Pre-Audit

**Date:** 2026-05-24  
**Project root:** `C:\Users\wailo\Desktop\omnia-correct`  
**Phase:** Pre-download / pre-pull inspection (no clone or pull performed yet)

## Folder existence

| Path | Status |
|------|--------|
| `data/` | Present |
| `data/covidfact/` | Present |
| `data/covidfact/COVIDFACT_dataset.jsonl` | Present |

## Primary JSONL file

| Metric | Value |
|--------|------:|
| File size | 3,121,335 bytes (~2.98 MiB) |
| Line count (claim rows) | 4,086 |
| Invalid JSON lines | 0 |
| Expected (approx.) | ~4,086 |

**Assessment:** File appears complete and matches the expected official dataset size.

## JSONL fields (from first record)

| Field | Description |
|-------|-------------|
| `claim` | Claim text (natural language) |
| `label` | Verdict label (e.g. SUPPORTED, REFUTED) |
| `evidence` | List of evidence passage strings |
| `gold_source` | Source URL for the claim |
| `flair` | Claim type/category (e.g. Academic Report) |

**No Head / Relation / Tail triple columns present.**

## First 3 records (summarised)

1. **Claim:** Measuring sars-cov-2 neutralizing antibody activity using pseudotyped and chimeric…  
   **Label:** SUPPORTED  
   **Flair:** Academic Report  
   **Evidence:** 2 passages  
   **Source:** rupress.org/jem article URL  

2. **Claim:** Measuring chs-cov-2 neutralizing antibody activity… (typo variant)  
   **Label:** REFUTED  
   **Flair:** Academic Report  

3. **Claim:** Measuring aces-cov-2 neutralizing antibody activity… (typo variant)  
   **Label:** REFUTED  
   **Flair:** Academic Report  

These are **claim-verification** records with contrastive/typo variants — not KG triples.

## Git repository

| Check | Result |
|-------|--------|
| Is git repo? | Yes (`.git` present) |
| Remote `origin` | `https://github.com/asaakyan/covidfact.git` |
| Latest commit (pre-pull) | `ceeb613` — Update README.md |

**Remote is official.** Safe to run `git pull` (no backup/reclone required).

## Other files in `data/covidfact/`

Official repo contents include:

- `COVIDFACT_dataset.jsonl` — primary source
- `RTE-covidfact/`, `RTE-Fever/`, etc. — RTE train/dev/test TSVs (claim + evidence pairs, not KG triples)
- `doc_selection/`, `contrastive_gen/`, `evaluation/` — research scripts and eval artifacts

## Converted KG files

| Path | Found? |
|------|--------|
| `data/processed/covidfact_kg_experimental/` | No |
| `data/covidfact/triples.tsv` | No |
| Any validated OMNIA KG converter output | No |

RTE TSV files are **not** loadable as `(Head, Relation, Tail)` KG benchmarks.

## Pre-audit conclusion

- COVID-Fact source JSONL is **already present** from the official repository.
- Data looks **complete** (4,086 rows, valid JSON).
- **Not KG-loadable** without a validated converter.
- Next step: `git pull` to refresh, then format verification and backend status check.
