import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CandidateRecord } from "../../types";
import { DEMO_BADGE_STYLE, classifyCandidateRow } from "./demoStatusTokens";

interface DemoFilteringHistogramProps {
  rows: CandidateRecord[];
  threshold?: number | null;
  selected?: CandidateRecord | null;
}

/**
 * TransE distance histogram for the demo workbench.
 *
 * Renders only when at least one candidate row carries a numeric
 * `distance`. Bars are colored using the unified status palette:
 *  - emerald = filtered_passed
 *  - red dashed = filtered_rejected
 *  - cyan = bin containing the selected candidate
 *
 * Threshold τ is drawn as a dashed reference line so audiences see the
 * gate visually instead of reading it from a paragraph.
 */
export function DemoFilteringHistogram({
  rows,
  threshold,
  selected,
}: DemoFilteringHistogramProps) {
  const distances = useMemo(
    () =>
      rows
        .filter((row) => typeof row.distance === "number")
        .map((row) => ({
          row,
          distance: row.distance as number,
          status: classifyCandidateRow(row),
        })),
    [rows],
  );

  const chartData = useMemo(() => {
    if (!distances.length) return [];
    const min = Math.min(...distances.map((d) => d.distance));
    const max = Math.max(...distances.map((d) => d.distance));
    const span = Math.max(0.0001, max - min);
    const bucketCount = Math.min(20, Math.max(8, Math.round(Math.sqrt(distances.length))));
    const step = span / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, idx) => {
      const start = min + idx * step;
      const end = idx === bucketCount - 1 ? max + 1e-9 : start + step;
      return {
        idx,
        start,
        end,
        center: (start + end) / 2,
        passed: 0,
        rejected: 0,
        unresolved: 0,
        total: 0,
        containsSelected: false,
      };
    });

    const selectedDist =
      selected && typeof selected.distance === "number" ? (selected.distance as number) : null;

    for (const d of distances) {
      let target = Math.floor(((d.distance - min) / span) * bucketCount);
      if (target >= bucketCount) target = bucketCount - 1;
      const bucket = buckets[target];
      bucket.total += 1;
      if (
        d.status === "filtered_passed" ||
        d.status === "llm_accepted" ||
        d.status === "llm_rejected"
      ) {
        bucket.passed += 1;
      } else if (d.status === "filtered_rejected") {
        bucket.rejected += 1;
      } else {
        bucket.unresolved += 1;
      }
      if (selectedDist !== null && d.distance === selectedDist) {
        bucket.containsSelected = true;
      }
    }
    return buckets;
  }, [distances, selected]);

  if (!distances.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-600">
        No TransE distances available yet — run the filtering stage to surface the histogram.
      </p>
    );
  }

  const passed = DEMO_BADGE_STYLE.filtered_passed.color;
  const rejected = DEMO_BADGE_STYLE.filtered_rejected.color;
  const unresolved = DEMO_BADGE_STYLE.unresolved.color;
  const selectedColor = DEMO_BADGE_STYLE.selected.color;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="demo-filtering-histogram">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">TransE distances</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Lower distance = structurally more plausible. Threshold τ
            {typeof threshold === "number" ? ` ≈ ${threshold.toFixed(3)}` : ""} marks the gate.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-700">
          <Swatch color={passed}>Passed</Swatch>
          <Swatch color={rejected}>Rejected</Swatch>
          <Swatch color={unresolved}>Pending</Swatch>
          <Swatch color={selectedColor}>Selected</Swatch>
        </ul>
      </div>
      <div className="mt-3 h-44 w-full" role="img" aria-label="TransE distance histogram">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <XAxis
              dataKey="center"
              type="number"
              domain={["auto", "auto"]}
              tickFormatter={(value) => Number(value).toFixed(2)}
              tick={{ fontSize: 10, fill: "#475569" }}
              stroke="#CBD5F5"
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#475569" }} stroke="#CBD5F5" />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
              labelFormatter={(value) => `Distance ≈ ${Number(value).toFixed(3)}`}
              formatter={(value: number, _key, ctx) => {
                const datum = (ctx?.payload ?? {}) as {
                  passed?: number;
                  rejected?: number;
                  unresolved?: number;
                  total?: number;
                };
                return [value, `total ${datum.total ?? 0}`];
              }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {chartData.map((datum) => {
                let color = unresolved;
                if (datum.containsSelected) color = selectedColor;
                else if (datum.rejected > datum.passed && datum.rejected > datum.unresolved) color = rejected;
                else if (datum.passed > 0) color = passed;
                return <Cell key={`bar-${datum.idx}`} fill={color} fillOpacity={0.85} />;
              })}
            </Bar>
            {typeof threshold === "number" ? (
              <ReferenceLine
                x={threshold}
                stroke="#0F172A"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: `τ ${threshold.toFixed(2)}`, position: "top", fill: "#0F172A", fontSize: 10 }}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Swatch({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1">
      <span aria-hidden style={{ background: color }} className="inline-block h-2 w-3 rounded-sm" />
      {children}
    </li>
  );
}
