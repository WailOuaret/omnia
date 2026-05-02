import clsx from "clsx";

interface ClusterEvidenceDiagramProps {
  relation: string;
  tail: string;
  heads: string[];
  candidate: { head: string; relation: string; tail: string };
  clusterKey?: string;
  weakHint?: string | null;
}

export function ClusterEvidenceDiagram({
  relation,
  tail,
  heads,
  candidate,
  clusterKey,
  weakHint,
}: ClusterEvidenceDiagramProps) {
  const displayHeads = heads.filter(Boolean).slice(0, 12);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-800 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">Relation-tail clustering proof</p>
        {weakHint ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">{weakHint}</span> : null}
      </div>
      <p className="mt-2 text-xs leading-snug text-slate-600">
        Heads that co-occur on the same <span className="font-mono font-semibold">(relation → tail)</span> key explain why OMNIA
        propagates that pattern inside the cluster to generate a candidate.
      </p>
      {clusterKey ? <p className="mt-2 font-mono text-[11px] text-slate-500">cluster: {clusterKey}</p> : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Source heads</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-r-0 pb-4 md:border-r md:border-slate-200 md:pr-4 md:pb-0">
            {displayHeads.map((h) => (
              <span key={h} className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-800">
                {h}
              </span>
            ))}
            <span className="self-center text-slate-400">┐</span>
          </div>
        </div>

        <div className="hidden text-center font-mono text-2xl text-slate-400 md:block">┃</div>

        <div className="space-y-2 md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Shared key</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900">
            ( <span className="font-semibold text-violet-700">{relation}</span>,{" "}
            <span className="font-semibold text-blue-700">{tail}</span> )
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-start gap-2 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
          Candidate propagated
        </span>
        <div
          className={clsx(
            "w-full rounded-lg border-2 border-dashed border-violet-500 bg-violet-50 px-4 py-2 font-mono text-sm md:w-auto md:min-w-[18rem]",
          )}
          title="Proposed triple"
          aria-label="Generated candidate triple"
        >
          ( {candidate.head}, <span className="text-violet-800">{candidate.relation}</span>, {candidate.tail} )
        </div>
      </div>
    </div>
  );
}
