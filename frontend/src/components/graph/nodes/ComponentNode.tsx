import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Box } from "lucide-react";
import type { GraphNode } from "../../../types";

type DetailLevel = "far" | "medium" | "close";

interface ComponentNodeData extends Record<string, unknown> {
  node: GraphNode;
  detailLevel: DetailLevel;
}

export function ComponentNode(props: NodeProps) {
  const data = props.data as ComponentNodeData;
  const node = data.node;
  const selected = props.selected || node.highlighted;

  return (
    <div
      className={clsx(
        "w-[232px] rounded-card border bg-bg p-4 text-left shadow-sm transition",
        selected ? "border-cyan ring-4 ring-cyan/15" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-steel" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-steel" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-card border border-border bg-surface p-2 text-cyan">
            <Box className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Connected component
            </div>
            <div className="mt-1 truncate text-lg font-semibold text-ink">{node.label}</div>
          </div>
        </div>
        {node.warning ? (
          <span className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[10px] font-semibold text-amber">sparse</span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted">
        <div className="rounded-lg border border-border bg-bg px-2 py-2">
          <div className="font-semibold text-ink">{node.node_count ?? 0}</div>
          nodes
        </div>
        <div className="rounded-lg border border-border bg-bg px-2 py-2">
          <div className="font-semibold text-ink">{node.edge_count ?? 0}</div>
          triples
        </div>
        <div className="rounded-lg border border-border bg-bg px-2 py-2">
          <div className="font-semibold text-ink">{node.cluster_count ?? 0}</div>
          clusters
        </div>
      </div>

      {data.detailLevel !== "far" ? (
        <div className="mt-3 space-y-1 text-xs leading-5 text-muted">
          <div className="truncate">Nodes: {(node.sample_nodes ?? []).join(", ") || "n/a"}</div>
          <div className="truncate">Relations: {(node.sample_relations ?? []).join(", ") || "n/a"}</div>
          {node.warning ? <div className="font-medium text-amber">{node.warning}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
