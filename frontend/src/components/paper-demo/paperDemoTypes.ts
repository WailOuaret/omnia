export type PaperDemoStep =
  | "before"
  | "missing"
  | "cluster"
  | "generation"
  | "filtering"
  | "llm"
  | "human"
  | "after"
  | "diff";

export const PAPER_DEMO_STEP_ORDER: PaperDemoStep[] = [
  "before",
  "missing",
  "cluster",
  "generation",
  "filtering",
  "llm",
  "human",
  "after",
  "diff",
];

export const PAPER_DEMO_TAB_LABELS: Record<PaperDemoStep, string> = {
  before: "Before KG",
  missing: "Missing Triple",
  cluster: "Cluster Evidence",
  generation: "Generation",
  filtering: "Filtering",
  llm: "LLM Validation",
  human: "Human Validation",
  after: "After KG",
  diff: "Diff",
};

export type UserDecision = "accepted" | "rejected" | "uncertain" | null;
export type UserRefinementDecision = UserDecision;
export type DemoRole = "missing" | "invalid" | "review";
export type FilterResult = "PASSED" | "FILTERED_OUT";
export type EvidenceJudgement = "supports" | "contradicts" | "not_enough" | null;
export type LlmStrategy = "zero-shot" | "in-context" | "RAG";

export interface RagContextTriple {
  id: string;
  head: string;
  relation: string;
  tail: string;
}

export interface PaperDemoCandidate {
  id: string;
  head: string;
  relation: string;
  tail: string;
  structuralScore: number; // 0-1 normalized
  llmVerdict: "TRUE" | "FALSE" | "UNCERTAIN";
  llmConfidence: number; // 0-1
  llmStrategy: LlmStrategy;
  ragTopK: number;
  combinedScore: number; // 0-1
  status: "accepted" | "rejected" | "unresolved";
  demoRole: DemoRole;
  clusterKey: string;
  clusterHeads: string[];
  transEDistance: number;
  transEThreshold: number;
  ragContext: RagContextTriple[];
  sentenceText: string;
  rawPrompt?: string;
  sourceTriple?: { head: string; relation: string; tail: string };
  isMissingTriple?: boolean;
  isMissingTruple?: boolean;
  filteredOut?: boolean;
  filterResult?: FilterResult;
  expectedPath?: "accept" | "reject" | "reject_or_uncertain" | "review";
  sourceFactIds?: string[];
  ragContextIds?: string[];
  qualityRecommendation?: string;
  llmByStrategy?: Record<LlmStrategy, { verdict: "TRUE" | "FALSE" | "UNCERTAIN"; confidence: number; prompt?: string; context: string[]; explanation?: string; examples?: string[] }>;
  explanation?: string;
}

export type ValidationStage = "structural" | "semantic" | "decision" | "summary";
export interface CorrectionDraft {
  head: string;
  relation: string;
  tail: string;
  note: string;
}

export interface PaperStepDetail {
  step: number;
  title: string;
  what: string;
  why: string;
  runningExample: string;
  paperStatistic: string;
  userAction: string;
  warningNote?: string;
}
