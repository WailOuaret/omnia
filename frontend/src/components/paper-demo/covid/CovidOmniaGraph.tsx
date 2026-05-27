import {
  COVID_ENT,
  COVID_ORIG_TRIPLES,
  COVID_POS,
  COVID_TYPE_STYLE,
  type CovidEntityId,
} from "./covidOmniaDemoData";

interface TripleEdge {
  h: CovidEntityId;
  t: CovidEntityId;
  r: string;
}

interface CovidOmniaGraphProps {
  triples?: TripleEdge[];
  missing?: TripleEdge[];
  highlight?: CovidEntityId[];
  dim?: CovidEntityId[];
  clusterBox?: boolean;
  className?: string;
}

function GraphNode({
  id,
  highlight,
  dim,
}: {
  id: CovidEntityId;
  highlight?: boolean;
  dim?: boolean;
}) {
  const { x, y } = COVID_POS[id];
  const ent = COVID_ENT[id];
  const s = COVID_TYPE_STYLE[ent.type];
  const W = 100;
  const H = 26;
  const opacity = dim ? 0.3 : 1;
  const strokeW = highlight ? 2.5 : 1;
  const stroke = highlight ? s.border : "#C8C6BC";

  return (
    <g transform={`translate(${x - W / 2},${y - H / 2})`} style={{ opacity }}>
      <rect width={W} height={H} rx="5" fill={s.bg} stroke={stroke} strokeWidth={strokeW} />
      <text
        x={W / 2}
        y={H / 2 + 4}
        fontSize="11"
        fill={s.text}
        textAnchor="middle"
        fontWeight="500"
      >
        {ent.label}
      </text>
    </g>
  );
}

function GraphEdge({
  h,
  t,
  r,
  dashed,
  color,
  labelOffset,
}: TripleEdge & { dashed?: boolean; color?: string; labelOffset?: number }) {
  const hp = COVID_POS[h];
  const tp = COVID_POS[t];
  const dx = tp.x - hp.x;
  const dy = tp.y - hp.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist;
  const ny = dy / dist;
  const W2 = 52;
  const H2 = 14;
  const sx = hp.x + nx * W2;
  const sy = hp.y + ny * H2;
  const ex = tp.x - nx * (W2 + 7);
  const ey = tp.y - ny * (H2 + 7);
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const perpX = -ny * (labelOffset ?? 10);
  const perpY = nx * (labelOffset ?? 10);
  const stroke = color ?? "#B4B2A9";
  const markId = color ? `arr-${color.replace("#", "")}` : "arr-default";

  return (
    <g>
      <defs>
        <marker id={markId} markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0,7 2.5,0 5" fill={stroke} />
        </marker>
      </defs>
      <line
        x1={sx}
        y1={sy}
        x2={ex}
        y2={ey}
        stroke={stroke}
        strokeWidth="1.5"
        strokeDasharray={dashed ? "5,3" : undefined}
        markerEnd={`url(#${markId})`}
      />
      <text
        x={mx + perpX}
        y={my + perpY}
        fontSize="10"
        fill={color ?? "#888780"}
        textAnchor="middle"
        fontWeight={color ? 500 : 400}
      >
        {r}
      </text>
    </g>
  );
}

export function CovidOmniaGraph({
  triples = COVID_ORIG_TRIPLES,
  missing,
  highlight,
  dim,
  clusterBox,
  className,
}: CovidOmniaGraphProps) {
  return (
    <svg
      viewBox="0 0 640 290"
      className={className ?? "h-auto w-full max-h-[320px]"}
      role="img"
      aria-label="COVID-19 knowledge graph sample"
    >
      {clusterBox ? (
        <>
          <rect
            x="12"
            y="40"
            width="198"
            height="235"
            rx="8"
            fill="#E1F5EE"
            fillOpacity="0.4"
            stroke="#1D9E75"
            strokeWidth="1.5"
            strokeDasharray="6,3"
          />
          <text x="20" y="35" fontSize="10" fill="#1D9E75" fontWeight="500">
            Cluster C₁ — pattern: inhibits → 2019-nCoV
          </text>
        </>
      ) : null}
      {triples.map((tr, i) => (
        <GraphEdge key={`t-${i}`} {...tr} />
      ))}
      {(missing ?? []).map((tr, i) => (
        <GraphEdge key={`m-${i}`} {...tr} dashed color="#BA7517" />
      ))}
      {(Object.keys(COVID_ENT) as CovidEntityId[]).map((id) => (
        <GraphNode
          key={id}
          id={id}
          highlight={highlight?.includes(id)}
          dim={dim ? !dim.includes(id) : false}
        />
      ))}
    </svg>
  );
}
