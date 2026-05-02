# OMNIA Demo System - Full Technical Explanation

## 1. Project Goal

OMNIA originally appears in this repository as a Python-based knowledge graph completion workflow composed of scripts and helper modules. Its main responsibilities were:

- generating candidate triples from relation-tail based head clusters,
- filtering candidates with a TransE embedding model through PyKEEN,
- validating candidates with an LLM using zero-shot, context, or RAG prompting,
- and computing evaluation metrics from `Score:` outputs.

From repository inspection, the original project was centered on script execution and experiment logic rather than on an interactive system demonstration. There was no API layer, no browser UI, no guided demo mode, no persistent page-to-page state for audience walkthroughs, and no explicit graph-inspection experience for sparse/disconnected structure.

The new demo system adds a full application layer around that logic so that a user can:

1. load or upload a knowledge graph,
2. inspect graph sparsity and disconnected components,
3. inspect relation-tail clustering,
4. inspect generated candidate triples and provenance,
5. inspect embedding filtering behavior,
6. inspect LLM validation inputs and outputs,
7. inspect the completed KG diff,
8. and narrate the flow in a guided presentation mode.

This makes the work a **system demonstration** rather than only a benchmark script because the final product exposes the **operational steps** of OMNIA as a user-facing application:

- KG ingestion,
- sparsity analysis,
- cluster formation,
- candidate propagation,
- embedding filtering,
- LLM validation,
- completed-KG reconstruction.

The supported user journey is:

`Upload or select KG -> inspect graph structure -> inspect clusters -> inspect generated candidates -> inspect filtering -> inspect validation -> inspect completed KG diff -> explain results`

## 2. High-Level Summary of What Was Done

The repository was extended in six major ways.

### Backend added

A FastAPI backend was added under `backend/app/`. It wraps the existing OMNIA Python logic in HTTP endpoints for:

- dataset preview and validation,
- session creation,
- graph overview and component focus,
- cluster summaries and scoped cluster graphs,
- candidate generation,
- TransE filtering,
- LLM validation,
- completed KG diff export,
- and baseline comparisons.

### Frontend added

A React + TypeScript + Vite frontend was added under `frontend/`. It provides dedicated pages for:

- landing,
- ingestion,
- overview,
- pipeline,
- clusters,
- candidates,
- filtering,
- validation,
- completed KG,
- comparisons,
- guided demo.

### Orchestration added

The backend introduced session-based orchestration around the legacy OMNIA modules. The session tracks:

- the uploaded dataset,
- canonicalized triples,
- held-out missing triples,
- pipeline artifacts,
- step state,
- logs,
- warnings,
- and generated outputs.

### Guided demo added

A guided-demo page was added to present the system in a recording-friendly sequence, with step text, keyboard navigation, and links into the live pages.

### Architecture/docs added

The repository now includes:

- an architecture figure in SVG and PNG,
- a demo paper outline,
- a demo video script,
- a QA report,
- authoritative benchmark clones (CoDEx / villmow) via `omnia_*` samples,
- and stable setup/run scripts.

### Legacy pipeline fixes added

Several legacy OMNIA files were repaired or extended so the system can run through the UI:

- `README.md` and `omnia.py` were aligned,
- `omnia_top_k.py` was repaired,
- candidate generation gained provenance fields,
- filtering was made GPU-safe and `wandb`-optional,
- LLM validation gained deterministic mock fallback,
- and result parsing/threshold logic was hardened for demo-mode edge cases.

### Testing and run scripts added

The repository now includes:

- unit tests,
- backend HTTP integration tests,
- frontend Playwright E2E tests,
- a stable backend launcher,
- and an SPA static server for built frontend routing.

## 3. Original Repository vs New Demo System

| Area | Original repo | New demo system |
| --- | --- | --- |
| Execution style | Python scripts and experiment helpers | Full web application with backend API plus frontend |
| UI | No user-facing UI found from repository inspection | React application with 11 routes/pages |
| API | No HTTP API | FastAPI service in `backend/app/main.py` |
| Orchestration | Mostly file/script based | Session-based orchestration with cached artifacts and step tracking |
| KG upload | CSV/script input expected | Upload and preview for CSV, TSV, JSON, and `.txt`-CSV |
| Column mapping | Implicit script assumption | Explicit preview, alias guessing, manual mapping UI |
| Graph overview | Not exposed as a page | Graph stats, component summaries, focused component view |
| Sparse diagnostics | Not exposed visually | Density, isolated nodes, connected components, sparsity score, warnings |
| Clustering inspection | Internal logic only | Cluster list, selected cluster subgraph, full component scope, 1-hop scope |
| Candidate provenance | Candidate triples generated, but provenance not exposed as UI data | Provenance attached to candidate rows and displayed in table/detail views |
| Filtering inspection | Filtering existed in code | Threshold diagnostics, histogram, accepted/rejected counts, per-candidate distances |
| LLM inspection | LLM evaluation existed in code | Prompt, retrieved context, raw response, parsed score, final decision shown in UI |
| Completed KG diff | Not exposed as demo page | Completed KG summary, additions, rejected/unresolved tables, CSV/JSON export |
| Demo support | No guided narration layer | Guided Demo page plus landing-page architecture preview |
| Explainability log | Not exposed | Persistent bottom drawer showing step logs and warnings |
| Large-dataset handling | Script-side only | Summary-first overview, lazy component/cluster focus, graph truncation warnings |
| Testing | Limited or absent app-level coverage | Unit tests, backend API integration tests, Playwright E2E tests |
| Docs | README plus research-oriented artifacts | README, paper outline, video script, QA report, architecture figure |

## 4. Full Repository Structure After Changes

The repository now consists of two layers:

1. the **legacy OMNIA core**,
2. the **demo-system wrapper** around it.

Runtime-generated folders such as `.runenv`, `.omnia_demo_cache`, and local server log files also exist in the working directory, but they are environment artifacts rather than part of the logical code architecture.

### Readable structure

```text
README.md
requirements-demo.txt
omnia.py
omnia_top_k.py

candidates_generation/
  triple_gen.py

candidates_filtering/
  triple_filter.py
  embedding/
    get_emb_transe.py
    train_model.py

experiment/
  preprocess.py
  filtering.py
  prep_llm.py
  result.py

backend/
  app/
    __init__.py
    config.py
    main.py
    models.py
    store.py
    services/
      __init__.py
      analytics.py
      ingestion.py
      pipeline.py

frontend/
  package.json
  package-lock.json
  playwright.config.ts
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  index.html
  public/
    architecture/
      omnia_demo_architecture.svg
      omnia_demo_architecture.png
    favicon.svg
  e2e/
    demo-system.spec.ts
  src/
    App.tsx
    main.tsx
    index.css
    types.ts
    vite-env.d.ts
    lib/
      api.ts
      hooks.ts
    store/
      session.ts
    components/
      common/
      graph/
      layout/
      pipeline/
      tables/
      charts/
    pages/
      LandingPage.tsx
      IngestionPage.tsx
      OverviewPage.tsx
      PipelinePage.tsx
      ClustersPage.tsx
      CandidatesPage.tsx
      FilteringPage.tsx
      ValidationPage.tsx
      CompletedPage.tsx
      BaselinesPage.tsx
      GuidedDemoPage.tsx

Benchmark triples — clone with `scripts/clone_true_datasets.ps1` into gitignored `external_data/`:

- CoDEx: `external_data/codex` (train/valid/test `.txt` under `data/triples/<dataset>/`)
- FB/WN etc.: `external_data/datasets_knowledge_embedding` (villmow standard KGE layout)

API sample ids use prefix `omnia_` (see `GET /api/samples`). Custom KGs: upload via **Upload KG**.

docs/
  architecture/
    omnia_demo_architecture.svg
    omnia_demo_architecture.png
  demo_paper_outline.md
  demo_video_script.md
  qa_report.md
  screenshots/
    README.md

scripts/
  clone_true_datasets.ps1
  setup_demo.ps1
  run_demo.ps1
  run_backend_server.py
  serve_frontend.py

tests/
  test_demo_backend.py
  test_backend_units.py
  test_backend_api.py
```

### Folder roles

#### Legacy core OMNIA files

These files contain the core pipeline logic that existed conceptually before the demo wrapper:

- relation-tail clustering and candidate generation,
- TransE training and scoring,
- threshold filtering,
- LLM prompt execution,
- metric calculation,
- and CLI execution.

#### `backend/`

This folder is the FastAPI wrapper around the core OMNIA logic. It turns the script-oriented pipeline into a session-based service the frontend can call repeatedly.

#### `frontend/`

This folder is the user-facing demo application. It contains routing, page components, graph rendering, tables, charts, persisted session state, and Playwright E2E coverage.

#### `external_data/` (local clones)

Authoritative benchmark splits (CoDEx, villmow/datasets_knowledge_embedding) are cloned here and gitignored. After `scripts/clone_true_datasets.ps1`, the backend lists them as `omnia_*` samples. For ad hoc demos, upload a CSV instead of relying on fixtures.

#### `docs/`

This folder contains materials for presentation and submission:

- architecture figure,
- paper outline,
- video script,
- QA report,
- screenshot placeholder.

#### `scripts/`

These scripts provide reproducible setup and stable Windows-friendly launch paths for the backend and built frontend.

#### `tests/`

This folder contains Python-side unit and integration tests for the backend and session/pipeline behavior.

## 5. All Files That Were Modified

From current repository inspection, the following pre-existing files are modified in the working tree. The classification is based on the current `git status`, not on hidden historical commits.

### `README.md`

**What it did before**

The README documented the project, but it was inconsistent with the actual CLI and the later demo runtime path.

**What changed**

