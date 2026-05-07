import type { PaperDemoCandidate, PaperDemoStep, PaperStepDetail, UserRefinementDecision } from "./paperDemoTypes";

export const OFFLINE_NOTE = "OMNIA demo: recover one missing COVID-Fact triple. c1 is the true missing triple; c2-c4 are generated validation examples.";
export const SOURCE_FACTS = {
  f1: "Remdesivir and chloroquine effectively inhibit the recently emerged 2019-ncov in vitro.",
  f2: "FDA approves the emergency use of chloroquine phosphate and hydroxychloroquine sulfate for treatment of COVID-19.",
  f3: "A chicago hospital treating severe covid-19 patients with gilead sciences' antiviral medication remdesivir is seeing recoveries in patients' symptoms.",
} as const;

export const ORIGINAL_GRAPH_NODES = [
  "remdesivir","chloroquine","sars-cov-2","2019-ncov","FDA","hydroxychloroquine","MERS","severe covid-19","niclosamide","covid-19","pneumonia","delta-variant","favipiravir",
] as const;

export const ORIGINAL_TRIPLES = [
  { id: "t1", head: "remdesivir", relation: "treats", tail: "sars-cov-2" },
  { id: "t2", head: "remdesivir", relation: "inhibits", tail: "2019-ncov" },
  { id: "t3", head: "chloroquine", relation: "inhibits", tail: "2019-ncov" },
  { id: "t5", head: "FDA", relation: "approves", tail: "chloroquine" },
  { id: "t6", head: "FDA", relation: "approves", tail: "hydroxychloroquine" },
  { id: "t7", head: "niclosamide", relation: "prevents", tail: "sars-cov-2" },
  { id: "t8", head: "remdesivir", relation: "affects", tail: "MERS" },
  { id: "t9", head: "remdesivir", relation: "affects", tail: "severe covid-19" },
  { id: "t10", head: "sars-cov-2", relation: "causes", tail: "pneumonia" },
  { id: "t11", head: "covid-19", relation: "causes", tail: "pneumonia" },
  { id: "t12", head: "delta-variant", relation: "causes", tail: "pneumonia" },
  { id: "t13", head: "favipiravir", relation: "treats", tail: "covid-19" },
  { id: "t14", head: "favipiravir", relation: "treats", tail: "delta-variant" },
] as const;

export const DEMO_CLUSTERS = [
  { id: "C1", key: "(inhibits, 2019-ncov)", heads: ["remdesivir", "chloroquine"] },
  { id: "C2", key: "(causes, pneumonia)", heads: ["sars-cov-2", "covid-19", "delta-variant"] },
  { id: "C3", key: "(treats, covid-19)", heads: ["remdesivir", "favipiravir"] },
] as const;

