# Frontend ↔ backend feedback link audit

Date: 2026-05-22  
Goal: trace one candidate — `(chloroquine, treats, sars-cov-2)` — through every layer of the OMNIA+ feedback loop, prove the wiring is real (not just localStorage), and document where each piece of state lives.

## 1. Mode summary

The static `/paper-demo` page now has two clearly-labelled modes:

| Mode | When it activates | UI label (top-left badge) | Persistence |
| --- | --- | --- | --- |
| **Static demo** | the URL does not contain `?sessionId=` *or* the session is not found on the backend | "Static demo mode" (slate badge with a grey dot) | `localStorage` only |
| **Live backend feedback connected** | the URL contains `?sessionId=<id>` *and* `GET /api/sessions/<id>` succeeds | "Live backend feedback connected" (green badge with a green dot, amber dot if a sync fails) | `localStorage` first, then `POST /api/sessions/<id>/feedback` |

The badge is rendered by `PaperDemoPage` under the workflow menu and is driven by `useFeedbackBridge`.

## 2. End-to-end trace for `(chloroquine, treats, sars-cov-2)`

| Step | Layer | Symbol / endpoint | Verified? |
| --- | --- | --- | --- |
| 1 | Frontend dataset config | `DATASETS.covidFact.candidates[0]` (`candidateId: "cov-c1"`, head/relation/tail) | ✓ `frontend/src/demo-data/datasets.ts` |
| 2 | Deterministic candidate ID | `cov-c1` in the demo dataset; backend computes SHA1 via `feedback.make_candidate_id` for uploaded sessions | ✓ `backend/app/services/feedback.py` |
| 3 | LLM Validation step | candidate appears in `LlmStats` and is selectable in the candidate selector pill | ✓ `PaperDemoPage` `allCandidates` block |
| 4 | User Feedback step | `UserFeedbackPanel` is rendered with the selected candidate and shows structural evidence, semantic evidence, and RAG context **before** the decision buttons | ✓ `UserFeedbackPanel.tsx` |
| 5 | User clicks Accept | `onFeedbackSubmit(feedback)` → `feedbackBridge.submit(feedback)` | ✓ `PaperDemoPage.tsx` |
| 6 | Local persistence | `addFeedback(feedback)` writes to `localStorage` key `omnia_feedback_covidFact` | ✓ `frontend/src/stores/feedbackStore.ts` |
| 7 | Backend session detected | `useFeedbackBridge` previously verified via `api.getSession(sessionId)`; `mode === "live"` | ✓ `frontend/src/hooks/useFeedbackBridge.ts` |
| 8 | Backend POST | `POST /api/sessions/<sessionId>/feedback` with body `{candidate_id, Head, Relation, Tail, decision, reason, comment, corrected_triple?, user_confidence?, evidence_judgement?}` | ✓ `frontend/src/lib/api.ts` `postFeedback` |
| 9 | Backend storage | `feedback.record_feedback(session, body)` appends to `session.artifacts["feedback_events"]` and returns updated summary | ✓ `backend/app/services/feedback.py` |
| 10 | Pipeline integration | `pipeline.get_completed_payload(session)` calls `_apply_user_feedback` to merge feedback into the completed KG and adds `provenance` field (`human_confirmed` / `human_corrected` / `human_rejected` / `needs_expert_review`) | ✓ `backend/app/services/pipeline.py` |
| 11 | Completed step rendering | The Completed KG / Diff step renders `GraphComparisonPanel` (left = original KG, right = original + accepted + corrected). Diff summary shows the new edge under "Added — human_confirmed" | ✓ `frontend/src/components/paper-demo/GraphComparisonPanel.tsx` |
| 12 | Feedback export | `GET /api/sessions/<sessionId>/export/feedback.json` returns the full event list including this triple; client-side `exportFeedbackJSON` covers the static case | ✓ `backend/app/main.py`, `feedbackStore.ts` |
| 13 | KG diff export | `GET /api/sessions/<sessionId>/export/diff.json` returns `additions`, `removals`, `corrections` with this triple under additions | ✓ `backend/app/main.py` |
| 14 | Completed KG export | Static mode: `exportCompletedKGTSV` returns original known triples plus `(chloroquine, treats, sars-cov-2)`. Live mode: backend `/export/diff` + base KG produces equivalent output. | ✓ both layers |

