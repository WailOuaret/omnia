import { useEffect, useMemo, useState } from "react";
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

interface DatasetNavigatorPanelProps {
  dataset: DemoDatasetConfig;
  activeSlice: DatasetSlice;
  onApply: (slice: DatasetSlice) => void;
  onReset: () => void;
  /** Pass when a backend session is connected so entity/relation/cluster
   *  autocompletes query the real session artifacts. */
  sessionId?: string | null;
  isLiveMode?: boolean;
  backendClusters?: Array<{ cluster_id: string; shared_relation: string; shared_tail: string }>;
}

const MODE_OPTIONS: Array<{ id: SliceMode; label: string; hint: string }> = [
  { id: "guided", label: "Guided real slice", hint: "Backend-bounded subgraph centered on active artifacts" },
  { id: "entity", label: "Explore by entity", hint: "1-hop / 2-hop neighborhood around a real entity" },
  { id: "relation", label: "Explore by relation", hint: "Triples using the selected relation" },
  { id: "cluster", label: "Explore by cluster", hint: "Cluster members and related candidate triples" },
  { id: "candidate", label: "Explore candidate queue", hint: "Candidates filtered by backend status bucket" },
  { id: "feedback", label: "Explore feedback bucket", hint: "Candidates with human decisions / review queue" },
];

const CANDIDATE_STATUS_OPTIONS: Array<{ id: CandidateStatusFilter; label: string }> = [
  { id: "any", label: "Any candidate" },
  { id: "candidate", label: "Generated" },
  { id: "kept", label: "Kept by filtering" },
  { id: "removed", label: "Removed by filtering" },
  { id: "llm_valid", label: "LLM verdict: valid" },
  { id: "llm_invalid", label: "LLM verdict: invalid" },
  { id: "llm_uncertain", label: "LLM verdict: uncertain" },
  { id: "accepted", label: "Accepted by user" },
  { id: "rejected", label: "Rejected by user" },
  { id: "uncertain", label: "Uncertain by user" },
  { id: "corrected", label: "Corrected by user" },
];

const FEEDBACK_BUCKET_OPTIONS: Array<{ id: FeedbackBucket; label: string }> = [
  { id: "any", label: "Any feedback" },
  { id: "accepted", label: "Accepted (human_confirmed)" },
  { id: "rejected", label: "Rejected (human_rejected)" },
  { id: "reviewQueue", label: "Review queue (needs_expert_review)" },
  { id: "uncertain", label: "Uncertain" },
  { id: "corrected", label: "Corrected (human_corrected)" },
];

export function DatasetNavigatorPanel({
  dataset,
  activeSlice,
  onApply,
  onReset,
  sessionId = null,
  isLiveMode = false,
  backendClusters = [],
}: DatasetNavigatorPanelProps) {
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

  // Live mode: query real backend entities/relations as the user types.
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
        .catch((err) => console.warn("[paper-demo] backend entity search failed", err));
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
        .catch((err) => console.warn("[paper-demo] backend relation search failed", err));
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [isLiveMode, sessionId, mode, relationQuery]);

  const entitySuggestions = useMemo(() => {
    if (isLiveMode) return backendEntitySuggestions;
    return listEntities(dataset, entityQuery, 6);
  }, [isLiveMode, backendEntitySuggestions, dataset, entityQuery]);

  const relationSuggestions = useMemo(() => {
    if (isLiveMode) return backendRelationSuggestions;
    return listRelations(dataset, relationQuery, 6).map((rel) => ({ id: rel, label: rel }));
  }, [isLiveMode, backendRelationSuggestions, dataset, relationQuery]);

  const clusterOptions: Array<{ value: string; label: string }> = isLiveMode
    ? backendClusters.map((c) => ({
        value: c.cluster_id,
        label: `${c.cluster_id} · ${c.shared_relation} → ${c.shared_tail}`,
      }))
    : dataset.clusters.map((c) => ({
        value: c.id,
        label: `${c.id} · ${c.sharedRelation} → ${c.sharedTail}`,
      }));

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
    onReset();
  };

  return (
    <section
      className="rounded-xl border border-sky-200 bg-sky-50 p-4"
      data-testid="dataset-navigator-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">
            {isLiveMode ? "Explore real session data" : "Explore static demo slice"}
          </h3>
          <p className="text-[11px] text-sky-800">
            Choose which slice of the dataset to inspect. Each slice updates the graph,
            candidates, stats, and feedback panel.
          </p>
          <p
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isLiveMode
                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {isLiveMode ? "Source: backend session" : "Source: static demo config"}
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 ring-1 ring-sky-200">
          {activeSlice.mode === "guided" ? "guided" : "custom slice"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700">
          Slice mode
        </label>
        <select
          className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value as SliceMode)}
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-sky-800">
          {MODE_OPTIONS.find((m) => m.id === mode)?.hint}
        </p>
      </div>

      {mode === "entity" ? (
        <div className="mt-2 space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Entity (id or label)
          </label>
          <input
            type="text"
            list="entity-suggestions"
            className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
            placeholder="e.g. chloroquine"
            value={entityQuery}
            onChange={(e) => setEntityQuery(e.target.value)}
          />
          <datalist id="entity-suggestions">
            {entitySuggestions.map((item) => (
              <option key={item.id} value={item.label}>
                {item.id}
              </option>
            ))}
          </datalist>
          {entitySuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {entitySuggestions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setEntityQuery(item.label)}
                  className="rounded-full bg-white px-2 py-0.5 text-[10px] text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "relation" ? (
        <div className="mt-2 space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Relation
          </label>
          <input
            type="text"
            list="relation-suggestions"
            className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
            placeholder="e.g. treats"
            value={relationQuery}
            onChange={(e) => setRelationQuery(e.target.value)}
          />
          <datalist id="relation-suggestions">
            {relationSuggestions.map((rel) => (
              <option key={rel.id} value={rel.label} />
            ))}
          </datalist>
          {relationSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {relationSuggestions.map((rel) => (
                <button
                  type="button"
                  key={rel.id}
                  onClick={() => setRelationQuery(rel.label)}
                  className="rounded-full bg-white px-2 py-0.5 text-[10px] text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                >
                  {rel.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "cluster" ? (
        <div className="mt-2 space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Cluster
          </label>
          {clusterOptions.length === 0 ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
              No clusters available. Run clustering first in the workbench (or use static mode).
            </p>
          ) : (
            <select
              className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
            >
              {clusterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {mode === "candidate" ? (
        <div className="mt-2 space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Candidate status
          </label>
          <select
            className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
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
        <div className="mt-2 space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Feedback bucket
          </label>
          <select
            className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={apply}
          className="rounded-md border border-sky-700 bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
        >
          Apply slice
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
          disabled={activeSlice.mode === GUIDED_SLICE.mode && mode === "guided"}
        >
          Reset guided demo
        </button>
      </div>
    </section>
  );
}
