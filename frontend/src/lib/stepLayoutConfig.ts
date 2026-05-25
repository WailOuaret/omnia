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
    caption:
      "The raw knowledge graph. Each edge is a confirmed (head, relation, tail) triple from the backend session slice.",
  },
  clustering: {
    columnX: { members: 100, shared: 500, candidates: 800, context: 750 },
    showClusterBox: true,
    showCandidateEdges: false,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    caption:
      "Entities sharing the same (relation, tail) pair are grouped into a cluster. The purple box shows the selected cluster.",
  },
  candidates: {
    columnX: { members: 100, shared: 480, candidates: 820, context: 750 },
    showClusterBox: true,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    caption:
      "For each head in the cluster, OMNIA proposes a new triple (dashed blue arrows). The highlighted arrow is the selected candidate.",
  },
  filtering: {
    columnX: { members: 100, shared: 480, candidates: 820, context: 750 },
    showClusterBox: true,
    showCandidateEdges: true,
    showFilterStatus: true,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    caption:
      "TransE distance filters implausible candidates. Green = kept. Red = removed.",
  },
  llm: {
    columnX: { members: 100, shared: 480, candidates: 820, context: 750 },
    showClusterBox: false,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: true,
    dimOriginalEdges: true,
    useDagreLayout: false,
    caption:
      "The LLM validates surviving candidates using retrieved context. Green = valid. Red = invalid.",
  },
  feedback: {
    columnX: { members: 100, shared: 480, candidates: 820, context: 750 },
    showClusterBox: false,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: true,
    useDagreLayout: false,
    caption:
      "Your decision updates the graph immediately. Accept, Reject, Correct, or mark Uncertain.",
  },
  completed: {
    columnX: { members: 100, shared: 500, candidates: 800, context: 300 },
    showClusterBox: false,
    showCandidateEdges: true,
    showFilterStatus: false,
    showLlmVerdict: false,
    dimOriginalEdges: false,
    useDagreLayout: false,
    caption:
      "The completed knowledge graph. Green = accepted additions. Grey = original triples.",
  },
};

export function stepLayoutFor(activeStep: string): StepLayoutConfig {
  return STEP_LAYOUT[activeStep as StepId] ?? STEP_LAYOUT.kg;
}
