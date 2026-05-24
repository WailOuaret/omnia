import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatasetNavigatorPanel } from "../components/paper-demo/DatasetNavigatorPanel";
import { DatasetSelectorPanel } from "../components/paper-demo/DatasetSelectorPanel";
import { GraphSliceSummaryCard } from "../components/paper-demo/GraphSliceSummaryCard";
import { NodeDetailPanel } from "../components/paper-demo/NodeDetailPanel";
import {
  PAPER_DEMO_STEP_ORDER,
  PaperDemoHeader,
  type PaperDemoStepId,
} from "../components/paper-demo/PaperDemoHeader";
import type { GraphSelection } from "../components/paper-demo/LiveGraphPanel";
import { PaperDemoStepView } from "../components/paper-demo/PaperDemoStepView";
import { StepStatsPanel } from "../components/paper-demo/StepStatsPanel";
import { WorkflowStepMenu } from "../components/paper-demo/WorkflowStepMenu";
import { DATASET_LIST, DATASETS } from "../demo-data/datasets";
import type { DemoCandidate, DemoDatasetId } from "../demo-data/types";
import { useFeedbackBridge } from "../hooks/useFeedbackBridge";
import { usePaperDemoSession } from "../hooks/usePaperDemoSession";
import { api, exportCompletedTsvUrl, exportFeedbackJsonUrl } from "../lib/api";
import {
  GUIDED_SLICE,
  withSlicedGraph,
  type DatasetSlice,
  type SliceResult,
} from "../lib/datasetSlice";
import { sampleIdToDemoDatasetId, demoDatasetIdToSampleId, sessionToDemoDataset } from "../lib/sessionToDemoDataset";
import { sessionSliceToGraphPayload } from "../lib/sessionSliceToGraphPayload";
import {
  exportCompletedKGTSV,
  exportFeedbackJSON,
  exportKGDiffJSON,
  getCompletedKG,
  getFeedbackForDataset,
  getKGDiff,
  getSummary,
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

function explanationForStep(step: PaperDemoStepId): string {
  if (step === "kg")
    return "OMNIA starts from an incomplete knowledge graph. The goal is to find plausible missing triples using only the internal structure of the graph.";
  if (step === "clustering")
    return "OMNIA groups head entities that share the same relation-tail pattern. Entities in similar relational contexts may share additional relations.";
  if (step === "candidates")
    return "Candidate generation proposes possible missing triples by combining head entities from the same cluster with relation-tail pairs observed in that cluster. Some candidates will be valid; others will be filtered out.";
  if (step === "filtering")
    return "TransE embedding filtering reduces the candidate set before calling the LLM. Candidates with a structural distance above the threshold are discarded, improving efficiency.";
  if (step === "llm")
    return "The LLM acts as a semantic judge, not a generator. It validates only the candidates that passed structural filtering. RAG provides retrieved context triples to improve accuracy.";
  if (step === "feedback")
    return "The user reviews candidates that passed both filtering and LLM validation. Accept, reject, correct, or mark as uncertain. All decisions are stored and immediately reflected in the completed KG.";
  return "The completed KG shows the original triples plus all accepted and corrected additions. Rejected triples are excluded. Uncertain triples go to a review queue.";
}

export function PaperDemoPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<DemoDatasetId | null>(null);
  const [activeStep, setActiveStep] = useState<PaperDemoStepId>("kg");
  const [demoStarted, setDemoStarted] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [graphSelection, setGraphSelection] = useState<GraphSelection>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSlice, setActiveSlice] = useState<DatasetSlice>(GUIDED_SLICE);
  const [useStaticFallbackInLive, setUseStaticFallbackInLive] = useState(false);
  const feedbackBridge = useFeedbackBridge(selectedDatasetId);
  const liveSession = usePaperDemoSession();
  const syncedLiveSliceRef = useRef(false);

  // In live mode, bind the feedback/localStorage key to the backend session's sample.
  useEffect(() => {
    if (liveSession.mode !== "live" || !liveSession.meta?.sample_id) return;
    const mapped = sampleIdToDemoDatasetId(liveSession.meta.sample_id);
    if (mapped && mapped !== selectedDatasetId) {
      setSelectedDatasetId(mapped);
    }
  }, [liveSession.mode, liveSession.meta?.sample_id, selectedDatasetId]);

  // Restore slice selection from backend session metadata once on load.
  useEffect(() => {
    if (liveSession.mode !== "live" || syncedLiveSliceRef.current) return;
    const backendSlice = liveSession.selectedSlice;
    if (!backendSlice || backendSlice.mode === "guided") return;
    syncedLiveSliceRef.current = true;
    setActiveSlice({
      mode: backendSlice.mode,
      entityQuery: backendSlice.entity ?? undefined,
      relationQuery: backendSlice.relation ?? undefined,
      clusterId: backendSlice.clusterId ?? undefined,
      candidateStatus: (backendSlice.candidateStatus as DatasetSlice["candidateStatus"]) ?? undefined,
      feedbackBucket: (backendSlice.feedbackBucket as DatasetSlice["feedbackBucket"]) ?? undefined,
    });
  }, [liveSession.mode, liveSession.selectedSlice]);

  // ── Auto-start the demo when a backend session is bound via URL ───────────
  useEffect(() => {
    if (liveSession.mode !== "live") return;
    if (!demoStarted) setDemoStarted(true);
  }, [liveSession.mode, demoStarted]);

  // In LIVE mode (sessionId in URL) the dataset is built from real backend
  // artifacts. In STATIC mode we keep the existing hand-curated demo configs.
  const liveDataset = useMemo(() => {
    if (liveSession.mode !== "live") return null;
    return sessionToDemoDataset({
      meta: liveSession.meta,
      slice: liveSession.graphSlice,
      clusters: liveSession.clusters,
      candidates: liveSession.candidates,
    });
  }, [liveSession.mode, liveSession.meta, liveSession.graphSlice, liveSession.clusters, liveSession.candidates]);

  const staticDataset = selectedDatasetId ? DATASETS[selectedDatasetId] : null;
  const liveDataAvailable = Boolean(liveSession.graphSlice?.data_available);
  const shouldUseLiveDataset =
    liveSession.mode === "live" && liveDataAvailable && !useStaticFallbackInLive;
  const baseDataset = shouldUseLiveDataset ? liveDataset : staticDataset;
  const isLiveMode = liveSession.mode === "live";
  const liveSessionId = liveSession.sessionId;
  const sessionDatasetId = useMemo(
    () => sampleIdToDemoDatasetId(liveSession.meta?.sample_id),
    [liveSession.meta?.sample_id],
  );
  const isStaticFallbackInLive = isLiveMode && !shouldUseLiveDataset;

  useEffect(() => {
    if (isLiveMode && isStaticFallbackInLive) {
      console.warn("Live mode is using static fallback data");
    }
  }, [isLiveMode, isStaticFallbackInLive]);

  // Plain unsliced feedback list, used for slice-bucket computation below.
  const allFeedbackEvents = useMemo<UserFeedback[]>(() => {
    if (!selectedDatasetId) return [];
    if (feedbackBridge.mode === "live" && feedbackBridge.hydratedFeedback) {
      return feedbackBridge.hydratedFeedback;
    }
    return getFeedbackForDataset(selectedDatasetId);
  }, [selectedDatasetId, refreshToken, feedbackBridge.mode, feedbackBridge.hydratedFeedback]);

  // Derived sliced dataset. In live mode the backend already returns the bounded
  // slice — do not re-apply client-side slicing on top of it.
  const sliced = useMemo(() => {
    if (!baseDataset) return null;
    if (shouldUseLiveDataset && liveSession.graphSlice) {
      const gs = liveSession.graphSlice;
      const result: SliceResult = {
        mode: activeSlice.mode,
        label: gs.label || "Backend session slice",
        isGuided: activeSlice.mode === "guided",
        nodes: baseDataset.graph.nodes,
        edges: baseDataset.graph.edges,
        clusters: baseDataset.clusters,
        clusterBoxes: baseDataset.graph.clusterBoxes ?? [],
        candidates: baseDataset.candidates,
        stats: {
          nodes: gs.stats?.nodes ?? baseDataset.graph.nodes.length,
          edges: gs.stats?.edges ?? baseDataset.graph.edges.length,
          clusters: gs.stats?.clusters ?? baseDataset.clusters.length,
          candidates: gs.stats?.candidates ?? baseDataset.candidates.length,
        },
      };
      return { dataset: baseDataset, result };
    }
    return withSlicedGraph(baseDataset, activeSlice, allFeedbackEvents);
  }, [
    baseDataset,
    activeSlice,
    allFeedbackEvents,
    shouldUseLiveDataset,
    liveSession.graphSlice,
  ]);
  const selectedDataset = sliced?.dataset ?? null;
  const sliceResult = sliced?.result ?? null;

  useEffect(() => {
    if (!selectedDataset) {
      setSelectedClusterId("");
      setGraphSelection(null);
      return;
    }
    if (!selectedClusterId || !selectedDataset.clusters.some((cluster) => cluster.id === selectedClusterId)) {
      setSelectedClusterId(selectedDataset.clusters[0]?.id ?? "");
    }
  }, [selectedDataset, selectedClusterId]);

  const feedbackEvents = useMemo<UserFeedback[]>(() => {
    if (!selectedDatasetId) return [];
    if (feedbackBridge.mode === "live" && feedbackBridge.hydratedFeedback) {
      return feedbackBridge.hydratedFeedback;
    }
    return getFeedbackForDataset(selectedDatasetId);
  }, [selectedDatasetId, refreshToken, feedbackBridge.mode, feedbackBridge.hydratedFeedback]);

  const feedbackSummary = useMemo(() => {
    const summary = { accepted: 0, rejected: 0, uncertain: 0, corrected: 0, total: 0 };
    const latestByCandidate = new Map<string, UserFeedback>();
    for (const event of feedbackEvents) {
      const existing = latestByCandidate.get(event.candidateId);
      if (!existing || existing.timestamp < event.timestamp) {
        latestByCandidate.set(event.candidateId, event);
      }
    }
    summary.total = latestByCandidate.size;
    for (const event of latestByCandidate.values()) {
      if (event.userDecision === "accept") summary.accepted += 1;
      else if (event.userDecision === "reject") summary.rejected += 1;
      else if (event.userDecision === "uncertain") summary.uncertain += 1;
      else if (event.userDecision === "correct") summary.corrected += 1;
    }
    if (summary.total === 0 && selectedDatasetId && feedbackBridge.mode === "static") {
      return getSummary(selectedDatasetId);
    }
    return summary;
  }, [feedbackEvents, selectedDatasetId, feedbackBridge.mode]);

  const completedKG = useMemo(
    () => (selectedDatasetId ? getCompletedKG(selectedDatasetId) : []),
    [selectedDatasetId, refreshToken, feedbackEvents],
  );
  const kgDiff = useMemo(
    () =>
      selectedDatasetId
        ? getKGDiff(selectedDatasetId)
        : { added: [], rejected: [], corrected: [], reviewQueue: [] },
    [selectedDatasetId, refreshToken, feedbackEvents],
  );

  const completedStatsSummary = useMemo(() => {
    if (!selectedDatasetId || !selectedDataset) return undefined;
    if (feedbackBridge.mode === "live" && feedbackBridge.completedSummary) {
      const live = feedbackBridge.completedSummary;
      return {
        knownTriples: live.knownTriples,
        completedTriples: live.completedTriples,
        acceptedAdditions: live.acceptedAdditions,
        rejectedCandidates: live.rejectedCandidates,
        unresolvedCandidates: live.unresolvedCandidates,
        mode: "live" as const,
      };
    }
    const knownTriples = selectedDataset.graph.edges.filter(
      (edge) => edge.status === "known" || !edge.status,
    ).length;
    return {
      knownTriples,
      completedTriples: completedKG.length,
      acceptedAdditions: kgDiff.added.length + kgDiff.corrected.length,
      rejectedCandidates: kgDiff.rejected.length,
      unresolvedCandidates: kgDiff.reviewQueue.length,
      mode: "static" as const,
    };
  }, [
    selectedDatasetId,
    selectedDataset,
    feedbackBridge.mode,
    feedbackBridge.completedSummary,
    completedKG,
    kgDiff,
  ]);

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

  const selectedCluster =
    selectedDataset?.clusters.find((cluster) => cluster.id === selectedClusterId) ??
    selectedDataset?.clusters[0] ??
    null;

  const latestDecisionForSelected = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.userDecision ?? null
    : null;

  const interactiveGraphPayload = useMemo(() => {
    if (!shouldUseLiveDataset || !liveSession.graphSlice) return null;
    return sessionSliceToGraphPayload({
      slice: liveSession.graphSlice,
      activeStep,
      candidates: allCandidates,
      selectedCandidate,
      selectedClusterId,
      feedbackDecisions,
    });
  }, [
    shouldUseLiveDataset,
    liveSession.graphSlice,
    activeStep,
    allCandidates,
    selectedCandidate,
    selectedClusterId,
    feedbackDecisions,
  ]);

  const startDemo = () => {
    if (!selectedDataset) return;
    setDemoStarted(true);
    setActiveStep("kg");
    setSelectedCandidateId((feedbackCandidates[0] ?? selectedDataset.candidates[0])?.candidateId ?? "");
  };

  const resetToLanding = () => {
    setDemoStarted(false);
    setActiveStep("kg");
  };

  const onDatasetChange = (datasetId: DemoDatasetId) => {
    setSelectedDatasetId(datasetId);
    if (isLiveMode) return;
    setActiveSlice(GUIDED_SLICE);
    setSelectedClusterId(DATASETS[datasetId].clusters[0]?.id ?? "");
    setGraphSelection(null);
    const firstCandidate = DATASETS[datasetId].candidates.find(
      (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
    );
    if (firstCandidate) {
      setSelectedCandidateId(firstCandidate.candidateId);
    }
  };

  const createSessionForDataset = useCallback(async (datasetId: DemoDatasetId) => {
    const sampleId = demoDatasetIdToSampleId(datasetId);
    if (!sampleId) {
      throw new Error("This dataset cannot be loaded from the backend.");
    }
    const response = await api.createSampleSession(sampleId, true, 0.8);
    window.location.assign(`/paper-demo?sessionId=${response.session_id}`);
  }, []);

  const applySlice = useCallback(
    (slice: DatasetSlice) => {
      setActiveSlice(slice);
      setGraphSelection(null);
      // In live mode we also tell the backend so the graph slice + candidates
      // are re-fetched from real session artifacts.
      if (liveSession.mode === "live") {
        void liveSession.setSelectedSlice({
          mode: slice.mode,
          entity: slice.entityQuery ?? null,
          relation: slice.relationQuery ?? null,
          clusterId: slice.clusterId ?? null,
          candidateStatus: slice.candidateStatus ?? null,
          feedbackBucket: slice.feedbackBucket ?? null,
          depth: slice.entityDepth ?? 1,
        });
      }
    },
    [liveSession],
  );
  const resetSlice = useCallback(() => {
    setActiveSlice(GUIDED_SLICE);
    setGraphSelection(null);
    setUseStaticFallbackInLive(false);
    if (liveSession.mode === "live") {
      void liveSession.setSelectedSlice({ mode: "guided" });
    }
  }, [liveSession]);

  const onSelectCluster = useCallback(
    (clusterId: string) => {
      setSelectedClusterId(clusterId);
      applySlice({ mode: "cluster", clusterId });
    },
    [applySlice],
  );

  const onShowCandidatesForNode = useCallback(
    (nodeId: string) => {
      setActiveStep("candidates");
      applySlice({ mode: "entity", entityQuery: nodeId, entityDepth: 1 });
    },
    [applySlice],
  );

  const onFeedbackSubmit = async (feedback: UserFeedback) => {
    await feedbackBridge.submit(feedback);
    setRefreshToken((value) => value + 1);
    if (liveSession.mode === "live") {
      void liveSession.refresh();
    }
  };

  const goPrev = useCallback(() => {
    const idx = PAPER_DEMO_STEP_ORDER.indexOf(activeStep);
    if (idx > 0) setActiveStep(PAPER_DEMO_STEP_ORDER[idx - 1]);
  }, [activeStep]);
  const goNext = useCallback(() => {
    const idx = PAPER_DEMO_STEP_ORDER.indexOf(activeStep);
    if (idx >= 0 && idx < PAPER_DEMO_STEP_ORDER.length - 1) {
      setActiveStep(PAPER_DEMO_STEP_ORDER[idx + 1]);
    }
  }, [activeStep]);

  // ──────────────────────────────────────────────────────────────────────
  // Landing screen (no graph rendered before Start Demo)
  // ──────────────────────────────────────────────────────────────────────
  if (!demoStarted) {
    return (
      <div className="paper-demo min-h-screen bg-slate-50 px-4 py-6 text-slate-900" data-testid="paper-demo-root">
        <div className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">OMNIA+</h1>
            <p className="mt-1 text-sm text-slate-600">
              Interactive Knowledge Graph Completion with LLM Validation and Human Feedback
            </p>
          </div>

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
            <section
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
              data-testid="landing-dataset-card"
            >
              <p className="font-semibold text-slate-900">{selectedDataset.label}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                Source: {selectedDataset.source}
                {" · "}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    selectedDataset.publicStatus === "private"
                      ? "bg-slate-900 text-white"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {selectedDataset.publicStatus === "private" ? "private" : "public"}
                </span>
              </p>
              <p className="mt-2">{selectedDataset.description}</p>
              <p className="mt-2">
                <span className="font-semibold">Entities:</span>{" "}
                {selectedDataset.entities.toLocaleString()} {" · "}
                <span className="font-semibold">Relations:</span>{" "}
                {selectedDataset.relations.toLocaleString()} {" · "}
                <span className="font-semibold">Triples:</span>{" "}
                {selectedDataset.triples.toLocaleString()}
              </p>
              <p className="mt-2">
                <span className="font-semibold">Why this matters for OMNIA:</span>{" "}
                {selectedDataset.whyInteresting}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Recommended mode:</span>{" "}
                {selectedDataset.recommendedMode === "sentence-rag"
                  ? "Sentence-based RAG"
                  : "Triple-based RAG"}
              </p>
              {selectedDataset.warning ? (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                  {selectedDataset.warning}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Why OMNIA+ matters</p>
            <p className="mt-1">
              OMNIA+ combines structural reasoning (clustering + TransE filtering), LLM semantic
              validation with RAG, and human-in-the-loop curation to make KG completion
              transparent and interactive. Each step in the demo is visible so reviewers can see
              what the system actually does — not a black box.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            {selectedDatasetId ? (
              <button
                type="button"
                onClick={startDemo}
                className="rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                data-testid="start-demo-button"
              >
                Start Demo
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
              >
                Start Demo
              </button>
            )}
            <a
              href="https://github.com/fieng94/OMNIA.git"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              GitHub
            </a>
            <a
              href="https://arxiv.org/abs/2603.11820v1"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
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
  if (!selectedDataset) {
    if (isLiveMode && liveSession.loading) {
      return (
        <div className="paper-demo min-h-screen bg-slate-50 p-6 text-slate-700" data-testid="paper-demo-root">
          <p className="text-sm">Loading backend session…</p>
        </div>
      );
    }
    return null;
  }
  const activeDatasetId = selectedDatasetId ?? selectedDataset.id;

  const isCompleted = activeStep === "completed";
  const layoutGridClass = isCompleted
    ? "demo-layout grid items-start gap-4 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]"
    : "demo-layout grid items-start gap-4 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_340px]";

  return (
    <div className="paper-demo min-h-screen bg-slate-50 p-4 text-slate-900" data-testid="paper-demo-root">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <PaperDemoHeader
          datasetLabel={selectedDataset.label}
          step={activeStep}
          mode={feedbackBridge.mode}
          status={feedbackBridge.status}
          onPrev={goPrev}
          onNext={goNext}
          onResetToLanding={resetToLanding}
        />

        <div className={layoutGridClass}>
          <aside className="space-y-3 min-w-0">
            <DatasetSelectorPanel
              selectedDatasetId={activeDatasetId}
              onSelect={onDatasetChange}
              isLiveMode={isLiveMode}
              sessionDatasetId={sessionDatasetId}
              liveDataset={shouldUseLiveDataset ? baseDataset : null}
              sessionId={liveSessionId}
              onCreateSession={createSessionForDataset}
            />
            {baseDataset ? (
              <DatasetNavigatorPanel
                dataset={baseDataset}
                activeSlice={activeSlice}
                onApply={applySlice}
                onReset={resetSlice}
                sessionId={liveSessionId}
                isLiveMode={isLiveMode}
                backendClusters={liveSession.clusters.map((c) => ({
                  cluster_id: c.cluster_id,
                  shared_relation: c.shared_relation,
                  shared_tail: c.shared_tail,
                }))}
              />
            ) : null}
            <WorkflowStepMenu activeStep={activeStep} onStepChange={(s) => setActiveStep(s as PaperDemoStepId)} />
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
          </aside>

          <main className="center-panel min-w-0 space-y-3 overflow-hidden">
            <section
              className={`rounded-xl border p-3 text-sm ${
                shouldUseLiveDataset
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : isStaticFallbackInLive
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-300 bg-slate-50 text-slate-800"
              }`}
              data-testid="graph-source-badge"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      shouldUseLiveDataset ? "bg-emerald-500" : isStaticFallbackInLive ? "bg-rose-500" : "bg-slate-500"
                    }`}
                  />
                  <p className="font-semibold">
                    {shouldUseLiveDataset
                      ? `Graph source: backend session slice (sessionId ${liveSessionId})`
                      : isStaticFallbackInLive
                        ? "WARNING: live mode using static fallback data"
                      : "Graph source: static demo fallback"}
                  </p>
                </div>
                {isLiveMode && liveSession.meta ? (
                  <p className="text-[11px] text-emerald-900/80">
                    {liveSession.meta.dataset_name} · {liveSession.meta.triple_count.toLocaleString()} triples ·
                    {" "}{liveSession.meta.entity_count.toLocaleString()} entities ·
                    {" "}{liveSession.meta.relation_count.toLocaleString()} relations
                  </p>
                ) : null}
              </div>
              {isLiveMode && liveSession.error ? (
                <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                  Warning: {liveSession.error}
                </p>
              ) : null}
              {isLiveMode && !liveDataAvailable && !useStaticFallbackInLive ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                  <span>Backend session has no slice data available yet.</span>
                  <button
                    type="button"
                    onClick={() => setUseStaticFallbackInLive(true)}
                    className="rounded border border-amber-400 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                  >
                    Use static fallback
                  </button>
                </div>
              ) : null}
              {isStaticFallbackInLive ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-900">
                  <span>Live mode currently rendering static fallback data.</span>
                  <button
                    type="button"
                    onClick={() => setUseStaticFallbackInLive(false)}
                    className="rounded border border-rose-400 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-900"
                  >
                    Retry backend slice
                  </button>
                </div>
              ) : null}
              {isLiveMode && !liveSession.graphSlice && !liveSession.loading ? (
                <p className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                  Backend slice unavailable. Run candidate generation / filtering first or create a paper session.
                </p>
              ) : null}
            </section>
            {baseDataset && sliceResult ? (
              <GraphSliceSummaryCard
                result={sliceResult}
                totals={{
                  nodes: baseDataset.graph.nodes.length,
                  edges: baseDataset.graph.edges.length,
                  clusters: baseDataset.clusters.length,
                  candidates: baseDataset.candidates.length,
                }}
                onReset={resetSlice}
              />
            ) : null}
            <PaperDemoStepView
              step={activeStep}
              dataset={selectedDataset}
              datasetId={selectedDataset.id}
              candidates={allCandidates}
              feedbackCandidates={feedbackCandidates}
              selectedCandidate={selectedCandidate}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={setSelectedCandidateId}
              selectedClusterId={selectedClusterId}
              onSelectCluster={onSelectCluster}
              latestDecisionForSelected={latestDecisionForSelected}
              feedbackDecisions={feedbackDecisions}
              feedbackEvents={feedbackEvents}
              bridgeStatus={feedbackBridge.status}
              onFeedbackSubmit={onFeedbackSubmit}
              interactiveGraphPayload={interactiveGraphPayload}
              sessionId={liveSessionId}
              onGraphSelectionChange={setGraphSelection}
              useStaticPaperGraph={!isLiveMode && activeSlice.mode === "guided"}
            />

            {isCompleted ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Exports &amp; summary</h3>
                  <div className="text-[11px] text-slate-600">
                    {feedbackBridge.mode === "live"
                      ? "Backend export endpoints are also available at /api/sessions/{sessionId}/export/*"
                      : "Static demo: exports are derived from localStorage."}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (feedbackBridge.sessionId) {
                        window.open(
                          exportFeedbackJsonUrl(feedbackBridge.sessionId),
                          "_blank",
                          "noopener,noreferrer",
                        );
                        return;
                      }
                      downloadFile(
                        exportFeedbackJSON(activeDatasetId),
                        `${activeDatasetId}_feedback.json`,
                        "application/json",
                      );
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Export feedback JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (feedbackBridge.sessionId) {
                        window.open(
                          exportCompletedTsvUrl(feedbackBridge.sessionId),
                          "_blank",
                          "noopener,noreferrer",
                        );
                        return;
                      }
                      downloadFile(
                        exportCompletedKGTSV(activeDatasetId),
                        `${activeDatasetId}_completed_kg.tsv`,
                        "text/tab-separated-values",
                      );
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    Export completed KG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (feedbackBridge.sessionId) {
                        window.open(
                          api.exportJsonUrl(feedbackBridge.sessionId),
                          "_blank",
                          "noopener,noreferrer",
                        );
                        return;
                      }
                      downloadFile(
                        exportKGDiffJSON(activeDatasetId),
                        `${activeDatasetId}_kg_diff.json`,
                        "application/json",
                      );
                    }}
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
                    <p>Review queue: {kgDiff.reviewQueue.length}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="font-semibold text-slate-800">Completed KG</p>
                    <p>
                      Original triples:{" "}
                      {(
                        completedStatsSummary?.knownTriples ??
                        selectedDataset.graph.edges.filter(
                          (edge) => edge.status === "known" || !edge.status,
                        ).length
                      ).toLocaleString()}
                    </p>
                    <p>
                      Final completed triples:{" "}
                      {(completedStatsSummary?.completedTriples ?? completedKG.length).toLocaleString()}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Source:{" "}
                      {completedStatsSummary?.mode === "live"
                        ? "backend /completed.summary.completed_triples"
                        : "getCompletedKG(datasetId).length"}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </main>

          {!isCompleted ? (
            <aside className="right-panel min-w-0 space-y-3">
              <NodeDetailPanel
                graph={interactiveGraphPayload}
                selection={graphSelection}
                selectedCandidate={selectedCandidate}
                selectedCluster={selectedCluster}
                candidates={allCandidates}
                clusters={selectedDataset.clusters}
                sessionId={liveSessionId}
                onShowCandidatesForNode={onShowCandidatesForNode}
              />
              <StepStatsPanel
                dataset={selectedDataset}
                step={activeStep}
                selectedCandidate={selectedCandidate}
                feedbackSummary={feedbackSummary}
                completedSummary={completedStatsSummary}
                backendDiagnostics={feedbackBridge.completedSummary}
              />
            </aside>
          ) : null}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Step explanation
          </p>
          <p className="mt-1 text-sm text-slate-700">{explanationForStep(activeStep)}</p>
        </section>
      </div>
    </div>
  );
}
