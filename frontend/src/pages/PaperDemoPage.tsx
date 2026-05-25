import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatasetNavigatorPanel } from "../components/paper-demo/DatasetNavigatorPanel";
import { DatasetSelectorPanel } from "../components/paper-demo/DatasetSelectorPanel";
import { GraphSliceSummaryCard } from "../components/paper-demo/GraphSliceSummaryCard";
import {
  PAPER_DEMO_STEP_ORDER,
  PaperDemoHeader,
  type PaperDemoStepId,
} from "../components/paper-demo/PaperDemoHeader";
import type { GraphSelection } from "../components/paper-demo/LiveGraphPanel";
import { PaperDemoInspectorPanel } from "../components/paper-demo/PaperDemoInspectorPanel";
import { PaperDemoStepView, PaperDemoStepExplanation } from "../components/paper-demo/PaperDemoStepView";
import { WorkflowStepMenu } from "../components/paper-demo/WorkflowStepMenu";
import { DATASET_LIST, DATASETS } from "../demo-data/datasets";
import type { DemoCandidate, DemoCluster, DemoDatasetId } from "../demo-data/types";
import { useFeedbackBridge } from "../hooks/useFeedbackBridge";
import { isBackendLoadable, usePaperDemoSession } from "../hooks/usePaperDemoSession";
import { api, exportCompletedTsvUrl, exportFeedbackJsonUrl } from "../lib/api";
import {
  GUIDED_SLICE,
  withSlicedGraph,
  type DatasetSlice,
  type SliceResult,
} from "../lib/datasetSlice";
import { buildLiveOmniaViewModel } from "../lib/buildLiveOmniaViewModel";
import { sampleIdToDemoDatasetId } from "../lib/sessionToDemoDataset";
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

function readInitialDatasetId(): DemoDatasetId {
  if (typeof window === "undefined") return "codexM";
  const params = new URLSearchParams(window.location.search);
  const dataset = params.get("dataset");
  if (
    dataset === "codexM" ||
    dataset === "fb15k237" ||
    dataset === "wn18rr" ||
    dataset === "covidFact" ||
    dataset === "socioEconomic"
  ) {
    return dataset;
  }
  return "codexM";
}