- It now documents the OMNIA demo system instead of only script usage.
- It explicitly explains real OMNIA code reuse.
- It documents `.runenv`-based setup and run commands.
- It documents backend API routes.
- It explains real-vs-mock behavior.
- It documents verified build/test commands.

**Why it was needed**

The original README/CLI mismatch was one of the stated repository problems. The demo also required exact operator steps for setup, launch, and verification.

**Effect now**

The README now matches the actual commands, runtime architecture, and demo story.

### `omnia.py`

**What it did before**

This file was the main CLI entrypoint for OMNIA, but it assumed a narrower file-based workflow.

**What changed**

- Added orchestration helpers:
  - `_triple_key`
  - `_missing_mask`
  - `orchestrate_candidates`
  - `evaluate_candidates_df`
  - `run_pipeline`
- `run_pipeline` now supports end-to-end generation when `--cand_path` is omitted.
- CLI now accepts both `--data_path` and `--path` through:
  - `parser.add_argument("--data_path", "--path", dest="data_path", ...)`
- Added flags for:
  - `--sample_proportion`
  - `--disable_filtering`
  - `--preferred_device`
  - `--model_name`
  - `--mock_llm`

**Why it was needed**

The demo system cannot assume candidate CSVs already exist. It needs end-to-end orchestration from KG input to evaluated outputs.

**Effect now**

`omnia.py` works both as a repaired CLI and as a script-level orchestration reference for the backend wrapper.

### `omnia_top_k.py`

**What it did before**

The user explicitly identified it as broken because it referenced an undefined `path` variable.

**What changed**

- Replaced with a working top-k runner.
- Added `parse_top_k_values`.
- Loops over `top_k_values` and calls `omnia.run_pipeline(...)`.
- Writes per-run outputs into `top_k_{k}` directories.
- Writes summary CSV: `"{setting}_rag_top_k_summary.csv"`.
- Supports both `--data_path` and `--path`.

**Why it was needed**

The old file could not be used for reproducible RAG top-k evaluation.

**Effect now**

The file is a functioning evaluation helper aligned with the repaired CLI.

### `candidates_generation/triple_gen.py`

**What it did before**

It already contained the core clustering logic:

- `extract_unique_rel_tail`
- `extract_head_cluster`
- `generate_combination_cluster`
- `generate_all_candidates`

**What changed**

- Added `extract_relation_tail_clusters(df)` to return structured cluster metadata:
  - `cluster_id`
  - `cluster_key`
  - `relation`
  - `tail`
  - `heads`
  - `size`
  - `warning`
- Added `generate_candidate_records(df)` to attach provenance and lifecycle fields:
  - `cluster_ids`
  - `cluster_keys`
  - `source_heads`
  - `cluster_sizes`
  - `provenance`
  - `rationale`
  - `status_generated`
  - `status_duplicate_existing`
  - `status_sent_to_filter`

**Why it was needed**

The demo requires explanation of **where candidates came from**, not only raw triple rows.

**Effect now**

Candidate generation is still based on real OMNIA clustering logic, but the outputs are now rich enough for UI provenance and explainability.

### `experiment/preprocess.py`

**What it did before**

It created experimental splits and evaluation dataframes from CSV input.

**What changed**

- Added `split_known_missing(df, sample_proportion, random_state)` for direct in-memory splitting.
- Added `create_experiment_df_from_df(...)` so the same logic can run on DataFrames rather than only file paths.
- `create_experiment_df(path, ...)` now delegates to the new DataFrame-based helper.

**Why it was needed**

The backend session layer operates in memory and needs reusable split logic without forcing file reloading.

**Effect now**

The original evaluation split concept is preserved and exposed to the UI.

### `experiment/filtering.py`

**What it did before**

It trained TransE, scored candidates, and applied threshold search.

**What changed**

- `train_transe_embedding(...)` now returns metadata including:
  - model name,
  - embedding dimension,
  - optimizer,
  - learning rate,
  - epochs,
  - resolved device.
- Added `score_candidates(...)`.
- Added `evaluate_thresholds(...)`.
- Added `run_filter_pipeline(...)` as the main backend-friendly wrapper.
- Training now receives:
  - `preferred_device`
  - `use_wandb`

**Why it was needed**

The frontend filtering page requires:

- per-candidate distances,
- threshold diagnostics,
- model metadata,
- runtime-friendly orchestration.

**Effect now**

Filtering is reusable as a backend service and preserves the real TransE filtering behavior.

### `experiment/prep_llm.py`

**What it did before**

It already supported:

- `triples` or `sentences`,
- `zero`, `context`, `rag`,
- retriever creation through LangChain/FAISS,
- and model scoring.

**What changed**

- Reworked LLM calls to use `ollama.Client` directly.
- Kept `create_retriever(file_path, top_k=2)` with default top-k of 2.
- Added explicit prompt builder functions:
  - `_build_triple_prompt`
  - `_build_sentence_prompt`
- Added deterministic mock fallback:
  - `mock_llm_response`
- Strengthened sentence conversion prompt in `triple2sentence(...)`:
  - "only transform the triple into a sentence"
  - "do not rephrase incorrect facts"
  - "do not use negative constructions"
- `evaluate_candidates(...)` now stores auditable fields:
  - `triple_text`
  - `sentence_text`
  - `retrieved_context`
  - `prompt`
  - `raw_response`
  - `parsed_score`
  - `decision`
  - `is_mock`

**Why it was needed**

The demo requires inspection of the exact LLM inputs and outputs, not just final labels.

**Effect now**

The LLM stage is both demo-friendly and resilient. It still uses the real OMNIA prompting modes, but now exposes them cleanly and supports deterministic fallback.

### `experiment/result.py`

**What it did before**

It parsed score strings and computed evaluation metrics.

**What changed**

- Added `parse_score(text)` with safe fallback to `-1`.
- Added `_safe_div(...)`.
- `compute_score(...)` now uses safe division to avoid zero-division failures.
- `extract_score(...)` tolerates missing input via `text or ""`.

**Why it was needed**

Demo-mode evaluation and baseline calculations must not crash on missing or malformed score strings.

**Effect now**

Metrics are safer and can be computed reliably from UI-driven runs.

### `candidates_filtering/triple_filter.py`

**What it did before**

It filtered candidates by distance thresholds and chose a best threshold.

**What changed**

- `compute_coverage(...)` now returns `0.0` when `missing_df` is empty.
- Added `get_threshold_diagnostics(...)` to compute:
  - threshold,
  - accepted count,
  - rejected count,
  - coverage,
  - reduction ratio,
  - score.

**Why it was needed**

Two reasons:

1. raw-upload mode without held-out truth should not fail,
2. the filtering page needs threshold-comparison diagnostics for explanation.

**Effect now**

Threshold behavior is inspectable in the UI and safe in no-ground-truth sessions.

### `candidates_filtering/embedding/get_emb_transe.py`

**What it did before**

It extracted embeddings and computed `||h + r - t||`.

**What changed**

Tensor extraction now uses:

- `.detach().cpu().numpy()`

instead of a direct `.numpy()` path on model tensors.

**Why it was needed**

GPU tensors on CUDA cannot be converted to NumPy arrays directly.

**Effect now**

TransE scoring works on CUDA-backed runs such as the RTX 4060 path.

### `candidates_filtering/embedding/train_model.py`

**What it did before**

It built PyKEEN triples factories and executed training pipelines.

**What changed**

- Added `resolve_device(preferred_device)` to select CPU/GPU safely.
- Moved PyKEEN imports inside functions for lazy import behavior:
  - `from pykeen.triples import TriplesFactory`
  - `from pykeen.pipeline import pipeline`
- Added `preferred_device` and `use_wandb` to `create_pipeline(...)`.
- Disables wandb by default with:
  - `os.environ.setdefault("WANDB_DISABLED", "true")`
- Uses `tracker=None` unless explicitly enabled.

**Why it was needed**

This avoids startup/import issues and prevents `wandb` from blocking demo runs.

**Effect now**

TransE training is more robust for backend/server use and GPU-safe by default.

## 6. All Files That Were Added

The working tree contains many newly added files. The list below focuses on project files that form the demo system, not runtime-generated artifacts such as `.runenv`, `.omnia_demo_cache`, or local server logs.

### Backend files

#### `backend/app/__init__.py`

Marks `backend.app` as a Python package.

#### `backend/app/config.py`

Central demo constants:

- repo and cache paths,
- benchmark repo roots for CoDEx + villmow (`external_data/`),
- graph rendering thresholds,
- default LLM configuration.

#### `backend/app/main.py`

FastAPI entrypoint exposing all demo HTTP routes.

#### `backend/app/models.py`

Defines the `DemoSession` dataclass and `STEP_ORDER`.

#### `backend/app/store.py`

In-memory session registry and helpers for:

- step initialization,
- step updates,
- event logging.

#### `backend/app/services/__init__.py`

Marks the services package.

#### `backend/app/services/ingestion.py`

Dataset reading, previewing, canonicalization, sample loading, and session creation.

#### `backend/app/services/analytics.py`

Graph analytics, component decomposition, summary graph construction, and cluster-focus graph construction.

#### `backend/app/services/pipeline.py`

Pipeline orchestration service for:

- candidate generation,
- filtering,
- validation,
- completed KG,
- comparisons,
- diff export.

### Frontend files

#### Root/frontend config files

- `frontend/package.json`
  project manifest, dependencies, scripts
- `frontend/package-lock.json`
  dependency lockfile
- `frontend/index.html`
  Vite HTML shell
- `frontend/vite.config.ts`
  Vite config, dev/preview proxy to backend
- `frontend/tailwind.config.ts`
  theme colors, fonts, shadows
