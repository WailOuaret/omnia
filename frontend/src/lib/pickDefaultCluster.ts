import type { DemoCandidate, DemoCluster } from "../demo-data/types";

/** Prefer a cluster with candidates for teacher-facing demos. */
export function pickDefaultClusterId(
  clusters: DemoCluster[],
  candidates: DemoCandidate[],
  preferredId?: string | null,
): string | null {
  if (
    preferredId &&
    clusters.some((cluster) => cluster.id === preferredId)
  ) {
    return preferredId;
  }

  const scored = clusters
    .map((cluster) => {
      const memberCount = cluster.size ?? cluster.entities.length;
      const candidateCount = candidates.filter((candidate) =>
        candidate.clusterIds?.includes(cluster.id),
      ).length;
      return { id: cluster.id, memberCount, candidateCount };
    })
    .filter((row) => row.candidateCount >= 1 && row.memberCount >= 3);

  scored.sort((a, b) => {
    const ideal = (count: number) => (count >= 3 && count <= 12 ? 0 : 1);
    const idealDiff = ideal(a.memberCount) - ideal(b.memberCount);
    if (idealDiff !== 0) return idealDiff;
    if (b.candidateCount !== a.candidateCount) return b.candidateCount - a.candidateCount;
    return b.memberCount - a.memberCount;
  });

  if (scored.length > 0) return scored[0].id;
  return preferredId ?? clusters[0]?.id ?? null;
}

export function pickDefaultCandidateId(
  candidates: DemoCandidate[],
  clusterId: string | null,
  preferredId?: string | null,
): string | null {
  const clusterCandidates = clusterId
    ? candidates.filter((candidate) => candidate.clusterIds?.includes(clusterId))
    : candidates;

  if (
    preferredId &&
    clusterCandidates.some((candidate) => candidate.candidateId === preferredId)
  ) {
    return preferredId;
  }

  const kept = clusterCandidates.find(
    (candidate) => candidate.status !== "removed" && candidate.llmVerdict !== undefined,
  );
  if (kept) return kept.candidateId;
  if (clusterCandidates.length === 1) return clusterCandidates[0].candidateId;
  return clusterCandidates[0]?.candidateId ?? null;
}
