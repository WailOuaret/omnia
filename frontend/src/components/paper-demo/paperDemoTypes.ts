export type PaperDemoStep =
  | "before"
  | "missing"
  | "cluster"
  | "filtering"
  | "llm"
  | "after"
  | "diff";

export const PAPER_DEMO_STEP_ORDER: PaperDemoStep[] = [
  "before",
  "missing",
  "cluster",
  "filtering",
  "llm",
  "after",
  "diff",
];

export const PAPER_DEMO_TAB_LABELS: Record<PaperDemoStep, string> = {
  before: "Before KG",
  missing: "Missing Triple",
  cluster: "Cluster Evidence",
  filtering: "Filtering",
  llm: "LLM Validation",
  after: "After KG",
  diff: "Diff",
};

export type PaperDemoCandidateStatus = "accepted" | "rejected" | "unresolved" | "uncertain";

export interface PaperDemoCandidate {
  id: string;
  head: string;
  relation: string;
  tail: string;
  structuralScore: number;
  transeDistance: number;
  threshold: number;
  llmScore: number;
  combinedScore: number;
  llmVerdict: string;
  status: PaperDemoCandidateStatus;
  relationType: string;
  subjectType: string;
  objectType: string;
}

export type UserRefinementDecision = "accepted" | "rejected" | null;
