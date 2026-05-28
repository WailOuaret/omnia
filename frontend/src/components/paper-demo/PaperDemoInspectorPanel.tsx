import { useState, type ReactNode } from "react";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { StepStatsPanel } from "./StepStatsPanel";
import {
  CandidateGenerationDetails,
  ClusteringDetails,
  CompletedDetails,
  FilteringDetails,
  LlmDetails,
  TripleBasicsDetails,
} from "./presentationStepDetails";
import type { DemoCandidate, DemoCluster, DemoDatasetConfig } from "../../demo-data/types";
import type { CompletedSummaryView } from "../../lib/adapters";
import type { GraphPayload } from "../../types";
import type { GraphSelection } from "./LiveGraphPanel";
import type { InspectorListPanel } from "../../lib/graphViewMode";
import { ClusterMembersList, ProposedTriplesList } from "./InspectorListPanels";

type InspectorTab = "inspector" | "details";

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
  liveDiagnostics?: {
    selectedClusterId?: string | null;
    selectedCandidateId?: string | null;
    candidateSourceCluster?: string | null;
    mismatch?: boolean;
  } | null;
  scenarioLimitations?: string[];
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
  inspectorListPanel?: InspectorListPanel;
  onInspectorListPanelChange?: (panel: InspectorListPanel) => void;
  onSelectCandidate?: (candidateId: string) => void;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function DatasetMoreDetails({
  dataset,
  limitations = [],
  sessionId,
  liveDiagnostics,
  backendDiagnostics,
  feedbackSummary,
  completedSummary,
  step,
  filteringAvailable,
  llmAvailable,
}: {
  dataset: DemoDatasetConfig;
  limitations?: string[];
  sessionId?: string | null;
  liveDiagnostics?: PaperDemoInspectorPanelProps["liveDiagnostics"];
  backendDiagnostics?: CompletedSummaryView | null;
  feedbackSummary?: PaperDemoInspectorPanelProps["feedbackSummary"];
  completedSummary?: PaperDemoInspectorPanelProps["completedSummary"];
  step: string;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
}) {
  return (
    <div className="space-y-3">
      <details className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-900">Dataset details</summary>
        <div className="mt-2 space-y-2">
          <p>{dataset.description}</p>
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="font-semibold">Entities</dt>
              <dd>{formatNumber(dataset.entities)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Relations</dt>
              <dd>{formatNumber(dataset.relations)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Triples</dt>
              <dd>{formatNumber(dataset.triples)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Source</dt>
              <dd>{dataset.source}</dd>
            </div>
          </dl>
          {limitations.length > 0 ? (
            <ul className="list-disc pl-4">
              {limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>

      {import.meta.env.DEV ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-900">Diagnostics (dev only)</summary>
          <div className="mt-2 space-y-1 text-slate-700">
            {sessionId ? <p className="break-all font-mono text-[10px]">{sessionId}</p> : null}
            {liveDiagnostics ? (
              <>
                <p>Cluster: {liveDiagnostics.selectedClusterId ?? "none"}</p>
                <p>Candidate: {liveDiagnostics.selectedCandidateId ?? "none"}</p>
              </>
            ) : null}
            {backendDiagnostics ? (
              <p>Agreement: {backendDiagnostics.agreementRate ?? "n/a"}</p>
            ) : null}
          </div>
        </details>
      ) : null}

      <StepStatsPanel
        dataset={dataset}
        step={step}
        selectedCandidate={null}
        feedbackSummary={feedbackSummary}
        completedSummary={completedSummary}
        backendDiagnostics={backendDiagnostics}
        filteringAvailable={filteringAvailable}
        llmAvailable={llmAvailable}
        compact
      />
    </div>
  );
}

function StepDetailsContent({
  step,
  dataset,
  selectedCluster,
  selectedCandidate,
  filteringAvailable = true,
  llmAvailable = true,
}: {
  step: string;
  dataset: DemoDatasetConfig;
  selectedCluster: DemoCluster | null;
  selectedCandidate: DemoCandidate | null;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
}) {
  if (step === "kg") return <TripleBasicsDetails />;
  if (step === "clustering") return <ClusteringDetails cluster={selectedCluster} />;
  if (step === "candidates") return <CandidateGenerationDetails candidate={selectedCandidate} />;
  if (step === "filtering") return <FilteringDetails available={filteringAvailable} />;
  if (step === "llm") return <LlmDetails available={llmAvailable} />;
  if (step === "completed") return <CompletedDetails dataset={dataset} />;
  return null;
}

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
  feedbackSummary,
  completedSummary,
  backendDiagnostics,
  liveDiagnostics = null,
  scenarioLimitations = [],
  filteringAvailable = true,
  llmAvailable = true,
  inspectorListPanel = null,
  onInspectorListPanelChange,
  onSelectCandidate,
}: PaperDemoInspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>("inspector");
  const hasSelection = Boolean(selection || selectedCandidate);

  return (
    <section className="rounded-xl border border-slate-200 bg-white" data-testid="paper-demo-inspector">
      <div className="flex border-b border-slate-200">
        {(
          [
            ["inspector", "Inspector"],
            ["details", "Details"],
          ] as const
        ).map(([key, label]) => (
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
            {label}
          </button>
        ))}
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-auto p-3">
        {tab === "inspector" ? (
          <div className="space-y-3">
            {inspectorListPanel === "members" && selectedCluster ? (
              <div className="space-y-2">
                <ClusterMembersList cluster={selectedCluster} />
                <button
                  type="button"
                  onClick={() => onInspectorListPanelChange?.(null)}
                  className="text-xs font-semibold text-slate-600 underline"
                >
                  Back to inspector
                </button>
              </div>
            ) : null}
            {inspectorListPanel === "candidates" ? (
              <div className="space-y-2">
                <ProposedTriplesList
                  candidates={candidates}
                  selectedCandidateId={selectedCandidate?.candidateId}
                  onSelectCandidate={onSelectCandidate}
                />
                <button
                  type="button"
                  onClick={() => onInspectorListPanelChange?.(null)}
                  className="text-xs font-semibold text-slate-600 underline"
                >
                  Back to inspector
                </button>
              </div>
            ) : null}
            {!inspectorListPanel ? (
              <>
            {!hasSelection ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-600">
                Click a node or edge to inspect it.
              </p>
            ) : null}
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
              activeStep={step}
            />
              </>
            ) : null}
          </div>
        ) : null}
        {tab === "details" ? (
          <div className="space-y-3">
            <StepDetailsContent
              step={step}
              dataset={dataset}
              selectedCluster={selectedCluster}
              selectedCandidate={selectedCandidate}
              filteringAvailable={filteringAvailable}
              llmAvailable={llmAvailable}
            />
            <DatasetMoreDetails
              dataset={dataset}
              limitations={scenarioLimitations}
              sessionId={sessionId}
              liveDiagnostics={liveDiagnostics}
              backendDiagnostics={backendDiagnostics}
              feedbackSummary={feedbackSummary}
              completedSummary={completedSummary}
              step={step}
              filteringAvailable={filteringAvailable}
              llmAvailable={llmAvailable}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
