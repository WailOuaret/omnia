import { useMemo, useState, type DragEvent } from "react";
import { ArrowRight, CloudUpload, FileJson, FileSpreadsheet } from "lucide-react";
import { ErrorState } from "../common/ErrorState";
import { LoadingState } from "../common/LoadingState";
import { StatusDot } from "../shared/StatusDot";
import { PaperModeToggle } from "./PaperModeToggle";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/hooks";
import { useSessionStore } from "../../store/session";
import type { SampleSummary } from "../../types";

const canonicalColumns = ["Head", "Relation", "Tail"] as const;

const PREFERRED_HINT =
  "Preferred benchmark ids: omnia_codex_m, omnia_fb15k_237, omnia_wn18rr. Clone datasets with scripts/clone_true_datasets.ps1 if the list is empty.";

export function DemoSessionPicker() {
  const setSession = useSessionStore((s) => s.setSession);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const samplesQuery = useApiData(() => api.listSamples(), [], true);
  const healthQuery = useApiData(() => api.health(), [], true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdoutMode, setHoldoutMode] = useState(true);
  const [sampleProportion, setSampleProportion] = useState(0.8);
  const [samplingLimit, setSamplingLimit] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const columns = useMemo(() => (preview?.columns as string[] | undefined) ?? [], [preview]);
  const fileFormat = file?.name.split(".").pop()?.toUpperCase() ?? "CSV/TSV/JSON";

  const loadSample = async (sample: SampleSummary) => {
    setLoadingSample(sample.id);
    try {
      const session = await api.createSampleSession(
        sample.id,
        true,
        0.8,
        sample.recommended_sampling_limit ?? undefined,
      );
      setSession(session);
    } finally {
      setLoadingSample(null);
    }
  };

  const handleSelectedFile = (selected: File | null) => {
    setFile(selected);
    setPreview(null);
    setMapping({});
    setIngestError(null);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleSelectedFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    setIngestError(null);
    try {
      const data = await api.previewDataset(file);
      setPreview(data);
      setMapping((data.guessed_mapping as Record<string, string>) ?? {});
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Could not preview dataset");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateUpload = async () => {
    if (!file) return;
    setBusy(true);
    setIngestError(null);
    try {
      const session = await api.createUploadSession(
        file,
        mapping,
        holdoutMode,
        sampleProportion,
        samplingLimit ? Number(samplingLimit) : undefined,
      );
      setSession(session);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Could not create session");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">OMNIA paper demo</h1>
              <p className="mt-3 max-w-xl text-sm text-slate-600">
                Load a <span className="font-semibold">CoDEx</span> or <span className="font-semibold">FB/WN</span>{" "}
                benchmark sample, or upload your own triple file. This interface is the full demo—there is no separate
                dashboard.
              </p>
            </div>
            <PaperModeToggle />
          </div>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            {healthQuery.loading ? <LoadingState message="Checking API…" /> : null}
            {healthQuery.error ? <ErrorState error={healthQuery.error} /> : null}
            {healthQuery.data ? (
              <div className="flex flex-wrap gap-4 text-sm">
                <StatusDot status="ok" label={`API ${String(healthQuery.data.status)}`} />
                <StatusDot
                  status={(healthQuery.data.ollama as Record<string, unknown>).available ? "ok" : "error"}
                  label={`Ollama ${String((healthQuery.data.ollama as Record<string, unknown>).available ? "reachable" : "offline")}`}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Benchmark samples</div>
          {samplesQuery.loading ? (
            <div className="mt-4">
              <LoadingState message="Loading sample datasets…" />
            </div>
          ) : null}
          {samplesQuery.error ? (
            <div className="mt-4">
              <ErrorState error={samplesQuery.error} />
            </div>
          ) : null}
          <div className="mt-4 space-y-4">
            {samplesQuery.data?.samples.map((sample) => (
              <div key={sample.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{sample.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1">{sample.source}</span>
                      {sample.recommended_sampling_limit ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                          focus-first {sample.recommended_sampling_limit} triples
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{sample.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSample(sample)}
                    disabled={loadingSample !== null}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {loadingSample === sample.id ? "Loading…" : "Open"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">{PREFERRED_HINT}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Upload custom KG</div>
          <p className="mt-2 text-sm text-slate-600">CSV, TSV, or JSON triples. Map columns, then create a session.</p>

          {ingestError ? (
            <div className="mt-4">
              <ErrorState error={ingestError} />
            </div>
          ) : null}

          <label
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="mt-4 block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6"
          >
            <div className="flex items-center gap-3">
              <CloudUpload className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-sm font-semibold">Drop a file or browse</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                    <FileSpreadsheet className="h-3 w-3" /> CSV
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                    <FileSpreadsheet className="h-3 w-3" /> TSV
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                    <FileJson className="h-3 w-3" /> JSON
                  </span>
                </div>
              </div>
            </div>
            {file ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{file.name}</span> — {(file.size / 1024).toFixed(1)} KB —{" "}
                <span className="font-mono text-xs">{fileFormat}</span>
              </div>
            ) : null}
            <input
              type="file"
              accept=".csv,.tsv,.json,.txt"
              className="mt-3 block w-full text-sm"
              onChange={(e) => handleSelectedFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="font-medium">Holdout evaluation split</div>
              <input
                type="checkbox"
                checked={holdoutMode}
                onChange={(e) => setHoldoutMode(e.target.checked)}
                className="mt-2 h-4 w-4"
              />
            </label>
            <label className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="font-medium">Pipeline sample limit (optional)</div>
              <input
                type="number"
                value={samplingLimit}
                onChange={(e) => setSamplingLimit(e.target.value)}
                placeholder="No limit"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <label className="mt-3 block rounded-lg border border-slate-200 p-3 text-sm">
            <div className="font-medium">Known graph proportion (holdout mode)</div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={sampleProportion}
              onChange={(e) => setSampleProportion(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 font-mono text-xs text-slate-500">{sampleProportion.toFixed(2)}</div>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!file || busy}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              {busy ? "Working…" : "Preview dataset"}
            </button>
            <button
              type="button"
              onClick={handleCreateUpload}
              disabled={!file || !preview || busy}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create OMNIA session
            </button>
          </div>

          {preview ? (
            <div className="mt-6 space-y-4">
              <div className="text-sm font-semibold">Column mapping</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {canonicalColumns.map((canonical) => (
                  <label key={canonical} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="font-medium">{canonical}</div>
                    <select
                      value={mapping[canonical] ?? ""}
                      onChange={(e) => setMapping((c) => ({ ...c, [canonical]: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2"
                    >
                      <option value="">Select column</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Rows: {String(preview.row_count ?? 0)} · Duplicates: {String(preview.duplicate_rows ?? 0)} · Malformed:{" "}
                {String(preview.malformed_rows ?? 0)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
