import { DEMO_BADGE_STYLE, DEMO_LEGEND_ORDER, type DemoStatusKey } from "./demoStatusTokens";

interface DemoLegendProps {
  /**
   * Optional subset of statuses to keep visible (used by step-aware tabs).
   * If omitted, the full `DEMO_LEGEND_ORDER` is rendered.
   */
  statuses?: DemoStatusKey[];
  compact?: boolean;
}

/**
 * Paper-friendly status legend that mirrors graph edges, candidate badges,
 * and explanation cards. Always uses both color + line-style + icon to
 * avoid color-only encoding (accessibility rule from the spec).
 */
export function DemoLegend({ statuses, compact }: DemoLegendProps) {
  const ordered = (statuses ?? DEMO_LEGEND_ORDER).filter((id) => DEMO_BADGE_STYLE[id]);
  return (
    <ul
      role="list"
      aria-label="OMNIA status legend"
      className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-sm"
    >
      {ordered.map((id) => {
        const token = DEMO_BADGE_STYLE[id];
        return (
          <li key={id} className="flex items-center gap-2" title={token.description}>
            <svg
              width="22"
              height="10"
              viewBox="0 0 22 10"
              aria-hidden="true"
              className="shrink-0"
            >
              <line
                x1="1"
                y1="5"
                x2="21"
                y2="5"
                stroke={token.color}
                strokeWidth={id === "llm_accepted" ? 3 : 2}
                strokeLinecap="round"
                strokeDasharray={token.dash}
              />
            </svg>
            <span className={token.textClass}>
              {token.label}
              {!compact ? <span className="ml-1 text-[10px] text-slate-500">({token.iconHint})</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
