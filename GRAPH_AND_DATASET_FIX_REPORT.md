# Graph polish & dataset correction report

Date: 2026-05-22  
Scope: visual polish of the non-COVID `BenchmarkMiniGraph`, correction of dataset statistics (with the Socio-Economic F1 fix), layout hardening so the right panel is always visible, and selected-candidate header overflow fix. The teacher-required interface (dataset-first landing, 3-column layout, left workflow, right stats, bottom explanation, feedback step, completed step) was preserved. COVID-Fact still uses `PaperCovidExampleGraph`.

---

## 1. Dataset values fixed (PART A)

All values are sourced from OMNIA's CIKM Table I and renamed where required by the teacher.

| Dataset | Entities | Relations | Triples | Label | Recommended mode | Best OMNIA F1 |
| --- | --- | --- | --- | --- | --- | --- |
| COVID-Fact | 1 416 | 28 | 908 | COVID-Fact | sentence-based RAG | *(none — running example only)* |
| CoDEx-M | 16 759 | 49 | 60 000 | **CoDEx-M — OMNIA experiment sample** | sentence-based RAG | **0.91** |
| FB15K-237 | 12 993 | 29 | 59 270 | **FB15K-237 — OMNIA experiment sample** | triple-based RAG | **0.86** |
| WN18RR | 40 943 | 11 | 93 003 | WN18RR | triple-based RAG | **0.87** |
| Socio-Economic | 33 563 | 17 175 | 64 417 | **Socio-Economic (private)** | sentence-based RAG | **0.678 (displayed 0.68)** |

WN18RR carries the warning:

> Use triple-based validation because WordNet synset labels are difficult to verbalize reliably.

Socio-Economic carries the warning:

> Private / optional sparse dataset. Candidate generation is harder because structural patterns are less frequent.

Files: `frontend/src/demo-data/datasets.ts`.

## 2. Socio-Economic F1 corrected from 0.84 → 0.68

`bestF1: 0.84` (previous) → `bestF1: 0.678`. `DatasetSelectorPanel` and `StepStatsPanel` both render `bestF1.toFixed(2)` → **`0.68`**. Verified in:
- `frontend/src/components/paper-demo/DatasetSelectorPanel.tsx` (`Best OMNIA F1` line)
- `frontend/src/components/paper-demo/StepStatsPanel.tsx` (KG step)

## 3. Graph component for COVID-Fact

**Unchanged.** `RestoredGraphStagePanel` still routes COVID-Fact directly to:

```10:1:frontend/src/components/paper-demo/PaperCovidExampleGraph.tsx
import type { PaperDemoCandidate, PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";
```

The old paper figure (fixed positions, cluster boxes, dashed candidate `(chloroquine, treats, sars-cov-2)`, before/after diff) is rendered as-is.

## 4. Graph component for CoDEx-M, FB15K-237, WN18RR, Socio-Economic

`BenchmarkMiniGraph` — fully rewritten (PART D). It reads coordinates, short labels, bend, and `clusterBoxes` from the dataset config. It:

- uses a stable `viewBox="0 0 1200 620"` with `preserveAspectRatio="xMidYMid meet"`, `width="100%"`, `height="100%"`
- draws straight or quadratic-bezier edges depending on `edge.bend`
- draws every label inside a rounded white background so labels never touch nodes or edges
- shows the short relation label inside the graph and the full relation as a `<title>` SVG tooltip
- wraps long node labels onto two lines and reduces font size when the label exceeds 12 chars
- draws cluster boxes from `dataset.graph.clusterBoxes` with the cluster name in a white pill **above** the box (never inside, never over nodes)
- shows accept / reject / uncertain / corrected badges next to the selected edge (no overlap with nodes)
- uses the full `feedbackDecisions` map to color **every** decided candidate edge, not only the currently selected one (PART H)

File: `frontend/src/components/paper-demo/BenchmarkMiniGraph.tsx`.

## 5. No circular layout anywhere

`BenchmarkMiniGraph.getPositions` only falls back to a circular layout when a dataset has no `x/y` coordinates. Every shipped dataset (CoDEx-M, FB15K-237, WN18RR, Socio-Economic) now provides `x` and `y` for every node, so the fallback never runs. COVID-Fact uses `PaperCovidExampleGraph` whose layout is fully manual.

