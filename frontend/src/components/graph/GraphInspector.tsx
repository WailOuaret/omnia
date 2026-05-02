import { X } from "lucide-react";
import type { GraphEdge, GraphNode, GraphPayload, TripleRecord } from "../../types";
import { StatusBadge } from "../common/StatusBadge";

function tripleLabel(triple: TripleRecord | undefined) {
  if (!triple) {
    return "n/a";
  }
  return `${triple.DisplayHead ?? triple.Head} [${triple.DisplayRelation ?? triple.Relation}] ${
    triple.DisplayTail ?? triple.Tail
  }`;
}

function numberLabel(value: number | null | undefined, digits = 3) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-5 text-ink">{value ?? "n/a"}</div>
    </div>
  );
}

interface GraphInspectorProps {
  graph: GraphPayload;
  selectedNode?: GraphNode | null;
  selectedEdge?: GraphEdge | null;
  onClear: () => void;
}

export function GraphInspector({ graph, selectedNode, selectedEdge, onClear }: GraphInspectorProps) {
  const connectedEdges = selectedNode
    ? graph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).slice(0, 6)
    : [];

  return (
    <aside className="h-full overflow-auto border-l border-border bg-surface/95 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Inspector</div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {selectedEdge ? "Selected relation" : selectedNode ? "Selected node" : "Select graph evidence"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-border p-2 text-muted hover:text-ink"
          aria-label="Clear graph selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!selectedNode && !selectedEdge ? (
        <div className="mt-6 space-y-4 text-sm leading-6 text-muted">
          <p>
            Click an entity, component, cluster, candidate, or relation to inspect provenance without crowding the
            canvas.
          </p>
          <div className="rounded-card border border-border bg-bg p-4">
            Zoomed out shows structural summaries. Hover or select edges to reveal labels and supporting paths.
          </div>
        </div>
      ) : null}

      {selectedNode ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-card border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {selectedNode.kind}
                </div>
                <div className="mt-1 text-xl font-semibold text-ink">{selectedNode.label}</div>
              </div>
              {selectedNode.stage ? <StatusBadge status={selectedNode.stage} /> : null}
            </div>
            {selectedNode.warning ? (
              <div className="mt-3 rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber">{selectedNode.warning}</div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Degree" value={selectedNode.degree} />
            <Field label="Component" value={selectedNode.component_id} />
            <Field label="Cluster" value={selectedNode.cluster_id} />
            <Field label="Candidate" value={selectedNode.candidate_id} />
            <Field label="Nodes" value={selectedNode.node_count} />
            <Field label="Triples" value={selectedNode.edge_count} />
            <Field label="Relations" value={selectedNode.relation_count} />
            <Field label="Confidence" value={numberLabel(selectedNode.confidence, 2)} />
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sample relations</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(selectedNode.sample_relations ?? []).length ? (
                selectedNode.sample_relations?.map((relation) => (
              <span key={relation} className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-muted">
                    {relation}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No sample relations returned.</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Connected evidence</div>
            <div className="mt-2 space-y-2">
              {connectedEdges.map((edge) => (
                <div key={edge.id} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {edge.label}
                </div>
              ))}
              {!connectedEdges.length ? <div className="text-sm text-slate-500">No visible connected edges.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedEdge ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-card border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Triple</div>
                <div className="mt-1 text-lg font-semibold text-ink">{selectedEdge.label}</div>
              </div>
              <StatusBadge status={selectedEdge.status ?? "original"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Source" value={selectedEdge.source} />
            <Field label="Target" value={selectedEdge.target} />
            <Field label="TransE distance" value={numberLabel(selectedEdge.distance)} />
            <Field label="Threshold" value={numberLabel(selectedEdge.threshold)} />
            <Field label="LLM decision" value={selectedEdge.llm_decision} />
            <Field label="Cluster" value={selectedEdge.provenance?.cluster_id} />
          </div>

          <Field label="Relation-tail key" value={selectedEdge.provenance?.cluster_key} />

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Generated candidate</div>
            <div className="mt-2 rounded-lg border border-amber/25 bg-amber/10 px-3 py-2 text-sm text-ink">
              {tripleLabel(selectedEdge.provenance?.generated_candidate)}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence heads</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(selectedEdge.provenance?.source_heads ?? []).length ? (
                selectedEdge.provenance?.source_heads?.map((head) => (
                  <span key={head} className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-muted">
                    {head}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No source heads returned.</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Source triples</div>
            <div className="mt-2 space-y-2">
              {(selectedEdge.provenance?.source_triples ?? []).slice(0, 6).map((triple, index) => (
                <div key={`${triple.Head}-${triple.Relation}-${triple.Tail}-${index}`} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {tripleLabel(triple)}
                </div>
              ))}
              {!(selectedEdge.provenance?.source_triples ?? []).length ? (
                <div className="text-sm text-slate-500">No source triples returned.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
