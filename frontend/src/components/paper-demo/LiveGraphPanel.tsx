import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphEdge, GraphEdgeStatus, GraphNode, GraphPayload } from "../../types";
import { STATUS_TOKENS } from "../../graph/styles/graphStatusTokens";
import type { CanvasEdgeData, CanvasNodeData } from "../../graph/hooks/useGraphElements";
import { api, type BackendGraphSliceEdge, type BackendGraphSliceNode } from "../../lib/api";
import { formatKgInline, formatKgLabelParts, humanizeEdgeStatus, isRawKgId } from "../../lib/kgLabels";
import { applyExplainModeGraph } from "../../lib/applyExplainModeGraph";
import { graphDisplayModeForStep } from "../../lib/graphDisplayMode";
import type { GraphViewMode } from "../../lib/graphViewMode";
import { stepCaptionFor } from "../../lib/stepCaptions";
import { GraphViewToolbar } from "./GraphViewToolbar";
import { stepLayoutFor } from "../../lib/stepLayoutConfig";
import { CandidateEdge } from "../graph/edges/CandidateEdge";
import { RelationEdge } from "../graph/edges/RelationEdge";
import { PaperDemoEntityNode } from "./PaperDemoEntityNode";
import { PaperDemoClusterBoundaryNode } from "./PaperDemoClusterBoundaryNode";

export type GraphSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

interface LiveGraphPanelProps {
  graph: GraphPayload;
  activeStep: string;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  selectedCandidateId?: string | null;
  onSelectionChange?: (selection: GraphSelection) => void;
  onCandidateSelect?: (candidateId: string) => void;
  onExpandContext?: () => void;
  expandContextPending?: boolean;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
  viewMode?: GraphViewMode;
  onViewModeChange?: (mode: GraphViewMode) => void;
  onShowAllMembers?: () => void;
  onShowAllCandidates?: () => void;
  className?: string;
  title?: string;
}

const EXPLORE_NODE_WIDTH = 168;
const EXPLORE_NODE_HEIGHT = 72;
const EXPLAIN_NODE_WIDTH = 200;
const EXPLAIN_NODE_HEIGHT = 88;

const nodeTypes = {
  entity: PaperDemoEntityNode,
  clusterBoundary: PaperDemoClusterBoundaryNode,
} satisfies NodeTypes;

const edgeTypes = {
  relation: RelationEdge,
  candidate: CandidateEdge,
} satisfies EdgeTypes;

function mapBackendStatus(status?: string | null): GraphEdgeStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  const map: Record<string, GraphEdgeStatus> = {
    known: "original",
    original: "original",
    candidate: "generated",
    missing: "generated",
    kept: "filtered_passed",
    generated: "generated",
    removed: "filtered_rejected",
    filtered_removed: "filtered_rejected",
    filtered_rejected: "filtered_rejected",
    filter_rejected: "filtered_rejected",
    filtered_passed: "filtered_passed",
    filter_passed: "filtered_passed",
    passed: "filtered_passed",
    llm_valid: "llm_accepted",
    llm_accepted: "llm_accepted",
    valid: "llm_accepted",
    accepted: "llm_accepted",
    human_confirmed: "llm_accepted",
    llm_invalid: "llm_rejected",
    llm_rejected: "llm_rejected",
    invalid: "llm_rejected",
    rejected: "llm_rejected",
    human_rejected: "llm_rejected",
    uncertain: "missing",
    needs_expert_review: "missing",
    corrected: "generated",
    human_corrected: "generated",
    unresolved: "unresolved",
  };
  return map[normalized] ?? "original";
}

function getLayoutedElements(
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  direction: "LR" | "TB" = "LR",
  nodeWidth = EXPLORE_NODE_WIDTH,
  nodeHeight = EXPLORE_NODE_HEIGHT,
) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: 120,
    nodesep: 60,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, {}, edge.id);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function statusForEdge(edge: GraphEdge) {
  return mapBackendStatus(edge.raw_status ?? edge.provenance_label ?? edge.status);
}

function statusLabel(edge: GraphEdge) {
  return edge.provenance_label ?? edge.raw_status ?? edge.status ?? "original";
}

