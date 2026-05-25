# Final Overwrite Cleanup Audit

Generated during OMNIA+ paper-demo refactor. Each grep hit is classified for live vs static boundaries.

## DATASETS[

| Location | Classification | Action |
|----------|----------------|--------|
| `feedbackStore.ts` | STATIC_ONLY | KEEP — localStorage feedback keyed by dataset id |
| `DatasetSelectorPanel.tsx` | LIVE_SAFE | KEEP — metadata labels only; live dataset overrides display |
| `sessionToDemoDataset.ts` | REPLACE | Metadata template only; no live graph/candidates |
| `PaperDemoPage.tsx` (static reset) | STATIC_ONLY | KEEP — COVID/Socio static path only |

## BenchmarkMiniGraph

| Location | Classification | Action |
|----------|----------------|--------|
| `BenchmarkMiniGraph.tsx` | STATIC_ONLY | KEEP — static fallback renderer |
| `RestoredGraphStagePanel.tsx` | LIVE_SAFE | KEEP — routes `graphPayload` → LiveGraphPanel in live mode |
| `GraphComparisonPanel.tsx` | STATIC_ONLY | KEEP — COVID guided comparison only |

## sessionToDemoDataset

| Location | Classification | Action |
|----------|----------------|--------|
| `PaperDemoPage.tsx` | DELETE | Replaced by `buildLiveOmniaViewModel` |
| `sessionToDemoDataset.ts` | REPLACE | Split: `sessionToDemoMetadata` for labels; no live graph |
| `usePaperDemoSession.ts` | KEEP | ID mapping helpers only |

## useStaticPaperGraph

| Location | Classification | Action |
|----------|----------------|--------|
| `PaperDemoPage.tsx` | LIVE_SAFE | KEEP — `!isLiveMode && guided` |
| `RestoredGraphStagePanel.tsx` | STATIC_ONLY | KEEP |
| `PaperDemoStepView.tsx` | STATIC_ONLY | KEEP |

## selectedCandidate fallbacks

| Location | Classification | Action |
|----------|----------------|--------|
| `PaperDemoPage.tsx` `feedbackCandidates[0] ?? allCandidates[0]` | DELETE | View model is single source |
| `NodeDetailPanel.tsx` `candidates[0]` | DELETE | No inspector fallback |
| `StepStatsPanel.tsx` `dataset.candidates[0]` | STATIC_ONLY | Acceptable for static demo |
| `DatasetGraphPanel.tsx` | STATIC_ONLY | KEEP |
| `CandidateGenStepView` cluster from candidate | REPLACE | Use selectedClusterId only |

## selectedCluster fallbacks

| Location | Classification | Action |
|----------|----------------|--------|
| `PaperDemoPage.tsx` `clusters[0]` | DELETE | Backend slice seeds selection |
| `PaperDemoStepView.tsx` `clusters[0]` | DELETE | Require explicit selected cluster |
| `NodeDetailPanel.tsx` `clusters[0]` | DELETE | No fallback |

## fallback (unsafe live paths)

| Location | Classification | Action |
|----------|----------------|--------|
| `PaperDemoPage.tsx` static fallback in live | DELETE | No static override in live mode |
| `usePaperDemoSession.ts` static sentinel message | LIVE_SAFE | KEEP — error only, no silent graph |
| `NodeDetailPanel.tsx` fallbackCluster/Candidate | DELETE | |
| `sessionToDemoDataset.ts` fake filteringStats | DELETE | Honest availability flags |
| `StepStatsPanel.tsx` dataset.llmStats fallback | STATIC_ONLY | KEEP for static |

## Target live data flow

```
usePaperDemoSession → buildLiveOmniaViewModel → PaperDemoStepView / LiveGraphPanel / Inspector
```

Single object carries: graph, selectedCluster, selectedCandidate, cluster-filtered candidates, filtering/llm availability, diagnostics.