## 6. No long Freebase paths in the graph

FB15K-237 edges expose:

- `shortLabel: "profession" | "nationality" | "institution" | "influence_on"`
- `fullLabel: "/people/person/profession"` etc., shown only on hover via `<title>`.

WN18RR exposes `shortLabel: "hypernym" | "instance hypernym"`, full `_hypernym` only as tooltip.  
CoDEx-M / Socio-Economic use natural short labels (`located_in`, `capital_of`, `affects`, `influences`, `drives`, `modulates`).

`BenchmarkMiniGraph` always renders `edge.shortLabel ?? edge.label`. Long Freebase paths are never painted directly.

## 7. Selected-candidate no longer overflows

`RestoredGraphStagePanel` now stacks the title and the candidate vertically. The candidate appears as a compact pill below the title with:

```
.inline-flex.max-w-full + .truncate.max-w-[42ch] + title attribute = full triple in tooltip
```

There is no longer a far-right header text. On any width, the pill stays inside the card and gets ellipsis if it would overflow.

## 8. Right stats panel always visible

`PaperDemoPage` now uses a stable grid:

```
.demo-layout {
  grid-template-columns: 1fr;            /* < xl */
}
xl: grid-template-columns: 300px minmax(0, 1fr) 340px;
gap: 16px;
align-items: start;
```

Center panel gets `min-width: 0; overflow: hidden;` (in Tailwind: `min-w-0 overflow-hidden`), so the SVG can shrink without pushing the right column out of the viewport. Right column carries `min-w-0` so it cannot overflow horizontally either. Below `xl` (1280 px) the three columns collapse to a single column, and the right panel is rendered **below** the center panel rather than being clipped.

At 1366 px (xl breakpoint): right panel is fully visible.  
At 1920 px: graph is wide, right panel is 340 px wide, center is `~1180 px`.

## 9. Frontend build result

```
> omnia-demo-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v6.4.2 building for production...
✓ 2441 modules transformed.
dist/index.html                              0.56 kB │ gzip:   0.35 kB
dist/assets/index-ofz2ulqk.css              59.98 kB │ gzip:  11.20 kB
dist/assets/api-aum_P2Nq.js                  2.51 kB │ gzip:   0.92 kB
dist/assets/PaperDemoPage-CBTcdx1f.js       70.05 kB │ gzip:  17.04 kB
dist/assets/index-BQSbvjrT.js              169.10 kB │ gzip:  55.44 kB
dist/assets/DemoWorkbenchPage-DSHgZ40z.js  711.85 kB │ gzip: 207.84 kB

✓ built in 15.68s
```

No TypeScript errors, no linter errors. (No backend file changed; pytest re-run not required.)

## 10. Manual QA notes

### CoDEx-M
- Eiffel Tower top-left, Louvre Museum bottom-left, Paris in the center, France to the right, Europe far right. Tourism / Culture at the bottom.
- Cluster boxes `CX1 (located_in, Paris)` and `CX2 (capital_of, France)` appear above-and-around the relevant nodes during *Clustering* / *Candidate Generation*. Labels sit in a white pill above each box; no overlap with node labels or edge labels.
- The `(Paris, related_to, Culture)` candidate uses `bend: -40` so it no longer crosses the straight `(Paris, related_to, Tourism)` candidate.
- Short edge labels only: `located_in`, `capital_of`, `related_to`.

### FB15K-237
- Alan Turing in the geometric center, Cambridge top-left, United Kingdom top-right, Mathematics bottom-left, Computer Science bottom-right, Enigma far right.
- Labels around Alan Turing (`Alan Turing`, `nationality`, `profession`, `institution`, `influence_on`) no longer overlap; the candidate edge to Mathematics is bent so it does not collide with the candidate edge to Enigma.
- Graph displays **`profession`**, **`nationality`**, **`institution`**, **`influence_on`** — not `/people/person/profession`. Full Freebase path is in the `<title>` tooltip on hover.
- Single cluster box `FB1 (institution, Cambridge)` framing Alan Turing only, with its label above the box.

