/** Static fallback only — used when no backend session slice is available. */
import type {
  ClusterBox,
  DemoCandidate,
  DemoDatasetConfig,
  GraphEdge,
  GraphNode,
} from "../../demo-data/types";

const VB_W = 1200;
const VB_H = 620;
const R = 36;

interface BenchmarkMiniGraphProps {
  dataset: DemoDatasetConfig;
  activeStep: string;
  selectedCandidate?: DemoCandidate | null;
  selectedDecision?: "accept" | "reject" | "uncertain" | "correct" | null;
  feedbackDecisions?: Record<string, "accept" | "reject" | "uncertain" | "correct">;
}

type Decision = "accept" | "reject" | "uncertain" | "correct";

interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  dash: string;
  opacity: number;
}

const CLUSTER_PALETTE: Record<
  NonNullable<ClusterBox["color"]>,
  { fill: string; stroke: string; text: string }
> = {
  blue: { fill: "#dbeafe40", stroke: "#1d4ed8", text: "#1d4ed8" },
  green: { fill: "#dcfce740", stroke: "#15803d", text: "#15803d" },
  amber: { fill: "#fef3c740", stroke: "#b45309", text: "#b45309" },
  violet: { fill: "#ede9fe50", stroke: "#7c3aed", text: "#7c3aed" },
};

function getPositions(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const hasCoords = nodes.every((node) => node.x !== undefined && node.y !== undefined);
  if (hasCoords) {
    for (const node of nodes) positions[node.id] = { x: node.x!, y: node.y! };
    return positions;
  }
  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(nodes.length, 1);
    positions[node.id] = {
      x: VB_W / 2 + Math.cos(angle) * 320,
      y: VB_H / 2 + Math.sin(angle) * 220,
    };
  });
  return positions;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[_\-/]/g, " ").replace(/\s+/g, " ");
}

function entityMatchesNode(name: string, node: GraphNode): boolean {
  const target = normalize(name);
  return (
    normalize(node.id) === target ||
    normalize(node.label) === target ||
    normalize(node.shortLabel?.replace(/\n/g, " ")) === target
  );
}

function relationMatches(edgeLabel: string, edgeShort: string | undefined, candidateRelation: string): boolean {
  const a = normalize(candidateRelation);
  if (!a) return false;
  if (normalize(edgeLabel) === a) return true;
  if (normalize(edgeShort) === a) return true;
  if (normalize(edgeLabel).endsWith(a)) return true;
  return false;
}

function findCandidateEdgeId(
  dataset: DemoDatasetConfig,
  candidate: DemoCandidate | null | undefined,
): string | null {
  if (!candidate) return null;
  const matched = dataset.graph.edges.find((edge) => {
    const sourceNode = dataset.graph.nodes.find((n) => n.id === edge.source);
    const targetNode = dataset.graph.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return false;
    return (
      relationMatches(edge.label, edge.shortLabel, candidate.relation) &&
      entityMatchesNode(candidate.head, sourceNode) &&
      entityMatchesNode(candidate.tail, targetNode)
    );
  });
  return matched?.id ?? null;
}

function buildEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  bend: number,
): { path: string; midX: number; midY: number; angleDeg: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const x1 = source.x + ux * R;
  const y1 = source.y + uy * R;
  const x2 = target.x - ux * R;
  const y2 = target.y - uy * R;

  if (!bend) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return {
      path: `M ${x1} ${y1} L ${x2} ${y2}`,
      midX,
      midY,
      angleDeg: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
    };
  }

  const nx = -uy;
  const ny = ux;
  const cx = (x1 + x2) / 2 + nx * bend;
  const cy = (y1 + y2) / 2 + ny * bend;
  const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
    midX,
    midY,
    angleDeg,
  };
}

function decisionStyle(decision: Decision | null | undefined): EdgeStyle | null {
  if (!decision) return null;
  if (decision === "accept") return { stroke: "#16a34a", strokeWidth: 4.4, dash: "", opacity: 1 };
  if (decision === "reject") return { stroke: "#dc2626", strokeWidth: 2.8, dash: "8 6", opacity: 0.9 };
  if (decision === "uncertain") return { stroke: "#6b7280", strokeWidth: 2.6, dash: "4 5", opacity: 0.9 };
  if (decision === "correct") return { stroke: "#7c3aed", strokeWidth: 3.2, dash: "6 4", opacity: 1 };
  return null;
}

