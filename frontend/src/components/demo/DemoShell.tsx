import type { ReactNode } from "react";
import clsx from "clsx";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { PaperModeToggle } from "./PaperModeToggle";

interface DemoShellProps {
  metricsBar: ReactNode;
  stepRail: ReactNode;
  graphArea: ReactNode;
  rightPanel: ReactNode;
  busy?: boolean;
  caption?: ReactNode;
  onRunPipeline?: () => void;
  onRefresh?: () => void;
}

/**
 * `/demo` chrome wrapper.
 *
 * Owns the responsive grid (CSS named areas), header actions, and the
 * paper-mode toggle so `DemoWorkbenchPage` stays focused on data wiring.
 *
 * Areas:
 *   - demo-header
 *   - demo-steps
 *   - demo-graph
 *   - demo-explanation
 */
export function DemoShell({
  metricsBar,
  stepRail,
  graphArea,
  rightPanel,
  busy,
  caption,
  onRunPipeline,
  onRefresh,
}: DemoShellProps) {
  return (
    <div data-paper-mode="off" className={clsx("min-h-screen bg-slate-50 text-slate-900", "demo-standard-mode")}>
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 px-3 py-4 lg:px-6">
        <header data-testid="demo-shell-header" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs" data-testid="demo-shell-title-row">
            <span className="font-semibold tracking-tight text-slate-800">OMNIA paper demo</span>
            <PaperModeToggle />
          </div>
          <div className="flex flex-wrap gap-2" data-testid="demo-shell-actions">
            {onRunPipeline ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRunPipeline}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run OMNIA pipeline
              </button>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRefresh}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800"
              >
                <RefreshCw className="h-4 w-4" /> Refresh data
              </button>
            ) : null}
          </div>
        </header>

        <div data-testid="demo-shell-metrics" data-area="demo-header">
          {metricsBar}
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,20rem)] xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,22rem)]">
          <aside data-area="demo-steps" data-testid="demo-shell-steps">
            {stepRail}
          </aside>
          <main
            data-area="demo-graph"
            className="flex min-h-0 flex-col gap-4"
            data-testid="demo-shell-graph"
          >
            {graphArea}
          </main>
          <section
            data-area="demo-explanation"
            className="flex min-h-0 flex-col gap-4"
            data-testid="demo-shell-explanation"
          >
            {rightPanel}
          </section>
        </div>

        {caption ? (
          <footer
            data-testid="demo-shell-caption"
            className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600"
          >
            {caption}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
