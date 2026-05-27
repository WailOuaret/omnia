interface WorkflowStepMenuProps {
  activeStep: string;
  onStepChange: (step: string) => void;
}

const STEPS: Array<{ id: string; label: string; sub: string }> = [
  { id: "kg", label: "Knowledge Graph", sub: "Explore the graph" },
  { id: "clustering", label: "Clustering", sub: "Group similar entities" },
  { id: "candidates", label: "Candidate Generation", sub: "Propose new triples" },
  { id: "filtering", label: "Structural Filtering", sub: "Remove unlikely ones" },
  { id: "llm", label: "Semantic Validation", sub: "Check meaning" },
  { id: "feedback", label: "User Feedback", sub: "Review and decide" },
  { id: "completed", label: "Completed KG / Diff", sub: "See what changed" },
];

export function WorkflowStepMenu({ activeStep, onStepChange }: WorkflowStepMenuProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Workflow</h3>
      <div className="mt-3 space-y-1 text-sm">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
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
              <span className="min-w-0">
                <span className="block truncate font-medium">{step.label}</span>
                <span
                  className={`block truncate text-[10px] ${
                    isActive ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {step.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
