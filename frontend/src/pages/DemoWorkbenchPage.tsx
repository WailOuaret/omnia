import { useCallback, useEffect, useMemo, useState } from "react";
import { DemoCandidatePanel } from "../components/demo/DemoCandidatePanel";
import { DemoExplanationPanel } from "../components/demo/DemoExplanationPanel";
import { DemoGraphWorkbench } from "../components/demo/DemoGraphWorkbench";
import { DemoMetricsBar } from "../components/demo/DemoMetricsBar";
import { DemoStepRail } from "../components/demo/DemoStepRail";
import { DEMO_STEPS, type DemoStepId, type WorkspaceTab } from "../components/demo/demoSteps";
import {
  buildAfterKgGraph,
  buildBeforeKgGraph,
  buildMissingKgGraph,
  tripleKey,
} from "../components/demo/demoGraphBuilders";
import { ClusterEvidenceDiagram } from "../components/demo/ClusterEvidenceDiagram";
import { BeforeAfterGraphCompare } from "../components/demo/BeforeAfterGraphCompare";
import { MissingTriplesView } from "../components/demo/MissingTriplesView";
import { DemoFilteringHistogram } from "../components/demo/DemoFilteringHistogram";
import { DemoLegend } from "../components/demo/DemoLegend";
import { DemoShell } from "../components/demo/DemoShell";
import { DemoSessionPicker } from "../components/demo/DemoSessionPicker";
import { DemoFooterCaptions } from "../components/demo/DemoFooterCaptions";
import { api } from "../lib/api";
import { useApiData } from "../lib/hooks";
import { useSessionStore } from "../store/session";
import type {
  CandidateRecord,
  ClusterSummary,
  GraphPayload,
  TripleRecord,
} from "../types";

function asTriples(value: unknown): TripleRecord[] {
  if (!Array.isArray(value)) return [];
  return value as TripleRecord[];
}

function mergeCandidateRows(
  base: CandidateRecord[],
  enriched: CandidateRecord[],
): CandidateRecord[] {
  const map = new Map(enriched.map((row) => [tripleKey(row), row]));
  return base.map((row) => ({ ...row, ...(map.get(tripleKey(row)) ?? {}) }));
}

function parseClusterKey(key?: string): { relation?: string; tail?: string } {
  if (!key) return {};
  const tab = key.indexOf("\t");
  if (tab === -1) return { relation: key };
  return { relation: key.slice(0, tab).trim(), tail: key.slice(tab + 1).trim() };
}

