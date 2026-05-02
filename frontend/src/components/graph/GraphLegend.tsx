import { STATUS_TOKENS, STATUS_ORDER } from "../../graph/styles/graphStatusTokens";

/**
 * Complete KG Diff Legend with the full status taxonomy.
 * Each item uses the exact same visual encoding as graph edges,
 * table badges, and decision cards — driven by `graphStatusTokens.ts`.
 */
export function GraphLegend() {
  return (
    <div className="rounded-card border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        KG Diff Legend
      </div>
      <div className="mt-3 space-y-2">
        {STATUS_ORDER.map((key) => {
          const token = STATUS_TOKENS[key];
          return (
            <div key={key} className="flex items-center gap-2.5 text-xs text-muted">
              <span
                className="block w-9"
                style={{
                  borderTopWidth: `${token.strokeWidth}px`,
                  borderTopColor: token.color,
                  borderTopStyle: token.dash ? "dashed" : "solid",
                  opacity: token.opacity,
                  filter: token.glow ?? "none",
                }}
              />
              <span>{token.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2.5 text-xs text-muted">
          <span className="block h-2 w-9 rounded-full bg-cyan" />
          <span>Selected evidence path</span>
        </div>
      </div>
    </div>
  );
}