### WN18RR
- `animal.n.01` at the top, `canine.n.02` and `feline.n.01` mid-row, `dog.n.01` and `mammal.n.01` bottom corners, `carnivore.n.01` bottom-center.
- Synset labels render as two lines (`canine` / `n.01`) inside the nodes; full synset `canine.n.02` shown on hover.
- Edges use short labels `hypernym` and `instance hypernym`. Two candidate edges (`dog → animal`, `dog → mammal`) use opposite-sign bends so they do not overlap.
- Cluster box `WN1 (hypernym, animal.n.01)` is a single elongated rectangle with its label above the box.

### Socio-Economic
- Left column: `monetary policy`, `policy intervention`, `fiscal stimulus`.  
- Right cluster: `interest rate` (top), `inflation` (right), `employment` (bottom).
- Cluster box `SE1 (head sub-cluster)` wraps the head column with its label above; it no longer overlaps `policy intervention`.
- Candidate edges (`policy → interest rate`, `interest rate → employment`, `monetary policy → inflation`) are bent to keep them away from the known edges and from the SE1 box label.
- Right stats panel shows **Best OMNIA F1: 0.68** (not 0.84).

### Cross-dataset
- The "Selected candidate" pill stays inside the graph card on all four datasets; never gets cut off on the right edge.
- The legend below the graph is step-aware: KG → only "Original KG relation"; clustering/candidates → adds "Generated candidate"; filtering → adds "Filtered out"; LLM → adds "LLM validated"; feedback/completed → switches to Accepted / Rejected / Uncertain / Corrected.
- After accepting `cov-c1` (COVID-Fact) the green badge appears on the missing edge; after rejecting `fb-c2` the red REJECTED badge appears on the corresponding FB15K-237 candidate edge, and the badge survives switching the selected candidate (PART H — the whole `feedbackDecisions` map is honored, not only the active selection).

---

## Files changed

| File | Reason |
| --- | --- |
| `frontend/src/demo-data/types.ts` | Extended `GraphNode` with `shortLabel`, `labelDx`, `labelDy`; extended `GraphEdge` with `shortLabel`, `fullLabel`, `labelDx`, `labelDy`, `labelPosition`, `bend`, `showLabel`; added `ClusterBox`; added `clusterBoxes?: ClusterBox[]` on `graph`. |
| `frontend/src/demo-data/datasets.ts` | Corrected stats, F1 values, labels, recommended modes; replaced node coordinates per PART E; added `shortLabel` / `fullLabel` / `bend`; added `clusterBoxes`; cleaned candidate IDs to use natural relations. |
| `frontend/src/components/paper-demo/BenchmarkMiniGraph.tsx` | Rewritten layout engine (PART D, PART H): viewBox 1200×620, responsive, bend support, white-background label boxes, multi-line node labels, `<title>` tooltips, cluster boxes from config, per-candidate decision rendering using full `feedbackDecisions`. |
| `frontend/src/components/paper-demo/RestoredGraphStagePanel.tsx` | Selected candidate moved to a truncated pill below the title (PART F); legend now step-aware; passes `feedbackDecisions` through. |
| `frontend/src/pages/PaperDemoPage.tsx` | Builds `feedbackDecisions` map and passes it to the graph; locked-in 3-column grid (300 / 1fr / 340) with `min-w-0` on center/right panels to guarantee right panel visibility (PART G); collapses to single column under `xl`. |
| `frontend/src/components/paper-demo/StepStatsPanel.tsx` | KG step now displays the corrected `Best OMNIA F1`, `Recommended mode`, and warning so the right panel reflects PART A everywhere. |

## What was NOT changed (per requirements)

- Dataset-first landing page kept.
- Left dataset selector and workflow menu kept.
- Center graph / right stats / bottom explanation kept.
- User feedback step kept; feedback panel still appears only after Semantic Validation.
- Completed KG / Diff step kept.
- `PaperCovidExampleGraph` is still the COVID-Fact center graph — visually identical to the previous restoration.
- No return to the old dense dashboard.