- `frontend/postcss.config.js`
  Tailwind + Autoprefixer setup
- `frontend/tsconfig.json`
  TypeScript config
- `frontend/tsconfig.node.json`
  TS config for node-side Vite/Playwright files
- `frontend/playwright.config.ts`
  E2E runner config with backend/frontend web servers

#### Public assets

- `frontend/public/architecture/omnia_demo_architecture.svg`
- `frontend/public/architecture/omnia_demo_architecture.png`
  copies of the architecture figure served to the browser
- `frontend/public/favicon.svg`
  app icon

#### Frontend app entry

- `frontend/src/App.tsx`
  route table for all pages
- `frontend/src/main.tsx`
  React app boot with `BrowserRouter`
- `frontend/src/index.css`
  main visual system, Tailwind layers, graph styling
- `frontend/src/types.ts`
  shared TypeScript contracts for session, graph, cluster, candidate payloads
- `frontend/src/vite-env.d.ts`
  Vite typing shim

#### Frontend integration helpers

- `frontend/src/lib/api.ts`
  frontend API client and base-URL resolution
- `frontend/src/lib/hooks.ts`
  `useApiData` and `useSessionSummary`
- `frontend/src/store/session.ts`
  Zustand persisted state for active session, logs, guided step, and demo config

#### Reusable components

- `frontend/src/components/common/StatusBadge.tsx`
- `frontend/src/components/common/StatCard.tsx`
- `frontend/src/components/common/LoadingState.tsx`
- `frontend/src/components/common/EmptyState.tsx`
- `frontend/src/components/common/ErrorState.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/PageHeader.tsx`
- `frontend/src/components/layout/LogDrawer.tsx`
- `frontend/src/components/graph/KGGraph.tsx`
- `frontend/src/components/pipeline/PipelineFlow.tsx`
- `frontend/src/components/charts/Histogram.tsx`
- `frontend/src/components/tables/CandidatesTable.tsx`

These make the UI modular instead of page-specific monoliths.

#### Page files

- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/pages/IngestionPage.tsx`
- `frontend/src/pages/OverviewPage.tsx`
- `frontend/src/pages/PipelinePage.tsx`
- `frontend/src/pages/ClustersPage.tsx`
- `frontend/src/pages/CandidatesPage.tsx`
- `frontend/src/pages/FilteringPage.tsx`
- `frontend/src/pages/ValidationPage.tsx`
- `frontend/src/pages/CompletedPage.tsx`
- `frontend/src/pages/BaselinesPage.tsx`
- `frontend/src/pages/GuidedDemoPage.tsx`

Each page corresponds to one stage or viewpoint in the system demonstration.

#### Frontend tests

- `frontend/e2e/demo-system.spec.ts`
  end-to-end audience-order walkthrough

### Docs

- `docs/demo_paper_outline.md`
  ACM demo paper planning notes
- `docs/demo_video_script.md`
  recording/narration script
- `docs/qa_report.md`
  QA coverage, failures, fixes, limitations
- `docs/architecture/omnia_demo_architecture.svg`
- `docs/architecture/omnia_demo_architecture.png`
  architecture assets stored in docs
- `docs/screenshots/README.md`
  placeholder note for final screenshots

### Benchmark data (local clones)

- Shallow-clone CoDEx and villmow KGE repos (`scripts/clone_true_datasets.ps1`); samples appear as `omnia_*` via `GET /api/samples`.
- For a tiny walkthrough without cloning, use **Upload KG** with a small triple CSV.

### Scripts

- `scripts/setup_demo.ps1`
  prepares Python and frontend environment
- `scripts/run_demo.ps1`
  launches backend and built frontend
- `scripts/run_backend_server.py`
  stable backend launcher with Windows event loop handling
- `scripts/serve_frontend.py`
  SPA static server with deep-route fallback

### Tests

- `tests/test_demo_backend.py`
  smoke tests for canonicalization and core mock flow
- `tests/test_backend_units.py`
  backend/service unit tests
- `tests/test_backend_api.py`
  subprocess-backed backend integration tests

### Architecture assets

The architecture figure is intentionally duplicated in two places:

- `docs/architecture/`
  for documentation/submission assets
- `frontend/public/architecture/`
  so the landing page can display it directly

## 7. Backend Architecture

The backend uses **FastAPI** and is organized as a thin application wrapper around the legacy OMNIA modules.

### Framework used

- FastAPI for HTTP routing and OpenAPI docs
- Pydantic models are not used heavily here; instead the backend relies on plain dict responses and a `DemoSession` dataclass
- `python-multipart` is used for file upload handling

### App entrypoint

The backend app entrypoint is:

- `backend/app/main.py`

It creates the `FastAPI` application and mounts CORS middleware with permissive settings for demo use.

### Config handling

`backend/app/config.py` centralizes:

- repo and benchmark-data paths,
- cache directory,
- graph rendering thresholds,
- default top-k,
- default LLM limit,
- default model name.

Important constants:

- `MAX_GRAPH_TRIPLES = 350`
- `LARGE_DATASET_WARNING_THRESHOLD = 2000`
- `DEFAULT_SAMPLE_PROPORTION = 0.8`
- `DEFAULT_TOP_K = 2`
- `DEFAULT_LLM_LIMIT = 24`
- `DEFAULT_MODEL_NAME = "mistral"`

### Models/schemas

`backend/app/models.py` defines the session dataclass:

- `DemoSession`

Its important fields are:

- `uploaded_df`
- `pipeline_source_df`
- `known_df`
- `missing_df`
- `diagnostics`
- `warnings`
- `logs`
- `steps`
- `artifacts`

It also defines `STEP_ORDER`, which controls the visible pipeline sequence:

1. `kg_loaded`
2. `sparsity_analysis`
3. `relation_tail_clustering`
4. `candidate_generation`
5. `transe_filtering`
6. `llm_validation`
7. `completed_kg`

### State/session/store behavior

The backend is stateful in memory.

`backend/app/store.py` provides:

- `SESSIONS`
  global in-memory dictionary of session id to `DemoSession`
- `new_session_id()`
- `put_session(session)`
- `get_session(session_id)`
- `log_event(...)`
- `init_steps(session)`
- `update_step(...)`

This means the backend currently behaves as a demo server rather than as a persistent multi-user production system. Sessions are kept in process memory.

### Service layer

#### `ingestion.py`

Responsible for:

- reading uploads,
- guessing column mapping,
- canonicalizing to `Head/Relation/Tail`,
- dropping malformed rows,
- deduplicating rows,
- creating sessions,
- loading CoDEx / villmow benchmark samples (`omnia_*`),

#### `analytics.py`

Responsible for:

- computing graph stats with NetworkX,
- decomposing connected components,
- building summary graphs for large datasets,
- building focused component graphs,
- building cluster summaries,
- building cluster-scope subgraphs.

#### `pipeline.py`

Responsible for:

- checking Ollama availability,
- generating and caching candidates,
- running filtering,
- running LLM validation,
- computing completed KG payloads,
- exporting diffs,
- computing comparison baselines,
- running the full pipeline end to end.

### API endpoints

The backend routes are all in `backend/app/main.py`.

### 7.1 Backend Request Flow

The backend request flow is:

1. The frontend sends an HTTP request using `frontend/src/lib/api.ts`.
2. `backend/app/main.py` receives it and resolves the session if needed.
3. The route delegates to one of the service modules:
   - `ingestion`
   - `analytics`
   - `pipeline`
4. The service module calls legacy OMNIA functions when needed:
   - `triple_gen`
   - `preprocess`
   - `filtering`
   - `prep_llm`
   - `result`
5. The service updates:
   - `session.steps`
   - `session.logs`
   - `session.artifacts`
6. The route returns a JSON payload or export text.
7. The frontend renders the returned payload on the corresponding page.

### 7.2 Backend Endpoints

| Endpoint | Method | Purpose | Main code path | Output |
| --- | --- | --- | --- | --- |
| `/api/health` | `GET` | backend health plus Ollama status | `main.health -> pipeline.ollama_status` | status + Ollama metadata |
| `/api/samples` | `GET` | list benchmark samples (`omnia_*`, after clone) | `main.list_samples -> ingestion.list_samples` | sample list |
| `/api/datasets/preview` | `POST` | preview uploaded file before session creation | `main.preview_dataset -> ingestion.read_upload -> ingestion.build_preview` | row/column preview + guessed mapping |
| `/api/sessions/upload` | `POST` | create session from uploaded file | `main.create_session_from_upload -> ingestion.create_session_from_dataframe` | session summary |
| `/api/sessions/sample/{sample_id}` | `POST` | create session from benchmark id (`omnia_*`) | `main.create_session_from_sample -> ingestion.create_session_from_sample` | session summary |
| `/api/sessions/{session_id}` | `GET` | get session summary | `main.get_session_summary` | session summary |
| `/api/sessions/{session_id}/logs` | `GET` | get explainability log | `main.get_logs` | log list |
| `/api/sessions/{session_id}/overview` | `GET` | get graph stats and summary graphs | `main.get_overview -> analytics.build_overview_payload` | uploaded/known stats + summary graphs |
| `/api/sessions/{session_id}/components/{component_id}` | `GET` | get focused component graph | `main.get_component_focus -> analytics.build_component_focus_payload` | component summary + graph |
| `/api/sessions/{session_id}/clusters` | `GET` | get cluster summaries | `main.get_clusters -> analytics.build_cluster_payload` | cluster list + summary |
| `/api/sessions/{session_id}/clusters/{cluster_id}` | `GET` | get selected cluster/component/neighborhood graph | `main.get_cluster_focus -> analytics.build_cluster_focus_payload` | cluster detail + graph |
| `/api/sessions/{session_id}/candidates` | `GET` | get candidate generation payload | `main.get_candidates -> pipeline.get_candidates_payload` | candidate rows + summary |
| `/api/sessions/{session_id}/filter` | `POST` | run filtering or fetch filter results | `main.get_filtering -> pipeline.get_filter_payload` | filter metadata, distances, candidates |
| `/api/sessions/{session_id}/llm` | `POST` | run validation or fetch validation results | `main.get_llm_validation -> pipeline.get_llm_payload` | validation summary + annotated candidates |
| `/api/sessions/{session_id}/completed` | `GET` | get completed KG diff | `main.get_completed -> pipeline.get_completed_payload` | summary + additions/rejected/unresolved |
| `/api/sessions/{session_id}/comparisons` | `GET` | compute baseline comparisons | `main.get_comparisons -> pipeline.get_comparison_payload` | baseline cards |
| `/api/sessions/{session_id}/pipeline/run` | `POST` | execute full end-to-end flow | `main.run_pipeline -> pipeline.run_full_pipeline` | step list + final summary |
| `/api/sessions/{session_id}/export/diff.csv` | `GET` | export additions as CSV | `main.export_diff_csv -> pipeline.export_diff_csv` | CSV text |
| `/api/sessions/{session_id}/export/diff.json` | `GET` | export additions as JSON | `main.export_diff_json -> pipeline.export_diff_json` | JSON text |

## 8. Frontend Architecture

The frontend is a React + TypeScript single-page application built with Vite.

### Framework and language

- React 18
- TypeScript
- React Router

### Build tooling

- Vite for build and dev server
- TypeScript compiler for type checking
- Playwright for E2E

### Styling system

The frontend uses **Tailwind CSS plus custom global CSS layers**.

This is important because the repository contains both:

- `tailwind.config.ts`
  for theme values,
- and `src/index.css`
  for project-specific component classes such as `.panel`, `.nav-link`, and React Flow skinning.

So the actual styling approach is:

- Tailwind utility classes in JSX,
- plus custom CSS tokens and component layers in `index.css`.

### State management

State is stored with Zustand in `frontend/src/store/session.ts`.

Persisted fields include:

- `session`
- `logs`
- `guidedStep`
- `demoConfig`

`demoConfig` currently holds:

- `format`
- `strategy`
- `topK`
- `maxCandidates`
- `filteringEnabled`
- `forceMock`

### Page structure

Routes are defined in `frontend/src/App.tsx` and rendered inside `AppShell`.

The current routes are:

- `/`
- `/ingest`
- `/overview`
- `/pipeline`
- `/clusters`
- `/candidates`
- `/filtering`
- `/validation`
- `/completed`
- `/baselines`
- `/guided-demo`

### Reusable UI composition

The layout follows a consistent structure:

- top heading through `PageHeader`,
- left navigation through `AppShell`,
- center content area for page-specific data,
- bottom-right explainability drawer through `LogDrawer`.

This is not exactly the user's suggested "top bar + left sidebar + right drawer + bottom drawer" everywhere, but the current implementation captures most of the same intent:

- sidebar navigation,
- central main content,
- detail panels next to graphs,
- persistent bottom explainability drawer.

### Graph and pipeline visualization

#### Graph visualization

`frontend/src/components/graph/KGGraph.tsx` uses `@xyflow/react` with:

- Dagre layout for node-level graphs,
- grid layout for summary/supernode mode,
- zoom-based disclosure,
- hover-based edge labels,
- minimap,
- fit-view controller,
- visible-element-only rendering.

#### Pipeline visualization

`frontend/src/components/pipeline/PipelineFlow.tsx` uses React Flow to show pipeline stages as a linear timeline with status-colored boxes.

### API integration

`frontend/src/lib/api.ts` contains a thin fetch client.

Important behavior:

- `resolveApiBase()` automatically points frontend requests to port `8000` when the UI is running on another local port such as `5173` or `4173`.

This matters because it fixes the earlier problem where uploads could hit the static frontend server instead of the FastAPI API.

### 8.1 Frontend Page-by-Page Explanation

#### `LandingPage.tsx`

**What the user sees**

- project introduction,
- runtime health box,
- architecture preview,
- sample datasets,
- buttons for upload and guided demo.

**What data it requests**

- `api.health()`
- `api.listSamples()`

**What actions are possible**

- open upload page,
- open guided demo,
- create a session from a benchmark sample id (`omnia_*`) or uploaded file.

**Backend calls**

- `GET /api/health`
- `GET /api/samples`
- `POST /api/sessions/sample/{sample_id}`

**Why this page exists**

It gives the audience immediate orientation, setup status, and a one-click entry path.

#### `IngestionPage.tsx`

**What the user sees**

- upload controls,
- holdout toggle,
- sampling limit,
- sample proportion slider,
- preview panel,
- column mapping UI,
- parsed row preview.

**What data it requests**

- `api.previewDataset(file)`
- `api.createUploadSession(...)`

**What actions are possible**

- preview file,
- map columns,
- create session.

**Backend calls**

- `POST /api/datasets/preview`
- `POST /api/sessions/upload`

**Why this page exists**

It turns script-side assumptions into a visible ingestion step the audience can understand.

#### `OverviewPage.tsx`

**What the user sees**

- stats cards,
- component list,
- graph canvas,
- selected component details,
- sparse-region notes,
- toggle between uploaded KG and known KG,
- toggle between summary view and focused component view.

**What data it requests**

- `api.getOverview(sessionId)`
- `api.getComponentGraph(sessionId, graphMode, componentId)`

**What actions are possible**

- switch between uploaded/known graph,
- switch between summary/component view,
- choose a component,
- inspect sparse/disconnected structure.

**Backend calls**

- `GET /api/sessions/{id}/overview`
- `GET /api/sessions/{id}/components/{component_id}`

**Why this page exists**

It answers "where is the graph sparse or disconnected?" before the candidate-generation story begins.

#### `PipelinePage.tsx`

**What the user sees**

- end-to-end run button,
- controls for format/strategy/top-k/batch size,
- toggles for filtering and mock mode,
- pipeline flow diagram,
- per-step cards showing counts, runtimes, and explanations.

**What data it requests**

- none automatically beyond session summary refresh
- it actively triggers `api.runPipeline(...)`

**What actions are possible**

- configure the run,
- launch the full flow,
- inspect stage outputs after completion.

**Backend calls**

- `POST /api/sessions/{id}/pipeline/run`
- followed by `GET /api/sessions/{id}`

**Why this page exists**

It exposes the pipeline as a sequence rather than hiding it behind one opaque action.

#### `ClustersPage.tsx`

**What the user sees**

- cluster list,
- search box,
- scope buttons,
- focused graph canvas,
- shared key summary,
- shared/source triples,
- relation-tail pairs,
- cluster and component details.

**What data it requests**

- `api.getClusters(sessionId)`
- `api.getClusterGraph(sessionId, clusterId, scope)`

**What actions are possible**

- choose cluster,
- search clusters,
- switch scope between:
  - selected cluster only,
  - full component,
  - 1-hop neighborhood,
- reset focus.

**Backend calls**

- `GET /api/sessions/{id}/clusters`
- `GET /api/sessions/{id}/clusters/{cluster_id}?scope=...`

**Why this page exists**

This is the explanation page for **why entities are in the same cluster**.

#### `CandidatesPage.tsx`

**What the user sees**

- candidate generation summary,
- candidate table with search/filtering,
- provenance and rationale per row.

**What data it requests**

- `api.getCandidates(sessionId)`

**What actions are possible**

- inspect status,
- filter by status,
- search triple content.

**Backend calls**

- `GET /api/sessions/{id}/candidates`

**Why this page exists**

It explains **how a candidate triple was generated** and how it moves through the pipeline.

#### `FilteringPage.tsx`

**What the user sees**

- model metadata,
- threshold,
- device,
- accepted/rejected counts,
- histogram,
- threshold candidate buttons,
- candidate table with distances/decisions.

**What data it requests**

- `api.getFilter(sessionId, params)`

**What actions are possible**

- run filtering,
- apply a custom threshold,
- click a suggested threshold.

**Backend calls**

- `POST /api/sessions/{id}/filter`

**Why this page exists**

It explains **why a triple passed or failed TransE filtering**.

#### `ValidationPage.tsx`

**What the user sees**

- validation config controls,
- explicit MOCK banner when relevant,
- stats cards,
- candidate table,
- expandable explain blocks showing:
  - prompt,
  - retrieved context,
  - raw response.

**What data it requests**

- `api.getLlm(sessionId, params)`

**What actions are possible**

- re-run validation,
- switch format or strategy,
- change top-k,
- change candidate limit,
- toggle force-mock.

**Backend calls**

- `POST /api/sessions/{id}/llm`

**Why this page exists**

It makes the LLM stage auditable instead of magical.

#### `CompletedPage.tsx`

**What the user sees**

- summary cards,
- additions table,
- rejected table,
- unresolved table,
- CSV/JSON export links.

**What data it requests**

- `api.getCompleted(sessionId)`

**What actions are possible**

- inspect accepted additions,
- inspect rejected/unresolved rows,
- export the diff.

**Backend calls**

- `GET /api/sessions/{id}/completed`
- `GET /api/sessions/{id}/export/diff.csv`
- `GET /api/sessions/{id}/export/diff.json`

**Why this page exists**

It answers **what changed after OMNIA completed the KG**.

#### `BaselinesPage.tsx`

**What the user sees**

- baseline cards for OMNIA full, filtering-only, LLM-only, and disabled KG-BERT adapter.

**What data it requests**

- `api.getComparisons(sessionId, params)`

**What actions are possible**

- inspect baseline counts and metrics.

**Backend calls**

- `GET /api/sessions/{id}/comparisons`

**Why this page exists**

It shows that the system is not hiding alternative variants or unavailable baselines.

#### `GuidedDemoPage.tsx`

**What the user sees**

- narration steps,
- current step panel,
- previous/open/next controls,
- recording notes,
- keyboard instructions.

**What data it requests**

- no backend request is required on load
- it uses persisted session data and route navigation

**What actions are possible**

- step through the narration,
- jump to a live page,
- use keyboard arrows.

**Backend calls**

- none directly

**Why this page exists**

It makes the system easy to present live or in a recording.

### 8.2 Reusable Components

#### `StatusBadge`

Maps statuses like `accepted`, `rejected`, `filtered out`, `pending`, `ready`, and `disabled` to consistent visual tones.

#### `StatCard`

Reusable metric card used across overview, filtering, validation, and completed pages.

#### `LoadingState`

Standard loading panel to avoid blank pages during async work.

#### `EmptyState`

Standard empty-state card for pages without an active session or without data yet.

#### `ErrorState`

Standard error-state card that renders backend or UI failures clearly.

#### `AppShell`

Global layout with:

- left navigation,
- dataset summary card,
- page outlet,
- log drawer.

#### `LogDrawer`

Persistent bottom-right explainability drawer that shows recent pipeline events from the backend log.

#### `KGGraph`

Main graph renderer with:

- Dagre layout,
- summary-node grid layout,
- zoom-based detail levels,
- hover-only edge labels,
- minimap,
- controls,
- fit-view on selection changes.

#### `PipelineFlow`

Compact pipeline diagram showing the ordered OMNIA stages and their current status.

#### `Histogram`

Recharts-based distribution view for TransE candidate distances.

#### `CandidatesTable`

Shared candidate table with:

- search,
- status filtering,
- triple text,
- status badge,
- cluster column,
- distance column,
- and optional expandable explain blocks for prompt/context/raw response.

## 9. End-to-End Data Flow

This section describes the actual end-to-end flow implemented in the repository.

### Numbered sequence

1. The user loads a sample dataset or uploads a file from the landing/ingestion page.
2. The backend reads the file in `ingestion.read_upload()` or a sample in `ingestion.create_session_from_sample()`.
3. The dataset is previewed with guessed column mapping and raw row diagnostics.
4. The backend canonicalizes the data to `Head`, `Relation`, `Tail` using `canonicalize_dataframe(...)`.
5. If holdout mode is enabled, the backend splits the canonical graph into:
   - `known_df`
   - `missing_df`
   using `preprocess.split_known_missing(...)`.
6. A `DemoSession` is created and stored in memory.
7. The overview page requests graph analytics. The backend computes:
   - density,
   - average degree,
   - connected components,
   - isolated nodes,
   - sparsity score
   using `analytics.compute_graph_stats(...)`.
8. The overview service computes connected components and creates component-summary supernodes for large datasets.
9. The clusters page requests relation-tail clusters. The backend calls `triple_gen.extract_relation_tail_clusters(...)`.
10. The candidate generation page requests candidates. The backend calls `triple_gen.generate_candidate_records(...)`.
11. Candidates are deduplicated logically into:
   - `candidates_df`
   - `filterable_df`
   and are annotated with provenance, duplicate-existing status, and `Missing` labels when holdout truth exists.
12. The filtering page requests TransE filtering. The backend calls:
   - `experiment.filtering.run_filter_pipeline(...)`
   which internally calls
   - `train_model.create_pipeline(...)`
   - `get_emb_transe.get_list_dist(...)`
   - `triple_filter.filter_best_threshold(...)`
13. The validation page requests LLM evaluation. The backend calls:
   - `prep_llm.create_retriever(...)` when strategy is `rag`
   - `prep_llm.evaluate_candidates(...)`
14. `prep_llm.evaluate_candidates(...)` stores the prompt, retrieved context, raw model response, parsed score, and final decision for each candidate.
15. If Ollama is unavailable or the request fails, the backend downgrades to deterministic mock behavior and labels it as mock.
16. The completed page requests the final diff. The backend merges accepted additions into `known_df` and returns:
   - additions,
   - rejected,
   - unresolved,
   - completed graph summary.
17. The comparisons page computes filtering-only, OMNIA-full, and LLM-only variants against the held-out truth when available.
18. The guided demo page helps present the same flow in a clean order.

### ASCII diagram

```text
User upload/sample
        |
        v
