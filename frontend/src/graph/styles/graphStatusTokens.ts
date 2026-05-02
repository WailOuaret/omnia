/**
 * Unified OMNIA status tokens.
 *
 * Every visual encoding (graph edges, legend swatches, table badges,
 * decision cards, and toolbar filters) should reference these tokens
 * so that status meaning is consistent across the entire UI.
 */

export interface StatusToken {
  /** Human-readable label */
  label: string;
  /** Edge / badge stroke or fill color */
  color: string;
  /** Tailwind text color class */
  textClass: string;
  /** Tailwind background class for badges/chips */
  bgClass: string;
  /** Tailwind border class for badges/chips */
  borderClass: string;
  /** SVG stroke-dasharray (undefined = solid) */
  dash?: string;
  /** Edge stroke width (normal state) */
  strokeWidth: number;
  /** Edge stroke width when selected */
  strokeWidthSelected: number;
  /** Normal opacity */
  opacity: number;
  /** Optional glow filter */
  glow?: string;
  /** Short description for tooltips */
  description: string;
  /** Lucide icon name hint (used by legend) */
  iconHint: string;
}

export const STATUS_TOKENS: Record<string, StatusToken> = {
  original: {
    label: "Original KG",
    color: "#64748B",
    textClass: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/30",
    strokeWidth: 1.5,
    strokeWidthSelected: 2.8,
    opacity: 0.72,
    description: "Existing triple in the input knowledge graph",
    iconHint: "minus",
  },
  generated: {
    label: "Generated candidate",
    color: "#7C3AED",
    textClass: "text-violet",
    bgClass: "bg-violet/10",
    borderClass: "border-violet/30",
    dash: "8 6",
    strokeWidth: 1.8,
    strokeWidthSelected: 3,
    opacity: 0.72,
    description: "Candidate triple produced by cluster propagation",
    iconHint: "sparkles",
  },
  missing: {
    label: "Missing / recovered",
    color: "#F59E0B",
    textClass: "text-amber",
    bgClass: "bg-amber/10",
    borderClass: "border-amber/30",
    dash: "5 5",
    strokeWidth: 2.3,
    strokeWidthSelected: 3.4,
    opacity: 0.82,
    glow: undefined,
    description: "Ground-truth missing or recovered fact (holdout mode)",
    iconHint: "search",
  },
  filtered_passed: {
    label: "TransE passed",
    color: "#10B981",
    textClass: "text-green",
    bgClass: "bg-green/10",
    borderClass: "border-green/30",
    strokeWidth: 1.6,
    strokeWidthSelected: 2.8,
    opacity: 0.82,
    description: "Candidate passed the TransE embedding filter",
    iconHint: "check",
  },
  filtered_rejected: {
    label: "TransE rejected",
    color: "#EF4444",
    textClass: "text-red",
    bgClass: "bg-red/10",
    borderClass: "border-red/30",
    dash: "4 8",
    strokeWidth: 1.4,
    strokeWidthSelected: 2.4,
    opacity: 0.42,
    description: "Candidate rejected by TransE embedding filter",
    iconHint: "x",
  },
  llm_accepted: {
    label: "LLM accepted",
    color: "#10B981",
    textClass: "text-green",
    bgClass: "bg-green/10",
    borderClass: "border-green/30",
    strokeWidth: 2.6,
    strokeWidthSelected: 4.2,
    opacity: 0.92,
    glow: undefined,
    description: "Candidate accepted by LLM semantic validation",
    iconHint: "check-circle",
  },
  llm_rejected: {
    label: "LLM rejected",
    color: "#EF4444",
    textClass: "text-red",
    bgClass: "bg-red/10",
    borderClass: "border-red/30",
    dash: "4 8",
    strokeWidth: 1.8,
    strokeWidthSelected: 3,
    opacity: 0.42,
    description: "Candidate rejected by LLM semantic validation",
    iconHint: "x-circle",
  },
  unresolved: {
    label: "Unresolved",
    color: "#64748B",
    textClass: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/30",
    dash: "2 6",
    strokeWidth: 1.2,
    strokeWidthSelected: 2,
    opacity: 0.5,
    description: "Candidate not yet evaluated",
    iconHint: "clock",
  },
} as const;

/**
 * CSS variable declarations that can be injected into :root.
 * Kept here for reference; the actual injection is in index.css.
 */
export const STATUS_CSS_VARS = Object.entries(STATUS_TOKENS).reduce(
  (vars, [key, token]) => {
    vars[`--status-${key}`] = token.color;
    return vars;
  },
  {} as Record<string, string>,
);

/** Ordered list used by legend & toolbar filter buttons */
export const STATUS_ORDER = [
  "original",
  "generated",
  "missing",
  "filtered_passed",
  "filtered_rejected",
  "llm_accepted",
  "llm_rejected",
  "unresolved",
] as const;
