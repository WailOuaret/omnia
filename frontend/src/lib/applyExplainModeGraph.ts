import type { GraphEdge, GraphPayload } from "../types";
import { applyExplanationLayout } from "./buildExplanationGraph";
import { EXPLAIN_MAX_MEMBERS, graphDisplayModeForStep } from "./graphDisplayMode";

export const EXPLAIN_MAX_CANDIDATES = 3;
function isGeneratedEdge(edge: GraphEdge): boolean {
  return (
    edge.status === "generated" ||
    edge.provenance_label === "cluster_generated" ||
    Boolean(edge.candidate_id)
  );
}

export interface ExplainModeOptions {
  expandContext?: boolean;
  viewMode?: "guided" | "explore";
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
  selectedCandidateId?: string | null;
}

/** Focus the graph for steps 2–7 so OMNIA logic is readable (5–12 nodes). */
export function applyExplainModeGraph(
  graph: GraphPayload,
  activeStep: string,
  {
    expandContext = false,
    viewMode = "guided",
    filteringAvailable = true,
    llmAvailable = true,
    selectedCandidateId = null,
  }: ExplainModeOptions = {},
): GraphPayload {
  const displayMode = graphDisplayModeForStep(activeStep);
  if (displayMode === "explore" || viewMode === "explore") {
    return { ...graph, displayMode: "explore", layoutMode: "dagre" };
  }

  const expandMembers = expandContext;
  const cluster = graph.selectedCluster;
  if (!cluster) {
    return { ...graph, displayMode: "explain" };
  }

  const allMembers = cluster.members ?? [];
  const visibleMembers = expandMembers ? allMembers : allMembers.slice(0, EXPLAIN_MAX_MEMBERS);
  const memberSet = new Set(visibleMembers);
  const sharedTail = cluster.shared_tail;
  const sharedRelation = cluster.shared_relation;
  const keptNodeIds = new Set<string>([...visibleMembers, sharedTail]);

  const minimalArtifactStep =
    (activeStep === "filtering" && !filteringAvailable) ||
    (activeStep === "llm" && !llmAvailable);

  if (minimalArtifactStep && selectedCandidateId) {
    const candidateEdge = graph.edges.find((edge) => edge.candidate_id === selectedCandidateId);
    if (candidateEdge) {
      keptNodeIds.add(candidateEdge.source);
      keptNodeIds.add(candidateEdge.target);
    }
  } else if (
    activeStep === "candidates" ||
    activeStep === "filtering" ||
    activeStep === "llm" ||
    activeStep === "feedback" ||
    activeStep === "completed"
  ) {
    for (const edge of graph.edges) {
      if (!edge.candidate_id) continue;
      if (
        (activeStep === "llm" || activeStep === "filtering" || activeStep === "feedback") &&
        selectedCandidateId &&
        edge.candidate_id !== selectedCandidateId
      ) {
        continue;
      }
      keptNodeIds.add(edge.source);
      keptNodeIds.add(edge.target);
    }
  }

  let edges = graph.edges.filter(
    (edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target),
  );

  if (activeStep === "clustering") {
    edges = edges.filter(
      (edge) =>
        !isGeneratedEdge(edge) &&
        ((memberSet.has(edge.source) && edge.target === sharedTail && edge.label === sharedRelation) ||
          (memberSet.has(edge.source) && memberSet.has(edge.target))),
    );
  } else if (minimalArtifactStep) {
    edges = edges.filter(
      (edge) =>
        (selectedCandidateId && edge.candidate_id === selectedCandidateId) ||
        (!isGeneratedEdge(edge) &&
          memberSet.has(edge.source) &&
          edge.target === sharedTail &&
          edge.label === sharedRelation),
    );
  } else if (activeStep === "candidates") {
    const candidateIds = new Set<string>();
    edges = edges.filter((edge) => {
      if (!isGeneratedEdge(edge)) return true;
      if (!edge.candidate_id) return false;
      if (candidateIds.has(edge.candidate_id)) return true;
      if (candidateIds.size >= EXPLAIN_MAX_CANDIDATES) return false;
      candidateIds.add(edge.candidate_id);
      return true;
    });
  } else if (activeStep === "filtering" && filteringAvailable) {    edges = edges.filter(
      (edge) => !isGeneratedEdge(edge) || edge.status !== "filtered_rejected",
    );
  }

  const nodes = graph.nodes.filter(
    (node) =>
      keptNodeIds.has(node.id) ||
      (node.kind === "cluster" && node.role === "cluster_boundary"),
  );

  const hiddenNodeCount = Math.max(0, graph.nodes.length - nodes.length);

  const focused: GraphPayload = {
    ...graph,
    nodes,
    edges,
    displayMode: "explain",
    hiddenNodeCount,
    totalMemberCount: allMembers.length,
    visibleMemberCount: visibleMembers.length,
    displayed_nodes: nodes.length,
    displayed_triples: edges.length,
    layoutMode: "omnia",
  };

  return applyExplanationLayout(focused, activeStep, selectedCandidateId);
}