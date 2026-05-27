import type { DemoCandidate } from "../demo-data/types";
import type { BackendGraphSlice, BackendGraphSliceEdge, BackendGraphSliceNode } from "./api";
import type { PaperDemoScenario } from "../types/scenario";

type ClusterRow = PaperDemoScenario["clusters"][number];

/** Build a focused graph slice for any cluster in a static scenario (not only the baked demo cluster). */
export function synthesizeClusterSlice(
  baseSlice: BackendGraphSlice,
  clusterRow: ClusterRow,
  clusterCandidates: DemoCandidate[],
  selectedCandidate: DemoCandidate | null,
): BackendGraphSlice {
  const members = clusterRow.members ?? [];
  const relation = clusterRow.shared_relation;
  const tail = clusterRow.shared_tail;
  const clusterId = clusterRow.cluster_id;

  const nodeIds = new Set<string>([...members, tail]);
  for (const candidate of clusterCandidates) {
    nodeIds.add(candidate.head);
    nodeIds.add(candidate.tail);
  }

  const nodes: BackendGraphSliceNode[] = Array.from(nodeIds).map((id) => ({
    id,
    label: id,
    type: "entity",
    source: "static_cluster_synthesis",
    role: members.includes(id) ? "cluster_member" : id === tail ? "shared_tail" : "candidate_endpoint",
    cluster_id: clusterId,
  }));

  const edges: BackendGraphSliceEdge[] = [];
  for (const head of members) {
    edges.push({
      id: `pattern:${clusterId}:${head}:${tail}`,
      source: head,
      target: tail,
      label: relation,
      status: "known",
      cluster_id: clusterId,
    });
  }

  for (const candidate of clusterCandidates) {
    edges.push({
      id: `cand:${candidate.candidateId}`,
      source: candidate.head,
      target: candidate.tail,
      label: candidate.relation,
      status: "candidate",
      candidate_id: candidate.candidateId,
      cluster_id: clusterId,
      distance: candidate.distance ?? null,
      threshold: candidate.threshold ?? null,
    });
  }

  const selectedBackendCandidate = selectedCandidate
    ? {
        candidate_id: selectedCandidate.candidateId,
        Head: selectedCandidate.head,
        Relation: selectedCandidate.relation,
        Tail: selectedCandidate.tail,
        cluster_ids: selectedCandidate.clusterIds ?? [clusterId],
        status_bucket: selectedCandidate.status,
        source_cluster: clusterId,
      }
    : baseSlice.selected_candidate;

  return {
    ...baseSlice,
    slice_id: `${baseSlice.slice_id}:cluster:${clusterId}`,
    label: `Selected pattern (${clusterId})`,
    nodes,
    edges,
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      triples: edges.length,
      candidates: clusterCandidates.length,
      clusters: 1,
    },
    selected_cluster: {
      ...clusterRow,
      cluster_key: `(${relation}, ${tail})`,
      selected: true,
    },
    selected_candidate: selectedBackendCandidate as BackendGraphSlice["selected_candidate"],
    data_available: true,
  };
}
