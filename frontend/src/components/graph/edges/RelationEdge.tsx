import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { CSSProperties } from "react";
import type { GraphEdge } from "../../../types";
import { STATUS_TOKENS } from "../../../graph/styles/graphStatusTokens";
import { cleanRelationLabel, truncateRelationLabel } from "../../../lib/kgLabels";

interface EdgeData extends Record<string, unknown> {
  edge: GraphEdge;
  showLabel: boolean;
  muted: boolean;
}

interface EdgeTone {
  stroke: string;
  width: number;
  dash?: string;
  opacity?: number;
  glow?: string;
}

function compactLabel(label: string, max = 22) {
  return truncateRelationLabel(label, max);
}

export function renderGraphEdge(props: EdgeProps, tone: EdgeTone) {
  const data = props.data as EdgeData | undefined;
  const [edgePath, labelX, labelY] = getSmoothStepPath(props);
  const style: CSSProperties = {
    stroke: tone.stroke,
    strokeWidth: tone.width,
    strokeDasharray: tone.dash,
    opacity: data?.muted ? 0.14 : tone.opacity ?? 0.82,
    filter: tone.glow,
    ...props.style,
  };

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={props.markerEnd}
        interactionWidth={24}
        className={props.animated ? "omnia-edge-animated" : undefined}
        style={style}
      />
      {data?.showLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan max-w-[14rem] truncate rounded-md border border-slate-600/80 bg-[#1e2433]/90 px-2 py-0.5 text-[10px] font-semibold text-slate-100 shadow-sm"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
            title={cleanRelationLabel(data.edge.label)}
          >
            {compactLabel(data.edge.label)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export function RelationEdge(props: EdgeProps) {
  const token = STATUS_TOKENS.original;
  return renderGraphEdge(props, {
    stroke: token.color,
    width: props.selected ? token.strokeWidthSelected : token.strokeWidth,
    dash: token.dash,
    opacity: props.selected ? 0.95 : token.opacity,
    glow: props.selected ? token.glow : undefined,
  });
}
