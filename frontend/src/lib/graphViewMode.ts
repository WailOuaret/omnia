import type { StepId } from "./stepLayoutConfig";

/** User-facing graph presentation within a workflow step. */
export type GraphViewMode = "guided" | "explore";

export type InspectorListPanel = "members" | "candidates" | null;

export function defaultGraphViewModeForStep(activeStep: string): GraphViewMode {
  return activeStep === "kg" ? "explore" : "guided";
}

export function graphViewModeLabel(mode: GraphViewMode): string {
  return mode === "guided" ? "Guided view" : "Explore dataset";
}

export function isGuidedGraphStep(activeStep: string, viewMode: GraphViewMode): boolean {
  if (activeStep === "kg") return false;
  return viewMode === "guided";
}

export function exploreActionLabel(activeStep: string): string | null {
  switch (activeStep as StepId) {
    case "clustering":
      return "Explore this cluster";
    case "candidates":
      return "Explore candidate context";
    case "filtering":
    case "llm":
      return "Explore candidate in graph";
    case "feedback":
      return "View candidate in graph";
    case "completed":
      return "Explore completed graph";
    default:
      return null;
  }
}

export function showAllMembersLabel(activeStep: string): boolean {
  return activeStep === "clustering";
}

export function showAllCandidatesLabel(activeStep: string): boolean {
  return activeStep === "candidates";
}
