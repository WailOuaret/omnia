import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { GraphNode } from "../../../types";
import { formatKgLabelParts } from "../../../lib/kgLabels";

type DetailLevel = "far" | "medium" | "close";

interface EntityNodeData extends Record<string, unknown> {
  node: GraphNode;
  detailLevel: DetailLevel;
  showLabels: boolean;
  evidenceActive: boolean;
}

export function EntityNode(props: NodeProps) {
  const data = props.data as EntityNodeData;
  const node = data.node;
  const selected = props.selected || node.highlighted;
  const sparse = node.is_isolated || Boolean(node.warning);
  const parts = formatKgLabelParts(node.id, node.label, "entity");

  return (
    <div
      className={clsx(
        "relative grid h-32 w-32 place-items-center rounded-full border-2 p-4 text-center shadow-sm transition-all duration-200",
        sparse
          ? "border-amber bg-amber/10"
          : "border-cyan bg-cyan/10",
        selected && "scale-105 border-green ring-4 ring-green/20",
        data.evidenceActive && "ring-2 ring-green/45",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-steel" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-steel" />

      <div className="min-w-0">
        <div className={clsx("mx-auto mb-2 h-2.5 w-2.5 rounded-full", sparse ? "bg-amber" : "bg-cyan")} />
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {sparse ? "Sparse" : "Entity"}
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-bold leading-tight text-ink" title={parts.isRawId ? node.id : undefined}>
          {parts.primary}
        </div>
        {parts.isRawId ? (
          <div className="mt-0.5 truncate font-mono text-[9px] opacity-60 text-muted" title={node.id}>
            {parts.secondary}
          </div>
        ) : null}
        <div className="mx-auto mt-2 w-fit rounded-full border border-border bg-bg px-2.5 py-1 text-[10px] font-semibold text-muted">
          deg {node.degree}
        </div>
      </div>

      {data.detailLevel === "close" || selected ? (
        <div className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1.5 text-[10px] font-semibold">
          {node.component_id ? (
            <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-1 text-cyan">{node.component_id}</span>
          ) : null}
          {node.cluster_id ? (
            <span className="rounded-full border border-violet/30 bg-violet/10 px-2 py-1 text-violet">{node.cluster_id}</span>
          ) : null}
          {sparse ? (
            <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-1 text-amber">isolated</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
