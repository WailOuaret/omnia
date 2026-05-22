import { DATASET_LIST, DATASETS } from "../../demo-data/datasets";
import type { DemoDatasetId } from "../../demo-data/types";

interface DatasetSelectorPanelProps {
  selectedDatasetId: DemoDatasetId;
  onSelect: (id: DemoDatasetId) => void;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

export function DatasetSelectorPanel({ selectedDatasetId, onSelect }: DatasetSelectorPanelProps) {
  const selectedDataset = DATASETS[selectedDatasetId];
  if (!selectedDataset) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Choose a dataset</h2>
      <select
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        value={selectedDatasetId}
        onChange={(event) => onSelect(event.target.value as DemoDatasetId)}
      >
        {DATASET_LIST.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.label}
          </option>
        ))}
      </select>
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
        <p>
          <span
            className={`inline-block rounded px-2 py-0.5 text-[11px] ${
              selectedDataset.publicStatus === "private"
                ? "bg-slate-900 text-white"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {selectedDataset.publicStatus === "private" ? "private" : "public"}
          </span>
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
    </section>
  );
}

