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

### Real OMNIA dataset setup

One-command audit, clone, pull, and verification:

```shell
python scripts/setup_omnia_datasets.py
```

Audit only (no git changes):

```shell
python scripts/audit_omnia_datasets.py
```

Reports: `outputs/audits/dataset_audit_report.md`, `outputs/audits/dataset_setup_report.md`.

Full reference: [`docs/datasets.md`](docs/datasets.md).

**Expected layout after setup:**

```
data/
  codex/data/triples/codex-m/          # CoDEx-M train/valid/test
  datasets_knowledge_embedding/
    FB15k-237/
    WN18RR/
  covidfact/COVIDFACT_dataset.jsonl      # source JSONL (not KG triples)
```

**Official sources:**

| Dataset | Clone |
| --- | --- |
| CoDEx | `git clone https://github.com/tsafavi/codex.git data/codex` |
| FB15K-237 / WN18RR | `git clone https://github.com/villmow/datasets_knowledge_embedding.git data/datasets_knowledge_embedding` |
| COVID-Fact | `git clone https://github.com/asaakyan/covidfact.git data/covidfact` |

Verify backend discovery:

```shell
curl http://127.0.0.1:8000/api/samples
```

Create real benchmark sessions:

```shell
curl -X POST "http://127.0.0.1:8000/api/sessions/sample/omnia_codex_m?holdout_mode=true&sample_proportion=0.8"
curl -X POST "http://127.0.0.1:8000/api/sessions/sample/omnia_fb15k-237?holdout_mode=true&sample_proportion=0.8"
curl -X POST "http://127.0.0.1:8000/api/sessions/sample/omnia_wn18rr?holdout_mode=true&sample_proportion=0.8"
```

Open `http://localhost:5173/paper-demo?sessionId=<id>` — badge must read **Graph source: backend session slice**.

**Dataset limitations:**

- **Socio-Economic** — private LLM-generated KG; static/demo-only (no download).
- **COVID-Fact** — `COVIDFACT_dataset.jsonl` is claim/evidence JSONL (**4,086 rows verified**); backend reports `source_available: true`, `kg_loader_available: false`, `available: false`, `status_message: "Source JSONL available; KG converter pending."` Use the static COVID guided demo in `/paper-demo`.
- **UI counts** — the demo displays OMNIA paper statistics (e.g. CoDEx-M = 60,000 triples), not necessarily full public repository totals.
- **Bounded slices** — the UI never renders entire 60k+ triple graphs.

Legacy helper (pull only):

```shell
python scripts/setup_real_datasets.py
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
2. Select a dataset (COVID-Fact is recommended for demos, CoDEx-M for the benchmark story)
3. Click **Start Demo**
4. Step through the workflow:
   - Knowledge Graph → Clustering → Candidate Generation → Structural Filtering → Semantic Validation → User Feedback → Completed KG / Diff
5. In the feedback step, try at least one of each decision: Accept, Reject, Uncertain, Correct
6. Export feedback JSON, completed KG TSV, and KG diff JSON

For a printable demo-day checklist see [`DEMO_CHECKLIST.md`](DEMO_CHECKLIST.md).

## Human feedback scope

OMNIA+ currently uses human feedback to update the completed KG, KG diff, review queue, feedback log, and next-iteration diagnostics. It does **not** retrain the embedding model or LLM online. Online active learning and persistent multi-user feedback are future work.

## Live-mode hydration

When `/paper-demo` is opened with `?sessionId=<id>`, the frontend now hydrates from the backend on page load:

1. `GET /api/sessions/{id}` confirms the session exists.
2. `GET /api/sessions/{id}/feedback` populates the in-memory feedback list (server is authoritative).
3. `GET /api/sessions/{id}/completed` populates the completed-step counts and the threshold / agreement / prior diagnostics.

Submitting feedback in live mode does an optimistic write to `localStorage`, then `POST /api/sessions/{id}/feedback`, then re-hydrates `feedback` and `completed`. The UI renders the merged view (server wins on conflict, keyed by `candidateId` + latest `timestamp`).

If the session is not found, the page falls back to static mode and continues to work from `localStorage` so the demo never breaks.

## Completed-step statistics

The Completed KG / Diff step displays the **real** completed-KG count, not an arithmetic approximation:

- **Static mode:** `getCompletedKG(datasetId).length` from `frontend/src/stores/feedbackStore.ts`.
- **Live mode:** `summary.completed_triples` from `GET /api/sessions/{id}/completed`.

The right-side stats panel and the bottom "Completed KG" card both show the source of truth and the source label so what you see matches what `Export completed KG` would download.

Regression check:

```shell
cd frontend
npm run test:regression
```

This exercises an Accept + Correct + Reject sequence and asserts that the displayed completed count matches `getCompletedKG(datasetId).length`.

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

## Vercel deployment (frontend-only)

This repo is configured for a **frontend-only** Vercel deployment:

- **Build command:** `cd frontend && npm run build` (see root `vercel.json`)
- **Output directory:** `frontend/dist`
- **Entry route:** `/` redirects to `/paper-demo`

The hosted demo runs in **prepared/static scenario mode** when no backend is reachable. CoDEx-M, FB15K-237, and WN18RR require a local or deployed FastAPI backend (`python -m uvicorn backend.app.main:app --port 8000`) plus `VITE_API_BASE_URL` at build time for live sessions.

COVID-Fact and Socio-Economic always use static guided scenarios on Vercel. See [`outputs/reports/FINAL_DEMO_READINESS_REPORT.md`](outputs/reports/FINAL_DEMO_READINESS_REPORT.md) for teacher review notes.