Ingestion + preview
        |
        v
Canonical Head/Relation/Tail dataframe
        |
        +--> holdout split -> known_df + missing_df
        |
        v
Graph analytics
  - stats
  - connected components
  - sparse warnings
        |
        v
Relation-tail clustering
        |
        v
Candidate generation with provenance
        |
        v
TransE filtering
  - distance scores
  - threshold search
        |
        v
LLM validation
  - zero/context/rag
  - prompt
  - retrieved context
  - raw response
  - parsed score
        |
        v
Accepted additions
        |
        v
Completed KG diff + export + comparisons
```

## 10. Real OMNIA Logic vs Wrapper / Demo Logic

| Functionality | Real existing OMNIA code | New wrapper/demo code | Notes |
| --- | --- | --- | --- |
| Relation-tail clustering | `candidates_generation/triple_gen.py` | `backend/app/services/analytics.py` exposes cluster summaries and focus payloads | Core logic is real OMNIA; response shaping is new |
| Candidate generation | `triple_gen.generate_all_candidates`, `generate_candidate_records` | `backend/app/services/pipeline.py::ensure_candidates` | Provenance enrichment is now part of OMNIA-side helper output |
| Held-out split | `experiment/preprocess.py` | `backend/app/services/ingestion.py` calls it during session creation | Real split logic wrapped for UI sessions |
| TransE training | `experiment/filtering.py`, `train_model.py`, `get_emb_transe.py`, `triple_filter.py` | `pipeline.run_filtering`, filtering endpoint, filtering page | Real OMNIA filtering is executed through API |
| Threshold diagnostics | `candidates_filtering/triple_filter.py` | filtering page UI | Diagnostics method was added to support the demo |
| LLM prompt execution | `experiment/prep_llm.py` | validation endpoint + validation page | Real logic, but now auditable and fallback-aware |
| Score parsing and metrics | `experiment/result.py` | comparison payloads and completed-page summaries | Real metrics reused in new places |
| CLI execution | `omnia.py`, `omnia_top_k.py` | backend server does not use CLI directly | CLI still exists and was repaired |
| Graph stats and components | No dedicated original API/UI layer found | `backend/app/services/analytics.py` | New wrapper/demo logic |
| Session/state management | No app session layer found | `backend/app/models.py`, `store.py` | New wrapper/demo logic |
| HTTP API | No API found | `backend/app/main.py` | New wrapper/demo logic |
| Frontend | No frontend found | `frontend/` | New wrapper/demo logic |
| Guided demo | No guided demo mode found | `GuidedDemoPage.tsx` | Demo convenience layer |
| Explainability log | No persistent UI log found | `store.py` + `LogDrawer.tsx` | Demo convenience and traceability |
| Mock fallback | Heuristic fallback logic added in `prep_llm.py` | backend chooses mock based on Ollama status or failures; UI labels it | Explicitly labeled, not hidden |
| KG-BERT comparison | Not wired | `pipeline.get_comparison_payload` returns disabled placeholder | Honest placeholder, not a fake baseline |

## 11. Libraries, Tools, and Frameworks Used

### FastAPI

Used for the backend API. It provides:

- routing,
- request parsing,
- file upload handling,
- and interactive API docs at `/docs`.

### React

Used for the frontend UI. It manages routing, page composition, and reusable components.

### TypeScript

Used to type frontend payloads and component props. The shared contracts are mainly in `frontend/src/types.ts`.

### Vite

Used for frontend build and development server behavior. `vite.config.ts` also proxies `/api` requests to the backend during dev/preview.

### Tailwind CSS

Used as the frontend styling system together with custom global CSS. Theme tokens are defined in `tailwind.config.ts`, and app-specific layered classes are defined in `frontend/src/index.css`.

### PyKEEN

Used for training the TransE embedding model in the filtering stage.

### Ollama

Used to run the local LLM validation stage. The backend checks the local daemon through `http://127.0.0.1:11434/api/tags` and calls the native Ollama Python client.

### Mistral

The default model name is `"mistral"`. It is the default validation model used by the demo when Ollama is available.

### FAISS

Used in `experiment/prep_llm.py` for the RAG vector store.

### LangChain

Used in the LLM preparation layer for:

- `CSVLoader`
- `HuggingFaceEmbeddings`
- `SemanticChunker`
- `FAISS`

### NetworkX

Used in `backend/app/services/analytics.py` to compute:

- connected components,
- graph density,
- isolates,
- graph traversal for neighborhood views.

### `@xyflow/react`

Used for interactive graph and pipeline visualization in the browser.

### `@dagrejs/dagre`

Used to compute stable graph layouts for entity-level graphs.

### Recharts

Used for the TransE distance histogram.

### Zustand

Used for persisted frontend state:

- active session,
- logs,
- guided step,
- demo config.

### Playwright

Used for browser E2E testing of the demo flow.

### `requests`

Used in the backend to probe Ollama availability.

### `sentence-transformers`

Installed for the HuggingFace embedding model used in RAG retrieval.

### `scripts/run_backend_server.py`

Custom launcher used because the Windows runtime path in this environment needed:

- a stable selector event loop,
- and explicit repo-root insertion in `sys.path`.

### `scripts/serve_frontend.py`

Custom static SPA server used to serve the built frontend with deep-link fallback. This is important for route refresh stability.

