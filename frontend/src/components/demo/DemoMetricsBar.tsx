import type { CandidateRecord } from "../../types";

export interface DemoCounts {
  known: number;
  missing: number;
  candidates?: number;
  recovered?: number;
  accepted?: number;
  rejected?: number;
}

export function DemoMetricsBar({
  datasetName,
  counts,
  selectedCandidate,
}: {
  datasetName: string;
  counts: DemoCounts;
  selectedCandidate: CandidateRecord | null;
}) {
  const cells = [
    { label: "Known triples", value: counts.known },
    { label: "Held-out (missing)", value: counts.missing },
    { label: "Candidates queued", value: counts.candidates ?? "—" },
    { label: "Recovered in filter queue", value: counts.recovered ?? "—" },
    { label: "LLM accepted", value: counts.accepted ?? "—" },
    { label: "LLM rejected", value: counts.rejected ?? "—" },
  ];
  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">OMNIA paper demo</p>
          <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">Interactive KG completion story</h1>
          <p className="text-sm text-slate-600">{datasetName}</p>
        </div>
        {selectedCandidate ? (
          <div className="max-w-full rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 md:max-w-md">
            Selected: ({selectedCandidate.Head}, {selectedCandidate.Relation}, {selectedCandidate.Tail})
          </div>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</dt>
            <dd className="text-lg font-bold tabular-nums text-slate-900">{String(c.value)}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
