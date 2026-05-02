export type WorkspaceTab =
  | "before"
  | "missing"
  | "cluster"
  | "filter"
  | "validation"
  | "after"
  | "diff";

export type DemoStepId =
  | "load"
  | "before"
  | "missing"
  | "cluster"
  | "filter"
  | "validation"
  | "after"
  | "diff";

export interface DemoStepMeta {
  id: DemoStepId;
  title: string;
  shortTitle: string;
  summary: string;
  workspaceTab: WorkspaceTab;
  caption: string;
}

export const DEMO_STEPS: DemoStepMeta[] = [
  {
    id: "load",
    title: "Load KG",
    shortTitle: "1 Load KG",
    summary: "Ingest Wikidata CoDEx or FB/WN triple splits from authoritative repos.",
    workspaceTab: "before",
    caption: "Start from the factual benchmark graph OMNIA is asked to extend.",
  },
  {
    id: "before",
    title: "Before completion",
    shortTitle: "2 Before KG",
    summary: "Input graph only — no completions yet.",
    workspaceTab: "before",
    caption: "This is the KG OMNIA starts from after sampling / hold-out creation.",
  },
  {
    id: "missing",
    title: "Missing triples",
    shortTitle: "3 Missing",
    summary: "Show held-out truths and propagated candidates layered on localized context.",
    workspaceTab: "missing",
    caption: "Dashed amber edge encodes triples plausible from source text yet absent locally.",
  },
  {
    id: "cluster",
    title: "Clustering evidence",
    shortTitle: "4 Cluster",
    summary: "Relation-tail clustering is the structural prior that generates candidates.",
    workspaceTab: "cluster",
    caption: "Heads agreeing on one (relation,tail) motif justify testing new tails for peer heads.",
  },
  {
    id: "filter",
    title: "TransE filtering",
    shortTitle: "5 Filter",
    summary: "Embedding distance gate reduces combinatorially grown candidates.",
    workspaceTab: "filter",
    caption: "Passing tuples continue to semantics; rejects stay structurally dubious.",
  },
  {
    id: "validation",
    title: "LLM validation",
    shortTitle: "6 LLM",
    summary: "RAG / prompting produces explicit accept / reject rationales.",
    workspaceTab: "validation",
    caption: "Context + prompts make the latent LLM verdict teacher-inspectable.",
  },
  {
    id: "after",
    title: "After completion",
    shortTitle: "7 After KG",
    summary: "Completed graph merges curator + human accepted facts.",
    workspaceTab: "after",
    caption: "Thick emerald edges denote additions surfaced through OMNIA and human refinement.",
  },
  {
    id: "diff",
    title: "Diff",
    shortTitle: "8 Diff",
    summary: "Before vs after juxtaposition for reviewers.",
    workspaceTab: "diff",
    caption: "Select a candidate row to localize the subgraph OMNIA reasoned over.",
  },
];
