import { useMemo, useRef } from "react";
import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import {
  ENTITY_WIDTH,
  ENTITY_HEIGHT,
  SUMMARY_WIDTH,
  SUMMARY_HEIGHT,
  type CanvasNodeData,
  type CanvasEdgeData,
} from "./useGraphElements";

/* ── Layout helpers ──────────────────────────────────────── */

function buildGridLayout(nodes: Node<CanvasNodeData>[]) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return nodes.map((node, i) => {
    const w = Number(node.style?.width ?? SUMMARY_WIDTH);
    const h = Number(node.style?.height ?? SUMMARY_HEIGHT);
    return {
      ...node,
      position: {
        x: (i % cols) * (w + 96),
        y: Math.floor(i / cols) * (h + 78),
      },
    };
  });
}

function buildDagreLayout(
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  direction: "LR" | "TB" = "LR",
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    align: "UL",
    nodesep: 72,
    ranksep: 128,
    marginx: 36,
    marginy: 36,
  });

  for (const n of nodes) {
    g.setNode(n.id, {
      width: Number(n.style?.width ?? ENTITY_WIDTH),
      height: Number(n.style?.height ?? ENTITY_HEIGHT),
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const w = Number(node.style?.width ?? ENTITY_WIDTH);
    const h = Number(node.style?.height ?? ENTITY_HEIGHT);
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });
}

/* ── Signature for cache invalidation ────────────────────── */

function graphSignature(
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  aggregated: boolean,
) {
  // Cheap content-addressable key.  Only IDs, kinds, and edge count matter
  // for layout — style/selection state must NOT be included.
  const nodeKey = nodes.map((n) => n.id).join(",");
  const edgeKey = edges.map((e) => `${e.source}->${e.target}`).join(",");
  return `${aggregated ? "A" : "E"}|${nodes.length}|${edges.length}|${nodeKey}|${edgeKey}`;
}

/* ── Hook ─────────────────────────────────────────────────── */

/**
 * Computes graph layout positions.
 *
 * Layout depends ONLY on graph topology (node ids, edge connections,
 * aggregation flag). It does NOT depend on selection, hover, labels,
 * detail level, or presentation mode — those are style-only concerns
 * handled by `useGraphElements`.
 */
export function useGraphLayout(
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  aggregated: boolean,
  allEntities: boolean,
) {
  const cacheRef = useRef<{ sig: string; result: Node<CanvasNodeData>[] }>({
    sig: "",
    result: [],
  });

  return useMemo(() => {
    const sig = graphSignature(nodes, edges, aggregated);

    // Cache hit — return same reference
    if (sig === cacheRef.current.sig && cacheRef.current.result.length > 0) {
      // Merge style-only data updates into cached positions
      const freshById = new Map(nodes.map((node) => [node.id, node]));
      return cacheRef.current.result.map((cached) => {
        const fresh = freshById.get(cached.id);
        return fresh
          ? { ...fresh, position: cached.position }
          : cached;
      });
    }

    let result: Node<CanvasNodeData>[];

    if (aggregated || edges.length === 0 || nodes.length > 300) {
      result = buildGridLayout(nodes);
    } else {
      result = buildDagreLayout(nodes, edges, allEntities ? "LR" : "TB");
    }

    cacheRef.current = { sig, result };
    return result;
  }, [nodes, edges, aggregated, allEntities]);
}
