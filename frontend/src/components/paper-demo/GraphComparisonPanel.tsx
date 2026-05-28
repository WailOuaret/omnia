import { KGGraph } from "../graph/KGGraph";
import { BenchmarkMiniGraph } from "./BenchmarkMiniGraph";
import { PaperCovidExampleGraph } from "./PaperCovidExampleGraph";
import { getCandidateById } from "./paperDemoScenario";
import type { PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";
import type { GraphPayload } from "../../types";
import type { DemoCandidate, DemoDatasetConfig } from "../../demo-data/types";
import { originalOnlyGraphPayload } from "../../lib/sessionSliceToGraphPayload";
import type { UserFeedback } from "../../stores/feedbackStore";
import type { GraphViewMode } from "../../lib/graphViewMode";
import { GraphViewToolbar } from "./GraphViewToolbar";

type Decision = "accept" | "reject" | "uncertain" | "correct";

interface GraphComparisonPanelProps {
  dataset: DemoDatasetConfig;
  selectedCandidate?: DemoCandidate | null;
  feedbackDecisions: Record<string, Decision>;
  feedbackEvents: UserFeedback[];
  interactiveGraphPayload?: GraphPayload | null;
  graphViewMode?: GraphViewMode;
  onGraphViewModeChange?: (mode: GraphViewMode) => void;
}

const COVID_CANDIDATE_MAP: Record<string, string> = {
  "cov-c1": "c1",
  "cov-c2": "c4",
  "cov-c3": "c2",
};

function mapDecisionToPaper(decision?: Decision | null): UserRefinementDecision {
  if (decision === "accept" || decision === "correct") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "uncertain") return "uncertain";
  return null;
}

function latestByCandidate(events: UserFeedback[]): Record<string, UserFeedback> {
  const map: Record<string, UserFeedback> = {};
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const event of sorted) {
    map[event.candidateId] = event;
  }
  return map;
}

interface DiffRow {
  head: string;
  relation: string;
  tail: string;
  provenance: "human_confirmed" | "human_corrected" | "human_rejected" | "needs_expert_review";
  originalCandidate?: { head: string; relation: string; tail: string };
}

function buildDiffSummary(events: UserFeedback[]): {
  added: DiffRow[];
  corrected: DiffRow[];
  rejected: DiffRow[];
  reviewQueue: DiffRow[];
} {
  const latest = latestByCandidate(events);
  const added: DiffRow[] = [];
  const corrected: DiffRow[] = [];
  const rejected: DiffRow[] = [];
  const reviewQueue: DiffRow[] = [];
  for (const event of Object.values(latest)) {
    if (event.userDecision === "accept") {
      added.push({
        head: event.head,
        relation: event.relation,
        tail: event.tail,
        provenance: "human_confirmed",
      });
    } else if (event.userDecision === "reject") {
      rejected.push({
        head: event.head,
        relation: event.relation,
        tail: event.tail,
        provenance: "human_rejected",
      });
    } else if (event.userDecision === "uncertain") {
      reviewQueue.push({
        head: event.head,
        relation: event.relation,
        tail: event.tail,
        provenance: "needs_expert_review",
      });
    } else if (event.userDecision === "correct" && event.correctedTriple) {
      rejected.push({
        head: event.head,
        relation: event.relation,
        tail: event.tail,
        provenance: "human_rejected",
      });
      corrected.push({
        head: event.correctedTriple.head,
        relation: event.correctedTriple.relation,
        tail: event.correctedTriple.tail,
        provenance: "human_corrected",
        originalCandidate: {
          head: event.head,
          relation: event.relation,
          tail: event.tail,
        },
      });
    }
  }
  return { added, corrected, rejected, reviewQueue };
}

