import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { GraphNode } from "../../types";
import { formatKgLabelParts } from "../../lib/kgLabels";

interface PaperDemoEntityNodeData extends Record<string, unknown> {
  node: GraphNode;
  evidenceActive: boolean;
  detailLevel?: "medium" | "close";
}

/** Compact entity node for the paper-demo live graph. */
export function PaperDemoEntityNode(props: NodeProps) {
  const data = props.data as PaperDemoEntityNodeData;
  const node = data.node;
  const selected = props.selected || node.highlighted;
  const parts = formatKgLabelParts(node.id, node.label, "entity");
  const isLarge = data.detailLevel === "close";

  return (
    <div
      className={clsx(
        "relative rounded-lg border px-2 py-2 text-center shadow-sm transition-all",
        isLarge ? "w-[200px]" : "w-[168px]",
        selected
          ? "border-sky-600 bg-sky-50 ring-2 ring-sky-300"
          : "border-slate-400 bg-white hover:border-slate-600",
        data.evidenceActive && "ring-2 ring-emerald-300",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-slate-500" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-slate-500" />

      <div className="min-w-0">
        <p
          className={clsx(
            "line-clamp-2 font-semibold leading-tight text-slate-900",
            isLarge ? "text-sm" : "text-[11px]",
          )}
        >
          {parts.primary}
        </p>
        {parts.isRawId ? (
          <p
            className={clsx("mt-0.5 truncate font-mono text-slate-600", isLarge ? "text-[10px]" : "text-[9px]")}
            title={parts.secondary}
          >
            {parts.secondary}
          </p>
        ) : parts.secondary && parts.secondary !== parts.primary ? (
          <p
            className={clsx("mt-0.5 truncate font-mono text-slate-500", isLarge ? "text-[10px]" : "text-[9px]")}
            title={parts.secondary}
          >
            {parts.secondary}
          </p>
        ) : null}
      </div>
    </div>
  );
}
