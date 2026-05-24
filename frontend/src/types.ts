export interface SessionSummary {
  session_id: string;
  dataset_name: string;
  source_type: string;
  holdout_mode: boolean;
  sample_proportion: number;
  diagnostics: Record<string, unknown>;
  warnings: string[];
  steps: PipelineStep[];
  created_at: string;
  updated_at: string;
}

export interface SampleSummary {
  id: string;
  name: string;
  path: string;
  source: string;
  description: string;
  stats: Record<string, number>;
  recommended_sampling_limit?: number | null;
}

export interface PipelineStep {
  name: string;
  status: string;
  runtime_sec?: number | null;
  input_count?: number | null;
  output_count?: number | null;
  explanation?: string | null;
  error?: string | null;
  updated_at?: string;
}

export type GraphNodeStage =
  | "original"
  | "cluster"
  | "candidate"
  | "filtered"
  | "validated"
  | "completed";

export type GraphEdgeStatus =
  | "original"
  | "generated"
  | "missing"
  | "filtered_passed"
  | "filtered_rejected"
  | "llm_accepted"
  | "llm_rejected"
  | "unresolved";

export interface GraphNode {
  id: string;
  label: string;
  kind: "entity" | "component" | "cluster" | "candidate";
  stage?: GraphNodeStage;
  degree: number;
  component_id?: string | null;
  cluster_id?: string | null;
  candidate_id?: string | null;
  is_isolated: boolean;
  highlighted: boolean;
  confidence?: number | null;
  node_count?: number | null;
  edge_count?: number | null;
  relation_count?: number | null;
  cluster_count?: number | null;
  sample_nodes?: string[];
  sample_relations?: string[];
  warning?: string | null;
  description?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status?: GraphEdgeStatus;
  highlighted: boolean;
  candidate_id?: string | null;
  raw_status?: string | null;
  provenance_label?: string | null;
  distance?: number | null;
  threshold?: number | null;
  llm_decision?: string | null;
  provenance?: {
    cluster_id?: string;
    cluster_key?: string;
    source_heads?: string[];
    source_triples?: TripleRecord[];
    generated_candidate?: TripleRecord;
  };
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  view: "summary" | "component" | "cluster" | "neighborhood";
  aggregated: boolean;
  truncated: boolean;
  displayed_nodes: number;
  total_nodes: number;
  displayed_triples: number;
  total_triples: number;
  warnings: string[];
}

export interface ComponentSummary {
  component_id: string;
  label: string;
  node_count: number;
  edge_count: number;
  relation_count: number;
  cluster_count: number;
  isolated_node_count: number;
  density: number;
  sparsity_score: number;
  sample_nodes: string[];
  sample_relations: string[];
  warning?: string | null;
  warnings: string[];
  anchor_node?: string | null;
  description?: string | null;
}

export interface GraphPolicy {
  default_level: "summary" | "component";
  large_dataset_mode: boolean;
  lazy_components: boolean;
  summary_first_reason: string;
}

export interface ClusterSummary {
  cluster_id: string;
  cluster_key: string;
  cluster_key_display?: string;
  relation: string;
  display_relation?: string;
  tail: string;
  display_tail?: string;
  heads: string[];
  display_heads?: string[];
  size: number;
  warning?: string | null;
  component_id?: string | null;
  component_label?: string | null;
  source_triple_count: number;
  member_triple_count: number;
}

export interface TripleRecord {
  Head: string;
  Relation: string;
  Tail: string;
  DisplayHead?: string;
  DisplayRelation?: string;
  DisplayTail?: string;
}

export interface CandidateRecord {
  candidate_id?: string;
  Head: string;
  Relation: string;
  Tail: string;
  DisplayHead?: string;
  DisplayRelation?: string;
  DisplayTail?: string;
  status: string;
  Missing?: number;
  distance?: number;
  threshold?: number;
  filter_decision?: string;
  cluster_ids?: string[];
  cluster_keys?: string[];
  source_heads?: string[];
  rationale?: string;
  parsed_score?: number;
  decision?: string;
  prompt?: string;
  raw_response?: string;
  retrieved_context?: string[];
  sentence_text?: string | null;
  is_mock?: boolean;
  provenance?: string;
  feedback_id?: string;
  user_decision?: "accept" | "reject" | "uncertain" | "correct";
  feedback_reason?: string;
  feedback_comment?: string;
}

export interface ValidationStrategyComparison {
  strategy: "zero" | "context" | "rag";
  label: string;
  summary: Record<string, number>;
  runtime_sec: number;
  is_mock: boolean;
  candidate_count: number;
  top_k?: number | null;
  ollama?: Record<string, unknown>;
  focus_candidate?: CandidateRecord | null;
}

export interface ValidationComparisonPayload {
  mode: string;
  model_name: string;
  candidate_count: number;
  use_filter_results: boolean;
  strategies: ValidationStrategyComparison[];
}
