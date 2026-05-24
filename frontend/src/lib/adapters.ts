import type { UserFeedback } from "../stores/feedbackStore";

export interface BackendCorrectedTriple {
  Head?: string;
  Relation?: string;
  Tail?: string;
}

export interface BackendFeedbackUser {
  decision?: string;
  reason?: string | null;
  comment?: string | null;
  confidence?: string | null;
  user_confidence?: string | null;
  evidence_judgement?: string | null;
  corrected_triple?: BackendCorrectedTriple | null;
}

export interface BackendFeedbackLlm {
  decision?: string | null;
}

export interface BackendFeedbackEvent {
  feedback_id?: string;
  candidate_id: string;
  triple?: { Head?: string; Relation?: string; Tail?: string };
  user?: BackendFeedbackUser;
  llm?: BackendFeedbackLlm | null;
  filtering?: Record<string, unknown> | null;
  effect?: Record<string, unknown> | null;
  timestamp?: string;
  dataset_name?: string;
}

export interface BackendFeedbackResponse {
  feedback?: BackendFeedbackEvent[];
  summary?: Record<string, number>;
}

export interface BackendCompletedSummary {
  known_triples?: number;
  reference_triples?: number;
  completed_triples?: number;
  accepted_additions?: number;
  rejected_candidates?: number;
  unresolved_candidates?: number;
  recovered_true_missing?: number;
  novel_not_in_reference?: number;
  total?: number;
  accepted?: number;
  rejected?: number;
  uncertain?: number;
  corrected?: number;
  llm_overridden?: number;
  not_enough_evidence?: number;
  agreement_rate?: number;
  feedback_total?: number;
}

export interface BackendCompletedDiagnostics {
  llm_false_positive?: number;
  llm_false_negative?: number;
  correction_needed?: number;
  evidence_insufficient?: number;
  agreement?: number;
  total_reviewed?: number;
  agreement_rate?: number;
}

export interface BackendThresholdSuggestion {
  threshold?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  feedback_examples?: number;
}

export interface BackendFeedbackPriors {
  relation_prior?: Record<string, number>;
  dataset_prior?: number;
  feedback_examples?: number;
}

export interface BackendCompletedResponse {
  summary?: BackendCompletedSummary;
  feedback_summary?: Record<string, number>;
  feedback_diagnostics?: BackendCompletedDiagnostics;
  feedback_priors?: BackendFeedbackPriors;
  feedback_cluster_stats?: Record<string, Record<string, number>>;
  suggested_threshold?: BackendThresholdSuggestion | null;
  additions?: Array<Record<string, unknown>>;
  rejected?: Array<Record<string, unknown>>;
  unresolved?: Array<Record<string, unknown>>;
}

type UserDecision = UserFeedback["userDecision"];

function normalizeDecision(value: string | undefined | null): UserDecision {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "accept" || v === "reject" || v === "uncertain" || v === "correct") {
    return v;
  }
  return "accept";
}

function normalizeReason(value: string | undefined | null): UserFeedback["reason"] {
  const allowed: NonNullable<UserFeedback["reason"]>[] = [
    "correct",
    "wrong_relation",
    "wrong_head",
    "wrong_tail",
    "not_enough_evidence",
    "duplicate",
    "too_general",
    "too_specific",
    "other",
  ];
  if (!value) return undefined;
  const v = value.trim().toLowerCase() as NonNullable<UserFeedback["reason"]>;
  return allowed.includes(v) ? v : "other";
}

function normalizeConfidence(value: string | undefined | null): UserFeedback["userConfidence"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return undefined;
}

function normalizeEvidence(value: string | undefined | null): UserFeedback["evidenceJudgement"] {
  if (
    value === "evidence_supports" ||
    value === "evidence_contradicts" ||
    value === "evidence_insufficient" ||
    value === "not_checked"
  ) {
    return value;
  }
  return undefined;
}

function normalizeLlmVerdict(value: string | undefined | null): UserFeedback["llmVerdict"] {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "valid" || v === "accepted") return "valid";
  if (v === "invalid" || v === "rejected") return "invalid";
  if (v === "uncertain" || v === "unresolved") return "uncertain";
  return "uncertain";
}

/**
 * Convert a single backend feedback event to the local `UserFeedback` shape.
 * Falls back gracefully when fields are missing — backend may not send every key.
 */
