import { GitBranch, MoveUpRight } from "lucide-react";
import type { DemoCandidate, DemoCluster } from "../../demo-data/types";
import type { GraphEdge, GraphNode, GraphPayload } from "../../types";
import { formatKgLabelParts, formatKgInline, missingLabelHint } from "../../lib/kgLabels";
import type { GraphSelection } from "./LiveGraphPanel";

interface NodeDetailPanelProps {
  graph?: GraphPayload | null;
  selection: GraphSelection;
  selectedCandidate?: DemoCandidate | null;
  selectedCluster?: DemoCluster | null;
  candidates: DemoCandidate[];
  clusters: DemoCluster[];
  sessionId?: string | null;
  onShowCandidatesForNode?: (nodeId: string) => void;
  /** When true, omit outer card chrome (used inside tabbed inspector). */
  embedded?: boolean;
  filteringAvailable?: boolean;
  llmAvailable?: boolean;
}

function ArtifactUnavailable({ message }: { message: string }) {
  return <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs italic text-slate-500">{message}</p>;
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-xs text-slate-900">{value ?? "n/a"}</p>
    </div>
  );
}

function LabelBlock({ id, label, kind = "entity" }: { id: string; label?: string | null; kind?: "entity" | "relation" | "value" }) {
  const parts = formatKgLabelParts(id, label, kind);
  return (
    <div title="Names are shown when the dataset provides them.">
      <p className="break-words text-sm font-semibold text-slate-950">{parts.primary}</p>
      {parts.isRawId ? (
        <p className="mt-0.5 text-[11px] italic text-slate-400">{missingLabelHint()}</p>
      ) : parts.secondary && parts.secondary !== parts.primary ? (
        <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">{parts.secondary}</p>
      ) : null}
      {parts.isRawId ? (
        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
          raw ID
        </span>
      ) : null}
    </div>
  );
}

function findSelection(graph: GraphPayload | null | undefined, selection: GraphSelection) {
  if (!graph || !selection) return { node: null as GraphNode | null, edge: null as GraphEdge | null };
  if (selection.type === "node") {
    return { node: graph.nodes.find((node) => node.id === selection.id) ?? null, edge: null };
  }
  return { node: null, edge: graph.edges.find((edge) => edge.id === selection.id) ?? null };
}

