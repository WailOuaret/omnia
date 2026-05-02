import clsx from "clsx";
import type { DemoStepMeta } from "./demoSteps";

interface DemoStepRailProps {
  steps: DemoStepMeta[];
  activeId: DemoStepMeta["id"];
  onSelect: (id: DemoStepMeta["id"]) => void;
  collapsed?: boolean;
}

export function DemoStepRail({ steps, activeId, onSelect, collapsed }: DemoStepRailProps) {
  if (collapsed) {
    return (
      <div className="flex flex-row flex-wrap gap-2 lg:flex-col">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={clsx(
              "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
              activeId === s.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-400",
            )}
          >
            {s.shortTitle}
          </button>
        ))}
      </div>
    );
  }
  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Demo steps">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Steps</p>
      <ol className="space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={clsx(
                "w-full rounded-xl border px-3 py-3 text-left transition",
                activeId === s.id
                  ? "border-blue-600 bg-blue-50"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50",
              )}
            >
              <p className="text-sm font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1 text-xs leading-snug text-slate-600">{s.summary}</p>
              <span className="mt-2 inline-flex text-[10px] font-bold uppercase tracking-wide text-violet-600">
                {s.workspaceTab}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
