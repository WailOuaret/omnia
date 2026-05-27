/**
 * Static demo dataset helpers and backend ID mapping.
 * Live graph rendering uses buildLiveOmniaViewModel — not sessionToDemoDataset.
 */

import type {
  BackendCandidateRow,
  BackendClusterRow,
  BackendGraphSlice,
  BackendSessionMeta,
} from "./api";
import { DATASETS } from "../demo-data/datasets";
import type {
  DemoCandidate,
  DemoCluster,
  DemoDatasetConfig,
  DemoDatasetId,
  GraphEdge,
  GraphNode,
} from "../demo-data/types";

// ─────────────────────────────────────────────────────────────────────────────
// Edge status mapping. Backend buckets are richer than the static enum; we
// downcast to the closest static value so existing renderers keep working.
// ─────────────────────────────────────────────────────────────────────────────
function mapEdgeStatus(status: string): GraphEdge["status"] {
  switch (status) {
    case "known":
      return "known";
    case "accepted":
    case "llm_valid":
    case "kept":
      return "accepted";
    case "rejected":
    case "llm_invalid":
    case "removed":
      return "rejected";
    case "corrected":
      return "accepted";
    case "candidate":
    case "uncertain":
    case "llm_uncertain":
    default:
      return "candidate";
  }
}

function mapCandidateStatus(bucket: string): DemoCandidate["status"] {
  switch (bucket) {
    case "known":
      return "kept";
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

function mapLlmVerdict(bucket: string): DemoCandidate["llmVerdict"] | undefined {
  if (bucket === "llm_valid" || bucket === "accepted") return "valid";
  if (bucket === "llm_invalid" || bucket === "rejected") return "invalid";
  if (bucket === "llm_uncertain" || bucket === "uncertain") return "uncertain";
  return undefined;
}

// Compute auto-layout positions so the dynamic graph renders nicely. The
// existing BenchmarkMiniGraph reads `x` / `y` from each node when present.
function laidOutNodes(slice: BackendGraphSlice): GraphNode[] {
  const n = slice.nodes.length;
  if (n === 0) return [];
  const centerX = 500;
  const centerY = 320;
  const radius = Math.max(160, Math.min(280, 60 + n * 14));
  return slice.nodes.map((node, idx) => {
    const angle = (idx / n) * Math.PI * 2;
    return {
      id: node.id,
      label: node.label || node.id,
      shortLabel: (node.label || node.id).slice(0, 18),
      type: node.type ?? "entity",
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

function edgesFromSlice(slice: BackendGraphSlice): GraphEdge[] {
  return slice.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    shortLabel: edge.label.slice(0, 14),
    fullLabel: edge.label,
    status: mapEdgeStatus(edge.status),
  }));
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
    llmVerdict: mapLlmVerdict(row.status_bucket),
    llmConfidence: row.llm_score ?? undefined,
    llmRationale: row.llm_rationale || undefined,
    retrievedContext: Array.isArray(row.retrieved_context)
      ? (row.retrieved_context as string[]).filter((v) => typeof v === "string")
      : undefined,
    clusterIds: row.cluster_ids ?? [],
  }));
}

export interface SessionToDemoOptions {
  meta: BackendSessionMeta | null;
  slice: BackendGraphSlice | null;
  clusters: BackendClusterRow[];
  candidates: BackendCandidateRow[];
}

/** Map backend benchmark sample ids to frontend demo dataset ids. */
export function sampleIdToDemoDatasetId(sampleId?: string | null): DemoDatasetId | null {
  if (!sampleId) return null;
  const normalized = sampleId.toLowerCase().replace(/-/g, "_");
  if (normalized.includes("codex")) return "codexM";
  if (normalized.includes("fb15k")) return "fb15k237";
  if (normalized.includes("wn18")) return "wn18rr";
  if (normalized.includes("covid")) return "covidFact";
  if (normalized.includes("socio")) return "socioEconomic";
  return null;
}

/** Map frontend demo dataset ids to backend sample ids for session creation. */
export function demoDatasetIdToSampleId(datasetId: DemoDatasetId): string | null {
  switch (datasetId) {
    case "codexM":
      return "omnia_codex_m";
    case "fb15k237":
      return "omnia_fb15k-237";
    case "wn18rr":
      return "omnia_wn18rr";
    case "covidFact":
      return "omnia_covid_fact";
    case "socioEconomic":
      return null;
    default:
      return null;
  }
}

/**
 * @deprecated Live mode uses buildLiveOmniaViewModel. Static demos use DATASETS directly.
 * Kept for legacy imports/tests only.
 */
export function sessionToDemoDataset({
  meta,
  slice,
  clusters,
  candidates,
}: SessionToDemoOptions): DemoDatasetConfig {
  const datasetId = sampleIdToDemoDatasetId(meta?.sample_id) ?? "codexM";
  const template = DATASETS[datasetId];
  const label = meta?.dataset_name || template.label;
  const nodes = slice ? laidOutNodes(slice) : [];
  const edges = slice ? edgesFromSlice(slice) : [];
  const demoClusters = clustersFromBackend(clusters);
  const demoCandidates = candidatesFromBackend(candidates);

  const thresholdSample = candidates.find((c) => c.threshold != null && c.threshold > 0);
  const hasFilterData = candidates.some(
    (c) => c.distance != null && c.threshold != null && c.threshold > 0,
  );
  const fallbackThreshold = thresholdSample?.threshold ?? null;
  const kept = candidates.filter((c) => {
    if (["kept", "llm_valid", "accepted"].includes(c.status_bucket)) return true;
    const threshold = c.threshold ?? fallbackThreshold;
    return c.distance != null && threshold != null && threshold > 0 && c.distance <= threshold;
  }).length;

  return {
    id: datasetId,
    label,
    shortName: template.shortName,
    source: meta?.source_type === "sample" ? template.source : "Backend session",
    publicStatus: template.publicStatus,
    description: template.description,
    whyInteresting: template.whyInteresting,
    entities: meta?.entity_count ?? template.entities,
    relations: meta?.relation_count ?? template.relations,
    triples: meta?.triple_count ?? template.triples,
    recommendedMode: template.recommendedMode,
    bestF1: template.bestF1,
    note: "Live dataset sample",
    role: "live-mode",
    graph: { nodes, edges, clusterBoxes: [] },
    clusters: demoClusters,
    candidates: demoCandidates,
    filteringStats: {
      model: "TransE (real session)",
      threshold: hasFilterData ? (thresholdSample?.threshold ?? Number.NaN) : Number.NaN,
      beforeFiltering: hasFilterData ? candidates.length : 0,
      afterFiltering: hasFilterData ? kept : 0,
    },
    llmStats: {
      strategy: "Backend RAG (real session)",
      topK: 3,
      confidence:
        candidates.reduce((sum, c) => sum + (c.llm_score ?? 0), 0) / Math.max(1, candidates.length),
      verdict: "mixed",
    },
  };
}
