import { useState } from "react";
import { RUNTIME_STATS, SOURCE_QUALITY_STATS } from "./paperDemoScenario";

type StatsTab = "datasets" | "generation" | "filtering" | "f1" | "promptRag" | "runtime" | "sourceQuality";

const STATS_TABS: Array<{ id: StatsTab; label: string }> = [
  { id: "datasets", label: "Datasets" },
  { id: "generation", label: "Generation" },
  { id: "filtering", label: "Filtering" },
  { id: "f1", label: "F1" },
  { id: "promptRag", label: "Prompt/RAG" },
  { id: "runtime", label: "Runtime" },
  { id: "sourceQuality", label: "Source KG quality" },
];

const DATASET_STATS = [
  { name: "Socio-economic", relations: 17175, entities: 33563, triples: 64417 },
  { name: "CoDEx-M", relations: 49, entities: 16759, triples: 60000 },
  { name: "FB15K-237", relations: 29, entities: 12993, triples: 59270 },
  { name: "WN18RR", relations: 11, entities: 40943, triples: 93003 },
  { name: "COVID-Fact", relations: 28, entities: 1416, triples: 908 },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function PaperStatsPanel() {
  const [tab, setTab] = useState<StatsTab>("datasets");

  return (
    <section className="border-t border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3" data-testid="paper-stats-panel">
      <div className="paper-stats-tabs -mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STATS_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium leading-tight transition sm:min-w-[86px] sm:text-[12px] ${
              tab === id
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
            aria-pressed={tab === id}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-2.5 text-[12px] leading-relaxed text-slate-700 sm:text-[13px]">
        {tab === "datasets" && (
          <div className="space-y-2.5">
            <p className="text-[11px] leading-snug text-slate-500 sm:text-[12px]">Entities, relations, and triples per benchmark dataset.</p>
            <ul className="grid gap-2.5">
              {DATASET_STATS.map((dataset) => (
                <li key={dataset.name} className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="mb-1.5 text-[12px] font-semibold text-slate-900 sm:text-[13px]">{dataset.name}</div>
                  <div className="grid grid-cols-3 gap-2.5 text-[11px] text-slate-600 sm:text-[12px]">
                    <div>
                      <span className="block text-slate-500">Rel</span>
                      <span className="font-medium text-slate-800">{formatNumber(dataset.relations)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500">Ent</span>
                      <span className="font-medium text-slate-800">{formatNumber(dataset.entities)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500">Triples</span>
                      <span className="font-medium text-slate-800">{formatNumber(dataset.triples)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "generation" && (
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="text-[11px] text-slate-500">OMNIA candidates</div>
                <div className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">{formatNumber(9047869)}</div>
                <div className="text-[11px] text-slate-600">70.65% TP</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="text-[11px] text-slate-500">Exhaustive candidates</div>
                <div className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">{formatNumber(12958932528)}</div>
                <div className="text-[11px] text-slate-600">95.98% TP</div>
              </div>
            </div>
            <p>OMNIA evaluates about <span className="font-semibold text-slate-900">1,400x fewer candidates</span> while keeping high-quality positives.</p>
            <p className="text-slate-600">Runtime profile: OMNIA ~10 minutes (single process, &lt;8GB) vs exhaustive ~2 hours (10 processes, ~2.6TB RAM).</p>
          </div>
        )}

        {tab === "filtering" && (
          <ul className="space-y-2">
            {[
              { name: "CoDEx-M", reduction: "71.08%", before: 8476, after: 5024 },
              { name: "Socio-economic", reduction: "70.00%", before: 1186, after: 607 },
              { name: "FB15K-237", reduction: "41.76%", before: 5818, after: 3836 },
            ].map((row) => (
              <li key={row.name} className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{row.name}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:text-[11px]">{row.reduction} reduction</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 sm:text-[12px]">
                  TC {formatNumber(row.before)} → TCF {formatNumber(row.after)}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "f1" && (
          <ul className="space-y-2">
            {[
              "FB15K-237: 0.86 (OMNIA Triples RAG)",
              "CoDEx-M: 0.91 (OMNIA Sentences RAG)",
              "WN18RR: 0.87 (OMNIA Triples RAG)",
              "Socio-economic: OMNIA 0.68; DistMult 0.74 and KG-BERT 0.73",
            ].map((item) => (
              <li key={item} className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                {item}
              </li>
            ))}
          </ul>
        )}

        {tab === "promptRag" && (
          <div className="space-y-2">
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="text-[11px] text-slate-500">Prompt comparison</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                <span>Simple: 462/500 (0.92)</span>
                <span className="font-semibold text-slate-900">Explicit: 500/500 (1.00)</span>
              </div>
            </div>
            <p>Explicit prompting prevents rewriting incorrect triples into plausible but misleading sentences.</p>
            <p className="text-slate-600">Top-k tested: 1, 2, 3, 4, 5, 10, 15, 20, 50; F1 peaks at k=3, and the paper uses k=2 as its selected setting.</p>
          </div>
        )}

        {tab === "runtime" && (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50/70">
              <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-slate-100 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:text-[11px]">
                <span>Sample size</span>
                <span>Generation</span>
                <span>Filtering</span>
              </div>
              <div className="divide-y divide-slate-200">
                {RUNTIME_STATS.map((r) => (
                  <div key={r.sampleSize} className="grid grid-cols-[1.1fr_1fr_1fr] px-2.5 py-2 text-[11px] sm:text-[12px]">
                    <span className="font-medium text-slate-800">{r.sampleSize}</span>
                    <span>{r.generationSec}s</span>
                    <span>{r.filteringSec}s</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5 text-[11px] sm:text-[12px]">
              <div className="font-semibold text-slate-800">LLM runtime (Mistral-7B)</div>
              <div className="mt-1 text-slate-700">Triple-based @ 500: zero-shot 1014.35s, in-context 1481.35s, RAG 1489.83s.</div>
              <div className="text-slate-700">Sentence-based @ 500: zero-shot 1517.59s, in-context 3365.93s, RAG 3156.91s.</div>
            </div>
          </div>
        )}

        {tab === "sourceQuality" && (
          <div className="space-y-2">
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="text-[11px] text-slate-500">Overall issue rate</div>
              <div className="text-[15px] font-semibold text-slate-900 sm:text-[16px]">{formatPercent(SOURCE_QUALITY_STATS.issueRate)}</div>
              <div className="text-[11px] text-slate-600">
                Correctness {formatPercent(SOURCE_QUALITY_STATS.correctnessIssues)} · Completeness {formatPercent(SOURCE_QUALITY_STATS.completenessIssues)}
              </div>
            </div>
            <ul className="grid gap-1.5 text-[11px] text-slate-700 sm:text-[12px]">
              <li>Incorrect triples: {formatPercent(SOURCE_QUALITY_STATS.incorrectTriples)}</li>
              <li>Inaccurate relations: {formatPercent(SOURCE_QUALITY_STATS.inaccurateRelations)}</li>
              <li>Missing triples: {formatPercent(SOURCE_QUALITY_STATS.missingTriples)}</li>
              <li>Missing entities: {formatPercent(SOURCE_QUALITY_STATS.missingEntities)}</li>
            </ul>
            <p className="text-[11px] text-slate-500">These quality percentages come from the cited COVID-Fact source analysis, not from OMNIA benchmark tables.</p>
          </div>
        )}
      </div>
    </section>
  );
}
