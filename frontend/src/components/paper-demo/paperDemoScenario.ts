import type { PaperDemoCandidate, PaperDemoStep } from "./paperDemoTypes";

export const SOURCE_F1 =
  "Remdesivir and chloroquine effectively inhibit the recently emerged 2019-ncov in vitro";

export const SOURCE_F2 =
  "FDA approves the emergency use of chloroquine phosphate and hydroxychloroquine sulfate for treatment of COVID-19";

export const SOURCE_F3 =
  "A chicago hospital treating severe covid-19 patients with gilead sciences' antiviral medication remdesivir is seeing recoveries in patients' symptoms";

export const ORIGINAL_TRIPLES = [
  "t1 = (remdesivir, treats, sars-cov-2)",
  "t2 = (remdesivir, inhibits, 2019-ncov)",
  "t3 = (chloroquine, inhibits, 2019-ncov)",
] as const;

export const MISSING_TRIPLE_LINE = "t4 = (chloroquine, treats, sars-cov-2)";

export const CLUSTER_KEY = "(inhibits, 2019-ncov)";

export const CLUSTER_HEADS = ["remdesivir", "chloroquine"] as const;

export const PROPAGATION_FROM = "(remdesivir, treats, sars-cov-2)";
export const PROPAGATION_TO = "(chloroquine, treats, sars-cov-2)";

export const EVIDENCE_BULLETS = [
  "t1 = (remdesivir, treats, sars-cov-2)",
  "t2 = (remdesivir, inhibits, 2019-ncov)",
  "t3 = (chloroquine, inhibits, 2019-ncov)",
  "f2 = FDA approves emergency use of chloroquine phosphate and hydroxychloroquine sulfate for treatment of COVID-19",
] as const;

export const LLM_EXPLANATION_BOX =
  "OMNIA proposes this missing triple because chloroquine and remdesivir share the relation-tail pattern (inhibits, 2019-ncov). Since remdesivir is already connected to sars-cov-2 through treats, the relation-tail pair (treats, sars-cov-2) is propagated to chloroquine. The candidate passes TransE filtering and is semantically validated by the LLM using retrieved KG context.";

export const OFFLINE_NOTE =
  "Offline demo mode: OMNIA results are precomputed to keep the demonstration reproducible.";

/** One-line story caption above the graph; switches with the active demo tab. */
export const GUIDED_STORY_CAPTIONS: Record<PaperDemoStep, string> = {
  before: "The input KG contains extracted triples t1, t2, and t3.",
  missing: "OMNIA proposes t4 because it is absent from the KG but entailed by source data.",
  cluster: "remdesivir and chloroquine share the relation-tail key (inhibits, 2019-ncov).",
  filtering: "TransE keeps t4 because its distance is below τ.",
  llm: "RAG provides t1, t2, t3, and f2 as context for the LLM.",
  after: "t4 is accepted and added to the completed KG.",
  diff: "The after graph contains the OMNIA-added triple.",
};

/** Collapsible demo-only placeholders (offline paper figure). */
export const DEMO_RAW_PROMPT_SNIPPET = `[SYSTEM] Validate candidate triple against KG context.
[CANDIDATE] (chloroquine, treats, sars-cov-2)
[CONTEXT] t1, t2, t3, f2 …`;

export const DEMO_RAW_LLM_SNIPPET = `{"verdict": "Likely true", "score": 0.84, "rationale": "consistent with propagated relation-tail pattern …"}`;

export const MAIN_EXAMPLE_NOTE =
  "Detailed graph evidence is available for the main COVID running example only. Validation actions are available for the main COVID running example only.";

/** Stable demo row order: main running example first, then descending combined score among the rest. */
export function sortPaperDemoCandidates(
  list: PaperDemoCandidate[],
  sortKey: "combined" | "structural" | "llm",
): PaperDemoCandidate[] {
  const main = list.find((c) => c.id === "c1");
  const rest = list.filter((c) => c.id !== "c1");
  rest.sort((a, b) => {
    if (sortKey === "combined") return b.combinedScore - a.combinedScore;
    if (sortKey === "structural") return b.structuralScore - a.structuralScore;
    return b.llmScore - a.llmScore;
  });
  return main ? [main, ...rest] : rest;
}

