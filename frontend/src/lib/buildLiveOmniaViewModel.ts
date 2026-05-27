/**
 * Canonical live-mode view model for the paper demo.
 * Live step views must consume this object — not DATASETS or sessionToDemoDataset graph fields.
 */

import type {
  BackendCandidateRow,
  BackendClusterRow,
  BackendGraphSlice,
  BackendSessionMeta,
} from "./api";
import { DATASETS } from "../demo-data/datasets";
import type { DemoCandidate, DemoCluster, DemoDatasetConfig, DemoDatasetId } from "../demo-data/types";
import type { GraphPayload } from "../types";
import { applyStepGraphPresentation } from "./applyStepGraphPresentation";
import { pickDefaultCandidateId, pickDefaultClusterId } from "./pickDefaultCluster";
import { sessionSliceToGraphPayload } from "./sessionSliceToGraphPayload";
import { sampleIdToDemoDatasetId } from "./sessionToDemoDataset";

type Decision = "accept" | "reject" | "uncertain" | "correct";

export interface LiveOmniaDiagnostics {
  selectedClusterId: string | null;
  selectedCandidateId: string | null;
  candidateSourceCluster: string | null;
  mismatch: boolean;
  filteringAvailable: boolean;
  llmAvailable: boolean;
  graphSource: "backend_session_slice";
}

export interface LiveOmniaViewModel {
  mode: "live";
  datasetId: DemoDatasetId;
  sessionId: string;
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
  diagnostics: LiveOmniaDiagnostics;
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

function clustersFromBackend(rows: BackendClusterRow[]): DemoCluster[] {
  return rows.map((row, idx) => ({
    id: row.cluster_id || `C${idx + 1}`,
    key: `${row.shared_relation}::${row.shared_tail}`,
    sharedRelation: row.shared_relation,
    sharedTail: row.shared_tail,
    entities: row.members ?? [],
    size: row.size ?? (row.members?.length ?? 0),
  }));
}

function candidatesFromBackend(rows: BackendCandidateRow[]): DemoCandidate[] {
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
    whyGenerated:
      typeof row.why_generated === "string"
        ? row.why_generated
        : "Generated because this head belongs to the selected cluster and the relation-tail pair appears in the same cluster context.",
  }));
}

function metadataFromSession(meta: BackendSessionMeta | null, datasetId: DemoDatasetId): DemoDatasetConfig {
  const template = DATASETS[datasetId];
  return {
    ...template,
    id: datasetId,
    label: meta?.dataset_name || template.label,
    entities: meta?.entity_count ?? template.entities,
    relations: meta?.relation_count ?? template.relations,
    triples: meta?.triple_count ?? template.triples,
    source: meta?.source_type === "sample" ? template.source : "Backend session",
    note: "Live dataset sample",
    role: "live-mode",
    graph: { nodes: [], edges: [], clusterBoxes: [] },
    clusters: [],
    candidates: [],
    filteringStats: {
      model: "TransE (session)",
      threshold: Number.NaN,
      beforeFiltering: 0,
      afterFiltering: 0,
    },
    llmStats: {
      strategy: "Backend RAG (session)",
      topK: null as unknown as number,
      confidence: 0,
      verdict: "unavailable",
    },
  };
}

function candidateBelongsToCluster(candidate: DemoCandidate, clusterId: string): boolean {
  return Boolean(candidate.clusterIds?.includes(clusterId));
}

function filterCandidatesForCluster(candidates: DemoCandidate[], clusterId: string | null): DemoCandidate[] {
  if (!clusterId) return [];
  return candidates.filter((candidate) => candidateBelongsToCluster(candidate, clusterId));
}

function computeFiltering(candidates: DemoCandidate[], explanation?: BackendGraphSlice["explanation"]) {
  const rows = candidates.filter(
    (c) => typeof c.distance === "number" && typeof c.threshold === "number" && (c.threshold ?? 0) > 0,
  );
  const available = Boolean(explanation?.filtering_available) && rows.length > 0;
  const kept = rows.filter((c) => (c.distance ?? Infinity) <= (c.threshold ?? 0)).length;
  const threshold = rows[0]?.threshold ?? null;
  return {
    available,
    model: available ? "TransE (real session)" : "TransE (unavailable)",
    threshold: available ? threshold : null,
    beforeFiltering: available ? rows.length : 0,
    afterFiltering: available ? kept : 0,
    kept: available ? kept : 0,
    removed: available ? rows.length - kept : 0,
    retainedPct: available && rows.length > 0 ? Math.round((kept / rows.length) * 100) : null,
  };
}

