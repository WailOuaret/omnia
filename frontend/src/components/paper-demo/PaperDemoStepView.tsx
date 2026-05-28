import { useMemo, useState, type ReactNode } from "react";
import { GraphComparisonPanel } from "./GraphComparisonPanel";
import { CandidateTripleCard } from "./CandidateTripleCard";
import { RestoredGraphStagePanel } from "./RestoredGraphStagePanel";
import { UserFeedbackPanel } from "./UserFeedbackPanel";
import type { DemoCandidate, DemoCluster, DemoDatasetConfig } from "../../demo-data/types";
import type { FeedbackStatus } from "../../hooks/useFeedbackBridge";
import { formatKgInline, formatKgLabelParts } from "../../lib/kgLabels";
import type { UserFeedback } from "../../stores/feedbackStore";
import type { GraphPayload } from "../../types";
import type { GraphSelection } from "./LiveGraphPanel";
import type { GraphViewMode } from "../../lib/graphViewMode";
import { GraphViewToolbar } from "./GraphViewToolbar";
import { filteringUnavailableMessage, llmUnavailableMessage } from "../../lib/demoCopy";

type Decision = "accept" | "reject" | "uncertain" | "correct";
type StepId = "kg" | "clustering" | "candidates" | "filtering" | "llm" | "feedback" | "completed";

type GraphStageExtras = Pick<
  PaperDemoStepViewProps,
  | "graphViewMode"
  | "onGraphViewModeChange"
  | "onShowAllMembers"
  | "onShowAllCandidates"
  | "onExpandContext"
  | "expandContextPending"
  | "graphFocusRequest"
  | "filteringAvailable"
  | "llmAvailable"
>;

interface PaperDemoStepViewProps {
  step: StepId;
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  feedbackCandidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  selectedCandidateId: string;
  onSelectCandidate: (candidateId: string) => void;
  selectedClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  latestDecisionForSelected: Decision | null;
  feedbackDecisions: Record<string, Decision>;
  feedbackEvents: UserFeedback[];
  bridgeStatus: FeedbackStatus;
  onFeedbackSubmit: (feedback: UserFeedback) => void;
  datasetId: DemoDatasetConfig["id"];
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  useStaticPaperGraph?: boolean;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
  onExpandContext?: () => void;
  expandContextPending?: boolean;
  graphFocusRequest?: number;
  graphViewMode?: GraphViewMode;
  onGraphViewModeChange?: (mode: GraphViewMode) => void;
  onShowAllMembers?: () => void;
  onShowAllCandidates?: () => void;
}

function fmt(n: number) {
  return n.toLocaleString();
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <p className="font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function KgLabel({
  id,
  label,
  kind = "entity",
  compact = false,
  inverse = false,
}: {
  id: string;
  label?: string | null;
  kind?: "entity" | "relation" | "value";
  compact?: boolean;
  inverse?: boolean;
}) {
  const parts = formatKgLabelParts(id, label, kind);
  return (
    <span
      className="block min-w-0"
    >
      <span className={`block truncate font-semibold ${compact ? "text-xs" : "text-sm"} ${inverse ? "text-white" : "text-slate-900"}`}>
        {parts.primary}
      </span>
      <span className={`block truncate font-mono text-[10px] ${inverse ? "text-slate-300" : "text-slate-500"}`}>
        {!parts.isRawId && parts.secondary !== parts.primary ? parts.secondary : ""}
      </span>
    </span>
  );
}

function EmptyStepBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {children}
    </div>
  );
}

/** Graph-only stage — step explanations live in the inspector Explanation tab. */
function GraphStage({ graph }: { graph: ReactNode }) {
  return <div className="min-w-0 w-full">{graph}</div>;
}

