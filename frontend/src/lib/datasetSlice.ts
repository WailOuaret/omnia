import type {
  ClusterBox,
  DemoCandidate,
  DemoCluster,
  DemoDatasetConfig,
  GraphEdge,
  GraphNode,
} from "../demo-data/types";
import type { UserFeedback } from "../stores/feedbackStore";

export type SliceMode =
  | "guided"
  | "overview"
  | "entity"
  | "relation"
  | "cluster"
  | "candidate"
  | "feedback";

export type FeedbackBucket =
  | "any"
  | "accepted"
  | "rejected"
  | "reviewQueue"
  | "uncertain"
  | "corrected"
  | "unreviewed";

export type CandidateStatusFilter =
  | "any"
  | "candidate"
  | "kept"
  | "removed"
  | "llm_valid"
  | "llm_invalid"
  | "llm_uncertain"
  | "accepted"
  | "rejected"
  | "uncertain"
  | "corrected";

export interface DatasetSlice {
  mode: SliceMode;
  /** Free-text search for entity by id or label substring (case-insensitive). */
  entityQuery?: string;
  /** Free-text search for relation. Matches against `label`, `shortLabel`, `fullLabel`. */
  relationQuery?: string;
  /** Cluster id to focus on. */
  clusterId?: string;
  /** Candidate status filter (cluster propagation / filtering / LLM stages). */
  candidateStatus?: CandidateStatusFilter;
  /** Feedback bucket the candidate currently belongs to. */
  feedbackBucket?: FeedbackBucket;
  /** Optional neighborhood depth for entity slice (default 1, capped at 2). */
  entityDepth?: number;
  /** Optional bound on the number of nodes/edges to return. */
  limit?: number;
}

export interface SliceResult {
  mode: SliceMode;
  label: string;
  /** True when no filter has been applied — i.e. the default guided story. */
  isGuided: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: DemoCluster[];
  clusterBoxes: ClusterBox[];
  candidates: DemoCandidate[];
  stats: {
    nodes: number;
    edges: number;
    clusters: number;
    candidates: number;
  };
  /** Optional resolved entity id when `mode === "entity"`. */
  resolvedEntityId?: string;
}

const DEFAULT_LIMIT = 80;

export const GUIDED_SLICE: DatasetSlice = { mode: "guided" };

/** Return the latest decision per candidateId from a feedback event list. */
export function buildFeedbackBucketMap(
  events: UserFeedback[],
): Record<string, "accepted" | "rejected" | "uncertain" | "corrected"> {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const map: Record<string, "accepted" | "rejected" | "uncertain" | "corrected"> = {};
  for (const event of sorted) {
    if (event.userDecision === "accept") map[event.candidateId] = "accepted";
    else if (event.userDecision === "reject") map[event.candidateId] = "rejected";
    else if (event.userDecision === "uncertain") map[event.candidateId] = "uncertain";
    else if (event.userDecision === "correct") map[event.candidateId] = "corrected";
  }
  return map;
}

function matchEntityNode(node: GraphNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    node.id.toLowerCase().includes(q) ||
    (node.label ?? "").toLowerCase().includes(q) ||
    (node.shortLabel ?? "").toLowerCase().includes(q.replace(/\n/g, ""))
  );
}

function matchEdgeRelation(edge: GraphEdge, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    (edge.label ?? "").toLowerCase().includes(q) ||
    (edge.shortLabel ?? "").toLowerCase().includes(q) ||
    (edge.fullLabel ?? "").toLowerCase().includes(q)
  );
}

function resolveEntityId(dataset: DemoDatasetConfig, query: string): string | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  // Prefer an exact id or label hit.
  const exact = dataset.graph.nodes.find(
    (n) => n.id.toLowerCase() === q || (n.label ?? "").toLowerCase() === q,
  );
  if (exact) return exact.id;
  const partial = dataset.graph.nodes.find((n) => matchEntityNode(n, q));
  return partial?.id;
}