function computeLlm(explanation: BackendGraphSlice["explanation"] | undefined, metadata: DemoDatasetConfig) {
  const available = Boolean(explanation?.llm_available);
  return {
    available,
    strategy: available ? "Backend RAG (real session)" : "Backend RAG (unavailable)",
    topK: available ? 3 : null,
    promptMode: metadata.recommendedMode === "sentence-rag" ? "Sentence-based RAG" : "Triple-based RAG",
  };
}

export interface BuildLiveOmniaViewModelInput {
  sessionId: string;
  meta: BackendSessionMeta | null;
  graphSlice: BackendGraphSlice;
  clusters: BackendClusterRow[];
  candidates: BackendCandidateRow[];
  activeStep: string;
  selectedClusterId: string | null;
  selectedCandidateId: string | null;
  feedbackDecisions?: Record<string, Decision>;
}

export function buildLiveOmniaViewModel({
  sessionId,
  meta,
  graphSlice,
  clusters,
  candidates,
  activeStep,
  selectedClusterId,
  selectedCandidateId,
  feedbackDecisions = {},
}: BuildLiveOmniaViewModelInput): LiveOmniaViewModel {
  const datasetId = sampleIdToDemoDatasetId(meta?.sample_id) ?? "codexM";
  const metadata = metadataFromSession(meta, datasetId);
  const demoClusters = clustersFromBackend(clusters.length ? clusters : graphSlice.clusters ?? []);
  const allCandidates = candidatesFromBackend(candidates.length ? candidates : graphSlice.candidates ?? []);

  const backendClusterId = graphSlice.selected_cluster?.cluster_id ?? null;
  const effectiveClusterId =
    pickDefaultClusterId(
      demoClusters,
      allCandidates,
      selectedClusterId && demoClusters.some((c) => c.id === selectedClusterId)
        ? selectedClusterId
        : backendClusterId,
    ) ?? backendClusterId;

  const clusterCandidates = filterCandidatesForCluster(allCandidates, effectiveClusterId);

  const backendCandidateId = graphSlice.selected_candidate?.candidate_id ?? null;
  const effectiveCandidateId = pickDefaultCandidateId(
    allCandidates,
    effectiveClusterId,
    selectedCandidateId &&
      clusterCandidates.some((c) => c.candidateId === selectedCandidateId)
      ? selectedCandidateId
      : backendCandidateId,
  );

  const selectedCluster = demoClusters.find((c) => c.id === effectiveClusterId) ?? null;
  const selectedCandidate =
    clusterCandidates.find((c) => c.candidateId === effectiveCandidateId) ?? null;

  const candidateSourceCluster = selectedCandidate?.clusterIds?.[0] ?? null;
  const mismatch = Boolean(
    effectiveClusterId &&
      selectedCandidate &&
      !candidateBelongsToCluster(selectedCandidate, effectiveClusterId),
  );

  const filtering = computeFiltering(clusterCandidates, graphSlice.explanation);
  const llm = computeLlm(graphSlice.explanation, metadata);

  const graph = applyStepGraphPresentation(
    sessionSliceToGraphPayload({
      slice: graphSlice,
      activeStep,
      candidates: clusterCandidates,
      selectedCandidate,
      selectedClusterId: effectiveClusterId,
      feedbackDecisions,
    }),
    activeStep,
  );

  return {
    mode: "live",
    datasetId,
    sessionId,
    metadata: {
      ...metadata,
      clusters: demoClusters,
      candidates: clusterCandidates,
      filteringStats: {
        model: filtering.model,
        threshold: filtering.threshold ?? Number.NaN,
        beforeFiltering: filtering.beforeFiltering,
        afterFiltering: filtering.afterFiltering,
      },
      llmStats: {
        strategy: llm.strategy,
        topK: llm.topK ?? 0,
        confidence: 0,
        verdict: llm.available ? "mixed" : "unavailable",
      },
    },
    graph,
    selectedCluster,
    selectedCandidate,
    clusters: demoClusters,
    candidates: clusterCandidates,
    filtering,
    llm,
    diagnostics: {
      selectedClusterId: effectiveClusterId,
      selectedCandidateId: selectedCandidate?.candidateId ?? null,
      candidateSourceCluster,
      mismatch,
      filteringAvailable: filtering.available,
      llmAvailable: llm.available,
      graphSource: "backend_session_slice",
    },
  };
}

export { candidateBelongsToCluster, filterCandidatesForCluster };
