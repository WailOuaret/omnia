import type { DemoCandidate, DemoDatasetConfig } from "../../demo-data/types";

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
}

function format(v: number) {
  return v.toLocaleString();
}

export function StepStatsPanel({
  dataset,
  step,
  selectedCandidate: selectedCandidateProp,
  feedbackSummary,
}: StepStatsPanelProps) {
  const selectedCandidate = selectedCandidateProp ?? dataset.candidates[0] ?? null;
  const summary = feedbackSummary ?? { accepted: 0, rejected: 0, uncertain: 0, corrected: 0, total: 0 };

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Current-Step Stats</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
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

        {step === "filtering" && selectedCandidate ? (
          <>
            <p>
              <span className="font-semibold">Model:</span> {dataset.filteringStats.model}
            </p>
            <p>
              <span className="font-semibold">Threshold τ:</span> {dataset.filteringStats.threshold.toFixed(2)}
            </p>
            <p>
              <span className="font-semibold">Before filtering:</span> {format(dataset.filteringStats.beforeFiltering)}
            </p>
            <p>
              <span className="font-semibold">After filtering:</span> {format(dataset.filteringStats.afterFiltering)}
            </p>
            <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected candidate</p>
              <p className="font-mono text-xs">
                ({selectedCandidate.head}, {selectedCandidate.relation}, {selectedCandidate.tail})
              </p>
              <p>
                <span className="font-semibold">Distance:</span> {selectedCandidate.distance?.toFixed(2) ?? "—"}
              </p>
              <p>
                <span className="font-semibold">Result:</span>{" "}
                {selectedCandidate.distance !== undefined && selectedCandidate.threshold !== undefined
                  ? selectedCandidate.distance <= selectedCandidate.threshold
                    ? "PASSED"
                    : "FILTERED OUT"
                  : "—"}
              </p>
            </div>
          </>
        ) : null}

        {step === "llm" && selectedCandidate ? (
          <>
            <p>
              <span className="font-semibold">Prompt mode:</span>{" "}
              {dataset.recommendedMode === "sentence-rag" ? "Sentence-based RAG" : "Triple-based RAG"}
            </p>
            <p>
              <span className="font-semibold">Top-k:</span> {dataset.llmStats.topK}
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
              <span className="font-semibold">Original triples:</span> {format(dataset.triples)}
            </p>
            <p>
              <span className="font-semibold">Accepted triples added:</span> {summary.accepted + summary.corrected}
            </p>
            <p>
              <span className="font-semibold">Final triple count:</span> {format(dataset.triples + summary.accepted + summary.corrected)}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

