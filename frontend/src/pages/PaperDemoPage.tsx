import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PaperCandidateTriplesPanel } from "../components/paper-demo/PaperCandidateTriplesPanel";
import { PaperDemoIconRail } from "../components/paper-demo/PaperDemoIconRail";
import { PaperExplanationPanel } from "../components/paper-demo/PaperExplanationPanel";
import { PaperFigureCaptions } from "../components/paper-demo/PaperFigureCaptions";
import { PaperGraphPanel } from "../components/paper-demo/PaperGraphPanel";
import { PaperModeToggle } from "../components/demo/PaperModeToggle";
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

  const userDecision = decisions[selectedCandidateId] ?? null;
  /** Running-example graph (c1 / t4) always reflects the main candidate decision. */
  const mainExampleDecision = decisions.c1 ?? null;

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

  const selected = useMemo(() => getCandidateById(selectedCandidateId), [selectedCandidateId]);

  useEffect(() => {
    setComment("");
  }, [selectedCandidateId]);

  function handleUserDecision(decision: "accepted" | "rejected") {
    if (selectedCandidateId !== "c1") return;
    setDecisions((prev) => ({ ...prev, c1: decision }));
    commitStep("after");
  }

  function handleReturnToMain() {
    setSelectedCandidateId("c1");
    commitStep("missing");
  }

  function handleResetMainValidation() {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next.c1;
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

      const digit = e.key >= "1" && e.key <= "7" ? Number.parseInt(e.key, 10) - 1 : -1;
      if (digit >= 0 && digit < order.length) {
        e.preventDefault();
        commitStep(order[digit]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStep, captureMode, commitStep, screenshotMode, setSearchParams]);

  const showPresenterExtras = !screenshotMode && !captureMode;

  return (
    <div
      className={`paper-demo min-h-screen bg-slate-50 text-slate-900 ${screenshotMode ? "paper-demo-screenshot" : ""}`}
      data-testid="paper-demo-root"
    >
      <div className="paper-demo-layout">
        <header className="paper-demo-header border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[17px] font-semibold leading-snug tracking-tight text-slate-900">
                  OMNIA — Interactive Knowledge Graph Completion
                </h1>
                <span
                  className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                  data-testid="paper-demo-data-badge"
                >
                  Offline COVID-Fact running example
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-slate-600">{OFFLINE_NOTE}</p>
              {!screenshotMode && !captureMode ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Stage shortcuts: keys <kbd className="rounded border border-slate-300 bg-slate-100 px-1">1</kbd>–
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1">7</kbd> and arrows{" "}
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1">←</kbd>
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1">→</kbd>.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
              {!screenshotMode && !captureMode ? <PaperModeToggle /> : null}
              {!captureMode ? (
                <button
                  type="button"
                  onClick={() => setScreenshotMode((v) => !v)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                  data-testid="paper-screenshot-mode-btn"
                >
                  {screenshotMode ? "Exit screenshot mode" : "Paper screenshot mode"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="paper-demo-rail-wrap min-h-0 border-b border-slate-200 lg:border-b-0">
          <PaperDemoIconRail screenshotMode={screenshotMode} captureMode={captureMode} />
        </div>

        <div className="paper-demo-candidates min-h-0 overflow-hidden">
          <PaperCandidateTriplesPanel
            candidates={PAPER_DEMO_CANDIDATES}
            selectedId={selectedCandidateId}
            onSelect={setSelectedCandidateId}
            screenshotMode={screenshotMode}
          />
        </div>

        <div className="paper-demo-graph min-h-0 overflow-hidden">
          <PaperGraphPanel
            activeStep={activeStep}
            onStepChange={commitStep}
            curatorDecision={mainExampleDecision}
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
          />
        </div>

        <div className="paper-demo-caption" id="paper-demo-script-section">
          {showPresenterExtras ? (
            <>
              <details className="border-t border-slate-200 bg-white px-4 py-2 text-[12px] text-slate-800" data-testid="paper-presenter-notes">
                <summary className="cursor-pointer select-none font-semibold text-slate-900">Presenter note</summary>
                <p className="mt-2 leading-snug text-slate-700">
                  Here we show the missing triple t4. It is not in the original KG but is entailed by f2 and the shared
                  relation–tail key (inhibits, 2019-ncov), which motivates OMNIA candidate generation.
                </p>
              </details>
              <div
                className="border-t border-slate-200 bg-slate-50/80 px-4 py-2 text-[11px] leading-snug text-slate-800"
                data-testid="paper-demo-script-checklist"
              >
                <div className="font-semibold text-slate-900">Demo script (conference)</div>
                <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-slate-700">
                  <li>Show Before KG</li>
                  <li>Show Missing Triple</li>
                  <li>Show Cluster Evidence</li>
                  <li>Show TransE Filtering</li>
                  <li>Show LLM Validation (expand evidence, follow-up Q&amp;A, raw prompt)</li>
                  <li>Accept or Reject c1 — graph updates (or use Reset to try the other path)</li>
                  <li>Show After KG</li>
                  <li>Show Diff (side-by-side reflects curator outcome)</li>
                </ol>
                <p className="mt-2 border-t border-slate-200/80 pt-2 text-[10px] leading-snug text-slate-600">
                  Narrative: original KG → missing t4 → shared relation–tail key → TransE filter → LLM/RAG validation →
                  curator decision → completed KG (human-in-the-loop). Use the rail to jump to candidates, graph,
                  validation, or the full live demo.
                </p>
              </div>
            </>
          ) : null}
          <PaperFigureCaptions />
        </div>
      </div>
    </div>
  );
}
