import clsx from "clsx";
import {
  exploreActionLabel,
  graphViewModeLabel,
  showAllCandidatesLabel,
  showAllMembersLabel,
  type GraphViewMode,
} from "../../lib/graphViewMode";

interface GraphViewToolbarProps {
  activeStep: string;
  viewMode: GraphViewMode;
  onViewModeChange: (mode: GraphViewMode) => void;
  onShowAllMembers?: () => void;
  onShowAllCandidates?: () => void;
  hiddenMemberCount?: number;
  compact?: boolean;
  className?: string;
}

export function GraphViewToolbar({
  activeStep,
  viewMode,
  onViewModeChange,
  onShowAllMembers,
  onShowAllCandidates,
  hiddenMemberCount = 0,
  compact = false,
  className,
}: GraphViewToolbarProps) {
  const isKgStep = activeStep === "kg";
  const exploreLabel = exploreActionLabel(activeStep);
  const inExplore = isKgStep || viewMode === "explore";

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      {!isKgStep ? (
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
            inExplore
              ? "bg-sky-50 text-sky-900 ring-sky-200"
              : "bg-emerald-50 text-emerald-900 ring-emerald-200",
          )}
          data-testid="graph-view-mode-badge"
        >
          {isKgStep ? "Explore dataset" : graphViewModeLabel(viewMode)}
        </span>
      ) : (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-900 ring-1 ring-sky-200">
          Explore dataset
        </span>
      )}

      {!isKgStep && viewMode === "guided" && exploreLabel ? (
        <button
          type="button"
          onClick={() => onViewModeChange("explore")}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="enter-explore-mode"
        >
          {exploreLabel}
        </button>
      ) : null}

      {!isKgStep && viewMode === "explore" ? (
        <button
          type="button"
          onClick={() => onViewModeChange("guided")}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="back-to-guided-view"
        >
          Back to guided view
        </button>
      ) : null}

      {viewMode === "guided" && showAllMembersLabel(activeStep) && onShowAllMembers ? (
        <button
          type="button"
          onClick={onShowAllMembers}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="show-all-members"
        >
          Show all members
        </button>
      ) : null}

      {viewMode === "guided" && showAllCandidatesLabel(activeStep) && onShowAllCandidates ? (
        <button
          type="button"
          onClick={onShowAllCandidates}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="show-all-candidates"
        >
          Show all proposed triples
        </button>
      ) : null}

      {!compact && hiddenMemberCount > 0 && viewMode === "guided" ? (
        <span className="text-[10px] font-medium text-slate-500">+{hiddenMemberCount} more members</span>
      ) : null}
    </div>
  );
}
