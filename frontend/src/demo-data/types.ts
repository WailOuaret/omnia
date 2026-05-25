export type DemoDatasetId =
  | "covidFact"
  | "codexM"
  | "fb15k237"
  | "wn18rr"
  | "socioEconomic";

export interface GraphNode {
  id: string;
  label: string;
  shortLabel?: string;
  type?: string;
  x?: number;
  y?: number;
  labelDx?: number;
  labelDy?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  shortLabel?: string;
  fullLabel?: string;
  status?: "known" | "missing" | "candidate" | "accepted" | "rejected";
  labelDx?: number;
  labelDy?: number;
  labelPosition?: number;
  bend?: number;
  showLabel?: boolean;
}

export interface ClusterBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: "blue" | "green" | "amber" | "violet";
}

export interface DemoCluster {
  id: string;
  key: string;
  sharedRelation: string;
  sharedTail: string;
  entities: string[];
  size: number;
}

export interface DemoCandidate {
  candidateId: string;
  head: string;
  relation: string;
  tail: string;
  status: "candidate" | "kept" | "removed" | "accepted" | "rejected" | "uncertain" | "corrected";
  distance?: number;
  threshold?: number;
  llmVerdict?: "valid" | "invalid" | "uncertain";
  llmConfidence?: number;
  llmRationale?: string;
  retrievedContext?: string[];
  clusterIds?: string[];
  whyGenerated?: string;
}

export interface DemoFilteringStats {
  model: string;
  threshold: number;
  beforeFiltering: number;
  afterFiltering: number;
}

export interface DemoLlmStats {
  strategy: string;
  topK: number;
  confidence: number;
  verdict: string;
}

export interface DemoDatasetConfig {
  id: DemoDatasetId;
  label: string;
  shortName: string;
  source: string;
  publicStatus: "public" | "private" | "demo-only";
  description: string;
  whyInteresting: string;
  entities: number;
  relations: number;
  triples: number;
  recommendedMode: "sentence-rag" | "triple-rag";
  warning?: string;
  bestF1?: number;
  note?: string;
  role?: string;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    clusterBoxes?: ClusterBox[];
  };
  clusters: DemoCluster[];
  candidates: DemoCandidate[];
  filteringStats: DemoFilteringStats;
  llmStats: DemoLlmStats;
}

