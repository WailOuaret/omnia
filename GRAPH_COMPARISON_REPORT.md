# Graph comparison & graph-size report

Date: 2026-05-22

## 1. Before vs after comparison — implementation

The Completed KG / Diff step (`activeStep === "completed"`) now renders `GraphComparisonPanel` instead of a single graph. The panel always shows two graphs side by side on screens ≥ `xl` (1280 px) and stacks them vertically on narrower screens.

| Panel | Component | Mode | What it shows |
| --- | --- | --- | --- |
| Left | `PaperCovidExampleGraph` (COVID-Fact) or `BenchmarkMiniGraph` (other datasets) | `step="before"` / `activeStep="kg"` | original KG only — no candidate edges |
| Right | same components | `step="after"` / `activeStep="completed"` | original KG + accepted triples (thick green) + corrected triples (purple). Rejected/uncertain triples are visualised as red-dashed / amber-dashed *but not added to the completed KG*. |

The panel is labelled clearly: the left panel header reads *"Before completion — original KG"*, the right reads *"After completion — completed KG"*. A pill in each header (`original` / `completed`) reinforces the distinction.

### 1.1 Diff summary

Underneath the two graphs, `GraphComparisonPanel` renders four lists:

| Card | Provenance value attached to each row | What goes in |
| --- | --- | --- |
| Added | `human_confirmed` | accept decisions |
| Corrected | `human_corrected` | correct decisions (corrected triple) |
| Rejected | `human_rejected` | reject + correct (original triple) |
| Review queue | `needs_expert_review` | uncertain decisions |

Each row prints `(head, relation, tail)` and the provenance, and the corrected card also includes the original candidate the user replaced.

## 2. Per-dataset comparison

| Dataset | Left panel shows | Right panel highlights when user accepts the marquee candidate |
| --- | --- | --- |
| **COVID-Fact** | original KG with chloroquine / SARS-CoV-2 / virus replication / 2019-ncov / sars / MERS / remdesivir nodes | a green edge `(chloroquine, treats, sars-cov-2)` is added; the diff summary shows the triple under "Added — human_confirmed" |
| **CoDEx-M** | 8-node Paris/Eiffel/Louvre subgraph with `Landmark` | accepting `(Paris, related_to, Tourism)` adds a green bent edge into the `CX2` cluster region |
| **FB15K-237** | 8-node Alan Turing subgraph with `Cryptography` and `Princeton` | accepting `(Alan Turing, profession, Mathematics)` adds a thick green edge crossing from Alan Turing into the FB1 cluster; short labels keep the graph readable, full Freebase paths remain in tooltips |
| **WN18RR** | 8-node WordNet hierarchy (dog/cat/canine/feline/animal/mammal/carnivore/domestic_animal) | accepting `(dog.n.01, hypernym, animal.n.01)` and `(cat.n.01, hypernym, animal.n.01)` adds two long bent green edges into WN1 |
| **Socio-Economic** | 8-node sparse policy graph with `unemployment` and `economic growth` | accepting `(fiscal stimulus, influences, employment)` adds an edge inside SE1; the rejected `(inflation, dampens, economic growth)` shows up under "Rejected — human_rejected" |

## 3. Graph-size improvements

| Concern | Before | After |
| --- | --- | --- |
| Single-graph stage height | `max-h-[68vh]` (sometimes < 480 px) | `clamp(560px, 70vh, 820px)` (always at least 560 px, up to 820 px) |
| CoDEx-M / FB15K-237 / WN18RR / Socio-Economic node count | 6 nodes | 8 nodes (within the 7–10 target) |
| Edge / candidate count per benchmark dataset | 5–6 | 9–10 |
| Candidate variety | 3 (mostly 2 kept + 1 removed) | 4 per benchmark (kept + uncertain + removed + accepted-style) |
| Focus modal | absent | present, opens a 95vh / 1500 px overlay; closes with `Esc` or backdrop click |
| Legend | always all entries | filtered per step (only items relevant to the current step) |
| Selected candidate header | overflowed off the panel | truncated pill with full triple in `title` tooltip |

The `Focus graph` button appears in the header of every single-graph stage (Knowledge Graph, Clustering, Candidate Generation, Structural Filtering, Semantic Validation, User Feedback steps). The Completed step shows the side-by-side comparison directly, so a single focus modal is not needed there — both halves of the comparison are already on screen.

## 4. Layout responsiveness

| Width | Layout for non-completed steps | Layout for completed step |
| --- | --- | --- |
| < 1280 px | single column: dataset selector → graph → stats → explanation | single column: dataset selector → comparison panel (graphs stack vertically) → exports → explanation |
| ≥ 1280 px (`xl`) | three columns: `300px / 1fr / 340px` | two columns: `300px / 1fr`; the comparison panel occupies the wide centre, exports + summary sit underneath |
| ≥ 1920 px | identical to xl but with more whitespace | the two comparison graphs sit comfortably side by side, no horizontal scroll |

The right stats panel is no longer rendered during the completed step; its content (feedback summary, KG diff preview, completed KG counts) is merged into the wider exports card so the user keeps every number visible without clipping.

## 5. Manual QA snapshot

These should be checked manually in a browser (a screenshot log is **not** auto-generated):

1. Open `/paper-demo`, pick **COVID-Fact**, click *Start Demo*, walk through Clustering → Candidate Generation → Structural Filtering → Semantic Validation. The graph should be clearly visible at >560 px tall with the old paper-style fixed positions intact.
2. Pick the candidate `cov-c1` from the candidate selector, go to **User Feedback**, click **Accept**.
3. Go to **Completed KG / Diff**. Verify:
   - Two graphs side by side.
   - Left has no `chloroquine → treats → sars-cov-2` edge.
   - Right has it in thick green.
   - Diff card shows the row under "Added — human_confirmed".
4. Pick CoDEx-M (still via the dataset selector). Walk to the Completed step. Both 8-node graphs should be visible side by side with cluster boxes labelled CX1 and CX2 in different colours.
5. Click **Focus graph** on any non-comparison step. The modal should occupy ~95% of the viewport and close on `Esc` or backdrop click.

## 6. Files touched for the graph polish

- `frontend/src/components/paper-demo/RestoredGraphStagePanel.tsx` — clamp height, Focus modal, per-step legend, selected-candidate pill.
- `frontend/src/components/paper-demo/GraphComparisonPanel.tsx` — new comparison + diff summary.
- `frontend/src/components/paper-demo/BenchmarkMiniGraph.tsx` — already supports the visual grammar; reused as-is for "before" (`activeStep="kg"`) and "after" (`activeStep="completed"`) inside the comparison panel.
- `frontend/src/pages/PaperDemoPage.tsx` — conditional 2-column / 3-column layout on the completed step; uses `GraphComparisonPanel` only on completion.
- `frontend/src/demo-data/datasets.ts` — enriched CoDEx-M, FB15K-237, WN18RR, Socio-Economic to 8 nodes and 9–10 edges; added second cluster box per benchmark dataset.