export function feedbackEventToUserFeedback(
  event: BackendFeedbackEvent,
  datasetId: string,
): UserFeedback {
  const head = event.triple?.Head ?? "";
  const relation = event.triple?.Relation ?? "";
  const tail = event.triple?.Tail ?? "";
  const correctedTriple = event.user?.corrected_triple;

  return {
    id: event.feedback_id ?? `fb_${event.candidate_id}_${event.timestamp ?? "now"}`,
    datasetId,
    candidateId: event.candidate_id,
    head,
    relation,
    tail,
    llmVerdict: normalizeLlmVerdict(event.llm?.decision ?? null),
    userDecision: normalizeDecision(event.user?.decision ?? null),
    reason: normalizeReason(event.user?.reason ?? null),
    comment: event.user?.comment ?? undefined,
    userConfidence: normalizeConfidence(event.user?.user_confidence ?? event.user?.confidence ?? null),
    evidenceJudgement: normalizeEvidence(event.user?.evidence_judgement ?? null),
    correctedTriple:
      correctedTriple && (correctedTriple.Head || correctedTriple.Relation || correctedTriple.Tail)
        ? {
            head: correctedTriple.Head ?? "",
            relation: correctedTriple.Relation ?? "",
            tail: correctedTriple.Tail ?? "",
          }
        : undefined,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Adapt a `GET /api/sessions/{id}/feedback` response into a list of local `UserFeedback`.
 */
export function adaptFeedbackResponse(
  response: BackendFeedbackResponse | unknown,
  datasetId: string,
): UserFeedback[] {
  if (!response || typeof response !== "object") return [];
  const events = (response as BackendFeedbackResponse).feedback ?? [];
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => event && typeof event.candidate_id === "string")
    .map((event) => feedbackEventToUserFeedback(event, datasetId));
}

export interface CompletedSummaryView {
  knownTriples: number;
  completedTriples: number;
  acceptedAdditions: number;
  rejectedCandidates: number;
  unresolvedCandidates: number;
  agreementRate: number;
  thresholdSuggestion?: BackendThresholdSuggestion | null;
  diagnostics?: BackendCompletedDiagnostics;
  priors?: BackendFeedbackPriors;
  clusterStats?: Record<string, Record<string, number>>;
}

/**
 * Adapt a `GET /api/sessions/{id}/completed` response into a render-friendly summary.
 * Returns `null` when the response is empty/malformed.
 */
export function adaptCompletedResponse(
  response: BackendCompletedResponse | unknown,
): CompletedSummaryView | null {
  if (!response || typeof response !== "object") return null;
  const payload = response as BackendCompletedResponse;
  const summary = payload.summary ?? {};
  return {
    knownTriples: Number(summary.known_triples ?? 0),
    completedTriples: Number(summary.completed_triples ?? 0),
    acceptedAdditions: Number(summary.accepted_additions ?? 0),
    rejectedCandidates: Number(summary.rejected_candidates ?? 0),
    unresolvedCandidates: Number(summary.unresolved_candidates ?? 0),
    agreementRate: Number(summary.agreement_rate ?? payload.feedback_diagnostics?.agreement_rate ?? 0),
    thresholdSuggestion: payload.suggested_threshold ?? null,
    diagnostics: payload.feedback_diagnostics,
    priors: payload.feedback_priors,
    clusterStats: payload.feedback_cluster_stats,
  };
}

/**
 * Merge a server feedback list into a local cache, keyed by candidateId.
 * Server wins on conflict (latest timestamp per candidate from the server is authoritative
 * because the backend already stores the full enriched event).
 */
export function mergeFeedbackByCandidate(
  serverList: UserFeedback[],
  clientList: UserFeedback[],
): UserFeedback[] {
  const byCandidate = new Map<string, UserFeedback>();
  for (const item of clientList) {
    const existing = byCandidate.get(item.candidateId);
    if (!existing || existing.timestamp < item.timestamp) {
      byCandidate.set(item.candidateId, item);
    }
  }
  for (const item of serverList) {
    const existing = byCandidate.get(item.candidateId);
    if (!existing || existing.timestamp <= item.timestamp) {
      byCandidate.set(item.candidateId, item);
    }
  }
  return Array.from(byCandidate.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
