import type { PaperDemoCandidate, PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";
import { CANDIDATE_GENERATION_MATRIX, ORIGINAL_TRIPLES, PAPER_DEMO_CANDIDATES } from "./paperDemoScenario";

const VB_W = 1220;
const VB_H = 780;
const R = 38;

type NodeId =
  | "remdesivir" | "chloroquine" | "sars_cov_2" | "ncov" | "fda" | "hcq" | "mers"
  | "severe" | "niclosamide" | "covid19" | "pneumonia" | "delta" | "favipiravir";
type EdgeDef = { id: string; from: NodeId; to: NodeId; label: string; kind?: "candidate" };

const NODES: Record<NodeId, { x: number; y: number; label: string }> = {
  remdesivir: { x: 260, y: 250, label: "remdesivir" },
  chloroquine: { x: 500, y: 250, label: "chloroquine" },
  sars_cov_2: { x: 380, y: 100, label: "sars-cov-2" },
  ncov: { x: 370, y: 420, label: "2019-ncov" },
  fda: { x: 760, y: 130, label: "FDA" },
  hcq: { x: 790, y: 300, label: "hydroxychloroquine" },
  mers: { x: 110, y: 170, label: "MERS" },
  severe: { x: 140, y: 470, label: "severe covid-19" },
  niclosamide: { x: 120, y: 610, label: "niclosamide" },
  covid19: { x: 980, y: 420, label: "covid-19" },
  pneumonia: { x: 980, y: 240, label: "pneumonia" },
  delta: { x: 1110, y: 500, label: "delta-variant" },
  favipiravir: { x: 860, y: 590, label: "favipiravir" },
};

const EDGE_NODE_MAP: Record<string, { from: NodeId; to: NodeId; label: string; kind?: "candidate" }> = {
  t1: { from: "remdesivir", to: "sars_cov_2", label: "treats" },
  t2: { from: "remdesivir", to: "ncov", label: "inhibits" },
  t3: { from: "chloroquine", to: "ncov", label: "inhibits" },
  t5: { from: "fda", to: "chloroquine", label: "approves" },
  t6: { from: "fda", to: "hcq", label: "approves" },
  t7: { from: "niclosamide", to: "sars_cov_2", label: "prevents" },
  t8: { from: "remdesivir", to: "mers", label: "affects" },
  t9: { from: "remdesivir", to: "severe", label: "affects" },
  t10: { from: "sars_cov_2", to: "pneumonia", label: "causes" },
  t11: { from: "covid19", to: "pneumonia", label: "causes" },
  t12: { from: "delta", to: "pneumonia", label: "causes" },
  t13: { from: "favipiravir", to: "covid19", label: "treats" },
  t14: { from: "favipiravir", to: "delta", label: "treats" },
  c1: { from: "chloroquine", to: "sars_cov_2", label: "treats", kind: "candidate" },
  c2: { from: "chloroquine", to: "mers", label: "affects", kind: "candidate" },
  c3: { from: "chloroquine", to: "severe", label: "affects", kind: "candidate" },
  c4: { from: "remdesivir", to: "ncov", label: "treats", kind: "candidate" },
};
const EDGES: EdgeDef[] = [...ORIGINAL_TRIPLES.map((t) => ({ id: t.id, ...EDGE_NODE_MAP[t.id] })), ...CANDIDATE_GENERATION_MATRIX.map((c) => ({ id: c.id, ...EDGE_NODE_MAP[c.id] }))];

function candidateEdgeId(c: PaperDemoCandidate | undefined): string {
  if (!c) return "c1";
  if (c.id === "c2") return "c2";
  if (c.id === "c3") return "c3";
  if (c.id === "c4") return "c4";
  return "c1";
}

function seg(a: NodeId, b: NodeId) {
  const A = NODES[a];
  const B = NODES[b];
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x1: A.x + (dx / l) * R, y1: A.y + (dy / l) * R, x2: B.x - (dx / l) * R, y2: B.y - (dy / l) * R };
}

function visible(step: PaperDemoStep, id: string, sel: string, decision: UserRefinementDecision) {
  const base = id.startsWith("t");
  if (step === "before") return base;
  if (step === "missing") return base || id === sel;
  if (step === "cluster") return base || id === sel;
  if (step === "generation" || step === "filtering" || step === "llm" || step === "human") return base || id.startsWith("c");
  if (step === "after" || step === "diff") return base || (id === sel && decision !== null);
  return base;
}

