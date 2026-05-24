import { useMemo, useState, type ReactNode } from "react";
import { GraphComparisonPanel } from "./GraphComparisonPanel";
import { RestoredGraphStagePanel } from "./RestoredGraphStagePanel";
import { UserFeedbackPanel } from "./UserFeedbackPanel";
import type { DemoCandidate, DemoDatasetConfig } from "../../demo-data/types";
import type { FeedbackStatus } from "../../hooks/useFeedbackBridge";
import { formatKgInline, formatKgLabelParts } from "../../lib/kgLabels";
import type { UserFeedback } from "../../stores/feedbackStore";
import type { GraphPayload } from "../../types";
import type { GraphSelection } from "./LiveGraphPanel";

type Decision = "accept" | "reject" | "uncertain" | "correct";
type StepId = "kg" | "clustering" | "candidates" | "filtering" | "llm" | "feedback" | "completed";

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
}

const STEP_TITLES: Record<StepId, string> = {
  kg: "Knowledge Graph",
  clustering: "Clustering",
  candidates: "Candidate Generation",
  filtering: "Structural Filtering",
  llm: "Semantic Validation",
  feedback: "User Feedback",
  completed: "Completed KG / Diff",
};

const STEP_GOALS: Record<StepId, string> = {
  kg: "Goal: find plausible missing triples using only the internal structure of the graph.",
  clustering: "Goal: group head entities that share the same relation-tail pattern. Similar contexts may share more relations.",
  candidates: "Goal: propose missing triples by propagating relation-tail pairs within each cluster.",
  filtering: "Goal: drop structurally implausible candidates using TransE distance before calling the LLM.",
  llm: "Goal: validate each surviving candidate with the LLM acting as a semantic judge, supported by retrieved RAG context.",
  feedback: "Goal: let the human curator accept, reject, mark uncertain, or correct each remaining candidate.",
  completed: "Goal: show the completed KG vs the original, including the diff and provenance of every change.",
};

