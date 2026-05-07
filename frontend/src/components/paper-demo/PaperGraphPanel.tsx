import { Download, Expand, Hand, Maximize2, MousePointer2, Search } from "lucide-react";
import { guidedStoryCaption } from "./paperDemoScenario";
import { PaperCovidExampleGraph } from "./PaperCovidExampleGraph";
import { PaperDemoTabs } from "./PaperDemoTabs";
import { PaperPipelineStrip } from "./PaperPipelineStrip";
import type { PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";

interface PaperGraphPanelProps {
  activeStep: PaperDemoStep;
  onStepChange: (step: PaperDemoStep) => void;
  curatorDecision: UserRefinementDecision;
  screenshotMode?: boolean;
  captureMode?: boolean;
  onExportSvg?: () => void;
}

export function PaperGraphPanel({
  activeStep,
  onStepChange,
  curatorDecision,
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
          Graph Visualization
        </h2>
        {showChrome ? (
          <div className="flex flex-wrap items-center gap-1" data-testid="paper-graph-toolbar">
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
            <button
              type="button"
              aria-label="Select mode"
              className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Pan mode" className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
              <Hand className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Search graph" className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
              <Search className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Fit view" className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
              <Expand className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Fullscreen graph"
              className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Tabs + pipeline on one row (paper Figure 3 alignment); story + legend next — more vertical space for SVG */}
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-col xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1 xl:overflow-x-auto">
            <PaperDemoTabs activeStep={activeStep} onStepChange={onStepChange} embedded />
          </div>
          <PaperPipelineStrip activeStep={activeStep} aside />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-slate-100 px-2 py-1">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-800" data-testid="paper-guided-story">
            {guidedStoryCaption(activeStep, curatorDecision)}
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
              <span className="h-0.5 w-4 border-b-2 border-dashed border-orange-600" /> Missing candidate
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

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#fafafa] p-2">
        {activeStep === "filtering" ? (
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 border border-slate-300 bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">TransE filtering</div>
            <div className="mt-1.5 text-[13px] text-slate-900">
              distance = <span className="font-mono font-semibold tabular-nums">0.42</span>
            </div>
            <div className="text-[13px] text-slate-900">
              threshold τ = <span className="font-mono font-semibold tabular-nums">0.80</span>
            </div>
            <div className="mt-1.5 text-[12px] font-semibold text-emerald-800">Candidate c1 passed</div>
          </div>
        ) : null}
        <PaperCovidExampleGraph step={activeStep} curatorDecision={curatorDecision} />
      </div>
    </section>
  );
}
