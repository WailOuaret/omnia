import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PaperCandidateTriplesPanel } from "../components/paper-demo/PaperCandidateTriplesPanel";
import { PaperDemoIconRail } from "../components/paper-demo/PaperDemoIconRail";
import { PaperExplanationPanel } from "../components/paper-demo/PaperExplanationPanel";
import { PaperFigureCaptions } from "../components/paper-demo/PaperFigureCaptions";
import { PaperGraphPanel } from "../components/paper-demo/PaperGraphPanel";
import { PaperModeToggle } from "../components/paper-demo/PaperModeToggle";
import { PaperStatsPanel } from "../components/paper-demo/PaperStatsPanel";
import { getCandidateById, OFFLINE_NOTE, PAPER_DEMO_CANDIDATES } from "../components/paper-demo/paperDemoScenario";
import { PAPER_DEMO_STEP_ORDER, type PaperDemoStep, type UserRefinementDecision } from "../components/paper-demo/paperDemoTypes";

function readStageParam(params: URLSearchParams): PaperDemoStep | null {
  const raw = params.get("stage");
  if (!raw) return null;
  return PAPER_DEMO_STEP_ORDER.includes(raw as PaperDemoStep) ? (raw as PaperDemoStep) : null;
}

function downloadSvgEl(svg: SVGSVGElement, filename: string) {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PaperDemoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const captureMode = searchParams.get("capture") === "1";

  const [activeStep, setActiveStep] = useState<PaperDemoStep>(() => readStageParam(searchParams) ?? "missing");
  const [selectedCandidateId, setSelectedCandidateId] = useState("c1");
  const [decisions, setDecisions] = useState<Record<string, UserRefinementDecision>>({});
  const [comment, setComment] = useState("");
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [highlightedEdge, setHighlightedEdge] = useState<string | null>(null);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  const selected = useMemo(() => getCandidateById(selectedCandidateId), [selectedCandidateId]);
  const userDecision =
    decisions[selectedCandidateId] ??
    (selected?.status === "accepted" || selected?.status === "rejected" ? selected.status : null);
  useEffect(() => {
    const next = readStageParam(searchParams);
    if (next) setActiveStep(next);
  }, [searchParams]);

  const commitStep = useCallback(
    (step: PaperDemoStep) => {
      setActiveStep(step);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("stage", step);
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setComment("");
  }, [selectedCandidateId]);

  function handleUserDecision(decision: "accepted" | "rejected" | "uncertain") {
    setDecisions((prev) => ({ ...prev, [selectedCandidateId]: decision }));
    commitStep("after");
  }

  function handleReturnToMain() {
    setSelectedCandidateId("c1");
    commitStep("missing");
  }

  function handleResetMainValidation() {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[selectedCandidateId];
      return next;
    });
    setComment("");
    commitStep("llm");
  }

  const handleExportSvg = useCallback(() => {
    const main = document.querySelector('[data-testid="paper-demo-graph-svg"]');
    if (main) {
      downloadSvgEl(main as SVGSVGElement, "omnia-paper-demo-graph.svg");
      return;
    }
    const diffRoot = document.querySelector('[data-testid="paper-demo-diff"]');
    if (diffRoot) {
      const svgs = diffRoot.querySelectorAll("svg");
      svgs.forEach((svg, i) => {
        downloadSvgEl(
          svg as SVGSVGElement,
          i === 0 ? "omnia-paper-demo-before.svg" : "omnia-paper-demo-after.svg",
        );
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === "Escape") {
        if (captureMode) {
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.delete("capture");
              return n;
            },
            { replace: true },
          );
        } else if (screenshotMode) {
          setScreenshotMode(false);
        }
        return;
      }

      const order = PAPER_DEMO_STEP_ORDER;
      const idx = order.indexOf(activeStep);

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = order[Math.min(order.length - 1, idx + 1)];
        if (next) commitStep(next);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = order[Math.max(0, idx - 1)];
        if (prev) commitStep(prev);
        return;
      }

      const digit = e.key >= "1" && e.key <= "9" ? Number.parseInt(e.key, 10) - 1 : -1;
      if (digit >= 0 && digit < order.length) {
        e.preventDefault();
        commitStep(order[digit]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStep, captureMode, commitStep, screenshotMode, setSearchParams]);

  return (
    <div
      className={`paper-demo min-h-screen bg-slate-50 text-slate-900 ${screenshotMode ? "paper-demo-screenshot" : ""} ${presentationMode ? "paper-demo-presentation" : ""}`}
      data-testid="paper-demo-root"
    >
      <div className="paper-demo-layout">
        <header className="paper-demo-header border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[19px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[20px]">
                  OMNIA — Interactive Knowledge Graph Completion
                </h1>
                <span
                  className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium leading-tight text-slate-700"
                  data-testid="paper-demo-data-badge"
                >
                  Offline COVID-Fact running example
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-600 sm:text-[13.5px]">{OFFLINE_NOTE}</p>
              {!screenshotMode && !captureMode ? (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Stage shortcuts: keys <kbd className="rounded border border-slate-300 bg-slate-100 px-1">1</kbd>–
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1">9</kbd> and arrows{" "}
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1">←</kbd>
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1">→</kbd>.
                </p>
              ) : null}
            </div>
            <div className="flex w-full flex-wrap items-center justify-start gap-2 self-start sm:w-auto sm:justify-end">
              {!screenshotMode && !captureMode ? <PaperModeToggle /> : null}
              {!captureMode ? (
                <button
                  type="button"
                  onClick={() => setScreenshotMode((v) => !v)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold leading-tight text-slate-800 hover:bg-slate-50"
                  data-testid="paper-screenshot-mode-btn"
                >
                  {screenshotMode ? "Exit figure mode" : "Figure mode"}
                </button>
              ) : null}
              {!captureMode ? (
                <button
                  type="button"
                  onClick={() => setPresentationMode((v) => !v)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold leading-tight text-slate-800 hover:bg-slate-50"
                >
                  {presentationMode ? "Exit live demo mode" : "Live demo mode"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 sm:p-3">
            <div className="grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "COVID-Fact", value: "28R · 1,416E · 908T" },
                { label: "CoDEx-M", value: "49R · 16,759E · 60,000T" },
                { label: "OMNIA candidates", value: "9,047,869 (~1,400x fewer)" },
                { label: "Best CoDEx-M F1", value: "0.91" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</div>
                  <div className="mt-0.5 text-[12px] font-semibold leading-snug text-slate-800">{metric.value}</div>
                </div>
              ))}
            </div>
            <details className="mt-2 text-[11px] text-slate-600">
              <summary className="cursor-pointer select-none font-medium text-slate-700 hover:text-slate-900">
                Show OMNIA benchmark evidence
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5 leading-relaxed">
                {[
                  "Exhaustive candidates: 12,958,932,528",
                  "Filtering CoDEx-M: 71.08%",
                  "RAG top-k: peak at 3, selected setting 2",
                ].map((chip) => (
                  <span key={chip} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700">
                    {chip}
                  </span>
                ))}
              </div>
            </details>
          </div>
        </header>

        <div className="paper-demo-rail-wrap min-h-0 border-b border-slate-200 lg:border-b-0">
          <PaperDemoIconRail screenshotMode={screenshotMode} captureMode={captureMode} />
        </div>

        <div className="paper-demo-candidates min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <PaperCandidateTriplesPanel
              candidates={PAPER_DEMO_CANDIDATES}
              selectedId={selectedCandidateId}
              onSelect={setSelectedCandidateId}
              decisions={decisions}
              screenshotMode={screenshotMode}
            />
            {!screenshotMode ? <PaperStatsPanel /> : null}
          </div>
        </div>

        <div className="paper-demo-graph min-h-0 overflow-hidden">
          <PaperGraphPanel
            activeStep={activeStep}
            onStepChange={commitStep}
            selectedCandidate={selected}
            selectedDecision={userDecision}
            highlightedEdge={highlightedEdge}
            highlightedNode={highlightedNode}
            screenshotMode={screenshotMode}
            captureMode={captureMode}
            onExportSvg={!captureMode && !screenshotMode ? handleExportSvg : undefined}
          />
        </div>

        <div className="paper-demo-explanation min-h-0 overflow-hidden">
          <PaperExplanationPanel
            candidate={selected}
            activeStep={activeStep}
            userDecision={userDecision}
            onUserDecision={handleUserDecision}
            comment={comment}
            onCommentChange={setComment}
            onReturnToMain={handleReturnToMain}
            onResetMainValidation={handleResetMainValidation}
            screenshotMode={screenshotMode}
            onHighlightEdge={setHighlightedEdge}
            onHighlightNode={setHighlightedNode}
          />
        </div>

        <div className="paper-demo-caption">
          <PaperFigureCaptions />
        </div>
      </div>
    </div>
  );
}
