import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useState } from "react";
import type { GraphPayload } from "../../types";
import { useGraphElements, type CanvasNodeData } from "../../graph/hooks/useGraphElements";
import { useGraphLayout } from "../../graph/hooks/useGraphLayout";
import { useGraphSelection } from "../../graph/hooks/useGraphSelection";
import { CandidateEdge } from "./edges/CandidateEdge";
import { MissingEdge } from "./edges/MissingEdge";
import { RelationEdge } from "./edges/RelationEdge";
import { ValidatedEdge } from "./edges/ValidatedEdge";
import { GraphEmptyOverlay } from "./GraphEmptyOverlay";
import { GraphInspectorDrawer } from "./GraphInspectorDrawer";
import { GraphLegend } from "./GraphLegend";
import { GraphToolbar } from "./GraphToolbar";
import { CandidateNode } from "./nodes/CandidateNode";
import { ClusterNode } from "./nodes/ClusterNode";
import { ComponentNode } from "./nodes/ComponentNode";
import { EntityNode } from "./nodes/EntityNode";

/* ── Node / Edge type registrations (stable references) ── */
const nodeTypes = {
  entity: EntityNode,
  component: ComponentNode,
  cluster: ClusterNode,
  candidate: CandidateNode,
} satisfies NodeTypes;

const edgeTypes = {
  relation: RelationEdge,
  candidate: CandidateEdge,
  missing: MissingEdge,
  validated: ValidatedEdge,
} satisfies EdgeTypes;

/* ── Minimap color helper ─────────────────────────────────── */
function minimapColor(node: Node<CanvasNodeData>) {
  const m = node.data.node;
  if (m.kind === "component") return "#374151";
  if (m.kind === "cluster") return "#7C3AED";
  if (m.kind === "candidate") return "#F59E0B";
  if (m.is_isolated) return "#F59E0B";
  return m.highlighted ? "#10B981" : "#06B6D4";
}

/* ── Fit-view controller (triggers once per token change) ── */
function FitViewController({ token }: { token: string | number | undefined }) {
  const reactFlow = useReactFlow();
  useEffect(() => {
    if (token === undefined) return;
    const t = window.setTimeout(() => {
      reactFlow.fitView({ duration: 320, padding: 0.2 });
    }, 40);
    return () => window.clearTimeout(t);
  }, [reactFlow, token]);
  return null;
}

/* ── KGGraph ──────────────────────────────────────────────── */
interface KGGraphProps {
  graph: GraphPayload;
  title?: string;
  description?: string;
  fitViewKey?: string | number;
  compactChrome?: boolean;
  canvasHeight?: string;
}

