import { useEffect, useState } from "react";
import type { DemoDatasetConfig } from "../../demo-data/types";
import {
  GUIDED_SLICE,
  listEntities,
  listRelations,
  type CandidateStatusFilter,
  type DatasetSlice,
  type FeedbackBucket,
  type SliceMode,
} from "../../lib/datasetSlice";
import { api } from "../../lib/api";
import { sliceModeForWorkflowStep, sliceModesVisibleForStep } from "../../lib/graphDisplayMode";

interface DatasetNavigatorPanelProps {
  dataset: DemoDatasetConfig;
  activeSlice: DatasetSlice;
  activeStep?: string;
  onApply: (slice: DatasetSlice) => void;
  onReset: () => void;
  sessionId?: string | null;
  isLiveMode?: boolean;
  backendClusters?: Array<{ cluster_id: string; shared_relation: string; shared_tail: string }>;
  onFocusGraph?: () => void;
  onResetGuidedView?: () => void;
}

const MODE_OPTIONS: Array<{ id: SliceMode; label: string }> = [
  { id: "guided", label: "Guided view" },
  { id: "entity", label: "Explore around an entity" },
  { id: "relation", label: "Explore by relation" },
  { id: "cluster", label: "Explore by cluster" },
  { id: "candidate", label: "View proposed triples" },
  { id: "feedback", label: "View feedback results" },
];

