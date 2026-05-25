import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { GraphNode } from "../../types";
import { formatKgLabelParts } from "../../lib/kgLabels";

interface PaperDemoEntityNodeData extends Record<string, unknown> {
  node: GraphNode;
  evidenceActive: boolean;
}

/** Compact entity node for the paper-demo live graph — readable labels, smaller footprint. */
export function PaperDemoEntityNode(props: NodeProps) {
  const data = props.data as PaperDemoEntityNodeData;
  const node = data.node;
  const selected = props.selected || node.highlighted;
  const parts = formatKgLabelParts(node.id, node.label, "entity");

  return (
    <div
      className={clsx(
        "relative w-[168px] rounded-lg border px-2 py-2 text-center shadow-sm transition-all",
        selected
          ? "border-sky-600 bg-sky-50 ring-2 ring-sky-300"
          : "border-slate-400 bg-white hover:border-slate-600",
        data.evidenceActive && "ring-2 ring-emerald-300",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-slate-500" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-slate-500" />

      <div className="min-w-0">
        <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-900">{parts.primary}</p>
        <p className="mt-0.5 truncate font-mono text-[8px] text-slate-600" title={parts.secondary}>
          {parts.secondary}
        </p>
        <span className="mt-1 inline-block rounded bg-slate-100 px-1 py-0.5 text-[8px] font-medium text-slate-600">
          d{node.degree}
        </span>
      </div>
    </div>
  );
}
