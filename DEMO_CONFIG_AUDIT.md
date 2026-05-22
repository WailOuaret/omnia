# Demo configuration audit

Date: 2026-05-22  
File audited: `frontend/src/demo-data/datasets.ts`  
Method: every field of `DemoDatasetConfig` checked against the requirements; every candidate verified against `graph.nodes` and `graph.edges`; every cluster verified against `graph.clusterBoxes` and `candidates[*].clusterIds`.

## 1. Field coverage matrix

Legend: `✓` present and valid, `–` deliberately omitted, `!` missing or invalid.

| Field | COVID-Fact | CoDEx-M | FB15K-237 | WN18RR | Socio-Economic |
| --- | --- | --- | --- | --- | --- |
| `id` | ✓ `covidFact` | ✓ `codexM` | ✓ `fb15k237` | ✓ `wn18rr` | ✓ `socioEconomic` |
| `label` | ✓ | ✓ `CoDEx-M — OMNIA experiment sample` | ✓ `FB15K-237 — OMNIA experiment sample` | ✓ | ✓ `Socio-Economic (private)` |
| `shortName` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `source` | ✓ | ✓ | ✓ | ✓ | ✓ `Private LLM-generated KG` |
| `publicStatus` | ✓ `public` | ✓ `public` | ✓ `public` | ✓ `public` | ✓ `private` |
| `description` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `whyInteresting` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `entities` | ✓ 1 416 | ✓ 16 759 | ✓ 12 993 | ✓ 40 943 | ✓ 33 563 |
| `relations` | ✓ 28 | ✓ 49 | ✓ 29 | ✓ 11 | ✓ 17 175 |
| `triples` | ✓ 908 | ✓ 60 000 | ✓ 59 270 | ✓ 93 003 | ✓ 64 417 |
| `recommendedMode` | ✓ sentence-rag | ✓ sentence-rag | ✓ triple-rag | ✓ triple-rag | ✓ sentence-rag |
| `bestF1` | – (intentional) | ✓ 0.91 | ✓ 0.86 | ✓ 0.87 | ✓ 0.678 |
| `note` | ✓ | ✓ | ✓ | – | – |
| `role` | ✓ `Running example / motivating demo` | – | – | – | – |
| `warning` | – | – | – | ✓ | ✓ |
| `graph.nodes` | ✓ 8 (legacy COVID graph supplied by `PaperCovidExampleGraph`) | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| `graph.edges` | ✓ 6 | ✓ 10 | ✓ 9 | ✓ 10 | ✓ 10 |
| `graph.clusterBoxes` | – (drawn inside `PaperCovidExampleGraph`) | ✓ 2 | ✓ 2 | ✓ 2 | ✓ 2 |
| `clusters` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `candidates` | ✓ 3 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| `filteringStats` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `llmStats` | ✓ | ✓ | ✓ | ✓ | ✓ |

No field is missing or invalid.

## 2. Candidate ↔ graph consistency

For each candidate, the table below shows whether the `(head, relation, tail)` triple matches an actual edge in `graph.edges` (so the candidate can be highlighted on the graph). Match is verified by `BenchmarkMiniGraph.findCandidateEdgeId` (case-insensitive comparison of node `label`/`shortLabel` and relation `label`/`shortLabel`).

### COVID-Fact (handled by the old paper graph)

| candidateId | Triple | Graph edge | Status |
| --- | --- | --- | --- |
| `cov-c1` | (chloroquine, treats, sars-cov-2) | `covid-e6` (status `missing`) | ✓ |
| `cov-c2` | (remdesivir, treats, 2019-ncov) | mapped to old `c4` in `PaperCovidExampleGraph` | ✓ |
| `cov-c3` | (chloroquine, affects, MERS) | mapped to old `c2` in `PaperCovidExampleGraph` | ✓ |

### CoDEx-M

| candidateId | Triple | Graph edge | Status |
| --- | --- | --- | --- |
| `cx-c1` | (Paris, related_to, Tourism) | `cx-e7` | ✓ |
| `cx-c2` | (Paris, related_to, Culture) | `cx-e8` (bent) | ✓ |
| `cx-c3` | (Eiffel Tower, located_in, France) | `cx-e9` (bent) | ✓ |
| `cx-c4` | (Louvre Museum, related_to, Tourism) | `cx-e10` (bent, removed) | ✓ |

### FB15K-237

| candidateId | Triple | Graph edge | Status |
| --- | --- | --- | --- |
| `fb-c1` | (Alan Turing, influence_on, Enigma) | `fb-e6` | ✓ |
| `fb-c2` | (Alan Turing, profession, Mathematics) | `fb-e7` (bent) | ✓ |
| `fb-c3` | (Alan Turing, field, Cryptography) | `fb-e8` | ✓ |
| `fb-c4` | (Cambridge, nationality, Alan Turing) | `fb-e9` (bent, removed) | ✓ |

