/**
 * Build the paper-demo view model from a static scenario JSON file.
 */

import { DATASETS } from "../demo-data/datasets";
import type { DemoCandidate, DemoCluster, DemoDatasetConfig, DemoDatasetId } from "../demo-data/types";
import type { PaperDemoScenario } from "../types/scenario";
import { scenarioStepKeyForActiveStep } from "../types/scenario";
import type { GraphPayload } from "../types";
import { applyStepGraphPresentation } from "./applyStepGraphPresentation";
import { sessionSliceToGraphPayload } from "./sessionSliceToGraphPayload";
import { synthesizeClusterSlice } from "./synthesizeClusterSlice";
import {
  buildLiveOmniaViewModel,
  candidateBelongsToCluster,
  filterCandidatesForCluster,
} from "./buildLiveOmniaViewModel";
import { pickDefaultCandidateId, pickDefaultClusterId } from "./pickDefaultCluster";
import { limitationsForDemo } from "./demoLimitations";

type Decision = "accept" | "reject" | "uncertain" | "correct";

export interface StaticOmniaDiagnostics {
  selectedClusterId: string | null;
  selectedCandidateId: string | null;
  candidateSourceCluster: string | null;
  mismatch: boolean;
  filteringAvailable: boolean;
  llmAvailable: boolean;
  graphSource: "static_interactive_scenario";
}

export interface StaticOmniaViewModel {
  mode: "static";
  datasetId: DemoDatasetId;
  metadata: DemoDatasetConfig;
  graph: GraphPayload;
  selectedCluster: DemoCluster | null;
  selectedCandidate: DemoCandidate | null;
  clusters: DemoCluster[];
  candidates: DemoCandidate[];
  filtering: {
    available: boolean;
    model: string;
    threshold: number | null;
    beforeFiltering: number;
    afterFiltering: number;
    kept: number;
    removed: number;
    retainedPct: number | null;
  };
  llm: {
    available: boolean;
    strategy: string;
    topK: number | null;
    promptMode: string;
  };
  diagnostics: StaticOmniaDiagnostics;
  limitations: string[];
  sourceNote: string;
}

function mapCandidateStatus(bucket: string): DemoCandidate["status"] {
  switch (bucket) {
    case "known":
    case "kept":
      return "kept";
    case "removed":
      return "removed";
    case "llm_valid":
    case "accepted":
      return "accepted";
    case "llm_invalid":
    case "rejected":
      return "rejected";
    case "corrected":
      return "corrected";
    case "llm_uncertain":
    case "uncertain":
      return "uncertain";
    default:
      return "candidate";
  }
}

function mapLlmVerdict(bucket: string, llmDecision?: string): DemoCandidate["llmVerdict"] | undefined {
  if (llmDecision === "valid") return "valid";
  if (llmDecision === "invalid") return "invalid";
  if (llmDecision === "uncertain") return "uncertain";
  if (bucket === "llm_valid" || bucket === "accepted") return "valid";
  if (bucket === "llm_invalid" || bucket === "rejected") return "invalid";
  if (bucket === "llm_uncertain" || bucket === "uncertain") return "uncertain";
  return undefined;
}

function clustersFromScenario(rows: PaperDemoScenario["clusters"]): DemoCluster[] {
  return rows.map((row, idx) => ({
    id: row.cluster_id || `C${idx + 1}`,
    key: `${row.shared_relation}::${row.shared_tail}`,
    sharedRelation: row.shared_relation,
    sharedTail: row.shared_tail,
    entities: row.members ?? [],
    size: row.size ?? (row.members?.length ?? 0),
  }));
}

function candidatesFromScenario(rows: PaperDemoScenario["generatedCandidates"]): DemoCandidate[] {
  return rows.map((row) => ({
    candidateId: row.candidate_id,
    head: row.Head,
    relation: row.Relation,
    tail: row.Tail,
    status: mapCandidateStatus(row.status_bucket),
    distance: row.distance ?? undefined,
    threshold: row.threshold ?? undefined,
    llmVerdict: mapLlmVerdict(row.status_bucket, row.llm_decision),
    llmConfidence: row.llm_score ?? undefined,
    llmRationale: row.llm_rationale || undefined,
    retrievedContext: Array.isArray(row.retrieved_context)
      ? (row.retrieved_context as string[]).filter((v) => typeof v === "string")
      : undefined,
    clusterIds: row.cluster_ids ?? (row.source_cluster ? [row.source_cluster] : []),
    whyGenerated: row.why_generated || undefined,
  }));
}

export interface BuildScenarioViewModelInput {
  scenario: PaperDemoScenario;
  activeStep: string;
  selectedClusterId: string | null;
  selectedCandidateId: string | null;
  feedbackDecisions?: Record<string, Decision>;
}

