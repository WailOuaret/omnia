import { formatKgInline } from "../../lib/kgLabels";
import type { DemoCandidate } from "../../demo-data/types";

export function CandidateTripleCard({
  candidate,
  decision,
  compact = false,
}: {
  candidate: DemoCandidate;
  decision?: "accept" | "reject" | "uncertain" | "correct" | null;
  compact?: boolean;
}) {
  const decisionRing =
    decision === "accept"
      ? "ring-emerald-400 bg-emerald-50"
      : decision === "reject"
        ? "ring-rose-400 bg-rose-50"
        : decision === "uncertain"
          ? "ring-amber-400 bg-amber-50"
          : decision === "correct"
            ? "ring-violet-400 bg-violet-50"
            : "ring-slate-200 bg-white";

  return (
    <div
      className={`rounded-xl border border-slate-200 p-4 ${decisionRing} ring-2`}
      data-testid="candidate-triple-card"
    >
      <div className={`flex flex-wrap items-center justify-center gap-3 ${compact ? "text-sm" : "text-base"}`}>
        <span className="rounded-lg bg-sky-50 px-3 py-2 font-semibold text-sky-950 ring-1 ring-sky-200">
          {formatKgInline(candidate.head, undefined, "entity")}
        </span>
        <span className="font-mono text-slate-500">→</span>
        <span className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm font-medium text-slate-800 ring-1 ring-slate-200">
          {formatKgInline(candidate.relation, undefined, "relation")}
        </span>
        <span className="font-mono text-slate-500">→</span>
        <span className="rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-950 ring-1 ring-amber-200">
          {formatKgInline(candidate.tail, undefined, "entity")}
        </span>
      </div>
    </div>
  );
}
