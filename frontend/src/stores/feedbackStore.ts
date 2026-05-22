import type { DemoDatasetId } from "../demo-data/types";
import { DATASETS } from "../demo-data/datasets";

export interface UserFeedback {
  id: string;
  datasetId: string;
  candidateId: string;
  head: string;
  relation: string;
  tail: string;
  llmVerdict: "valid" | "invalid" | "uncertain";
  userDecision: "accept" | "reject" | "uncertain" | "correct";
  reason?:
    | "correct"
    | "wrong_relation"
    | "wrong_head"
    | "wrong_tail"
    | "not_enough_evidence"
    | "duplicate"
    | "too_general"
    | "too_specific"
    | "other";
  comment?: string;
  userConfidence?: "high" | "medium" | "low";
  evidenceJudgement?:
    | "evidence_supports"
    | "evidence_contradicts"
    | "evidence_insufficient"
    | "not_checked";
  correctedTriple?: {
    head: string;
    relation: string;
    tail: string;
  };
  timestamp: string;
}

interface Triple {
  head: string;
  relation: string;
  tail: string;
}

function keyForDataset(datasetId: string) {
  return `omnia_feedback_${datasetId}`;
}

function safeRead(datasetId: string): UserFeedback[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyForDataset(datasetId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UserFeedback[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(datasetId: string, items: UserFeedback[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyForDataset(datasetId), JSON.stringify(items));
}

export function addFeedback(feedback: UserFeedback): void {
  const all = safeRead(feedback.datasetId);
  all.push(feedback);
  safeWrite(feedback.datasetId, all);
}

export function getFeedbackForDataset(datasetId: string): UserFeedback[] {
  return safeRead(datasetId);
}

export function getLatestDecision(candidateId: string, datasetId?: string): UserFeedback | undefined {
  if (datasetId) {
    const list = getFeedbackForDataset(datasetId).filter((item) => item.candidateId === candidateId);
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  }
  const all: UserFeedback[] = [];
  for (const did of Object.keys(DATASETS)) {
    all.push(...getFeedbackForDataset(did));
  }
  const list = all.filter((item) => item.candidateId === candidateId);
  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

function getLatestDecisionMap(datasetId: string): Record<string, UserFeedback> {
  const items = getFeedbackForDataset(datasetId);
  const map: Record<string, UserFeedback> = {};
  for (const item of items) {
    const current = map[item.candidateId];
    if (!current || current.timestamp < item.timestamp) {
      map[item.candidateId] = item;
    }
  }
  return map;
}

export function getSummary(datasetId: string) {
  const latest = Object.values(getLatestDecisionMap(datasetId));
  const summary = {
    accepted: 0,
    rejected: 0,
    uncertain: 0,
    corrected: 0,
    total: latest.length,
  };
  for (const item of latest) {
    if (item.userDecision === "accept") summary.accepted += 1;
    if (item.userDecision === "reject") summary.rejected += 1;
    if (item.userDecision === "uncertain") summary.uncertain += 1;
    if (item.userDecision === "correct") summary.corrected += 1;
  }
  return summary;
}

function tripleKey(triple: Triple): string {
  return `${triple.head}||${triple.relation}||${triple.tail}`;
}

export function getCompletedKG(datasetId: string): Triple[] {
  const dataset = DATASETS[datasetId as DemoDatasetId];
  if (!dataset) return [];
  const latest = getLatestDecisionMap(datasetId);
  const completed: Triple[] = [];
  for (const edge of dataset.graph.edges) {
    if (edge.status === "known" || edge.status === undefined) {
      completed.push({ head: edge.source, relation: edge.label, tail: edge.target });
    }
  }
  const rejectedKeys = new Set<string>();
  for (const event of Object.values(latest)) {
    if (event.userDecision === "reject" || event.userDecision === "correct") {
      rejectedKeys.add(tripleKey({ head: event.head, relation: event.relation, tail: event.tail }));
    }
  }
  for (const event of Object.values(latest)) {
    if (event.userDecision === "accept") {
      completed.push({ head: event.head, relation: event.relation, tail: event.tail });
    }
    if (event.userDecision === "correct" && event.correctedTriple) {
      completed.push({
        head: event.correctedTriple.head,
        relation: event.correctedTriple.relation,
        tail: event.correctedTriple.tail,
      });
    }
  }
  const map = new Map<string, Triple>();
  for (const triple of completed) {
    const key = tripleKey(triple);
    if (rejectedKeys.has(key)) continue;
    if (!map.has(key)) map.set(key, triple);
  }
  return Array.from(map.values());
}

export function getKGDiff(datasetId: string): {
  added: Triple[];
  rejected: Triple[];
  corrected: Triple[];
  review: Triple[];
} {
  if (!DATASETS[datasetId as DemoDatasetId]) return { added: [], rejected: [], corrected: [], review: [] };
  const latest = getLatestDecisionMap(datasetId);
  const added: Triple[] = [];
  const rejected: Triple[] = [];
  const corrected: Triple[] = [];
  const review: Triple[] = [];
  for (const event of Object.values(latest)) {
    if (event.userDecision === "accept") {
      added.push({ head: event.head, relation: event.relation, tail: event.tail });
    }
    if (event.userDecision === "reject") {
      rejected.push({ head: event.head, relation: event.relation, tail: event.tail });
    }
    if (event.userDecision === "uncertain") {
      review.push({ head: event.head, relation: event.relation, tail: event.tail });
    }
    if (event.userDecision === "correct" && event.correctedTriple) {
      rejected.push({ head: event.head, relation: event.relation, tail: event.tail });
      corrected.push({
        head: event.correctedTriple.head,
        relation: event.correctedTriple.relation,
        tail: event.correctedTriple.tail,
      });
    }
  }
  return { added, rejected, corrected, review };
}

export function exportFeedbackJSON(datasetId: string): string {
  return JSON.stringify(getFeedbackForDataset(datasetId), null, 2);
}

export function exportCompletedKGTSV(datasetId: string): string {
  const completed = getCompletedKG(datasetId);
  const lines = ["head\trelation\ttail"];
  for (const triple of completed) {
    lines.push(`${triple.head}\t${triple.relation}\t${triple.tail}`);
  }
  return lines.join("\n");
}

export function exportKGDiffJSON(datasetId: string): string {
  return JSON.stringify(getKGDiff(datasetId), null, 2);
}

export function clearFeedback(datasetId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyForDataset(datasetId));
}