function StepHeader({ step }: { step: StepId }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current step</p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">{STEP_TITLES[step]}</h2>
      <p className="mt-1 text-sm text-slate-700">{STEP_GOALS[step]}</p>
    </div>
  );
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
      title="Raw IDs come from the benchmark dataset. Labels are shown when available."
    >
      <span className={`block truncate font-semibold ${compact ? "text-xs" : "text-sm"} ${inverse ? "text-white" : "text-slate-900"}`}>
        {parts.primary}
      </span>
      <span className={`block truncate font-mono text-[10px] ${inverse ? "text-slate-300" : "text-slate-500"}`}>
        {parts.secondary}
      </span>
      {parts.isRawId ? (
        <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${inverse ? "bg-amber-200 text-amber-950 ring-amber-100" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
          raw Wikidata ID
        </span>
      ) : null}
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

function StepSplit({ graph, children }: { graph: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1fr)_300px] min-[1800px]:grid-cols-[minmax(650px,1fr)_360px]">
      <div className="min-w-0">{graph}</div>
      <aside className="min-w-0 max-h-[760px] overflow-auto rounded-xl border border-slate-200 bg-white p-3">
        {children}
      </aside>
    </div>
  );
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
      useStaticPaperGraph={useStaticPaperGraph}
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
}: {
  dataset: DemoDatasetConfig;
  feedbackDecisions: Record<string, Decision>;
  useStaticPaperGraph: boolean;
  interactiveGraphPayload?: GraphPayload | null;
  sessionId?: string | null;
  selectedClusterId?: string | null;
  onGraphSelectionChange?: (selection: GraphSelection) => void;
  onSelectCandidate: (id: string) => void;
}) {
  const knownCount = dataset.graph.edges.filter((edge) => edge.status === "known" || !edge.status).length;
  const missingCount = dataset.graph.edges.filter((edge) => edge.status === "missing").length;
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
    />
  );
  return (
    <StepSplit graph={graph}>
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
    </StepSplit>
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
}) {
  const [query, setQuery] = useState("");
  const selectedCluster =
    dataset.clusters.find((cluster) => cluster.id === selectedClusterId) ?? dataset.clusters[0] ?? null;
  const filteredClusters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dataset.clusters;
    return dataset.clusters.filter((cluster) => {
      const haystack = `${cluster.id} ${cluster.sharedRelation} ${cluster.sharedTail} ${cluster.entities.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [dataset.clusters, query]);
  const visibleClusters = filteredClusters.slice(0, 10);
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
    />
  );

  return (
    <StepSplit graph={graph}>
      <div className="space-y-3">
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <p className="font-semibold">How OMNIA clusters</p>
          <p className="mt-0.5 text-xs">
            OMNIA groups head entities that share the same relation-tail pattern. The graph highlights the selected members and their shared tail.
          </p>
        </div>
        <ProcessRail items={["Heads sharing same (relation, tail)", "Cluster Ck", "Candidate generation"]} />
        {selectedCluster ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-slate-900">Selected cluster explanation</h3>
            <div className="mt-2 grid gap-2">
              <StatChip label="Cluster ID" value={selectedCluster.id} />
              <KgLabel id={selectedCluster.sharedRelation} label={selectedCluster.sharedRelation} kind="relation" />
              <KgLabel id={selectedCluster.sharedTail} label={selectedCluster.sharedTail} />
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Members" value={selectedCluster.size} />
                <StatChip label="Generated candidates" value={clusterCandidateCount(candidates, selectedCluster.id)} />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Why useful: heads with the same relation-tail context can plausibly inherit other relation-tail pairs from the same cluster.
            </p>
          </div>
        ) : null}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Detected clusters</h3>
            <span className="text-[10px] text-slate-500">Top 10</span>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clusters, relation, tail, member"
            className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
          <div className="mt-2 max-h-72 overflow-auto pr-1">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1 pr-2">Cluster</th>
                  <th className="py-1 pr-2">Pattern</th>
                  <th className="py-1">Members</th>
                </tr>
              </thead>
              <tbody>
                {visibleClusters.map((cluster) => {
                  const isSelected = selectedCluster?.id === cluster.id;
                  return (
                    <tr
                      key={cluster.id}
                      onClick={() => onSelectCluster?.(cluster.id)}
                      className={`cursor-pointer border-t border-slate-100 ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-2 pr-2 font-mono text-slate-900">{cluster.id}</td>
                      <td className="py-2 pr-2">
                        <KgLabel id={cluster.sharedRelation} label={cluster.sharedRelation} kind="relation" compact />
                        <KgLabel id={cluster.sharedTail} label={cluster.sharedTail} compact />
                      </td>
                      <td className="py-2 text-slate-700">
                        {cluster.entities.slice(0, 3).map((entity) => formatKgInline(entity)).join(", ")}
                        {cluster.entities.length > 3 ? "..." : ""} ({cluster.size})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StepSplit>
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
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleCandidates = showAll ? candidates : candidates.slice(0, 8);
  const sourceCluster =
    dataset.clusters.find((cluster) => selectedCandidate?.clusterIds?.includes(cluster.id)) ??
    dataset.clusters.find((cluster) => cluster.id === selectedClusterId) ??
    dataset.clusters[0] ??
    null;
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
    />
  );

  return (
    <StepSplit graph={graph}>
      <div className="space-y-3">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Candidate edges are dashed blue. Selecting a row highlights the generated edge, head, tail, and source cluster context.
        </div>
        <div className="grid gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Cluster members</p>
            <p className="mt-1 text-slate-700">
              {sourceCluster?.entities.slice(0, 6).map((entity) => formatKgInline(entity)).join(", ") || "No selected cluster"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Relation-tail pairs</p>
            <p className="mt-1 text-slate-700">
              {sourceCluster ? `${formatKgInline(sourceCluster.sharedRelation, sourceCluster.sharedRelation, "relation")} -> ${formatKgInline(sourceCluster.sharedTail)}` : "No source pattern"}
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="font-semibold text-blue-950">Generated candidate triples</p>
            <p className="mt-1 text-blue-900">{candidates.length} backend candidates in this view</p>
          </div>
        </div>
        {selectedCandidate ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-slate-900">Selected candidate</h3>
            <div className="mt-2 space-y-2">
              <CandidateTriple candidate={selectedCandidate} />
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Candidate ID" value={selectedCandidate.candidateId} />
                <StatChip label="Source cluster" value={selectedCandidate.clusterIds?.join(", ") ?? "n/a"} />
                <StatChip label="Status" value={selectedCandidate.status} />
                <StatChip label="Why generated" value="Cluster propagation" />
              </div>
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Generated candidates</h3>
            <span className="text-[10px] text-slate-500">{visibleCandidates.length} of {candidates.length}</span>
          </div>
          <div className="mt-2 max-h-80 space-y-1.5 overflow-auto pr-1">
            {visibleCandidates.map((candidate) => {
              const isSelected = selectedCandidate?.candidateId === candidate.candidateId;
              return (
                <button
                  key={candidate.candidateId}
                  type="button"
                  onClick={() => onSelectCandidate(candidate.candidateId)}
                  className={`block w-full rounded-md border p-2 text-left ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <p className={`font-mono text-[10px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>{candidate.candidateId}</p>
                  <CandidateTriple candidate={candidate} inverse={isSelected} />
                  <p className={`mt-1 text-[10px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                    Cluster {candidate.clusterIds?.join(", ") ?? "n/a"}; status {candidate.status}
                  </p>
                </button>
              );
            })}
          </div>
          {candidates.length > 8 ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              {showAll ? "Show first 8" : "Show more"}
            </button>
          ) : null}
        </div>
      </div>
    </StepSplit>
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
}) {
  const rows = candidates.filter(
    (candidate) => typeof candidate.distance === "number" && typeof candidate.threshold === "number",
  );
  const keptCount = rows.filter((candidate) => (candidate.distance ?? 0) <= (candidate.threshold ?? 0)).length;
  const removedCount = rows.length - keptCount;
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
    />
  );

  return (
    <StepSplit graph={graph}>
      <div className="space-y-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">TransE structural filtering</p>
          <p className="mt-0.5 text-xs">
            TransE filtering removes structurally unlikely triples before LLM validation. Distance less than or equal to threshold is kept.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatChip label="Model" value={dataset.filteringStats.model} />
          <StatChip label="Rows with filter data" value={rows.length} />
          <StatChip label="Kept" value={keptCount} />
          <StatChip label="Removed" value={removedCount} />
        </div>
        {rows.length === 0 ? (
          <EmptyStepBanner>Filtering results are not available. Run filtering first.</EmptyStepBanner>
        ) : (
          <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
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
        )}
      </div>
    </StepSplit>
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
}) {
  const promptMode = dataset.recommendedMode === "sentence-rag" ? "Sentence-based RAG" : "Triple-based RAG";
  const hasLlmData = Boolean(selectedCandidate?.llmVerdict || selectedCandidate?.llmRationale || selectedCandidate?.retrievedContext?.length);
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
    />
  );

  return (
    <StepSplit graph={graph}>
      <div className="space-y-3">
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <p className="font-semibold">LLM validation evidence</p>
          <p className="mt-0.5 text-xs">
            The LLM validates backend candidates after filtering. Green graph edges are valid, red are invalid, amber are uncertain.
          </p>
        </div>
        <CandidateSelectorPills
          step="llm"
          candidates={candidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
        />
        {!selectedCandidate ? <EmptyStepBanner>No candidate selected.</EmptyStepBanner> : null}
        {selectedCandidate && !hasLlmData ? (
          <EmptyStepBanner>LLM validation not available for this candidate.</EmptyStepBanner>
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
    </StepSplit>
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
}) {
  const existing = selectedCandidate
    ? feedbackEvents
        .filter((event) => event.candidateId === selectedCandidate.candidateId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    : undefined;
  const graph = (
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
    />
  );

  return (
    <StepSplit graph={graph}>
      <div className="space-y-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Human-in-the-loop curation</p>
          <p className="mt-0.5 text-xs">
            Feedback keeps the existing backend POST flow and immediately recolors the selected graph edge.
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
    </StepSplit>
  );
}

function CompletedStepView({
  dataset,
  selectedCandidate,
  feedbackDecisions,
  feedbackEvents,
  interactiveGraphPayload,
}: {
  dataset: DemoDatasetConfig;
  selectedCandidate: DemoCandidate | null;
  feedbackDecisions: Record<string, Decision>;
  feedbackEvents: UserFeedback[];
  interactiveGraphPayload?: GraphPayload | null;
}) {
  return (
    <GraphComparisonPanel
      dataset={dataset}
      selectedCandidate={selectedCandidate}
      feedbackDecisions={feedbackDecisions}
      feedbackEvents={feedbackEvents}
      interactiveGraphPayload={interactiveGraphPayload}
    />
  );
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
  } = props;

  return (
    <div className="space-y-3">
      <StepHeader step={step} />
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
        />
      ) : null}
      {step === "completed" ? (
        <CompletedStepView
          dataset={dataset}
          selectedCandidate={selectedCandidate}
          feedbackDecisions={feedbackDecisions}
          feedbackEvents={feedbackEvents}
          interactiveGraphPayload={interactiveGraphPayload}
        />
      ) : null}
    </div>
  );
}
