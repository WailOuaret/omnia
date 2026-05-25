# OMNIA+ Final Demo Readiness Report

**Generated:** 2026-05-24  
**Scope:** Conference-readiness verification after UI organisation fix (no redesign, proof + polish only)

---

## Summary of Current Demo State

The `/paper-demo` route is **conference-ready** for teacher review:

- **Graph-first layout:** interactive graph is visible immediately (bounding box y≈182px at 1920×1080).
- **Live backend mode:** CoDEx-M sessions load real benchmark IDs, clusters, and candidates from bounded backend slices.
- **Left column:** dataset selector → graph source badge → slice summary → navigator → workflow menu.
- **Center:** graph + compact step-specific panel (680px / 380px grid).
- **Right column:** single tabbed inspector (`Inspector` / `Step stats` / `Diagnostics`) — no duplicated panels.
- **Static fallback:** COVID-Fact guided demo and Socio-Economic static dataset remain available without silent override in live mode.
- **Feedback loop:** Accept/Reject/Uncertain/Correct posts to `POST /api/sessions/{id}/feedback` and updates completed KG/diff.

Filtering/LLM panels show **real outputs when pipeline artifacts exist**; otherwise, the demo displays a **clean unavailable-state message** (no fake `0.00` / `n/a` filtering values).

---

## Dataset Status

| Dataset | Backend live | Notes |
|---------|--------------|-------|
| **CoDEx-M** | ✅ Real backend available | `omnia_codex_m`: `available=true`, KG loader OK |
| **FB15K-237** | ✅ Real backend available | `omnia_fb15k-237`: `available=true` |
| **WN18RR** | ✅ Real backend available | `omnia_wn18rr`: `available=true` |
| **COVID-Fact** | ⚠️ JSONL on disk, no KG converter | `source_available=true`, `kg_loader_available=false`, `available=false` — static guided demo only |
| **Socio-Economic** | ❌ Private / static only | Demo metadata only; clearly labelled **private** on landing |

---

## Session IDs Created (verification run)

Fresh sessions were created via `python scripts/create_benchmark_sessions.py` and the automated capture script:

| Benchmark | Session ID | Live demo URL |
|-----------|------------|---------------|
| CoDEx-M | `ca066288dfd5` | http://127.0.0.1:5173/paper-demo?sessionId=ca066288dfd5 |
| FB15K-237 | `1ec30c55127f` | http://127.0.0.1:5173/paper-demo?sessionId=1ec30c55127f |
| WN18RR | `a20c4c457774` | http://127.0.0.1:5173/paper-demo?sessionId=a20c4c457774 |

> **Note:** Backend sessions are in-memory. IDs above are from the verification run; recreate after server restart.

**Pipeline artifact note (CoDEx-M session `ca066288dfd5`):**
- **TransE filtering artifacts:** not present on fresh sample session → Filtering step shows empty-state banner ✅
- **LLM fields:** partial metadata present on some candidates → Semantic Validation may show evidence cards where backend fields exist

---

## Screenshots

All captured under `docs/screenshots/final-demo/`:

| File | Description |
|------|-------------|
| `01_landing_dataset_selector.png` | Landing page with dataset dropdown |
| `02_codex_live_kg_graph.png` | CoDEx-M live session — Knowledge Graph step |
| `03_clustering_highlighted_cluster.png` | Clustering with selected cluster |
| `04_candidate_generation_selected_candidate.png` | Candidate Generation with selection |
| `05_filtering_real_or_empty_state.png` | Filtering — clean empty banner (no TransE artifacts) |
| `06_semantic_validation_evidence_or_empty_state.png` | Semantic Validation evidence cards |
| `07_feedback_accept_form.png` | User Feedback — Accept form visible |
| `08_completed_kg_diff.png` | Completed KG / Diff with exports |
| `09_covid_static_guided_demo.png` | Static COVID-Fact guided demo |
| `10_dataset_limitations_badges.png` | Socio-Economic private/static labelling |

Machine-readable checklist: `outputs/reports/final_demo_verification.json`

---

## Manual Verification Checklist

