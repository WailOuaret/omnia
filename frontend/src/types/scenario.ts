import type { BackendCandidateRow, BackendClusterRow, BackendGraphSlice } from "../lib/api";
import type { DemoDatasetId } from "../demo-data/types";

export type ScenarioStepKey =
  | "kg"
  | "clustering"
  | "candidateGeneration"
  | "filtering"
  | "semanticValidation"
  | "feedback"
  | "completed";

export interface PaperDemoScenario {
  datasetId: DemoDatasetId;
  label: string;
  shortName?: string;
  source: string;
  sourceNote: string;
  description: string;
  whyInteresting: string;
  recommendedMode: "sentence-rag" | "triple-rag";
  publicStatus?: "public" | "private" | "demo-only";
  paperStats: {
    entities: number;
    relations: number;
    triples: number;
  };
  overviewSlice: BackendGraphSlice;
  selectedCluster: BackendClusterRow & { cluster_key?: string };
  selectedCandidate: BackendCandidateRow;
  generatedCandidates: BackendCandidateRow[];
  clusters: BackendClusterRow[];
  filtering: {
    available: boolean;
    model: string;
    threshold: number | null;
    beforeFiltering: number;
    afterFiltering: number;
  };
  llm: {
    available: boolean;
    strategy: string;
    topK: number | null;
    promptMode: string;
  };
  limitations: string[];
  steps: Record<ScenarioStepKey, { graphSlice: BackendGraphSlice }>;
  defaultClusterId?: string;
  defaultCandidateId?: string;
}

export const SCENARIO_FILES: Record<string, string> = {
  codexM: "/demo-scenarios/codexM_demo.json",
  fb15k237: "/demo-scenarios/fb15k237_demo.json",
  wn18rr: "/demo-scenarios/wn18rr_demo.json",
  covidFact: "/demo-scenarios/covidFact_static_demo.json",
};

export function scenarioStepKeyForActiveStep(activeStep: string): ScenarioStepKey {
  switch (activeStep) {
    case "kg":
      return "kg";
    case "clustering":
      return "clustering";
    case "candidates":
      return "candidateGeneration";
    case "filtering":
      return "filtering";
    case "llm":
      return "semanticValidation";
    case "feedback":
      return "feedback";
    case "completed":
      return "completed";
    default:
      return "kg";
  }
}
