import type {
  GraphEdge,
  GraphEdgeStatus,
  GraphNode,
  GraphNodeStage,
  GraphPayload,
} from "../types";
import type { DemoCandidate } from "../demo-data/types";
import type { BackendGraphSlice } from "./api";

type Decision = "accept" | "reject" | "uncertain" | "correct";

interface SessionSliceToGraphPayloadOptions {
  slice: BackendGraphSlice;
  activeStep: string;
  candidates?: DemoCandidate[];
  selectedCandidate?: DemoCandidate | null;
  selectedClusterId?: string | null;
  feedbackDecisions?: Record<string, Decision>;
}

const STEP_TO_NODE_STAGE: Record<string, GraphNodeStage> = {
  kg: "original",
  clustering: "cluster",
  candidates: "candidate",
  filtering: "filtered",
  llm: "validated",
  feedback: "validated",
  completed: "completed",
};

function statusFromBackend(status?: string | null): GraphEdgeStatus {
  switch ((status ?? "").toLowerCase()) {
    case "known":
    case "original":
      return "original";
    case "candidate":
      return "generated";
    case "kept":
      return "filtered_passed";
    case "removed":
      return "filtered_rejected";
    case "llm_valid":
      return "llm_accepted";
    case "llm_invalid":
      return "llm_rejected";
    case "llm_uncertain":
      return "unresolved";
    case "accepted":
    case "corrected":
      return "llm_accepted";
    case "rejected":
      return "llm_rejected";
    case "uncertain":
      return "unresolved";
    default:
      return "generated";
  }
}

function statusFromDecision(decision?: Decision): GraphEdgeStatus | null {
  if (!decision) return null;
  if (decision === "accept" || decision === "correct") return "llm_accepted";
  if (decision === "reject") return "llm_rejected";
  return "unresolved";
}

function viewFromMode(mode: string): GraphPayload["view"] {
  if (mode === "cluster") return "cluster";
  if (mode === "entity" || mode === "relation" || mode === "candidate" || mode === "feedback") {
    return "neighborhood";
  }
  return "summary";
}

function normalizeNodeKind(type?: string): GraphNode["kind"] {
  const normalized = (type ?? "").toLowerCase();
  if (normalized === "component") return "component";
  if (normalized === "cluster") return "cluster";
  if (normalized === "candidate") return "candidate";
  return "entity";
}

export function sessionSliceToGraphPayload({
  slice,
  activeStep,
  candidates = [],
  selectedCandidate,
  selectedClusterId,
  feedbackDecisions = {},
}: SessionSliceToGraphPayloadOptions): GraphPayload {
  const degreeByNode = new Map<string, number>();
  const highlightedNodeIds = new Set<string>();
  const selectedCandidateId = selectedCandidate?.candidateId ?? null;
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const selectedClusterCandidateIds = new Set(
    selectedClusterId
      ? candidates
          .filter((candidate) => candidate.clusterIds?.includes(selectedClusterId))
          .map((candidate) => candidate.candidateId)
      : [],
  );

  for (const edge of slice.edges) {
    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1);
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1);
    const clusterHighlighted = Boolean(edge.candidate_id && selectedClusterCandidateIds.has(edge.candidate_id));
    if ((selectedCandidateId && edge.candidate_id === selectedCandidateId) || clusterHighlighted) {
      highlightedNodeIds.add(edge.source);
      highlightedNodeIds.add(edge.target);
    }
  }

  const stage = STEP_TO_NODE_STAGE[activeStep] ?? "original";
  const nodes: GraphNode[] = slice.nodes.map((node) => {
    const degree = degreeByNode.get(node.id) ?? 0;
    return {
      id: node.id,
      label: node.label || node.id,
      kind: normalizeNodeKind(node.type),
      stage,
      degree,
      is_isolated: degree === 0,
      highlighted: highlightedNodeIds.has(node.id),
      description: node.source ? `Source: ${node.source}` : null,
    };
  });

  const edges: GraphEdge[] = slice.edges.map((edge) => {
    const decisionStatus = edge.candidate_id
      ? statusFromDecision(feedbackDecisions[edge.candidate_id])
      : null;
    const status = decisionStatus ?? statusFromBackend(edge.status);
    const highlighted = Boolean(
      (selectedCandidateId && edge.candidate_id === selectedCandidateId) ||
      (edge.candidate_id && selectedClusterCandidateIds.has(edge.candidate_id)),
    );
    const candidate = edge.candidate_id ? candidateById.get(edge.candidate_id) : undefined;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      status,
      highlighted,
      candidate_id: edge.candidate_id ?? null,
      raw_status: edge.status ?? null,
      provenance_label: edge.provenance ?? null,
      distance: edge.distance ?? null,
      threshold: edge.threshold ?? null,
      llm_decision: edge.status ?? null,
      provenance: {
        cluster_id: candidate?.clusterIds?.[0],
        generated_candidate: edge.candidate_id
          ? {
              Head: edge.source,
              Relation: edge.label,
              Tail: edge.target,
              DisplayHead: edge.source,
              DisplayRelation: edge.label,
              DisplayTail: edge.target,
            }
          : undefined,
      },
    };
  });

  return {
    nodes,
    edges,
    view: viewFromMode(slice.mode),
    aggregated: false,
    truncated:
      Boolean(slice.stats?.nodes && slice.stats.nodes > nodes.length) ||
      Boolean(slice.stats?.edges && slice.stats.edges > edges.length),
    displayed_nodes: nodes.length,
    total_nodes: Math.max(slice.stats?.nodes ?? 0, nodes.length),
    displayed_triples: edges.length,
    total_triples: Math.max(slice.stats?.triples ?? 0, edges.length),
    warnings: slice.warnings ?? [],
  };
}

export function originalOnlyGraphPayload(graph: GraphPayload): GraphPayload {
  const edges = graph.edges.filter((edge) => edge.status === "original");
  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  const nodes = graph.nodes.map((node) => ({
    ...node,
    highlighted: false,
    is_isolated: !connected.has(node.id),
    degree: edges.filter((edge) => edge.source === node.id || edge.target === node.id).length,
  }));
  return {
    ...graph,
    nodes,
    edges,
    displayed_triples: edges.length,
    warnings: graph.warnings,
  };
}