export const PAPER_DEMO_CANDIDATES: PaperDemoCandidate[] = [
  {
    id: "c1", demoRole: "missing",
    head: "chloroquine", relation: "treats", tail: "sars-cov-2",
    structuralScore: 0.81, llmVerdict: "TRUE", llmConfidence: 0.91, llmStrategy: "RAG", ragTopK: 2, combinedScore: 0.86, status: "unresolved",
    clusterKey: "(inhibits, 2019-ncov)", clusterHeads: ["remdesivir", "chloroquine"], transEDistance: 0.61, transEThreshold: 0.8,
    ragContext: [
      { id: "t1", head: "remdesivir", relation: "treats", tail: "sars-cov-2" },
      { id: "t2", head: "remdesivir", relation: "inhibits", tail: "2019-ncov" },
      { id: "t3", head: "chloroquine", relation: "inhibits", tail: "2019-ncov" },
    ],
    sentenceText: "Chloroquine treats the SARS-CoV-2 virus.",
    rawPrompt:
      "Your task is to only transform the triple into a sentence.\nTransform: chloroquine treats sars-cov-2.\nDo not rephrase incorrect facts.\nAnswer: Give the sentence.",
    sourceTriple: { head: "FDA", relation: "approves", tail: "chloroquine" },
    isMissingTriple: true,
    filterResult: "PASSED",
    expectedPath: "accept",
    sourceFactIds: ["f2"],
    ragContextIds: ["t1", "t2", "t3", "f2"],
    qualityRecommendation: "Missing but supported by source",
    explanation:
      "c1 is the true missing triple. It is derived from f2 and supported by the similarity between remdesivir and chloroquine in C1.",
  },
  {
    id: "c2", demoRole: "invalid",
    head: "chloroquine", relation: "affects", tail: "MERS",
    structuralScore: 0.38, llmVerdict: "FALSE", llmConfidence: 0.22, llmStrategy: "RAG", ragTopK: 2, combinedScore: 0.3, status: "unresolved",
    clusterKey: "(affects, MERS)", clusterHeads: ["remdesivir", "chloroquine"], transEDistance: 0.93, transEThreshold: 0.8,
    ragContext: [{ id: "t8", head: "remdesivir", relation: "affects", tail: "MERS" }],
    sentenceText: "Chloroquine affects MERS.",
    isMissingTriple: false,
    filteredOut: true,
    filterResult: "FILTERED_OUT",
    expectedPath: "reject",
    sourceFactIds: [],
    ragContextIds: ["t8", "t2", "t3"],
    qualityRecommendation: "Incorrect relation",
    explanation:
      "c2 is generated because remdesivir affects MERS and chloroquine shares a cluster with remdesivir, but no source evidence supports chloroquine affecting MERS.",
  },
  {
    id: "c3", demoRole: "invalid",
    head: "chloroquine", relation: "affects", tail: "severe covid-19",
    structuralScore: 0.44, llmVerdict: "FALSE", llmConfidence: 0.31, llmStrategy: "RAG", ragTopK: 2, combinedScore: 0.34, status: "unresolved",
    clusterKey: "(affects, severe covid-19)", clusterHeads: ["remdesivir", "chloroquine"], transEDistance: 0.88, transEThreshold: 0.8,
    ragContext: [{ id: "t9", head: "remdesivir", relation: "affects", tail: "severe covid-19" }],
    sentenceText: "Chloroquine affects severe covid-19.",
    isMissingTriple: false,
    filteredOut: true,
    filterResult: "FILTERED_OUT",
    expectedPath: "reject_or_uncertain",
    sourceFactIds: [],
    ragContextIds: ["t9", "t2", "t3", "f3"],
    qualityRecommendation: "Not enough evidence",
    explanation:
      "c3 is generated from a structural pattern involving remdesivir and severe COVID-19, but the graph/source evidence does not justify replacing remdesivir with chloroquine.",
  },
  {
    id: "c4", demoRole: "review",
    head: "remdesivir", relation: "treats", tail: "2019-ncov",
    structuralScore: 0.73, llmVerdict: "TRUE", llmConfidence: 0.79, llmStrategy: "RAG", ragTopK: 2, combinedScore: 0.76, status: "unresolved",
    clusterKey: "(inhibits, 2019-ncov)", clusterHeads: ["remdesivir", "chloroquine"], transEDistance: 0.68, transEThreshold: 0.8,
    ragContext: [
      { id: "t2", head: "remdesivir", relation: "inhibits", tail: "2019-ncov" },
      { id: "t3", head: "chloroquine", relation: "inhibits", tail: "2019-ncov" },
    ],
    sentenceText: "Remdesivir treats the 2019 novel coronavirus.",
    isMissingTriple: false,
    filterResult: "PASSED",
    expectedPath: "review",
    sourceFactIds: ["f1", "f3"],
    ragContextIds: ["t1", "t2", "t3", "f1", "f3"],
    qualityRecommendation: "Not enough evidence",
    explanation:
      "c4 passes structural filtering and receives a positive LLM signal, but it should be shown as a review case rather than automatically accepted.",
  },
];

export const CANDIDATE_GENERATION_MATRIX = [
  { id: "c1", head: "chloroquine", pair: "treats → sars-cov-2", generated: "chloroquine treats sars-cov-2" },
  { id: "c2", head: "chloroquine", pair: "affects → MERS", generated: "chloroquine affects MERS" },
  { id: "c3", head: "chloroquine", pair: "affects → severe covid-19", generated: "chloroquine affects severe covid-19" },
  { id: "c4", head: "remdesivir", pair: "treats → 2019-ncov", generated: "remdesivir treats 2019-ncov" },
] as const;

