import { useEffect, useState } from "react";
import { BenchmarkMiniGraph } from "./BenchmarkMiniGraph";
import { LiveGraphPanel, type GraphSelection } from "./LiveGraphPanel";
import { PaperCovidExampleGraph } from "./PaperCovidExampleGraph";
import { getCandidateById } from "./paperDemoScenario";
import type { PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";
import type { GraphPayload } from "../../types";
import type { DemoCandidate, DemoDatasetConfig } from "../../demo-data/types";

type Decision = "accept" | "reject" | "uncertain" | "correct";

interface RestoredGraphStagePanelProps {
  dataset: DemoDatasetConfig;
  activeStep: string;
  selectedCandidate?: DemoCandidate | null;
  selectedDecision?: Decision | null;
  feedbackDecisions?: Record<string, Decision>;
  graphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  onCandidateSelect?: (candidateId: string) => void;
  /**
   * When true (the default), COVID-Fact uses the hand-drawn paper-style graph.
   * Set false when a custom slice is active so the dynamic slice graph is rendered instead.
   */
  useStaticPaperGraph?: boolean;
}

const STEP_MAP: Record<string, PaperDemoStep> = {
  kg: "before",
  clustering: "cluster",
  candidates: "generation",
  filtering: "filtering",
  llm: "llm",
  feedback: "human",
  completed: "diff",
};

const COVID_CANDIDATE_MAP: Record<string, string> = {
  "cov-c1": "c1",
  "cov-c2": "c4",
  "cov-c3": "c2",
};

function mapDecisionToPaper(decision?: string | null): UserRefinementDecision {
  if (decision === "accept" || decision === "correct") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "uncertain") return "uncertain";
  return null;
}

interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
  thick?: boolean;
}

const FULL_LEGEND: LegendItem[] = [
  { label: "Original KG relation", color: "#15803d", thick: true },
  { label: "Generated candidate", color: "#ea580c", dashed: true },
  { label: "Filtered out", color: "#dc2626", dashed: true },
  { label: "LLM validated", color: "#2563eb", dashed: true },
  { label: "Accepted", color: "#16a34a", thick: true },
  { label: "Rejected", color: "#dc2626", dashed: true },
  { label: "Uncertain / review", color: "#6b7280", dashed: true },
  { label: "Corrected", color: "#7c3aed", dashed: true },
];

function legendForStep(step: string): LegendItem[] {
  const base: LegendItem[] = [FULL_LEGEND[0]];
  if (step === "kg") return base;
  if (step === "clustering" || step === "candidates") return [...base, FULL_LEGEND[1]];
  if (step === "filtering") return [...base, FULL_LEGEND[1], FULL_LEGEND[2]];
  if (step === "llm") return [...base, FULL_LEGEND[1], FULL_LEGEND[3]];
  if (step === "feedback" || step === "completed")
    return [...base, FULL_LEGEND[4], FULL_LEGEND[5], FULL_LEGEND[6], FULL_LEGEND[7]];
  return FULL_LEGEND;
}

interface InnerGraphProps {
  dataset: DemoDatasetConfig;
  activeStep: string;
  selectedCandidate?: DemoCandidate | null;
  selectedDecision?: Decision | null;
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  graphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  onCandidateSelect?: (candidateId: string) => void;
}

