import { PAPER_DEMO_STEP_ORDER, PAPER_DEMO_TAB_LABELS, type PaperDemoStep } from "./paperDemoTypes";

interface PaperDemoTabsProps {
  activeStep: PaperDemoStep;
  onStepChange: (step: PaperDemoStep) => void;
}

export function PaperDemoTabs({ activeStep, onStepChange }: PaperDemoTabsProps) {
  return (
    <div
      className="flex min-h-[40px] flex-wrap gap-0.5 border-b border-slate-200 bg-white px-2 py-1"
      role="tablist"
      aria-label="Paper demo stages"
    >
      {PAPER_DEMO_STEP_ORDER.map((step) => {
        const selected = activeStep === step;
        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={`paper-tab-${step}`}
            onClick={() => onStepChange(step)}
            className={`rounded-sm px-2.5 py-1.5 text-[11px] font-medium transition ${
              selected
                ? "border-b-2 border-slate-900 text-slate-900"
                : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {PAPER_DEMO_TAB_LABELS[step]}
          </button>
        );
      })}
    </div>
  );
}
