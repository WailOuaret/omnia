import type {
  CandidateRecord,
  GraphEdgeStatus,
  GraphNode,
  GraphPayload,
  GraphNodeStage,
  TripleRecord,
} from "../../types";

export function tripleKey(t: Pick<CandidateRecord, "Head" | "Relation" | "Tail">) {
  return `${t.Head}\u0000${t.Relation}\u0000${t.Tail}`;
}

export function neighborsOfTriple(known: TripleRecord[], cand: CandidateRecord, maxExtras: number): TripleRecord[] {
  const h = cand.Head;
  const t = cand.Tail;
  const direct = known.filter((tr) => tr.Head === h || tr.Tail === h || tr.Head === t || tr.Tail === t);
  if (direct.length >= maxExtras) return direct.slice(0, maxExtras);
  const keys = new Set(direct.map(tripleKey));
  const filler = known.filter((tr) => !keys.has(tripleKey(tr)));
  return [...direct, ...filler].slice(0, maxExtras);
}

function triplesToNodesEdges(
  triples: TripleRecord[],
  opts: {
    edgeStatus: GraphEdgeStatus;
    highlighted?: Set<string>;
    prefix: string;
  },
) {
  const degree = new Map<string, number>();
  for (const tr of triples) {
    degree.set(tr.Head, (degree.get(tr.Head) ?? 0) + 1);
    degree.set(tr.Tail, (degree.get(tr.Tail) ?? 0) + 1);
  }
  const nodes: GraphNode[] = Array.from(degree.entries()).map(([id, value]) => ({
    id,
    label: triples.find((t) => t.Head === id)?.DisplayHead ?? triples.find((t) => t.Tail === id)?.DisplayTail ?? id,
    kind: "entity" as const,
    stage: "original" as const,
    degree: value,
    component_id: null,
    is_isolated: value === 0,
    highlighted: false,
    node_count: 1,
    edge_count: value,
    relation_count: null,
    cluster_count: null,
    sample_nodes: [],
    sample_relations: [],
    warning: null,
    description: null,
  }));

  const edges = triples.map((tr, i) => ({
    id: `${opts.prefix}-${i}`,
    source: tr.Head,
    target: tr.Tail,
    label: tr.DisplayRelation ?? tr.Relation,
    highlighted: opts.highlighted ? opts.highlighted.has(tripleKey(tr)) : false,
    status: opts.edgeStatus,
  }));

  return { nodes, edges };
}

export function buildBeforeKgGraph(knownTriples: TripleRecord[], maxTriples = 150): GraphPayload {
  const visible = knownTriples.slice(0, maxTriples);
  const { nodes, edges } = triplesToNodesEdges(visible, { edgeStatus: "original", prefix: "before" });

  return {
    nodes,
    edges,
    view: "component",
    aggregated: false,
    truncated: knownTriples.length > maxTriples,
    displayed_nodes: nodes.length,
    total_nodes: nodes.length,
    displayed_triples: visible.length,
    total_triples: knownTriples.length,
    warnings: knownTriples.length > maxTriples ? ["Showing a neighborhood sample around the visualization budget."] : [],
  };
}

export function buildMissingKgGraph(
  knownTriples: TripleRecord[],
  candidate: CandidateRecord,
  opts: { maxContext?: number; dimOriginal?: boolean } = {},
): GraphPayload {
  const maxContext = opts.maxContext ?? 150;
  const context = neighborsOfTriple(knownTriples, candidate, maxContext);
  const { nodes, edges } = triplesToNodesEdges(context, {
    edgeStatus: "original",
    prefix: "ctx",
    highlighted: new Set(),
  });

  const candEdges = [
    {
      id: "candidate-missing",
      source: candidate.Head,
      target: candidate.Tail,
      label: candidate.DisplayRelation ?? candidate.Relation,
      highlighted: true,
      status: "missing" as const,
    },
  ];

  const extraNodeIds = new Set<string>([candidate.Head, candidate.Tail]);
  for (const id of extraNodeIds) {
    if (nodes.some((n) => n.id === id)) continue;
    nodes.push({
      id,
      label:
        candidate.Head === id
          ? candidate.DisplayHead ?? candidate.Head
          : candidate.DisplayTail ?? candidate.Tail,
      kind: "entity",
      stage: "candidate" satisfies GraphNodeStage,
      degree: 1,
      component_id: null,
      is_isolated: false,
      highlighted: true,
      node_count: 1,
      edge_count: 1,
      relation_count: null,
      cluster_count: null,
      sample_nodes: [],
      sample_relations: [],
      warning: null,
      description: null,
    });
  }

  return {
    nodes,
    edges: [...edges, ...candEdges],
    view: "component",
    aggregated: false,
    truncated: false,
    displayed_nodes: nodes.length,
    total_nodes: nodes.length,
    displayed_triples: edges.length + 1,
    total_triples: knownTriples.length + 1,
    warnings: opts.dimOriginal ? ["Original triples kept for context; dashed edge is OMNIA’s proposed missing triple."] : [],
  };
}

export function buildAfterKgGraph(
  knownTriples: TripleRecord[],
  additions: CandidateRecord[],
  opts: { maxBase?: number } = {},
): GraphPayload {
  const maxBase = opts.maxBase ?? 150;
  const addSlice = additions.slice(0, 48).map((c) => ({
    Head: c.Head,
    Relation: c.Relation,
    Tail: c.Tail,
    DisplayHead: c.DisplayHead,
    DisplayRelation: c.DisplayRelation,
    DisplayTail: c.DisplayTail,
  }));
  const addKeys = new Set(addSlice.map(tripleKey));
  const base = knownTriples.filter((tr) => !addKeys.has(tripleKey(tr))).slice(0, maxBase);
  const merged = [...base, ...addSlice];

  const { nodes } = triplesToNodesEdges(merged, { edgeStatus: "original", prefix: "unused" });

  const edges = merged.map((tr, i) => {
    const isAdd = addKeys.has(tripleKey(tr));
    return {
      id: `after-${i}`,
      source: tr.Head,
      target: tr.Tail,
      label: tr.DisplayRelation ?? tr.Relation,
      highlighted: isAdd,
      status: (isAdd ? "llm_accepted" : "original") as GraphEdgeStatus,
    };
  });

  return {
    nodes,
    edges,
    view: "component",
    aggregated: false,
    truncated: knownTriples.length + additions.length > maxBase + addSlice.length,
    displayed_nodes: nodes.length,
    total_nodes: nodes.length,
    displayed_triples: merged.length,
    total_triples: knownTriples.length + additions.length,
    warnings:
      additions.length && !addSlice.length ? ["No accepted additions to merge yet — run validation or approve interactively."]
        : merged.length >= maxBase + addSlice.length ? ["Sample capped for responsiveness; additions are prioritized."]
        : [],
  };
}
