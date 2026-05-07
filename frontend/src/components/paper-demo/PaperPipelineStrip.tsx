import type { PaperDemoStep } from "./paperDemoTypes";

const PIPELINE_LABELS = [
  "Input KG",
  "Missing + cluster",
  "Generation",
  "TransE filter",
  "LLM validation",
  "Human validation",
  "Completed KG",
] as const;

function activePipelineIndex(step: PaperDemoStep): number {
  if (step === "before") return 0;
  if (step === "missing" || step === "cluster") return 1;
  if (step === "generation") return 2;
  if (step === "filtering") return 3;
  if (step === "llm") return 4;
  if (step === "human") return 5;
  return 6;
}

export function PaperPipelineStrip({
  activeStep,
  compact,
  aside,
}: {
  activeStep: PaperDemoStep;
  compact?: boolean;
  /** Sit beside tabs on wide screens: top border on mobile, left rule on xl */
  aside?: boolean;
}) {
  const hi = activePipelineIndex(activeStep);

  return (
    <div
      className={`paper-pipeline-scroll flex min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap bg-slate-50/90 text-[10px] text-slate-700 ${
        aside
          ? "border-t border-slate-200 px-2 py-1 xl:border-l xl:border-t-0"
          : compact
            ? "border-b border-slate-200 px-2 py-1 lg:border-b-0"
            : "border-b border-slate-200 px-3 py-1.5"
      }`}
      aria-label="OMNIA pipeline stages"
      data-testid="paper-pipeline-strip"
    >
      <span className="font-semibold uppercase tracking-wide text-slate-500">OMNIA pipeline</span>
      <span className="text-slate-300" aria-hidden>
        |
      </span>
      {PIPELINE_LABELS.map((label, i) => (
        <span key={label} className="inline-flex items-center gap-1">
          {i > 0 ? (
            <span className="text-slate-400" aria-hidden>
              →
            </span>
          ) : null}
          <span
            className={`rounded px-1 py-0.5 font-medium ${
              i === hi ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300" : "text-slate-500"
            }`}
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}
