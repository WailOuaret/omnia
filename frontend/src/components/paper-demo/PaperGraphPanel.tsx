import { Download } from "lucide-react";
import { PaperCovidExampleGraph } from "./PaperCovidExampleGraph";
import { PaperDemoTabs } from "./PaperDemoTabs";
import { PaperPipelineStrip } from "./PaperPipelineStrip";
import type { PaperDemoCandidate, PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";

interface PaperGraphPanelProps {
  activeStep: PaperDemoStep;
  onStepChange: (step: PaperDemoStep) => void;
  selectedCandidate: PaperDemoCandidate | undefined;
  selectedDecision: UserRefinementDecision;
  highlightedEdge?: string | null;
  highlightedNode?: string | null;
  screenshotMode?: boolean;
  captureMode?: boolean;
  onExportSvg?: () => void;
}

export function PaperGraphPanel({
  activeStep,
  onStepChange,
  selectedCandidate,
  selectedDecision,
  highlightedEdge,
  highlightedNode,
  screenshotMode,
  captureMode,
  onExportSvg,
}: PaperGraphPanelProps) {
  const showChrome = !screenshotMode && !captureMode;

  return (
    <section
      id="paper-demo-graph-section"
      className="flex min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white"
      aria-labelledby="paper-graph-heading"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2 py-1.5">
        <h2 id="paper-graph-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
          Knowledge graph workspace
        </h2>
        {showChrome ? (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="paper-graph-toolbar">
            {onExportSvg ? (
              <button
                type="button"
                onClick={onExportSvg}
                className="mr-1 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                data-testid="paper-export-svg-btn"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export SVG
              </button>
            ) : null}
            <span className="text-[11px] text-slate-500">Layout:</span>
            <span className="rounded-sm border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
              Focused Demo Layout
            </span>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex min-w-0 flex-col lg:flex-row lg:items-end lg:overflow-hidden">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <PaperDemoTabs activeStep={activeStep} onStepChange={onStepChange} embedded />
          </div>
          <div className="min-w-0 lg:max-w-[48%]">
            <PaperPipelineStrip activeStep={activeStep} aside />
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-slate-100 px-2 py-1">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-800" data-testid="paper-guided-story">
            {selectedCandidate?.demoRole === "invalid"
              ? selectedCandidate.id === "c2"
                ? "This is an invalid generated candidate. It demonstrates why filtering and human review are required."
                : "This candidate is structurally weak and semantically unsupported. It should be rejected or marked uncertain."
              : selectedCandidate?.demoRole === "review"
                ? "This candidate passes initial checks but remains a review case because evidence is less direct."
                : "This is the true missing triple. The demo path should end with an accepted edge in the completed KG."}
          </p>
          <div
            className="flex max-w-full shrink-0 flex-wrap justify-end gap-x-3 gap-y-0.5 text-[10px] text-slate-600"
            aria-label="Graph legend"
          >
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-700" /> Entity
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 bg-emerald-700" /> Original relation
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 border-b-2 border-dashed border-orange-600" /> Generated candidate
            </span>
            <span className="flex items-center gap-1">
              <span className="h-[3px] w-4 bg-emerald-700" /> Accepted triple
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 border-b border-dashed border-red-500 opacity-60" /> Rejected candidate
            </span>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#fafafa] p-1">
        <PaperCovidExampleGraph
          step={activeStep}
          selectedCandidate={selectedCandidate}
          selectedDecision={selectedDecision}
          highlightedEdge={highlightedEdge}
          highlightedNode={highlightedNode}
        />
      </div>
      <p className="border-t border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700">
        {{
          before: "The original COVID-19 KG extracted by GPT-4 from COVID-Fact. Triple t4 is absent.",
          missing:
            selectedCandidate?.demoRole === "invalid"
              ? "Invalid generated candidate is shown as dashed edge for validation (not a true missing triple)."
              : "t4 = (chloroquine, treats, sars-cov-2) is entailed by f2 but was not extracted. OMNIA targets this.",
          cluster: "remdesivir and chloroquine share relation-tail key (inhibits, 2019-ncov) and are grouped in cluster C.",
          generation:
            "OMNIA propagates relation-tail patterns inside clusters. The generated candidates are hypotheses, not facts, until they pass validation.",
          filtering:
            selectedCandidate?.id === "c1"
              ? "TransE distance 0.61 < tau 0.80 so c1 PASSES filtering."
              : selectedCandidate?.id === "c2"
                ? "TransE distance 0.93 > tau 0.80 so c2 is FILTERED OUT."
                : selectedCandidate?.id === "c3"
                  ? "TransE distance 0.88 > tau 0.80 so c3 is FILTERED OUT."
                  : "TransE distance 0.68 < tau 0.80 so c4 PASSES filtering.",
          llm:
            selectedCandidate?.demoRole === "invalid"
              ? "LLM verdict FALSE for invalid candidate; rejection keeps KG unchanged."
              : "RAG retrieves t1, t2, t3, f2 as context. Mistral-7B classifies c1 as TRUE in the demo walkthrough.",
          human: "Human quality checklist and evidence judgements are required before final decision.",
          after:
            selectedDecision === "accepted"
              ? "Accepted candidate is integrated into the completed KG."
              : selectedDecision === "rejected"
                ? "Rejected candidate remains absent from the KG."
                : "Awaiting curator decision.",
          diff:
            selectedDecision === "accepted"
              ? "Diff confirms candidate added in after graph."
              : "Diff confirms rejected candidate is not added (KG unchanged).",
        }[activeStep]}
      </p>
    </section>
  );
}
