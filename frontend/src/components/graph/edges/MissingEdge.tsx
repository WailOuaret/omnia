import type { EdgeProps } from "@xyflow/react";
import { STATUS_TOKENS } from "../../../graph/styles/graphStatusTokens";
import { renderGraphEdge } from "./RelationEdge";

export function MissingEdge(props: EdgeProps) {
  const token = STATUS_TOKENS.missing;
  return renderGraphEdge(props, {
    stroke: token.color,
    width: props.selected ? token.strokeWidthSelected : token.strokeWidth,
    dash: token.dash,
    opacity: props.selected ? 1 : token.opacity,
    glow: token.glow,
  });
}