## 12. Detailed Explanation of the Main Bug Fixes

### 12.1 README / CLI mismatch

**Problem**

The README used `--path`, while `omnia.py` expected `--data_path` and `--cand_path`.

**Where**

- `README.md`
- `omnia.py`

**Why it happened**

Documentation and CLI behavior drifted apart.

**Fix**

`omnia.py` now accepts:

```python
parser.add_argument("--data_path", "--path", dest="data_path", ...)
```

The README was also rewritten to document the real command set.

**Result**

Both the legacy alias and the explicit argument work, and the documentation matches the CLI.

### 12.2 `omnia_top_k.py` undefined `path`

**Problem**

The user flagged `omnia_top_k.py` as broken because it referenced an undefined variable.

**Where**

- `omnia_top_k.py`

**Why it happened**

The old file was internally inconsistent and not aligned with the repaired main pipeline API.

**Fix**

It was replaced with a runner that calls `omnia.run_pipeline(...)` for each requested `top_k`.

**Result**

Top-k RAG evaluation now works and writes a proper summary CSV.

### 12.3 `wandb` blocking demo runs

**Problem**

Weights & Biases tracking can block or complicate demo startup, especially on fresh machines or controlled environments.

**Where**

- `candidates_filtering/embedding/train_model.py`
- `experiment/filtering.py`

**Why it happened**

The original research code assumed experiment-tracking behavior that is not ideal for a live demo.

**Fix**

- `use_wandb` was added as an explicit flag.
- `tracker=None` unless enabled.
- `WANDB_DISABLED` is set by default when not using wandb.

**Result**

Filtering can run in demo mode without requiring wandb login or background tracking.

### 12.4 CUDA tensor `.numpy()` crash

**Problem**

CUDA tensors cannot be converted directly with `.numpy()`.

**Where**

- `candidates_filtering/embedding/get_emb_transe.py`

**Why it happened**

NumPy expects CPU memory.

**Fix**

Embedding tensors are now converted via:

```python
.detach().cpu().numpy()
```

**Result**

TransE scoring works on GPU-backed runs such as the RTX 4060 path.

### 12.5 No-ground-truth filtering issue

**Problem**

When `missing_df` is empty, threshold coverage/reduction logic can become invalid or misleading.

**Where**

- `candidates_filtering/triple_filter.py`

**Why it happened**

The old code assumed an evaluation setting with held-out missing triples.

**Fix**

- `compute_coverage(...)` returns `0.0` when `missing_df` is empty.
- `get_threshold_diagnostics(...)` handles empty ground truth safely.

**Result**

Raw-upload demo sessions without holdout labels no longer break the filtering stage.

### 12.6 Lazy import / PyKEEN API boot issue

**Problem**

Importing PyKEEN too early can make backend startup more fragile or unnecessarily heavy.

**Where**

- `candidates_filtering/embedding/train_model.py`

**Why it happened**

Heavy ML imports at import time are a poor fit for an always-on API process.

**Fix**

PyKEEN imports were moved inside the functions that actually need them.

**Result**

Backend startup is lighter and less likely to fail just from import-time ML initialization.

### 12.7 Raw-upload mode behavior

**Problem**

The project originally assumed candidate CSVs or evaluation truth existed. The demo needed to support plain KG upload without pre-generated candidates.

**Where**

- `omnia.py`
- `experiment/preprocess.py`
- `backend/app/services/ingestion.py`
- `backend/app/services/pipeline.py`

**Why it happened**

Research scripts and demo systems have different assumptions. The latter must start from raw input.

**Fix**

- added in-memory split helpers,
- added session creation from raw DataFrame,
- added end-to-end candidate orchestration,
- ensured empty `missing_df` cases behave safely.

**Result**

The UI can start from a KG file and run the pipeline step by step.

### 12.8 Ollama invocation behavior

**Problem**

If a live Ollama call failed after the backend chose the real path, the demo could fail hard.

**Where**

- `experiment/prep_llm.py`
- `backend/app/services/pipeline.py`
- `frontend/src/pages/ValidationPage.tsx`

**Why it happened**

Local LLM dependencies are inherently unstable compared with pure in-process code.

**Fix**

- the backend first checks Ollama availability,
- then tries the real call,
- then falls back to deterministic mock mode if needed,
- and logs the fallback reason,
- while the frontend renders a visible MOCK banner.

**Result**

The validation step remains demonstrable even when Ollama is unavailable or fails at runtime.

### 12.9 Comparison page blank-loading UX

**Problem**

The comparisons page could look incomplete while loading because the header was not always visible.

**Where**

- `frontend/src/pages/BaselinesPage.tsx`

**Why it happened**

Loading was previously allowed to dominate the page visually.

**Fix**

The page header is now always rendered, with loading/error/cards below it.

**Result**

The page is clearer during expensive comparison computation.

### 12.10 Comparisons ignoring `force_mock`

**Problem**

The comparisons page could still make real Ollama calls even when the user intended mock mode, which hurt consistency and speed.

**Where**

- `frontend/src/pages/BaselinesPage.tsx`
- `backend/app/main.py`
- `backend/app/services/pipeline.py`

**Why it happened**

The `force_mock` setting was not being threaded through the comparisons route.

**Fix**

`force_mock` is now accepted by the comparisons endpoint and passed into LLM-only comparison execution.

**Result**

Comparisons obey the same mock/real policy as the rest of the demo.

## 13. Pipeline Stage Explanation for Oral Defense

This section is written in a teacher-facing explanation style.

### KG ingestion

**What it does**

Reads the dataset, previews it, maps columns, removes malformed rows, and creates the active session.

**Input**

- uploaded CSV/TSV/JSON or a benchmark sample id

**Output**

- canonical `Head/Relation/Tail` dataframe,
- optional `known_df` and `missing_df`,
- diagnostics and warnings.

**Files responsible**

- `backend/app/services/ingestion.py`
- `experiment/preprocess.py`

**Why it matters**

The rest of the OMNIA pipeline assumes canonical triples and optionally a known/missing split.

**How it appears in the UI**

- Ingestion page
- session state
- first step in pipeline explorer

### Sparsity / graph overview

**What it does**

Computes the structure of the KG:

- connected components,
- isolated nodes,
- density,
- sparsity score.

**Input**

- uploaded KG or known KG

**Output**

- stats payload,
- component summaries,
- summary graph or focused component graph.

**Files responsible**

- `backend/app/services/analytics.py`
- `frontend/src/pages/OverviewPage.tsx`

**Why it matters**

Sparse or disconnected graphs limit the quality of cluster-based propagation.

**How it appears in the UI**

- Overview page
- component cards
- sparse warnings
- summary-first graph behavior

### Clustering

**What it does**

Groups head entities that share the same `(Relation, Tail)` pair.

**Input**

- `known_df`

**Output**

- cluster summaries,
- cluster ids,
- member heads,
- warnings for very small clusters.

**Files responsible**

- `candidates_generation/triple_gen.py`
- `backend/app/services/analytics.py`

**Why it matters**

This is OMNIA's structural propagation mechanism. It is the reason the system can propose missing triples.

**How it appears in the UI**

- Clusters page
- selected cluster key
- shared triples
- source triples
- selected-cluster graph

### Candidate generation

**What it does**

Propagates relation-tail patterns across the heads in a cluster to generate candidate triples.

**Input**

- relation-tail clusters from the known KG

**Output**

- candidate triples,
- duplicate-existing flags,
- provenance,
- rationale,
- optional `Missing` labels in holdout mode.

**Files responsible**

- `candidates_generation/triple_gen.py`
- `backend/app/services/pipeline.py`

**Why it matters**

Without this stage there is nothing to filter or validate.

**How it appears in the UI**

- Candidates page
- candidate table
- cluster provenance
- statuses

### TransE filtering

**What it does**

Trains TransE on the known KG and scores candidate triples using translational distance `||h + r - t||`.

**Input**

- known KG,
- generated candidate triples

**Output**

- per-candidate distances,
- best threshold,
- accepted and rejected sets,
- threshold diagnostics.

**Files responsible**

- `experiment/filtering.py`
- `candidates_filtering/triple_filter.py`
- `candidates_filtering/embedding/get_emb_transe.py`
- `candidates_filtering/embedding/train_model.py`

**Why it matters**

It reduces the candidate set before LLM validation, making the pipeline more selective and more explainable.

**How it appears in the UI**

- Filtering page
- histogram
- threshold buttons
- accepted/rejected counts

### LLM validation

**What it does**

Checks candidate triples or sentence renderings using:

- zero-shot,
- context,
- or RAG prompting.

**Input**

- filtered candidates or raw candidates,
- known KG context or retriever context,
- model name,
- top-k when using RAG.

**Output**

- prompt,
- retrieved context,
- raw response,
- parsed `Score:`,
- final decision.

**Files responsible**

- `experiment/prep_llm.py`
- `backend/app/services/pipeline.py`

**Why it matters**

It is the semantic validation stage that decides whether the filtered structural hypothesis should be accepted.

**How it appears in the UI**

- Validation page
- expandable candidate explain blocks
- MOCK warning when applicable

### Completed KG update / diff

**What it does**

Merges accepted additions back into the known KG and computes summary/diff outputs.

**Input**

- known KG,
- accepted validation results

**Output**

- completed triple set,
- accepted additions,
- rejected candidates,
- unresolved candidates,
- exportable diff.

**Files responsible**

- `backend/app/services/pipeline.py`
- `frontend/src/pages/CompletedPage.tsx`

**Why it matters**

This is the final outcome of OMNIA: what new knowledge was added and what evidence was rejected.

**How it appears in the UI**

- Completed page
- CSV/JSON export
- diff tables

