import { useState, type ReactNode } from "react";import { NodeDetailPanel } from "./NodeDetailPanel";
import { StepStatsPanel } from "./StepStatsPanel";
import type { DemoCandidate, DemoCluster, DemoDatasetConfig } from "../../demo-data/types";
import type { CompletedSummaryView } from "../../lib/adapters";
import type { GraphPayload } from "../../types";
import type { GraphSelection } from "./LiveGraphPanel";

type InspectorTab = "explanation" | "inspector" | "stats" | "diagnostics";

interface PaperDemoInspectorPanelProps {
  step: string;
  dataset: DemoDatasetConfig;
  graph: GraphPayload | null;
  selection: GraphSelection;
  selectedCandidate: DemoCandidate | null;
  selectedCluster: DemoCluster | null;
  candidates: DemoCandidate[];
  clusters: DemoCluster[];
  sessionId?: string | null;
  onShowCandidatesForNode?: (nodeId: string) => void;
  stepExplanation?: ReactNode;
  feedbackSummary?: {
    accepted: number;
    rejected: number;
    uncertain: number;
    corrected: number;
    total: number;
  };
  completedSummary?: {
    knownTriples: number;
    completedTriples: number;
    acceptedAdditions: number;
    rejectedCandidates: number;
    unresolvedCandidates: number;
    mode: "static" | "live";
  };
  backendDiagnostics?: CompletedSummaryView | null;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
}

const TAB_LABEL: Record<InspectorTab, string> = {
  explanation: "Explanation",
  inspector: "Inspector",
  stats: "Step stats",
  diagnostics: "Diagnostics",
};

export function PaperDemoInspectorPanel({
  step,
  dataset,
  graph,
  selection,
  selectedCandidate,
  selectedCluster,
  candidates,
  clusters,
  sessionId,
  onShowCandidatesForNode,
  stepExplanation,
  feedbackSummary,
  completedSummary,
  backendDiagnostics,
  filteringAvailable = true,
  llmAvailable = true,
}: PaperDemoInspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>("explanation");

  return (
    <section className="rounded-xl border border-slate-200 bg-white" data-testid="paper-demo-inspector">
      <div className="flex border-b border-slate-200">
        {(Object.keys(TAB_LABEL) as InspectorTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide ${
              tab === key
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-auto p-3">
        {tab === "explanation" ? (
          stepExplanation ?? (
            <p className="text-xs italic text-slate-500">Step-specific explanation for this pipeline stage.</p>
          )
        ) : null}
        {tab === "inspector" ? (
          <NodeDetailPanel
            graph={graph}
            selection={selection}
            selectedCandidate={selectedCandidate}
            selectedCluster={selectedCluster}
            candidates={candidates}
            clusters={clusters}
            sessionId={sessionId}
            onShowCandidatesForNode={onShowCandidatesForNode}
            embedded
            filteringAvailable={filteringAvailable}
            llmAvailable={llmAvailable}
          />
        ) : null}
        {tab === "stats" ? (
          <StepStatsPanel
            dataset={dataset}
            step={step}
            selectedCandidate={selectedCandidate}
            feedbackSummary={feedbackSummary}
            completedSummary={completedSummary}
            backendDiagnostics={backendDiagnostics}
            filteringAvailable={filteringAvailable}
            llmAvailable={llmAvailable}
            compact
          />
        ) : null}
        {tab === "diagnostics" ? (
          <div className="space-y-2 text-xs text-slate-700">
            {backendDiagnostics ? (
              <>
                <p>
                  <span className="font-semibold">Suggested threshold:</span>{" "}
                  {backendDiagnostics.thresholdSuggestion?.threshold?.toFixed(3) ?? "n/a"}
                </p>
                <p>
                  <span className="font-semibold">Agreement rate:</span>{" "}
                  {backendDiagnostics.agreementRate !== undefined
                    ? `${(backendDiagnostics.agreementRate * 100).toFixed(1)}%`
                    : "n/a"}
                </p>
                <p>
                  <span className="font-semibold">Evidence insufficient:</span>{" "}
                  {backendDiagnostics.diagnostics?.evidence_insufficient ?? 0}
                </p>
                <p>
                  <span className="font-semibold">Dataset prior:</span>{" "}
                  {backendDiagnostics.priors?.dataset_prior !== undefined
                    ? `${(backendDiagnostics.priors.dataset_prior * 100).toFixed(0)}%`
                    : "n/a"}
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Backend diagnostics appear after feedback in live mode.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
