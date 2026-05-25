import type { GraphEdge, GraphPayload } from "../types";
import { originalOnlyGraphPayload } from "./sessionSliceToGraphPayload";
import { stepLayoutFor, type StepId } from "./stepLayoutConfig";

function isGeneratedEdge(edge: GraphEdge): boolean {
  return (
    edge.status === "generated" ||
    edge.provenance_label === "cluster_generated" ||
    Boolean(edge.candidate_id)
  );
}

function isFilteredRejected(edge: GraphEdge): boolean {
  return edge.status === "filtered_rejected";
}

/** Step-specific graph presentation on one stable backend slice. */
export function applyStepGraphPresentation(
  graph: GraphPayload,
  activeStep: string,
): GraphPayload {
  const layout = stepLayoutFor(activeStep);
  const step = activeStep as StepId;

  if (step === "kg") {
    const filtered = originalOnlyGraphPayload(graph);
    return {
      ...filtered,
      layoutMode: layout.useDagreLayout ? "dagre" : graph.layoutMode,
      stepCaption: layout.caption,
    };
  }

  let edges = graph.edges;

  if (!layout.showCandidateEdges) {
    edges = edges.filter((edge) => !isGeneratedEdge(edge));
  }

  if (step === "filtering") {
    edges = edges.filter((edge) => !isGeneratedEdge(edge) || !isFilteredRejected(edge));
  }

  if (step === "llm") {
    edges = edges.filter(
      (edge) =>
        !isGeneratedEdge(edge) ||
        edge.status === "filtered_passed" ||
        edge.status === "llm_accepted" ||
        edge.status === "llm_rejected" ||
        edge.status === "unresolved" ||
        edge.status === "generated",
    );
  }

  if (step === "completed") {
    edges = edges.filter(
      (edge) => !isGeneratedEdge(edge) || edge.status !== "filtered_rejected" && edge.status !== "llm_rejected",
    );
  }

  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }

  const nodes = graph.nodes
    .filter((node) => node.kind !== "cluster" || layout.showClusterBox)
    .map((node) => {
      const degree = edges.filter((edge) => edge.source === node.id || edge.target === node.id).length;
      return {
        ...node,
        is_isolated: degree === 0 && node.kind !== "cluster",
        degree,
        highlighted:
          step === "clustering"
            ? node.role === "cluster_member" || node.role === "shared_tail"
            : node.highlighted,
      };
    })
    .filter((node) => node.kind !== "cluster" || layout.showClusterBox)
    .filter((node) => node.kind === "cluster" || connected.has(node.id) || node.role === "cluster_boundary");

  return {
    ...graph,
    nodes,
    edges: edges.map((edge) => ({
      ...edge,
      highlighted:
        edge.highlighted ||
        (layout.showFilterStatus && (edge.status === "filtered_passed" || edge.status === "filtered_rejected")) ||
        (layout.showLlmVerdict &&
          (edge.status === "llm_accepted" || edge.status === "llm_rejected" || edge.status === "unresolved")),
    })),
    layoutMode: layout.useDagreLayout ? "dagre" : "omnia",
    displayed_nodes: nodes.length,
    displayed_triples: edges.length,
    stepCaption: layout.caption,
  };
}
