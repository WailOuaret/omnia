import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { sortPaperDemoCandidates } from "./paperDemoScenario";
import type { PaperDemoCandidate } from "./paperDemoTypes";

type SortKey = "combined" | "structural" | "llm";

interface PaperCandidateTriplesPanelProps {
  candidates: PaperDemoCandidate[];
  selectedId: string;
  onSelect: (id: string) => void;
  decisions: Record<string, "accepted" | "rejected" | "uncertain" | null>;
  screenshotMode?: boolean;
}

function statusClass(status: PaperDemoCandidate["status"]): string {
  switch (status) {
    case "accepted":
      return "border-emerald-700/25 text-emerald-900";
    case "rejected":
      return "border-red-700/25 text-red-900";
    case "unresolved":
      return "border-amber-700/30 text-amber-950";
    default:
      return "border-slate-300 text-slate-700";
  }
}

export function PaperCandidateTriplesPanel({
  candidates,
  selectedId,
  onSelect,
  decisions,
  screenshotMode,
}: PaperCandidateTriplesPanelProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("combined");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = candidates.filter(
      (c) =>
        !q ||
        c.head.toLowerCase().includes(q) ||
        c.relation.toLowerCase().includes(q) ||
        c.tail.toLowerCase().includes(q),
    );
    return sortPaperDemoCandidates(list, sortKey, sortDirection);
  }, [candidates, query, sortKey, sortDirection]);

  return (
    <section
      id="paper-demo-candidates-section"
      className="flex min-h-0 flex-col border-r border-slate-200 bg-white"
      aria-labelledby="paper-candidate-heading"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" aria-hidden />
          <h2 id="paper-candidate-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
            Candidate Triples
          </h2>
        </div>
      </div>

      {!screenshotMode ? (
        <div className="shrink-0 space-y-2 border-b border-slate-200 px-3 py-2">
          <label className="sr-only" htmlFor="paper-cand-search">
            Search candidates
          </label>
          <input
            id="paper-cand-search"
            type="search"
            placeholder="Search candidates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-500 shadow-none"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="paper-cand-sort" className="text-[12px] text-slate-600">
              Sort by:
            </label>
            <select
              id="paper-cand-sort"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-800"
            >
              <option value="combined">Combined Score</option>
              <option value="structural">Structural Score</option>
              <option value="llm">LLM Score</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((v) => (v === "desc" ? "asc" : "desc"))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-700"
              title={sortDirection === "desc" ? "High to low" : "Low to high"}
              aria-label="Toggle sort direction"
            >
              {sortDirection === "desc" ? "↓" : "↑"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-2" role="list">
          {rows.map((c) => {
            const sel = c.id === selectedId;
            const effectiveStatus = decisions[c.id] ?? c.status;
            const visualStatus = effectiveStatus === null ? c.status : effectiveStatus;
            const classStatus = visualStatus === "uncertain" ? "unresolved" : visualStatus;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-selected={sel}
                  onClick={() => onSelect(c.id)}
                  data-testid={`paper-cand-row-${c.id}`}
                  className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                    sel
                      ? "border-blue-500 border-l-4 border-l-blue-600 bg-sky-50 pl-2"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold leading-snug text-slate-900">
                        <span>{c.head}</span>{" "}
                        <span className="font-semibold text-blue-800">{c.relation}</span>
                        <span className="text-slate-400"> → </span>
                        <span>{c.tail}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-slate-600">
                        <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          {c.demoRole === "missing"
                            ? "true missing triple"
                            : c.demoRole === "invalid"
                              ? "generated invalid candidate"
                              : "needs review"}
                        </span>
                        <span>
                          Structural: <span className="font-mono text-slate-800">{c.structuralScore.toFixed(2)}</span>
                        </span>
                        <span>{c.filterResult ?? (c.transEDistance < c.transEThreshold ? "PASSED" : "FILTERED_OUT")}</span>
                        <span>LLM: {c.llmVerdict} ({(c.llmConfidence * 100).toFixed(0)}%)</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded border bg-white px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${statusClass(classStatus)}`}
                    >
                      {visualStatus === "accepted"
                        ? "accepted"
                        : visualStatus === "rejected"
                          ? "rejected"
                          : visualStatus === "uncertain"
                            ? "uncertain"
                            : c.combinedScore.toFixed(2)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shrink-0 border-t border-slate-200 px-3 py-2 text-center text-[12px] text-slate-500">
        {rows.length === 0 ? "0" : `1–${rows.length}`} of {candidates.length}
      </div>
    </section>
  );
}
