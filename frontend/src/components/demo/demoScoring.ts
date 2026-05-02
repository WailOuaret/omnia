import type { CandidateRecord } from "../../types";

/**
 * Map a TransE / embedding distance into a [0, 1] structural plausibility score.
 *
 * The teacher's mockup ranks candidates by a "Combined Score" that blends a
 * structural signal with the LLM verdict. Distances are unbounded (lower is
 * better), so we squash them through a soft sigmoid centered on a τ-like cut
 * (~0.6 default) which gives a stable comparison across datasets.
 */
export function structuralScore(record: CandidateRecord): number | undefined {
  if (typeof record.distance !== "number") return undefined;
  const tau = typeof record.threshold === "number" ? record.threshold : 0.6;
  const k = 6; // sharpness — larger = steeper cut
  const score = 1 / (1 + Math.exp(k * (record.distance - tau)));
  return Math.max(0, Math.min(1, score));
}

/** LLM verdict score in [0, 1]; falls back to decision keywords if `parsed_score` is absent. */
export function llmScore(record: CandidateRecord): number | undefined {
  if (typeof record.parsed_score === "number") {
    const raw = record.parsed_score;
    if (raw <= 1 && raw >= 0) return raw;
    if (raw >= -1 && raw <= 1) return (raw + 1) / 2;
    return Math.max(0, Math.min(1, raw / 100));
  }
  const decision = (record.decision ?? "").toLowerCase();
  if (decision === "accepted") return 0.85;
  if (decision === "rejected") return 0.15;
  if (decision === "unresolved" || decision === "skipped") return 0.5;
  return undefined;
}

/** Combined score = average of available structural + LLM scores (mockup style). */
export function combinedScore(record: CandidateRecord): number | undefined {
  const s = structuralScore(record);
  const l = llmScore(record);
  if (s !== undefined && l !== undefined) return (s + l) / 2;
  return s ?? l;
}

export type LlmVerdict = "Likely true" | "Likely false" | "Uncertain" | "Pending";

export function llmVerdict(record: CandidateRecord): LlmVerdict {
  const decision = (record.decision ?? "").toLowerCase();
  if (decision === "accepted") return "Likely true";
  if (decision === "rejected") return "Likely false";
  if (decision === "unresolved") return "Uncertain";
  const score = llmScore(record);
  if (score === undefined) return "Pending";
  if (score >= 0.6) return "Likely true";
  if (score <= 0.4) return "Likely false";
  return "Uncertain";
}

export type SortKey = "combined" | "structural" | "llm" | "alpha";

export function sortCandidates(rows: CandidateRecord[], key: SortKey): CandidateRecord[] {
  const score = (row: CandidateRecord) => {
    if (key === "structural") return structuralScore(row) ?? -Infinity;
    if (key === "llm") return llmScore(row) ?? -Infinity;
    if (key === "alpha") return 0;
    return combinedScore(row) ?? -Infinity;
  };
  if (key === "alpha") {
    return [...rows].sort((a, b) => {
      const left = `${a.DisplayHead ?? a.Head}${a.DisplayRelation ?? a.Relation}${a.DisplayTail ?? a.Tail}`;
      const right = `${b.DisplayHead ?? b.Head}${b.DisplayRelation ?? b.Relation}${b.DisplayTail ?? b.Tail}`;
      return left.localeCompare(right);
    });
  }
  return [...rows].sort((a, b) => score(b) - score(a));
}
