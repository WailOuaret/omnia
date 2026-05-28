import type { DemoCandidate, DemoCluster, DemoDatasetConfig } from "../../demo-data/types";
import { formatKgInline } from "../../lib/kgLabels";

export function TripleBasicsDetails() {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-semibold text-slate-900">What is a triple?</p>
      <p>
        A knowledge graph fact is <strong>Head → Relation → Tail</strong>.
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <strong>Head</strong> — starting entity
        </li>
        <li>
          <strong>Relation</strong> — connection type
        </li>
        <li>
          <strong>Tail</strong> — target entity
        </li>
      </ul>
      <p className="font-mono text-[11px] text-slate-600">Example: Q10444417 → occupation → Q2526255</p>
      <p className="text-[11px] text-slate-500">
        This benchmark uses raw entity IDs. Names are shown only when available.
      </p>
    </div>
  );
}

export function ClusteringDetails({ cluster }: { cluster: DemoCluster | null }) {
  if (!cluster) {
    return (
      <p className="text-xs text-slate-600">
        These heads are grouped because they share the same relation → tail pattern.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <p>These heads are grouped because they share the same relation → tail pattern.</p>
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 font-medium text-emerald-900">
        Pattern:{" "}
        {formatKgInline(cluster.sharedRelation, cluster.sharedRelation, "relation")} →{" "}
        {formatKgInline(cluster.sharedTail, undefined, "entity")}
      </p>
      <details className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
        <summary className="cursor-pointer font-semibold text-slate-800">Advanced</summary>
        <p className="mt-1 font-mono text-[10px] text-slate-500">key = (relation, tail)</p>
      </details>
    </div>
  );
}

export function CandidateGenerationDetails({ candidate }: { candidate: DemoCandidate | null }) {
  if (!candidate) {
    return (
      <p className="text-xs text-slate-600">
        OMNIA proposes dashed blue triples because similar entities in the group share this pattern.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <p className="font-semibold text-slate-900">Selected proposed triple</p>
      <dl className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
        <div>
          <dt className="text-slate-500">Head</dt>
          <dd>{formatKgInline(candidate.head, undefined, "entity")}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Relation</dt>
          <dd>{formatKgInline(candidate.relation, undefined, "relation")}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tail</dt>
          <dd>{formatKgInline(candidate.tail, undefined, "entity")}</dd>
        </div>
      </dl>
      <p>
        <strong>Why generated:</strong> Similar entities in this group share the same relation → tail
        pattern.
      </p>
    </div>
  );
}

export function FilteringDetails({ available }: { available: boolean }) {
  if (available) {
    return (
      <details className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-800">Advanced</summary>
        <p className="mt-1">Technical note: this step can use TransE distance.</p>
      </details>
    );
  }
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
        Structural filtering scores are not shown in this prepared scenario.
      </p>
      <p>This step shows where OMNIA would remove structurally unlikely candidates before LLM validation.</p>
    </div>
  );
}

export function LlmDetails({ available }: { available: boolean }) {
  if (available) {
    return null;
  }
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
        LLM/RAG evidence is not included in this online sample.
      </p>
      <p>This step shows where OMNIA would check semantic meaning using retrieved evidence.</p>
    </div>
  );
}

export function CompletedDetails({ dataset }: { dataset: DemoDatasetConfig }) {
  return (
    <p className="text-xs text-slate-600">
      This step shows how the KG changes after human feedback on {dataset.label}.
    </p>
  );
}