function InnerGraph({
  dataset,
  activeStep,
  selectedCandidate,
  selectedDecision,
  feedbackDecisions,
  useStaticPaperGraph,
  graphPayload,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  onCandidateSelect,
}: InnerGraphProps) {
  const paperStep: PaperDemoStep = STEP_MAP[activeStep] ?? "before";
  const paperDecision: UserRefinementDecision = mapDecisionToPaper(selectedDecision);

  if (graphPayload) {
    return (
      <LiveGraphPanel
        graph={graphPayload}
        activeStep={activeStep}
        sessionId={sessionId}
        selectedClusterId={selectedClusterId}
        selectedCandidateId={selectedCandidate?.candidateId ?? null}
        onSelectionChange={onGraphSelectionChange}
        onCandidateSelect={onCandidateSelect}
        title={`${dataset.label} backend slice`}
      />
    );
  }

  if (dataset.id === "covidFact" && useStaticPaperGraph) {
    const paperCandidateId = selectedCandidate
      ? COVID_CANDIDATE_MAP[selectedCandidate.candidateId] ?? "c1"
      : "c1";
    const paperCandidate = getCandidateById(paperCandidateId);
    return (
      <PaperCovidExampleGraph
        step={paperStep}
        selectedCandidate={paperCandidate}
        selectedDecision={paperDecision}
      />
    );
  }
  return (
    <BenchmarkMiniGraph
      // Static fallback only — live mode must use LiveGraphPanel via graphPayload.
      dataset={dataset}
      activeStep={activeStep}
      selectedCandidate={selectedCandidate}
      selectedDecision={selectedDecision ?? null}
      feedbackDecisions={feedbackDecisions}
    />
  );
}

export function RestoredGraphStagePanel({
  dataset,
  activeStep,
  selectedCandidate,
  selectedDecision,
  feedbackDecisions = {},
  graphPayload = null,
  sessionId = null,
  selectedClusterId = null,
  onGraphSelectionChange,
  onCandidateSelect,
  useStaticPaperGraph = true,
}: RestoredGraphStagePanelProps) {
  const [isFocused, setIsFocused] = useState(false);
  const legend = legendForStep(activeStep);

  useEffect(() => {
    if (!isFocused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFocused(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFocused]);

  const tripleText = selectedCandidate
    ? `(${selectedCandidate.head}, ${selectedCandidate.relation}, ${selectedCandidate.tail})`
    : null;

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3"
      data-testid="restored-graph-stage"
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            Interactive graph — {dataset.label}
          </h3>
          {tripleText ? (
            <div
              className="mt-1 inline-flex max-w-full items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
              title={tripleText}
            >
              <span className="text-slate-500">Selected candidate:</span>
              <span className="block max-w-[42ch] truncate font-mono text-slate-800">{tripleText}</span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setIsFocused(true)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          title="Open the graph in a large focus view (Esc to close)"
        >
          Focus graph
        </button>
      </div>

      <div
        className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1"
        style={{ minHeight: "600px", height: "clamp(600px, 72vh, 860px)" }}
      >
        <InnerGraph
          dataset={dataset}
          activeStep={activeStep}
          selectedCandidate={selectedCandidate}
          selectedDecision={selectedDecision}
          feedbackDecisions={feedbackDecisions}
          useStaticPaperGraph={useStaticPaperGraph}
          graphPayload={graphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onGraphSelectionChange={onGraphSelectionChange}
          onCandidateSelect={onCandidateSelect}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-700">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-6"
              style={{
                background: item.color,
                outline: item.dashed ? `1px dashed ${item.color}` : undefined,
                outlineOffset: item.dashed ? "1px" : undefined,
                height: item.thick ? "3px" : "2px",
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {isFocused ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFocused(false)}
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-[1500px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Focus view — {dataset.label}
                </h2>
                {tripleText ? (
                  <p className="text-[12px] text-slate-600" title={tripleText}>
                    Selected candidate:{" "}
                    <span className="font-mono text-slate-800">{tripleText}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsFocused(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close · Esc
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
              <InnerGraph
                dataset={dataset}
                activeStep={activeStep}
                selectedCandidate={selectedCandidate}
                selectedDecision={selectedDecision}
                feedbackDecisions={feedbackDecisions}
                useStaticPaperGraph={useStaticPaperGraph}
                graphPayload={graphPayload}
                sessionId={sessionId}
                selectedClusterId={selectedClusterId}
                onGraphSelectionChange={onGraphSelectionChange}
                onCandidateSelect={onCandidateSelect}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-700">
              {legend.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-6"
                    style={{
                      background: item.color,
                      outline: item.dashed ? `1px dashed ${item.color}` : undefined,
                      outlineOffset: item.dashed ? "1px" : undefined,
                      height: item.thick ? "3px" : "2px",
                    }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