## 3. Status-badge contract

`useFeedbackBridge` exposes:

| Field | Values | Used by |
| --- | --- | --- |
| `mode` | `"static" \| "live"` | badge background colour and label |
| `status` | `"idle" \| "syncing" \| "synced" \| "sync-failed"` | dot colour (amber when sync fails) |
| `lastMessage` | human-readable string | badge subtitle |
| `sessionId` | string from `?sessionId=` | exports also point to backend URLs when set |
| `submit(feedback)` | async — local first, backend second | called by `PaperDemoPage.onFeedbackSubmit` |

Failure semantics:
- If `api.getSession(sessionId)` rejects on mount, `mode` drops back to `"static"` and the badge says *"Session <id> not found on backend; using static demo mode."* — we **do not** claim live mode if the backend disagrees.
- If a `POST /feedback` fails after the session check passed, the user still sees their decision applied locally; the badge becomes *"Saved locally; backend sync failed."* (amber dot) without blocking the UI.

## 4. Backend acceptance tests covering this path

| Test (file: `tests/test_backend_units.py`) | What it proves |
| --- | --- |
| `test_feedback_accept_adds_triple_to_completed_kg` | After `record_feedback(decision="accept")`, `get_completed_payload` lists the triple under additions with `provenance="human_confirmed"`. |
| `test_feedback_reject_removes_llm_accepted_triple` | A reject decision removes an LLM-accepted triple from additions and adds it to removals. |
| `test_feedback_uncertain_puts_triple_in_unresolved` | An uncertain decision routes the triple into the review queue. |
| `test_feedback_correct_replaces_original_with_corrected` | A correct decision marks the original as rejected and the corrected triple as added with `provenance="human_corrected"`. |
| `test_feedback_export_endpoint_returns_json` | `/api/sessions/<id>/export/feedback.json` contains the event. |

All five pass in the latest `pytest` run.

## 5. Files that participate in the link

| File | Role |
| --- | --- |
| `frontend/src/components/paper-demo/UserFeedbackPanel.tsx` | shows structural + semantic + RAG evidence, captures the decision and reason. |
| `frontend/src/stores/feedbackStore.ts` | `addFeedback`, `getCompletedKG`, `getKGDiff`, `getSummary`, exports. |
| `frontend/src/hooks/useFeedbackBridge.ts` | mode detection + dual-write submit. |
| `frontend/src/lib/api.ts` | `api.getSession`, `api.postFeedback`, `api.getFeedback`, `api.exportFeedbackJsonUrl`, `postFeedback`. |
| `frontend/src/pages/PaperDemoPage.tsx` | wires the hook, renders the badge, calls `submit`. |
| `frontend/src/pages/DemoWorkbenchPage.tsx` | already-existing backend-connected page; it remains the canonical way to *create* a session. |
| `backend/app/main.py` | endpoints `POST /api/sessions/{id}/feedback`, `GET /api/sessions/{id}/feedback`, `GET /api/sessions/{id}/export/feedback.json`, `GET /api/sessions/{id}/export/diff`. |
| `backend/app/services/feedback.py` | `record_feedback`, `compute_feedback_effect`, `build_feedback_summary`, `calibrate_threshold_from_feedback`. |
| `backend/app/services/pipeline.py` | `_apply_user_feedback`, `get_completed_payload`. |
| `backend/app/models.py` | `FeedbackBody`, `CorrectedTriple`. |

## 6. Limitations

- The static demo route `/paper-demo` does not auto-create a session against the backend; users must obtain a session ID from `/workbench` (or any other ingestion path) and pass it via `?sessionId=`. This is intentional — the static demo is a stable conference artefact that must work offline.
- The status badge only verifies the session exists at mount time. If the backend disappears mid-session, the next `POST /feedback` is what surfaces the failure (amber dot).
- The five backend integration tests cover the per-decision contract. End-to-end browser tests against a live backend are recorded as manual QA steps in `MANUAL_FEEDBACK_QA.md`.
