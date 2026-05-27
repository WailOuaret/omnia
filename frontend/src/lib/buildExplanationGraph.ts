import type { GraphNode, GraphPayload } from "../types";
import { formatKgInline } from "./kgLabels";
import { stepLayoutFor } from "./stepLayoutConfig";

const X_HEAD = 120;
const X_TAIL = 520;
const X_CANDIDATE = 780;
const Y_START = 100;
const MEMBER_GAP = 100;

/** Fixed manual positions for explanation-mode graphs — avoids overlap from dagre/full-member spread. */
export function applyExplanationLayout(
  graph: GraphPayload,
  activeStep: string,
  selectedCandidateId?: string | null,
): GraphPayload {
  if (graph.displayMode !== "explain") return graph;

  const cluster = graph.selectedCluster;
  if (!cluster) return graph;

  const allMembers = cluster.members ?? [];
  const memberOrder = allMembers.filter((id) => graph.nodes.some((node) => node.id === id));
  const visibleMembers = memberOrder;
  const memberSet = new Set(visibleMembers);
  const sharedTail = cluster.shared_tail;
  const shownCount = Math.max(1, visibleMembers.length);

  const candidateTailIds: string[] = [];
  for (const edge of graph.edges) {
    if (!edge.candidate_id) continue;
    if (
      selectedCandidateId &&
      (activeStep === "filtering" || activeStep === "llm" || activeStep === "feedback") &&
      edge.candidate_id !== selectedCandidateId
    ) {
      continue;
    }
    const tailId = edge.target;
    if (tailId !== sharedTail && !memberSet.has(tailId) && !candidateTailIds.includes(tailId)) {
      candidateTailIds.push(tailId);
    }
  }

  const tailY = Y_START + ((shownCount - 1) * MEMBER_GAP) / 2;
  const showClusterBox = stepLayoutFor(activeStep).showClusterBox;

  const entityNodes = graph.nodes.filter(
    (node) => !(node.kind === "cluster" && node.role === "cluster_boundary"),
  );

  const positionedNodes: GraphNode[] = entityNodes.map((node) => {
    const memberIdx = visibleMembers.indexOf(node.id);
    if (memberIdx >= 0) {
      return {
        ...node,
        position: { x: X_HEAD, y: Y_START + memberIdx * MEMBER_GAP },
      };
    }
    if (node.id === sharedTail) {
      return { ...node, position: { x: X_TAIL, y: tailY } };
    }
    const candIdx = candidateTailIds.indexOf(node.id);
    if (candIdx >= 0) {
      return {
        ...node,
        position: { x: X_CANDIDATE, y: Y_START + candIdx * MEMBER_GAP },
        highlighted: graph.edges.some(
          (edge) =>
            edge.candidate_id === selectedCandidateId &&
            (edge.source === node.id || edge.target === node.id),
        ),
      };
    }
    return {
      ...node,
      position: node.position ?? { x: X_TAIL + 80, y: Y_START },
    };
  });

  if (showClusterBox && visibleMembers.length > 0) {
    const topY = Y_START - 44;
    const bottomY = Y_START + (shownCount - 1) * MEMBER_GAP + 44;
    const clusterNodeId = `cluster-box-${cluster.cluster_id}`;
    positionedNodes.push({
      id: clusterNodeId,
      label: "Cluster members",
      kind: "cluster",
      stage: "cluster",
      degree: visibleMembers.length,
      is_isolated: false,
      highlighted: true,
      role: "cluster_boundary",
      cluster_id: cluster.cluster_id,
      description: `${visibleMembers.length} heads share ${formatKgInline(cluster.shared_relation, cluster.shared_relation, "relation")} → ${formatKgInline(cluster.shared_tail)}`,
      node_count: visibleMembers.length,
      position: { x: X_HEAD - 36, y: topY },
      boundary_height: bottomY - topY,
    } as GraphNode);
  }

  const caption = graph.stepCaption ?? stepLayoutFor(activeStep).caption;

  return {
    ...graph,
    nodes: positionedNodes,
    layoutMode: "omnia",
    stepCaption: caption,
  };
}