function neighborhoodNodeIds(
  dataset: DemoDatasetConfig,
  rootId: string,
  depth: number,
): Set<string> {
  const visited = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);
  for (let d = 0; d < depth; d += 1) {
    const next = new Set<string>();
    for (const edge of dataset.graph.edges) {
      if (frontier.has(edge.source) && !visited.has(edge.target)) next.add(edge.target);
      if (frontier.has(edge.target) && !visited.has(edge.source)) next.add(edge.source);
    }
    if (next.size === 0) break;
    for (const id of next) visited.add(id);
    frontier = next;
  }
  return visited;
}

function clusterEntityIds(dataset: DemoDatasetConfig, cluster: DemoCluster): Set<string> {
  const ids = new Set<string>();
  const lowered = new Set(cluster.entities.map((e) => e.toLowerCase()));
  for (const node of dataset.graph.nodes) {
    const matches =
      lowered.has(node.id.toLowerCase()) ||
      lowered.has((node.label ?? "").toLowerCase()) ||
      lowered.has((node.shortLabel ?? "").toLowerCase().replace(/\n/g, ""));
    if (matches) ids.add(node.id);
  }
  return ids;
}

function candidateMatchesStatus(
  candidate: DemoCandidate,
  filter: CandidateStatusFilter,
): boolean {
  if (filter === "any") return true;
  if (filter === "kept") return candidate.status !== "removed";
  if (filter === "candidate") return candidate.status === "candidate";
  if (filter === "removed") return candidate.status === "removed";
  if (filter === "llm_valid") return candidate.llmVerdict === "valid";
  if (filter === "llm_invalid") return candidate.llmVerdict === "invalid";
  if (filter === "llm_uncertain") return candidate.llmVerdict === "uncertain";
  if (filter === "accepted") return candidate.status === "accepted";
  if (filter === "rejected") return candidate.status === "rejected";
  if (filter === "uncertain") return candidate.status === "uncertain";
  if (filter === "corrected") return candidate.status === "corrected";
  return true;
}

function candidateMatchesFeedback(
  candidateId: string,
  bucket: FeedbackBucket,
  feedbackMap: Record<string, string>,
): boolean {
  if (bucket === "any") return true;
  if (bucket === "unreviewed") return !feedbackMap[candidateId];
  return feedbackMap[candidateId] === bucket;
}

/** Build a human-readable label for the slice. */
function buildSliceLabel(slice: DatasetSlice, resolved?: { entityId?: string }): string {
  switch (slice.mode) {
    case "guided":
      return "Guided demo (full subgraph)";
    case "entity":
      return resolved?.entityId
        ? `Neighborhood of ${resolved.entityId}`
        : slice.entityQuery
          ? `Entity search: "${slice.entityQuery}" (not found)`
          : "Entity neighborhood";
    case "relation":
      return slice.relationQuery
        ? `Relation: ${slice.relationQuery}`
        : "Relation filter";
    case "cluster":
      return slice.clusterId ? `Cluster ${slice.clusterId}` : "Cluster filter";
    case "candidate":
      return `Candidates · ${slice.candidateStatus ?? "any"}`;
    case "feedback":
      return `Feedback bucket · ${slice.feedbackBucket ?? "any"}`;
    default:
      return "Slice";
  }
}

/**
 * Apply a slice to a dataset. Returns the visible subgraph, clusters, candidates,
 * and counts. Pure function; uses only the static dataset config and the latest
 * feedback bucket map. The backend slice endpoint (when present) returns the
 * same shape so this is the canonical client-side fallback.
 */
