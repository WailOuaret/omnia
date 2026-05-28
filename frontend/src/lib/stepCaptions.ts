import type { StepId } from "./stepLayoutConfig";

/** One short sentence above the graph — teacher-facing only. */
export const STEP_CAPTION: Record<StepId, string> = {
  kg: "Explore the graph — click any node or edge.",
  clustering: "Heads sharing the same relation → tail pattern are grouped.",
  candidates: "Blue dashed edges are triples OMNIA proposes to add.",
  filtering: "Candidates that fit the graph poorly are removed here.",
  llm: "The LLM checks whether the proposed triple makes sense.",
  feedback: "Accept, reject, mark uncertain, or correct the proposed triple.",
  completed: "Summary of what changed after your feedback.",
};

export function stepCaptionFor(activeStep: string): string {
  return STEP_CAPTION[activeStep as StepId] ?? STEP_CAPTION.kg;
}
