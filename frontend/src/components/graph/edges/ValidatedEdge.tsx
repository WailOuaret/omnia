import type { EdgeProps } from "@xyflow/react";
import { STATUS_TOKENS } from "../../../graph/styles/graphStatusTokens";
import { renderGraphEdge } from "./RelationEdge";

export function ValidatedEdge(props: EdgeProps) {
  const data = props.data && typeof props.data === "object" ? (props.data as { rejected?: boolean; status?: string }) : {};
  const rejected = data.rejected;
  const token =
    data.status && data.status in STATUS_TOKENS
      ? STATUS_TOKENS[data.status]
      : rejected
        ? STATUS_TOKENS.llm_rejected
        : STATUS_TOKENS.llm_accepted;

  return renderGraphEdge(props, {
    stroke: token.color,
    width: props.selected ? token.strokeWidthSelected : token.strokeWidth,
    dash: token.dash,
    opacity: token.opacity,
    glow: !rejected ? token.glow : undefined,
  });
}