function baseEdgeStyle(edge: GraphEdge, activeStep: string, isSelectedCandidate: boolean): EdgeStyle {
  const isKnown = edge.status === "known" || !edge.status;
  const isCandidate = edge.status === "candidate" || edge.status === "missing";

  if (isKnown) {
    return { stroke: "#15803d", strokeWidth: 1.8, dash: "", opacity: 0.92 };
  }

  if (!isCandidate) {
    return { stroke: "#64748b", strokeWidth: 1.4, dash: "", opacity: 0.5 };
  }

  if (activeStep === "kg") {
    return { stroke: "#94a3b8", strokeWidth: 1.2, dash: "", opacity: 0.25 };
  }
  if (activeStep === "clustering") {
    return { stroke: "#94a3b8", strokeWidth: 1.4, dash: "4 4", opacity: 0.5 };
  }
  if (activeStep === "candidates") {
    return { stroke: "#ea580c", strokeWidth: 2.6, dash: "10 8", opacity: 0.95 };
  }
  if (activeStep === "filtering") {
    return { stroke: "#2563eb", strokeWidth: 2.4, dash: "8 6", opacity: 0.95 };
  }
  if (activeStep === "llm" || activeStep === "feedback" || activeStep === "completed") {
    return { stroke: "#ea580c", strokeWidth: 2.4, dash: "10 8", opacity: isSelectedCandidate ? 1 : 0.45 };
  }
  return { stroke: "#ea580c", strokeWidth: 2.2, dash: "10 8", opacity: 0.7 };
}

