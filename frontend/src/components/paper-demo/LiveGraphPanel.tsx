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
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphEdge, GraphEdgeStatus, GraphNode, GraphPayload } from "../../types";
import { STATUS_TOKENS } from "../../graph/styles/graphStatusTokens";
import type { CanvasEdgeData, CanvasNodeData } from "../../graph/hooks/useGraphElements";
import { api, type BackendGraphSliceEdge, type BackendGraphSliceNode } from "../../lib/api";
import { formatKgInline, isRawKgId } from "../../lib/kgLabels";
import { CandidateEdge } from "../graph/edges/CandidateEdge";
import { RelationEdge } from "../graph/edges/RelationEdge";
import { EntityNode } from "../graph/nodes/EntityNode";

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
  className?: string;
  title?: string;
}

const NODE_WIDTH = 128;
const NODE_HEIGHT = 128;

const nodeTypes = {
  entity: EntityNode,
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
    kept: "generated",
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
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
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
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
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
      kind: "entity",
      stage: node.stage ?? "original",
      degree: nodeDegree,
      component_id: node.component_id ?? null,
      cluster_id: node.cluster_id ?? null,
      candidate_id: node.candidate_id ?? null,
      is_isolated: nodeDegree === 0,
      highlighted: Boolean(node.highlighted),
      node_count: node.node_count ?? 1,
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
  className,
  title = "Interactive backend graph",
}: LiveGraphPanelProps) {
  const reactFlow = useReactFlow();
  const [expandedGraph, setExpandedGraph] = useState<GraphPayload>(graph);
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CanvasEdgeData>>([]);

  useEffect(() => {
    setExpandedGraph(graph);
  }, [graph]);

  const rfNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    const graphNodes = buildNodeMap(expandedGraph);
    const highlightedByCandidate = new Set<string>();
    if (selectedCandidateId) {
      for (const edge of expandedGraph.edges) {
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

      return {
        id: node.id,
        type: "entity",
        data: {
          node: graphNode,
          detailLevel: "medium",
          showLabels: true,
          evidenceActive: highlighted,
        } satisfies CanvasNodeData,
        position: { x: 0, y: 0 },
        draggable: true,
        selectable: true,
      } satisfies Node<CanvasNodeData>;
    });
  }, [expandedGraph, selectedCandidateId]);

  const rfEdges = useMemo<Edge<CanvasEdgeData>[]>(() => {
    const nodeIds = new Set(rfNodes.map((node) => node.id));

    return expandedGraph.edges
      .filter((backendEdge) => nodeIds.has(backendEdge.source) && nodeIds.has(backendEdge.target))
      .map((backendEdge) => {
        const statusKey = statusForEdge(backendEdge);
        const token = STATUS_TOKENS[statusKey] ?? STATUS_TOKENS.original;
        const selectedCandidate = Boolean(
          selectedCandidateId && backendEdge.candidate_id === selectedCandidateId,
        );
        const selectedOrHighlighted = selectedCandidate || Boolean(backendEdge.highlighted);
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
            showLabel: true,
            muted: false,
            rejected: statusKey === "filtered_rejected" || statusKey === "llm_rejected",
          } satisfies CanvasEdgeData,
          style: {
            stroke: token.color,
            strokeWidth: selectedOrHighlighted ? token.strokeWidthSelected : token.strokeWidth,
            strokeDasharray: token.dash,
            opacity: selectedOrHighlighted ? Math.max(token.opacity, 0.92) : token.opacity,
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
  }, [expandedGraph.edges, rfNodes, selectedCandidateId]);

  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rfNodes, rfEdges, "LR");
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    const id = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.15, duration: 400 });
    }, 60);

    return () => window.clearTimeout(id);
  }, [activeStep, rfNodes, rfEdges, reactFlow, setNodes, setEdges]);

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

  const selectionHint = selectedClusterId
    ? `Cluster ${selectedClusterId} highlighted`
    : selectedCandidateId
      ? `Candidate ${selectedCandidateId} highlighted`
      : "Click nodes or edges to inspect";

  return (
    <section
      className={clsx("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}
      data-testid="live-graph-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950">{title}</h3>
          <p className="text-[11px] text-slate-600">{selectionHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
            backend session slice
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200"
            title="Raw IDs come from the benchmark dataset. Labels are shown when available."
          >
            <Info className="h-3 w-3" />
            labels when available
          </span>
        </div>
      </div>

      <div
        style={{ height: 600, minHeight: 600, width: "100%" }}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        data-testid="live-graph-canvas"
      >
        <div className="absolute right-3 top-3 z-20 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
          {expandedGraph.displayed_nodes} nodes | {expandedGraph.displayed_triples} triples
        </div>

        {hoverText ? (
          <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-sm rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-800 shadow-xl">
            {hoverText}
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
            setHoverText(`${formatKgInline(graphNode.id, graphNode.label)} | degree ${graphNode.degree}`);
          }}
          onNodeMouseLeave={() => setHoverText(null)}
          onEdgeMouseEnter={(_, edge) => {
            const graphEdge = edge.data?.edge;
            if (!graphEdge) return;
            setHoverText(
              `${formatKgInline(graphEdge.source)} -> ${formatKgInline(graphEdge.target)} | ${formatKgInline(graphEdge.label, graphEdge.label, "relation")} | ${statusLabel(graphEdge)}`,
            );
          }}
          onEdgeMouseLeave={() => setHoverText(null)}
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

        <div className="absolute bottom-3 left-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
          Pan, zoom, drag nodes, click to inspect. Use the controls to fit the live slice.
        </div>

        {expanding ? (
          <div className="absolute right-3 bottom-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-800 shadow-sm">
            Expanding {expanding.replace(":", " hop ")}...
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-600">
        <span>Graph source: backend session slice</span>
        <span>Candidate edges are dashed purple; original edges are solid gray; accepted/rejected edges use status colors.</span>
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
