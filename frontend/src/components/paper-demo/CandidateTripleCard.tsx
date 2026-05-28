import { formatKgLabelParts } from "../../lib/kgLabels";
import type { DemoCandidate } from "../../demo-data/types";

function TriplePart({
  id,
  label,
  kind,
  tone,
}: {
  id: string;
  label?: string | null;
  kind: "entity" | "relation";
  tone: "sky" | "slate" | "amber";
}) {
  const parts = formatKgLabelParts(id, label ?? id, kind);
  const toneClass =
    tone === "sky"
      ? "bg-sky-50 text-sky-950 ring-sky-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-950 ring-amber-200"
        : "bg-slate-100 text-slate-800 ring-slate-200";

  return (
    <span className={`rounded-lg px-3 py-2 ring-1 ${toneClass} ${kind === "relation" ? "font-medium" : "font-semibold"}`}>
      <span className={`block ${kind === "relation" ? "text-sm font-mono" : "text-base"}`}>{parts.primary}</span>
      {parts.isRawId ? (
        <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{parts.secondary}</span>
      ) : parts.secondary && parts.secondary !== parts.primary ? (
        <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{parts.secondary}</span>
      ) : null}
    </span>
  );
}

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
        <TriplePart id={candidate.head} kind="entity" tone="sky" />
        <span className="font-mono text-slate-500">→</span>
        <TriplePart id={candidate.relation} label={candidate.relation} kind="relation" tone="slate" />
        <span className="font-mono text-slate-500">→</span>
        <TriplePart id={candidate.tail} kind="entity" tone="amber" />
      </div>
    </div>
  );
}