export function applyDatasetSlice(
  dataset: DemoDatasetConfig,
  slice: DatasetSlice,
  feedbackEvents: UserFeedback[] = [],
  options?: { limit?: number },
): SliceResult {
  const limit = options?.limit ?? slice.limit ?? DEFAULT_LIMIT;
  const allNodes = dataset.graph.nodes;
  const allEdges = dataset.graph.edges;
  const allCandidates = dataset.candidates;
  const allClusters = dataset.clusters;
  const allClusterBoxes = dataset.graph.clusterBoxes ?? [];
  const feedbackMap = buildFeedbackBucketMap(feedbackEvents);

  if (slice.mode === "guided") {
    return {
      mode: "guided",
      label: buildSliceLabel(slice),
      isGuided: true,
      nodes: allNodes,
      edges: allEdges,
      clusters: allClusters,
      clusterBoxes: allClusterBoxes,
      candidates: allCandidates,
      stats: {
        nodes: allNodes.length,
        edges: allEdges.length,
        clusters: allClusters.length,
        candidates: allCandidates.length,
      },
    };
  }

  let visibleNodeIds: Set<string> | null = null;
  let visibleEdgeIds: Set<string> | null = null;
  let visibleClusterIds: Set<string> | null = null;
  let resolvedEntityId: string | undefined;

  if (slice.mode === "entity") {
    if (slice.entityQuery) {
      resolvedEntityId = resolveEntityId(dataset, slice.entityQuery);
      if (resolvedEntityId) {
        visibleNodeIds = neighborhoodNodeIds(
          dataset,
          resolvedEntityId,
          Math.min(2, Math.max(1, slice.entityDepth ?? 1)),
        );
      } else {
        visibleNodeIds = new Set<string>();
      }
    } else {
      visibleNodeIds = new Set<string>();
    }
  }

  if (slice.mode === "relation") {
    if (slice.relationQuery) {
      const matchingEdges = allEdges.filter((e) => matchEdgeRelation(e, slice.relationQuery!));
      visibleEdgeIds = new Set(matchingEdges.map((e) => e.id));
      visibleNodeIds = new Set<string>();
      for (const edge of matchingEdges) {
        visibleNodeIds.add(edge.source);
        visibleNodeIds.add(edge.target);
      }
    } else {
      visibleEdgeIds = new Set<string>();
      visibleNodeIds = new Set<string>();
    }
  }

  if (slice.mode === "cluster" && slice.clusterId) {
    const cluster = allClusters.find((c) => c.id === slice.clusterId);
    if (cluster) {
      visibleClusterIds = new Set([cluster.id]);
      const clusterNodes = clusterEntityIds(dataset, cluster);
      // Also include nodes that participate in candidate triples for this cluster
      // and the shared-tail node when present.
      for (const candidate of allCandidates) {
        if (candidate.clusterIds?.includes(cluster.id)) {
          const headNode = allNodes.find(
            (n) =>
              n.id.toLowerCase() === candidate.head.toLowerCase() ||
              (n.label ?? "").toLowerCase() === candidate.head.toLowerCase(),
          );
          const tailNode = allNodes.find(
            (n) =>
              n.id.toLowerCase() === candidate.tail.toLowerCase() ||
              (n.label ?? "").toLowerCase() === candidate.tail.toLowerCase(),
          );
          if (headNode) clusterNodes.add(headNode.id);
          if (tailNode) clusterNodes.add(tailNode.id);
        }
      }
      visibleNodeIds = clusterNodes;
    } else {
      visibleNodeIds = new Set<string>();
    }
  }

  // Compute filtered nodes/edges/clusters.
  let nodes = allNodes;
  let edges = allEdges;
  if (visibleNodeIds) {
    const set = visibleNodeIds;
    nodes = allNodes.filter((n) => set.has(n.id));
    edges = allEdges.filter(
      (e) =>
        set.has(e.source) &&
        set.has(e.target) &&
        (visibleEdgeIds ? visibleEdgeIds.has(e.id) : true),
    );
  } else if (visibleEdgeIds) {
    const set = visibleEdgeIds;
    edges = allEdges.filter((e) => set.has(e.id));
    const nodeSet = new Set<string>();
    for (const e of edges) {
      nodeSet.add(e.source);
      nodeSet.add(e.target);
    }
    nodes = allNodes.filter((n) => nodeSet.has(n.id));
  }

  // Limit safeguard.
  if (nodes.length > limit) nodes = nodes.slice(0, limit);
  const nodeSetFinal = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeSetFinal.has(e.source) && nodeSetFinal.has(e.target));

  // Cluster visibility — for candidate/feedback modes the full cluster set is kept.
  let clusters = allClusters;
  let clusterBoxes = allClusterBoxes;
  if (visibleClusterIds) {
    clusters = allClusters.filter((c) => visibleClusterIds!.has(c.id));
    clusterBoxes = allClusterBoxes.filter((b) => visibleClusterIds!.has(b.id));
  } else if (slice.mode === "entity" || slice.mode === "relation") {
    // Keep only clusters whose entities still appear in the visible nodes.
    const visibleLowered = new Set(
      nodes.flatMap((n) => [n.id.toLowerCase(), (n.label ?? "").toLowerCase()]),
    );
    clusters = allClusters.filter((c) =>
      c.entities.some((e) => visibleLowered.has(e.toLowerCase())),
    );
    const clusterSet = new Set(clusters.map((c) => c.id));
    clusterBoxes = allClusterBoxes.filter((b) => clusterSet.has(b.id));
  }

  // Candidate filtering — applies for every non-guided mode.
  let candidates = allCandidates;
  if (slice.mode === "entity" && resolvedEntityId) {
    candidates = allCandidates.filter(
      (c) =>
        nodeSetFinal.has(c.head.toLowerCase()) ||
        nodeSetFinal.has(c.tail.toLowerCase()) ||
        // also try matching by label when ids don't equal labels
        nodes.some(
          (n) =>
            (n.label ?? "").toLowerCase() === c.head.toLowerCase() ||
            (n.label ?? "").toLowerCase() === c.tail.toLowerCase(),
        ),
    );
  } else if (slice.mode === "relation" && slice.relationQuery) {
    const q = slice.relationQuery.trim().toLowerCase();
    candidates = allCandidates.filter((c) => c.relation.toLowerCase().includes(q));
  } else if (slice.mode === "cluster" && slice.clusterId) {
    candidates = allCandidates.filter((c) => c.clusterIds?.includes(slice.clusterId!));
  } else if (slice.mode === "candidate") {
    candidates = allCandidates.filter((c) =>
      candidateMatchesStatus(c, slice.candidateStatus ?? "any"),
    );
  } else if (slice.mode === "feedback") {
    candidates = allCandidates.filter((c) =>
      candidateMatchesFeedback(c.candidateId, slice.feedbackBucket ?? "any", feedbackMap),
    );
  }

  return {
    mode: slice.mode,
    label: buildSliceLabel(slice, { entityId: resolvedEntityId }),
    isGuided: false,
    nodes,
    edges,
    clusters,
    clusterBoxes,
    candidates,
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      clusters: clusters.length,
      candidates: candidates.length,
    },
    resolvedEntityId,
  };
}

