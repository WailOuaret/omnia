import { useMemo, useState } from "react";
import { DatasetSelectorPanel } from "../components/paper-demo/DatasetSelectorPanel";
import { GraphComparisonPanel } from "../components/paper-demo/GraphComparisonPanel";
import { RestoredGraphStagePanel } from "../components/paper-demo/RestoredGraphStagePanel";
import { StepStatsPanel } from "../components/paper-demo/StepStatsPanel";
import { UserFeedbackPanel } from "../components/paper-demo/UserFeedbackPanel";
import { WorkflowStepMenu } from "../components/paper-demo/WorkflowStepMenu";
import { DATASET_LIST, DATASETS } from "../demo-data/datasets";
import type { DemoCandidate, DemoDatasetId } from "../demo-data/types";
import { useFeedbackBridge } from "../hooks/useFeedbackBridge";
import { exportCompletedTsvUrl } from "../lib/api";
import {
  exportCompletedKGTSV,
  exportFeedbackJSON,
  exportKGDiffJSON,
  getCompletedKG,
  getKGDiff,
  getSummary,
  getFeedbackForDataset,
  type UserFeedback,
} from "../stores/feedbackStore";

function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function explanationForStep(step: string): string {
  if (step === "kg") return "OMNIA starts from an incomplete knowledge graph. The goal is to find plausible missing triples using only the internal structure of the graph.";
  if (step === "clustering") return "OMNIA groups head entities that share the same relation-tail pattern. Entities in similar relational contexts may share additional relations.";
  if (step === "candidates") return "Candidate generation proposes possible missing triples by combining head entities from the same cluster with relation-tail pairs observed in that cluster. Some candidates will be valid; others will be filtered out.";
  if (step === "filtering") return "TransE embedding filtering reduces the candidate set before calling the LLM. Candidates with a structural distance above the threshold are discarded, improving efficiency.";
  if (step === "llm") return "The LLM acts as a semantic judge, not a generator. It validates only the candidates that passed structural filtering. RAG provides retrieved context triples to improve accuracy.";
  if (step === "feedback") return "The user reviews candidates that passed both filtering and LLM validation. Accept, reject, correct, or mark as uncertain. All decisions are stored and immediately reflected in the completed KG.";
  return "The completed KG shows the original triples plus all accepted and corrected additions. Rejected triples are excluded. Uncertain triples go to a review queue.";
}

