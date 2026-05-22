# OMNIA+: An Interactive Human-in-the-Loop System for LLM-based Knowledge Graph Completion

**Demo paper draft — CIKM 2026 submission**

---

## Abstract

Knowledge graphs (KGs) are rarely complete. Automated completion pipelines can propose missing triples, but practitioners need to understand and override model decisions before trusting additions. We present **OMNIA+**, an interactive demonstration system that combines structural candidate generation, embedding-based filtering, LLM semantic validation, and a human feedback loop. The demo exposes every pipeline stage through a dataset-first web interface: users select a benchmark or motivating example, inspect clustering and candidate provenance, review LLM evidence, submit accept/reject/uncertain/correct decisions, and compare the original KG against the completed KG side by side. OMNIA+ supports both offline static demonstration and live backend-connected sessions.

---

## 1. Introduction

Knowledge graph completion (KGC) aims to infer missing facts from an incomplete graph. Recent hybrid approaches combine graph structure, embedding models, and large language models (LLMs) to validate candidate triples. However, conference audiences and domain experts often cannot see *why* a triple was proposed or *how* to correct it.

OMNIA+ addresses this gap with a **transparent, step-driven demo** that mirrors the OMNIA research pipeline while keeping a human curator in the loop. The system is designed for live CIKM demonstration: a presenter selects a dataset, walks through seven workflow stages, submits feedback on a candidate triple, and shows the before/after KG comparison in real time.

**Contributions demonstrated:**
- Dataset-first landing with five curated examples (COVID-Fact running example + four benchmark samples).
- Restored paper-quality COVID-Fact graph visualization with fixed node positions.
- Side-by-side before/after KG comparison with provenance-labelled diff summary.
- Human feedback loop (accept / reject / uncertain / correct) with optional backend sync.

We do **not** claim online model retraining or full active-learning loops in this demo; feedback is recorded, exported, and applied to the completed KG view.

---

## 2. System Overview

OMNIA+ consists of a React/TypeScript frontend (`/paper-demo`) and a FastAPI backend (`/workbench`). The frontend can run fully offline using `localStorage`, or connect to a live backend session via `?sessionId=`.

### Architecture pipeline

```
Dataset Selection
    ↓
Original KG (incomplete)
    ↓
Clustering-based Candidate Generation
    ↓
Embedding Filtering (TransE distance threshold)
    ↓
LLM Validation (triple-based or sentence-based RAG)
    ↓
Human Feedback Policy Engine
    ↓
Completed KG + KG Diff + Feedback Log + Review Queue
```

*[Figure placeholder: architecture diagram — see `docs/architecture/omnia_demo_architecture.svg`]*

The backend wraps OMNIA modules for candidate generation (`candidates_generation`), TransE filtering (`candidates_filtering`), and LLM validation. All decisions are logged in an explainability trace accessible from the workbench.

---

## 3. Interaction Workflow

The demo follows eight steps aligned with the implemented UI:

| Step | UI label | What the audience sees |
| --- | --- | --- |
| 0 | Dataset Selection | Choose COVID-Fact (motivating example) or a benchmark sample; view entity/relation/triple counts and recommended RAG mode |
| 1 | Knowledge Graph | Original incomplete KG with fixed-position graph layout |
| 2 | Clustering | Relation-tail keyed clusters highlighted on the graph |
| 3 | Candidate Generation | Generated candidate edges overlaid (dashed orange) |
| 4 | Structural Filtering | TransE distance vs threshold; filtered candidates shown in red |
| 5 | Semantic Validation | LLM verdict, confidence, rationale, and retrieved RAG context |
| 6 | User Feedback | Curator submits accept / reject / uncertain / correct with reason and evidence judgement |
| 7 | Completed KG / Diff | Side-by-side before/after graphs + diff summary cards |

### 3.1 Dataset Selection

Five datasets are pre-configured:

| Dataset | Role | Best OMNIA F1 |
| --- | --- | --- |
| COVID-Fact | Motivating running example (Table I counts; not Table IV evaluation) | — |
| CoDEx-M — OMNIA experiment sample | Sentence-based RAG benchmark | 0.91 |
| FB15K-237 — OMNIA experiment sample | Triple-based RAG benchmark | 0.86 |
| WN18RR | Triple-based RAG (synset labels) | 0.87 |
| Socio-Economic (private) | Sparse private KG | 0.68 |

Counts for benchmark datasets follow OMNIA Table I experiment-sample sizes, not necessarily the full upstream repository totals.

