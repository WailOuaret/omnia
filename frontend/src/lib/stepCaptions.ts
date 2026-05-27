import type { StepId } from "./stepLayoutConfig";

/** One short sentence above the graph — teacher-facing only. */
export const STEP_CAPTION: Record<StepId, string> = {
  kg: "Click a node or edge to inspect the knowledge graph.",
  clustering: "Entities with the same relation → tail pattern are grouped together.",
  candidates: "Dashed blue arrows show missing triples proposed by OMNIA.",
  filtering: "OMNIA removes candidates that do not fit the graph structure.",
  llm: "OMNIA checks whether the proposed triple makes sense using evidence.",
  feedback: "Review the proposed triple and choose accept, reject, uncertain, or correct.",
  completed: "See what changed after feedback.",
};

export function stepCaptionFor(activeStep: string): string {
  return STEP_CAPTION[activeStep as StepId] ?? STEP_CAPTION.kg;
}
