import type { EdgeProps } from "@xyflow/react";
import { STATUS_TOKENS } from "../../../graph/styles/graphStatusTokens";
import { renderGraphEdge } from "./RelationEdge";

export function CandidateEdge(props: EdgeProps) {
  const token = STATUS_TOKENS.generated;
  return renderGraphEdge(props, {
    stroke: token.color,
    width: props.selected ? token.strokeWidthSelected : token.strokeWidth,
    dash: token.dash,
    opacity: props.selected ? 0.95 : token.opacity,
    glow: props.selected ? token.glow ?? "drop-shadow(0 0 9px rgba(124,58,237,0.45))" : undefined,
  });
}
