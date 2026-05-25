import type { SampleSummary, SessionSummary, ValidationComparisonPayload } from "../types";

export interface BackendSessionMeta {
  session_id: string;
  dataset_name: string;
  source_type: string;
  /** Backend benchmark sample id, e.g. omnia_codex_m or omnia_wn18rr. */
  sample_id?: string | null;
  triple_count: number;
  entity_count: number;
  relation_count: number;
  artifact_keys: string[];
  selected_slice?: {
    mode?: string;
    entity?: string | null;
    relation?: string | null;
    cluster_id?: string | null;
    candidate_status?: string | null;
    feedback_bucket?: string | null;
  } | null;
}

export interface BackendGraphSliceNode {
  id: string;
  label: string;
  type?: string;
  source?: string;
  role?: string;
  cluster_id?: string | null;
}

export interface BackendGraphSliceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status: string;
  provenance?: string;
  candidate_id?: string | null;
  distance?: number | null;
  threshold?: number | null;
  llm_score?: number | null;
  cluster_id?: string | null;
}

export interface BackendGraphSlice {
  slice_id: string;
  mode: string;
  label: string;
  nodes: BackendGraphSliceNode[];
  edges: BackendGraphSliceEdge[];
  stats: {
    nodes: number;
    edges: number;
    triples: number;
    candidates: number;
    clusters: number;
  };
  source: string;
  data_available?: boolean;
  clusters?: BackendClusterRow[];
  candidates?: BackendCandidateRow[];
  selected_cluster?: BackendClusterRow & { cluster_key?: string; selected?: boolean };
  selected_candidate?: BackendCandidateRow;
  explanation?: {
    cluster_key?: string;
    generation_rule?: string;
    filtering_available?: boolean;
    llm_available?: boolean;
    shared_relation?: string;
    shared_tail?: string;
  };
  warnings?: string[];
}

export interface BackendEntityNeighbors {
  entity_id: string;
  hops: number;
  nodes: BackendGraphSliceNode[];
  edges: BackendGraphSliceEdge[];
  stats: {
    nodes_added: number;
    edges_added: number;
  };
  source?: string;
}

export interface BackendClusterRow {
  cluster_id: string;
  shared_relation: string;
  shared_tail: string;
  members: string[];
  size: number;
  candidate_count?: number;
  accept_rate?: number;
}

export interface BackendCandidateRow {
  candidate_id: string;
  Head: string;
  Relation: string;
  Tail: string;
  cluster_ids: string[];
  source_cluster?: string;
  why_generated?: string;
  distance: number | null;
  threshold: number | null;
  filter_status: string;
  llm_decision: string;
  llm_score: number | null;
  llm_rationale: string;
  retrieved_context: unknown[];
  feedback_status: string;
  status_bucket: string;
}

function resolveApiBase() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname, port } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";

  if (isLocalHost && port && port !== "8000") {
    return `${protocol}//${hostname}:8000`;
  }

  return "";
}

