import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatasetNavigatorPanel } from "../components/paper-demo/DatasetNavigatorPanel";
import { DatasetSelectorPanel } from "../components/paper-demo/DatasetSelectorPanel";
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
import { usePaperDemoScenario } from "../hooks/usePaperDemoScenario";
import { isBackendLoadable, usePaperDemoSession } from "../hooks/usePaperDemoSession";
import { api, exportCompletedTsvUrl, exportFeedbackJsonUrl } from "../lib/api";
import { getDemoMode } from "../lib/demoMode";
import { SCENARIO_FILES } from "../types/scenario";
import {
  GUIDED_SLICE,
  withSlicedGraph,
  type DatasetSlice,
  type SliceResult,
} from "../lib/datasetSlice";
import { buildLiveOmniaViewModel } from "../lib/buildLiveOmniaViewModel";
import { graphViewLabelForStep } from "../lib/graphDisplayMode";
import {
  defaultGraphViewModeForStep,
  type GraphViewMode,
  type InspectorListPanel,
} from "../lib/graphViewMode";
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
  const deploymentMode = getDemoMode();
  const enableLiveSession = deploymentMode === "live" || deploymentMode === "auto";
  const enableScenario = deploymentMode === "static" || deploymentMode === "auto";

  const [selectedDatasetId, setSelectedDatasetId] = useState<DemoDatasetId | null>(readInitialDatasetId);
  const [activeStep, setActiveStep] = useState<PaperDemoStepId>("kg");
  const [demoStarted, setDemoStarted] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [graphSelection, setGraphSelection] = useState<GraphSelection>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeSlice, setActiveSlice] = useState<DatasetSlice>(GUIDED_SLICE);
  const [graphFocusRequest, setGraphFocusRequest] = useState(0);
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>("explore");
  const [inspectorListPanel, setInspectorListPanel] = useState<InspectorListPanel>(null);
  const [expandContextPending, setExpandContextPending] = useState(false);
  const liveSession = usePaperDemoSession(enableLiveSession ? selectedDatasetId : null);
  const scenarioSession = usePaperDemoScenario(selectedDatasetId, {
    enabled: enableScenario,
    activeStep,
    selectedClusterId: selectedClusterId || null,
    selectedCandidateId: selectedCandidateId || null,
  });
  const feedbackBridge = useFeedbackBridge(
    selectedDatasetId,
    enableLiveSession ? liveSession.sessionId : null,
  );
  const syncedLiveSliceRef = useRef(false);

  // In live mode, bind the feedback/localStorage key to the backend session's sample.
  useEffect(() => {
    if (liveSession.mode !== "live" || !liveSession.meta?.sample_id) return;
    const mapped = sampleIdToDemoDatasetId(liveSession.meta.sample_id);
    if (mapped && mapped !== selectedDatasetId) {
      setSelectedDatasetId(mapped);
    }
  }, [liveSession.mode, liveSession.meta?.sample_id, selectedDatasetId]);

  useEffect(() => {
    setGraphViewMode(defaultGraphViewModeForStep(activeStep));
    setInspectorListPanel(null);
  }, [activeStep]);

  // ── Restore slice selection from backend session metadata once on load.
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
    if (!enableLiveSession || liveSession.mode !== "live" || !liveSession.graphSlice?.data_available || !liveSession.sessionId) {
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

  const hasScenarioFile = Boolean(selectedDatasetId && SCENARIO_FILES[selectedDatasetId]);

  const scenarioViewModel = useMemo(() => {
    if (!enableScenario || liveViewModel) return null;
    if (deploymentMode === "auto" && liveSession.loading) return null;
    if (
      deploymentMode === "auto" &&
      liveSession.mode === "live" &&
      liveSession.bindStatus === "ready"
    ) {
      return null;
    }
    return scenarioSession.viewModel;
  }, [
    enableScenario,
    liveViewModel,
    deploymentMode,
    liveSession.loading,
    liveSession.mode,
    liveSession.bindStatus,
    scenarioSession.viewModel,
  ]);

  const activeViewModel = liveViewModel ?? scenarioViewModel;

  const staticDataset = selectedDatasetId ? DATASETS[selectedDatasetId] : null;
  const isLiveMode = enableLiveSession && liveSession.mode === "live";
  const isScenarioModeActive = Boolean(scenarioViewModel);
  const isLiveModeActive = Boolean(liveViewModel);
  const isInteractiveModeActive = isLiveModeActive || isScenarioModeActive;
  const liveSessionId = liveSession.sessionId;
  const sessionDatasetId = useMemo(
    () => sampleIdToDemoDatasetId(liveSession.meta?.sample_id),
    [liveSession.meta?.sample_id],
  );

  const sliced = useMemo(() => {
    if (activeViewModel) {
      const gs =
        liveViewModel && liveSession.graphSlice
          ? liveSession.graphSlice
          : {
              label: activeViewModel.metadata.label,
              stats: {
                nodes: activeViewModel.graph.displayed_nodes,
                edges: activeViewModel.graph.displayed_triples,
                clusters: activeViewModel.clusters.length,
                candidates: activeViewModel.candidates.length,
              },
            };
      const result: SliceResult = {
        mode: activeSlice.mode,
        label: graphViewLabelForStep(activeStep),
        isGuided: activeSlice.mode === "guided",
        nodes: [],
        edges: [],
        clusters: activeViewModel.clusters,
        clusterBoxes: [],
        candidates: activeViewModel.candidates,
        stats: {
          nodes: gs.stats?.nodes ?? activeViewModel.graph.displayed_nodes,
          edges: gs.stats?.edges ?? activeViewModel.graph.displayed_triples,
          clusters: gs.stats?.clusters ?? activeViewModel.clusters.length,
          candidates: gs.stats?.candidates ?? activeViewModel.candidates.length,
        },
      };
      return { dataset: activeViewModel.metadata, result };
    }
    if (enableScenario && hasScenarioFile) {
      return null;
    }
    if (!staticDataset) return null;
    return withSlicedGraph(staticDataset, activeSlice, allFeedbackEvents);
  }, [
    activeViewModel,
    liveViewModel,
    liveSession.graphSlice,
    staticDataset,
    activeSlice,
    allFeedbackEvents,
    activeStep,
    enableScenario,
    hasScenarioFile,
  ]);

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
      activeViewModel
        ? activeViewModel.candidates.filter(
            (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
          )
        : selectedDataset
          ? selectedDataset.candidates.filter(
              (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
            )
          : [],
    [activeViewModel, selectedDataset],
  );

  const allCandidates =
    activeViewModel?.metadata.candidates ??
    activeViewModel?.candidates ??
    selectedDataset?.candidates ??
    [];

  const selectedCandidate: DemoCandidate | null = activeViewModel
    ? activeViewModel.selectedCandidate
    : allCandidates.find((candidate) => candidate.candidateId === selectedCandidateId) ?? null;

  const selectedCluster: DemoCluster | null = activeViewModel
    ? activeViewModel.selectedCluster
    : selectedDataset?.clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;

  const latestDecisionForSelected = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.userDecision ?? null
    : null;

  const interactiveGraphPayload = activeViewModel?.graph ?? null;

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
    setGraphViewMode(defaultGraphViewModeForStep(activeStep));
    setInspectorListPanel(null);
    setSelectedClusterId("");
    setSelectedCandidateId("");
    if (liveSession.mode === "live") {
      void liveSession.setSelectedSlice({ mode: "guided" });
    }
  }, [liveSession, activeStep]);

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
    if (isScenarioModeActive) {
      scenarioSession.submitFeedbackDecision(feedback);
    } else {
      await feedbackBridge.submit(feedback);
    }
    setRefreshToken((value) => value + 1);
    if (liveSession.mode === "live") {
      void liveSession.refresh();
    }
  };

  useEffect(() => {
    if (!isScenarioModeActive || !scenarioViewModel) return;
    const clusterId = scenarioViewModel.diagnostics.selectedClusterId;
    const candidateId = scenarioViewModel.diagnostics.selectedCandidateId;
    if (!selectedClusterId && clusterId) setSelectedClusterId(clusterId);
    if (!selectedCandidateId && candidateId) setSelectedCandidateId(candidateId);
  }, [
    isScenarioModeActive,
    scenarioViewModel,
    selectedClusterId,
    selectedCandidateId,
  ]);

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
          filteringAvailable={activeViewModel?.filtering.available ?? !isInteractiveModeActive}
          llmAvailable={activeViewModel?.llm.available ?? !isInteractiveModeActive}
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
    enableLiveSession &&
    selectedDatasetId &&
    isBackendLoadable(selectedDatasetId) &&
    (liveSession.bindStatus === "checking" ||
      liveSession.bindStatus === "creating" ||
      liveSession.loading);

  const awaitingStaticScenario =
    enableScenario &&
    hasScenarioFile &&
    !activeViewModel &&
    (scenarioSession.status === "idle" ||
      scenarioSession.status === "loading" ||
      (deploymentMode === "auto" && liveSession.loading));

  if (awaitingAutoLive) {
    return (
      <div className="paper-demo min-h-screen bg-slate-50 p-6 text-slate-700" data-testid="paper-demo-root">
        <p className="text-sm">Loading CoDEx-M graph sample...</p>
      </div>
    );
  }

  if (awaitingStaticScenario) {
    return (
      <div className="paper-demo min-h-screen bg-slate-50 p-6 text-slate-700" data-testid="paper-demo-root">
        <p className="text-sm">Loading prepared interactive sample…</p>
      </div>
    );
  }

  if (scenarioSession.status === "error" && enableScenario && hasScenarioFile && !activeViewModel) {
    return (
      <div className="paper-demo min-h-screen bg-slate-50 p-6 text-slate-700" data-testid="paper-demo-root">
        <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-900">
          <p className="font-semibold">Prepared sample could not be loaded</p>
          <p className="mt-2">{scenarioSession.error ?? "unknown error"}</p>
          <p className="mt-2 text-xs text-slate-600">
            Redeploy the frontend so <code className="font-mono">frontend/public/demo-scenarios/</code> is
            included in the build output.
          </p>
        </div>
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
          <p className="text-sm">Loading graph sample...</p>
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
          isScenarioMode={isScenarioModeActive}
          onPrev={goPrev}
          onNext={goNext}
          onResetToLanding={resetToLanding}
        />

        <div className={layoutGridClass}>
          <aside className="space-y-3 min-w-0">
            <DatasetSelectorPanel
              selectedDatasetId={activeDatasetId}
              onSelect={onDatasetChange}
              isLiveMode={isLiveMode && !isScenarioModeActive}
              isStaticScenarioMode={isScenarioModeActive || deploymentMode === "static"}
              sessionDatasetId={sessionDatasetId}
              liveDataset={isLiveModeActive ? activeViewModel?.metadata ?? null : null}
              sessionId={isScenarioModeActive ? null : liveSessionId}
              onCreateSession={deploymentMode === "static" ? undefined : createSessionForDataset}
            />
            {selectedDataset ? (
              <DatasetNavigatorPanel
                dataset={selectedDataset}
                activeSlice={activeSlice}
                activeStep={activeStep}
                onApply={applySlice}
                onReset={resetSlice}
                sessionId={isScenarioModeActive ? null : liveSessionId}
                isLiveMode={isLiveMode && !isScenarioModeActive}
                backendClusters={liveSession.clusters.map((c) => ({
                  cluster_id: c.cluster_id,
                  shared_relation: c.shared_relation,
                  shared_tail: c.shared_tail,
                }))}
                onFocusGraph={() => setGraphFocusRequest((n) => n + 1)}
                onResetGuidedView={() => {
                  setGraphViewMode(defaultGraphViewModeForStep(activeStep));
                  setInspectorListPanel(null);
                }}
              />
            ) : null}
            <WorkflowStepMenu activeStep={activeStep} onStepChange={(s) => setActiveStep(s as PaperDemoStepId)} />
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
              sessionId={isScenarioModeActive ? null : liveSessionId}
              onGraphSelectionChange={setGraphSelection}
              useStaticPaperGraph={!isInteractiveModeActive && activeSlice.mode === "guided"}
              filteringAvailable={activeViewModel?.filtering.available ?? !isInteractiveModeActive}
              llmAvailable={activeViewModel?.llm.available ?? !isInteractiveModeActive}
              onExpandContext={isLiveModeActive ? () => void expandContext() : undefined}
              expandContextPending={expandContextPending}
              graphFocusRequest={graphFocusRequest}
              graphViewMode={graphViewMode}
              onGraphViewModeChange={setGraphViewMode}
              onShowAllMembers={() => setInspectorListPanel("members")}
              onShowAllCandidates={() => setInspectorListPanel("candidates")}
            />

            {isCompleted ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Exports &amp; summary</h3>
                  <div className="text-[11px] text-slate-600">
                    {feedbackBridge.mode === "live"
                      ? "Live sample exports include feedback, completed KG, and diff data."
                      : "Prepared sample exports are derived from local feedback."}
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
                        ? "Live OMNIA session"
                        : "Local feedback history"}
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
                sessionId={isScenarioModeActive ? null : liveSessionId}
                onShowCandidatesForNode={onShowCandidatesForNode}
                feedbackSummary={feedbackSummary}
                completedSummary={completedStatsSummary}
                backendDiagnostics={feedbackBridge.completedSummary}
                liveDiagnostics={liveViewModel?.diagnostics ?? null}
                scenarioLimitations={scenarioViewModel?.limitations ?? []}
                filteringAvailable={activeViewModel?.filtering.available ?? !isInteractiveModeActive}
                llmAvailable={activeViewModel?.llm.available ?? !isInteractiveModeActive}
                stepExplanation={stepExplanation}
                inspectorListPanel={inspectorListPanel}
                onInspectorListPanelChange={setInspectorListPanel}
                onSelectCandidate={setSelectedCandidateId}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