function formatEdgeHoverTooltip(edge: GraphEdge): string {
  const relation = formatKgInline(edge.label, edge.label, "relation");
  const status = humanizeEdgeStatus(statusLabel(edge));
  const sourceParts = formatKgLabelParts(edge.source, undefined, "entity");
  const targetParts = formatKgLabelParts(edge.target, undefined, "entity");
  if (sourceParts.isRawId && targetParts.isRawId) {
    return `${relation} — ${status}`;
  }
  return `${formatKgInline(edge.source)} → ${formatKgInline(edge.target)} via "${relation}" (${status})`;
}

function buildNodeMap(graph: GraphPayload) {
  const nodes = new Map<string, GraphNode>();
  const degree = new Map<string, number>();

  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  for (const node of graph.nodes) {
    const nodeDegree = degree.get(node.id) ?? node.degree ?? 0;
    nodes.set(node.id, {
      ...node,
      label: node.label?.trim() ? node.label : node.id,
      kind: node.kind ?? "entity",
      stage: node.stage ?? "original",
      degree: nodeDegree,
      component_id: node.component_id ?? null,
      cluster_id: node.cluster_id ?? null,
      candidate_id: node.candidate_id ?? null,
      is_isolated: nodeDegree === 0,
      highlighted: Boolean(node.highlighted),
      role: node.role ?? null,
      position: node.position ?? null,
      node_count: node.node_count ?? 1,
      boundary_height: node.boundary_height ?? null,
      edge_count: node.edge_count ?? 0,
      relation_count: node.relation_count ?? null,
      cluster_count: node.cluster_count ?? null,
      sample_nodes: node.sample_nodes ?? [],
      sample_relations: node.sample_relations ?? [],
      warning: node.warning ?? null,
      description: node.description ?? null,
    });
  }

  for (const edge of graph.edges) {
    for (const endpoint of [edge.source, edge.target]) {
      if (nodes.has(endpoint)) continue;
      const nodeDegree = degree.get(endpoint) ?? 0;
      nodes.set(endpoint, {
        id: endpoint,
        label: endpoint,
        kind: "entity",
        stage: "original",
        degree: nodeDegree,
        component_id: null,
        cluster_id: null,
        candidate_id: null,
        is_isolated: nodeDegree === 0,
        highlighted: Boolean(edge.highlighted),
        node_count: 1,
        edge_count: 0,
        relation_count: null,
        cluster_count: null,
        sample_nodes: [],
        sample_relations: [],
        warning: null,
        description: "Endpoint included from the backend edge slice.",
      });
    }
  }

  return nodes;
}

function mergeGraph(
  graph: GraphPayload,
  nodesToAdd: BackendGraphSliceNode[],
  edgesToAdd: BackendGraphSliceEdge[],
): GraphPayload {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeMap = new Map(graph.edges.map((edge) => [edge.id, edge]));

  for (const node of nodesToAdd) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, {
        id: node.id,
        label: node.label || node.id,
        kind: "entity",
        degree: 0,
        is_isolated: false,
        highlighted: true,
        description: node.source ? `Source: ${node.source}` : null,
      });
    }
  }

  for (const edge of edgesToAdd) {
    if (!edgeMap.has(edge.id)) {
      edgeMap.set(edge.id, {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        status: mapBackendStatus(edge.status),
        highlighted: true,
        candidate_id: edge.candidate_id ?? null,
        raw_status: edge.status,
        provenance_label: edge.provenance,
        distance: edge.distance ?? null,
        threshold: edge.threshold ?? null,
        llm_decision: edge.status ?? null,
      });
    }
  }

  const edges = Array.from(edgeMap.values());
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const nodes = Array.from(nodeMap.values()).map((node) => ({
    ...node,
    label: node.label?.trim() ? node.label : node.id,
    degree: degree.get(node.id) ?? 0,
    is_isolated: (degree.get(node.id) ?? 0) === 0,
  }));

  return {
    ...graph,
    nodes,
    edges,
    displayed_nodes: nodes.length,
    displayed_triples: edges.length,
  };
}

