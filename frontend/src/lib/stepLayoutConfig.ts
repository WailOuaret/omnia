export type StepId =
  | "kg"
  | "clustering"
  | "candidates"
  | "filtering"
  | "llm"
  | "feedback"
  | "completed";

export interface StepLayoutConfig {
  columnX: {
    members: number;
    shared: number;
    candidates: number;
    context: number;
  };
  showClusterBox: boolean;
  showCandidateEdges: boolean;
  showFilterStatus: boolean;
  showLlmVerdict: boolean;
  dimOriginalEdges: boolean;
  useDagreLayout: boolean;
  memberSpreadGap: number;
  caption: string;
}

export const STEP_LAYOUT: Record<StepId, StepLayoutConfig> = {
  kg: {
    columnX: { members: 100, shared: 500, candidates: 800, context: 300 },
    showClusterBox: false,
    showCandidateEdges: false,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: false,
    useDagreLayout: true,
    memberSpreadGap: 96,
    caption:
      "This is the incomplete knowledge graph. Click a node or edge to inspect it.",
  },
  clustering: {
    columnX: { members: 80, shared: 520, candidates: 800, context: 750 },
    showClusterBox: true,
    showCandidateEdges: false,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    memberSpreadGap: 120,
    caption: "Grouped by the same relation → tail pattern.",
  },
  candidates: {
    columnX: { members: 80, shared: 480, candidates: 820, context: 750 },
    showClusterBox: true,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    memberSpreadGap: 120,
    caption: "Dashed blue arrows show missing triples proposed by OMNIA.",
  },
  filtering: {
    columnX: { members: 80, shared: 480, candidates: 820, context: 750 },
    showClusterBox: true,
    showCandidateEdges: true,
    showFilterStatus: true,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    memberSpreadGap: 120,
    caption: "This step removes structurally unlikely candidates.",
  },
  llm: {
    columnX: { members: 80, shared: 480, candidates: 820, context: 750 },
    showClusterBox: false,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: true,
    dimOriginalEdges: true,
    useDagreLayout: false,
    memberSpreadGap: 120,
    caption: "This step checks whether the candidate makes sense using retrieved evidence.",
  },
  feedback: {
    columnX: { members: 80, shared: 480, candidates: 820, context: 750 },
    showClusterBox: false,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    memberSpreadGap: 120,
    caption: "The user reviews the candidate and updates the graph.",
  },
  completed: {
    columnX: { members: 100, shared: 500, candidates: 800, context: 300 },
    showClusterBox: false,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: false,
    useDagreLayout: false,
    memberSpreadGap: 96,
    caption: "This final view shows the updated graph and what changed.",
  },
};

export function stepLayoutFor(activeStep: string): StepLayoutConfig {
  return STEP_LAYOUT[activeStep as StepId] ?? STEP_LAYOUT.kg;
}