export const LLM_STRATEGIES = {
  c1: {
    "zero-shot": { verdict: "TRUE", confidence: 0.74, context: [] },
    "in-context": { verdict: "TRUE", confidence: 0.83, context: ["t1", "t2", "t3"] },
    RAG: { verdict: "TRUE", confidence: 0.91, context: ["t1", "t2", "t3", "f2"] },
  },
  c2: {
    "zero-shot": { verdict: "FALSE", confidence: 0.18, context: [], explanation: "The statement is unsupported and medically unlikely from available KG context." },
    "in-context": { verdict: "FALSE", confidence: 0.29, context: ["t8", "t2", "t3"], explanation: "The relation affects MERS is known for remdesivir, but the cluster evidence does not justify copying it to chloroquine." },
    RAG: { verdict: "FALSE", confidence: 0.22, context: ["t8", "t2", "t3"], explanation: "RAG retrieves related graph patterns but no source statement supporting chloroquine affects MERS." },
  },
  c3: {
    "zero-shot": { verdict: "FALSE", confidence: 0.25, context: [] },
    "in-context": { verdict: "FALSE", confidence: 0.34, context: ["t9", "t2", "t3"] },
    RAG: { verdict: "FALSE", confidence: 0.31, context: ["t9", "t2", "t3", "f3"], explanation: "Evidence talks about remdesivir and severe COVID-19, not chloroquine." },
  },
  c4: {
    "zero-shot": { verdict: "TRUE", confidence: 0.66, context: [] },
    "in-context": { verdict: "TRUE", confidence: 0.74, context: ["t1", "t2", "t3"] },
    RAG: { verdict: "TRUE", confidence: 0.79, context: ["t1", "t2", "t3", "f1", "f3"], explanation: "The signal is plausible but remains a review case because evidence is less direct than c1." },
  },
} as const;

