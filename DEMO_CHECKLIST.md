# OMNIA+ Demo Day Checklist

A printable, single-page checklist for the live conference demo. Aim for ~6 minutes total.

## Pre-flight (do this before the audience walks in)

| # | Step | Command |
|---|---|---|
| 1 | Start the backend from the repo root | `python -m uvicorn backend.app.main:app --reload --port 8000` |
| 2 | Start the frontend dev server | `cd frontend && npm run dev` |
| 3 | Create a fresh live session | `curl -X POST http://127.0.0.1:8000/api/demo/create-paper-session` |
| 4 | Open the live-mode URL in the browser | `http://localhost:5173/paper-demo?sessionId=<id>` |
| 5 | Confirm the badge top-left reads **"Live backend feedback connected"** (green dot) | — |
| 6 | Clear stale localStorage if you ran a previous static demo | DevTools → Application → Storage → Clear |

If anything fails to start, fall back to static mode by opening `/paper-demo` without `?sessionId=`. The demo still works end-to-end from `localStorage`.

## Live demo flow

| Check | Expected result |
|---|---|
| Open `/paper-demo` | Dataset picker appears first |
| Change dataset | Metadata, recommended mode, and the RAG-rationale tooltip update |
| Click **Start Demo** | Three-column layout: workflow menu (left), graph (center), step stats (right) |
| Walk Knowledge Graph → Completed KG / Diff | Each step changes the right-side stats panel correctly |
| Pick a candidate in feedback step | Four decisions visible: **Accept · Reject · Uncertain · Correct** |
| Submit **Accept** in live mode | Sync status shows; completed count and diff card both increment |
| Submit **Uncertain** | Review queue card increments |
| Submit **Correct** (edit at least one field) | Original triple appears in Rejected; corrected triple appears in Added |
| Try to submit **Correct** without changing any field | Validation error appears and submission is blocked |
| Switch to a different candidate while one is selected | Form fields reset to that candidate's values (head/relation/tail), or to its existing feedback if any |
| While **Syncing…** is shown on the submit button | Form inputs are disabled until the backend acknowledges |
| Download feedback JSON / completed TSV / diff JSON | Files download without errors |
| In live mode: refresh the page | Feedback list and completed counts persist (re-hydrated from `/feedback` and `/completed`) |

## Stats-panel sanity check (Completed KG / Diff step)

The right-side stats panel should show:

- **Original triples** — matches `summary.known_triples` (live) or the dataset baseline count (static)
- **Accepted additions** — matches your Accept + Correct count
- **Rejected candidates** — matches your Reject + (Correct → original rejected) count
- **Review queue** — matches your Uncertain count
- **Final triple count** — equals the row count of the file produced by **Export completed KG**
- **Source line** — explicitly shows whether the number came from the backend `/completed` endpoint or the static `getCompletedKG(datasetId).length`

If `Final triple count` does not equal the line count in the exported TSV, the demo is in a bad state and the count math has regressed. Run `npm run test:regression` to confirm.

## Backend diagnostics (live mode only)

In the right-side stats panel, the Backend diagnostics card surfaces (when available):

- Suggested threshold τ and its F1 (requires ≥5 accept/reject decisions)
- User-vs-LLM agreement rate
- Evidence-insufficient count
- Dataset accept rate (prior)

These come from `/api/sessions/{id}/completed → feedback_diagnostics / feedback_priors / suggested_threshold`.

## Verbal limitations to mention (preempt questions)

> "The interface demonstrates the full human-in-the-loop completion workflow. User feedback updates the completed KG, the diff, and the review queue, and the backend logs enriched feedback events for export. The current prototype does **not** retrain the embedding model or LLM online, and backend sessions are still in-memory, so for a live demo we create a fresh session each time."

## Backup commands

| Need | Command |
|---|---|
| Re-run backend regression tests | `python -m unittest discover -s tests -p "test_*.py"` |
| Re-run frontend completed-count regression | `cd frontend && npm run test:regression` |
| Re-run responsive layout verification | `cd frontend && npm run verify:responsive` |
| Build the frontend (catches TS errors) | `cd frontend && npm run build` |
