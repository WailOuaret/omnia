import { useState } from "react";
import { DATASETS } from "../../demo-data/datasets";
import type { DemoDatasetConfig, DemoDatasetId } from "../../demo-data/types";
import { demoDatasetIdToSampleId } from "../../lib/sessionToDemoDataset";

interface DatasetSelectorPanelProps {
  selectedDatasetId: DemoDatasetId;
  onSelect: (id: DemoDatasetId) => void;
  isLiveMode?: boolean;
  isStaticScenarioMode?: boolean;
  /** Dataset bound to the active backend session (if any). */
  sessionDatasetId?: DemoDatasetId | null;
  liveDataset?: DemoDatasetConfig | null;
  sessionId?: string | null;
  onCreateSession?: (datasetId: DemoDatasetId) => Promise<void>;
}

function isBackendLoadable(datasetId: DemoDatasetId): boolean {
  return Boolean(demoDatasetIdToSampleId(datasetId));
}

const LIVE_BACKEND_DATASET_IDS: DemoDatasetId[] = ["codexM", "fb15k237", "wn18rr"];
const STATIC_ONLY_DATASET_IDS: DemoDatasetId[] = ["covidFact", "socioEconomic"];

function datasetOptionLabel(dataset: DemoDatasetConfig): string {
  if (dataset.id === "covidFact") return `${dataset.label} (KG loading pending)`;
  if (dataset.id === "socioEconomic") return `${dataset.label} (private)`;
  return dataset.label;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function ragRationale(datasetId: DemoDatasetId, recommendedMode: "sentence-rag" | "triple-rag"): string {
  if (datasetId === "codexM") {
    return "Sentence-based RAG works best on CoDEx-M because Wikidata entity labels are natural language, so the LLM can verbalise the candidate.";
  }
  if (datasetId === "socioEconomic") {
    return "Sentence-based RAG works best on Socio-Economic because the entities are concept phrases that benefit from natural-language context.";
  }
  if (datasetId === "wn18rr") {
    return "Triple-based RAG works best on WN18RR because synset labels (e.g. dog.n.01) do not verbalise reliably; keeping the triple form preserves the relation semantics.";
  }
  if (datasetId === "fb15k237") {
    return "Triple-based RAG works best on FB15K-237 because Freebase relation paths (/people/person/profession) are structured strings the LLM cannot easily restate as a sentence.";
  }
  if (datasetId === "covidFact") {
    return "Sentence-based RAG is used in the COVID-Fact running example because the entities are biomedical concepts that read naturally in prose context.";
  }
  return recommendedMode === "sentence-rag"
    ? "Sentence-based RAG is the recommended mode for this dataset."
    : "Triple-based RAG is the recommended mode for this dataset.";
}

export function DatasetSelectorPanel({
  selectedDatasetId,
  onSelect,
  isLiveMode = false,
  isStaticScenarioMode = false,
  sessionDatasetId = null,
  liveDataset = null,
  sessionId = null,
  onCreateSession,
}: DatasetSelectorPanelProps) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const sessionMismatch =
    isLiveMode && sessionDatasetId != null && selectedDatasetId !== sessionDatasetId;
  const selectedDataset =
    isLiveMode && !sessionMismatch && liveDataset ? liveDataset : DATASETS[selectedDatasetId];
  if (!selectedDataset) return null;

  const canCreateSession = isBackendLoadable(selectedDatasetId);

  const handleCreateSession = async () => {
    if (!onCreateSession) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateSession(selectedDatasetId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create backend session.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="dataset-selector-panel">
      <h2 className="text-sm font-semibold text-slate-900">Choose a dataset</h2>
      <select
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        value={selectedDatasetId}
        onChange={(event) => onSelect(event.target.value as DemoDatasetId)}
        data-testid="dataset-selector-dropdown"
      >
        <optgroup label={isStaticScenarioMode ? "Static interactive scenarios" : "Live backend datasets"}>
          {LIVE_BACKEND_DATASET_IDS.map((id) => {
            const dataset = DATASETS[id];
            if (!dataset) return null;
            return (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label}
              </option>
            );
          })}
        </optgroup>
        <optgroup label="Static guided demo only">
          {STATIC_ONLY_DATASET_IDS.map((id) => {
            const dataset = DATASETS[id];
            if (!dataset) return null;
            return (
              <option key={dataset.id} value={dataset.id}>
                {datasetOptionLabel(dataset)}
              </option>
            );
          })}
        </optgroup>
      </select>

      {isStaticScenarioMode ? (
        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <p className="font-semibold">Static interactive scenario</p>
          <p className="mt-1">
            Prepared JSON scenarios run entirely in the browser. No backend session is required on Vercel.
          </p>
        </div>
      ) : null}

      {!isStaticScenarioMode && !isBackendLoadable(selectedDatasetId) ? (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Static guided demo only</p>
          {selectedDatasetId === "covidFact" ? (
            <p className="mt-1">
              COVID-Fact source data are downloaded and verified; KG loading is pending. This tab shows a static illustration only.
            </p>
          ) : null}
          {selectedDatasetId === "socioEconomic" ? (
            <p className="mt-1">
              Socio-Economic dataset is private and cannot be loaded from the backend. This tab shows a static illustration only.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isStaticScenarioMode && isLiveMode && sessionId ? (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <p className="font-semibold">Active backend session</p>
          <p className="mt-1 font-mono text-[11px] text-emerald-800">sessionId: {sessionId}</p>
          {sessionDatasetId ? (
            <p className="mt-1 text-[11px]">
              Session dataset: <span className="font-semibold">{DATASETS[sessionDatasetId]?.label ?? sessionDatasetId}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {sessionMismatch ? (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p>
            The current session belongs to{" "}
            <span className="font-semibold">{DATASETS[sessionDatasetId!]?.label ?? sessionDatasetId}</span>.
            The graph still shows that session until you create a new one for{" "}
            <span className="font-semibold">{DATASETS[selectedDatasetId]?.label}</span>.
          </p>
          {canCreateSession && onCreateSession ? (
            <button
              type="button"
              onClick={() => void handleCreateSession()}
              disabled={creating}
              className="rounded-md border border-amber-500 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 disabled:opacity-60"
              data-testid="create-session-for-dataset"
            >
              {creating ? "Creating session…" : "Create session for selected dataset"}
            </button>
          ) : (
            <p className="text-[11px]">This dataset is demo-only and cannot be loaded from the backend.</p>
          )}
          {createError ? <p className="text-[11px] text-rose-700">{createError}</p> : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <p>{selectedDataset.description}</p>
        <p>
          <span className="font-semibold">Source:</span> {selectedDataset.source}
        </p>
        <p>
          <span className="font-semibold">Entities:</span> {formatNumber(selectedDataset.entities)} |{" "}
          <span className="font-semibold">Relations:</span> {formatNumber(selectedDataset.relations)} |{" "}
          <span className="font-semibold">Triples:</span> {formatNumber(selectedDataset.triples)}
        </p>
        <p>
          <span className="font-semibold">Recommended mode:</span>{" "}
          {selectedDataset.recommendedMode === "sentence-rag" ? "Sentence-based RAG" : "Triple-based RAG"}
        </p>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
          {ragRationale(selectedDataset.id, selectedDataset.recommendedMode)}
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded px-2 py-0.5 text-[11px] ${
              selectedDataset.publicStatus === "private"
                ? "bg-slate-900 text-white"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {selectedDataset.publicStatus === "private" ? "private" : "public"}
          </span>
          {selectedDataset.id === "socioEconomic" ? (
            <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
              optional · sparse
            </span>
          ) : null}
          {selectedDataset.id === "covidFact" ? (
            <span className="inline-block rounded bg-sky-100 px-2 py-0.5 text-[11px] text-sky-900">
              recommended for demo flow
            </span>
          ) : null}
          {selectedDataset.id === "codexM" ? (
            <span className="inline-block rounded bg-sky-100 px-2 py-0.5 text-[11px] text-sky-900">
              recommended for benchmark flow
            </span>
          ) : null}
        </p>
        {selectedDataset.bestF1 !== undefined ? (
          <p>
            <span className="font-semibold">Best OMNIA F1:</span> {selectedDataset.bestF1.toFixed(2)}
          </p>
        ) : null}
        {selectedDataset.role ? (
          <p>
            <span className="font-semibold">Role:</span> {selectedDataset.role}
          </p>
        ) : null}
        {selectedDataset.note ? (
          <p className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
            {selectedDataset.note}
          </p>
        ) : null}
        {selectedDataset.warning ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
            {selectedDataset.warning}
          </p>
        ) : null}
      </div>

      {!isStaticScenarioMode && !isLiveMode && canCreateSession && onCreateSession ? (
        <button
          type="button"
          onClick={() => void handleCreateSession()}
          disabled={creating}
          className="mt-3 w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          data-testid="create-session-for-dataset"
        >
          {creating ? "Creating backend session…" : "Create backend session for selected dataset"}
        </button>
      ) : null}
    </section>
  );
}
