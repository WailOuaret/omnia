import type { PaperDemoStep } from "./paperDemoTypes";

const PIPELINE_LABELS = [
  "Input KG",
  "Candidate generation",
  "TransE filtering",
  "LLM validation",
  "Completed KG",
] as const;

function activePipelineIndex(step: PaperDemoStep): number {
  if (step === "before") return 0;
  if (step === "missing" || step === "cluster") return 1;
  if (step === "filtering") return 2;
  if (step === "llm") return 3;
  return 4;
}

export function PaperPipelineStrip({ activeStep, compact }: { activeStep: PaperDemoStep; compact?: boolean }) {
  const hi = activePipelineIndex(activeStep);

  return (
    <div
      className={`flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 bg-slate-50/90 text-[10px] text-slate-700 ${
        compact ? "border-b border-slate-200 px-2 py-1 lg:border-b-0" : "border-b border-slate-200 px-3 py-1.5"
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
