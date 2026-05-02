import { useCallback, useMemo, useState } from "react";
import type { GraphEdge, GraphEdgeStatus, GraphPayload } from "../../types";
import { inferEdgeStatus } from "./useGraphElements";

const allEdgeStatuses: GraphEdgeStatus[] = [
  "original",
  "generated",
  "missing",
  "filtered_passed",
  "filtered_rejected",
  "llm_accepted",
  "llm_rejected",
  "unresolved",
];

type SelectedElement = { type: "node" | "edge"; id: string } | null;

/**
 * Manages graph selection, hover, and evidence highlighting state.
 *
 * Kept separate from layout and rendering so that changes to selection
 * do NOT trigger layout recomputation.
 */
export function useGraphSelection(graph: GraphPayload) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [visibleEdgeStatuses, setVisibleEdgeStatuses] = useState<Set<GraphEdgeStatus>>(
    () => new Set(allEdgeStatuses),
  );

  const selectedNode =
    selectedElement?.type === "node"
      ? graph.nodes.find((n) => n.id === selectedElement.id) ?? null
      : null;

  const selectedEdge =
    selectedElement?.type === "edge"
      ? graph.edges.find((e) => e.id === selectedElement.id) ?? null
      : null;

  const selectedNodeId = selectedElement?.type === "node" ? selectedElement.id : null;
  const selectedEdgeId = selectedElement?.type === "edge" ? selectedElement.id : null;

  const evidenceNodeIds = useMemo(() => {
    if (!selectedEdge) return new Set<string>();
    return new Set(
      [
        selectedEdge.source,
        selectedEdge.target,
        ...(selectedEdge.provenance?.source_heads ?? []),
        selectedEdge.provenance?.generated_candidate?.Head ?? "",
        selectedEdge.provenance?.generated_candidate?.Tail ?? "",
      ].filter(Boolean),
    );
  }, [selectedEdge]);

  /** Precomputed adjacency map for the inspector */
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, GraphEdge[]>();
    for (const edge of graph.edges) {
      const srcList = map.get(edge.source) ?? [];
      srcList.push(edge);
      map.set(edge.source, srcList);
      const tgtList = map.get(edge.target) ?? [];
      tgtList.push(edge);
      map.set(edge.target, tgtList);
    }
    return map;
  }, [graph.edges]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return (adjacencyMap.get(selectedNode.id) ?? []).slice(0, 6);
  }, [selectedNode, adjacencyMap]);

  const toggleStatus = useCallback((status: GraphEdgeStatus) => {
    setVisibleEdgeStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        // Keep at least one status active to avoid blank graph states.
        if (next.size === 1) return current;
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const resetStatuses = useCallback(() => {
    setVisibleEdgeStatuses(new Set(allEdgeStatuses));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
    setHoveredEdgeId(null);
  }, []);

  const selectNode = useCallback((id: string) => {
    setSelectedElement({ type: "node", id });
  }, []);

  const selectEdge = useCallback((id: string) => {
    setSelectedElement({ type: "edge", id });
  }, []);

  return {
    // State
    selectedElement,
    selectedNode,
    selectedEdge,
    selectedNodeId,
    selectedEdgeId,
    hoveredEdgeId,
    showLabels,
    presentationMode,
    visibleEdgeStatuses,
    evidenceNodeIds,
    connectedEdges,
    // Actions
    selectNode,
    selectEdge,
    clearSelection,
    setHoveredEdgeId,
    setShowLabels,
    setPresentationMode,
    toggleStatus,
    resetStatuses,
  };
}
