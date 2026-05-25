import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import type { GraphNode } from "../../../types";
import { formatKgLabelParts } from "../../../lib/kgLabels";

interface CandidateNodeData extends Record<string, unknown> {
  node: GraphNode;
}

function confidenceLabel(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "pending";
  }
  return `${Math.round(value * 100)}%`;
}

export function CandidateNode(props: NodeProps) {
  const data = props.data as CandidateNodeData;
  const node = data.node;
  const selected = props.selected || node.highlighted;
  const validated = node.stage === "validated" || node.stage === "completed";
  const parts = formatKgLabelParts(node.id, node.label, "entity");

  return (
    <div
      className={clsx(
        "min-w-[196px] rounded-card border-2 border-dashed p-4 shadow-sm transition",
        validated ? "border-green/70 bg-green/10" : "border-violet/70 bg-violet/10",
        selected && "ring-4 ring-accent/15",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-amber" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-amber" />

      <div className="flex items-start justify-between gap-3">
        <div className={clsx("rounded-card border border-border p-2", validated ? "bg-green/10 text-green" : "bg-violet/10 text-violet")}>
          <Sparkles className="h-4 w-4" />
        </div>
        <span
          className={clsx(
            "rounded-card border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            validated ? "bg-green/15 text-green" : "bg-violet/15 text-violet",
          )}
        >
          {node.stage ?? "candidate"}
        </span>
      </div>
      <div className={clsx("mt-3 text-[10px] font-semibold uppercase tracking-[0.2em]", validated ? "text-green" : "text-violet")}>
        Generated candidate
      </div>
      <div className="mt-1 text-sm font-semibold leading-5 text-ink" title={parts.isRawId ? node.id : undefined}>
        {parts.primary}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{node.cluster_id ?? "cluster pending"}</span>
        <span className="font-semibold text-ink">{confidenceLabel(node.confidence)}</span>
      </div>
    </div>
  );
}
