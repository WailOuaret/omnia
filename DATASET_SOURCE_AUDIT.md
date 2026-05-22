# Dataset source audit

Date: 2026-05-22  
Purpose: document where each dataset value used by the OMNIA+ demo comes from, what the official upstream sources say, and how any discrepancies are handled in the UI.

The single source of truth in the UI is `frontend/src/demo-data/datasets.ts`. Every value displayed in `DatasetSelectorPanel`, `StepStatsPanel` and the bottom explanation pulls from this file.

---

## 1. Per-dataset audit table

| Dataset | UI value (this repo) | Source used | Notes |
| --- | --- | --- | --- |
| **COVID-Fact** | `entities = 1 416` · `relations = 28` · `triples = 908` · `role = "Running example / motivating demo"` · `bestF1 = none` | OMNIA CIKM paper, Table I (running example row) | COVID-Fact is described in the paper as the motivating running example, not part of Table IV evaluation. **No Best OMNIA F1 is shown**; a `note` is displayed explaining this so the user does not infer an F1 that the paper does not report. |
| **CoDEx-M** | `entities = 16 759` · `relations = 49` · `triples = 60 000` · `bestOmniaF1 = 0.91` · `recommendedMode = sentence-based RAG` · `label = "CoDEx-M — OMNIA experiment sample"` | OMNIA CIKM paper, Table I + Table IV row for OMNIA Sentences-RAG | The **official CoDEx repository** ([tsafavi/codex](https://github.com/tsafavi/codex)) reports different counts for the full CoDEx-M benchmark (CoDEx-M full split is ~17K entities / 51 relations / 206K triples depending on revision). The UI explicitly displays the OMNIA experiment-sample counts and warns the user with the `note` field: *"The official CoDEx repository reports different full benchmark counts; these are the OMNIA experiment-sample counts."* |
| **FB15K-237** | `entities = 12 993` · `relations = 29` · `triples = 59 270` · `bestOmniaF1 = 0.86` · `recommendedMode = triple-based RAG` · `label = "FB15K-237 — OMNIA experiment sample"` | OMNIA CIKM paper, Table I + Table IV. Textual metadata: [villmow/datasets_knowledge_embedding](https://github.com/villmow/datasets_knowledge_embedding) | The UI uses OMNIA experiment-sample counts and displays the `note`: *"Freebase-based benchmark; textual metadata may come from mapped sources, so use it with caution."* The graph only shows short labels; full Freebase paths are kept as `<title>` tooltips. |
| **WN18RR** | `entities = 40 943` · `relations = 11` · `triples = 93 003` · `bestOmniaF1 = 0.87` · `recommendedMode = triple-based RAG` | OMNIA CIKM paper, Table I + Table IV row for OMNIA Triple-RAG. Upstream: Dettmers et al. 2018, WN18RR derived from WordNet | The numbers match the standard WN18RR benchmark exactly. The UI displays a `warning`: *"Use triple-based validation because WordNet synset labels are difficult to verbalize reliably."* Synset labels (`dog.n.01`, `canine.n.02`, …) are wrapped to two lines inside the node circles. |
| **Socio-Economic** | `entities = 33 563` · `relations = 17 175` · `triples = 64 417` · `bestOmniaF1 = 0.678` (displayed `0.68`) · `publicStatus = private` · `recommendedMode = sentence-based RAG` | OMNIA CIKM paper, Table IV row for the OMNIA private socio-economic dataset | The previous demo erroneously displayed `0.84`. The value was corrected to **`0.678`** to match the paper. The UI displays a `warning`: *"Private / optional sparse dataset. Candidate generation is harder because structural patterns are less frequent."* The dataset is labeled "Socio-Economic (private)" everywhere and rendered with a `private` badge. |

---

## 2. Source vs UI matrix (concise)

| Dataset | OMNIA Table I (paper) | UI used | UI source label | Difference reconciled by |
| --- | --- | --- | --- | --- |
| COVID-Fact | 1 416 / 28 / 908 | 1 416 / 28 / 908 | `COVID-Fact` | identical |
| CoDEx-M | 16 759 / 49 / 60 000 | 16 759 / 49 / 60 000 | `CoDEx-M — OMNIA experiment sample` | label + `note` field clarifies "OMNIA experiment sample" |
| FB15K-237 | 12 993 / 29 / 59 270 | 12 993 / 29 / 59 270 | `FB15K-237 — OMNIA experiment sample` | label + `note` clarifies Freebase metadata caveat |
| WN18RR | 40 943 / 11 / 93 003 | 40 943 / 11 / 93 003 | `WN18RR` | identical; `warning` covers triple-RAG preference |
| Socio-Economic | 33 563 / 17 175 / 64 417 (F1 ≈ 0.68) | 33 563 / 17 175 / 64 417 (F1 0.678 → "0.68") | `Socio-Economic (private)` | F1 corrected from 0.84 to 0.678 |

---

## 3. CoDEx-M discrepancy in detail

- Official CoDEx repository: https://github.com/tsafavi/codex
- CoDEx-M full benchmark (per the README, latest release): roughly **17 050 entities · 51 relations · 206 205 triples** when train + valid + test + filtered splits are combined.
- OMNIA Table I reports **16 759 entities · 49 relations · 60 000 triples** for the CoDEx-M subset used in the OMNIA experiments.
- **Resolution in the UI**: we display the OMNIA experiment-sample counts (because Table IV F1 values are computed on these counts) and add an explicit `note`:
  > *"The official CoDEx repository reports different full benchmark counts; these are the OMNIA experiment-sample counts."*

This is intentional: the conference demo evaluates and visualizes the same sample OMNIA evaluated, not the entire CoDEx-M benchmark.

## 4. FB15K-237 / Freebase metadata caveat

- Original FB15K-237 paper: Toutanova & Chen, 2015 (Observed versus latent features for KG and text inference, ACL).
- Public benchmark splits typically report ~14 541 entities / 237 relations / 272 115 triples.
- Some repositories (for example `villmow/datasets_knowledge_embedding`) expose **textual entity metadata** for FB15K-237 mapped from Wikidata / DBpedia; this is *not* part of the original Freebase release and may have inconsistencies.
- **Resolution in the UI**: we use OMNIA experiment-sample counts in Table I (12 993 / 29 / 59 270), include the `note`:
  > *"Freebase-based benchmark; textual metadata may come from mapped Wikidata / DBpedia sources, so use it with caution."*
- Graph rendering converts every long Freebase path to a short readable label (`profession`, `institution`, `field`, `influence_on`, `subject_of`, `nationality`). The full path is preserved in the SVG `<title>` tooltip and in `edge.fullLabel`.

## 5. WN18RR caveat

- WordNet synset labels (`dog.n.01`, `canine.n.02`, `feline.n.01`, `mammal.n.01`, `domestic_animal.n.01`, …) carry part-of-speech and sense indices that LLMs cannot reliably verbalize as natural sentences.
- **Resolution in the UI**:
  - `recommendedMode = "triple-based RAG"`
  - `warning = "Use triple-based validation because WordNet synset labels are difficult to verbalize reliably."`
  - Node labels are rendered on two lines so the synset is readable.

## 6. Socio-Economic (private) F1 correction

| Field | Old value | Corrected value | Source |
| --- | --- | --- | --- |
| `bestF1` | `0.84` | `0.678` (displayed `0.68`) | OMNIA paper Table IV for the private socio-economic dataset |
| `label` | `Socio-Economic` | `Socio-Economic (private)` | match the paper's private dataset status |
| `warning` | weakened | strengthened: "Private / optional sparse dataset. Candidate generation is harder because structural patterns are less frequent." | paper's discussion of sparse-region limitations |

The previous `0.84` was a placeholder bug; the audit replaces it with the value reported in the paper.

---

## 7. Files touched as part of this audit

- `frontend/src/demo-data/types.ts` — added `note?: string`, `role?: string` to `DemoDatasetConfig`.
- `frontend/src/demo-data/datasets.ts` — applied the table above (counts, labels, notes, warnings, F1 corrections, removal of COVID-Fact F1).
- `frontend/src/components/paper-demo/DatasetSelectorPanel.tsx` — renders `role` and `note` underneath `bestF1`/`warning`.
- `frontend/src/components/paper-demo/StepStatsPanel.tsx` — renders `role` and `note` on the KG step.

No backend file required changes for this audit.
