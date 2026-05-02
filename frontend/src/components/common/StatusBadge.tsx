import clsx from "clsx";
import { STATUS_TOKENS } from "../../graph/styles/graphStatusTokens";

const statusAliases: Record<string, string> = {
  completed: "llm_accepted",
  accepted: "llm_accepted",
  rejected: "llm_rejected",
  unresolved: "unresolved",
  pending: "unresolved",
  "filtered out": "filtered_rejected",
  "filter rejected": "filtered_rejected",
  "filter passed": "filtered_passed",
  generated: "generated",
  "duplicate existing": "original",
  "sent to filter": "generated",
  "sent to LLM": "filtered_passed",
  ready: "filtered_passed",
  disabled: "unresolved",
  original: "original",
  cluster: "generated",
  candidate: "generated",
  filtered: "filtered_passed",
  validated: "llm_accepted",
  filtered_passed: "filtered_passed",
  filtered_rejected: "filtered_rejected",
  llm_accepted: "llm_accepted",
  llm_rejected: "llm_rejected",
  missing: "missing",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = statusAliases[String(status).toLowerCase()] ?? statusAliases[String(status)] ?? String(status);
  const token = STATUS_TOKENS[normalized] ?? STATUS_TOKENS.unresolved;

  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        className,
      )}
      style={{
        color: token.color,
        borderColor: `${token.color}55`,
        backgroundColor: `${token.color}1F`,
      }}
      title={token.description}
    >
      {status}
    </span>
  );
}
