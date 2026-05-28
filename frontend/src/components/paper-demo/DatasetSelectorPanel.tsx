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
  if (dataset.id === "covidFact") return `${dataset.label} (guided walkthrough)`;
  if (dataset.id === "socioEconomic") return `${dataset.label} (private)`;
  return dataset.label;
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
  if (!DATASETS[selectedDatasetId]) return null;

  const canCreateSession = isBackendLoadable(selectedDatasetId);

  const handleCreateSession = async () => {
    if (!onCreateSession) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateSession(selectedDatasetId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not load live dataset sample.");
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
        <optgroup label={isStaticScenarioMode ? "Prepared interactive samples" : "Benchmark datasets"}>
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
        <optgroup label="Prepared examples">
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

      {sessionMismatch && canCreateSession && onCreateSession ? (
        <button
          type="button"
          onClick={() => void handleCreateSession()}
          disabled={creating}
          className="mt-2 w-full rounded-md border border-amber-400 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-900 disabled:opacity-60"
          data-testid="create-session-for-dataset"
        >
          {creating ? "Loading sample…" : "Load sample for selected dataset"}
        </button>
      ) : null}
      {createError ? <p className="mt-1 text-[11px] text-rose-700">{createError}</p> : null}

      {!isStaticScenarioMode && !isLiveMode && !sessionMismatch && canCreateSession && onCreateSession ? (
        <button
          type="button"
          onClick={() => void handleCreateSession()}
          disabled={creating}
          className="mt-3 w-full rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          data-testid="create-session-for-dataset"
        >
          {creating ? "Loading sample…" : "Load graph sample"}
        </button>
      ) : null}
    </section>
  );
}