function useNarrowDemoLayout(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

export function DemoWorkbenchPage() {
  const session = useSessionStore((s) => s.session);
  const demoConfig = useSessionStore((s) => s.demoConfig);
  const [stepId, setStepId] = useState<DemoStepId>("before");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("before");
  const [selected, setSelected] = useState<CandidateRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const sessionId = session?.session_id ?? "";

  const candidatesQuery = useApiData(
    () => api.getCandidates(sessionId),
    [sessionId, refreshKey],
    Boolean(sessionId),
  );
  const completedQuery = useApiData(
    () => api.getCompleted(sessionId),
    [sessionId, refreshKey],
    Boolean(sessionId),
  );
  const clustersQuery = useApiData(
    () => api.getClusters(sessionId),
    [sessionId, refreshKey],
    Boolean(sessionId),
  );

  const knownTriples = useMemo(
    () =>
      asTriples(
        completedQuery.data?.original_graph
          ? (completedQuery.data.original_graph as Record<string, unknown>).triples
          : undefined,
      ),
    [completedQuery.data],
  );

  const mergedCandidates = useMemo(() => {
    const raw = (candidatesQuery.data?.candidates ?? []) as CandidateRecord[];
    const additions = (completedQuery.data?.additions ?? []) as CandidateRecord[];
    const rejected = (completedQuery.data?.rejected ?? []) as CandidateRecord[];
    const unresolved = (completedQuery.data?.unresolved ?? []) as CandidateRecord[];
    return mergeCandidateRows(raw, [...additions, ...rejected, ...unresolved]);
  }, [candidatesQuery.data, completedQuery.data]);

  const clusters = useMemo(() => {
    const payload = clustersQuery.data?.clusters;
    return Array.isArray(payload) ? (payload as ClusterSummary[]) : [];
  }, [clustersQuery.data]);

  const activeCluster = useMemo(() => {
    if (!selected?.cluster_ids?.length) return null;
    const wanted = selected.cluster_ids[0];
    return clusters.find((c) => c.cluster_id === wanted) ?? null;
  }, [clusters, selected]);

  const completedSummary = completedQuery.data?.summary as
    | Record<string, number>
    | undefined;
  const filteringThreshold =
    typeof selected?.threshold === "number"
      ? (selected.threshold as number)
      : (completedSummary?.threshold as number | undefined);

  const summaryMetrics = useMemo(() => {
    const knownNum = knownTriples.length || Number(session?.diagnostics?.triple_count) || 0;
    const diagMissing = session?.diagnostics?.missing_triples;
    let missingNum = typeof diagMissing === "number" ? diagMissing : 0;
    if (!missingNum && session?.holdout_mode) {
      missingNum = Math.max(
        1,
        Math.round(knownNum * (1 - (session?.sample_proportion ?? 0.8))),
      );
    }
    return {
      known: knownNum,
      missing: missingNum,
      candidates: mergedCandidates.length,
      recovered: completedSummary?.recovered_true_missing,
      accepted: completedSummary?.accepted_additions,
      rejected: completedSummary?.rejected_candidates,
    };
  }, [knownTriples.length, mergedCandidates.length, completedSummary, session]);

  const graphCaption = useMemo(() => {
    const meta = DEMO_STEPS.find((s) => s.workspaceTab === workspaceTab);
    return meta?.caption ?? "";
  }, [workspaceTab]);

  const additions = useMemo(
    () => (completedQuery.data?.additions ?? []) as CandidateRecord[],
    [completedQuery.data],
  );

  const beforeGraph = useMemo<GraphPayload | null>(
    () => (knownTriples.length ? buildBeforeKgGraph(knownTriples) : null),
    [knownTriples],
  );

  const missingGraph = useMemo<GraphPayload | null>(
    () =>
      knownTriples.length && selected
        ? buildMissingKgGraph(knownTriples, selected, { dimOriginal: true })
        : null,
    [knownTriples, selected],
  );

  const afterGraph = useMemo<GraphPayload | null>(
    () => (knownTriples.length ? buildAfterKgGraph(knownTriples, additions) : null),
    [knownTriples, additions],
  );

  const graphPayload: GraphPayload | null = useMemo(() => {
    if (!knownTriples.length) return null;
    switch (workspaceTab) {
      case "before":
        return beforeGraph;
      case "missing":
      case "filter":
      case "validation":
      case "cluster":
        return missingGraph ?? beforeGraph;
      case "after":
        return afterGraph;
      case "diff":
        return beforeGraph;
      default:
        return beforeGraph;
    }
  }, [afterGraph, beforeGraph, knownTriples.length, missingGraph, workspaceTab]);

  const syncStepToTab = useCallback((id: DemoStepId) => {
    setStepId(id);
    const step = DEMO_STEPS.find((item) => item.id === id);
    if (step) setWorkspaceTab(step.workspaceTab);
  }, []);

  const handleWorkspaceTab = useCallback((tab: WorkspaceTab) => {
    setWorkspaceTab(tab);
    const step = DEMO_STEPS.find((item) => item.workspaceTab === tab);
    if (step) setStepId(step.id);
  }, []);

  useEffect(() => {
    if (!mergedCandidates.length) {
      setSelected(null);
      return;
    }
    if (
      !selected ||
      !mergedCandidates.some((r) => tripleKey(r) === tripleKey(selected as CandidateRecord))
    ) {
      setSelected(mergedCandidates[0]);
    }
  }, [mergedCandidates, selected]);

  const runPipelineBundle = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({
        format: demoConfig.format,
        strategy: demoConfig.strategy,
        top_k: String(demoConfig.topK),
        max_candidates: String(demoConfig.maxCandidates),
        filtering_enabled: String(demoConfig.filteringEnabled),
        preferred_device: demoConfig.preferredDevice ?? "cuda",
        force_mock: String(demoConfig.forceMock),
      });
      await api.runPipeline(sessionId, params);
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }, [demoConfig, sessionId]);

  const sendRefinement = useCallback(
    async (decision: "accept" | "reject", _comment?: string) => {
      if (!sessionId || !selected) return;
      setBusy(true);
      try {
        await api.postDemoRefinement(sessionId, {
          Head: selected.Head,
          Relation: selected.Relation,
          Tail: selected.Tail,
          decision,
        });
        setRefreshKey((k) => k + 1);
      } finally {
        setBusy(false);
      }
    },
    [selected, sessionId],
  );

  const mockHint = Boolean(selected?.is_mock);
  const narrow = useNarrowDemoLayout();

  const clusterEvidence = useMemo(() => {
    if (!selected) return null;
    if (activeCluster) {
      return {
        relation: activeCluster.display_relation ?? activeCluster.relation,
        tail: activeCluster.display_tail ?? activeCluster.tail,
        heads: activeCluster.display_heads ?? activeCluster.heads,
        clusterKey: activeCluster.cluster_key_display ?? activeCluster.cluster_key,
        weakHint: activeCluster.warning ?? null,
      };
    }
    const keyStr = selected.cluster_keys?.[0];
    const parsed = parseClusterKey(keyStr);
    const heads = selected.source_heads ?? [];
    if (!heads.length && !parsed.relation && !parsed.tail) return null;
    return {
      relation: parsed.relation ?? selected.DisplayRelation ?? selected.Relation,
      tail: parsed.tail ?? selected.DisplayTail ?? selected.Tail,
      heads,
      clusterKey: keyStr,
      weakHint:
        heads.length >= 2
          ? null
          : "Sparse cluster motif — propagation signal is weaker for this triple.",
    };
  }, [activeCluster, selected]);

  if (!session) {
    return <DemoSessionPicker />;
  }

  const stepCaption = DEMO_STEPS.find((s) => s.id === stepId)?.caption;
  const filteringRows = mergedCandidates.filter(
    (row) => typeof row.distance === "number",
  );

  const graphArea = (
    <>
      {workspaceTab === "cluster" && selected && clusterEvidence ? (
        <ClusterEvidenceDiagram
          relation={clusterEvidence.relation}
          tail={clusterEvidence.tail}
          heads={clusterEvidence.heads}
          candidate={{
            head: selected.DisplayHead ?? selected.Head,
            relation: selected.DisplayRelation ?? selected.Relation,
            tail: selected.DisplayTail ?? selected.Tail,
          }}
          clusterKey={clusterEvidence.clusterKey}
          weakHint={clusterEvidence.weakHint}
        />
      ) : null}
      {workspaceTab === "cluster" && selected && !clusterEvidence ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cluster provenance will appear here after pipeline clustering. Use the pipeline step if
          this session was only ingested.
        </div>
      ) : null}

      {workspaceTab === "diff" ? (
        <BeforeAfterGraphCompare
          before={beforeGraph}
          after={afterGraph}
          selectedCandidate={selected}
        />
      ) : (
        <DemoGraphWorkbench
          caption={graphCaption}
          activeTab={workspaceTab}
          onTabChange={handleWorkspaceTab}
          graphPayload={
            workspaceTab === "cluster" || workspaceTab === "missing" ? null : graphPayload
          }
        />
      )}

      {workspaceTab === "missing" ? (
        <MissingTriplesView
          graph={missingGraph}
          selected={selected}
          holdoutMode={Boolean(session.holdout_mode)}
        />
      ) : null}

      {workspaceTab === "filter" ? (
        <DemoFilteringHistogram
          rows={filteringRows}
          threshold={filteringThreshold}
          selected={selected}
        />
      ) : null}

      <DemoLegend
        statuses={
          workspaceTab === "missing"
            ? ["original", "generated", "missing", "selected"]
            : workspaceTab === "filter"
              ? ["filtered_passed", "filtered_rejected", "selected", "unresolved"]
              : workspaceTab === "validation"
                ? ["llm_accepted", "llm_rejected", "selected", "unresolved"]
                : workspaceTab === "after" || workspaceTab === "diff"
                  ? ["original", "llm_accepted", "selected"]
                  : ["original", "generated", "selected"]
        }
        compact
      />
    </>
  );

  const rightPanel = (
    <>
      <DemoCandidatePanel
        rows={mergedCandidates}
        selected={selected}
        onSelect={setSelected}
      />
      <DemoExplanationPanel
        candidate={selected}
        busy={busy}
        mockHint={mockHint}
        onAccept={(comment) => sendRefinement("accept", comment)}
        onReject={(comment) => sendRefinement("reject", comment)}
      />
    </>
  );

  return (
    <DemoShell
      busy={busy || candidatesQuery.loading || completedQuery.loading}
      onRunPipeline={runPipelineBundle}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      metricsBar={
        <DemoMetricsBar
          datasetName={session.dataset_name}
          counts={summaryMetrics}
          selectedCandidate={selected}
        />
      }
      stepRail={
        <DemoStepRail
          steps={DEMO_STEPS}
          activeId={stepId}
          collapsed={narrow}
          onSelect={(id) => syncStepToTab(id)}
        />
      }
      graphArea={graphArea}
      rightPanel={rightPanel}
      caption={
        <div className="space-y-3">
          {stepCaption ? (
            <p>
              <span className="font-semibold text-slate-800">Audience caption:&nbsp;</span>
              {stepCaption}
            </p>
          ) : null}
          <DemoFooterCaptions />
        </div>
      }
    />
  );
}