export function buildScenarioViewModel({
  scenario,
  activeStep,
  selectedClusterId,
  selectedCandidateId,
  feedbackDecisions = {},
}: BuildScenarioViewModelInput): StaticOmniaViewModel {
  const datasetId = scenario.datasetId;
  const template = DATASETS[datasetId];
  const stepKey = scenarioStepKeyForActiveStep(activeStep);
  const baseGraphSlice = scenario.steps[stepKey]?.graphSlice ?? scenario.overviewSlice;

  const demoClusters = clustersFromScenario(scenario.clusters);
  const allCandidates = candidatesFromScenario(scenario.generatedCandidates);

  const effectiveClusterId =
    pickDefaultClusterId(
      demoClusters,
      allCandidates,
      selectedClusterId && demoClusters.some((c) => c.id === selectedClusterId)
        ? selectedClusterId
        : scenario.defaultClusterId ?? scenario.selectedCluster.cluster_id,
    ) ?? scenario.selectedCluster.cluster_id;

  const clusterCandidates = filterCandidatesForCluster(allCandidates, effectiveClusterId);
  const clusterRow = scenario.clusters.find((row) => row.cluster_id === effectiveClusterId);

  const graphSlice =
    activeStep !== "kg" &&
    clusterRow &&
    baseGraphSlice.selected_cluster?.cluster_id !== effectiveClusterId
      ? synthesizeClusterSlice(
          baseGraphSlice,
          clusterRow,
          clusterCandidates,
          clusterCandidates.find((c) => c.candidateId === selectedCandidateId) ?? null,
        )
      : baseGraphSlice;

  const effectiveCandidateId = pickDefaultCandidateId(
    allCandidates,
    effectiveClusterId,
    selectedCandidateId &&
      clusterCandidates.some((c) => c.candidateId === selectedCandidateId)
      ? selectedCandidateId
      : scenario.defaultCandidateId ?? null,
  );

  const selectedCluster = demoClusters.find((c) => c.id === effectiveClusterId) ?? null;
  const selectedCandidate =
    clusterCandidates.find((c) => c.candidateId === effectiveCandidateId) ?? null;

  const filteringAvailable = Boolean(scenario.filtering.available);
  const llmAvailable = Boolean(scenario.llm.available);
  const kept = filteringAvailable ? scenario.filtering.afterFiltering : 0;
  const before = filteringAvailable ? scenario.filtering.beforeFiltering : 0;

  const graph = applyStepGraphPresentation(
    sessionSliceToGraphPayload({
      slice: { ...graphSlice, source: graphSlice.source ?? "static_scenario" },
      activeStep,
      candidates: clusterCandidates,
      selectedCandidate,
      selectedClusterId: effectiveClusterId,
      feedbackDecisions,
    }),
    activeStep,
  );

  graph.stepCaption =
    graph.stepCaption ??
    "Prepared interactive scenario generated from the OMNIA workflow (no live backend required).";

  const metadata: DemoDatasetConfig = {
    ...template,
    id: datasetId,
    label: scenario.label,
    shortName: scenario.shortName ?? template.shortName,
    source: scenario.source,
    description: scenario.description,
    whyInteresting: scenario.whyInteresting,
    entities: scenario.paperStats.entities,
    relations: scenario.paperStats.relations,
    triples: scenario.paperStats.triples,
    recommendedMode: scenario.recommendedMode,
    note: scenario.sourceNote,
    role: "static-interactive-scenario",
    graph: { nodes: [], edges: [], clusterBoxes: [] },
    clusters: demoClusters,
    candidates: allCandidates,
    filteringStats: {
      model: scenario.filtering.model,
      threshold: scenario.filtering.threshold ?? Number.NaN,
      beforeFiltering: scenario.filtering.beforeFiltering,
      afterFiltering: scenario.filtering.afterFiltering,
    },
    llmStats: {
      strategy: scenario.llm.strategy,
      topK: scenario.llm.topK ?? 0,
      confidence: 0,
      verdict: llmAvailable ? "mixed" : "unavailable",
    },
  };

  return {
    mode: "static",
    datasetId,
    metadata,
    graph,
    selectedCluster,
    selectedCandidate,
    clusters: demoClusters,
    candidates: clusterCandidates,
    filtering: {
      available: filteringAvailable,
      model: scenario.filtering.model,
      threshold: scenario.filtering.threshold,
      beforeFiltering: before,
      afterFiltering: kept,
      kept,
      removed: filteringAvailable ? before - kept : 0,
      retainedPct: filteringAvailable && before > 0 ? Math.round((kept / before) * 100) : null,
    },
    llm: {
      available: llmAvailable,
      strategy: scenario.llm.strategy,
      topK: scenario.llm.topK,
      promptMode: scenario.llm.promptMode,
    },
    diagnostics: {
      selectedClusterId: effectiveClusterId,
      selectedCandidateId: selectedCandidate?.candidateId ?? null,
      candidateSourceCluster: selectedCandidate?.clusterIds?.[0] ?? null,
      mismatch: Boolean(
        effectiveClusterId &&
          selectedCandidate &&
          !candidateBelongsToCluster(selectedCandidate, effectiveClusterId),
      ),
      filteringAvailable,
      llmAvailable,
      graphSource: "static_interactive_scenario",
    },
    limitations: limitationsForDemo(true, scenario.limitations),
    sourceNote: scenario.sourceNote,
  };
}

export { candidateBelongsToCluster, filterCandidatesForCluster };
