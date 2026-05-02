import clsx from "clsx";
import { KGGraph } from "../graph/KGGraph";
import type { GraphPayload } from "../../types";
import type { WorkspaceTab } from "./demoSteps";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "before", label: "Before KG" },
  { id: "missing", label: "Missing" },
  { id: "cluster", label: "Cluster" },
  { id: "filter", label: "Filtering" },
  { id: "validation", label: "LLM" },
  { id: "after", label: "After KG" },
  { id: "diff", label: "Diff" },
];

export function DemoGraphWorkbench({
  caption,
  activeTab,
  onTabChange,
  graphPayload,
}: {
  caption: string;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  graphPayload: GraphPayload | null;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Graph workbench view">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                activeTab === tab.id ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{caption}</p>
      </div>
      <div className="relative min-h-0 flex-1">
        {graphPayload ? (
          <KGGraph
            graph={graphPayload}
            title="Graph canvas"
            description=""
            compactChrome
            fitViewKey={`${activeTab}-${graphPayload.displayed_triples}-${graphPayload.displayed_nodes}`}
          />
        ) : (
          <div className="flex h-[clamp(240px,50vh,400px)] items-center justify-center text-sm text-slate-600">
            Load a benchmark session then run pipeline to hydrate this graph pane.
          </div>
        )}
      </div>
    </section>
  );
}
