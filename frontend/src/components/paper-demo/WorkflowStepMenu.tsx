interface WorkflowStepMenuProps {
  activeStep: string;
  onStepChange: (step: string) => void;
}

export function WorkflowStepMenu({ activeStep, onStepChange }: WorkflowStepMenuProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Workflow</h3>
      <div className="mt-3 space-y-1 text-sm">
        {[
          { id: "kg", label: "Knowledge Graph" },
        ].map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            className={`flex w-full rounded px-2 py-1.5 text-left ${
              activeStep === step.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {step.label}
          </button>
        ))}
        <div className="mt-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Generation</div>
        {[
          { id: "clustering", label: "Clustering" },
          { id: "candidates", label: "Candidate Generation" },
        ].map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            className={`ml-3 flex w-[calc(100%-0.75rem)] rounded px-2 py-1.5 text-left ${
              activeStep === step.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {step.label}
          </button>
        ))}
        {[
          { id: "filtering", label: "Structural Filtering" },
          { id: "llm", label: "Semantic Validation" },
          { id: "feedback", label: "User Feedback" },
          { id: "completed", label: "Completed KG / Diff" },
        ].map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            className={`flex w-full rounded px-2 py-1.5 text-left ${
              activeStep === step.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>
    </section>
  );
}