export const STEP_DETAILS: Record<PaperDemoStep, PaperStepDetail> = {
  before: {
    step: 1,
    title: "Original LLM-generated KG",
    what: "The KG contains triples extracted from COVID-Fact statements and is still incomplete.",
    why: "OMNIA completes facts in a closed-world setting by reusing existing KG structure.",
    runningExample: "From f1-f3, extraction produced t1, t2, t3 but missed t4.",
    paperStatistic: "COVID-Fact running example: 28 relations, 1,416 entities, 908 triples.",
    userAction: "Inspect original edges and confirm the chloroquine treats sars-cov-2 edge is missing.",
  },
  missing: {
    step: 2,
    title: "The missing fact OMNIA should recover",
    what: "c1/t4 is the true missing triple in this running example.",
    why: "LLM extraction can miss implicit facts despite relevant source evidence.",
    runningExample: "t4 is implied by f2 about emergency use of chloroquine for COVID-19 treatment.",
    paperStatistic: "COVID-Fact quality analysis: missing triples account for 5.10% of evaluated quality issues.",
    userAction: "Select c1 and inspect the dashed candidate edge and linked source statement.",
  },
  cluster: {
    step: 3,
    title: "Relation-tail clustering",
    what: "OMNIA groups head entities by shared relation-tail keys.",
    why: "Clusters narrow search and avoid brute-force candidate generation.",
    runningExample: "C1 uses key (inhibits, 2019-ncov) with heads remdesivir and chloroquine.",
    paperStatistic: "CoDEx-M generation: 9,047,869 OMNIA candidates vs 12,958,932,528 exhaustive (~1,400x fewer).",
    userAction: "Inspect C1 and the cluster table to understand propagation paths.",
  },
  generation: {
    step: 4,
    title: "Generate candidate triples",
    what: "OMNIA propagates relation-tail pairs inside clusters to create hypotheses.",
    why: "Generated candidates must still be filtered and validated before KG update.",
    runningExample: "c1 is the true missing triple; c2-c4 are generated candidates for reject/review paths.",
    paperStatistic: "CoDEx-M TP coverage: OMNIA 70.65% vs exhaustive 95.98% with far fewer generated candidates.",
    userAction: "Hover matrix rows to map each candidate to graph edges.",
  },
  filtering: {
    step: 5,
    title: "Embedding-based filtering",
    what: "TransE uses distance scores where lower is structurally more plausible.",
    why: "Filtering removes unlikely triples before expensive LLM checks.",
    runningExample: "c2 has 0.93 > τ 0.80 and is FILTERED OUT before curator decision.",
    paperStatistic: "Filtering reduction: CoDEx-M 71.08%, Socio-economic 70%, FB15K-237 41.76%.",
    userAction: "Compare candidate distance to τ=0.80 and inspect pass/fail state.",
  },
  llm: {
    step: 6,
    title: "Semantic validation with zero-shot, in-context, and RAG",
    what: "Strategies provide different evidence quality and confidence for each candidate.",
    why: "Structural similarity alone can produce false positives.",
    runningExample: "c1 RAG uses t1,t2,t3,f2; c2 RAG has no direct support for chloroquine affects MERS.",
    paperStatistic: "Best F1: CoDEx-M 0.91 (OMNIA Sentences RAG), FB15K-237 0.86, WN18RR 0.87.",
    userAction: "Switch tabs and inspect candidate-specific context before judging evidence.",
  },
  human: {
    step: 7,
    title: "Human curator review",
    what: "Curator inspects structural and semantic evidence before deciding.",
    why: "Human review is required to handle correctness and completeness errors.",
    runningExample: "For c1 choose Supports + Missing but supported by source; for c2 choose Contradicts + Incorrect relation.",
    paperStatistic: "COVID-Fact quality issues: 12.36% total (6.54% correctness, 5.82% completeness).",
    userAction: "Complete required checklist fields to unlock decision actions.",
  },
  after: {
    step: 8,
    title: "Curator decision and graph update",
    what: "Selected decision updates graph annotations and completed KG view.",
    why: "OMNIA closes the loop with human-in-the-loop completion.",
    runningExample: "Accept c1 adds +1 edge; reject c2/c3 keeps KG unchanged with rejection annotation.",
    paperStatistic: "OMNIA combines generation, filtering, LLM validation, and human judgement in one loop.",
    userAction: "Choose Accept, Reject, or Uncertain and inspect graph annotation.",
  },
  diff: {
    step: 9,
    title: "Completed KG and before/after comparison",
    what: "Diff panel shows exactly what changed after curation.",
    why: "Only validated edges should appear in the completed KG.",
    runningExample: "Accepted c1 appears in green; rejected c2 remains annotation-only and not added.",
    paperStatistic: "Goal: improve completeness while preserving quality through validation.",
    userAction: "Compare before vs after and verify decision outcome is reflected correctly.",
    warningNote: "No human decision yet. Accept or reject to produce a meaningful KG difference.",
  },
};

export function formatFilterDecision(candidate: Pick<PaperDemoCandidate, "transEDistance" | "transEThreshold">): string {
  const passed = candidate.transEDistance < candidate.transEThreshold;
  return `${candidate.transEDistance.toFixed(2)} ${passed ? "<" : ">"} τ ${candidate.transEThreshold.toFixed(2)} -> ${passed ? "PASSED" : "FILTERED OUT"}`;
}

export function getCandidateById(id: string): PaperDemoCandidate | undefined {
  return PAPER_DEMO_CANDIDATES.find((c) => c.id === id);
}

export function sortPaperDemoCandidates(
  list: PaperDemoCandidate[],
  key: "combined" | "structural" | "llm",
  direction: "desc" | "asc" = "desc",
): PaperDemoCandidate[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    if (key === "structural") return (a.structuralScore - b.structuralScore) * sign;
    if (key === "llm") return (a.llmConfidence - b.llmConfidence) * sign;
    return (a.combinedScore - b.combinedScore) * sign;
  });
}

export const DATASET_STATS = {
  covidFact: { relations: 28, entities: 1_416, triples: 908 },
  codexM: { relations: 49, entities: 16_759, triples: 60_000 },
  fb15k237: { relations: 29, entities: 12_993, triples: 59_270 },
  wn18rr: { relations: 11, entities: 40_943, triples: 93_003 },
  socioEcon: { relations: 17_175, entities: 33_563, triples: 64_417 },
} as const;