### 3.2 Candidate Discovery

Candidates are generated from shared `(Relation, Tail)` clusters: if multiple heads share the same relation-tail pattern, missing head instances become candidate triples. The demo graph shows cluster boxes during the Clustering and Candidate Generation steps.

### 3.3 Structural Filtering

TransE scores each candidate with `||h + r − t||`. Candidates above the distance threshold are structurally filtered out (red dashed edges). The right stats panel shows the selected candidate's distance, threshold, and pass/fail status.

### 3.4 Semantic Validation

An LLM validates structurally plausible candidates using either **triple-based RAG** (FB15K-237, WN18RR) or **sentence-based RAG** (CoDEx-M, Socio-Economic, COVID-Fact). The User Feedback panel displays structural evidence, semantic evidence, and retrieved context before the curator decides.

### 3.5 Human Feedback and KG Refinement

Curators can:
- **Accept** — triple added to completed KG (`provenance: human_confirmed`)
- **Reject** — triple excluded (`provenance: human_rejected`)
- **Uncertain** — routed to review queue (`provenance: needs_expert_review`)
- **Correct** — original rejected, corrected triple added (`provenance: human_corrected`)

We do **not** claim online learning, model retraining, or automatic embedding/LLM updates. Human feedback drives **feedback-aware KG refinement**: the completed KG view, KG diff, review queue, and feedback log update immediately; threshold diagnostics are surfaced for a potential next iteration.

Feedback is saved locally immediately. When `?sessionId=` is present, it is also POSTed to `POST /api/sessions/{id}/feedback`.

---

## 4. Demonstration Scenario

**Recommended live path (COVID-Fact):**

1. Open `/paper-demo`, select **COVID-Fact**, click **Start Demo**.
2. Walk through Clustering → Candidate Generation → Structural Filtering → Semantic Validation.
3. Select candidate `cov-c1`: `(chloroquine, treats, sars-cov-2)`.
4. On **User Feedback**, click **Accept** with reason *correct* and evidence *evidence_supports*.
5. Open **Completed KG / Diff**:
   - Left graph: original KG without the chloroquine→sars-cov-2 edge.
   - Right graph: same KG with the edge in green.
   - Diff card "Added": `(chloroquine, treats, sars-cov-2)` · `human_confirmed`.
6. Export feedback JSON and completed KG TSV.

**Backend-connected variant:**

Open `/paper-demo?sessionId=<id>` after creating a session via `/workbench`. The status badge reads *"Live backend feedback connected"*. The same accept flow POSTs to the backend; exports are available at `/api/sessions/{id}/export/*`.

---

## 5. Implementation

| Layer | Technology | Key files |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind | `PaperDemoPage.tsx`, `GraphComparisonPanel.tsx`, `useFeedbackBridge.ts` |
| Static state | `localStorage` via `feedbackStore.ts` | Per-dataset feedback events, completed KG, diff |
| Backend | FastAPI, Pydantic, pandas | `main.py`, `feedback.py`, `pipeline.py` |
| Graph viz | SVG with fixed coordinates | `PaperCovidExampleGraph.tsx`, `BenchmarkMiniGraph.tsx` |
| LLM | Ollama (mistral) with mock fallback | Backend LLM service |

**Build status:** `npm run build` passes; `pytest` (17 tests) passes.

**Export capabilities:**
- Static: feedback JSON, completed KG TSV, KG diff JSON (client-side).
- Backend: feedback JSON, KG diff JSON/CSV, completed payload JSON. No dedicated backend completed-KG TSV endpoint.

---

## 6. Conclusion

OMNIA+ makes the OMNIA hybrid KGC pipeline inspectable and interactive. The dataset-first interface, restored COVID-Fact graph, benchmark mini-graphs, before/after comparison, and human feedback loop give conference audiences a concrete understanding of how structural reasoning, LLM validation, and human curation combine to complete a knowledge graph. Future work includes persistent feedback storage, batch curator workflows, optional threshold calibration from accumulated feedback, online active learning, and persistent multi-user feedback — **without online retraining of the embedding model or LLM in the current demo**.

---

## References

- OMNIA CIKM paper: [arxiv.org/abs/2603.11820v1](https://arxiv.org/abs/2603.11820v1)
- CoDEx benchmark: [github.com/tsafavi/codex](https://github.com/tsafavi/codex)
- FB15K-237 / WN18RR metadata: [github.com/villmow/datasets_knowledge_embedding](https://github.com/villmow/datasets_knowledge_embedding)
