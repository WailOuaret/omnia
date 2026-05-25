import type { FeedbackMode, FeedbackStatus } from "../../hooks/useFeedbackBridge";

export const PAPER_DEMO_STEP_ORDER = [
  "kg",
  "clustering",
  "candidates",
  "filtering",
  "llm",
  "feedback",
  "completed",
] as const;

export type PaperDemoStepId = (typeof PAPER_DEMO_STEP_ORDER)[number];

export const PAPER_DEMO_STEP_LABEL: Record<PaperDemoStepId, string> = {
  kg: "Knowledge Graph",
  clustering: "Clustering",
  candidates: "Candidate Generation",
  filtering: "Structural Filtering",
  llm: "Semantic Validation",
  feedback: "User Feedback",
  completed: "Completed KG / Diff",
};

export const PAPER_DEMO_STEP_GOAL: Record<PaperDemoStepId, string> = {
  kg: "Find plausible missing triples using only the internal structure of the graph.",
  clustering: "Group head entities that share the same relation-tail pattern — similar contexts may share more relations.",
  candidates: "Propose missing triples by propagating relation-tail pairs within each cluster.",
  filtering: "Drop structurally implausible candidates using TransE distance before calling the LLM.",
  llm: "Validate each surviving candidate with the LLM as a semantic judge, supported by retrieved RAG context.",
  feedback: "Let the human curator accept, reject, mark uncertain, or correct each remaining candidate.",
  completed: "Show the completed KG vs the original, including the diff and provenance of every change.",
};

interface PaperDemoHeaderProps {
  datasetLabel: string;
  step: PaperDemoStepId;
  mode: FeedbackMode;
  status: FeedbackStatus;
  onPrev?: () => void;
  onNext?: () => void;
  onResetToLanding?: () => void;
}

export function PaperDemoHeader({
  datasetLabel,
  step,
  mode,
  status,
  onPrev,
  onNext,
  onResetToLanding,
}: PaperDemoHeaderProps) {
  const stepIndex = PAPER_DEMO_STEP_ORDER.indexOf(step);
  const totalSteps = PAPER_DEMO_STEP_ORDER.length;
  const prevDisabled = stepIndex <= 0;
  const nextDisabled = stepIndex >= totalSteps - 1;
  const stepLabel = PAPER_DEMO_STEP_LABEL[step];

  const modeBadge = mode === "live"
    ? status === "sync-failed"
      ? { text: "Live · sync failed", color: "bg-amber-100 text-amber-800 border-amber-200" }
      : status === "syncing"
        ? { text: "Live · syncing…", color: "bg-emerald-100 text-emerald-800 border-emerald-200" }
        : { text: "Live backend", color: "bg-emerald-100 text-emerald-800 border-emerald-200" }
    : { text: "Static demo", color: "bg-slate-100 text-slate-700 border-slate-200" };

  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            OMNIA+ Paper Demo
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900">
            {stepLabel}{" "}
            <span className="text-sm font-normal text-slate-500">
              · step {stepIndex + 1} / {totalSteps}
            </span>
          </h1>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            Dataset: <span className="font-semibold text-slate-800">{datasetLabel}</span>
          </p>
          <p className="mt-1 text-sm text-slate-700">{PAPER_DEMO_STEP_GOAL[step]}</p>
          {mode === "static" ? (
            <p className="mt-1 text-[11px] leading-snug text-amber-800">
              Backend session unavailable — showing the prepared static scenario for this dataset.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${modeBadge.color}`}
            data-testid="header-mode-badge"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                mode === "live"
                  ? status === "sync-failed"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  : "bg-slate-400"
              }`}
              aria-hidden
            />
            {modeBadge.text}
          </span>
          {onResetToLanding ? (
            <button
              type="button"
              onClick={onResetToLanding}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Change dataset
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
              prevDisabled
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            ◀ Previous step
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
              nextDisabled
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            Next step ▶
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-slate-900 transition-all"
          style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {PAPER_DEMO_STEP_ORDER.map((id, i) => (
          <span
            key={id}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              i === stepIndex
                ? "bg-slate-900 text-white"
                : i < stepIndex
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
            }`}
            title={PAPER_DEMO_STEP_LABEL[id]}
          >
            {i + 1}. {PAPER_DEMO_STEP_LABEL[id]}
          </span>
        ))}
      </div>
    </header>
  );
}
