# Frontend Overwrite Audit

Generated for the OMNIA+ paper demo cleanup.

## Search Results And Actions

### `DATASETS[`

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/pages/PaperDemoPage.tsx` | `staticDataset`, static dataset branch | Reads static dataset config only when live backend slice is not the selected source | Static-only | KEEP/GUARD |
| `frontend/src/pages/PaperDemoPage.tsx` | `onDatasetChange` static branch | Initializes COVID-Fact/Socio-Economic static cluster/candidate after choosing a static-only dataset | Static-only | KEEP/GUARD |
| `frontend/src/stores/feedbackStore.ts` | local feedback helpers | Static/localStorage feedback for static demo datasets | Static-only | KEEP |
| `frontend/src/lib/sessionToDemoDataset.ts` | metadata template | Uses DATASETS for labels, descriptions, public/private metadata, not as live source of graph truth | Live-safe metadata | GUARD/KEEP |
| `frontend/src/components/paper-demo/DatasetSelectorPanel.tsx` | display metadata | Shows selected/session dataset labels and copy | Live-safe metadata | KEEP |

### `BenchmarkMiniGraph`

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/components/paper-demo/BenchmarkMiniGraph.tsx` | component definition | Static fallback mini graph | Static-only | KEEP |
| `frontend/src/components/paper-demo/RestoredGraphStagePanel.tsx` | fallback branch | Renders only when no live `graphPayload` exists | Guarded | KEEP/GUARD |
| `frontend/src/components/paper-demo/GraphComparisonPanel.tsx` | static completed comparison | Used only when no live interactive graph payload is present | Static-only fallback | KEEP/GUARD |

### `sessionToDemoDataset`

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/pages/PaperDemoPage.tsx` | live metadata adapter | Converts backend session rows to the existing display shape | Live-safe if graph rendering uses `sessionSliceToGraphPayload` | KEEP/GUARD |
| `frontend/src/lib/sessionToDemoDataset.ts` | adapter | Removed fake threshold zero behavior; candidates/clusters come from backend rows | Live-safe metadata | REPLACE fake defaults |
| `frontend/src/components/paper-demo/DatasetSelectorPanel.tsx` | sample id helper | Maps frontend dataset ids to backend sample ids for session creation | Live-safe | KEEP |

### `useStaticPaperGraph`

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/pages/PaperDemoPage.tsx` | `useStaticPaperGraph={!isLiveMode && activeSlice.mode === "guided"}` | Prevents static paper graph in live mode | Guarded | KEEP |
| `frontend/src/components/paper-demo/PaperDemoStepView.tsx` | step graph prop | Passes static flag down to graph stage | Guarded by page | KEEP |
| `frontend/src/components/paper-demo/RestoredGraphStagePanel.tsx` | graph renderer | Uses static graphs only when live graph payload is absent | Guarded | KEEP |

### Static fallback / demo data strings

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/hooks/usePaperDemoSession.ts` | session fallback | Uses static sentinel only after backend failure or static-only dataset choice | Guarded | REPLACE old URL-only live mode |
| `frontend/src/hooks/useFeedbackBridge.ts` | feedback fallback | Static feedback mode when no active live session id is supplied | Guarded | GUARD |
| `frontend/src/pages/PaperDemoPage.tsx` | source badge and guard | Shows red error when live mode would render static data | Guarded | KEEP |

### Fake filtering defaults

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/lib/sessionToDemoDataset.ts` | filtering stats | Replaced missing threshold `0` with `Number.NaN`; panels use candidate-level real fields | Fixed | REPLACE |
| `frontend/src/components/paper-demo/PaperDemoStepView.tsx` | filtering step | Empty banner shown when no real distance/threshold fields exist | Fixed | REPLACE |
| `frontend/src/components/paper-demo/StepStatsPanel.tsx` | LLM stats | Removed fallback confidence/verdict as if real | Fixed | REPLACE |

### Session creation paths

| File | Location | What it does | Safety | Action |
| --- | --- | --- | --- | --- |
| `frontend/src/hooks/usePaperDemoSession.ts` | stable policy | URL session validated first, then cached `paperDemo.sessions`, then creates once | Fixed | REPLACE |
| `frontend/src/pages/PaperDemoPage.tsx` | dataset session button | Calls stable hook with `force` only for explicit recreate | Fixed | REPLACE |
| `backend/app/main.py` | `/api/demo/create-paper-session` | Legacy convenience endpoint remains but is not used by `/paper-demo` auto-load | Not on main flow | KEEP |

## Source-Of-Truth Result

Live mode now uses:

- `liveSession.graphSlice.nodes` / `liveSession.graphSlice.edges`
- `liveSession.graphSlice.clusters` or backend cluster endpoint
- `liveSession.graphSlice.candidates` or backend candidate endpoint
- backend candidate filtering fields only when present
- backend candidate LLM/RAG fields only when present
- backend feedback and completed payloads

Static mode now uses:

- `DATASETS`
- `BenchmarkMiniGraph` / `PaperCovidExampleGraph`
- local feedback store

Static mode is selected for COVID-Fact, Socio-Economic, explicit fallback, or backend failure.