/**
 * Build a derived `DemoDatasetConfig` whose graph reflects the slice.
 * For `candidate` and `feedback` slices the graph is left untouched and only
 * `candidates` is filtered (because those modes select candidates, not
 * structural slices).
 */
export function withSlicedGraph(
  dataset: DemoDatasetConfig,
  slice: DatasetSlice,
  feedbackEvents: UserFeedback[] = [],
): { dataset: DemoDatasetConfig; result: SliceResult } {
  const result = applyDatasetSlice(dataset, slice, feedbackEvents);
  const shouldSliceGraph =
    slice.mode === "entity" ||
    slice.mode === "relation" ||
    slice.mode === "cluster";
  const derived: DemoDatasetConfig = shouldSliceGraph
    ? {
        ...dataset,
        graph: {
          nodes: result.nodes,
          edges: result.edges,
          clusterBoxes: result.clusterBoxes,
        },
        clusters: result.clusters.length > 0 ? result.clusters : dataset.clusters,
        candidates: result.candidates,
      }
    : {
        ...dataset,
        candidates: result.candidates,
      };
  return { dataset: derived, result };
}

/** Convenience helper used by autocomplete-style dropdowns. */
export function listEntities(
  dataset: DemoDatasetConfig,
  query = "",
  limit = 20,
): Array<{ id: string; label: string }> {
  const q = query.trim().toLowerCase();
  const items = dataset.graph.nodes
    .filter((n) => (q ? matchEntityNode(n, q) : true))
    .slice(0, limit)
    .map((n) => ({ id: n.id, label: n.label ?? n.id }));
  return items;
}

export function listRelations(
  dataset: DemoDatasetConfig,
  query = "",
  limit = 20,
): string[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const items: string[] = [];
  for (const edge of dataset.graph.edges) {
    const candidate = edge.shortLabel ?? edge.label;
    if (!candidate) continue;
    if (q && !matchEdgeRelation(edge, q)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    items.push(candidate);
    if (items.length >= limit) break;
  }
  return items;
}