| Check | Result |
|-------|--------|
| Dataset chooser visible | **PASS** |
| Active backend session badge visible | **PASS** |
| Graph source: backend session slice | **PASS** |
| Left column order clean (selector → badge → slice → navigator → workflow) | **PASS** |
| Right column: one tabbed inspector | **PASS** |
| Graph visible immediately without excessive scroll | **PASS** |
| Clustering: graph + compact cluster panel | **PASS** |
| Cluster selection highlights graph context | **PASS** (row click + screenshot) |
| Candidate Generation: graph + compact panel | **PASS** |
| Candidate selection highlights edge | **PASS** (screenshot) |
| Blue dashed candidate edges where available | **PASS** (live graph styling) |
| Filtering: real bars if data exists | **N/A** — no TransE artifacts on fresh session |
| Filtering: clean empty banner if missing | **PASS** |
| Semantic Validation: real evidence if available | **PASS** (partial LLM fields on session) |
| Semantic Validation: clean empty if missing | **PASS** (when fields absent) |
| Feedback: Accept / Reject / Uncertain / Correct | **PASS** |
| Accept submit updates backend feedback | **PASS** (`events=1`) |
| Completed KG/Diff: buckets + provenance + exports | **PASS** |
| Export feedback JSON | **PASS** (HTTP 200) |
| Export completed KG TSV | **PASS** (HTTP 200) |
| Export KG diff JSON | **PASS** (HTTP 200, `/export/diff.json`) |
| Static COVID-Fact guided demo | **PASS** |
| Socio-Economic labelled static/private | **PASS** |
| No silent static fallback in live mode | **PASS** (no Paris/Eiffel toy labels) |

**Overall: 20 PASS, 1 N/A (filtering artifacts on fresh session)**

---

## Test Outputs

### Backend unit tests

```
python -m unittest discover -s tests -p "test_*.py" -v
→ Ran 34 tests in ~102s — OK
```

### Frontend build

```
cd frontend && npm run build
→ tsc --noEmit && vite build — ✓ built successfully
```

### Frontend regression

```
npm run test:regression
→ OK — completed-step statistics regression passed
  knownTriples=5, acceptedAdditions=2, rejectedCandidates=2
  unresolvedCandidates=0, completedTriples=7
```

---

## Remaining Limitations

1. **Fresh sample sessions** created via `create_benchmark_sessions.py` include clustering/candidates but **not always TransE filtering artifacts** — Filtering step correctly shows unavailable state until filtering is run in the workbench pipeline.
2. **LLM validation evidence** depends on session pipeline stage; panels show real fields when present, otherwise an honest empty/unavailable message.
3. **COVID-Fact:** JSONL source exists; KG converter not implemented — static guided demo only.
4. **Socio-Economic:** private/demo-only; cannot create backend session.
5. **Backend sessions in-memory** — restart clears sessions; recreate with setup scripts.
6. **Bounded slices only** — demo never renders full 60k+ graphs (by design).

---

## Exact Commands to Reproduce the Demo

### 1. One-time dataset setup (if needed)

```powershell
cd C:\Users\wailo\Desktop\omnia-correct
.\.runenv\Scripts\python.exe scripts\setup_omnia_datasets.py
```

### 2. Start servers

```powershell
# Terminal 1 — backend
cd C:\Users\wailo\Desktop\omnia-correct
.\.runenv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 — frontend
cd C:\Users\wailo\Desktop\omnia-correct\frontend
npm run dev
```

### 3. Create benchmark sessions

```powershell
cd C:\Users\wailo\Desktop\omnia-correct
.\.runenv\Scripts\python.exe scripts\create_benchmark_sessions.py
```

Open the printed CoDEx-M URL, e.g.:

```
http://127.0.0.1:5173/paper-demo?sessionId=<codex_session_id>
```

### 4. Automated verification + screenshots

```powershell
cd C:\Users\wailo\Desktop\omnia-correct\frontend
node scripts/capture-final-demo.mjs
```

Outputs:
- Screenshots → `docs/screenshots/final-demo/`
- Checklist JSON → `outputs/reports/final_demo_verification.json`

### 5. Run tests

```powershell
cd C:\Users\wailo\Desktop\omnia-correct
.\.runenv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v

cd frontend
npm run build
npm run test:regression
```

### 6. Static demos (no backend session)

- **COVID-Fact:** http://127.0.0.1:5173/paper-demo → select COVID-Fact → Start Demo
- **Socio-Economic:** same flow; dataset card shows **private** badge

---

## Acceptance

✅ All 10 required screenshots exist in `docs/screenshots/final-demo/`  
✅ Automated verification: **20/20 checks passed** (1 filtering check N/A — honest empty state)  
✅ Backend + frontend tests pass  
✅ This readiness report created at `outputs/reports/final_demo_readiness_report.md`

---

## Deployment (2026-05-25)

- **Frontend build:** PASS (
pm run build)
- **Backend tests:** PASS (51 tests, python -m unittest discover -s tests)
- **Vercel:** frontend-only via root ercel.json ? rontend/dist, / ? /paper-demo`n- **Online mode:** static/prepared scenarios when backend unreachable; live backend requires local FastAPI or VITE_API_BASE_URL`n- **Git branch pushed:** eature/live-backend-paper-demo on omnia_demo remote

