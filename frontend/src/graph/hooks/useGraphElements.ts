import { useMemo } from "react";
import type { GraphEdge, GraphEdgeStatus, GraphNode as GraphNodeModel, GraphPayload } from "../../types";
import { STATUS_TOKENS } from "../styles/graphStatusTokens";
import {
  Position,
  MarkerType,
  type Edge,
  type Node,
} from "@xyflow/react";

/* ── Dimensions ───────────────────────────────────────────── */
export const ENTITY_WIDTH = 136;
export const ENTITY_HEIGHT = 136;
export const SUMMARY_WIDTH = 248;
export const SUMMARY_HEIGHT = 172;
export const CANDIDATE_WIDTH = 208;
export const CANDIDATE_HEIGHT = 132;

/* ── Data interfaces carried by React Flow elements ──────── */
export interface CanvasNodeData extends Record<string, unknown> {
  node: GraphNodeModel;
  detailLevel: "far" | "medium" | "close";
  showLabels: boolean;
  evidenceActive: boolean;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  edge: GraphEdge;
  status: GraphEdgeStatus;
  showLabel: boolean;
  muted: boolean;
  rejected: boolean;
}

/* ── Helpers ──────────────────────────────────────────────── */
export function inferEdgeStatus(edge: GraphEdge): GraphEdgeStatus {
  if (edge.status) return edge.status;
  const decision = (edge.llm_decision ?? "").toLowerCase();
  if (decision.includes("accepted")) return "llm_accepted";
  if (decision.includes("rejected")) return "llm_rejected";
  return "original";
}

function edgeTypeForStatus(status: GraphEdgeStatus) {
  if (status === "generated") return "candidate";
  if (status === "missing") return "missing";
  if (status === "original" || status === "unresolved") return "relation";
  return "validated";
}

function markerColor(status: GraphEdgeStatus) {
  return STATUS_TOKENS[status]?.color ?? "#8B949E";
}

export function getNodeDimensions(node: GraphNodeModel) {
  if (node.kind === "cluster" && node.role === "cluster_boundary") {
    const count = node.node_count ?? node.degree ?? 4;
    return { width: 180, height: Math.max(160, count * 96 + 80) };
  }
  if (node.kind === "component") return { width: SUMMARY_WIDTH, height: SUMMARY_HEIGHT };
  if (node.kind === "cluster") return { width: SUMMARY_WIDTH, height: 164 };
  if (node.kind === "candidate") return { width: CANDIDATE_WIDTH, height: CANDIDATE_HEIGHT };
  return { width: ENTITY_WIDTH, height: ENTITY_HEIGHT };
}

/* ── Hook ─────────────────────────────────────────────────── */

interface UseGraphElementsOptions {
  graph: GraphPayload;
  visibleEdgeStatuses: Set<GraphEdgeStatus>;
  presentationMode: boolean;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  hoveredEdgeId: string | null;
  showLabels: boolean;
  detailLevel: "far" | "medium" | "close";
  evidenceNodeIds: Set<string>;
}

/**
 * Converts backend `GraphPayload` to React Flow `Node[]` and `Edge[]`.
 *
 * This hook handles filtering, styling, and marker generation.
 * It intentionally does NOT compute positions — that is the
 * responsibility of `useGraphLayout`.
 */
export function useGraphElements({
  graph,
  visibleEdgeStatuses,
  presentationMode,
  selectedEdgeId,
  selectedNodeId,
  hoveredEdgeId,
  showLabels,
  detailLevel,
  evidenceNodeIds,
}: UseGraphElementsOptions) {
  /* ── visible graph edges (filtered by status + presentation) ── */
  const visibleGraphEdges = useMemo(() => {
    return graph.edges.filter((edge) => {
      const status = inferEdgeStatus(edge);
      if (!visibleEdgeStatuses.has(status)) return false;
      if (!presentationMode || !selectedEdgeId) return true;
      return (
        edge.id === selectedEdgeId ||
        evidenceNodeIds.has(edge.source) ||
        evidenceNodeIds.has(edge.target)
      );
    });
  }, [graph.edges, visibleEdgeStatuses, presentationMode, selectedEdgeId, evidenceNodeIds]);

  /* ── React Flow edges ── */
  const rfEdges = useMemo(() => {
    // Threshold: hide labels above 36 visible edges unless explicitly enabled
    const autoShowLabels = detailLevel === "close" && visibleGraphEdges.length <= 36;

    return visibleGraphEdges.map((edge) => {
      const status = inferEdgeStatus(edge);
      const selected = selectedEdgeId === edge.id;
      const attachedToSelected =
        selectedNodeId !== null &&
        (edge.source === selectedNodeId || edge.target === selectedNodeId);
      const evidenceActive = selectedEdgeId
        ? edge.id === selectedEdgeId ||
          evidenceNodeIds.has(edge.source) ||
          evidenceNodeIds.has(edge.target)
        : false;
      const showEdgeLabel =
        showLabels ||
        hoveredEdgeId === edge.id ||
        selected ||
        attachedToSelected ||
        autoShowLabels ||
        (presentationMode && evidenceActive);
      const token = STATUS_TOKENS[status];
      const nodeCount = graph.nodes.length;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edgeTypeForStatus(status),
        selected,
        data: {
          edge,
          status,
          showLabel: showEdgeLabel,
          muted: Boolean(selectedEdgeId && presentationMode && !evidenceActive),
          rejected: status === "filtered_rejected" || status === "llm_rejected",
        } satisfies CanvasEdgeData,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: markerColor(status),
        },
        // Disable animation above threshold to keep dense graphs fast
        animated:
          nodeCount <= 100 &&
          (edge.highlighted || selected || (presentationMode && evidenceActive)),
        zIndex: selected || edge.highlighted ? 4 : evidenceActive ? 3 : 1,
      } satisfies Edge<CanvasEdgeData>;
    });
  }, [
    visibleGraphEdges,
    detailLevel,
    selectedEdgeId,
    selectedNodeId,
    evidenceNodeIds,
    showLabels,
    hoveredEdgeId,
    presentationMode,
    graph.nodes.length,
  ]);

  /* ── React Flow nodes (without positions — layout applies them later) ── */
  const rfNodes = useMemo(() => {
    return graph.nodes.map((node) => {
      const dims = getNodeDimensions(node);
      return {
        id: node.id,
        type: node.kind,
        data: {
          node,
          detailLevel,
          showLabels,
          evidenceActive: evidenceNodeIds.has(node.id),
        } satisfies CanvasNodeData,
        selected: selectedNodeId === node.id,
        position: node.position ?? { x: 0, y: 0 },
        style: { width: dims.width, minHeight: dims.height },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: node.role !== "cluster_boundary",
        selectable: node.role !== "cluster_boundary",
        zIndex: node.role === "cluster_boundary" ? 0 : 2,
      } satisfies Node<CanvasNodeData>;
    });
  }, [graph.nodes, detailLevel, showLabels, evidenceNodeIds, selectedNodeId]);

  return { rfNodes, rfEdges, visibleGraphEdges };
}