## 14. Design Decisions and Why They Make Sense

### Why a FastAPI wrapper was added

The original OMNIA logic is script-based. A system demonstration needs a reusable interface that pages can call independently. FastAPI is a practical choice because the OMNIA core is already Python.

### Why a React frontend was added

The demo needs multiple interactive views, persistent navigation, and structured inspection panels. React is a natural fit for a multi-page interactive UI around an API.

### Why a guided demo page is useful

A research demo is often shown live or recorded. Guided mode provides a stable narration order and makes presentation less error-prone.

### Why mock mode is labeled clearly

Mock mode is useful for robustness, but hiding it would be misleading. The implementation therefore treats it as an explicit fallback, not as a fake "real" result.

### Why real OMNIA code was reused instead of rewritten

Reusing the original clustering, filtering, LLM, and scoring modules preserves alignment with the original project and reduces the risk of accidental algorithm drift.

### Why scripts/setup/docs/tests were added

A working demo needs:

- reproducible setup,
- reproducible launch,
- verifiable tests,
- and documentation for defense/presentation.

### Why the architecture figure matters

The architecture figure is important for:

- the demo paper,
- the landing page,
- and oral explanation.

It gives a single summary view of how the KG, backend, OMNIA stages, and frontend relate.

## 15. How to Run the System

### Prerequisites

- Windows PowerShell
- Python 3.12
- Node 22+
- npm 10+
- Ollama installed locally if real LLM validation is desired
- `mistral` pulled in Ollama if using the default model
- CUDA-capable GPU if GPU-backed TransE training is desired

### Setup

Recommended setup command:

```powershell
.\scripts\setup_demo.ps1
```

This script:

- creates `.runenv`,
- upgrades pip tooling,
- installs CUDA-enabled PyTorch from `cu124`,
- installs `requirements-demo.txt`,
- runs `npm install` in `frontend/`.

### Run both servers

Recommended launch command:

```powershell
.\scripts\run_demo.ps1
```

This:

- builds the frontend,
- starts the backend on `127.0.0.1:8000`,
- starts the static frontend server on `127.0.0.1:5173`.

### Run backend manually

```powershell
.\.runenv\Scripts\Activate.ps1
python scripts/run_backend_server.py --host 127.0.0.1 --port 8000
```

### Run frontend manually

```powershell
cd frontend
npm run build
cd ..
python scripts/serve_frontend.py --root frontend/dist --host 127.0.0.1 --port 5173
```

### Optional Vite dev mode

```powershell
.\.runenv\Scripts\Activate.ps1
python scripts/run_backend_server.py --host 127.0.0.1 --port 8000
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

### URLs

- Frontend: `http://127.0.0.1:5173`
- Backend docs: `http://127.0.0.1:8000/docs`

### When Ollama is needed

Ollama is needed only for real validation mode.

Example setup:

```powershell
ollama pull mistral
ollama list
```

### What happens if Ollama is unavailable

The backend detects that and uses deterministic mock validation. The validation page and backend payload explicitly mark this as `MOCK`.

## 16. How to Demonstrate It to a Teacher

1. Open the landing page and say: "This system demonstrates OMNIA end to end instead of only showing benchmark tables."
2. Show the runtime box and mention whether Ollama is reachable.
3. Load a benchmark sample (`omnia_*`, after cloning true datasets) **or** upload a compact CSV via **Upload KG**.
4. Go to Overview and explain:
   - entity count,
   - connected components,
   - sparsity score,
   - why disconnected components matter.
5. Switch to the known graph if holdout mode is active and explain that some triples are intentionally hidden for evaluation.
6. Open Clusters and select a cluster.
7. Explain the shared `(Relation, Tail)` key and why the member heads belong together.
8. Show the selected cluster-only graph, then optionally the full component or 1-hop neighborhood.
9. Open Candidates and explain how OMNIA generates candidate triples from the cluster pattern.
10. Open Filtering and explain the TransE histogram, distances, and threshold.
11. Open Validation and show the prompt, retrieved context, raw response, parsed `Score:`, and final decision.
12. State clearly whether the validation output is real Ollama or MOCK fallback.
13. Open Completed KG and show accepted additions, recovered missing triples, rejected rows, and exported diff.
14. Optionally open Comparisons and say: "This is the full OMNIA pipeline versus filtering-only and LLM-only variants. KG-BERT is intentionally disabled rather than faked."
15. Finish on Guided Demo and explain that this page is for presentation sequencing.

## 17. Possible Questions the Teacher May Ask

### Question 1
**Question:** What was OMNIA originally in this repository?
**Answer:** From repository inspection, it was primarily a Python-based knowledge graph completion pipeline implemented as scripts and helper modules for candidate generation, filtering, LLM validation, and scoring. It did not expose a full interactive demo system.

### Question 2
**Question:** Why is this now a system demonstration and not only a script collection?
**Answer:** Because the repository now includes a backend API, a frontend UI, guided demo flow, graph exploration, explainability surfaces, and step-by-step interaction from KG upload to completed-KG diff.

### Question 3
**Question:** Why did you choose FastAPI?
**Answer:** The OMNIA core is already Python, so FastAPI is the shortest path to expose that logic cleanly over HTTP while also providing automatic API docs and easy file upload support.

### Question 4
**Question:** Why did you choose React?
**Answer:** The demo needs many interactive views, persisted state, dynamic graph rendering, and route-based navigation. React with TypeScript is a practical fit for that.

### Question 5
**Question:** What part of the system is the original OMNIA logic?
**Answer:** The core OMNIA logic is mainly in `candidates_generation/triple_gen.py`, `experiment/preprocess.py`, `experiment/filtering.py`, `candidates_filtering/*`, `experiment/prep_llm.py`, and `experiment/result.py`.

### Question 6
**Question:** What part is only wrapper or demo code?
**Answer:** The FastAPI backend, React frontend, session store, graph analytics payload shaping, guided demo page, logs, and static serving scripts are wrapper/demo code.

### Question 7
**Question:** How does clustering work here?
**Answer:** OMNIA groups heads that share the same `(Relation, Tail)` pair. For example, if multiple heads have `worksAt -> OmniaLab`, they form a cluster keyed by that shared relation-tail pair.

### Question 8
**Question:** Why is sparsity important in this project?
**Answer:** Because relation-tail propagation depends on shared structure. Sparse or disconnected regions provide weaker evidence and can create smaller clusters, which makes candidate generation less reliable.

### Question 9
**Question:** How are candidate triples generated?
**Answer:** For each cluster, OMNIA propagates observed relation-tail pairs across the heads in the cluster, then deduplicates candidates and marks those already existing in the graph.

### Question 10
**Question:** Why was provenance added to candidates?
**Answer:** A system demo needs to show not only the candidate triple but also which cluster generated it, which heads supported it, and why it exists.

### Question 11
**Question:** How does the filtering stage work?
**Answer:** It trains TransE on the known KG, computes `||h + r - t||` for each candidate, evaluates threshold options, and keeps the threshold that best balances reduction and recovery.

### Question 12
**Question:** What does a lower TransE distance mean?
**Answer:** It means the candidate is more consistent with the learned translational embedding geometry and is therefore a stronger structural hypothesis.

### Question 13
**Question:** Why did you expose a threshold histogram?
**Answer:** Because the audience needs to understand the distribution of candidate scores and see that filtering is not a black box.

### Question 14
**Question:** How does LLM validation work in this demo?
**Answer:** The backend builds a prompt in one of three strategies: zero-shot, context-based, or RAG. It then calls Ollama with `mistral`, parses the returned `Score:`, and converts that score into accepted, rejected, or unresolved.

### Question 15
**Question:** What does RAG use as retrieval data?
**Answer:** It uses the known KG written to a cached CSV file, loaded with LangChain `CSVLoader`, chunked with `SemanticChunker`, embedded with HuggingFace embeddings, and indexed in FAISS.

### Question 16
**Question:** Why is top-k exposed in the UI?
**Answer:** Because top-k directly changes the amount of retrieved context for RAG validation, and the demo needs to make that behavior inspectable.

### Question 17
**Question:** What happens if Ollama is not installed?
**Answer:** The system switches to a deterministic mock validation path and labels it clearly as `MOCK` in both backend payloads and the validation page.

### Question 18
**Question:** Why is mock mode acceptable here?
**Answer:** Because it is explicitly marked as a fallback for robustness. It allows the system demo to remain operational without pretending that fallback outputs are real LLM judgments.

### Question 19
**Question:** How does the backend keep track of pipeline progress?
**Answer:** Each session stores ordered step objects and a log stream in memory through `backend/app/store.py`.

### Question 20
**Question:** Is the backend persistent?
**Answer:** Not in the current design. Sessions are stored in the in-memory `SESSIONS` dictionary, so they exist only while the backend process is running.

### Question 21
**Question:** How are large datasets handled more safely than before?
**Answer:** The overview starts in component-summary mode when the dataset crosses configured thresholds, components are lazy-loaded, cluster pages default to focused subgraphs, and graphs can be truncated with warnings.

### Question 22
**Question:** Why is the full KG not shown on the cluster page anymore?
**Answer:** Because it was visually cluttered and made the clustering story harder to understand. The current design focuses on the selected cluster first and only expands outward on demand.

### Question 23
**Question:** What tests were added?
**Answer:** Python unit tests, subprocess-backed backend API integration tests, and Playwright E2E tests covering the audience-order demo flow and large-dataset behavior.

### Question 24
**Question:** Why was a custom frontend static server added?
**Answer:** Because the demo needs reliable SPA deep-link routing on built frontend assets, including route refreshes, and `serve_frontend.py` provides that behavior.

