import type { PaperDemoStep } from "./paperDemoTypes";

const R = 42;
const VB_W = 880;
const VB_H = 520;

type NodeId =
  | "remdesivir"
  | "chloroquine"
  | "sars_cov_2"
  | "ncov"
  | "fda"
  | "hcq"
  | "severe"
  | "mers"
  | "favipiravir"
  | "covid19";

/** Faded in the paper figure so the COVID running-example evidence stays dominant. */
const SECONDARY_NODE_IDS = new Set<NodeId>(["mers", "favipiravir", "hcq", "covid19", "severe"]);

const NODES: Record<NodeId, { x: number; y: number; label: string }> = {
  remdesivir: { x: 260, y: 260, label: "remdesivir" },
  chloroquine: { x: 520, y: 260, label: "chloroquine" },
  sars_cov_2: { x: 390, y: 110, label: "sars-cov-2" },
  ncov: { x: 390, y: 420, label: "2019-ncov" },
  fda: { x: 680, y: 150, label: "FDA" },
  hcq: { x: 720, y: 320, label: "hydroxychloroquine" },
  severe: { x: 130, y: 420, label: "severe covid-19" },
  mers: { x: 100, y: 170, label: "MERS" },
  favipiravir: { x: 610, y: 470, label: "favipiravir" },
  covid19: { x: 760, y: 470, label: "covid-19" },
};

type EdgeDef = {
  id: string;
  from: NodeId;
  to: NodeId;
  label: string;
};

const EDGES: EdgeDef[] = [
  { id: "t1", from: "remdesivir", to: "sars_cov_2", label: "treats" },
  { id: "t2", from: "remdesivir", to: "ncov", label: "inhibits" },
  { id: "t3", from: "chloroquine", to: "ncov", label: "inhibits" },
  { id: "t5", from: "fda", to: "chloroquine", label: "approves" },
  { id: "t6", from: "remdesivir", to: "severe", label: "affects" },
  { id: "t4", from: "chloroquine", to: "sars_cov_2", label: "treats" },
  { id: "r1", from: "chloroquine", to: "mers", label: "affects" },
  { id: "e_f", from: "favipiravir", to: "covid19", label: "treats" },
  { id: "e_h", from: "hcq", to: "covid19", label: "treats" },
];

function segment(a: NodeId, b: NodeId): { x1: number; y1: number; x2: number; y2: number } {
  const A = NODES[a];
  const B = NODES[b];
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: A.x + ux * R,
    y1: A.y + uy * R,
    x2: B.x - ux * R,
    y2: B.y - uy * R,
  };
}

function edgeVisible(step: PaperDemoStep, edgeId: string): boolean {
  if (step === "before") {
    return ["t1", "t2", "t3", "t5", "t6"].includes(edgeId);
  }
  if (step === "missing") {
    return ["t1", "t2", "t3", "t4", "t5", "t6", "e_f", "e_h"].includes(edgeId);
  }
  if (step === "cluster") {
    return ["t1", "t2", "t3", "t4", "t5", "t6"].includes(edgeId);
  }
  if (step === "filtering") {
    return ["t1", "t2", "t3", "t4", "t5", "t6", "r1", "e_f", "e_h"].includes(edgeId);
  }
  if (step === "llm") {
    return ["t1", "t2", "t3", "t4", "t5", "t6", "e_f", "e_h"].includes(edgeId);
  }
  if (step === "after") {
    return ["t1", "t2", "t3", "t4", "t5", "t6", "e_f", "e_h"].includes(edgeId);
  }
  return false;
}

