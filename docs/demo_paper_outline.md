# OMNIA Demo Paper Outline

## 1. Introduction

- Motivate knowledge graph completion as an operational problem, not only an offline benchmark.
- Position OMNIA as a hybrid pipeline that combines graph-structural propagation, embedding-based filtering, and LLM validation.
- State the demo goal: make each internal decision visible to an audience.

## 2. System Overview

- Describe the end-to-end pipeline:
  known KG ingestion, sparsity analysis, relation-tail clustering, candidate generation, TransE filtering, LLM validation, completed KG diff.
- Reference the architecture figure in `docs/architecture/omnia_demo_architecture.svg`.
- Emphasize the explainability log and guided demo mode.

## 3. Interaction Flow

- Landing and sample selection
- Upload and schema mapping
- KG overview with sparse/disconnected region inspection
- Cluster inspection
- Candidate provenance inspection
- TransE threshold inspection
- Prompt/context/decision inspection
- Completed KG diff

## 4. Technical Core

- Candidate generation from shared `(Relation, Tail)` keyed head clusters
- TransE scoring with `||h + r - t||`
- Threshold search using reduction-versus-coverage tradeoffs
- LLM validation modes:
  `triples` / `sentences`
  `zero` / `context` / `rag`
- RAG default `top-k = 2`

## 5. Demo Scenarios

- Sparse graph with weak clusters
- Well-supported cluster with plausible candidate propagation
- Filtering threshold adjustment
- Real Ollama run vs clearly labeled mock fallback
- Original KG vs completed KG comparison

## 6. Implementation Notes

- FastAPI backend wrapping real OMNIA modules
- React + TypeScript frontend with React Flow visualizations
- Ollama-backed local validation with `mistral`
- GPU-aware TransE path for RTX 4060

## 7. Takeaways

- The system demo shows what OMNIA is doing at every step.
- Sparse graphs expose operational limits rather than being hidden.
- The hybrid pipeline is inspectable enough for live demonstration and video narration.
