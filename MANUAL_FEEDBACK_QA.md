# Manual feedback QA checklist

Date: 2026-05-22

Two scenarios — *Static demo* (no backend) and *Backend connected* (`?sessionId=…`). Run them in this order to validate every code path covered by `useFeedbackBridge`, `feedbackStore`, and the backend feedback endpoints.

## A. Static demo (no backend)

1. Start the frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```
2. Open `http://localhost:5173/paper-demo`.
3. Under *Select dataset* choose **COVID-Fact**, then click **Start Demo**.
4. Confirm the badge in the left column reads **"Static demo mode"** with a grey dot.
5. Click **Semantic Validation** in the workflow menu.
6. In the *Candidates* selector pill click `cov-c1` (the chloroquine candidate).
7. Click **User Feedback** in the workflow menu. The `UserFeedbackPanel` should show:
   - Structural evidence card (distance, threshold, pass/fail badge),
   - Semantic evidence card (LLM verdict, confidence, rationale),
   - Retrieved RAG context list,
   - Decision buttons (Accept / Reject / Uncertain / Correct).
8. Click **Accept**. The badge subtitle becomes *"Saved locally (static demo mode)."*.
9. Click **Completed KG / Diff** in the workflow menu. Verify:
   - The *Before completion* graph does **not** contain `(chloroquine, treats, sars-cov-2)`.
   - The *After completion* graph shows the edge in thick green.
   - The "Added" diff card lists the triple with `provenance: human_confirmed`.
10. Click **Export feedback JSON**. The file `covidFact_feedback.json` should contain at least one event with `userDecision: "accept"`.
11. Click **Export KG diff**. The file `covidFact_kg_diff.json` should have the triple under `added`.
12. Click **Export completed KG**. The file `covidFact_completed_kg.tsv` should contain header `head\trelation\ttail` and the new triple in addition to the original known triples.

## B. Backend connected demo

1. Start the backend **from the repository root**:
   ```bash
   cd <repo-root>
   python -m uvicorn backend.app.main:app --reload --port 8000
   ```
2. Create a session:
   - **Option A:** `curl -X POST http://127.0.0.1:8000/api/demo/create-paper-session` and copy `session_id` from the JSON response.
   - **Option B:** Visit `/workbench`, pick a built-in sample, and copy the session ID from the URL/console.
3. Open `http://localhost:5173/paper-demo?sessionId=<session_id>`.
4. Confirm the badge reads **"Live backend feedback connected"** with a green dot.
5. Repeat steps 5–8 from scenario A (select `cov-c1`, accept it).
6. In the browser *Network* tab, verify `POST /api/sessions/<session_id>/feedback` returns 200.
7. `GET /api/sessions/<session_id>/feedback` — must include the event.
8. `GET /api/sessions/<session_id>/completed` — triple under additions with `provenance: human_confirmed`.
9. `GET /api/sessions/<session_id>/export/feedback.json` — must include the event.
10. `GET /api/sessions/<session_id>/export/diff` — triple under `added`.
11. `GET /api/sessions/<session_id>/export/completed.tsv` — must include `chloroquine	treats	sars-cov-2	human_confirmed` (if accepted) and rows with `original` provenance.

**Session note:** Backend sessions are in-memory. Restarting the backend requires creating a new session (step 2) before the live demo.

## C. Mixed scenarios (regression checks)

| Scenario | Expected outcome |
| --- | --- |
| Reject a candidate in scenario A | Badge subtitle says "Saved locally (static demo mode)". After graph does **not** add the edge. Diff card lists the triple under "Rejected — human_rejected". |
| Mark a candidate **Uncertain** | After graph still does not add the edge. Diff card lists the triple under "Review queue — needs_expert_review". |
| **Correct** a candidate (e.g. change relation) | After graph adds the corrected triple (purple). Original appears under "Rejected — human_rejected"; corrected appears under "Corrected — human_corrected" with a "replaces" note showing the original. |
| Backend session goes down mid-feedback (kill the backend then submit) | Local save still works; badge dot turns amber; badge subtitle reads "Saved locally; backend sync failed." Refreshing the page re-runs the session probe and may downgrade the mode to static. |
| Refresh the page with `?sessionId=<id>` but no backend running | Badge falls back to "Static demo mode" with subtitle "Session … not found on backend; using static demo mode." |

## D. Browser regression checklist

Automated option (frontend dev server must be running):

```bash
cd frontend
npm run verify:responsive
```

See `RESPONSIVE_SCREENSHOT_REPORT.md` and `docs/screenshots/1366/`, `docs/screenshots/1920/`.

Manual checklist:

| Width | Steps | Expected |
| --- | --- | --- |
| 1366 × 768 | Walk all 7 workflow steps | No horizontal scrollbars. Three-column layout for steps 1–6. Two-column layout on Completed step; comparison graphs stack vertically when the centre column drops below ~700 px. |
| 1920 × 1080 | Walk all 7 workflow steps | Comparison graphs side by side. Both visible without scrolling. Focus modal opens at ~95vh. |
| Mobile (375 px) | Open `/paper-demo` | Layout collapses to a single column. Dataset selector → graph → stats → explanation, in that order. |

## E. Datasets to spot-check

- **CoDEx-M**: confirm 8 nodes, `CX1` and `CX2` cluster boxes visible during Clustering, candidate pill list shows `cx-c1 … cx-c4`.
- **FB15K-237**: confirm short labels in the graph (`profession`, `field`, `institution`, etc.) and full Freebase paths in node/edge tooltips.
- **WN18RR**: confirm the warning banner *"Use triple-based validation because WordNet synset labels are difficult to verbalize reliably."* is visible on the KG step.
- **Socio-Economic**: confirm Best OMNIA F1 reads **0.68** (rounded from 0.678) and the *(private)* badge is visible.