export function PaperDemoPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<DemoDatasetId | null>(null);
  const [activeStep, setActiveStep] = useState<string>("kg");
  const [demoStarted, setDemoStarted] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [refreshToken, setRefreshToken] = useState(0);
  const feedbackBridge = useFeedbackBridge();

  const selectedDataset = selectedDatasetId ? DATASETS[selectedDatasetId] : null;
  const feedbackSummary = useMemo(
    () => (selectedDatasetId ? getSummary(selectedDatasetId) : { accepted: 0, rejected: 0, uncertain: 0, corrected: 0, total: 0 }),
    [selectedDatasetId, refreshToken],
  );
  const completedKG = useMemo(() => (selectedDatasetId ? getCompletedKG(selectedDatasetId) : []), [selectedDatasetId, refreshToken]);
  const kgDiff = useMemo(
    () => (selectedDatasetId ? getKGDiff(selectedDatasetId) : { added: [], rejected: [], corrected: [], review: [] }),
    [selectedDatasetId, refreshToken],
  );
  const feedbackEvents = useMemo(() => (selectedDatasetId ? getFeedbackForDataset(selectedDatasetId) : []), [selectedDatasetId, refreshToken]);
  const feedbackDecisions = useMemo<Record<string, "accept" | "reject" | "uncertain" | "correct">>(() => {
    const map: Record<string, "accept" | "reject" | "uncertain" | "correct"> = {};
    const sorted = [...feedbackEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of sorted) {
      map[event.candidateId] = event.userDecision;
    }
    return map;
  }, [feedbackEvents]);
  const feedbackCandidates = useMemo<DemoCandidate[]>(
    () =>
      selectedDataset
        ? selectedDataset.candidates.filter(
            (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
          )
        : [],
    [selectedDataset],
  );
  const allCandidates = selectedDataset?.candidates ?? [];
  const selectedCandidate: DemoCandidate | null =
    allCandidates.find((candidate) => candidate.candidateId === selectedCandidateId) ??
    feedbackCandidates[0] ??
    allCandidates[0] ??
    null;
  const latestDecisionForSelected = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.userDecision ?? null
    : null;

  const startDemo = () => {
    if (!selectedDataset) return;
    setDemoStarted(true);
    setActiveStep("kg");
    setSelectedCandidateId((feedbackCandidates[0] ?? selectedDataset.candidates[0])?.candidateId ?? "");
  };

  const onDatasetChange = (datasetId: DemoDatasetId) => {
    setSelectedDatasetId(datasetId);
    const firstCandidate = DATASETS[datasetId].candidates.find(
      (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
    );
    if (firstCandidate) {
      setSelectedCandidateId(firstCandidate.candidateId);
    }
  };

  const onFeedbackSubmit = (feedback: UserFeedback) => {
    void feedbackBridge.submit(feedback);
    setRefreshToken((value) => value + 1);
  };

  if (!demoStarted) {
    return (
      <div className="paper-demo min-h-screen bg-slate-50 px-4 py-6 text-slate-900" data-testid="paper-demo-root">
        <div className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-bold tracking-tight">OMNIA+</h1>
          <p className="text-sm text-slate-600">Interactive Knowledge Graph Completion with LLM Validation and Human Feedback</p>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Select dataset</h2>
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={selectedDatasetId ?? ""}
              onChange={(event) => onDatasetChange(event.target.value as DemoDatasetId)}
            >
              <option value="" disabled>
                Choose dataset
              </option>
              {DATASET_LIST.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </div>
          {selectedDataset ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{selectedDataset.label}</p>
              <p className="mt-1">{selectedDataset.description}</p>
              <p className="mt-1">
                <span className="font-semibold">Entities:</span> {selectedDataset.entities.toLocaleString()} |{" "}
                <span className="font-semibold">Relations:</span> {selectedDataset.relations.toLocaleString()} |{" "}
                <span className="font-semibold">Triples:</span> {selectedDataset.triples.toLocaleString()}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Why this matters for OMNIA:</span> {selectedDataset.whyInteresting}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Recommended mode:</span>{" "}
                {selectedDataset.recommendedMode === "sentence-rag" ? "sentence-based RAG" : "triple-based RAG"}
              </p>
              {selectedDataset.warning ? (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">{selectedDataset.warning}</p>
              ) : null}
            </section>
          ) : null}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Why OMNIA+ matters</p>
            <p className="mt-1">OMNIA+ combines structural reasoning, LLM semantic validation, and human feedback to make KG completion transparent and interactive.</p>
          </section>
          <div className="flex flex-wrap items-center gap-2">
            {selectedDatasetId ? (
              <button
                type="button"
                onClick={startDemo}
                className="rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Start Demo
              </button>
            ) : null}
            <a href="https://github.com/fieng94/OMNIA.git" target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              GitHub
            </a>
            <a href="https://arxiv.org/abs/2603.11820v1" target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              Paper
            </a>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600">
              Video (coming soon)
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!selectedDatasetId || !selectedDataset) return null;

  const isCompleted = activeStep === "completed";
  const layoutGridClass = isCompleted
    ? "demo-layout grid items-start gap-4 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]"
    : "demo-layout grid items-start gap-4 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_340px]";

  const bridgeBadge = (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        feedbackBridge.mode === "live"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
      data-testid="feedback-bridge-badge"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          feedbackBridge.mode === "live"
            ? feedbackBridge.status === "sync-failed"
              ? "bg-amber-500"
              : "bg-emerald-500"
            : "bg-slate-400"
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {feedbackBridge.mode === "live"
            ? "Live backend feedback connected"
            : "Static demo mode"}
        </p>
        {feedbackBridge.lastMessage ? (
          <p className="truncate text-[11px] text-slate-600">{feedbackBridge.lastMessage}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="paper-demo min-h-screen bg-slate-50 p-4 text-slate-900" data-testid="paper-demo-root">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <div className={layoutGridClass}>
          <aside className="space-y-3 min-w-0">
            <DatasetSelectorPanel
              selectedDatasetId={selectedDatasetId}
              onSelect={onDatasetChange}
            />
            <WorkflowStepMenu activeStep={activeStep} onStepChange={setActiveStep} />
            {bridgeBadge}
          </aside>

          <main className="center-panel min-w-0 space-y-3 overflow-hidden">
            {isCompleted ? (
              <GraphComparisonPanel
                dataset={selectedDataset}
                selectedCandidate={selectedCandidate}
                feedbackDecisions={feedbackDecisions}
                feedbackEvents={feedbackEvents}
              />
            ) : (
              <RestoredGraphStagePanel
                dataset={selectedDataset}
                activeStep={activeStep}
                selectedCandidate={selectedCandidate}
                selectedDecision={latestDecisionForSelected}
                feedbackDecisions={feedbackDecisions}
              />
            )}

            {(activeStep === "candidates" ||
              activeStep === "filtering" ||
              activeStep === "llm" ||
              activeStep === "feedback") && allCandidates.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
                <p className="font-semibold text-slate-900">
                  {activeStep === "feedback" ? "Candidates ready for review" : "Candidates"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(activeStep === "feedback" ? feedbackCandidates : allCandidates).map((candidate) => (
                    <button
                      key={candidate.candidateId}
                      type="button"
                      onClick={() => setSelectedCandidateId(candidate.candidateId)}
                      className={`rounded border px-2 py-1 text-xs ${
                        selectedCandidate?.candidateId === candidate.candidateId
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                      title={`(${candidate.head}, ${candidate.relation}, ${candidate.tail})`}
                    >
                      {candidate.candidateId}: {candidate.head} → {candidate.tail}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeStep === "feedback" && selectedCandidate ? (
              <UserFeedbackPanel
                datasetId={selectedDatasetId}
                candidate={selectedCandidate}
                onFeedbackSubmit={onFeedbackSubmit}
                existingFeedback={feedbackEvents.find((event) => event.candidateId === selectedCandidate.candidateId)}
              />
            ) : null}

            {isCompleted ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Exports & summary</h3>
                  <div className="text-[11px] text-slate-600">
                    {feedbackBridge.mode === "live"
                      ? "Backend export endpoints are also available at /api/sessions/{sessionId}/export/*"
                      : "Static demo: exports are derived from localStorage."}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(exportFeedbackJSON(selectedDatasetId), `${selectedDatasetId}_feedback.json`, "application/json")
                    }
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Export feedback JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (feedbackBridge.sessionId) {
                        window.open(exportCompletedTsvUrl(feedbackBridge.sessionId), "_blank", "noopener,noreferrer");
                        return;
                      }
                      downloadFile(
                        exportCompletedKGTSV(selectedDatasetId),
                        `${selectedDatasetId}_completed_kg.tsv`,
                        "text/tab-separated-values",
                      );
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Export completed KG
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(exportKGDiffJSON(selectedDatasetId), `${selectedDatasetId}_kg_diff.json`, "application/json")
                    }
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Export KG diff
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="font-semibold text-slate-800">Feedback summary</p>
                    <p className="text-emerald-700">Accepted: {feedbackSummary.accepted}</p>
                    <p className="text-rose-700">Rejected: {feedbackSummary.rejected}</p>
                    <p className="text-amber-700">Uncertain: {feedbackSummary.uncertain}</p>
                    <p className="text-violet-700">Corrected: {feedbackSummary.corrected}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="font-semibold text-slate-800">KG diff preview</p>
                    <p>Added: {kgDiff.added.length}</p>
                    <p>Rejected: {kgDiff.rejected.length}</p>
                    <p>Corrected: {kgDiff.corrected.length}</p>
                    <p>Review queue: {kgDiff.review.length}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="font-semibold text-slate-800">Completed KG</p>
                    <p>Original triples: {selectedDataset.graph.edges.filter((edge) => edge.status === "known" || !edge.status).length}</p>
                    <p>Final completed triples: {completedKG.length}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Completed KG = original known triples + accepted + corrected − rejected.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </main>

          {!isCompleted ? (
            <aside className="right-panel min-w-0">
              <StepStatsPanel
                dataset={selectedDataset}
                step={activeStep}
                selectedCandidate={selectedCandidate}
                feedbackSummary={feedbackSummary}
              />
            </aside>
          ) : null}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bottom explanation</p>
          <p className="mt-1 text-sm text-slate-700">{explanationForStep(activeStep)}</p>
        </section>
      </div>
    </div>
  );
}