function StepGraph({
  dataset,
  activeStep,
  selectedCandidate,
  selectedDecision,
  feedbackDecisions,
  interactiveGraphPayload,
  useStaticPaperGraph,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  onSelectCandidate,
  onExpandContext,
  expandContextPending,
  filteringAvailable = true,
  llmAvailable = true,
  graphFocusRequest = 0,
  graphViewMode = "guided",
  onGraphViewModeChange,
  onShowAllMembers,
  onShowAllCandidates,
}: {
  dataset: DemoDatasetConfig;
  activeStep: StepId;
  selectedCandidate?: DemoCandidate | null;
  selectedDecision?: Decision | null;
  feedbackDecisions: Record<string, Decision>;
  interactiveGraphPayload?: GraphPayload | null;
  useStaticPaperGraph: boolean;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  onSelectCandidate: (id: string) => void;
  onExpandContext?: () => void;
  expandContextPending?: boolean;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
  graphFocusRequest?: number;
  graphViewMode?: GraphViewMode;
  onGraphViewModeChange?: (mode: GraphViewMode) => void;
  onShowAllMembers?: () => void;
  onShowAllCandidates?: () => void;
}) {
  return (
    <RestoredGraphStagePanel
      dataset={dataset}
      activeStep={activeStep}
      selectedCandidate={selectedCandidate ?? null}
      selectedDecision={selectedDecision ?? null}
      feedbackDecisions={feedbackDecisions}
      graphPayload={interactiveGraphPayload}
      sessionId={sessionId}
      selectedClusterId={selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onCandidateSelect={onSelectCandidate}
      onExpandContext={onExpandContext}
      expandContextPending={expandContextPending}
      filteringAvailable={filteringAvailable}
      llmAvailable={llmAvailable}
      useStaticPaperGraph={useStaticPaperGraph}
      focusRequest={graphFocusRequest}
      viewMode={graphViewMode}
      onViewModeChange={onGraphViewModeChange}
      onShowAllMembers={onShowAllMembers}
      onShowAllCandidates={onShowAllCandidates}
    />
  );
}

function CandidateSelectorPills({
  step,
  candidates,
  selectedCandidate,
  onSelectCandidate,
}: {
  step: StepId;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (candidateId: string) => void;
}) {
  if (candidates.length === 0) return null;
  const label =
    step === "feedback"
      ? "Candidates ready for review"
      : step === "completed"
        ? "Candidates affecting completed KG"
        : "Candidates";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
      <p className="font-semibold text-slate-900">{label}</p>
      <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-auto pr-1">
        {candidates.map((candidate) => (
          <button
            key={candidate.candidateId}
            type="button"
            onClick={() => onSelectCandidate(candidate.candidateId)}
            className={`rounded border px-2 py-1 text-xs ${
              selectedCandidate?.candidateId === candidate.candidateId
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
            title={`(${candidate.head}, ${candidate.relation}, ${candidate.tail})`}
          >
            {candidate.candidateId}: {formatKgInline(candidate.head)} -&gt; {formatKgInline(candidate.tail)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProcessRail({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div key={item} className="flex items-center gap-2">
            <span className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-900">
              {item}
            </span>
            {index < items.length - 1 ? <span className="text-slate-400">down</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateTriple({ candidate, inverse = false }: { candidate: DemoCandidate; inverse?: boolean }) {
  const labelClass = inverse ? "text-slate-300" : "text-slate-500";
  return (
    <div className="grid min-w-0 gap-1 text-xs">
      <div className="min-w-0">
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}>Head</p>
        <KgLabel id={candidate.head} compact inverse={inverse} />
      </div>
      <div className="min-w-0">
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}>Relation</p>
        <KgLabel id={candidate.relation} label={candidate.relation} kind="relation" compact inverse={inverse} />
      </div>
      <div className="min-w-0">
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}>Tail</p>
        <KgLabel id={candidate.tail} compact inverse={inverse} />
      </div>
    </div>
  );
}

function DistanceBar({
  distance,
  threshold,
  status,
}: {
  distance: number;
  threshold: number;
  status?: string;
}) {
  const max = Math.max(distance, threshold, 1);
  const distancePct = Math.min(100, Math.max(0, (distance / max) * 100));
  const thresholdPct = Math.min(100, Math.max(0, (threshold / max) * 100));
  const kept = distance <= threshold;
  return (
    <div>
      <div className="relative h-3 rounded-full bg-slate-100">
        <div
          className={`h-3 rounded-full ${kept ? "bg-emerald-500" : "bg-rose-500"}`}
          style={{ width: `${Math.max(4, distancePct)}%` }}
        />
        <span
          className="absolute top-[-3px] h-5 w-0.5 bg-slate-900"
          style={{ left: `${thresholdPct}%` }}
          title={`threshold ${threshold.toFixed(2)}`}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
        <span>Distance: {distance.toFixed(2)}</span>
        <span>Threshold: {threshold.toFixed(2)}</span>
        <span className={`font-semibold uppercase ${kept ? "text-emerald-700" : "text-rose-700"}`}>
          {status ?? (kept ? "kept" : "removed")}
        </span>
      </div>
    </div>
  );
}

function clusterCandidateCount(candidates: DemoCandidate[], clusterId: string) {
  return candidates.filter((candidate) => candidate.clusterIds?.includes(clusterId)).length;
}

function KGStepView({
  dataset,
  feedbackDecisions,
  useStaticPaperGraph,
  interactiveGraphPayload,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  onSelectCandidate,
  ...graphStage
}: {
  dataset: DemoDatasetConfig;
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  onSelectCandidate: (id: string) => void;
} & GraphStageExtras) {
  const graph = (
    <StepGraph
      dataset={dataset}
      activeStep="kg"
      feedbackDecisions={feedbackDecisions}
      interactiveGraphPayload={interactiveGraphPayload}
      useStaticPaperGraph={useStaticPaperGraph}
      sessionId={sessionId}
      selectedClusterId={selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onSelectCandidate={onSelectCandidate}
      {...graphStage}
    />
  );
  return <GraphStage graph={graph} />;
}

function KGStepExplanation({ dataset }: { dataset: DemoDatasetConfig }) {
  const knownCount = dataset.graph.edges.filter((edge) => edge.status === "known" || !edge.status).length;
  const missingCount = dataset.graph.edges.filter((edge) => edge.status === "missing").length;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <StatChip label="Entities" value={fmt(dataset.entities)} />
        <StatChip label="Relations" value={fmt(dataset.relations)} />
        <StatChip label="Original triples" value={fmt(dataset.triples)} />
        <StatChip label="Task" value="Find missing triples" />
      </div>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        Showing the incomplete KG. {knownCount} known edges
        {missingCount > 0 ? `, ${missingCount} missing target edge${missingCount === 1 ? "" : "s"}` : ""}.
      </p>
      {dataset.id === "covidFact" && missingCount > 0 ? (
        <EmptyStepBanner>
          The dashed orange edge marks the missing target triple (chloroquine, treats, sars-cov-2). It is shown as a candidate, not as already accepted.
        </EmptyStepBanner>
      ) : null}
      {dataset.id === "wn18rr" ? (
        <EmptyStepBanner>
          WordNet synset labels are hard to verbalise reliably, so triple-based RAG is preferred for this dataset.
        </EmptyStepBanner>
      ) : null}
    </div>
  );
}

function ClusteringStepView({
  dataset,
  candidates,
  feedbackDecisions,
  useStaticPaperGraph,
  interactiveGraphPayload,
  sessionId,
  selectedClusterId,
  onSelectCluster,
  onGraphSelectionChange,
  onSelectCandidate,
  ...graphStage
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  onSelectCandidate: (id: string) => void;
} & GraphStageExtras) {
  const selectedCluster =
    dataset.clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;
  const graph = (
    <StepGraph
      dataset={dataset}
      activeStep="clustering"
      feedbackDecisions={feedbackDecisions}
      interactiveGraphPayload={interactiveGraphPayload}
      useStaticPaperGraph={useStaticPaperGraph}
      sessionId={sessionId}
      selectedClusterId={selectedCluster?.id ?? selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onSelectCandidate={onSelectCandidate}
      {...graphStage}
    />
  );

  return <GraphStage graph={graph} />;
}

function clusterMatchesQuery(
  cluster: DemoCluster,
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const relationText = formatKgInline(cluster.sharedRelation, cluster.sharedRelation, "relation");
  const tailText = formatKgInline(cluster.sharedTail);
  const haystack = [
    cluster.id,
    cluster.sharedRelation,
    cluster.sharedTail,
    relationText,
    tailText,
    ...cluster.entities,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function ClusteringStepExplanation({
  dataset,
  candidates,
  selectedClusterId,
  onSelectCluster,
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [browseClusters, setBrowseClusters] = useState(false);
  const selectedCluster =
    dataset.clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;
  const candidateCount = selectedCluster
    ? clusterCandidateCount(candidates, selectedCluster.id)
    : 0;
  const filteredClusters = useMemo(() => {
    const sorted = [...dataset.clusters].sort((a, b) => {
      if (a.id === selectedClusterId) return -1;
      if (b.id === selectedClusterId) return 1;
      const candDiff =
        clusterCandidateCount(candidates, b.id) - clusterCandidateCount(candidates, a.id);
      if (candDiff !== 0) return candDiff;
      return b.size - a.size;
    });
    return sorted.filter((cluster) => clusterMatchesQuery(cluster, query));
  }, [dataset.clusters, query, selectedClusterId, candidates]);
  const visibleClusters = filteredClusters.slice(0, 15);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
        <p className="font-semibold">What this step does</p>
        <p className="mt-1 text-xs leading-relaxed">
          OMNIA groups entities when they share the same relation -&gt; tail pattern. These grouped
          entities may share other missing relations.
        </p>
      </div>
      {selectedCluster ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Current pattern</p>
          <p className="mt-1 text-sm text-indigo-900">
            {formatKgInline(selectedCluster.sharedRelation, selectedCluster.sharedRelation, "relation")}{" "}
            -&gt; {formatKgInline(selectedCluster.sharedTail)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <StatChip
              label="Members shown"
              value={`${Math.min(5, selectedCluster.entities.length)} / ${selectedCluster.size}`}
            />
            <StatChip label="Generated candidates" value={candidateCount} />
          </div>
          <p className="mt-2 text-slate-600">
            Why useful: similar entities may share missing relations beyond this pattern.
          </p>
          <button
            type="button"
            onClick={() => setShowTechnical((value) => !value)}
            className="mt-3 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {showTechnical ? "Hide technical details" : "Show technical details"}
          </button>
          {showTechnical ? (
            <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
              <StatChip label="Cluster ID" value={selectedCluster.id} />
              <p>
                <span className="font-semibold">All members:</span>{" "}
                {selectedCluster.entities.map((entity) => formatKgInline(entity)).join(", ")}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyStepBanner>Select a cluster to inspect its shared pattern.</EmptyStepBanner>
      )}
      <button
        type="button"
        onClick={() => setBrowseClusters((value) => !value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
      >
        {browseClusters ? "Hide cluster browser" : "Browse clusters"}
      </button>
      {browseClusters ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[11px] text-slate-600">
            Click a row to update the graph pattern. Search matches relation names (e.g. &quot;occupation&quot;,
            &quot;member&quot;) as well as IDs.
          </p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clusters, relation, tail, member"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
          <div className="mt-2 max-h-56 overflow-auto pr-1">
            {visibleClusters.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-900">
                No clusters match &quot;{query.trim()}&quot;. Try &quot;occupation&quot; or a cluster ID.
              </p>
            ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1 pr-2 w-16">Cluster</th>
                  <th className="py-1 pr-2 min-w-0">Pattern</th>
                  <th className="py-1 pr-2 w-14 text-right">Members</th>
                  <th className="py-1 w-14 text-right">Cands</th>
                </tr>
              </thead>
              <tbody>
                {visibleClusters.map((cluster) => {
                  const isSelected = selectedCluster?.id === cluster.id;
                  const pattern = `${formatKgInline(cluster.sharedRelation, cluster.sharedRelation, "relation")} -> ${formatKgInline(cluster.sharedTail)}`;
                  return (
                    <tr
                      key={cluster.id}
                      onClick={() => onSelectCluster?.(cluster.id)}
                      className={`cursor-pointer border-t border-slate-100 ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-2 pr-2 font-mono text-slate-900 align-top">{cluster.id}</td>
                      <td className="py-2 pr-2 min-w-0 max-w-[180px] align-top">
                        <span className="block truncate text-slate-800" title={pattern}>
                          {pattern}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-700 align-top">{cluster.size}</td>
                      <td className="py-2 text-right text-slate-700 align-top">
                        {clusterCandidateCount(candidates, cluster.id)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
          {filteredClusters.length > 15 ? (
            <p className="mt-2 text-[10px] text-slate-500">
              Showing 15 of {filteredClusters.length} matches. Refine your search to narrow results.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CandidateGenStepView({
  dataset,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  feedbackDecisions,
  useStaticPaperGraph,
  interactiveGraphPayload,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  ...graphStage
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
} & GraphStageExtras) {
  const sourceCluster = dataset.clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;
  const graph = (
    <StepGraph
      dataset={dataset}
      activeStep="candidates"
      selectedCandidate={selectedCandidate}
      feedbackDecisions={feedbackDecisions}
      interactiveGraphPayload={interactiveGraphPayload}
      useStaticPaperGraph={useStaticPaperGraph}
      sessionId={sessionId}
      selectedClusterId={sourceCluster?.id ?? selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onSelectCandidate={onSelectCandidate}
      {...graphStage}
    />
  );

  return <GraphStage graph={graph} />;
}

function CandidateGenStepExplanation({
  dataset,
  candidates,
  selectedCandidate,
  selectedClusterId,
  onSelectCandidate,
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  selectedClusterId?: string | null;
  onSelectCandidate: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const clusterCandidates = selectedClusterId
    ? candidates.filter((candidate) => candidate.clusterIds?.includes(selectedClusterId))
    : candidates;
  const visibleCandidates = showAll ? clusterCandidates : clusterCandidates.slice(0, 4);
  const sourceCluster = dataset.clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        <p className="font-semibold">What this step does</p>
        <p className="mt-1 text-xs leading-relaxed">
          OMNIA proposes this candidate because similar entities in the selected group share the same
          relation -&gt; tail pattern.
        </p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
        <p>
          <span className="font-semibold">Solid line</span> = existing KG relation
        </p>
        <p className="mt-0.5">
          <span className="font-semibold text-blue-800">Dashed blue line</span> = proposed missing triple
        </p>
      </div>
      {sourceCluster ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Current pattern</p>
          <p className="mt-1 text-sm">
            {formatKgInline(sourceCluster.sharedRelation, sourceCluster.sharedRelation, "relation")}{" "}
            -&gt; {formatKgInline(sourceCluster.sharedTail)}
          </p>
          <StatChip label="Candidates in cluster" value={clusterCandidates.length} />
        </div>
      ) : null}
      {clusterCandidates.length === 0 ? (
        <EmptyStepBanner>No generated candidates are available for this cluster.</EmptyStepBanner>
      ) : null}
      {selectedCandidate ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">Selected candidate</h3>
          <div className="mt-2">
            <CandidateTriple candidate={selectedCandidate} />
          </div>
          <button
            type="button"
            onClick={() => setShowTechnical((value) => !value)}
            className="mt-3 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {showTechnical ? "Hide technical details" : "Show technical details"}
          </button>
          {showTechnical ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <StatChip label="Candidate ID" value={selectedCandidate.candidateId} />
              <StatChip label="Source cluster" value={selectedCandidate.clusterIds?.join(", ") ?? "n/a"} />
              <StatChip label="Status" value={selectedCandidate.status} />
              <StatChip
                label="Why generated"
                value={selectedCandidate.whyGenerated ?? "Similar entities in this group share the same pattern."}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {clusterCandidates.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Other candidates</h3>
            <span className="text-[10px] text-slate-500">
              {visibleCandidates.length} of {clusterCandidates.length}
            </span>
          </div>
          <div className="mt-2 max-h-48 space-y-1.5 overflow-auto pr-1">
            {visibleCandidates.map((candidate) => {
              const isSelected = selectedCandidate?.candidateId === candidate.candidateId;
              return (
                <button
                  key={candidate.candidateId}
                  type="button"
                  onClick={() => onSelectCandidate(candidate.candidateId)}
                  className={`block w-full rounded-md border p-2 text-left ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <CandidateTriple candidate={candidate} inverse={isSelected} />
                </button>
              );
            })}
          </div>
          {clusterCandidates.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              {showAll ? "Show first 4" : "Show all candidates"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilteringStepView({
  dataset,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  feedbackDecisions,
  useStaticPaperGraph,
  interactiveGraphPayload,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  ...graphStage
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
} & GraphStageExtras) {
  const graph = (
    <StepGraph
      dataset={dataset}
      activeStep="filtering"
      selectedCandidate={selectedCandidate}
      feedbackDecisions={feedbackDecisions}
      interactiveGraphPayload={interactiveGraphPayload}
      useStaticPaperGraph={useStaticPaperGraph}
      sessionId={sessionId}
      selectedClusterId={selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onSelectCandidate={onSelectCandidate}
      {...graphStage}
    />
  );

  return <GraphStage graph={graph} />;
}

function FilteringStepExplanation({
  dataset,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  filteringAvailable = false,
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  filteringAvailable?: boolean;
}) {
  const rows = filteringAvailable
    ? candidates.filter(
        (candidate) => typeof candidate.distance === "number" && typeof candidate.threshold === "number" && candidate.threshold > 0,
      )
    : [];
  const keptCount = rows.filter((candidate) => (candidate.distance ?? 0) <= (candidate.threshold ?? 0)).length;
  const removedCount = rows.length - keptCount;
  const thresholdSample = rows[0]?.threshold;
  const avgDistance =
    rows.length > 0 ? rows.reduce((sum, row) => sum + (row.distance ?? 0), 0) / rows.length : null;
  const distances = rows.map((row) => row.distance as number);
  const minDistance = distances.length ? Math.min(...distances) : null;
  const maxDistance = distances.length ? Math.max(...distances) : null;
  const retainedPct = rows.length > 0 ? Math.round((keptCount / rows.length) * 100) : null;

  return (
    <div className="space-y-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">Step 4 — Removing unlikely candidates</p>
          <p className="mt-0.5 text-xs">
            OMNIA scores each proposed triple by how well it fits the graph structure. Candidates that
            score too poorly are discarded here, before the LLM runs.
          </p>
        </div>
        {!filteringAvailable || rows.length === 0 ? (
          <EmptyStepBanner>
            Structural filtering scores are not shown in this prepared scenario. This step shows where
            structural filtering fits in the OMNIA workflow.
          </EmptyStepBanner>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatChip label="Model" value={dataset.filteringStats.model} />
              <StatChip label="Threshold" value={thresholdSample!.toFixed(2)} />
              <StatChip label="Before filtering" value={rows.length} />
              <StatChip label="After filtering" value={keptCount} />
              <StatChip label="Kept" value={keptCount} />
              <StatChip label="Removed" value={removedCount} />
              <StatChip label="Retained" value={retainedPct !== null ? `${retainedPct}%` : "n/a"} />
              <StatChip label="Avg distance" value={avgDistance !== null ? avgDistance.toFixed(2) : "n/a"} />
              {minDistance !== null && maxDistance !== null ? (
                <StatChip label="Min / max distance" value={`${minDistance.toFixed(2)} / ${maxDistance.toFixed(2)}`} />
              ) : null}
            </div>
            <div className="max-h-[320px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
            {rows.map((candidate) => {
              const distance = candidate.distance as number;
              const threshold = candidate.threshold as number;
              const kept = distance <= threshold;
              const isSelected = selectedCandidate?.candidateId === candidate.candidateId;
              return (
                <button
                  key={candidate.candidateId}
                  type="button"
                  onClick={() => onSelectCandidate(candidate.candidateId)}
                  className={`block w-full rounded-lg border p-3 text-left ${isSelected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <p className="font-mono text-[10px] text-slate-500">{candidate.candidateId}</p>
                  <CandidateTriple candidate={candidate} />
                  <div className="mt-2">
                    <DistanceBar distance={distance} threshold={threshold} status={kept ? "kept" : "removed"} />
                  </div>
                </button>
              );
            })}
            </div>
          </>
        )}
    </div>
  );
}

function EvidenceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 text-xs text-slate-700">{children}</div>
    </div>
  );
}

function SemanticValidationStepView({
  dataset,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  feedbackDecisions,
  useStaticPaperGraph,
  interactiveGraphPayload,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  ...graphStage
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
} & GraphStageExtras) {
  const graph = (
    <StepGraph
      dataset={dataset}
      activeStep="llm"
      selectedCandidate={selectedCandidate}
      feedbackDecisions={feedbackDecisions}
      interactiveGraphPayload={interactiveGraphPayload}
      useStaticPaperGraph={useStaticPaperGraph}
      sessionId={sessionId}
      selectedClusterId={selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onSelectCandidate={onSelectCandidate}
      {...graphStage}
    />
  );

  return <GraphStage graph={graph} />;
}

function SemanticValidationStepExplanation({
  dataset,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  llmAvailable = false,
}: {
  dataset: DemoDatasetConfig;
  candidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  llmAvailable?: boolean;
}) {
  const promptMode = dataset.recommendedMode === "sentence-rag" ? "Sentence-based RAG" : "Triple-based RAG";
  const hasLlmData =
    llmAvailable &&
    Boolean(
      selectedCandidate?.llmVerdict ||
        selectedCandidate?.llmRationale ||
        selectedCandidate?.retrievedContext?.length,
    );

  return (
    <div className="space-y-3">
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <p className="font-semibold">LLM validation evidence</p>
          <p className="mt-0.5 text-xs">
            The LLM validates backend candidates after filtering. Green graph edges are valid, red are invalid, amber are uncertain.
          </p>
        </div>
        {!llmAvailable ? (
          <EmptyStepBanner>
            LLM/RAG evidence is not included in this online sample yet. This step is shown to explain
            where semantic validation fits in the OMNIA workflow.
          </EmptyStepBanner>
        ) : null}
        {llmAvailable ? (
          <CandidateSelectorPills
            step="llm"
            candidates={candidates}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={onSelectCandidate}
          />
        ) : null}
        {!selectedCandidate && llmAvailable ? <EmptyStepBanner>No candidate selected.</EmptyStepBanner> : null}
        {selectedCandidate && llmAvailable && !hasLlmData ? (
          <EmptyStepBanner>
            LLM/RAG evidence is not included for this candidate yet. This step shows where semantic validation fits in the workflow.
          </EmptyStepBanner>
        ) : null}
        {selectedCandidate && hasLlmData ? (
          <div className="space-y-2">
            <EvidenceCard title="1. Candidate triple">
              <CandidateTriple candidate={selectedCandidate} />
            </EvidenceCard>
            <EvidenceCard title="2. Structural evidence">
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Distance" value={selectedCandidate.distance?.toFixed(3) ?? "n/a"} />
                <StatChip label="Threshold" value={selectedCandidate.threshold?.toFixed(3) ?? "n/a"} />
                <StatChip label="Source cluster" value={selectedCandidate.clusterIds?.join(", ") ?? "n/a"} />
                <StatChip label="Prompting mode" value={promptMode} />
              </div>
            </EvidenceCard>
            <EvidenceCard title="3. Retrieved context">
              <p className="mb-2 text-[11px] text-slate-500">Top-k: {dataset.llmStats.topK ?? "n/a"}</p>
              {selectedCandidate.retrievedContext && selectedCandidate.retrievedContext.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-auto pr-1">
                  {selectedCandidate.retrievedContext.map((ctx, index) => (
                    <li key={`${ctx}-${index}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono">
                      {ctx}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No retrieved context available.</p>
              )}
            </EvidenceCard>
            <EvidenceCard title="4. LLM judgement">
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Verdict" value={selectedCandidate.llmVerdict ?? "n/a"} />
                <StatChip label="Confidence" value={selectedCandidate.llmConfidence !== undefined ? selectedCandidate.llmConfidence.toFixed(2) : "n/a"} />
              </div>
              {selectedCandidate.llmRationale ? (
                <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">{selectedCandidate.llmRationale}</p>
              ) : null}
            </EvidenceCard>
          </div>
        ) : null}
    </div>
  );
}

function FeedbackStepView({
  dataset,
  datasetId,
  feedbackCandidates,
  selectedCandidate,
  onSelectCandidate,
  latestDecisionForSelected,
  feedbackDecisions,
  feedbackEvents,
  bridgeStatus,
  onFeedbackSubmit,
  useStaticPaperGraph,
  interactiveGraphPayload,
  sessionId,
  selectedClusterId,
  onGraphSelectionChange,
  graphViewMode = "guided",
  onGraphViewModeChange,
  ...graphStage
}: {
  dataset: DemoDatasetConfig;
  datasetId: DemoDatasetConfig["id"];
  feedbackCandidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  latestDecisionForSelected: Decision | null;
  feedbackDecisions: Record<string, Decision>;
  feedbackEvents: UserFeedback[];
  bridgeStatus: FeedbackStatus;
  onFeedbackSubmit: (feedback: UserFeedback) => void;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
} & GraphStageExtras) {
  const existing = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    : undefined;

  const showGraph = graphViewMode === "explore";

  const graph = showGraph ? (
    <StepGraph
      dataset={dataset}
      activeStep="feedback"
      selectedCandidate={selectedCandidate}
      selectedDecision={latestDecisionForSelected}
      feedbackDecisions={feedbackDecisions}
      interactiveGraphPayload={interactiveGraphPayload}
      useStaticPaperGraph={useStaticPaperGraph}
      sessionId={sessionId}
      selectedClusterId={selectedClusterId}
      onGraphSelectionChange={onGraphSelectionChange}
      onSelectCandidate={onSelectCandidate}
      graphViewMode={graphViewMode}
      onGraphViewModeChange={onGraphViewModeChange}
      {...graphStage}
    />
  ) : null;

  return (
    <div className="space-y-3">
      {selectedCandidate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <CandidateTripleCard candidate={selectedCandidate} decision={latestDecisionForSelected} />
          <UserFeedbackPanel
            key={selectedCandidate.candidateId}
            datasetId={datasetId}
            candidate={selectedCandidate}
            onFeedbackSubmit={onFeedbackSubmit}
            existingFeedback={existing}
            bridgeStatus={bridgeStatus}
          />
        </div>
      ) : (
        <EmptyStepBanner>Select a candidate to accept, reject, or correct.</EmptyStepBanner>
      )}
      {onGraphViewModeChange ? (
        <GraphViewToolbar
          activeStep="feedback"
          viewMode={graphViewMode}
          onViewModeChange={onGraphViewModeChange}
        />
      ) : null}
      {graph ? <GraphStage graph={graph} /> : null}
    </div>
  );
}

function FeedbackStepExplanation({
  datasetId,
  feedbackCandidates,
  selectedCandidate,
  onSelectCandidate,
  feedbackEvents,
  bridgeStatus,
  onFeedbackSubmit,
}: {
  datasetId: DemoDatasetConfig["id"];
  feedbackCandidates: DemoCandidate[];
  selectedCandidate: DemoCandidate | null;
  onSelectCandidate: (id: string) => void;
  feedbackEvents: UserFeedback[];
  bridgeStatus: FeedbackStatus;
  onFeedbackSubmit: (feedback: UserFeedback) => void;
}) {
  const existing = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    : undefined;

  return (
    <div className="space-y-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Human-in-the-loop curation</p>
          <p className="mt-0.5 text-xs">
            A human accepts, rejects, corrects, or marks the candidate as uncertain. The graph updates after the decision.
          </p>
        </div>
        <CandidateSelectorPills
          step="feedback"
          candidates={feedbackCandidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
        />
        {selectedCandidate ? (
          <UserFeedbackPanel
            key={selectedCandidate.candidateId}
            datasetId={datasetId}
            candidate={selectedCandidate}
            onFeedbackSubmit={onFeedbackSubmit}
            existingFeedback={existing}
            bridgeStatus={bridgeStatus}
          />
        ) : (
          <EmptyStepBanner>No candidates ready for review.</EmptyStepBanner>
        )}
    </div>
  );
}

function CompletedStepView({
  dataset,
  selectedCandidate,
  feedbackDecisions,
  feedbackEvents,
  interactiveGraphPayload,
  graphViewMode = "guided",
  onGraphViewModeChange,
}: {
  dataset: DemoDatasetConfig;
  selectedCandidate: DemoCandidate | null;
  feedbackDecisions: Record<string, Decision>;
  feedbackEvents: UserFeedback[];
  interactiveGraphPayload?: GraphPayload | null;
  graphViewMode?: GraphViewMode;
  onGraphViewModeChange?: (mode: GraphViewMode) => void;
}) {
  return (
    <GraphComparisonPanel
      dataset={dataset}
      selectedCandidate={selectedCandidate}
      feedbackDecisions={feedbackDecisions}
      feedbackEvents={feedbackEvents}
      interactiveGraphPayload={interactiveGraphPayload}
      graphViewMode={graphViewMode}
      onGraphViewModeChange={onGraphViewModeChange}
    />
  );
}

export function PaperDemoStepExplanation(_props: PaperDemoStepViewProps) {
  return null;
}

export function PaperDemoStepView(props: PaperDemoStepViewProps) {
  const {
    step,
    dataset,
    candidates,
    feedbackCandidates,
    selectedCandidate,
    onSelectCandidate,
    selectedClusterId = null,
    onSelectCluster,
    latestDecisionForSelected,
    feedbackDecisions,
    feedbackEvents,
    bridgeStatus,
    onFeedbackSubmit,
    datasetId,
    interactiveGraphPayload = null,
    sessionId = null,
    onGraphSelectionChange,
    useStaticPaperGraph = true,
    filteringAvailable = false,
    llmAvailable = false,
    onExpandContext,
    expandContextPending = false,
    graphFocusRequest = 0,
    graphViewMode = "guided",
    onGraphViewModeChange,
    onShowAllMembers,
    onShowAllCandidates,
  } = props;

  const graphStageExtras = {
    graphViewMode,
    onGraphViewModeChange,
    onShowAllMembers,
    onShowAllCandidates,
    onExpandContext,
    expandContextPending,
    graphFocusRequest,
    filteringAvailable,
    llmAvailable,
  };

  return (
    <div>
      {step === "kg" ? (
        <KGStepView
          dataset={dataset}
          feedbackDecisions={feedbackDecisions}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onGraphSelectionChange={onGraphSelectionChange}
          onSelectCandidate={onSelectCandidate}
          useStaticPaperGraph={useStaticPaperGraph}
          {...graphStageExtras}
        />
      ) : null}
      {step === "clustering" ? (
        <ClusteringStepView
          dataset={dataset}
          candidates={candidates}
          feedbackDecisions={feedbackDecisions}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onSelectCluster={onSelectCluster}
          onGraphSelectionChange={onGraphSelectionChange}
          onSelectCandidate={onSelectCandidate}
          useStaticPaperGraph={useStaticPaperGraph}
          {...graphStageExtras}
        />
      ) : null}
      {step === "candidates" ? (
        <CandidateGenStepView
          dataset={dataset}
          candidates={candidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
          feedbackDecisions={feedbackDecisions}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onGraphSelectionChange={onGraphSelectionChange}
          useStaticPaperGraph={useStaticPaperGraph}
          {...graphStageExtras}
        />
      ) : null}
      {step === "filtering" ? (
        <FilteringStepView
          dataset={dataset}
          candidates={candidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
          feedbackDecisions={feedbackDecisions}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onGraphSelectionChange={onGraphSelectionChange}
          useStaticPaperGraph={useStaticPaperGraph}
          {...graphStageExtras}
        />
      ) : null}
      {step === "llm" ? (
        <SemanticValidationStepView
          dataset={dataset}
          candidates={candidates.filter((candidate) => candidate.llmVerdict !== undefined)}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
          feedbackDecisions={feedbackDecisions}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onGraphSelectionChange={onGraphSelectionChange}
          useStaticPaperGraph={useStaticPaperGraph}
          {...graphStageExtras}
        />
      ) : null}
      {step === "feedback" ? (
        <FeedbackStepView
          dataset={dataset}
          datasetId={datasetId}
          feedbackCandidates={feedbackCandidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
          latestDecisionForSelected={latestDecisionForSelected}
          feedbackDecisions={feedbackDecisions}
          feedbackEvents={feedbackEvents}
          bridgeStatus={bridgeStatus}
          onFeedbackSubmit={onFeedbackSubmit}
          interactiveGraphPayload={interactiveGraphPayload}
          sessionId={sessionId}
          selectedClusterId={selectedClusterId}
          onGraphSelectionChange={onGraphSelectionChange}
          useStaticPaperGraph={useStaticPaperGraph}
          {...graphStageExtras}
        />
      ) : null}
      {step === "completed" ? (
        <CompletedStepView
          dataset={dataset}
          selectedCandidate={selectedCandidate}
          feedbackDecisions={feedbackDecisions}
          feedbackEvents={feedbackEvents}
          interactiveGraphPayload={interactiveGraphPayload}
          graphViewMode={graphViewMode}
          onGraphViewModeChange={onGraphViewModeChange}
        />
      ) : null}
    </div>
  );
}
