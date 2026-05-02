# QA Report

## Added Coverage

- `tests/test_demo_backend.py`
  smoke coverage for canonicalization and the core mocked pipeline path
- `tests/test_backend_units.py`
  unit coverage for parsing, schema mapping, overview stats, component and cluster focus payloads, candidate provenance, threshold logic, explainability logs, and completed-KG diffs
- `tests/test_backend_api.py`
  HTTP integration coverage against a real temporary backend process for preview, upload, session creation, overview, components, clusters, candidates, filtering, LLM validation, completed KG, comparisons, exports, and full pipeline execution
- `frontend/e2e/demo-system.spec.ts`
  Playwright coverage for the end-to-end demo flow, refresh behavior, guided demo interaction, and large-dataset summary-first behavior

## Failures Found

- The earlier API integration suite based on `FastAPI TestClient` was unstable in this Windows environment because of event-loop and socket issues.
- `scripts/run_backend_server.py` did not guarantee that the repo root was on `sys.path`, so clean subprocess launches could fail with `ModuleNotFoundError: No module named 'backend'`.
- `scripts/run_demo.ps1` and `scripts/setup_demo.ps1` still pointed at the older `.venv` and direct dev-server startup path.
- The filtering page had an invalid hook-order path that could trigger a React runtime crash on load.
- Several session-dependent pages had hooks below early returns, which risked hook-order instability.
- The validation stage could fail hard if a live Ollama request raised after the backend decided to use the real path.
- The validation UI did not clearly explain when it had fallen back to MOCK mode after a live failure.

## Fixes Applied

- Replaced the API integration suite with subprocess-backed real HTTP tests.
- Updated `scripts/run_backend_server.py` to inject the repo root into `sys.path` before launching Uvicorn.
- Updated `scripts/setup_demo.ps1` to use `.runenv`, validate the environment more defensively, and call `npm.cmd`.
- Updated `scripts/run_demo.ps1` to use the stable backend launcher and the SPA static server instead of relying on Vite dev mode.
- Refactored the graph UX into:
  - global component-summary overview
  - connected-component focus view
  - selected-cluster subgraph focus
- Reworked the clusters page to default to the selected cluster and expose component and neighborhood scopes explicitly.
- Fixed hook-order issues on filtering and other session-gated pages.
- Added backend fallback handling so failed live Ollama calls downgrade to clearly labeled deterministic MOCK validation.
- Added a visible MOCK/fallback warning banner on the validation page.
- Rewrote the README so the documented setup, run path, and verification commands match the actual stable runtime.

## Verified Commands

```powershell
cd frontend
npm run build
npm run test:e2e
cd ..
.\.runenv\Scripts\python.exe -m unittest tests.test_demo_backend tests.test_backend_units tests.test_backend_api
```

## Remaining Limitations

- The frontend production build still emits a large bundle warning because graph and charting dependencies are bundled together.
- `experiment/prep_llm.py` still uses the current LangChain community embedding import path and may emit deprecation warnings depending on the installed package versions.
- Real Ollama behavior still depends on the local daemon, pulled model, and available system resources. The app handles this with explicit MOCK fallback instead of failing the demo flow.
