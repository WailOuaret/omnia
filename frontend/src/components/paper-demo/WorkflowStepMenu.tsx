interface WorkflowStepMenuProps {
  activeStep: string;
  onStepChange: (step: string) => void;
}

const STEPS: Array<{ id: string; label: string; group?: string }> = [
  { id: "kg", label: "Knowledge Graph" },
  { id: "clustering", label: "Clustering", group: "Generation" },
  { id: "candidates", label: "Candidate Generation", group: "Generation" },
  { id: "filtering", label: "Structural Filtering" },
  { id: "llm", label: "Semantic Validation" },
  { id: "feedback", label: "User Feedback" },
  { id: "completed", label: "Completed KG / Diff" },
];

export function WorkflowStepMenu({ activeStep, onStepChange }: WorkflowStepMenuProps) {
  let lastGroup: string | undefined;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Workflow</h3>
      <div className="mt-3 space-y-1 text-sm">
        {STEPS.map((step, idx) => {
          const showGroupHeader = step.group && step.group !== lastGroup;
          lastGroup = step.group ?? lastGroup;
          const isActive = activeStep === step.id;
          const indent = step.group ? "ml-3 w-[calc(100%-0.75rem)]" : "w-full";
          return (
            <div key={step.id}>
              {showGroupHeader ? (
                <div className="mt-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {step.group}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                className={`flex items-center gap-2 ${indent} rounded px-2 py-1.5 text-left ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    isActive ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
