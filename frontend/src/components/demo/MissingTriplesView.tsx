import clsx from "clsx";
import { KGGraph } from "../graph/KGGraph";
import type { CandidateRecord, GraphPayload } from "../../types";
import { DEMO_BADGE_STYLE } from "./demoStatusTokens";
import { DemoLegend } from "./DemoLegend";

interface MissingTriplesViewProps {
  graph: GraphPayload | null;
  selected: CandidateRecord | null;
  holdoutMode?: boolean;
}

/**
 * Step "Missing triples" view (teacher-driven layout).
 *
 * Original context is rendered at low opacity and the dashed-amber
 * candidate edge is the focal element. The header lists the holdout-mode
 * sub-categories so the audience can read the diagram in seconds.
 */
export function MissingTriplesView({ graph, selected, holdoutMode }: MissingTriplesViewProps) {
  const recoveredHint = selected?.Missing === 1;

  return (
    <section
      data-testid="demo-missing-view"
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Missing triples</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">
            {selected
              ? "Dashed amber edge is the candidate OMNIA proposes to recover. Original context stays dimmed."
              : "Select any candidate to localize the missing-triple subgraph."}
          </p>
          {holdoutMode ? (
            <ul className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <Pill tone="missing">Recovered true missing</Pill>
              <Pill tone="generated">Generated false candidate</Pill>
              <Pill tone="unresolved">Not recovered holdout</Pill>
            </ul>
          ) : null}
          {recoveredHint ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              Recovered ↩ holdout match
            </p>
          ) : null}
        </div>
        <DemoLegend statuses={["original", "generated", "missing", "selected"]} compact />
      </header>

      <div className="relative min-h-0 flex-1">
        {graph ? (
          <KGGraph
            graph={graph}
            title=""
            description=""
            compactChrome
            fitViewKey={`missing-${graph.displayed_triples}-${graph.displayed_nodes}-${selected?.Head ?? ""}`}
          />
        ) : (
          <div className="flex h-[clamp(220px,46vh,360px)] items-center justify-center text-sm text-slate-600">
            Run the OMNIA pipeline to surface missing-triple candidates.
          </div>
        )}
      </div>
    </section>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: keyof typeof DEMO_BADGE_STYLE }) {
  const style = DEMO_BADGE_STYLE[tone];
  return (
    <li
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
        style.textClass,
        style.bgClass,
        style.borderClass,
      )}
    >
      <span aria-hidden style={{ background: style.color }} className="inline-block h-1.5 w-3 rounded-full" />
      {children}
    </li>
  );
}