function KGGraphImpl({
  graph,
  title = "Knowledge Graph View",
  description = "The canvas stays structural: details move into side panels while focus and disclosure depend on zoom and selection.",
  fitViewKey,
  compactChrome = false,
  canvasHeight,
}: KGGraphProps) {
  /* ── Local UI state ─── */
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fitNonce, setFitNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [compactPanelOpen, setCompactPanelOpen] = useState(false);

  const detailLevel = zoomLevel >= 1.22 ? "close" : zoomLevel >= 0.82 ? "medium" : "far";
  const isLargeGraph = graph.nodes.length > 100;

  /* ── Selection hook ─── */
  const selection = useGraphSelection(graph);

  /* ── Elements hook (nodes + edges without positions) ─── */
  const { rfNodes, rfEdges } = useGraphElements({
    graph,
    visibleEdgeStatuses: selection.visibleEdgeStatuses,
    presentationMode: selection.presentationMode,
    selectedEdgeId: selection.selectedEdgeId,
    selectedNodeId: selection.selectedNodeId,
    hoveredEdgeId: selection.hoveredEdgeId,
    showLabels: selection.showLabels,
    detailLevel,
    evidenceNodeIds: selection.evidenceNodeIds,
  });

  /* ── Layout hook (positions — depends only on topology) ── */
  const hasOnlyEntities = graph.nodes.every(
    (n) => n.kind === "entity" || n.kind === "candidate",
  );
  const hasOmniaPositions =
    graph.layoutMode === "omnia" &&
    graph.nodes.length > 0 &&
    graph.nodes.every((n) => n.position != null);
  const layoutNodes = useGraphLayout(
    rfNodes,
    rfEdges,
    graph.aggregated,
    hasOnlyEntities,
    hasOmniaPositions,
  );

  /* ── Fullscreen handlers ─── */
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
    setTimeout(() => setFitNonce((v) => v + 1), 80);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  /* ── Auto-open inspector on selection ─── */
  useEffect(() => {
    if (selection.selectedNode || selection.selectedEdge) {
      setInspectorOpen(true);
    }
  }, [selection.selectedNode, selection.selectedEdge]);

  /* ── Render ───────────────────────────────────────────── */
  const compactHeader = compactChrome && !isFullscreen;
  const graphContent = (
    <>
      {/* Header bar */}
      <div
        className={`flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 ${compactHeader ? "px-3 py-2" : ""} ${isFullscreen ? "bg-panel" : ""}`}
      >
        <div className="max-w-3xl min-w-0">
          <h3 className={compactHeader ? "text-sm font-bold text-slate-100" : "panel-title"}>{title}</h3>
          {!isFullscreen && !!description.trim() ? (
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {!compactChrome ? (
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              <span className="rounded-full border border-border bg-bg px-3 py-1.5">{graph.displayed_nodes} nodes</span>
              <span className="rounded-full border border-border bg-bg px-3 py-1.5">{graph.displayed_triples} triples</span>
              <span className="rounded-full border border-border bg-bg px-3 py-1.5">
                {graph.aggregated ? "summary mode" : graph.view}
              </span>
              {graph.truncated ? (
                <span className="rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-amber">sampled for readability</span>
              ) : null}
            </div>
          ) : (
            <span className="rounded-full bg-surface/70 px-2 py-1 text-[10px] font-semibold text-muted">{graph.displayed_triples} triples</span>
          )}
          {!compactChrome ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 rounded-card border border-border bg-bg px-4 py-2 text-xs font-semibold text-ink transition hover:border-cyan hover:text-cyan"
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Expand graph to fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  Minimize
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  Fullscreen
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {graph.warnings.length ? (
        <div className="border-b border-border px-5 py-3 text-sm text-amber">
          {graph.warnings.join(" ")}
        </div>
      ) : null}

      {/* Graph canvas — FULL WIDTH, inspector is an overlay drawer */}
      <div
        className={`relative min-w-0 bg-[radial-gradient(circle_at_1px_1px,rgba(164,175,190,0.12)_1px,transparent_0)] [background-size:24px_24px] ${
          isFullscreen
            ? "h-[calc(100vh-4rem)]"
            : compactChrome
              ? canvasHeight ?? "h-[clamp(22rem,58vh,44rem)]"
              : "h-[clamp(26rem,62vh,46rem)]"
        } ${isLargeGraph ? "omnia-large-graph" : ""}`}
      >
        {/* Floating toolbar — top left */}
        {compactChrome ? (
          <div className="absolute left-3 top-3 z-10 flex max-w-[min(100%-1.5rem,22rem)] flex-col gap-2">
            <button
              type="button"
              className="w-fit rounded-md border border-border bg-surface/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted shadow backdrop-blur hover:text-ink"
              aria-expanded={compactPanelOpen}
              onClick={() => setCompactPanelOpen((open) => !open)}
            >
              {compactPanelOpen ? "Hide controls" : "View options"}
            </button>
            {compactPanelOpen ? (
              <div className="rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">
                <GraphToolbar
                  showLabels={selection.showLabels}
                  presentationMode={selection.presentationMode}
                  visibleEdgeStatuses={selection.visibleEdgeStatuses}
                  onToggleLabels={() => selection.setShowLabels((v: boolean) => !v)}
                  onTogglePresentationMode={() => selection.setPresentationMode((v: boolean) => !v)}
                  onToggleStatus={selection.toggleStatus}
                  onResetStatuses={selection.resetStatuses}
                  onFitView={() => setFitNonce((v) => v + 1)}
                  onResetSelection={selection.clearSelection}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)]">
            <GraphToolbar
              showLabels={selection.showLabels}
              presentationMode={selection.presentationMode}
              visibleEdgeStatuses={selection.visibleEdgeStatuses}
              onToggleLabels={() => selection.setShowLabels((v: boolean) => !v)}
              onTogglePresentationMode={() => selection.setPresentationMode((v: boolean) => !v)}
              onToggleStatus={selection.toggleStatus}
              onResetStatuses={selection.resetStatuses}
              onFitView={() => setFitNonce((v) => v + 1)}
              onResetSelection={selection.clearSelection}
            />
          </div>
        )}

        {/* Legend toggle — bottom left */}
        {!compactChrome ? (
        <div className="absolute bottom-4 left-4 z-10">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            className="rounded-card border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-muted shadow-sm backdrop-blur hover:text-ink"
          >
            {legendOpen ? "Hide legend" : "Show legend"}
          </button>
          {legendOpen && (
            <div className="mt-2">
              <GraphLegend />
            </div>
          )}
        </div>
        ) : null}

        {/* Inspector toggle — top right */}
        <div className="absolute right-4 top-4 z-10">
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            className="rounded-card border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-muted shadow-sm backdrop-blur hover:text-ink"
          >
            {inspectorOpen ? "Hide inspector" : "Inspector"}
          </button>
        </div>

        {layoutNodes.length === 0 ? (
          <GraphEmptyOverlay message="No graph nodes were returned for this view." />
        ) : null}

        <ReactFlow
          nodes={layoutNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onlyRenderVisibleElements
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => selection.selectNode(node.id)}
          onEdgeClick={(_, edge) => selection.selectEdge(edge.id)}
          onPaneClick={selection.clearSelection}
          onMove={(_, viewport) => setZoomLevel(viewport.zoom)}
          onEdgeMouseEnter={(_, edge) => selection.setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => selection.setHoveredEdgeId(null)}
        >
          <FitViewController
            token={`${fitViewKey ?? "graph"}-${fitNonce}-${isFullscreen ? "fs" : "in"}`}
          />
          {!compactChrome ? (
          <MiniMap
            pannable
            zoomable
            bgColor="#111318"
            maskColor="rgba(17,19,24,0.62)"
            nodeStrokeColor="#303845"
            nodeColor={(node) => minimapColor(node as Node<CanvasNodeData>)}
          />
          ) : null}
          <Controls showInteractive={false} position="bottom-right" />
          <Background gap={24} size={1} color="rgba(164,175,190,0.12)" />
        </ReactFlow>

        {/* Inspector drawer — slides over graph, not beside it */}
        <GraphInspectorDrawer
          graph={graph}
          selectedNode={selection.selectedNode}
          selectedEdge={selection.selectedEdge}
          connectedEdges={selection.connectedEdges}
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          onClear={selection.clearSelection}
        />
      </div>
    </>
  );

  /* ── Fullscreen overlay ─── */
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-bg/95 backdrop-blur-sm">
        <div className="flex-1 flex flex-col overflow-hidden rounded-none border-0">
          {graphContent}
        </div>
        <div className="absolute bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-border bg-panel/95 px-5 py-2.5 text-xs font-semibold text-muted shadow-lg backdrop-blur">
          Press{" "}
          <kbd className="mx-1 rounded border border-border bg-surface px-2 py-0.5 font-mono text-ink">
            Esc
          </kbd>{" "}
          or click the minimize button to exit fullscreen
        </div>
      </div>
    );
  }

  return (
    <div className={compactChrome ? "overflow-hidden" : "panel overflow-hidden"}>
      {graphContent}
    </div>
  );
}

export const KGGraph = memo(KGGraphImpl);
