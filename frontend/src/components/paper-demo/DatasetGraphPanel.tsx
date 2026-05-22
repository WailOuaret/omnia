import type { DemoDatasetConfig } from "../../demo-data/types";

interface DatasetGraphPanelProps {
  dataset: DemoDatasetConfig;
  activeStep: string;
  selectedCandidateId: string;
  feedbackDecisions?: Record<string, string>;
}

function nodeColor(type?: string): string {
  if (type === "virus" || type === "disease") return "#ef4444";
  if (type === "drug") return "#10b981";
  return "#3b82f6";
}

function edgeStyle(status?: string): { color: string; dashed: boolean } {
  if (status === "missing") return { color: "#f59e0b", dashed: true };
  if (status === "candidate") return { color: "#2563eb", dashed: true };
  if (status === "accepted") return { color: "#10b981", dashed: false };
  if (status === "rejected") return { color: "#ef4444", dashed: true };
  return { color: "#6b7280", dashed: false };
}

export function DatasetGraphPanel({
  dataset,
  activeStep,
  selectedCandidateId,
  feedbackDecisions,
}: DatasetGraphPanelProps) {
  const selectedCandidate = dataset.candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ?? dataset.candidates[0];
  const nodes = dataset.graph.nodes.slice(0, 8);
  const edges = dataset.graph.edges.slice(0, 8);
  const positions = nodes.reduce(
    (acc, node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(nodes.length, 1);
      acc[node.id] = {
        x: 260 + Math.cos(angle) * 160,
        y: 200 + Math.sin(angle) * 120,
      };
      return acc;
    },
    {} as Record<string, { x: number; y: number }>,
  );

  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-4" data-testid="paper-demo-graph-svg">
      <h3 className="text-sm font-semibold text-slate-900">Interactive graph / step view</h3>
      <div className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
        <svg width={560} height={400} role="img" aria-label="dataset-subgraph">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const source = positions[edge.source];
            const target = positions[edge.target];
            if (!source || !target) return null;
            const style = edgeStyle(edge.status);
            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={style.color}
                  strokeWidth={activeStep === "completed" && edge.status === "accepted" ? 3 : 2}
                  strokeDasharray={style.dashed ? "6 4" : undefined}
                  markerEnd="url(#arrow)"
                />
                <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 5} fontSize="11" fill={style.color}>
                  {edge.label}
                </text>
              </g>
            );
          })}
          {nodes.map((node) => {
            const pos = positions[node.id];
            const isClusterHighlight =
              activeStep === "clustering" &&
              dataset.clusters[0]?.entities.some((name) => name.toLowerCase().includes(node.label.toLowerCase()));
            return (
              <g key={node.id}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isClusterHighlight ? 22 : 18}
                  fill={nodeColor(node.type)}
                  stroke={isClusterHighlight ? "#111827" : "#ffffff"}
                  strokeWidth={isClusterHighlight ? 3 : 1}
                />
                <text x={pos.x} y={pos.y + 34} textAnchor="middle" fontSize="11" fill="#0f172a">
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p>
          <span className="font-semibold">Selected candidate:</span>{" "}
          {selectedCandidate ? `(${selectedCandidate.head}, ${selectedCandidate.relation}, ${selectedCandidate.tail})` : "None"}
        </p>
        {activeStep === "filtering" && selectedCandidate?.distance !== undefined ? (
          <p>
            <span className="font-semibold">Filtering:</span> distance {selectedCandidate.distance.toFixed(2)} / threshold{" "}
            {selectedCandidate.threshold?.toFixed(2)}
          </p>
        ) : null}
        {activeStep === "llm" && selectedCandidate?.llmVerdict ? (
          <p>
            <span className="font-semibold">LLM:</span> {selectedCandidate.llmVerdict} ({(selectedCandidate.llmConfidence ?? 0).toFixed(2)})
          </p>
        ) : null}
        {activeStep === "completed" && feedbackDecisions ? (
          <p>
            <span className="font-semibold">Feedback decisions tracked:</span> {Object.keys(feedbackDecisions).length}
          </p>
        ) : null}
      </div>
    </section>
  );
}

