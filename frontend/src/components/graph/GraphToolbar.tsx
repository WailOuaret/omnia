import { Eye, EyeOff, Filter, Focus, MousePointer2, Presentation, RotateCcw } from "lucide-react";
import clsx from "clsx";
import type { GraphEdgeStatus } from "../../types";

const filterItems: Array<{ status: GraphEdgeStatus; label: string }> = [
  { status: "original", label: "Original" },
  { status: "generated", label: "Generated" },
  { status: "missing", label: "Missing" },
  { status: "filtered_passed", label: "TransE pass" },
  { status: "filtered_rejected", label: "TransE reject" },
  { status: "llm_accepted", label: "LLM accept" },
  { status: "llm_rejected", label: "LLM reject" },
  { status: "unresolved", label: "Unresolved" },
];

interface GraphToolbarProps {
  showLabels: boolean;
  presentationMode: boolean;
  visibleEdgeStatuses: Set<GraphEdgeStatus>;
  onToggleLabels: () => void;
  onTogglePresentationMode: () => void;
  onToggleStatus: (status: GraphEdgeStatus) => void;
  onResetStatuses: () => void;
  onFitView: () => void;
  onResetSelection: () => void;
}

export function GraphToolbar({
  showLabels,
  presentationMode,
  visibleEdgeStatuses,
  onToggleLabels,
  onTogglePresentationMode,
  onToggleStatus,
  onResetStatuses,
  onFitView,
  onResetSelection,
}: GraphToolbarProps) {
  return (
    <div className="rounded-card border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onFitView}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:bg-white/5"
        >
          <Focus className="h-4 w-4" />
          Fit view
        </button>
        <button
          type="button"
          onClick={onResetSelection}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:bg-white/5"
        >
          <RotateCcw className="h-4 w-4" />
          Reset selection
        </button>
        <button
          type="button"
          onClick={onToggleLabels}
          className={clsx(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
            showLabels ? "bg-cyan text-bg" : "border border-border text-ink hover:bg-white/5",
          )}
        >
          {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Labels
        </button>
        <button
          type="button"
          onClick={onTogglePresentationMode}
          className={clsx(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
            presentationMode ? "bg-accent text-white" : "border border-border text-ink hover:bg-white/5",
          )}
        >
          <Presentation className="h-4 w-4" />
          Presentation
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          <Filter className="h-3.5 w-3.5" />
          Edge filters ({visibleEdgeStatuses.size}/{filterItems.length})
        </div>
        <button
          type="button"
          onClick={onResetStatuses}
          className="rounded-full border border-border bg-bg px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-ink"
        >
          Reset filters
        </button>
        {filterItems.map((item) => {
          const active = visibleEdgeStatuses.has(item.status);
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => onToggleStatus(item.status)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold",
                active ? "border border-accent bg-accent/15 text-ink" : "border border-border bg-bg text-muted",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {presentationMode ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-card border border-border bg-bg px-3 py-2 text-xs font-medium text-muted">
          <MousePointer2 className="h-4 w-4" />
          Candidate selections dim unrelated edges and expose evidence labels.
        </div>
      ) : null}
    </div>
  );
}