const API_BASE = resolveApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export const api = {
  health: () => request<{ status: string; ollama: Record<string, unknown> }>("/api/health"),
  listSamples: () => request<{ samples: SampleSummary[] }>("/api/samples"),
  previewDataset: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Record<string, unknown>>("/api/datasets/preview", {
      method: "POST",
      body: form,
    });
  },
  createUploadSession: (
    file: File,
    mapping: Record<string, string>,
    holdoutMode: boolean,
    sampleProportion: number,
    samplingLimit?: number,
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping_json", JSON.stringify(mapping));
    form.append("holdout_mode", String(holdoutMode));
    form.append("sample_proportion", String(sampleProportion));
    if (samplingLimit) {
      form.append("sampling_limit", String(samplingLimit));
    }
    return request<SessionSummary>("/api/sessions/upload", {
      method: "POST",
      body: form,
    });
  },
  createSampleSession: (
    sampleId: string,
    holdoutMode = true,
    sampleProportion = 0.8,
    samplingLimit?: number,
  ) =>
    request<SessionSummary>(
      `/api/sessions/sample/${sampleId}?holdout_mode=${holdoutMode}&sample_proportion=${sampleProportion}${
        samplingLimit ? `&sampling_limit=${samplingLimit}` : ""
      }`,
      { method: "POST" },
    ),
  getSession: (sessionId: string) => request<SessionSummary>(`/api/sessions/${sessionId}`),
  getLogs: (sessionId: string) => request<{ logs: Array<Record<string, unknown>> }>(`/api/sessions/${sessionId}/logs`),
  getOverview: (sessionId: string) => request<Record<string, unknown>>(`/api/sessions/${sessionId}/overview`),
  getComponentGraph: (sessionId: string, graphMode: "uploaded" | "known", componentId: string) =>
    request<Record<string, unknown>>(
      `/api/sessions/${sessionId}/components/${componentId}?graph_mode=${graphMode}`,
    ),
  getClusters: (sessionId: string) => request<Record<string, unknown>>(`/api/sessions/${sessionId}/clusters`),
  getClusterGraph: (
    sessionId: string,
    clusterId: string,
    scope: "cluster" | "component" | "neighborhood",
  ) => request<Record<string, unknown>>(`/api/sessions/${sessionId}/clusters/${clusterId}?scope=${scope}`),
  getCandidates: (sessionId: string) => request<Record<string, unknown>>(`/api/sessions/${sessionId}/candidates`),
  getFilter: (sessionId: string, params: URLSearchParams) =>
    request<Record<string, unknown>>(`/api/sessions/${sessionId}/filter?${params.toString()}`, {
      method: "POST",
    }),
  getLlm: (sessionId: string, params: URLSearchParams) =>
    request<Record<string, unknown>>(`/api/sessions/${sessionId}/llm?${params.toString()}`, {
      method: "POST",
    }),
  getLlmComparison: (sessionId: string, params: URLSearchParams) =>
    request<ValidationComparisonPayload>(`/api/sessions/${sessionId}/llm/compare?${params.toString()}`, {
      method: "POST",
    }),
  runPipeline: (sessionId: string, params: URLSearchParams) =>
    request<Record<string, unknown>>(`/api/sessions/${sessionId}/pipeline/run?${params.toString()}`, {
      method: "POST",
    }),
  getCompleted: (sessionId: string) => request<Record<string, unknown>>(`/api/sessions/${sessionId}/completed`),
  postDemoRefinement: (
    sessionId: string,
    body: { Head: string; Relation: string; Tail: string; decision: "accept" | "reject" },
  ) =>
    request<{ status: string; total_refinements: number }>(`/api/sessions/${sessionId}/demo/refinement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  postFeedback: (
    sessionId: string,
    body: {
      candidate_id: string;
      Head: string;
      Relation: string;
      Tail: string;
      decision: "accept" | "reject" | "uncertain" | "correct";
      reason?: string;
      comment?: string;
      corrected_triple?: { Head: string; Relation: string; Tail: string };
      user_confidence?: "high" | "medium" | "low";
      evidence_judgement?: "evidence_supports" | "evidence_contradicts" | "evidence_insufficient" | "not_checked";
    },
  ) =>
    request<Record<string, unknown>>(`/api/sessions/${sessionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getFeedback: (sessionId: string) => request<Record<string, unknown>>(`/api/sessions/${sessionId}/feedback`),
  getComparisons: (sessionId: string, params: URLSearchParams) =>
    request<Record<string, unknown>>(`/api/sessions/${sessionId}/comparisons?${params.toString()}`),
  exportCsvUrl: (sessionId: string) => `${API_BASE}/api/sessions/${sessionId}/export/diff.csv`,
  exportJsonUrl: (sessionId: string) => `${API_BASE}/api/sessions/${sessionId}/export/diff.json`,
  exportFeedbackJsonUrl: (sessionId: string) => `${API_BASE}/api/sessions/${sessionId}/export/feedback.json`,
  exportCompletedTsvUrl: (sessionId: string) => `${API_BASE}/api/sessions/${sessionId}/export/completed.tsv`,
  createPaperSession: () =>
    request<{ session_id: string; sample_id: string; url: string }>("/api/demo/create-paper-session", {
      method: "POST",
    }),
  listSessionEntities: (sessionId: string, query = "", limit = 20) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return request<{ entities: Array<{ id: string; label: string }> | string[]; source?: string }>(
      `/api/sessions/${sessionId}/entities?${params.toString()}`,
    );
  },
  listSessionRelations: (sessionId: string, query = "", limit = 50) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return request<{ relations: Array<{ id: string; label: string; count: number }>; source?: string }>(
      `/api/sessions/${sessionId}/relations?${params.toString()}`,
    );
  },
  listSessionClusters: (sessionId: string) =>
    request<BackendClusterRow[]>(
      `/api/sessions/${sessionId}/clusters`,
    ),
  listSessionCandidates: (
    sessionId: string,
    params?: { clusterId?: string; relation?: string; status?: string; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.clusterId) qs.set("cluster_id", params.clusterId);
    if (params?.relation) qs.set("relation", params.relation);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<BackendCandidateRow[]>(`/api/sessions/${sessionId}/candidates${suffix}`);
  },
  listSessionClustersDetailed: (sessionId: string) =>
    request<{ clusters: BackendClusterRow[]; source: string; count: number }>(
      `/api/sessions/${sessionId}/clusters/detailed`,
    ),
  listSessionCandidatesDetailed: (
    sessionId: string,
    params?: { clusterId?: string; relation?: string; status?: string; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.clusterId) qs.set("cluster_id", params.clusterId);
    if (params?.relation) qs.set("relation", params.relation);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{
      candidates: BackendCandidateRow[];
      source: string;
      count: number;
    }>(`/api/sessions/${sessionId}/candidates/detailed${suffix}`);
  },
  getGraphSlice: (
    sessionId: string,
    params: {
      mode: string;
      entity?: string | null;
      relation?: string | null;
      clusterId?: string | null;
      candidateStatus?: string | null;
      feedbackBucket?: string | null;
      depth?: number;
      limitNodes?: number;
      limitEdges?: number;
      expandContext?: boolean;
      candidateId?: string | null;
    },
  ) => {
    const qs = new URLSearchParams({ mode: params.mode });
    if (params.entity) qs.set("entity", params.entity);
    if (params.relation) qs.set("relation", params.relation);
    if (params.clusterId) qs.set("cluster_id", params.clusterId);
    if (params.candidateId) qs.set("candidate_id", params.candidateId);
    if (params.candidateStatus) qs.set("candidate_status", params.candidateStatus);
    if (params.feedbackBucket) qs.set("feedback_bucket", params.feedbackBucket);
    if (params.depth) qs.set("depth", String(params.depth));
    if (params.limitNodes) qs.set("limit_nodes", String(params.limitNodes));
    if (params.limitEdges) qs.set("limit_edges", String(params.limitEdges));
    if (params.expandContext) qs.set("expand_context", "true");
    return request<BackendGraphSlice>(
      `/api/sessions/${sessionId}/graph/slice?${qs.toString()}`,
    );
  },
  getSessionMeta: (sessionId: string) =>
    request<BackendSessionMeta>(`/api/sessions/${sessionId}/overview/meta`),
  getGraphNeighborhood: (
    sessionId: string,
    entity: string,
    options?: { depth?: number; limit?: number },
  ) => {
    const params = new URLSearchParams({
      entity,
      depth: String(options?.depth ?? 1),
      limit: String(options?.limit ?? 100),
    });
    return request<{
      nodes: Array<{ id: string; label: string }>;
      edges: Array<{ source: string; relation: string; target: string }>;
      stats: { nodes: number; edges: number };
    }>(`/api/sessions/${sessionId}/graph/neighborhood?${params.toString()}`);
  },
  getEntityNeighbors: (
    sessionId: string,
    entityId: string,
    options?: { hops?: 1 | 2; limit?: number },
  ) => {
    const params = new URLSearchParams({
      hops: String(options?.hops ?? 1),
      limit: String(options?.limit ?? 50),
    });
    return request<BackendEntityNeighbors>(
      `/api/sessions/${sessionId}/entities/${encodeURIComponent(entityId)}/neighbors?${params.toString()}`,
    );
  },
  postDemoSlice: (
    sessionId: string,
    body: {
      mode: string;
      entity?: string | null;
      relation?: string | null;
      cluster_id?: string | null;
      candidate_status?: string | null;
      llm_verdict?: string | null;
      feedback_bucket?: string | null;
      limit?: number;
    },
  ) =>
    request<{
      slice_id: string;
      mode: string;
      label: string;
      nodes: Array<{ id: string; label: string }>;
      edges: Array<{ source: string; relation: string; target: string }>;
      clusters: unknown[];
      candidates: unknown[];
      stats: { nodes: number; edges: number; clusters: number; candidates: number };
    }>(`/api/sessions/${sessionId}/demo/slice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};

export async function postFeedback(
  sessionId: string,
  body: {
    candidate_id: string;
    Head: string;
    Relation: string;
    Tail: string;
    decision: "accept" | "reject" | "uncertain" | "correct";
    reason?: string;
    comment?: string;
    corrected_triple?: { Head: string; Relation: string; Tail: string };
    user_confidence?: "high" | "medium" | "low";
    evidence_judgement?: "evidence_supports" | "evidence_contradicts" | "evidence_insufficient" | "not_checked";
  },
): Promise<unknown> {
  return api.postFeedback(sessionId, body);
}

export async function getFeedback(sessionId: string): Promise<unknown> {
  return api.getFeedback(sessionId);
}

export function exportFeedbackJsonUrl(sessionId: string): string {
  return api.exportFeedbackJsonUrl(sessionId);
}

export function exportCompletedTsvUrl(sessionId: string): string {
  return api.exportCompletedTsvUrl(sessionId);
}