function connectedEdges(graph: GraphPayload | null | undefined, nodeId: string) {
  if (!graph) return [];
  return graph.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

function dispatchExpand(nodeId: string, hops: 1 | 2) {
  window.dispatchEvent(new CustomEvent("omnia-expand-node", { detail: { nodeId, hops } }));
}

export function NodeDetailPanel({
  graph,
  selection,
  selectedCandidate,
  selectedCluster,
  candidates,
  clusters,
  sessionId,
  onShowCandidatesForNode,
  embedded = false,
  filteringAvailable = true,
  llmAvailable = true,
}: NodeDetailPanelProps) {
  const { node, edge } = findSelection(graph, selection);

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inspector</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">
            {edge ? "Selected edge" : node ? "Selected node" : selectedCluster ? "Selected cluster" : selectedCandidate ? "Selected candidate" : "Graph details"}
          </h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
          {sessionId ? "live sample" : "prepared sample"}
        </span>
      </div>

      {!node && !edge ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          Click a node or edge in the graph. Some datasets use raw IDs; names appear when the dataset provides them.
        </div>
      ) : null}

      {node ? (
        <div className="mt-3 space-y-3">
          <LabelBlock id={node.id} label={node.label} kind="entity" />
          <div className="grid grid-cols-2 gap-2">
            <DetailField label="Type" value={node.kind} />
            <DetailField label="Degree" value={node.degree} />
            <DetailField label="Incoming" value={connectedEdges(graph, node.id).filter((e) => e.target === node.id).length} />
            <DetailField label="Outgoing" value={connectedEdges(graph, node.id).filter((e) => e.source === node.id).length} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Connected triples</p>
            <div className="max-h-40 space-y-1 overflow-auto pr-1">
              {connectedEdges(graph, node.id).slice(0, 8).map((item) => (
                <div key={item.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                  {formatKgInline(item.source)} - {formatKgInline(item.label, item.label, "relation")} -&gt; {formatKgInline(item.target)}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatchExpand(node.id, 1)}
              disabled={!sessionId}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Expand 1-hop
            </button>
            <button
              type="button"
              onClick={() => dispatchExpand(node.id, 2)}
              disabled={!sessionId}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Expand 2-hop
            </button>
            <button
              type="button"
              onClick={() => onShowCandidatesForNode?.(node.id)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <MoveUpRight className="h-3.5 w-3.5" />
              Show candidates
            </button>
          </div>
        </div>
      ) : null}

      {edge ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2">
            <LabelBlock id={edge.source} kind="entity" />
            <LabelBlock id={edge.label} label={edge.label} kind="relation" />
            <LabelBlock id={edge.target} kind="entity" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DetailField label="Status" value={edge.raw_status ?? edge.status} />
            <DetailField label="Provenance" value={edge.provenance_label} />
            <DetailField label="Candidate ID" value={edge.candidate_id} />
          </div>
          {filteringAvailable ? (
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Distance" value={typeof edge.distance === "number" ? edge.distance.toFixed(3) : null} />
              <DetailField label="Threshold" value={typeof edge.threshold === "number" ? edge.threshold.toFixed(3) : null} />
              {typeof edge.distance === "number" && typeof edge.threshold === "number" && edge.threshold > 0 ? (
                <div className="col-span-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filter result</p>
                  <p className={`mt-0.5 text-xs font-semibold ${edge.distance <= edge.threshold ? "text-emerald-700" : "text-rose-600"}`}>
                    {edge.distance <= edge.threshold ? "KEPT" : "REMOVED"}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <ArtifactUnavailable message="Filtering results are not included in this online sample yet." />
          )}
          {llmAvailable ? (
            <DetailField label="LLM verdict" value={edge.llm_decision} />
          ) : (
            <ArtifactUnavailable message="LLM/RAG evidence is not included in this online sample yet." />
          )}
        </div>
      ) : null}

      {!edge && !node && selectedCluster ? (
        <div className="mt-3 space-y-3">
          <DetailField label="Cluster ID" value={selectedCluster.id} />
          <LabelBlock id={selectedCluster.sharedRelation} label={selectedCluster.sharedRelation} kind="relation" />
          <LabelBlock id={selectedCluster.sharedTail} label={selectedCluster.sharedTail} kind="entity" />
          <DetailField label="Members" value={selectedCluster.size} />
          <DetailField
            label="Generated candidates"
            value={candidates.filter((candidate) => candidate.clusterIds?.includes(selectedCluster.id)).length}
          />
        </div>
      ) : null}

      {!edge && !node && selectedCandidate ? (
        <div className="mt-3 space-y-3">
          <DetailField label="Candidate ID" value={selectedCandidate.candidateId} />
          <LabelBlock id={selectedCandidate.head} kind="entity" />
          <LabelBlock id={selectedCandidate.relation} label={selectedCandidate.relation} kind="relation" />
          <LabelBlock id={selectedCandidate.tail} kind="entity" />
          <div className="grid grid-cols-2 gap-2">
            <DetailField label="Source cluster" value={selectedCandidate.clusterIds?.join(", ")} />
            <DetailField label="Status" value={selectedCandidate.status} />
          </div>
          {filteringAvailable ? (
            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Distance" value={selectedCandidate.distance?.toFixed(3)} />
              <DetailField label="Threshold" value={selectedCandidate.threshold?.toFixed(3)} />
            </div>
          ) : (
            <ArtifactUnavailable message="Filtering results are not included in this online sample yet." />
          )}
          {llmAvailable ? (
            <DetailField label="LLM verdict" value={selectedCandidate.llmVerdict} />
          ) : (
            <ArtifactUnavailable message="LLM/RAG evidence is not included in this online sample yet." />
          )}
          {selectedCandidate.llmRationale ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              {selectedCandidate.llmRationale}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div data-testid="node-detail-panel">
        {body}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="node-detail-panel">
      {body}
    </section>
  );
}