export function PaperDemoPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<DemoDatasetId | null>(readInitialDatasetId);
  const [activeStep, setActiveStep] = useState<PaperDemoStepId>("kg");
  const [demoStarted, setDemoStarted] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [graphSelection, setGraphSelection] = useState<GraphSelection>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSlice, setActiveSlice] = useState<DatasetSlice>(GUIDED_SLICE);
  const [expandContextPending, setExpandContextPending] = useState(false);
  const liveSession = usePaperDemoSession(selectedDatasetId);
  const feedbackBridge = useFeedbackBridge(selectedDatasetId, liveSession.sessionId);
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
    if (!backendSlice || backendSlice.mode === "guided" || backendSlice.mode === "overview") return;
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

  // ── Auto-start when backend session is ready (CoDEx-M default live path) ───
  useEffect(() => {
    if (liveSession.mode !== "live" || liveSession.bindStatus !== "ready") return;
    if (!demoStarted) setDemoStarted(true);
    if (!selectedDatasetId) setSelectedDatasetId("codexM");
  }, [liveSession.mode, liveSession.bindStatus, demoStarted, selectedDatasetId]);

  const allFeedbackEvents = useMemo<UserFeedback[]>(() => {
    if (!selectedDatasetId) return [];
    if (feedbackBridge.mode === "live" && feedbackBridge.hydratedFeedback) {
      return feedbackBridge.hydratedFeedback;
    }
    return getFeedbackForDataset(selectedDatasetId);
  }, [selectedDatasetId, refreshToken, feedbackBridge.mode, feedbackBridge.hydratedFeedback]);

  const feedbackDecisions = useMemo<Record<string, "accept" | "reject" | "uncertain" | "correct">>(() => {
    const map: Record<string, "accept" | "reject" | "uncertain" | "correct"> = {};
    const sorted = [...allFeedbackEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of sorted) {
      map[event.candidateId] = event.userDecision;
    }
    return map;
  }, [allFeedbackEvents]);

  const liveViewModel = useMemo(() => {
    if (liveSession.mode !== "live" || !liveSession.graphSlice?.data_available || !liveSession.sessionId) {
      return null;
    }
    return buildLiveOmniaViewModel({
      sessionId: liveSession.sessionId,
      meta: liveSession.meta,
      graphSlice: liveSession.graphSlice,
      clusters: liveSession.clusters,
      candidates: liveSession.candidates,
      activeStep,
      selectedClusterId: selectedClusterId || null,
      selectedCandidateId: selectedCandidateId || null,
      feedbackDecisions,
    });
  }, [
    liveSession.mode,
    liveSession.sessionId,
    liveSession.meta,
    liveSession.graphSlice,
    liveSession.clusters,
    liveSession.candidates,
    activeStep,
    selectedClusterId,
    selectedCandidateId,
    feedbackDecisions,
  ]);

  const staticDataset = selectedDatasetId ? DATASETS[selectedDatasetId] : null;
  const isLiveMode = liveSession.mode === "live";
  const isLiveModeActive = Boolean(liveViewModel);
  const liveSessionId = liveSession.sessionId;
  const sessionDatasetId = useMemo(
    () => sampleIdToDemoDatasetId(liveSession.meta?.sample_id),
    [liveSession.meta?.sample_id],
  );

  const sliced = useMemo(() => {
    if (liveViewModel) {
      const gs = liveSession.graphSlice!;
      const result: SliceResult = {
        mode: activeSlice.mode,
        label: gs.label || "Backend session slice",
        isGuided: activeSlice.mode === "guided",
        nodes: [],
        edges: [],
        clusters: liveViewModel.clusters,
        clusterBoxes: [],
        candidates: liveViewModel.candidates,
        stats: {
          nodes: gs.stats?.nodes ?? liveViewModel.graph.displayed_nodes,
          edges: gs.stats?.edges ?? liveViewModel.graph.displayed_triples,
          clusters: gs.stats?.clusters ?? liveViewModel.clusters.length,
          candidates: gs.stats?.candidates ?? liveViewModel.candidates.length,
        },
      };
      return { dataset: liveViewModel.metadata, result };
    }
    if (!staticDataset) return null;
    return withSlicedGraph(staticDataset, activeSlice, allFeedbackEvents);
  }, [liveViewModel, staticDataset, activeSlice, allFeedbackEvents, liveSession.graphSlice]);

  const selectedDataset = sliced?.dataset ?? null;
  const sliceResult = sliced?.result ?? null;

  const feedbackEvents = allFeedbackEvents;

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

  const feedbackCandidates = useMemo<DemoCandidate[]>(
    () =>
      liveViewModel
        ? liveViewModel.candidates.filter(
            (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
          )
        : selectedDataset
          ? selectedDataset.candidates.filter(
              (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
            )
          : [],
    [liveViewModel, selectedDataset],
  );

  const allCandidates = liveViewModel?.candidates ?? selectedDataset?.candidates ?? [];

  const selectedCandidate: DemoCandidate | null = liveViewModel
    ? liveViewModel.selectedCandidate
    : allCandidates.find((candidate) => candidate.candidateId === selectedCandidateId) ?? null;

  const selectedCluster: DemoCluster | null = liveViewModel
    ? liveViewModel.selectedCluster
    : selectedDataset?.clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;

  const latestDecisionForSelected = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.userDecision ?? null
    : null;

  const interactiveGraphPayload = liveViewModel?.graph ?? null;

  const expandContext = useCallback(async () => {
    if (!liveSession.sessionId || liveSession.mode !== "live") return;
    setExpandContextPending(true);
    try {
      await liveSession.setSelectedSlice({
        mode: "guided",
        clusterId: selectedClusterId || liveSession.graphSlice?.selected_cluster?.cluster_id || null,
        candidateId: selectedCandidateId || liveSession.graphSlice?.selected_candidate?.candidate_id || null,
        limitNodes: 100,
        limitEdges: 150,
        expandContext: true,
      });
    } finally {
      setExpandContextPending(false);
    }
  }, [liveSession, selectedClusterId, selectedCandidateId]);

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
    setSelectedClusterId("");
    setSelectedCandidateId("");
    if (isBackendLoadable(datasetId)) {
      setDemoStarted(true);
      return;
    }
    setDemoStarted(true);
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
    if (datasetId === selectedDatasetId && liveSession.mode === "live") {
      await liveSession.recreateSession();
      return;
    }
    setSelectedDatasetId(datasetId);
  }, [liveSession, selectedDatasetId]);

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
          clusterId: slice.clusterId ?? (selectedClusterId || null),
          candidateId: selectedCandidateId || null,
          candidateStatus: slice.candidateStatus ?? null,
          feedbackBucket: slice.feedbackBucket ?? null,
          depth: slice.entityDepth ?? 1,
          limitNodes: 100,
          limitEdges: 150,
        });
      }
    },
    [liveSession, selectedClusterId, selectedCandidateId],
  );
  const resetSlice = useCallback(() => {
    setActiveSlice(GUIDED_SLICE);
    setGraphSelection(null);
    setSelectedClusterId("");
    setSelectedCandidateId("");
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

  useEffect(() => {
    if (!isLiveModeActive || !liveViewModel || !liveSession.graphSlice) return;

    const backendClusterId =
      liveSession.graphSlice.selected_cluster?.cluster_id ??
      liveViewModel.diagnostics.selectedClusterId ??
      "";

    const backendCandidateId =
      liveSession.graphSlice.selected_candidate?.candidate_id ??
      liveViewModel.diagnostics.selectedCandidateId ??
      "";

    const userPinnedCluster = activeSlice.mode === "cluster" && Boolean(activeSlice.clusterId);
    const userPinnedCandidate = activeSlice.mode === "candidate" && Boolean(selectedCandidateId);

    if (!userPinnedCluster && backendClusterId && selectedClusterId !== backendClusterId) {
      setSelectedClusterId(backendClusterId);
    }
    if (!userPinnedCandidate && backendCandidateId && selectedCandidateId !== backendCandidateId) {
      setSelectedCandidateId(backendCandidateId);
    }
  }, [
    isLiveModeActive,
    liveViewModel,
    liveSession.graphSlice?.slice_id,
    activeSlice.mode,
    activeSlice.clusterId,
    selectedClusterId,
    selectedCandidateId,
  ]);

  // One stable backend slice for the whole walkthrough — step changes only alter presentation.
  useEffect(() => {
    if (liveSession.mode !== "live" || !liveSession.sessionId || !demoStarted) return;
    if (activeStep === "completed" || activeStep === "feedback") return;
    if (liveSession.graphSlice?.data_available && liveSession.activeSlice.expandContext) return;

    void liveSession.applySlice({
      mode: "guided",
      clusterId: selectedClusterId || liveSession.graphSlice?.selected_cluster?.cluster_id || null,
      candidateId: selectedCandidateId || liveSession.graphSlice?.selected_candidate?.candidate_id || null,
      limitNodes: 100,
      limitEdges: 200,
      expandContext: true,
    });
  }, [
    liveSession.sessionId,
    liveSession.mode,
    demoStarted,
    liveSession.graphSlice?.data_available,
    liveSession.activeSlice.expandContext,
  ]);

  const stepExplanation = useMemo(
    () =>
      selectedDataset ? (
        <PaperDemoStepExplanation
          step={activeStep}
          dataset={selectedDataset}
          datasetId={selectedDataset.id}
          candidates={allCandidates}
          feedbackCandidates={feedbackCandidates}
          selectedCandidate={selectedCandidate}
          selectedCandidateId={selectedCandidate?.candidateId ?? selectedCandidateId}
          onSelectCandidate={setSelectedCandidateId}
          selectedClusterId={selectedCluster?.id ?? selectedClusterId}
          onSelectCluster={onSelectCluster}
          latestDecisionForSelected={latestDecisionForSelected}
          feedbackDecisions={feedbackDecisions}
          feedbackEvents={feedbackEvents}
          bridgeStatus={feedbackBridge.status}
          onFeedbackSubmit={onFeedbackSubmit}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={liveSessionId}
          filteringAvailable={liveViewModel?.filtering.available ?? !isLiveModeActive}
          llmAvailable={liveViewModel?.llm.available ?? !isLiveModeActive}
        />
      ) : null,
    [
      selectedDataset,
      activeStep,
      allCandidates,
      feedbackCandidates,
      selectedCandidate,
      selectedCandidateId,
      selectedCluster,
      selectedClusterId,
      latestDecisionForSelected,
      feedbackDecisions,
      feedbackEvents,
      feedbackBridge.status,
      interactiveGraphPayload,
      liveSessionId,
      isLiveModeActive,
      liveViewModel,
      onSelectCluster,
      onFeedbackSubmit,
    ],
  );

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
  // Landing screen — skipped when auto-loading a backend benchmark dataset
  // ──────────────────────────────────────────────────────────────────────
  const awaitingAutoLive =
    selectedDatasetId &&
    isBackendLoadable(selectedDatasetId) &&
    (liveSession.bindStatus === "checking" ||
      liveSession.bindStatus === "creating" ||
      liveSession.loading);

  if (awaitingAutoLive) {
    return (
      <div className="paper-demo min-h-screen bg-slate-50 p-6 text-slate-700" data-testid="paper-demo-root">
        <p className="text-sm">Loading CoDEx-M backend session…</p>
      </div>
    );
  }

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
    : "demo-layout grid items-start gap-4 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px]";

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
              liveDataset={isLiveModeActive ? liveViewModel?.metadata ?? null : null}
              sessionId={liveSessionId}
              onCreateSession={createSessionForDataset}
            />
            <section
              className={`rounded-lg border px-3 py-2 text-xs ${
                isLiveModeActive
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : isLiveMode
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-300 bg-slate-50 text-slate-800"
              }`}
              data-testid="graph-source-badge"
            >
              <p className="font-semibold">
                {isLiveModeActive
                  ? "Graph source: backend session slice"
                  : isLiveMode
                    ? "Live session loading — no static fallback"
                    : "Graph source: static demo"}
              </p>
              {isLiveMode && liveSession.meta ? (
                <p className="mt-0.5 truncate text-[11px] opacity-90">
                  {liveSession.meta.dataset_name}
                  {liveSessionId ? ` · session ${liveSessionId.slice(0, 8)}…` : ""}
                </p>
              ) : null}
              {isLiveMode && liveSessionId ? (
                <button
                  type="button"
                  onClick={() => void liveSession.recreateSession()}
                  className="mt-1 rounded border border-emerald-500 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900"
                  data-testid="recreate-backend-session"
                >
                  Recreate backend session
                </button>
              ) : null}
              {isLiveMode && liveSession.error ? (
                <p className="mt-1 text-[10px] text-amber-900">Warning: {liveSession.error}</p>
              ) : null}
              {isLiveMode && liveSession.loading ? (
                <p className="mt-1 text-[10px]">Loading backend slice…</p>
              ) : null}
            </section>
            {liveViewModel?.diagnostics ? (
              <section
                className={`rounded-lg border px-3 py-2 text-[10px] ${
                  liveViewModel.diagnostics.mismatch
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
                data-testid="live-diagnostics-panel"
              >
                <p className="font-semibold">Selection diagnostics</p>
                <p>Selected cluster: {liveViewModel.diagnostics.selectedClusterId ?? "none"}</p>
                <p>Selected candidate: {liveViewModel.diagnostics.selectedCandidateId ?? "none"}</p>
                <p>Candidate source cluster: {liveViewModel.diagnostics.candidateSourceCluster ?? "none"}</p>
                <p>Mismatch: {liveViewModel.diagnostics.mismatch ? "true" : "false"}</p>
                {liveViewModel.diagnostics.mismatch ? (
                  <p className="mt-1 font-semibold text-rose-800">
                    Selected candidate does not belong to selected cluster.
                  </p>
                ) : null}
              </section>
            ) : null}
            {selectedDataset && sliceResult ? (
              <GraphSliceSummaryCard
                result={sliceResult}
                totals={{
                  nodes: liveViewModel?.graph.displayed_nodes ?? selectedDataset.graph.nodes.length,
                  edges: liveViewModel?.graph.displayed_triples ?? selectedDataset.graph.edges.length,
                  clusters: liveViewModel?.clusters.length ?? selectedDataset.clusters.length,
                  candidates: liveViewModel?.candidates.length ?? selectedDataset.candidates.length,
                }}
                onReset={resetSlice}
              />
            ) : null}
            {selectedDataset ? (
              <DatasetNavigatorPanel
                dataset={selectedDataset}
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
            <PaperDemoStepView
              step={activeStep}
              dataset={selectedDataset}
              datasetId={selectedDataset.id}
              candidates={allCandidates}
              feedbackCandidates={feedbackCandidates}
              selectedCandidate={selectedCandidate}
              selectedCandidateId={selectedCandidate?.candidateId ?? selectedCandidateId}
              onSelectCandidate={setSelectedCandidateId}
              selectedClusterId={selectedCluster?.id ?? selectedClusterId}
              onSelectCluster={onSelectCluster}
              latestDecisionForSelected={latestDecisionForSelected}
              feedbackDecisions={feedbackDecisions}
              feedbackEvents={feedbackEvents}
              bridgeStatus={feedbackBridge.status}
              onFeedbackSubmit={onFeedbackSubmit}
              interactiveGraphPayload={interactiveGraphPayload}
              sessionId={liveSessionId}
              onGraphSelectionChange={setGraphSelection}
              useStaticPaperGraph={!isLiveModeActive && activeSlice.mode === "guided"}
              filteringAvailable={liveViewModel?.filtering.available ?? !isLiveModeActive}
              llmAvailable={liveViewModel?.llm.available ?? !isLiveModeActive}
              onExpandContext={isLiveModeActive ? () => void expandContext() : undefined}
              expandContextPending={expandContextPending}
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
            <aside className="right-panel min-w-0">
              <PaperDemoInspectorPanel
                step={activeStep}
                dataset={selectedDataset}
                graph={interactiveGraphPayload}
                selection={graphSelection}
                selectedCandidate={selectedCandidate}
                selectedCluster={selectedCluster}
                candidates={allCandidates}
                clusters={selectedDataset.clusters}
                sessionId={liveSessionId}
                onShowCandidatesForNode={onShowCandidatesForNode}
                feedbackSummary={feedbackSummary}
                completedSummary={completedStatsSummary}
                backendDiagnostics={feedbackBridge.completedSummary}
                filteringAvailable={liveViewModel?.filtering.available ?? !isLiveModeActive}
                llmAvailable={liveViewModel?.llm.available ?? !isLiveModeActive}
                stepExplanation={stepExplanation}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
