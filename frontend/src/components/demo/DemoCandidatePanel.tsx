import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import type { CandidateRecord } from "../../types";
import { tripleKey } from "./demoGraphBuilders";
import {
  DEMO_BADGE_STYLE,
  classifyCandidateRow,
  type CandidateStatusKey,
} from "./demoStatusTokens";
import {
  combinedScore,
  llmScore,
  sortCandidates,
  structuralScore,
  type SortKey,
} from "./demoScoring";

interface DemoCandidatePanelProps {
  rows: CandidateRecord[];
  selected: CandidateRecord | null;
  onSelect: (row: CandidateRecord) => void;
}

const STATUS_FILTERS: { id: "all" | CandidateStatusKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "llm_accepted", label: "Accepted" },
  { id: "llm_rejected", label: "Rejected" },
  { id: "filtered_passed", label: "Filter ✓" },
  { id: "filtered_rejected", label: "Filter ✗" },
  { id: "unresolved", label: "Pending" },
];

const ROW_HEIGHT_PX = 110;
const PAGE_SIZE = 30;

function rowMatchesQuery(row: CandidateRecord, q: string): boolean {
  if (!q) return true;
  const text = `${row.DisplayHead ?? row.Head}\t${row.DisplayRelation ?? row.Relation}\t${
    row.DisplayTail ?? row.Tail
  }`;
  return text.toLowerCase().includes(q);
}

function fmtScore(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(2);
}

export function DemoCandidatePanel({ rows, selected, onSelect }: DemoCandidatePanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CandidateStatusKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("combined");
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows.filter((row) => {
      if (!rowMatchesQuery(row, q)) return false;
      if (statusFilter === "all") return true;
      return classifyCandidateRow(row) === statusFilter;
    });
    return sortCandidates(base, sortKey);
  }, [rows, query, statusFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, sortKey]);

  const virtualizer = useVirtualizer({
    count: pageRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
  });

  useEffect(() => {
    if (!selected) return;
    const idx = pageRows.findIndex((row) => tripleKey(row) === tripleKey(selected));
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [pageRows, selected, virtualizer]);

  const fromIndex = filtered.length === 0 ? 0 : pageStart + 1;
  const toIndex = Math.min(filtered.length, pageStart + pageRows.length);

  return (
    <div
      data-testid="demo-candidate-panel"
      className="flex max-h-[min(78vh,52rem)] min-h-[24rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <Filter className="h-3 w-3" />
              Candidate triples
            </p>
            <p className="mt-1 text-sm text-slate-600">{filtered.length} candidates</p>
          </div>
          <label className="text-[11px] font-semibold text-slate-600">
            Sort by
            <select
              aria-label="Sort candidates"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="ml-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="combined">Combined Score</option>
              <option value="structural">Structural Score</option>
              <option value="llm">LLM Score</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidates…"
            aria-label="Search candidate triples"
            className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
        </label>

        <div role="tablist" aria-label="Candidate status filter" className="mt-2 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                statusFilter === filter.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="scrollbar-thin relative flex-1 overflow-y-auto px-2 py-2"
        role="listbox"
        aria-label="Candidate triples generated by OMNIA"
        tabIndex={0}
        onKeyDown={(event) => {
          if (!pageRows.length) return;
          const idx = selected
            ? pageRows.findIndex((row) => tripleKey(row) === tripleKey(selected))
            : -1;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const next = pageRows[Math.min(pageRows.length - 1, Math.max(0, idx) + 1)];
            if (next) onSelect(next);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            const next = pageRows[Math.max(0, idx - 1)];
            if (next) onSelect(next);
          }
        }}
      >
        {pageRows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No candidates match the current filters.
          </p>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = pageRows[virtualRow.index];
              const sel = Boolean(selected && tripleKey(selected) === tripleKey(row));
              const status = classifyCandidateRow(row);
              const badge = DEMO_BADGE_STYLE[status];
              const recovered = row.Missing === 1;
              const sScore = structuralScore(row);
              const lScore = llmScore(row);
              const cScore = combinedScore(row);
              return (
                <button
                  key={`${tripleKey(row)}-${row.cluster_ids?.join?.(",") ?? ""}`}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  data-testid="demo-candidate-row"
                  data-status={status}
                  onClick={() => onSelect(row)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                  }}
                  className={clsx(
                    "flex flex-col gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                    sel
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {row.DisplayHead ?? row.Head}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-700">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-blue-700">
                          {row.DisplayRelation ?? row.Relation}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                        <span className="truncate font-medium text-slate-900">
                          {row.DisplayTail ?? row.Tail}
                        </span>
                      </p>
                    </div>
                    <span
                      data-testid="demo-candidate-combined-score"
                      className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                    >
                      {fmtScore(cScore)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="text-slate-500">
                      Structural:{" "}
                      <span className="font-mono font-semibold text-slate-800">{fmtScore(sScore)}</span>
                    </span>
                    <span className="text-slate-500">
                      LLM:{" "}
                      <span
                        className={clsx(
                          "font-semibold",
                          status === "llm_accepted"
                            ? "text-emerald-700"
                            : status === "llm_rejected"
                              ? "text-rose-700"
                              : "text-slate-800",
                        )}
                      >
                        {fmtScore(lScore)}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
                        badge.textClass,
                        badge.bgClass,
                        badge.borderClass,
                      )}
                    >
                      {badge.label}
                    </span>
                    {recovered ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-900">
                        Recovered
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-600">
        <span data-testid="demo-candidate-pagination">
          {fromIndex}–{toIndex} of {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-slate-200 bg-white p-1 text-slate-700 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-md border border-slate-200 bg-white p-1 text-slate-700 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