export const PAPER_DEMO_CANDIDATES: PaperDemoCandidate[] = [
  {
    id: "c1",
    head: "chloroquine",
    relation: "treats",
    tail: "sars-cov-2",
    structuralScore: 0.9,
    transeDistance: 0.42,
    threshold: 0.8,
    llmScore: 0.84,
    combinedScore: 0.87,
    llmVerdict: "Likely true",
    status: "uncertain",
    relationType: "treats",
    subjectType: "Drug",
    objectType: "Virus / disease entity",
  },
  {
    id: "c2",
    head: "remdesivir",
    relation: "treats",
    tail: "2019-ncov",
    structuralScore: 0.82,
    transeDistance: 0.51,
    threshold: 0.8,
    llmScore: 0.79,
    combinedScore: 0.81,
    llmVerdict: "Likely true",
    status: "accepted",
    relationType: "treats",
    subjectType: "Drug",
    objectType: "Virus",
  },
  {
    id: "c3",
    head: "chloroquine",
    relation: "affects",
    tail: "MERS",
    structuralScore: 0.35,
    transeDistance: 1.14,
    threshold: 0.8,
    llmScore: 0.22,
    combinedScore: 0.28,
    llmVerdict: "Likely false",
    status: "rejected",
    relationType: "affects",
    subjectType: "Drug",
    objectType: "Virus",
  },
  {
    id: "c4",
    head: "favipiravir",
    relation: "treats",
    tail: "covid-19",
    structuralScore: 0.58,
    transeDistance: 0.88,
    threshold: 0.8,
    llmScore: 0.5,
    combinedScore: 0.54,
    llmVerdict: "Unresolved",
    status: "unresolved",
    relationType: "treats",
    subjectType: "Drug",
    objectType: "Disease",
  },
  {
    id: "c5",
    head: "hydroxychloroquine",
    relation: "treats",
    tail: "covid-19",
    structuralScore: 0.72,
    transeDistance: 0.77,
    threshold: 0.8,
    llmScore: 0.61,
    combinedScore: 0.67,
    llmVerdict: "Uncertain",
    status: "uncertain",
    relationType: "treats",
    subjectType: "Drug",
    objectType: "Disease",
  },
  {
    id: "c6",
    head: "remdesivir",
    relation: "affects",
    tail: "severe covid-19",
    structuralScore: 0.85,
    transeDistance: 0.48,
    threshold: 0.8,
    llmScore: 0.8,
    combinedScore: 0.83,
    llmVerdict: "Likely true",
    status: "accepted",
    relationType: "affects",
    subjectType: "Drug",
    objectType: "Condition",
  },
];

export function getCandidateById(id: string): PaperDemoCandidate | undefined {
  return PAPER_DEMO_CANDIDATES.find((c) => c.id === id);
}

export const EXPLANATION_STAGE_TEXT: Record<PaperDemoStep, string> = {
  before:
    "KG before completion. The original KG contains t1, t2, and t3. The relation (chloroquine, treats, sars-cov-2) is not present yet.",
  missing:
    "t4 is a missing triple entailed by source data but absent from the extracted KG.",
  cluster:
    "OMNIA groups heads that share a relation-tail key. Here, remdesivir and chloroquine both share (inhibits, 2019-ncov), so the relation-tail pair (treats, sars-cov-2) can be propagated to chloroquine.",
  filtering:
    "TransE keeps candidates whose distance is below threshold τ. Candidate t4 has distance 0.42 and passes τ = 0.80. The rejected example (chloroquine, affects, MERS) has distance 1.14 and is filtered out.",
  llm: "LLM/RAG validation checks semantic validity using retrieved KG context. The model receives t1, t2, t3, and f2, then returns ‘Likely true’ with parsed score 0.84.",
  after: "The accepted missing triple is integrated into the completed KG as a validated relation.",
  diff: "The before graph does not contain t4. The after graph includes t4 as an accepted OMNIA completion.",
};
