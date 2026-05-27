import type { SliceMode } from "./datasetSlice";
import type { StepId } from "./stepLayoutConfig";

export type GraphDisplayMode = "explore" | "explain";

export function graphDisplayModeForStep(activeStep: string): GraphDisplayMode {
  return activeStep === "kg" ? "explore" : "explain";
}

/** Teacher-facing label for the left “Current graph view” card. */
export function graphViewLabelForStep(activeStep: string): string {
  switch (activeStep as StepId) {
    case "kg":
      return "Suggested graph sample";
    case "clustering":
      return "Selected pattern";
    case "candidates":
      return "Generated candidates";
    case "filtering":
      return "Filtering view";
    case "llm":
      return "Semantic validation view";
    case "feedback":
      return "Feedback view";
    case "completed":
      return "Completed graph";
    default:
      return "Graph view";
  }
}

export const EXPLAIN_MAX_MEMBERS = 5;

/** Default left-panel slice mode for each workflow step. */
export function sliceModeForWorkflowStep(activeStep: string): SliceMode {
  switch (activeStep as StepId) {
    case "clustering":
      return "cluster";
    case "candidates":
    case "filtering":
    case "llm":
      return "candidate";
    case "feedback":
    case "completed":
      return "feedback";
    default:
      return "guided";
  }
}

/** Slice modes shown in the left navigator for the active workflow step. */
export function sliceModesVisibleForStep(activeStep: string): SliceMode[] {
  switch (activeStep as StepId) {
    case "kg":
      return ["guided", "entity", "relation", "cluster", "candidate"];
    case "clustering":
      return ["guided", "cluster"];
    case "candidates":
    case "filtering":
    case "llm":
      return ["guided", "cluster", "candidate"];
    case "feedback":
    case "completed":
      return ["guided", "feedback"];
    default:
      return ["guided"];
  }
}