function edgeStyle(
  step: PaperDemoStep,
  e: EdgeDef,
): { stroke: string; strokeWidth: number; dash: string; opacity: number } {
  const dim = { stroke: "#64748b", strokeWidth: 1.25, dash: "", opacity: 0.36 };
  /** Original / validated KG triples — thin neutral-green (paper-style). */
  const orig = { stroke: "#15803d", strokeWidth: 1.35, dash: "", opacity: 1 };
  /** Missing candidate t4 — thick dashed orange. */
  const cand = { stroke: "#ea580c", strokeWidth: 4.25, dash: "14 9", opacity: 1 };
  /** Accepted t4 — thick solid green. */
  const candSolid = { stroke: "#15803d", strokeWidth: 3.6, dash: "", opacity: 1 };
  /** Rejected candidate — faint dashed red. */
  const rej = { stroke: "#dc2626", strokeWidth: 1.15, dash: "5 5", opacity: 0.16 };
  const ctx = { stroke: "#64748b", strokeWidth: 1.35, dash: "", opacity: 0.82 };

  if (step === "before") {
    if (e.id === "t1" || e.id === "t2" || e.id === "t3") return orig;
    if (e.id === "t5" || e.id === "t6") return ctx;
    return orig;
  }
  if (step === "missing") {
    if (e.id === "t4") return cand;
    return dim;
  }
  if (step === "cluster") {
    if (e.id === "t4") return cand;
    if (e.id === "t2" || e.id === "t3") return { ...orig, strokeWidth: 1.65, stroke: "#16a34a" };
    if (e.id === "t1") return { ...orig, opacity: 0.78 };
    return { stroke: "#64748b", strokeWidth: 1.35, dash: "", opacity: 0.48 };
  }
  if (step === "filtering") {
    if (e.id === "r1") return rej;
    if (e.id === "t4") return cand;
    if (e.id === "t1" || e.id === "t2" || e.id === "t3") return orig;
    return ctx;
  }
  if (step === "llm") {
    if (e.id === "t4") return cand;
    if (e.id === "t1" || e.id === "t2" || e.id === "t3") return orig;
    return ctx;
  }
  if (step === "after") {
    if (e.id === "t4") return candSolid;
    if (e.id === "t1" || e.id === "t2" || e.id === "t3") return orig;
    return ctx;
  }
  return orig;
}

function highlightNodes(step: PaperDemoStep): Set<NodeId> {
  const h = new Set<NodeId>();
  if (step === "missing") {
    h.add("chloroquine");
    h.add("sars_cov_2");
  }
  if (step === "llm") {
    h.add("chloroquine");
    h.add("sars_cov_2");
  }
  return h;
}

function NodeLabel({
  x,
  y,
  label,
  opacity = 1,
}: {
  x: number;
  y: number;
  label: string;
  opacity?: number;
}) {
  const fs = label.length > 16 ? 8 : 10;
  const parts = label.split(/[\s-]+/).filter(Boolean);
  if (parts.length <= 1) {
    return (
      <text x={x} y={y + 4} textAnchor="middle" fill="#1e293b" opacity={opacity} style={{ fontSize: fs }}>
        {label}
      </text>
    );
  }
  if (parts.length === 2) {
    return (
      <text x={x} y={y} textAnchor="middle" fill="#1e293b" opacity={opacity} style={{ fontSize: 9 }}>
        <tspan x={x} dy="-3">
          {parts[0]}
        </tspan>
        <tspan x={x} dy="12">
          {parts[1]}
        </tspan>
      </text>
    );
  }
  const line1 = `${parts[0]} ${parts[1]}`;
  const line2 = parts.slice(2).join(" ");
  return (
    <text x={x} y={y} textAnchor="middle" fill="#1e293b" opacity={opacity} style={{ fontSize: 8 }}>
      <tspan x={x} dy="-5">
        {line1}
      </tspan>
      <tspan x={x} dy="11">
        {line2}
      </tspan>
    </text>
  );
}

