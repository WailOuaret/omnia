import type {
  GraphEdge,
  GraphEdgeStatus,
  GraphNode,
  GraphNodeStage,
  GraphPayload,
} from "../types";
import type { DemoCandidate } from "../demo-data/types";
import type { BackendGraphSlice } from "./api";
import { stepLayoutFor } from "./stepLayoutConfig";

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

function spreadY(index: number, count: number, center = 300, gap = 96) {
  return center + (index - (count - 1) / 2) * gap;
}

function fallbackGridPosition(index: number, startX = 520, startY = 520) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: startX + col * 150, y: startY + row * 110 };
}

function assignOmniaPositions({
  nodes,
  edges,
  slice,
  activeStep,
  selectedClusterId,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  slice: BackendGraphSlice;
  activeStep: string;
  selectedClusterId?: string | null;
}): GraphNode[] {
  const selectedCluster =
    slice.selected_cluster ??
    slice.clusters?.find((cluster) => cluster.cluster_id === selectedClusterId) ??
    slice.clusters?.[0] ??
    null;
  if (!selectedCluster) return nodes;

  const members = selectedCluster.members ?? [];
  const memberSet = new Set(members);
  const sharedTail = selectedCluster.shared_tail;
  const layout = stepLayoutFor(activeStep);
  const { members: memberX, shared: tailX, candidates: candidateX, context: contextX } = layout.columnX;

  const selectedClusterCandidateIds = new Set(
    edges
      .filter((edge) => edge.provenance?.cluster_id === selectedCluster.cluster_id || edge.candidate_id)
      .map((edge) => edge.candidate_id)
      .filter(Boolean) as string[],
  );
  const candidateTails = new Set(
    edges
      .filter((edge) => edge.candidate_id && selectedClusterCandidateIds.has(edge.candidate_id))
      .map((edge) => edge.target),
  );

  const candidateColumnX =
    activeStep === "candidates" ||
    activeStep === "filtering" ||
    activeStep === "llm" ||
    activeStep === "feedback"
      ? candidateX
      : tailX;

  const contextNodes = nodes.filter(
    (node) => !memberSet.has(node.id) && node.id !== sharedTail && !candidateTails.has(node.id),
  );
  let candidateTailList = Array.from(candidateTails).filter((id) => id !== sharedTail);

  if (activeStep === "filtering") {
    const keptTails = new Set(
      edges
        .filter(
          (edge) =>
            edge.distance != null &&
            edge.threshold != null &&
            edge.threshold > 0 &&
            edge.distance <= edge.threshold,
        )
        .map((edge) => edge.target),
    );
    candidateTailList.sort((a, b) => {
      const aKept = keptTails.has(a) ? 0 : 1;
      const bKept = keptTails.has(b) ? 0 : 1;
      return aKept - bKept;
    });
  } else if (activeStep === "llm") {
    candidateTailList.sort((a, b) => {
      const edgeA = edges.find((edge) => edge.target === a && edge.candidate_id);
      const edgeB = edges.find((edge) => edge.target === b && edge.candidate_id);
      const rank = (status?: string) => {
        if (status === "llm_accepted") return 0;
        if (status === "unresolved") return 1;
        if (status === "llm_rejected") return 2;
        return 3;
      };
      return rank(edgeA?.status) - rank(edgeB?.status);
    });
  }

  const positionedNodes = nodes.map((node, index) => {
    if (memberSet.has(node.id)) {
      const memberIndex = members.indexOf(node.id);
      return { ...node, position: { x: memberX, y: spreadY(memberIndex, members.length, 300, layout.memberSpreadGap) } };
    }
    if (node.id === sharedTail) {
      return { ...node, position: { x: tailX, y: 300 } };
    }
    if (candidateTails.has(node.id)) {
      const tailIndex = candidateTailList.indexOf(node.id);
      return {
        ...node,
        position: {
          x: candidateColumnX,
          y: spreadY(Math.max(0, tailIndex), Math.max(1, candidateTailList.length), 300, 86),
        },
      };
    }
    const contextIndex = contextNodes.findIndex((item) => item.id === node.id);
    if (contextIndex >= 0) {
      return { ...node, position: { x: contextX, y: spreadY(contextIndex, Math.max(1, contextNodes.length), 300, 86) } };
    }
    return { ...node, position: fallbackGridPosition(index) };
  });

  const clusterNodeId = `cluster-box-${selectedCluster.cluster_id}`;
  if (layout.showClusterBox && !positionedNodes.some((node) => node.id === clusterNodeId)) {
    const memberYs = members.map((_, idx) => spreadY(idx, members.length, 300, layout.memberSpreadGap));
    const topY = Math.min(...memberYs) - 48;
    const bottomY = Math.max(...memberYs) + 48;
    positionedNodes.push({
      id: clusterNodeId,
      label: `(${selectedCluster.shared_relation}, ${selectedCluster.shared_tail})`,
      kind: "cluster",
      stage: STEP_TO_NODE_STAGE[activeStep] ?? "original",
      degree: members.length,
      is_isolated: false,
      highlighted: true,
      role: "cluster_boundary",
      cluster_id: selectedCluster.cluster_id,
      description: `${members.length} heads share this relation-tail pattern`,
      node_count: members.length,
      position: {
        x: memberX - 28,
        y: topY,
      },
      boundary_height: bottomY - topY,
    });
  }

  return positionedNodes;
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
      role: node.role ?? null,
      cluster_id: node.cluster_id ?? selectedClusterId ?? null,
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
        cluster_id: edge.cluster_id ?? candidate?.clusterIds?.[0],
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

  const positionedNodes = assignOmniaPositions({
      nodes,
      edges,
      slice,
      activeStep,
      selectedClusterId,
    });

  return {
    nodes: positionedNodes,
    edges,
    view: viewFromMode(slice.mode),
    aggregated: false,
    truncated:
      Boolean(slice.stats?.nodes && slice.stats.nodes > nodes.length) ||
      Boolean(slice.stats?.edges && slice.stats.edges > edges.length),
    displayed_nodes: positionedNodes.length,
    total_nodes: Math.max(slice.stats?.nodes ?? 0, positionedNodes.length),
    displayed_triples: edges.length,
    total_triples: Math.max(slice.stats?.triples ?? 0, edges.length),
    warnings: slice.warnings ?? [],
    layoutMode:
      stepLayoutFor(activeStep).useDagreLayout || slice.mode === "overview" ? "dagre" : "omnia",
    stepCaption: stepLayoutFor(activeStep).caption,
    selectedCluster: slice.selected_cluster ?? null,
    selectedCandidateId: selectedCandidateId,
    explanation: slice.explanation,
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
