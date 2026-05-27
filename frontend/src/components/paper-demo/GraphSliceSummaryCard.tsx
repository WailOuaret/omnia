import type { SliceResult } from "../../lib/datasetSlice";

interface GraphSliceSummaryCardProps {
  result: SliceResult;
  totals: {
    nodes: number;
    edges: number;
    clusters: number;
    candidates: number;
  };
  onReset?: () => void;
}

function Stat({ label, value, total }: { label: string; value: number; total: number }) {
  const sameAsTotal = value === total;
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">
        {value}
        <span className={`ml-1 text-[11px] font-normal ${sameAsTotal ? "text-slate-400" : "text-sky-700"}`}>
          / {total}
        </span>
      </p>
    </div>
  );
}

export function GraphSliceSummaryCard({ result, totals, onReset }: GraphSliceSummaryCardProps) {
  const badgeClass = result.isGuided
    ? "bg-slate-100 text-slate-700 ring-slate-200"
    : "bg-sky-100 text-sky-800 ring-sky-200";
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-3"
      data-testid="graph-slice-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Current graph view
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">{result.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${badgeClass}`}
          >
            {result.isGuided ? "suggested" : "custom view"}
          </span>
          {!result.isGuided && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Nodes" value={result.stats.nodes} total={totals.nodes} />
        <Stat label="Edges" value={result.stats.edges} total={totals.edges} />
        <Stat label="Clusters" value={result.stats.clusters} total={totals.clusters} />
        <Stat label="Candidates" value={result.stats.candidates} total={totals.candidates} />
      </div>
      {result.resolvedEntityId ? (
        <p className="mt-2 text-[11px] text-slate-600">
          Resolved entity: <span className="font-mono text-slate-800">{result.resolvedEntityId}</span>
        </p>
      ) : null}
      {!result.isGuided && result.stats.nodes === 0 && result.stats.candidates === 0 ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          No matches in this dataset. Try a different slice or reset to the guided demo.
        </p>
      ) : null}
    </section>
  );
}
