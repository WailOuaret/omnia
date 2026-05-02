/**
 * Demo workbench palette — paper-friendly mapping that mirrors the
 * canonical `STATUS_TOKENS` (graph edges) so the legend, candidate badges,
 * filtering chart and explanation cards never disagree.
 *
 * Visual encoding from the teacher's checklist:
 *   - Original KG triple        → solid slate
 *   - Generated candidate       → dashed violet
 *   - Missing / recovered       → dashed amber
 *   - TransE passed             → solid emerald outline
 *   - TransE rejected           → dashed red, low opacity
 *   - LLM accepted              → solid thick emerald
 *   - LLM rejected              → dashed red
 *   - Selected evidence path    → solid cyan glow
 *   - Unresolved / non-relevant → low-opacity slate
 */
import { STATUS_TOKENS, STATUS_ORDER } from "../../graph/styles/graphStatusTokens";

export type DemoStatusKey = (typeof STATUS_ORDER)[number] | "selected";

export interface DemoBadgeStyle {
  label: string;
  color: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dash?: string;
  iconHint: string;
  description: string;
}

export const DEMO_BADGE_STYLE: Record<DemoStatusKey, DemoBadgeStyle> = {
  original: {
    label: "Original",
    color: STATUS_TOKENS.original.color,
    textClass: "text-slate-700",
    bgClass: "bg-slate-100",
    borderClass: "border-slate-300",
    iconHint: "minus",
    description: STATUS_TOKENS.original.description,
  },
  generated: {
    label: "Generated",
    color: STATUS_TOKENS.generated.color,
    textClass: "text-violet-800",
    bgClass: "bg-violet-50",
    borderClass: "border-violet-300",
    dash: STATUS_TOKENS.generated.dash,
    iconHint: "sparkles",
    description: STATUS_TOKENS.generated.description,
  },
  missing: {
    label: "Missing",
    color: STATUS_TOKENS.missing.color,
    textClass: "text-amber-800",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-300",
    dash: STATUS_TOKENS.missing.dash,
    iconHint: "search",
    description: STATUS_TOKENS.missing.description,
  },
  filtered_passed: {
    label: "TransE passed",
    color: STATUS_TOKENS.filtered_passed.color,
    textClass: "text-emerald-800",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-300",
    iconHint: "check",
    description: STATUS_TOKENS.filtered_passed.description,
  },
  filtered_rejected: {
    label: "TransE rejected",
    color: STATUS_TOKENS.filtered_rejected.color,
    textClass: "text-rose-800",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-300",
    dash: STATUS_TOKENS.filtered_rejected.dash,
    iconHint: "x",
    description: STATUS_TOKENS.filtered_rejected.description,
  },
  llm_accepted: {
    label: "LLM accepted",
    color: STATUS_TOKENS.llm_accepted.color,
    textClass: "text-emerald-900",
    bgClass: "bg-emerald-100",
    borderClass: "border-emerald-400",
    iconHint: "check-circle",
    description: STATUS_TOKENS.llm_accepted.description,
  },
  llm_rejected: {
    label: "LLM rejected",
    color: STATUS_TOKENS.llm_rejected.color,
    textClass: "text-rose-900",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-400",
    dash: STATUS_TOKENS.llm_rejected.dash,
    iconHint: "x-circle",
    description: STATUS_TOKENS.llm_rejected.description,
  },
  unresolved: {
    label: "Unresolved",
    color: STATUS_TOKENS.unresolved.color,
    textClass: "text-slate-600",
    bgClass: "bg-slate-50",
    borderClass: "border-slate-300",
    dash: STATUS_TOKENS.unresolved.dash,
    iconHint: "clock",
    description: STATUS_TOKENS.unresolved.description,
  },
  selected: {
    label: "Selected evidence",
    color: "#06B6D4",
    textClass: "text-cyan-900",
    bgClass: "bg-cyan-50",
    borderClass: "border-cyan-300",
    iconHint: "target",
    description: "Currently selected candidate / evidence path.",
  },
};

export const DEMO_LEGEND_ORDER: DemoStatusKey[] = [
  "original",
  "generated",
  "missing",
  "filtered_passed",
  "filtered_rejected",
  "llm_accepted",
  "llm_rejected",
  "unresolved",
  "selected",
];

export type CandidateStatusKey =
  | "llm_accepted"
  | "llm_rejected"
  | "filtered_passed"
  | "filtered_rejected"
  | "generated"
  | "unresolved";

/** Reduce a row's signals into one dominant status badge. */
export function classifyCandidateRow(row: {
  decision?: string;
  filter_decision?: string;
  status?: string;
}): CandidateStatusKey {
  const decision = (row.decision ?? "").toLowerCase();
  if (decision === "accepted") return "llm_accepted";
  if (decision === "rejected") return "llm_rejected";
  const filterDecision = (row.filter_decision ?? "").toLowerCase();
  if (filterDecision === "rejected" || (row.status ?? "").toLowerCase() === "filtered_rejected") {
    return "filtered_rejected";
  }
  if (filterDecision === "passed" || (row.status ?? "").toLowerCase() === "filtered_passed") {
    return "filtered_passed";
  }
  if (decision === "unresolved" || decision === "skipped") return "unresolved";
  return "generated";
}