function style(step: PaperDemoStep, id: string, sel: string, decision: UserRefinementDecision, hi?: string | null) {
  if (hi === id) return { stroke: "#f59e0b", sw: 3.6, dash: "", op: 1 };
  if (id.startsWith("t")) return { stroke: "#15803d", sw: 1.5, dash: "", op: 0.9 };
  const filtered = PAPER_DEMO_CANDIDATES.find((c) => c.id === id)?.transEDistance ? (PAPER_DEMO_CANDIDATES.find((c) => c.id === id)!.transEDistance > PAPER_DEMO_CANDIDATES.find((c) => c.id === id)!.transEThreshold) : false;
  if (step === "missing" || step === "cluster" || step === "generation") return { stroke: "#ea580c", sw: 3, dash: "10 8", op: 1 };
  if (step === "filtering") return filtered ? { stroke: "#dc2626", sw: 1.4, dash: "6 5", op: 0.5 } : { stroke: "#2563eb", sw: 2.8, dash: "8 6", op: 1 };
  if (step === "llm" || step === "human") return filtered ? { stroke: "#dc2626", sw: 1.6, dash: "6 5", op: 0.6 } : { stroke: "#ea580c", sw: 3, dash: "10 8", op: 1 };
  if (step === "after" || step === "diff") {
    if (id !== sel) return { stroke: "#94a3b8", sw: 1.2, dash: "5 5", op: 0.18 };
    if (decision === "accepted") return { stroke: "#16a34a", sw: 5.2, dash: "", op: 1 };
    if (decision === "rejected") return { stroke: "#dc2626", sw: 3.4, dash: "8 6", op: 0.95 };
    if (decision === "uncertain") return { stroke: "#6b7280", sw: 3, dash: "4 5", op: 0.95 };
    return { stroke: "#ea580c", sw: 3, dash: "10 8", op: 1 };
  }
  return { stroke: "#64748b", sw: 1.2, dash: "", op: 0.6 };
}

function Graph({
  step,
  selectedCandidate,
  selectedDecision,
  highlightedEdge,
  highlightedNode,
  diffFocus,
}: {
  step: PaperDemoStep;
  selectedCandidate: PaperDemoCandidate | undefined;
  selectedDecision: UserRefinementDecision;
  highlightedEdge?: string | null;
  highlightedNode?: string | null;
  diffFocus?: boolean;
}) {
  const sel = candidateEdgeId(selectedCandidate);
  return (
    <svg
      viewBox={diffFocus ? "40 30 640 560" : `0 0 ${VB_W} ${VB_H}`}
      className="paper-demo-main-svg h-full min-h-[45vh] w-full lg:min-h-[70vh]"
      data-testid="paper-demo-graph-svg"
      data-step={step}
    >
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#475569" />
        </marker>
      </defs>
      {(step === "cluster" || step === "generation") ? (
        <>
          <rect x={160} y={145} width={430} height={355} fill="#dbeafe2e" stroke="#1d4ed8" strokeDasharray="6 4" />
          <text x={170} y={165} style={{ fontSize: 11, fontWeight: 700 }} fill="#1d4ed8">C1 (inhibits, 2019-ncov)</text>
          <rect x={905} y={170} width={260} height={370} fill="#dcfce72e" stroke="#15803d" strokeDasharray="6 4" />
          <text x={915} y={190} style={{ fontSize: 11, fontWeight: 700 }} fill="#15803d">C2 (causes, pneumonia)</text>
          <rect x={735} y={355} width={430} height={300} fill="#fef3c72e" stroke="#b45309" strokeDasharray="6 4" />
          <text x={745} y={375} style={{ fontSize: 11, fontWeight: 700 }} fill="#b45309">C3 (treats, covid-19)</text>
        </>
      ) : null}
      {EDGES.filter((e) => visible(step, e.id, sel, selectedDecision)).map((e) => {
        const s = style(step, e.id, sel, selectedDecision, highlightedEdge);
        const p = seg(e.from, e.to);
        const mx = (p.x1 + p.x2) / 2;
        const my = (p.y1 + p.y2) / 2;
        return (
          <g key={e.id}>
            {e.id === "c4" ? (
              <path
                d={`M ${p.x1} ${p.y1} Q ${(p.x1 + p.x2) / 2} ${((p.y1 + p.y2) / 2) - 30} ${p.x2} ${p.y2}`}
                fill="none"
                stroke={s.stroke}
                strokeWidth={s.sw}
                strokeDasharray={s.dash}
                opacity={s.op}
                markerEnd="url(#arr)"
              />
            ) : (
              <line
                x1={p.x1}
                y1={p.y1}
                x2={p.x2}
                y2={p.y2}
                stroke={s.stroke}
                strokeWidth={s.sw}
                strokeDasharray={s.dash}
                opacity={s.op}
                markerEnd="url(#arr)"
              />
            )}
            <text x={mx} y={my - 4} textAnchor="middle" fill="#334155" style={{ fontSize: 9 }}>
              {e.label}
            </text>
            {(step === "filtering" || step === "diff" || step === "after") && PAPER_DEMO_CANDIDATES.find((c) => c.id === e.id && c.transEDistance > c.transEThreshold) ? (
              <g>
                <text x={mx + 28} y={my - 2} fill="#dc2626" style={{ fontSize: 14, fontWeight: 700 }}>✕</text>
                <text x={mx + 44} y={my - 2} fill="#b91c1c" style={{ fontSize: 10, fontWeight: 700 }}>FILTERED OUT</text>
              </g>
            ) : null}
            {(step === "after" || step === "diff") && e.id === sel && selectedDecision === "accepted" ? (
              <g>
                <circle cx={mx + 36} cy={my - 14} r={15} fill="#dcfce7" stroke="#16a34a" strokeWidth={2} />
                <text x={mx + 36} y={my - 9} textAnchor="middle" fill="#166534" style={{ fontSize: 16, fontWeight: 900 }}>✓</text>
                <text x={mx + 58} y={my - 10} fill="#166534" style={{ fontSize: 12, fontWeight: 800 }}>ACCEPTED +1</text>
              </g>
            ) : null}
            {(step === "after" || step === "diff") && e.id === sel && selectedDecision === "rejected" ? (
              <g>
                <circle cx={mx + 36} cy={my - 14} r={15} fill="#fee2e2" stroke="#dc2626" strokeWidth={2} />
                <text x={mx + 36} y={my - 9} textAnchor="middle" fill="#991b1b" style={{ fontSize: 16, fontWeight: 900 }}>✕</text>
                <text x={mx + 58} y={my - 10} fill="#991b1b" style={{ fontSize: 12, fontWeight: 800 }}>REJECTED · not added</text>
              </g>
            ) : null}
            {(step === "after" || step === "diff") && e.id === sel && selectedDecision === "uncertain" ? (
              <g>
                <circle cx={mx + 36} cy={my - 14} r={15} fill="#e5e7eb" stroke="#6b7280" strokeWidth={2} />
                <text x={mx + 36} y={my - 9} textAnchor="middle" fill="#374151" style={{ fontSize: 14, fontWeight: 900 }}>?</text>
                <text x={mx + 58} y={my - 10} fill="#374151" style={{ fontSize: 12, fontWeight: 800 }}>UNCERTAIN · not added</text>
              </g>
            ) : null}
          </g>
        );
      })}
      {(Object.entries(NODES) as [NodeId, { x: number; y: number; label: string }][]).map(([id, n]) => {
        const hi = highlightedNode === n.label;
        return (
          <g key={id}>
            <circle cx={n.x} cy={n.y} r={R} fill="#fafafa" stroke={hi ? "#f59e0b" : "#334155"} strokeWidth={hi ? 3 : 1.8} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#0f172a" style={{ fontSize: 9 }}>
              {n.label}
            </text>
          </g>
        );
      })}
      <text x={18} y={VB_H - 44} fill="#334155" style={{ fontSize: 12, fontWeight: 700 }}>
        {selectedDecision === "accepted"
          ? "✓ Triple accepted: completed KG +1"
          : selectedDecision === "rejected"
            ? "✕ Triple rejected: KG unchanged (+0)"
            : "Pending human decision: no difference yet"}
      </text>
      <text x={18} y={VB_H - 24} fill="#475569" style={{ fontSize: 12 }}>
        {step === "filtering" && selectedCandidate?.id === "c2"
          ? "0.93 > τ 0.80 → FILTERED OUT"
          : step === "filtering" && selectedCandidate?.id === "c1"
            ? "0.61 < τ 0.80 → PASSED"
            : step === "after" && selectedDecision === "accepted"
              ? "KG updated (+1 triple)"
              : step === "after" && selectedDecision === "rejected"
                ? "KG unchanged (+0 triples)"
                : "The selected candidate is shown in context. Original KG edges remain unchanged until a curator decision is made."}
      </text>
    </svg>
  );
}

