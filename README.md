# OMNIA+

Interactive Knowledge Graph Completion with LLM Validation and Human Feedback.

## Project overview

This repository contains:

- `frontend`: React/TypeScript conference demo UI (`/paper-demo`)
- `backend`: FastAPI backend for candidate generation, filtering, LLM validation, and human feedback loop
- `experiment` / scripts: research utilities and offline experiments

## Installation

### Frontend

```shell
cd frontend
npm install
npm run dev
```

### Backend

**Important:** start the backend from the **repository root** so Python can resolve OMNIA modules (`candidates_generation`, etc.):

```shell
cd <repo-root>
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

## Backend sessions (prototype limitation)

Backend sessions are **in-memory**. Restarting the backend clears all sessions. This is acceptable for the conference prototype — **create a fresh session before each live presentation**.

Quick helper to create a demo session:

```shell
curl -X POST http://127.0.0.1:8000/api/demo/create-paper-session
```

Returns `{ "session_id": "...", "url": "/paper-demo?sessionId=..." }`. Open the URL in the browser for live backend feedback mode.

## Conference Demo Flow

1. Open `http://localhost:5173/paper-demo`
2. Select a dataset (COVID-Fact is recommended for demos)
3. Click **Start Demo**
4. Step through the workflow:
   - Knowledge Graph → Clustering → Candidate Generation → Structural Filtering → Semantic Validation → User Feedback → Completed KG / Diff
5. Export feedback JSON, completed KG TSV, and KG diff JSON

## Human feedback scope

OMNIA+ currently uses human feedback to update the completed KG, KG diff, review queue, feedback log, and next-iteration diagnostics. It does **not** retrain the embedding model or LLM online. Online active learning and persistent multi-user feedback are future work.

## Dataset Sources

- CoDEx: [tsafavi/codex](https://github.com/tsafavi/codex)
- FB15K-237 and WN18RR: [villmow/datasets_knowledge_embedding](https://github.com/villmow/datasets_knowledge_embedding)
- COVID-Fact: biomedical literature extraction (motivating running example; not Table IV evaluation)
- Socio-Economic: private LLM-generated KG (not public)

## Export Artifacts

### Static demo (`/paper-demo`, no `?sessionId=`)

From the Completed KG / Diff step (client-side / `localStorage`):

| Export button | Format |
| --- | --- |
| Export feedback JSON | All feedback events |
| Export completed KG | TSV: `head`, `relation`, `tail` |
| Export KG diff | JSON: added, rejected, corrected, review queue |

### Live backend mode (`/paper-demo?sessionId=<id>`)

Feedback syncs via `POST /api/sessions/{sessionId}/feedback`. Export buttons use backend URLs when `sessionId` is present:

| Endpoint | Content |
| --- | --- |
| `GET /api/sessions/{id}/export/feedback.json` | Full feedback event log |
| `GET /api/sessions/{id}/export/completed.tsv` | Completed KG TSV with `head`, `relation`, `tail`, `provenance` |
| `GET /api/sessions/{id}/export/diff` | KG diff JSON (`added`, `rejected`, `unresolved`) |
| `GET /api/sessions/{id}/export/diff.json` | Pipeline diff export |
| `GET /api/sessions/{id}/export/diff.csv` | Pipeline diff CSV |
| `GET /api/sessions/{id}/completed` | Completed payload JSON |

Completed TSV provenance values: `original`, `human_confirmed`, `human_corrected`, `llm_validated`. Rejected and review-queue triples are excluded.

## Responsive verification

With the frontend dev server running:

```shell
cd frontend
npm run verify:responsive
```

Captures screenshots at 1366×768 and 1920×1080 into `docs/screenshots/` and writes `RESPONSIVE_SCREENSHOT_REPORT.md`.

## CIKM Demo Video

[Video placeholder — will be added after recording]