function GraphSvgBody({
  step,
  variant,
  markerPrefix = "paper",
}: {
  step: PaperDemoStep;
  variant: "full" | "beforeOnly" | "afterOnly";
  markerPrefix?: string;
}) {
  const effectiveStep = variant === "beforeOnly" ? "before" : variant === "afterOnly" ? "after" : step;
  const mp = markerPrefix;
  const hi = highlightNodes(effectiveStep);

  const showClusterHalo = effectiveStep === "cluster";
  const showClusterBanner = effectiveStep === "cluster" && variant === "full";
  const showLlmChips = effectiveStep === "llm" && variant === "full";

  const rx = (NODES.chloroquine.x + NODES.remdesivir.x) / 2;
  const ry = (NODES.chloroquine.y + NODES.remdesivir.y) / 2;
  const rw = 340;
  const rh = 120;

  const visibleEdges = EDGES.filter((e) => {
    if (!edgeVisible(effectiveStep, e.id)) return false;
    if (variant === "beforeOnly" && e.id === "t4") return false;
    if (variant === "afterOnly" && e.id === "r1") return false;
    return true;
  });

  return (
    <>
      <defs>
        <marker id={`${mp}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#475569" />
        </marker>
        <marker id={`${mp}-arrow-green`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#15803d" />
        </marker>
        <marker id={`${mp}-arrow-orange`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#ea580c" />
        </marker>
      </defs>

      {/* 1 — Background / cluster halo */}
      {showClusterHalo ? (
        <ellipse
          cx={rx}
          cy={ry}
          rx={rw / 2}
          ry={rh / 2}
          fill="none"
          stroke="#1e40af"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          opacity={0.45}
        />
      ) : null}

      {/* 2 — Edges (geometry only; paints below nodes) */}
      {visibleEdges.map((e) => {
        const { x1, y1, x2, y2 } = segment(e.from, e.to);
        const st = edgeStyle(effectiveStep, e);
        const marker =
          st.stroke === "#ea580c"
            ? `url(#${mp}-arrow-orange)`
            : st.stroke === "#15803d" || st.stroke === "#16a34a"
              ? `url(#${mp}-arrow-green)`
              : `url(#${mp}-arrow)`;
        return (
          <line
            key={`${e.id}-${variant}-line`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={st.stroke}
            strokeWidth={st.strokeWidth}
            strokeDasharray={st.dash}
            opacity={st.opacity}
            markerEnd={marker}
          />
        );
      })}

      {/* 3 — Nodes */}
      {(Object.entries(NODES) as [NodeId, (typeof NODES)[NodeId]][]).map(([id, n]) => {
        const ringFocus = (effectiveStep === "missing" || effectiveStep === "llm") && hi.has(id);
        const clusterHead = effectiveStep === "cluster" && (id === "remdesivir" || id === "chloroquine");
        const secondary = SECONDARY_NODE_IDS.has(id);
        const nodeOp = secondary ? 0.34 : 1;
        const strokeSel = ringFocus ? "#1d4ed8" : clusterHead ? "#1e40af" : "#334155";
        const strokeWSel = ringFocus ? 2.6 : clusterHead ? 2.5 : 1.85;
        return (
          <g key={id} opacity={nodeOp}>
            <circle
              cx={n.x}
              cy={n.y}
              r={R}
              fill="#fafafa"
              stroke={strokeSel}
              strokeWidth={strokeWSel}
              className="paper-demo-node"
            />
            <NodeLabel x={n.x} y={n.y} label={n.label} opacity={secondary ? 0.85 : 1} />
          </g>
        );
      })}

      {/* 4 — Edge labels & badges */}
      {visibleEdges.map((e) => {
        const { x1, y1, x2, y2 } = segment(e.from, e.to);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const showMissingSub = effectiveStep === "missing" && e.id === "t4" && variant === "full";
        const showAcceptedSub =
          (effectiveStep === "after" || variant === "afterOnly") && e.id === "t4" && variant !== "beforeOnly";
        const stackSubs = e.id === "t4" && (showMissingSub || showAcceptedSub);
        const labelY = stackSubs ? midY - 10 : midY - 2;
        return (
          <g key={`${e.id}-${variant}-labels`}>
            <rect
              x={midX - 38}
              y={labelY - 9}
              width={76}
              height={15}
              rx={2}
              fill="#ffffff"
              stroke="#cbd5e1"
              opacity={0.98}
            />
            <text
              x={midX}
              y={labelY + 2}
              textAnchor="middle"
              fill="#334155"
              style={{ fontSize: "10px", fontWeight: 500 }}
            >
              {e.label}
            </text>
            {showMissingSub ? (
              <g>
                <rect
                  x={midX - 52}
                  y={labelY + 12}
                  width={104}
                  height={13}
                  rx={2}
                  fill="#fffbeb"
                  stroke="#fdba74"
                  opacity={0.98}
                />
                <text
                  x={midX}
                  y={labelY + 21}
                  textAnchor="middle"
                  fill="#9a3412"
                  style={{ fontSize: "9px", fontWeight: 600 }}
                >
                  missing candidate
                </text>
              </g>
            ) : null}
            {showAcceptedSub ? (
              <g>
                <rect
                  x={midX - 36}
                  y={labelY + 12}
                  width={72}
                  height={12}
                  rx={2}
                  fill="#ecfdf5"
                  stroke="#86efac"
                  opacity={0.98}
                />
                <text
                  x={midX}
                  y={labelY + 21}
                  textAnchor="middle"
                  fill="#166534"
                  style={{ fontSize: "9px", fontWeight: 600 }}
                >
                  accepted
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* 5 — Top annotations (render above geometry for readability) */}
      {showClusterBanner ? (
        <g>
          <text
            x={VB_W / 2}
            y={24}
            textAnchor="middle"
            fill="#0f172a"
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            Shared relation-tail key: (inhibits, 2019-ncov)
          </text>
          <text
            x={VB_W / 2}
            y={42}
            textAnchor="middle"
            fill="#334155"
            style={{ fontSize: "11px", fontWeight: 500 }}
          >
            OMNIA propagates (treats, sars-cov-2) from remdesivir to chloroquine.
          </text>
        </g>
      ) : null}

      {showLlmChips ? (
        <g data-testid="paper-llm-chips">
          <text
            x={VB_W / 2}
            y={22}
            textAnchor="middle"
            fill="#0f172a"
            style={{ fontSize: "12px", fontWeight: 600 }}
          >
            LLM/RAG validates candidate c1
          </text>
          <g transform={`translate(${VB_W / 2 - (4 * 56) / 2}, 34)`}>
            {["t1", "t2", "t3", "f2"].map((t, i) => (
              <g key={t} transform={`translate(${i * 56}, 0)`}>
                <rect width={50} height={20} rx={3} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
                <text x={25} y={14} textAnchor="middle" fill="#334155" style={{ fontSize: "10px", fontWeight: 500 }}>
                  {t}
                </text>
              </g>
            ))}
          </g>
        </g>
      ) : null}
    </>
  );
}

function AnnotationLabel({ step, variant }: { step: PaperDemoStep; variant: "full" | "beforeOnly" | "afterOnly" }) {
  const text =
    variant === "beforeOnly"
      ? "Before KG — no t4 edge"
      : variant === "afterOnly"
        ? "After KG — t4 accepted"
        : step === "diff"
          ? ""
          : {
              before: "Input KG before OMNIA completion",
              missing: "t4 = (chloroquine, treats, sars-cov-2) is absent from the original KG",
              cluster: "Heads remdesivir and chloroquine co-cluster on the shared relation–tail key",
              filtering: "TransE: candidate t4 passes threshold τ = 0.80 (rejected example r1 above τ)",
              llm: "RAG context validates candidate (retrieved: t1, t2, t3, f2)",
              after: "t4 integrated as an accepted relation in the completed KG",
              diff: "",
            }[step];

  if (!text) return null;
  return (
    <text x={24} y={VB_H - 20} className="fill-slate-600" style={{ fontSize: "12px" }}>
      {text}
    </text>
  );
}

export function PaperCovidExampleGraph({ step }: { step: PaperDemoStep }) {
  if (step === "diff") {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2" data-testid="paper-demo-diff">
        <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border border-slate-200 bg-white p-2">
          <span className="mb-1 text-center text-[12px] font-semibold text-slate-800">Before KG</span>
          <svg
            role="img"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-auto w-full max-h-[280px]"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden={false}
          >
            <title>Knowledge graph before OMNIA completion</title>
            <desc>Original triples without the missing chloroquine treats sars-cov-2 edge.</desc>
            <GraphSvgBody step="diff" variant="beforeOnly" markerPrefix="pdiff-a" />
            <AnnotationLabel step="diff" variant="beforeOnly" />
          </svg>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border border-slate-200 bg-white p-2">
          <span className="mb-1 text-center text-[12px] font-semibold text-slate-800">After KG</span>
          <svg
            role="img"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-auto w-full max-h-[280px]"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden={false}
          >
            <title>Knowledge graph after OMNIA completion</title>
            <desc>Completed graph including accepted treats edge from chloroquine to sars-cov-2.</desc>
            <GraphSvgBody step="diff" variant="afterOnly" markerPrefix="pdiff-b" />
            <AnnotationLabel step="diff" variant="afterOnly" />
          </svg>
        </div>
        </div>
        <p className="border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[12px] font-medium leading-snug text-slate-800">
          Added by OMNIA: chloroquine treats sars-cov-2
        </p>
      </div>
    );
  }

  return (
    <svg
      role="img"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="paper-demo-main-svg h-full min-h-[min(340px,36vh)] w-full max-h-[min(520px,48vh)]"
      preserveAspectRatio="xMidYMid meet"
      data-testid="paper-demo-graph-svg"
      data-step={step}
    >
      <title>OMNIA COVID-19 running example knowledge graph</title>
      <desc>
        Fixed-layout demonstration graph with drugs, viruses, and regulatory entities. Edge styles change by demo
        step to show original, missing candidate, cluster, filtering, validation, and completion states.
      </desc>
      <rect width={VB_W} height={VB_H} fill="#fafafa" />
      <GraphSvgBody step={step} variant="full" />
      {step === "llm" ? (
        <text x={24} y={VB_H - 42} fill="#475569" style={{ fontSize: "11px" }}>
          Offline demo mode: using precomputed OMNIA validation results.
        </text>
      ) : null}
      <text x={24} y={step === "llm" ? VB_H - 22 : VB_H - 18} fill="#475569" style={{ fontSize: "12px" }}>
        {
          {
            before: "Input KG before OMNIA completion",
            missing: "t4 = (chloroquine, treats, sars-cov-2) is absent from the original KG",
            cluster: "Heads remdesivir and chloroquine co-cluster on the shared relation–tail key",
            filtering: "TransE: candidate t4 passes threshold τ = 0.80 (rejected example r1 above τ)",
            llm: "RAG context validates candidate (retrieved: t1, t2, t3, f2)",
            after: "t4 integrated as an accepted relation in the completed KG",
            diff: "",
          }[step]
        }
      </text>
    </svg>
  );
}
