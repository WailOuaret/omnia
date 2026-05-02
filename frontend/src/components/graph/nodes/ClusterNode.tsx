import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Network } from "lucide-react";
import type { GraphNode } from "../../../types";

type DetailLevel = "far" | "medium" | "close";

interface ClusterNodeData extends Record<string, unknown> {
  node: GraphNode;
  detailLevel: DetailLevel;
  evidenceActive?: boolean;
}

export function ClusterNode(props: NodeProps) {
  const data = props.data as ClusterNodeData;
  const node = data.node;
  const selected = props.selected || node.highlighted;

  return (
    <div
      className={clsx(
        "min-w-[220px] rounded-card border bg-bg p-4 shadow-sm transition",
        selected ? "border-accent ring-4 ring-accent/15" : "border-border",
        data.evidenceActive && "ring-2 ring-accent/30",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-violet" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-violet" />

      <div className="flex items-start gap-3">
        <div className="rounded-card border border-border bg-surface p-2 text-cyan">
          <Network className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Relation-tail cluster</div>
          <div className="mt-1 truncate text-base font-semibold text-ink">{node.label}</div>
          {node.description && data.detailLevel !== "far" ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{node.description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted">
        <div className="rounded-lg border border-border bg-bg px-2 py-2">
          <div className="font-semibold text-ink">{node.node_count ?? node.degree}</div>
          heads
        </div>
        <div className="rounded-lg border border-border bg-bg px-2 py-2">
          <div className="font-semibold text-ink">{node.edge_count ?? 0}</div>
          triples
        </div>
        <div className="rounded-lg border border-border bg-bg px-2 py-2">
          <div className="font-semibold text-ink">{node.relation_count ?? 0}</div>
          pairs
        </div>
      </div>
    </div>
  );
}