export const GENERATION_STATS = {
  omniaGenerated: 9_047_869,
  exhaustiveGenerated: 12_958_932_528,
  omniaTPRate: 0.7065,
  exhaustiveTPRate: 0.9598,
  omniaRuntimeMin: 10,
  exhaustiveRuntimeMin: 120,
  omniaRamGB: 8,
  exhaustiveRamTB: 2.6,
  reductionFactor: 1400,
} as const;

export const RUNTIME_STATS = [
  { sampleSize: "10k", generationSec: 6.08, filteringSec: 13.59 },
  { sampleSize: "20k", generationSec: 26.47, filteringSec: 15.16 },
  { sampleSize: "30k", generationSec: 72.42, filteringSec: 19.47 },
  { sampleSize: "40k", generationSec: 160.24, filteringSec: 24.3 },
  { sampleSize: "50k", generationSec: 304.83, filteringSec: 30.53 },
] as const;

export const SOURCE_QUALITY_STATS = {
  evaluatedTriples: 970,
  issueRate: 0.1236,
  correctnessIssues: 0.0654,
  completenessIssues: 0.0582,
  incorrectTriples: 0.0312,
  inaccurateRelations: 0.0125,
  missingTriples: 0.051,
  missingEntities: 0.0052,
} as const;

export const F1_RESULTS = {
  fb15k237: { omnia: 0.86, baselineName: "TransE", baseline: 0.74, gain: 0.12 },
  codexM: { omnia: 0.91, baselineName: "TransE", baseline: 0.68, gain: 0.23 },
  wn18rr: { omnia: 0.87, baselineName: "DistMult", baseline: 0.77, gain: 0.1 },
  socioEcon: { omnia: 0.68, baselineName: "DistMult", baseline: 0.74, gain: -0.06 },
} as const;

export const FILTERING_STATS = {
  codexM: { reduction: 0.7108, missingTotal: 11_997, tcBefore: 8_476, tcfAfter: 5_024 },
  socioEcon: { reduction: 0.7, missingTotal: 12_347, tcBefore: 1_186, tcfAfter: 607 },
  fb15k237: { reduction: 0.4176, missingTotal: 11_854, tcBefore: 5_818, tcfAfter: 3_836 },
} as const;

export const PROMPT_TEMPLATE_STATS = {
  simple: { correct: 462, total: 500, ratio: 0.92 },
  explicit: { correct: 500, total: 500, ratio: 1 },
} as const;

export const RAG_OPTIMAL_TOPK = {
  min: 2,
  max: 4,
  best: 3,
} as const;

const GUIDED_STORY_CAPTIONS: Record<PaperDemoStep, string> = {
  before: "The original COVID-19 KG extracted by GPT-4 from COVID-Fact. Triple t4 is absent.",
  missing: "t4 = (chloroquine, treats, sars-cov-2) is entailed by f2 but was not extracted. OMNIA targets this.",
  cluster: "remdesivir and chloroquine share relation-tail key (inhibits, 2019-ncov) and are grouped in cluster C.",
  generation: "Candidate generation propagates relation-tail pairs to create c1..c4.",
  filtering: "TransE scores each candidate. t4 distance = 0.61 < tau 0.80 passes; r1 distance = 0.93 is filtered out.",
  llm: "RAG retrieves t1, t2, t3, f2 as context. Mistral-7B classifies t4 as TRUE in this demo trace.",
  human: "Human-in-the-loop validation confirms accept, reject, or uncertain decisions.",
  after: "The completed KG view reflects your c1 validation decision.",
  diff: "Side-by-side comparison of KG before and after OMNIA completion.",
};

export function guidedStoryCaption(step: PaperDemoStep, curatorDecision: UserRefinementDecision): string {
  if (step !== "after") return GUIDED_STORY_CAPTIONS[step];
  if (curatorDecision === "accepted") return "Accepted: t4 is integrated as a validated edge in the completed KG.";
  if (curatorDecision === "rejected") return "Rejected: t4 remains absent, so the KG stays unchanged for this candidate.";
  return GUIDED_STORY_CAPTIONS.after;
}