function wrapLabel(text: string): string[] {
  if (text.includes("\n")) return text.split("\n");
  if (text.length <= 12) return [text];
  const words = text.split(/\s+/);
  if (words.length === 1) return [text];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

function fontSizeForLabel(text: string): number {
  if (text.length > 16) return 9;
  if (text.length > 11) return 10;
  return 11;
}

export function BenchmarkMiniGraph({
  dataset,
  activeStep,
  selectedCandidate,
  selectedDecision,
  feedbackDecisions = {},
}: BenchmarkMiniGraphProps) {
  const positions = getPositions(dataset.graph.nodes);
  const selectedEdgeId = findCandidateEdgeId(dataset, selectedCandidate);
  const showClusters = activeStep === "clustering" || activeStep === "candidates";

  const decisionPerEdge: Record<string, Decision | null> = {};
  for (const edge of dataset.graph.edges) {
    if (edge.status !== "candidate" && edge.status !== "missing") continue;
    const matchingCandidate = dataset.candidates.find((candidate) => {
      const sourceNode = dataset.graph.nodes.find((node) => node.id === edge.source);
      const targetNode = dataset.graph.nodes.find((node) => node.id === edge.target);
      if (!sourceNode || !targetNode) return false;
      return (
        relationMatches(edge.label, edge.shortLabel, candidate.relation) &&
        entityMatchesNode(candidate.head, sourceNode) &&
        entityMatchesNode(candidate.tail, targetNode)
      );
    });
    const candidateId = matchingCandidate?.candidateId;
    if (!candidateId) {
      decisionPerEdge[edge.id] = null;
      continue;
    }
    if (selectedCandidate?.candidateId === candidateId && selectedDecision) {
      decisionPerEdge[edge.id] = selectedDecision;
    } else if (feedbackDecisions[candidateId]) {
      decisionPerEdge[edge.id] = feedbackDecisions[candidateId];
    } else {
      decisionPerEdge[edge.id] = null;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className="benchmark-mini-graph block h-full min-h-[55vh] w-full lg:min-h-[60vh]"
      data-testid="benchmark-mini-graph"
      data-step={activeStep}
    >
      <defs>
        <marker id="bench-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4.5 L0,9 Z" fill="#475569" />
        </marker>
        <marker id="bench-arrow-green" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4.5 L0,9 Z" fill="#16a34a" />
        </marker>
        <marker id="bench-arrow-red" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4.5 L0,9 Z" fill="#dc2626" />
        </marker>
        <marker id="bench-arrow-orange" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4.5 L0,9 Z" fill="#ea580c" />
        </marker>
      </defs>

      {showClusters && dataset.graph.clusterBoxes
        ? dataset.graph.clusterBoxes.map((box) => {
            const palette = CLUSTER_PALETTE[box.color ?? "blue"];
            return (
              <g key={box.id}>
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  rx={8}
                  fill={palette.fill}
                  stroke={palette.stroke}
                  strokeDasharray="6 4"
                />
                <rect
                  x={box.x + 6}
                  y={box.y - 14}
                  width={Math.min(box.width - 12, box.label.length * 6.5 + 14)}
                  height={20}
                  rx={4}
                  fill="#ffffff"
                  stroke={palette.stroke}
                />
                <text
                  x={box.x + 14}
                  y={box.y}
                  style={{ fontSize: 11, fontWeight: 700 }}
                  fill={palette.text}
                >
                  {box.label}
                </text>
              </g>
            );
          })
        : null}

      {dataset.graph.edges.map((edge) => {
        const source = positions[edge.source];
        const target = positions[edge.target];
        if (!source || !target) return null;

        const isSelected = selectedEdgeId === edge.id;
        const decision = decisionPerEdge[edge.id] ?? null;

        let style = baseEdgeStyle(edge, activeStep, isSelected);
        if (activeStep === "feedback" || activeStep === "completed") {
          const decisionVisual = decisionStyle(decision);
          if (decisionVisual) style = decisionVisual;
        }
        if (activeStep === "filtering" && (edge.status === "candidate" || edge.status === "missing")) {
          const candidateForEdge = dataset.candidates.find((c) => {
            const sNode = dataset.graph.nodes.find((n) => n.id === edge.source);
            const tNode = dataset.graph.nodes.find((n) => n.id === edge.target);
            if (!sNode || !tNode) return false;
            return (
              relationMatches(edge.label, edge.shortLabel, c.relation) &&
              entityMatchesNode(c.head, sNode) &&
              entityMatchesNode(c.tail, tNode)
            );
          });
          if (candidateForEdge && candidateForEdge.status === "removed") {
            style = { stroke: "#dc2626", strokeWidth: 1.8, dash: "6 5", opacity: 0.6 };
          }
        }

        if (isSelected) {
          style = { ...style, strokeWidth: Math.max(style.strokeWidth, 3.4), opacity: 1 };
        }

        const bend = edge.bend ?? 0;
        const { path, midX, midY } = buildEdgePath(source, target, bend);
        const labelText = edge.shortLabel ?? edge.label;
        const tooltip = edge.fullLabel ?? edge.label;
        const showLabel = edge.showLabel !== false && Boolean(labelText);
        const labelDx = edge.labelDx ?? 0;
        const labelDy = edge.labelDy ?? -8;

        const markerId =
          style.stroke === "#16a34a"
            ? "bench-arrow-green"
            : style.stroke === "#dc2626"
              ? "bench-arrow-red"
              : style.stroke === "#ea580c"
                ? "bench-arrow-orange"
                : "bench-arrow";

        return (
          <g key={edge.id}>
            <title>{tooltip}</title>
            <path
              d={path}
              fill="none"
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.dash}
              opacity={style.opacity}
              markerEnd={`url(#${markerId})`}
            />
            {showLabel ? (
              <g transform={`translate(${midX + labelDx}, ${midY + labelDy})`} pointerEvents="none">
                <rect
                  x={-labelText.length * 3.4 - 6}
                  y={-9}
                  width={labelText.length * 6.8 + 12}
                  height={18}
                  rx={4}
                  fill="#ffffff"
                  opacity={0.92}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#334155"
                  style={{ fontSize: 10, fontWeight: 500 }}
                >
                  {labelText}
                </text>
              </g>
            ) : null}

            {(activeStep === "feedback" || activeStep === "completed") && decision === "accept" ? (
              <g pointerEvents="none">
                <circle cx={midX + 42} cy={midY - 22} r={13} fill="#dcfce7" stroke="#16a34a" strokeWidth={2} />
                <text x={midX + 42} y={midY - 17} textAnchor="middle" fill="#166534" style={{ fontSize: 14, fontWeight: 900 }}>
                  ✓
                </text>
                <rect x={midX + 56} y={midY - 32} width={92} height={20} rx={4} fill="#ffffff" />
                <text x={midX + 60} y={midY - 17} fill="#166534" style={{ fontSize: 11, fontWeight: 800 }}>
                  ACCEPTED +1
                </text>
              </g>
            ) : null}
            {(activeStep === "feedback" || activeStep === "completed") && decision === "reject" ? (
              <g pointerEvents="none">
                <circle cx={midX + 42} cy={midY - 22} r={13} fill="#fee2e2" stroke="#dc2626" strokeWidth={2} />
                <text x={midX + 42} y={midY - 17} textAnchor="middle" fill="#991b1b" style={{ fontSize: 14, fontWeight: 900 }}>
                  ✕
                </text>
                <rect x={midX + 56} y={midY - 32} width={86} height={20} rx={4} fill="#ffffff" />
                <text x={midX + 60} y={midY - 17} fill="#991b1b" style={{ fontSize: 11, fontWeight: 800 }}>
                  REJECTED
                </text>
              </g>
            ) : null}
            {(activeStep === "feedback" || activeStep === "completed") && decision === "uncertain" ? (
              <g pointerEvents="none">
                <circle cx={midX + 42} cy={midY - 22} r={13} fill="#e5e7eb" stroke="#6b7280" strokeWidth={2} />
                <text x={midX + 42} y={midY - 17} textAnchor="middle" fill="#374151" style={{ fontSize: 13, fontWeight: 900 }}>
                  ?
                </text>
                <rect x={midX + 56} y={midY - 32} width={66} height={20} rx={4} fill="#ffffff" />
                <text x={midX + 60} y={midY - 17} fill="#374151" style={{ fontSize: 11, fontWeight: 800 }}>
                  REVIEW
                </text>
              </g>
            ) : null}
            {(activeStep === "feedback" || activeStep === "completed") && decision === "correct" ? (
              <g pointerEvents="none">
                <circle cx={midX + 42} cy={midY - 22} r={13} fill="#ede9fe" stroke="#7c3aed" strokeWidth={2} />
                <text x={midX + 42} y={midY - 17} textAnchor="middle" fill="#5b21b6" style={{ fontSize: 13, fontWeight: 900 }}>
                  ↺
                </text>
                <rect x={midX + 56} y={midY - 32} width={92} height={20} rx={4} fill="#ffffff" />
                <text x={midX + 60} y={midY - 17} fill="#5b21b6" style={{ fontSize: 11, fontWeight: 800 }}>
                  CORRECTED
                </text>
              </g>
            ) : null}
            {activeStep === "filtering" && edge.status === "candidate" ? (
              (() => {
                const candidateForEdge = dataset.candidates.find((c) => {
                  const sNode = dataset.graph.nodes.find((n) => n.id === edge.source);
                  const tNode = dataset.graph.nodes.find((n) => n.id === edge.target);
                  if (!sNode || !tNode) return false;
                  return (
                    relationMatches(edge.label, edge.shortLabel, c.relation) &&
                    entityMatchesNode(c.head, sNode) &&
                    entityMatchesNode(c.tail, tNode)
                  );
                });
                if (!candidateForEdge || candidateForEdge.status !== "removed") return null;
                return (
                  <g pointerEvents="none">
                    <rect x={midX + 18} y={midY - 28} width={108} height={20} rx={4} fill="#ffffff" />
                    <text x={midX + 24} y={midY - 13} fill="#b91c1c" style={{ fontSize: 11, fontWeight: 800 }}>
                      ✕ FILTERED OUT
                    </text>
                  </g>
                );
              })()
            ) : null}
          </g>
        );
      })}

      {dataset.graph.nodes.map((node) => {
        const pos = positions[node.id];
        if (!pos) return null;
        const labelText = node.shortLabel ?? node.label;
        const lines = wrapLabel(labelText);
        const fontSize = fontSizeForLabel(labelText);
        const lineGap = fontSize + 1;
        const startY = pos.y - ((lines.length - 1) * lineGap) / 2 + 3;
        return (
          <g key={node.id}>
            <title>{node.label}</title>
            <circle cx={pos.x} cy={pos.y} r={R} fill="#fafafa" stroke="#334155" strokeWidth={1.8} />
            <g pointerEvents="none">
              {lines.map((line, idx) => (
                <text
                  key={idx}
                  x={pos.x + (node.labelDx ?? 0)}
                  y={startY + idx * lineGap + (node.labelDy ?? 0)}
                  textAnchor="middle"
                  fill="#0f172a"
                  style={{ fontSize, fontWeight: 600 }}
                >
                  {line}
                </text>
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
