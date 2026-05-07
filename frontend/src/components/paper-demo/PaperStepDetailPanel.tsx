import { STEP_DETAILS } from "./paperDemoScenario";
import type { PaperDemoCandidate, PaperDemoStep } from "./paperDemoTypes";

export function PaperStepDetailPanel({
  step,
  candidate,
}: {
  step: PaperDemoStep;
  candidate?: PaperDemoCandidate;
}) {
  const detail = STEP_DETAILS[step];
  const candidateNote =
    step === "missing" && candidate && candidate.demoRole !== "missing"
      ? "This selected candidate is not the true missing triple; it is shown for validation/rejection behavior."
      : undefined;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="paper-step-detail">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Step {detail.step}
      </div>
      <h3 className="text-[14px] font-semibold text-slate-900">{detail.title}</h3>
      <div className="mt-2 space-y-1.5 text-[12px] text-slate-700">
        <p><span className="font-semibold text-slate-900">What:</span> {detail.what}</p>
        <p><span className="font-semibold text-slate-900">Why:</span> {detail.why}</p>
        <p><span className="font-semibold text-slate-900">Running example:</span> {detail.runningExample}</p>
        <p><span className="font-semibold text-slate-900">Paper statistic:</span> {detail.paperStatistic}</p>
        <p><span className="font-semibold text-slate-900">Next action:</span> {detail.userAction}</p>
        {candidateNote ? (
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{candidateNote}</p>
        ) : null}
        {detail.warningNote ? (
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{detail.warningNote}</p>
        ) : null}
      </div>
    </section>
  );
}