export function PaperCovidExampleGraph({
  step,
  selectedCandidate,
  selectedDecision = null,
  highlightedEdge = null,
  highlightedNode = null,
}: {
  step: PaperDemoStep;
  selectedCandidate: PaperDemoCandidate | undefined;
  selectedDecision?: UserRefinementDecision;
  highlightedEdge?: string | null;
  highlightedNode?: string | null;
}) {
  if (step === "diff") {
    return (
      <div className="grid h-full min-h-[70vh] w-full grid-cols-1 gap-2 lg:grid-cols-2" data-testid="paper-demo-diff">
        <div className="border border-slate-200 bg-white p-2">
          <div className="text-center text-[12px] font-semibold">Before KG</div>
          <Graph
            step="before"
            selectedCandidate={selectedCandidate}
            selectedDecision={null}
            highlightedEdge={highlightedEdge}
            highlightedNode={highlightedNode}
            diffFocus
          />
        </div>
        <div className="border border-slate-200 bg-white p-2">
          <div className="text-center text-[12px] font-semibold">After KG</div>
          {selectedDecision === null ? (
            <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[12px] text-amber-900">
              No human decision yet. Accept or reject the selected candidate to see the KG difference.
            </p>
          ) : null}
          <Graph
            step="after"
            selectedCandidate={selectedCandidate}
            selectedDecision={selectedDecision}
            highlightedEdge={highlightedEdge}
            highlightedNode={highlightedNode}
            diffFocus
          />
        </div>
      </div>
    );
  }
  return (
    <Graph
      step={step}
      selectedCandidate={selectedCandidate}
      selectedDecision={selectedDecision}
      highlightedEdge={highlightedEdge}
      highlightedNode={highlightedNode}
    />
  );
}