function DiffRowList({
  title,
  badge,
  rows,
  badgeClass,
  emptyMessage,
}: {
  title: string;
  badge: string;
  rows: DiffRow[];
  badgeClass: string;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-semibold text-slate-900">{title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
          {badge} · {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row, index) => (
            <li key={`${row.head}-${row.relation}-${row.tail}-${index}`} className="rounded border border-slate-100 bg-slate-50 p-1.5">
              <div className="font-mono text-[11px] text-slate-800">
                ({row.head}, {row.relation}, {row.tail})
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                provenance: {row.provenance}
                {row.originalCandidate ? (
                  <>
                    {" "}
                    · replaces (<span className="font-mono normal-case">
                      {row.originalCandidate.head}, {row.originalCandidate.relation}, {row.originalCandidate.tail}
                    </span>)
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildCovidFeedbackDecisions(events: UserFeedback[]): Record<string, UserRefinementDecision> {
  const latest = latestByCandidate(events);
  const map: Record<string, UserRefinementDecision> = {};
  for (const [candidateId, event] of Object.entries(latest)) {
    const paperId = COVID_CANDIDATE_MAP[candidateId];
    if (!paperId) continue;
    map[paperId] = mapDecisionToPaper(event.userDecision);
  }
  return map;
}

function CovidComparison({
  dataset,
  selectedCandidate,
  feedbackEvents,
}: {
  dataset: DemoDatasetConfig;
  selectedCandidate?: DemoCandidate | null;
  feedbackEvents: UserFeedback[];
}) {
  const paperCandidateId = selectedCandidate
    ? COVID_CANDIDATE_MAP[selectedCandidate.candidateId] ?? "c1"
    : "c1";
  const paperCandidate = getCandidateById(paperCandidateId);
  const feedbackDecisions = buildCovidFeedbackDecisions(feedbackEvents);
  void dataset;

  const beforeStep: PaperDemoStep = "before";
  const afterStep: PaperDemoStep = "after";
  const graphHeightStyle = { height: "480px" };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-900">
          <span>Before completion — original KG</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
            original
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-100 bg-slate-50" style={graphHeightStyle}>
          <PaperCovidExampleGraph step={beforeStep} selectedCandidate={paperCandidate} selectedDecision={null} />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-900">
          <span>After completion — completed KG</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
            completed
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-100 bg-slate-50" style={graphHeightStyle}>
          <PaperCovidExampleGraph
            step={afterStep}
            selectedCandidate={paperCandidate}
            selectedDecision={null}
            feedbackDecisions={feedbackDecisions}
          />
        </div>
      </div>
    </div>
  );
}

function BenchmarkComparison({
  dataset,
  selectedCandidate,
  feedbackDecisions,
}: {
  dataset: DemoDatasetConfig;
  selectedCandidate?: DemoCandidate | null;
  feedbackDecisions: Record<string, Decision>;
}) {
  const graphHeightStyle = { height: "480px" };
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-900">
          <span>Before completion — original KG</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
            original
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-100 bg-slate-50" style={graphHeightStyle}>
          <BenchmarkMiniGraph
            dataset={dataset}
            activeStep="kg"
            selectedCandidate={null}
            selectedDecision={null}
            feedbackDecisions={{}}
          />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-900">
          <span>After completion — completed KG</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
            completed
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-100 bg-slate-50" style={graphHeightStyle}>
          <BenchmarkMiniGraph
            dataset={dataset}
            activeStep="completed"
            selectedCandidate={selectedCandidate}
            selectedDecision={null}
            feedbackDecisions={feedbackDecisions}
          />
        </div>
      </div>
    </div>
  );
}

function InteractiveGraphComparison({ graph, datasetLabel }: { graph: GraphPayload; datasetLabel: string }) {
  const originalGraph = originalOnlyGraphPayload(graph);
  const graphHeightStyle = { minHeight: "520px" };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-900">
          <span>Before completion — original KG</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
            original
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-100 bg-slate-950" style={graphHeightStyle}>
          <KGGraph
            graph={originalGraph}
            title={`${datasetLabel} original slice`}
            description="Original graph sample before human feedback is applied."
            fitViewKey={`original-${originalGraph.displayed_nodes}-${originalGraph.displayed_triples}`}
            compactChrome
            canvasHeight="h-[clamp(28rem,65vh,52rem)]"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-900">
          <span>After completion — completed KG</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
            completed
          </span>
        </div>
        <div className="overflow-hidden rounded border border-slate-100 bg-slate-950" style={graphHeightStyle}>
          <KGGraph
            graph={graph}
            title={`${datasetLabel} completed slice`}
            description="Backend slice with accepted, rejected, uncertain, and corrected feedback reflected in edge states."
            fitViewKey={`completed-${graph.displayed_nodes}-${graph.displayed_triples}`}
            compactChrome
            canvasHeight="h-[clamp(28rem,65vh,52rem)]"
          />
        </div>
      </div>
    </div>
  );
}

export function GraphComparisonPanel({
  dataset,
  selectedCandidate,
  feedbackDecisions,
  feedbackEvents,
  interactiveGraphPayload,
  graphViewMode = "guided",
  onGraphViewModeChange,
}: GraphComparisonPanelProps) {
  const summary = buildDiffSummary(feedbackEvents);
  const feedbackDelta =
    summary.added.length + summary.corrected.length + summary.rejected.length + summary.reviewQueue.length;
  const noFeedbackYet = feedbackEvents.length === 0 || feedbackDelta === 0;

  const originalFromGraph = dataset.graph.edges.filter(
    (edge) => edge.status === "known" || !edge.status,
  ).length;
  const originalTriples =
    originalFromGraph > 0
      ? originalFromGraph
      : interactiveGraphPayload?.displayed_triples ?? dataset.triples ?? 0;
  const finalTriples = originalTriples + summary.added.length + summary.corrected.length;

  return (
    <section className="space-y-3" data-testid="graph-comparison-panel">
      <p className="text-sm text-slate-700">See what changed after feedback.</p>

      {noFeedbackYet ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm italic text-slate-500">
          No feedback given yet. Go to Step 6 to accept or reject candidates, then return here to see the
          completed graph.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Original triples", originalTriples],
            ["Accepted additions", summary.added.length],
            ["Corrected triples", summary.corrected.length],
            ["Rejected candidates", summary.rejected.length],
            ["Review queue", summary.reviewQueue.length],
            ["Final triples", finalTriples],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center"
            >
              <div className="text-lg font-semibold text-slate-900">{value as number}</div>
              <div className="text-[11px] text-slate-600">{label as string}</div>
            </div>
          ))}
        </div>
      )}

      {onGraphViewModeChange ? (
        <GraphViewToolbar
          activeStep="completed"
          viewMode={graphViewMode}
          onViewModeChange={onGraphViewModeChange}
        />
      ) : null}

      {!noFeedbackYet && interactiveGraphPayload ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
          <KGGraph
            graph={interactiveGraphPayload}
            title={`${dataset.label} — changes after feedback`}
            description=""
            compactChrome
            canvasHeight="h-[clamp(24rem,55vh,40rem)]"
          />
        </div>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Show detailed before/after graph comparison
        </summary>
        <div className="mt-3">
          {interactiveGraphPayload ? (
            <InteractiveGraphComparison graph={interactiveGraphPayload} datasetLabel={dataset.label} />
          ) : dataset.id === "covidFact" ? (
            <CovidComparison dataset={dataset} selectedCandidate={selectedCandidate} feedbackEvents={feedbackEvents} />
          ) : (
            <BenchmarkComparison
              dataset={dataset}
              selectedCandidate={selectedCandidate}
              feedbackDecisions={feedbackDecisions}
            />
          )}
        </div>
      </details>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DiffRowList
          title="Added"
          badge="accept"
          rows={summary.added}
          badgeClass="bg-emerald-100 text-emerald-800"
          emptyMessage="No accepted triples yet."
        />
        <DiffRowList
          title="Corrected"
          badge="correct"
          rows={summary.corrected}
          badgeClass="bg-violet-100 text-violet-800"
          emptyMessage="No corrections submitted yet."
        />
        <DiffRowList
          title="Rejected"
          badge="reject"
          rows={summary.rejected}
          badgeClass="bg-rose-100 text-rose-800"
          emptyMessage="No rejections yet."
        />
        <DiffRowList
          title="Review queue"
          badge="uncertain"
          rows={summary.reviewQueue}
          badgeClass="bg-amber-100 text-amber-800"
          emptyMessage="Nothing waiting for expert review."
        />
      </div>
    </section>
  );
}