### Question 25
**Question:** What is still incomplete or future work?
**Answer:** The app still uses an in-memory backend store, the completed KG page is table-oriented rather than a full graph-diff canvas, the frontend bundle is still large, LangChain emits deprecation warnings, and KG-BERT is intentionally not implemented in this environment.

## 18. Short Defense Cheat Sheet

### 10 things I must remember

1. OMNIA originally existed as Python pipeline code, not as a full demo app.
2. The new system wraps that logic in FastAPI and React.
3. Clustering is based on shared `(Relation, Tail)` across heads.
4. Candidate generation now includes provenance and rationale.
5. Filtering uses real TransE through PyKEEN.
6. Validation uses real Ollama when available, otherwise explicit MOCK fallback.
7. The overview is summary-first for large datasets.
8. The clusters page now defaults to selected-cluster-only rendering.
9. The completed page shows accepted additions and exportable diff output.
10. The system is tested with unit, API integration, and Playwright E2E coverage.

### 10 one-line answers for difficult questions

1. "The original algorithmic core is reused; the main new contribution is the system layer around it."
2. "FastAPI was chosen because the core pipeline is already Python."
3. "React was chosen because the demo needs interactive multi-page inspection."
4. "Sparse graphs matter because they reduce the strength of cluster-based propagation."
5. "Filtering is structural, validation is semantic."
6. "Mock mode is visible by design; it is not meant to hide missing dependencies."
7. "The graph UX was changed to reveal less at once and focus on the current explanation step."
8. "Large-dataset mode uses component summaries first instead of rendering every node immediately."
9. "Comparisons are real when possible and disabled when not, rather than fabricated."
10. "The backend is stateful in memory because this is a demo system, not yet a production service."

### 5 sentences I can say to explain the whole system quickly

1. "This project turns OMNIA from a collection of research scripts into a full system demonstration."
2. "A user can upload a knowledge graph, inspect sparse structure, inspect relation-tail clusters, and follow how candidates are generated."
3. "The system then applies real TransE filtering, followed by LLM validation through Ollama or an explicit mock fallback."
4. "Every stage is exposed through a FastAPI backend and a React frontend with explainability views."
5. "The final result is a completed-KG diff that shows exactly what was accepted, rejected, and why."

## 19. Appendix: File-by-File Quick Index

| File path | Type | Purpose | New/Modified |
| --- | --- | --- | --- |
| `README.md` | Doc | operator-facing project and run instructions | Modified |
| `requirements-demo.txt` | Config | backend dependency set for demo/runtime | New |
| `omnia.py` | Python CLI | repaired end-to-end OMNIA CLI runner | Modified |
| `omnia_top_k.py` | Python CLI | repaired top-k RAG evaluation runner | Modified |
| `candidates_generation/triple_gen.py` | Python core | clustering and provenance-aware candidate generation | Modified |
| `experiment/preprocess.py` | Python core | holdout split and experiment dataframe helpers | Modified |
| `experiment/filtering.py` | Python core | TransE training/scoring/threshold pipeline | Modified |
| `experiment/prep_llm.py` | Python core | LLM prompting, RAG retrieval, mock fallback | Modified |
| `experiment/result.py` | Python core | score parsing and metrics | Modified |
| `candidates_filtering/triple_filter.py` | Python core | threshold filtering and diagnostics | Modified |
| `candidates_filtering/embedding/get_emb_transe.py` | Python core | CUDA-safe embedding extraction and distance scoring | Modified |
| `candidates_filtering/embedding/train_model.py` | Python core | PyKEEN training wrapper with device/wandb controls | Modified |
| `backend/app/__init__.py` | Python package | package marker | New |
| `backend/app/config.py` | Python backend | demo constants and paths | New |
| `backend/app/main.py` | Python backend | FastAPI app and endpoint definitions | New |
| `backend/app/models.py` | Python backend | `DemoSession` and step order | New |
| `backend/app/store.py` | Python backend | in-memory session store and log helpers | New |
| `backend/app/services/__init__.py` | Python package | services package marker | New |
| `backend/app/services/ingestion.py` | Python backend | upload parsing, mapping, canonicalization, session creation | New |
| `backend/app/services/analytics.py` | Python backend | graph stats, components, clusters, focus payloads | New |
| `backend/app/services/pipeline.py` | Python backend | candidate/filter/LLM/completed/comparison orchestration | New |
| `frontend/package.json` | Frontend config | dependencies and npm scripts | New |
| `frontend/package-lock.json` | Frontend config | lockfile | New |
| `frontend/index.html` | Frontend shell | Vite HTML root document | New |
| `frontend/vite.config.ts` | Frontend config | Vite server/preview proxy config | New |
| `frontend/tailwind.config.ts` | Frontend config | color/font/theme tokens | New |
| `frontend/postcss.config.js` | Frontend config | Tailwind and Autoprefixer wiring | New |
| `frontend/tsconfig.json` | Frontend config | TypeScript config | New |
| `frontend/tsconfig.node.json` | Frontend config | node-side TS config | New |
| `frontend/playwright.config.ts` | Test config | Playwright servers and browser settings | New |
| `frontend/public/architecture/omnia_demo_architecture.svg` | Asset | served architecture figure | New |
| `frontend/public/architecture/omnia_demo_architecture.png` | Asset | served architecture figure raster | New |
| `frontend/public/favicon.svg` | Asset | app icon | New |
| `frontend/src/App.tsx` | Frontend app | route map | New |
| `frontend/src/main.tsx` | Frontend app | React bootstrap | New |
| `frontend/src/index.css` | Frontend style | visual system and component layers | New |
| `frontend/src/types.ts` | Frontend types | shared payload types | New |
| `frontend/src/vite-env.d.ts` | Frontend type shim | Vite typing support | New |
| `frontend/src/lib/api.ts` | Frontend integration | API client and base resolution | New |
| `frontend/src/lib/hooks.ts` | Frontend integration | reusable data/session hooks | New |
| `frontend/src/store/session.ts` | Frontend state | Zustand persisted demo/session state | New |
| `frontend/src/components/common/StatusBadge.tsx` | Frontend component | status chip rendering | New |
| `frontend/src/components/common/StatCard.tsx` | Frontend component | metric card | New |
| `frontend/src/components/common/LoadingState.tsx` | Frontend component | loading UI | New |
| `frontend/src/components/common/EmptyState.tsx` | Frontend component | empty-state UI | New |
| `frontend/src/components/common/ErrorState.tsx` | Frontend component | error-state UI | New |
| `frontend/src/components/layout/AppShell.tsx` | Frontend layout | nav shell and active dataset card | New |
| `frontend/src/components/layout/PageHeader.tsx` | Frontend layout | reusable page heading/action area | New |
| `frontend/src/components/layout/LogDrawer.tsx` | Frontend layout | explainability log drawer | New |
| `frontend/src/components/graph/KGGraph.tsx` | Frontend graph | scalable graph renderer with Dagre | New |
| `frontend/src/components/pipeline/PipelineFlow.tsx` | Frontend graph | pipeline stage visualization | New |
| `frontend/src/components/charts/Histogram.tsx` | Frontend chart | TransE distance histogram | New |
| `frontend/src/components/tables/CandidatesTable.tsx` | Frontend table | candidate/provenance/decision table | New |
| `frontend/src/pages/LandingPage.tsx` | Frontend page | entry page with samples, runtime, architecture | New |
| `frontend/src/pages/IngestionPage.tsx` | Frontend page | upload, preview, and mapping | New |
| `frontend/src/pages/OverviewPage.tsx` | Frontend page | graph stats and component focus | New |
| `frontend/src/pages/PipelinePage.tsx` | Frontend page | pipeline runner and step explorer | New |
| `frontend/src/pages/ClustersPage.tsx` | Frontend page | cluster inspection and scoped cluster graphs | New |
| `frontend/src/pages/CandidatesPage.tsx` | Frontend page | candidate generation inspection | New |
| `frontend/src/pages/FilteringPage.tsx` | Frontend page | filtering metrics and threshold UI | New |
| `frontend/src/pages/ValidationPage.tsx` | Frontend page | prompt/context/response/decision audit | New |
| `frontend/src/pages/CompletedPage.tsx` | Frontend page | final diff and exports | New |
| `frontend/src/pages/BaselinesPage.tsx` | Frontend page | comparison variants | New |
| `frontend/src/pages/GuidedDemoPage.tsx` | Frontend page | presentation-friendly guided mode | New |
| `frontend/e2e/demo-system.spec.ts` | Test | full browser demo flow coverage | New |
| `scripts/clone_true_datasets.ps1` | Script | clones CoDEx + villmow KGE repos into `external_data/` | New |
| `docs/demo_paper_outline.md` | Doc | paper planning outline | New |
| `docs/demo_video_script.md` | Doc | video/demo narration script | New |
| `docs/qa_report.md` | Doc | QA coverage and fixes | New |
| `docs/architecture/omnia_demo_architecture.svg` | Doc asset | architecture figure | New |
| `docs/architecture/omnia_demo_architecture.png` | Doc asset | architecture figure raster | New |
| `docs/screenshots/README.md` | Doc | screenshots placeholder note | New |
| `scripts/setup_demo.ps1` | Script | environment setup | New |
| `scripts/run_demo.ps1` | Script | frontend/backend launcher | New |
| `scripts/run_backend_server.py` | Script | Windows-friendly backend launcher | New |
| `scripts/serve_frontend.py` | Script | SPA static frontend server | New |
| `tests/test_demo_backend.py` | Test | smoke tests | New |
| `tests/test_backend_units.py` | Test | backend/service unit tests | New |
| `tests/test_backend_api.py` | Test | subprocess HTTP integration tests | New |
