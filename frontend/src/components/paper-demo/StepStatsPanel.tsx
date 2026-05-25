import type { DemoCandidate, DemoDatasetConfig } from "../../demo-data/types";
import type { CompletedSummaryView } from "../../lib/adapters";

interface StepStatsPanelProps {
  dataset: DemoDatasetConfig;
  step: string;
  selectedCandidate?: DemoCandidate | null;
  feedbackSummary?: {
    accepted: number;
    rejected: number;
    uncertain: number;
    corrected: number;
    total: number;
  };
  /** Source-of-truth completed-step counts.
   *  Static mode: derived from the in-memory completed KG.
   *  Live mode: derived from `GET /api/sessions/{id}/completed`. */
  completedSummary?: {
    knownTriples: number;
    completedTriples: number;
    acceptedAdditions: number;
    rejectedCandidates: number;
    unresolvedCandidates: number;
    mode: "static" | "live";
  };
  /** Optional backend diagnostics (live mode only). Surfaces threshold, agreement, priors. */
  backendDiagnostics?: CompletedSummaryView | null;
  /** Omit outer card chrome when embedded in tabbed inspector. */
  compact?: boolean;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
}

function format(v: number) {
  return v.toLocaleString();
}

export function StepStatsPanel({
  dataset,
  step,
  selectedCandidate: selectedCandidateProp,
  feedbackSummary,
  completedSummary,
  backendDiagnostics,
  compact = false,
  filteringAvailable = true,
  llmAvailable = true,
}: StepStatsPanelProps) {
  const selectedCandidate = selectedCandidateProp ?? dataset.candidates[0] ?? null;
  const summary = feedbackSummary ?? { accepted: 0, rejected: 0, uncertain: 0, corrected: 0, total: 0 };

  const content = (
    <>
      {!compact ? <h3 className="text-sm font-semibold text-slate-900">Current-Step Stats</h3> : null}
      <div className={`space-y-2 text-sm text-slate-700 ${compact ? "" : "mt-3"}`}>
        {step === "kg" ? (
          <>
            <p>
              <span className="font-semibold">Dataset:</span> {dataset.label}
            </p>
            <p>
              <span className="font-semibold">Entities:</span> {format(dataset.entities)}
            </p>
            <p>
              <span className="font-semibold">Relations:</span> {format(dataset.relations)}
            </p>
            <p>
              <span className="font-semibold">Triples:</span> {format(dataset.triples)}
            </p>
            <p>
              <span className="font-semibold">Recommended mode:</span>{" "}
              {dataset.recommendedMode === "sentence-rag" ? "sentence-based RAG" : "triple-based RAG"}
            </p>
            {dataset.bestF1 !== undefined ? (
              <p>
                <span className="font-semibold">Best OMNIA F1:</span> {dataset.bestF1.toFixed(2)}
              </p>
            ) : null}
            {dataset.role ? (
              <p>
                <span className="font-semibold">Role:</span> {dataset.role}
              </p>
            ) : null}
            <p>
              <span className="font-semibold">Task:</span> find missing triples
            </p>
            {dataset.note ? (
              <p className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                {dataset.note}
              </p>
            ) : null}
            {dataset.warning ? (
              <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                {dataset.warning}
              </p>
            ) : null}
          </>
        ) : null}

        {step === "clustering" ? (
          <>
            <p>
              <span className="font-semibold">Cluster count:</span> {dataset.clusters.length}
            </p>
            <p>
              <span className="font-semibold">Selected cluster:</span> {dataset.clusters[0]?.id}
            </p>
            <p>
              <span className="font-semibold">Cluster key:</span> ({dataset.clusters[0]?.sharedRelation}, {dataset.clusters[0]?.sharedTail})
            </p>
            <p>
              <span className="font-semibold">Cluster size:</span> {dataset.clusters[0]?.size ?? 0}
            </p>
            <p>
              <span className="font-semibold">Reason:</span> shared relation-tail structural context
            </p>
          </>
        ) : null}

        {step === "candidates" ? (
          <>
            <p>
              <span className="font-semibold">Generated candidates:</span> {dataset.candidates.length}
            </p>
            <p>
              <span className="font-semibold">Candidate source:</span> cluster propagation
            </p>
            <p>
              <span className="font-semibold">Next step:</span> embedding filtering
            </p>
          </>
        ) : null}

        {step === "filtering" ? (
          <>
            {filteringAvailable &&
            selectedCandidate?.distance != null &&
            selectedCandidate?.threshold != null &&
            selectedCandidate.threshold > 0 ? (
              <>
                <p>
                  <span className="font-semibold">Model:</span> {dataset.filteringStats.model}
                </p>
                <p>
                  <span className="font-semibold">Threshold τ:</span> {selectedCandidate.threshold.toFixed(2)}
                </p>
                <p>
                  <span className="font-semibold">Before filtering:</span>{" "}
                  {format(dataset.filteringStats.beforeFiltering)}
                </p>
                <p>
                  <span className="font-semibold">After filtering:</span>{" "}
                  {format(dataset.filteringStats.afterFiltering)}
                </p>
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected candidate</p>
                  <p className="font-mono text-xs">
                    ({selectedCandidate.head}, {selectedCandidate.relation}, {selectedCandidate.tail})
                  </p>
                  <p>
                    <span className="font-semibold">Distance:</span> {selectedCandidate.distance.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Result:</span>{" "}
                    {selectedCandidate.distance <= selectedCandidate.threshold ? "KEPT" : "REMOVED"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs italic text-slate-500">
                {filteringAvailable
                  ? "Select a candidate with TransE filtering scores to inspect distance and threshold."
                  : "Filtering artifacts are not available for this session."}
              </p>
            )}
          </>
        ) : null}

        {step === "llm" && selectedCandidate ? (
          <>
            {llmAvailable ? (
              <>
                <p>
                  <span className="font-semibold">Prompt mode:</span>{" "}
                  {dataset.recommendedMode === "sentence-rag" ? "Sentence-based RAG" : "Triple-based RAG"}
                </p>
                <p>
                  <span className="font-semibold">Top-k:</span> {dataset.llmStats.topK}{" "}
                  <span className="text-[11px] text-slate-500">
                    (simplified demo setting · OMNIA paper peaks at top-k = 3)
                  </span>
                </p>
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected candidate</p>
                  <p className="font-mono text-xs">
                    ({selectedCandidate.head}, {selectedCandidate.relation}, {selectedCandidate.tail})
                  </p>
                  <p>
                    <span className="font-semibold">Verdict:</span> {selectedCandidate.llmVerdict ?? dataset.llmStats.verdict}
                  </p>
                  <p>
                    <span className="font-semibold">Confidence:</span>{" "}
                    {(selectedCandidate.llmConfidence ?? dataset.llmStats.confidence).toFixed(2)}
                  </p>
                  {selectedCandidate.llmRationale ? (
                    <p className="mt-1 text-xs text-slate-600">{selectedCandidate.llmRationale}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-xs italic text-slate-500">
                LLM/RAG validation artifacts are not available for this session.
              </p>
            )}
          </>
        ) : null}

        {step === "feedback" ? (
          <>
            <p>
              <span className="font-semibold">Accepted:</span> {summary.accepted}
            </p>
            <p>
              <span className="font-semibold">Rejected:</span> {summary.rejected}
            </p>
            <p>
              <span className="font-semibold">Uncertain:</span> {summary.uncertain}
            </p>
            <p>
              <span className="font-semibold">Corrected:</span> {summary.corrected}
            </p>
            <p>
              <span className="font-semibold">Total reviewed:</span> {summary.total}
            </p>
          </>
        ) : null}

        {step === "completed" ? (
          <>
            <p>
              <span className="font-semibold">Original triples:</span>{" "}
              {format(completedSummary?.knownTriples ?? dataset.triples)}
            </p>
            <p>
              <span className="font-semibold">Accepted additions:</span>{" "}
              {format(completedSummary?.acceptedAdditions ?? summary.accepted + summary.corrected)}
            </p>
            <p>
              <span className="font-semibold">Rejected candidates:</span>{" "}
              {format(completedSummary?.rejectedCandidates ?? summary.rejected)}
            </p>
            <p>
              <span className="font-semibold">Review queue:</span>{" "}
              {format(completedSummary?.unresolvedCandidates ?? summary.uncertain)}
            </p>
            <p>
              <span className="font-semibold">Final triple count:</span>{" "}
              {completedSummary
                ? format(completedSummary.completedTriples)
                : "—"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Source:{" "}
              {completedSummary?.mode === "live"
                ? "/api/sessions/{id}/completed → summary.completed_triples"
                : "static feedback store (getCompletedKG().length)"}
            </p>
            {backendDiagnostics ? (
              <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                <p className="font-semibold uppercase tracking-wide text-slate-500">
                  Backend diagnostics
                </p>
                {backendDiagnostics.thresholdSuggestion?.threshold !== undefined ? (
                  <p>
                    <span className="font-semibold">Suggested τ:</span>{" "}
                    {backendDiagnostics.thresholdSuggestion.threshold.toFixed(2)}
                    {backendDiagnostics.thresholdSuggestion.f1 !== undefined
                      ? ` (F1 ${backendDiagnostics.thresholdSuggestion.f1.toFixed(2)})`
                      : ""}
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold">User vs LLM agreement:</span>{" "}
                  {(backendDiagnostics.agreementRate * 100).toFixed(0)}%
                </p>
                {backendDiagnostics.diagnostics?.evidence_insufficient !== undefined ? (
                  <p>
                    <span className="font-semibold">Evidence insufficient:</span>{" "}
                    {backendDiagnostics.diagnostics.evidence_insufficient}
                  </p>
                ) : null}
                {backendDiagnostics.priors?.dataset_prior !== undefined ? (
                  <p>
                    <span className="font-semibold">Dataset accept rate:</span>{" "}
                    {(backendDiagnostics.priors.dataset_prior * 100).toFixed(0)}%
                    {backendDiagnostics.priors.feedback_examples !== undefined
                      ? ` (n=${backendDiagnostics.priors.feedback_examples})`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );

  if (compact) {
    return <div data-testid="step-stats-panel">{content}</div>;
  }

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-4" data-testid="step-stats-panel">
      {content}
    </section>
  );
}