### WN18RR

| candidateId | Triple | Graph edge | Status |
| --- | --- | --- | --- |
| `wn-c1` | (dog.n.01, hypernym, animal.n.01) | `wn-e7` (bent) | ✓ |
| `wn-c2` | (cat.n.01, hypernym, animal.n.01) | `wn-e8` (bent) | ✓ |
| `wn-c3` | (dog.n.01, instance hypernym, mammal.n.01) | `wn-e9` (bent) | ✓ |
| `wn-c4` | (animal.n.01, hypernym, dog.n.01) | `wn-e10` (bent, removed) | ✓ |

### Socio-Economic

| candidateId | Triple | Graph edge | Status |
| --- | --- | --- | --- |
| `se-c1` | (monetary policy, affects, inflation) | `se-e6` (bent) | ✓ |
| `se-c2` | (fiscal stimulus, influences, employment) | `se-e8` | ✓ |
| `se-c3` | (interest rate, affects, employment) | `se-e9` (bent) | ✓ |
| `se-c4` | (inflation, dampens, economic growth) | `se-e10` (bent, removed) | ✓ |

## 3. Candidate field richness

Every non-COVID candidate has all required fields populated. COVID-Fact candidates omit the explicit RAG-context arrays for the cluster/candidate IDs that are shown directly in `paperDemoScenario.ts` (the old graph already manages this context); the demo still has `retrievedContext` populated.

| Field | All datasets |
| --- | --- |
| `candidateId` | unique within dataset ✓ |
| `head` / `relation` / `tail` | populated ✓ |
| `distance` | populated ✓ |
| `threshold` | populated ✓ |
| Filter pass/remove computed from `status` (`kept` / `removed`) | ✓ |
| `llmVerdict` | populated ✓ |
| `llmConfidence` | populated ✓ |
| `llmRationale` | populated ✓ |
| `retrievedContext` | populated ✓ |
| `clusterIds` | populated ✓ |

## 4. Recommended-mode consistency

| Dataset | Paper recommendation | UI value | Match |
| --- | --- | --- | --- |
| COVID-Fact | running example, sentence-style | `sentence-rag` | ✓ |
| CoDEx-M | sentence-based RAG (Table IV best) | `sentence-rag` | ✓ |
| FB15K-237 | triple-based RAG (Table IV best) | `triple-rag` | ✓ |
| WN18RR | triple-based RAG (synset verbalization issue) | `triple-rag` | ✓ |
| Socio-Economic | sentence-based RAG | `sentence-rag` | ✓ |

## 5. Cluster ↔ cluster-box consistency

- Every dataset that declares `graph.clusterBoxes` also has at least one `cluster` whose `id` matches a `clusterBox.id` (CX1, CX2, FB1, FB2, WN1, WN2, SE1, SE2).
- Cluster boxes are rendered only during the *Clustering* and *Candidate Generation* steps, so they never collide with the LLM/feedback overlays in later steps.

## 6. COVID-Fact role consistency

- `bestF1` is intentionally **absent** on COVID-Fact.
- `note` reads: *"Used as the motivating running example; not part of the main Table IV evaluation because it is small."*
- `DatasetSelectorPanel` and `StepStatsPanel` both render `bestF1` only when it is defined, so COVID-Fact no longer pretends to have a Table IV F1.

## 7. Inconsistencies discovered and resolved during this audit

| Issue | Fix |
| --- | --- |
| Socio-Economic `bestF1 = 0.84` (wrong) | corrected to `0.678` (paper Table IV) |
| COVID-Fact had `bestF1 = 0.89` not in the paper | removed; `role` + `note` added instead |
| Old FB15K-237 candidates showed raw Freebase paths | replaced with short labels in `relation`; full path moved to `edge.fullLabel` tooltip |
| Old WN18RR labels carried leading underscore (`_hypernym`) | switched to short labels; full underscore form in `fullLabel` |
| Socio-Economic graph had only 6 nodes / 5 edges | enriched to 8 nodes / 10 edges with `unemployment` and `economic growth` |
| CoDEx-M had only 7 nodes / 6 edges | enriched to 8 nodes / 10 edges with `Landmark` |
| FB15K-237 had only 6 nodes / 5 edges | enriched to 8 nodes / 9 edges with `Princeton` and `Cryptography` |
| WN18RR had only 6 nodes / 6 edges | enriched to 8 nodes / 10 edges with `cat.n.01` and `domestic_animal.n.01` |

All issues are resolved in the current commit.
