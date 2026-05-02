import { useState } from "react";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { KGGraph } from "../graph/KGGraph";
import type { CandidateRecord, GraphPayload } from "../../types";
import { tripleKey } from "./demoGraphBuilders";

interface BeforeAfterGraphCompareProps {
  before: GraphPayload | null;
  after: GraphPayload | null;
  selectedCandidate: CandidateRecord | null;
}

/**
 * Side-by-side / slider before-vs-after compare.
 *
 * Both graphs render through the same `KGGraph` canvas with `compactChrome`
 * so the visual encoding stays consistent — only the edge `status` token
 * changes between columns.
 */
export function BeforeAfterGraphCompare({
  before,
  after,
  selectedCandidate,
}: BeforeAfterGraphCompareProps) {
  const [mode, setMode] = useState<"split" | "before" | "after">("split");

  const candidateKey = selectedCandidate ? tripleKey(selectedCandidate) : null;

  return (
    <section
      data-testid="demo-diff-compare"
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Before ↔ After comparison
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {selectedCandidate
              ? "Selected candidate is highlighted only on the After side once accepted."
              : "Select a candidate triple from the queue to localize the comparison."}
          </p>
        </div>
        <div role="tablist" aria-label="Diff layout" className="flex flex-wrap gap-1.5">
          {(["split", "before", "after"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => setMode(option)}
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition",
                mode === option
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div
        className={clsx(
          "grid min-h-0 flex-1 gap-3 p-3",
          mode === "split" ? "lg:grid-cols-2" : "grid-cols-1",
        )}
      >
        {(mode === "split" || mode === "before") && (
          <DiffPane label="Before KG" graph={before} hint="Original triples only — no completions." />
        )}
        {(mode === "split" || mode === "after") && (
          <DiffPane
            label={candidateKey ? "After KG (with accepted)" : "After KG"}
            graph={after}
            hint="Solid emerald edges are OMNIA-validated additions integrated into the KG."
          />
        )}
      </div>

      {mode === "split" ? (
        <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
          Before completion
          <ArrowRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          After completion
        </div>
      ) : null}
    </section>
  );
}

function DiffPane({
  label,
  graph,
  hint,
}: {
  label: string;
  graph: GraphPayload | null;
  hint: string;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50/40">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{label}</p>
        <p className="text-[10px] text-slate-500" aria-hidden>
          {graph ? `${graph.displayed_triples} triples` : "—"}
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        {graph ? (
          <KGGraph
            graph={graph}
            title=""
            description=""
            compactChrome
            fitViewKey={`${label}-${graph.displayed_triples}-${graph.displayed_nodes}`}
          />
        ) : (
          <p className="p-6 text-xs text-slate-500">{hint}</p>
        )}
      </div>
      <footer className="border-t border-slate-200 bg-white/60 px-3 py-2 text-[10px] leading-snug text-slate-600">
        {hint}
      </footer>
    </div>
  );
}