function LiveGraphPanelInner({
  graph,
  activeStep,
  sessionId,
  selectedClusterId,
  selectedCandidateId,
  onSelectionChange,
  onCandidateSelect,
  onExpandContext,
  expandContextPending = false,
  filteringAvailable = true,
  llmAvailable = true,
  viewMode = "guided",
  onViewModeChange,
  onShowAllMembers,
  onShowAllCandidates,
  className,
  title = "Interactive graph",
}: LiveGraphPanelProps) {
  const reactFlow = useReactFlow();
  const [expandedGraph, setExpandedGraph] = useState<GraphPayload>(graph);
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CanvasEdgeData>>([]);

  const effectiveViewMode: GraphViewMode = activeStep === "kg" ? "explore" : viewMode;
  const isExplainMode =
    graphDisplayModeForStep(activeStep) === "explain" && effectiveViewMode === "guided";
  const nodeWidth = isExplainMode ? EXPLAIN_NODE_WIDTH : EXPLORE_NODE_WIDTH;
  const nodeHeight = isExplainMode ? EXPLAIN_NODE_HEIGHT : EXPLORE_NODE_HEIGHT;
  const artifactUnavailable =
    (activeStep === "filtering" && !filteringAvailable) || (activeStep === "llm" && !llmAvailable);
  const artifactUnavailableLabel =
    activeStep === "filtering"
      ? "Filtering scores are not included in this online sample."
      : "LLM/RAG evidence is not included in this online sample.";

  useEffect(() => {
    setExpandedGraph(graph);
  }, [graph, activeStep]);

  const displayGraph = useMemo(
    () =>
      isExplainMode
        ? applyExplainModeGraph(expandedGraph, activeStep, {
            viewMode: effectiveViewMode,
            filteringAvailable,
            llmAvailable,
            selectedCandidateId,
          })
        : { ...expandedGraph, displayMode: "explore" as const },
    [
      expandedGraph,
      activeStep,
      isExplainMode,
      effectiveViewMode,
      filteringAvailable,
      llmAvailable,
      selectedCandidateId,
    ],
  );

  const rfNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    const graphNodes = buildNodeMap(displayGraph);
    const highlightedByCandidate = new Set<string>();
    if (selectedCandidateId) {
      for (const edge of displayGraph.edges) {
        if (edge.candidate_id === selectedCandidateId) {
          highlightedByCandidate.add(edge.source);
          highlightedByCandidate.add(edge.target);
        }
      }
    }

    return Array.from(graphNodes.values()).map((node) => {
      const highlighted = node.highlighted || highlightedByCandidate.has(node.id);
      const graphNode: GraphNode = {
        ...node,
        highlighted,
      };
      const isClusterBoundary = node.kind === "cluster" && node.role === "cluster_boundary";

      return {
        id: node.id,
        type: isClusterBoundary ? "clusterBoundary" : "entity",
        data: {
          node: graphNode,
          detailLevel: isExplainMode ? "close" : "medium",
          showLabels: true,
          evidenceActive: highlighted,
        } satisfies CanvasNodeData,
        position: graphNode.position ?? { x: 0, y: 0 },
        draggable: !isClusterBoundary,
        selectable: !isClusterBoundary,
        zIndex: isClusterBoundary ? 0 : 2,
      } satisfies Node<CanvasNodeData>;
    });
  }, [displayGraph, selectedCandidateId, isExplainMode]);

  const rfEdges = useMemo<Edge<CanvasEdgeData>[]>(() => {
    const nodeIds = new Set(rfNodes.map((node) => node.id));

    return displayGraph.edges
      .filter((backendEdge) => nodeIds.has(backendEdge.source) && nodeIds.has(backendEdge.target))
      .map((backendEdge) => {
        const statusKey = statusForEdge(backendEdge);
        const token = STATUS_TOKENS[statusKey] ?? STATUS_TOKENS.original;
        const selectedCandidate = Boolean(
          selectedCandidateId && backendEdge.candidate_id === selectedCandidateId,
        );
        const selectedOrHighlighted = selectedCandidate || Boolean(backendEdge.highlighted);
        const dimOriginal =
          displayGraph.layoutMode === "omnia" &&
          stepLayoutFor(activeStep).dimOriginalEdges &&
          statusKey === "original" &&
          !selectedOrHighlighted;
        const artifactMuted =
          artifactUnavailable && (statusKey === "generated" || Boolean(backendEdge.candidate_id));
        const showEdgeLabel = selectedOrHighlighted || hoveredEdgeId === backendEdge.id;
        const edge: GraphEdge = {
          ...backendEdge,
          label: backendEdge.label?.trim() ? backendEdge.label : backendEdge.id,
          status: statusKey,
          highlighted: selectedOrHighlighted,
        };

        return {
          id: backendEdge.id,
          source: backendEdge.source,
          target: backendEdge.target,
          type: statusKey === "generated" ? "candidate" : "relation",
          animated: statusKey === "generated" || selectedCandidate,
          data: {
            edge,
            status: statusKey,
            showLabel: showEdgeLabel,
            muted: dimOriginal,
            rejected: statusKey === "filtered_rejected" || statusKey === "llm_rejected",
          } satisfies CanvasEdgeData,
          style: {
            stroke: token.color,
            strokeWidth: selectedOrHighlighted ? token.strokeWidthSelected : token.strokeWidth,
            strokeDasharray: token.dash,
            opacity: artifactMuted
              ? 0.28
              : dimOriginal
                ? Math.min(token.opacity, 0.22)
                : selectedOrHighlighted
                  ? Math.max(token.opacity, 0.92)
                  : token.opacity,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: token.color,
          },
          selected: selectedCandidate,
          zIndex: selectedOrHighlighted ? 5 : 1,
        } satisfies Edge<CanvasEdgeData>;
      });
  }, [displayGraph.edges, displayGraph.layoutMode, rfNodes, selectedCandidateId, hoveredEdgeId, activeStep, artifactUnavailable]);

  useEffect(() => {
    const useOmniaLayout = displayGraph.layoutMode === "omnia";
    const { nodes: layoutedNodes, edges: layoutedEdges } = useOmniaLayout
      ? { nodes: rfNodes, edges: rfEdges }
      : getLayoutedElements(rfNodes, rfEdges, "LR", nodeWidth, nodeHeight);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    const id = window.setTimeout(() => {
      reactFlow.fitView({ padding: isExplainMode ? 0.28 : 0.15, duration: 400 });
    }, 60);

    return () => window.clearTimeout(id);
  }, [
    activeStep,
    displayGraph.layoutMode,
    rfNodes,
    rfEdges,
    reactFlow,
    setNodes,
    setEdges,
    isExplainMode,
    nodeWidth,
    nodeHeight,
    effectiveViewMode,
  ]);

  const expandNode = useCallback(async (nodeId: string, hops: 1 | 2) => {
    if (!sessionId) return;
    setExpanding(`${nodeId}:${hops}`);
    try {
      const payload = await api.getEntityNeighbors(sessionId, nodeId, { hops, limit: hops === 1 ? 80 : 150 });
      setExpandedGraph((current) => mergeGraph(current, payload.nodes, payload.edges));
    } finally {
      setExpanding(null);
    }
  }, [sessionId]);

  const selectedCluster = displayGraph.selectedCluster;
  const stepCaption = stepCaptionFor(activeStep);
  const hiddenMembers =
    displayGraph.totalMemberCount && displayGraph.visibleMemberCount
      ? Math.max(0, displayGraph.totalMemberCount - displayGraph.visibleMemberCount)
      : 0;

  return (
    <section
      className={clsx("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}
      data-testid="live-graph-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <p className="min-w-0 text-sm leading-snug text-slate-700">{stepCaption}</p>
        <div className="flex flex-wrap items-center gap-2">
          {onViewModeChange ? (
            <GraphViewToolbar
              activeStep={activeStep}
              viewMode={effectiveViewMode}
              onViewModeChange={onViewModeChange}
              onShowAllMembers={onShowAllMembers}
              onShowAllCandidates={onShowAllCandidates}
              hiddenMemberCount={hiddenMembers}
              compact
            />
          ) : null}
          {onExpandContext && (activeStep === "kg" || effectiveViewMode === "explore") ? (
            <button
              type="button"
              onClick={onExpandContext}
              disabled={expandContextPending}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 disabled:opacity-60"
              data-testid="expand-context-button"
            >
              {expandContextPending ? "Expanding…" : "Show more context"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{ height: 640, minHeight: 640, width: "100%" }}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        data-testid="live-graph-canvas"
      >
        <div className="absolute right-3 top-3 z-20 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
          {isExplainMode && hiddenMembers > 0
            ? `+ ${hiddenMembers} more members`
            : `${displayGraph.displayed_nodes} nodes · ${displayGraph.displayed_triples} triples`}
        </div>

        {hoverText ? (
          <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-sm rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-800 shadow-xl">
            {hoverText}
          </div>
        ) : null}

        {selectedCluster && !isExplainMode && activeStep !== "kg" ? (
          <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-md rounded-lg border border-indigo-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-sm">
            <p className="font-semibold text-indigo-900">
              Grouped by same relation -&gt; tail pattern
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-indigo-800">
              Pattern:{" "}
              {formatKgInline(selectedCluster.shared_relation, selectedCluster.shared_relation, "relation")}
              {" → "}
              {formatKgInline(selectedCluster.shared_tail)}
            </p>
            <p className="mt-0.5">
              {activeStep === "clustering"
                ? "Heads on the left share this pattern."
                : activeStep === "candidates"
                  ? "OMNIA proposes missing triples because similar entities share this pattern."
                  : activeStep === "filtering"
                    ? "Weak candidates are removed before semantic validation."
                    : activeStep === "llm"
                      ? "Semantic validation checks the selected candidate with retrieved evidence."
                      : "This graph view follows the same candidate through the OMNIA workflow."}
            </p>
          </div>
        ) : null}

        <ReactFlow
          className="absolute inset-0"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2.5}
          defaultEdgeOptions={{ type: "relation" }}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => onSelectionChange?.({ type: "node", id: node.id })}
          onEdgeClick={(_, edge) => {
            onSelectionChange?.({ type: "edge", id: edge.id });
            const graphEdge = edge.data?.edge;
            if (graphEdge?.candidate_id) onCandidateSelect?.(graphEdge.candidate_id);
          }}
          onPaneClick={() => onSelectionChange?.(null)}
          onNodeMouseEnter={(_, node) => {
            const graphNode = node.data.node;
            const parts = formatKgLabelParts(graphNode.id, graphNode.label, "entity");
            if (parts.isRawId) {
              setHoverText(`${graphNode.degree} connected triples in this view`);
            } else {
              setHoverText(`${parts.primary} — ${graphNode.degree} connected triples in this view`);
            }
          }}
          onNodeMouseLeave={() => setHoverText(null)}
          onEdgeMouseEnter={(_, edge) => {
            setHoveredEdgeId(edge.id);
            const graphEdge = edge.data?.edge;
            if (!graphEdge) return;
            setHoverText(formatEdgeHoverTooltip(graphEdge));
          }}
          onEdgeMouseLeave={() => {
            setHoveredEdgeId(null);
            setHoverText(null);
          }}
        >
          <Background gap={18} size={1} color="#CBD5E1" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              const data = node.data as { node?: { highlighted?: boolean } };
              if (data?.node?.highlighted) return "#0ea5e9";
              return isRawKgId(node.id) ? "#f59e0b" : "#94a3b8";
            }}
            style={{ bottom: 56, right: 8 }}
          />
        </ReactFlow>

        {expandedGraph.nodes.length === 0 ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-50/80">
            <p className="text-sm text-slate-500">No nodes in this graph slice.</p>
            <p className="text-xs text-slate-400">
              Select a different entity, cluster, or slice mode in the left panel.
            </p>
          </div>
        ) : null}

        {artifactUnavailable ? (
          <div className="pointer-events-none absolute bottom-14 left-1/2 z-20 max-w-md -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-center text-[11px] font-semibold text-amber-950 shadow-sm">
            {artifactUnavailableLabel}
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
          {isExplainMode ? (
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              <span>Solid = existing relation</span>
              <span>|</span>
              <span className="text-blue-700">Dashed blue = proposed triple</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <span>Click nodes to inspect</span>
              <span>|</span>
              <span>Expand from inspector</span>
            </div>
          )}
        </div>

        {expanding ? (
          <div className="absolute right-3 bottom-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-800 shadow-sm">
            Expanding {expanding.replace(":", " hop ")}...
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-600">
        <span>
          {activeStep === "kg"
            ? "Click nodes and edges to inspect. Use Advanced graph controls to search or expand."
            : isExplainMode
              ? "Guided view — use Explore dataset for more context."
              : "Explore view — click nodes or edges to inspect."}
        </span>
        {activeStep !== "kg" ? (
          <span>Solid = existing; dashed blue = proposed</span>
        ) : null}
      </div>

      <GraphExpansionBridge onExpand={expandNode} />
    </section>
  );
}

export function LiveGraphPanel(props: LiveGraphPanelProps) {
  return (
    <ReactFlowProvider>
      <LiveGraphPanelInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphExpansionBridge({ onExpand }: { onExpand: (nodeId: string, hops: 1 | 2) => void }) {
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ nodeId: string; hops: 1 | 2 }>;
      if (custom.detail?.nodeId) onExpand(custom.detail.nodeId, custom.detail.hops);
    };
    window.addEventListener("omnia-expand-node", handler);
    return () => window.removeEventListener("omnia-expand-node", handler);
  }, [onExpand]);
  return null;
}
