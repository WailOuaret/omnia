# OMNIA Demo Video Script

## Target Length

- 3 to 5 minutes

## Scene 1: Landing

Narration:

"This is OMNIA, a demo system for knowledge graph completion. Instead of only reporting benchmark scores, the interface shows how the system clusters entities, generates candidate triples, filters them with TransE, validates them with Ollama, and reconstructs the completed graph."

Action:

- Open the landing page.
- Show the architecture preview.
- Click **Load sample KG** and pick a benchmark (after `scripts/clone_true_datasets.ps1`), e.g. CoDEx-M or FB15k-237 (`omnia_*` ids), or upload a small CSV.

## Scene 2: KG Overview

Narration:

"The overview page shows the graph before completion. The important question here is not just what entities exist, but how sparse the graph is, how many disconnected components it has, and which nodes are isolated. These structural constraints determine how much OMNIA can infer."

Action:

- Open `KG Overview`.
- Point to density, connected components, isolated nodes, and sparsity score.
- Switch between uploaded KG and known KG if holdout mode is enabled.

## Scene 3: Clustering

Narration:

"OMNIA forms clusters by grouping heads that share the same relation-tail pair. This page exposes the cluster key, cluster size, member heads, and the supporting subgraph. Small clusters are explicitly marked as weak evidence in sparse regions."

Action:

- Open `Clusters`.
- Select one strong cluster and one weak cluster.

## Scene 4: Candidate Generation

Narration:

"Candidate triples are propagated from those clusters. Each generated triple carries provenance: which cluster produced it, which heads supported it, and why it was proposed."

Action:

- Open `Candidates`.
- Filter or search the table.
- Point to duplicate existing triples and filter queue status.

## Scene 5: TransE Filtering

Narration:

"Before asking the language model, OMNIA reduces the candidate set with TransE. The interface exposes the translational distance for each candidate and the threshold used to accept or reject it."

Action:

- Open `Filtering`.
- Show the histogram.
- Adjust the threshold once if needed.

## Scene 6: LLM Validation

Narration:

"The final stage is LLM validation with Ollama. The system exposes the exact prompt, retrieved context, raw model response, parsed `Score:`, and final decision. If Ollama is unavailable, the UI switches to a clearly labeled mock mode instead of hiding the failure."

Action:

- Open `LLM Validation`.
- Show one accepted and one rejected candidate.

## Scene 7: Completed KG

Narration:

"The accepted triples are merged back into the graph. The completed KG page shows what changed, what was rejected, and how many held-out triples were recovered in evaluation mode."

Action:

- Open `Completed KG`.
- Download the diff.

## Closing

Narration:

"The contribution of this demo is operational transparency. It lets an audience see what OMNIA is doing, why it is doing it, and what changes after every stage of the pipeline."
