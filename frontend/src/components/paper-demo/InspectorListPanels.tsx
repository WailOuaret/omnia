import { formatKgInline } from "../../lib/kgLabels";
import type { DemoCandidate, DemoCluster } from "../../demo-data/types";

export function ClusterMembersList({
  cluster,
  onSelectMember,
}: {
  cluster: DemoCluster;
  onSelectMember?: (entityId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white" data-testid="cluster-members-list">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-900">All cluster members</p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Pattern: {formatKgInline(cluster.sharedRelation, cluster.sharedRelation, "relation")} →{" "}
          {formatKgInline(cluster.sharedTail, undefined, "entity")}
        </p>
      </div>
      <ul className="max-h-64 divide-y divide-slate-100 overflow-auto">
        {cluster.entities.map((entityId) => (
          <li key={entityId}>
            <button
              type="button"
              onClick={() => onSelectMember?.(entityId)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{formatKgInline(entityId, undefined, "entity")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProposedTriplesList({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
}: {
  candidates: DemoCandidate[];
  selectedCandidateId?: string | null;
  onSelectCandidate?: (candidateId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white" data-testid="proposed-triples-list">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-900">All proposed triples</p>
        <p className="mt-0.5 text-[11px] text-slate-600">{candidates.length} candidates in this cluster context</p>
      </div>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-auto">
        {candidates.map((candidate) => {
          const selected = candidate.candidateId === selectedCandidateId;
          return (
            <li key={candidate.candidateId}>
              <button
                type="button"
                onClick={() => onSelectCandidate?.(candidate.candidateId)}
                className={`w-full px-3 py-2 text-left text-[11px] hover:bg-slate-50 ${selected ? "bg-sky-50" : ""}`}
              >
                <span className="font-medium text-slate-900">
                  {formatKgInline(candidate.head, undefined, "entity")} →{" "}
                  {formatKgInline(candidate.relation, undefined, "relation")} →{" "}
                  {formatKgInline(candidate.tail, undefined, "entity")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