const CANDIDATE_STATUS_OPTIONS: Array<{ id: CandidateStatusFilter; label: string }> = [
  { id: "any", label: "Any" },
  { id: "candidate", label: "Generated" },
  { id: "kept", label: "Kept by filtering" },
  { id: "removed", label: "Removed by filtering" },
  { id: "llm_valid", label: "LLM says valid" },
  { id: "llm_invalid", label: "LLM says invalid" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

const FEEDBACK_BUCKET_OPTIONS: Array<{ id: FeedbackBucket; label: string }> = [
  { id: "any", label: "Any feedback" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "reviewQueue", label: "Needs review" },
  { id: "uncertain", label: "Uncertain" },
  { id: "corrected", label: "Corrected" },
];

export function DatasetNavigatorPanel({
  dataset,
  activeSlice,
  activeStep = "kg",
  onApply,
  onReset,
  sessionId = null,
  isLiveMode = false,
  backendClusters = [],
  onFocusGraph,
  onResetGuidedView,
}: DatasetNavigatorPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visibleModes = sliceModesVisibleForStep(activeStep);
  const modeOptions = MODE_OPTIONS.filter((option) => visibleModes.includes(option.id));

  const [mode, setMode] = useState<SliceMode>(activeSlice.mode);
  const [entityQuery, setEntityQuery] = useState<string>(activeSlice.entityQuery ?? "");
  const [relationQuery, setRelationQuery] = useState<string>(activeSlice.relationQuery ?? "");
  const [clusterId, setClusterId] = useState<string>(
    activeSlice.clusterId ?? backendClusters[0]?.cluster_id ?? dataset.clusters[0]?.id ?? "",
  );
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatusFilter>(
    activeSlice.candidateStatus ?? "any",
  );
  const [feedbackBucket, setFeedbackBucket] = useState<FeedbackBucket>(
    activeSlice.feedbackBucket ?? "any",
  );
  const [backendEntitySuggestions, setBackendEntitySuggestions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [backendRelationSuggestions, setBackendRelationSuggestions] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    const nextMode = visibleModes.includes(activeSlice.mode)
      ? activeSlice.mode
      : sliceModeForWorkflowStep(activeStep);
    setMode(nextMode);
  }, [activeStep, activeSlice.mode, visibleModes]);

  const apply = () => {
    const slice: DatasetSlice = { mode };
    if (mode === "entity" && entityQuery.trim()) slice.entityQuery = entityQuery.trim();
    if (mode === "relation" && relationQuery.trim()) slice.relationQuery = relationQuery.trim();
    if (mode === "cluster" && clusterId) slice.clusterId = clusterId;
    if (mode === "candidate") slice.candidateStatus = candidateStatus;
    if (mode === "feedback") slice.feedbackBucket = feedbackBucket;
    onApply(slice);
  };

  const reset = () => {
    setMode("guided");
    setEntityQuery("");
    setRelationQuery("");
    setClusterId(dataset.clusters[0]?.id ?? "");
    setCandidateStatus("any");
    setFeedbackBucket("any");
    onResetGuidedView?.();
    onReset();
  };

  useEffect(() => {
    if (!isLiveMode || !sessionId || mode !== "entity") return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      api
        .listSessionEntities(sessionId, entityQuery, 8)
        .then((resp) => {
          if (cancelled) return;
          const rows = resp?.entities ?? [];
          const normalised = (rows as Array<string | { id: string; label?: string }>).map((row) =>
            typeof row === "string" ? { id: row, label: row } : { id: row.id, label: row.label ?? row.id },
          );
          setBackendEntitySuggestions(normalised);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [isLiveMode, sessionId, mode, entityQuery]);

  useEffect(() => {
    if (!isLiveMode || !sessionId || mode !== "relation") return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      api
        .listSessionRelations(sessionId, relationQuery, 8)
        .then((resp) => {
          if (cancelled) return;
          setBackendRelationSuggestions((resp?.relations ?? []).map((row) => ({ id: row.id, label: row.label })));
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [isLiveMode, sessionId, mode, relationQuery]);

  const entitySuggestions = isLiveMode
    ? backendEntitySuggestions
    : listEntities(dataset, entityQuery, 6);
  const relationSuggestions = isLiveMode
    ? backendRelationSuggestions
    : listRelations(dataset, relationQuery, 6).map((rel) => ({ id: rel, label: rel }));

  const clusterOptions: Array<{ value: string; label: string }> = isLiveMode
    ? backendClusters.map((c) => ({
        value: c.cluster_id,
        label: `${c.shared_relation} → ${c.shared_tail}`,
      }))
    : dataset.clusters.map((c) => ({
        value: c.id,
        label: `${c.sharedRelation} → ${c.sharedTail}`,
      }));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3" data-testid="dataset-navigator-panel">
      <h3 className="text-sm font-semibold text-slate-900">Graph navigation</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onFocusGraph ? (
          <button
            type="button"
            onClick={onFocusGraph}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Focus graph
          </button>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          disabled={activeSlice.mode === GUIDED_SLICE.mode && mode === "guided"}
        >
          Reset view
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          data-testid="toggle-advanced-graph-controls"
        >
          {showAdvanced ? "Hide advanced" : "Advanced graph controls"}
        </button>
      </div>

      {showAdvanced ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-[11px] font-semibold text-slate-700">Graph view</label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as SliceMode)}
          >
            {modeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          {mode === "entity" ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Entity</label>
              <input
                type="text"
                list="entity-suggestions"
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                placeholder="Search entity"
                value={entityQuery}
                onChange={(e) => setEntityQuery(e.target.value)}
              />
              <datalist id="entity-suggestions">
                {entitySuggestions.map((item) => (
                  <option key={item.id} value={item.label} />
                ))}
              </datalist>
            </div>
          ) : null}

          {mode === "relation" ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Relation</label>
              <input
                type="text"
                list="relation-suggestions"
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                placeholder="Search relation"
                value={relationQuery}
                onChange={(e) => setRelationQuery(e.target.value)}
              />
              <datalist id="relation-suggestions">
                {relationSuggestions.map((rel) => (
                  <option key={rel.id} value={rel.label} />
                ))}
              </datalist>
            </div>
          ) : null}

          {mode === "cluster" && clusterOptions.length > 0 ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Cluster</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={clusterId}
                onChange={(e) => setClusterId(e.target.value)}
              >
                {clusterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {mode === "candidate" ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Proposed triple filter</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={candidateStatus}
                onChange={(e) => setCandidateStatus(e.target.value as CandidateStatusFilter)}
              >
                {CANDIDATE_STATUS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {mode === "feedback" ? (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Feedback results</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={feedbackBucket}
                onChange={(e) => setFeedbackBucket(e.target.value as FeedbackBucket)}
              >
                {FEEDBACK_BUCKET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button
            type="button"
            onClick={apply}
            className="w-full rounded-md border border-slate-800 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
          >
            Apply explore view
          </button>
          {onResetGuidedView ? (
            <button
              type="button"
              onClick={() => {
                setMode("guided");
                onResetGuidedView();
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset guided view
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
