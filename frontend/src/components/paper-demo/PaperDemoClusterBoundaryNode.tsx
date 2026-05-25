import { type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { GraphNode } from "../../types";
import { formatKgLabelParts } from "../../lib/kgLabels";

interface ClusterBoundaryData extends Record<string, unknown> {
  node: GraphNode;
}

/** Semi-transparent cluster wrapper — sits behind member entity nodes. */
export function PaperDemoClusterBoundaryNode(props: NodeProps) {
  const data = props.data as ClusterBoundaryData;
  const node = data.node;
  const memberCount = node.node_count ?? node.degree ?? 1;
  const height = node.boundary_height ?? Math.max(120, memberCount * 56 + 48);
  const parts = formatKgLabelParts(node.label, node.label, "relation");

  return (
    <div
      className={clsx(
        "pointer-events-none rounded-xl border-2 border-dashed border-indigo-400/70 bg-indigo-50/30",
        node.highlighted && "border-indigo-500/90 bg-indigo-50/45",
      )}
      style={{ width: 180, minHeight: height, height }}
    >
      <div className="border-b border-indigo-200/80 px-2 py-1">
        <p className="text-[8px] font-semibold uppercase tracking-wide text-indigo-700">Cluster</p>
        <p className="line-clamp-2 text-[9px] font-medium leading-tight text-indigo-900" title={node.label}>
          {parts.primary}
        </p>
      </div>
      {node.description ? (
        <p className="px-2 py-1 text-[8px] leading-tight text-indigo-800/80">{node.description}</p>
      ) : null}
    </div>
  );
}
