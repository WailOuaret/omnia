import type { SampleSummary, SessionSummary, ValidationComparisonPayload } from "../types";

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
