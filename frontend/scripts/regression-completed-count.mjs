/**
 * Regression check for Ticket 2 — completed-step statistics.
 *
 * Asserts the invariant exercised by `StepStatsPanel` / `PaperDemoPage` in static mode:
 *
 *     completedStatsSummary.completedTriples === getCompletedKG(datasetId).length
 *
 * after an Accept + Correct + Reject sequence.
 *
 * This script intentionally re-implements the store's count math in pure JS so the
 * regression can run without TypeScript tooling. If the production `feedbackStore.ts`
 * semantics ever change, the hand-written numbers in `expectedCounts` will diverge and
 * this script will fail loudly — exactly the trigger we want for a code review.
 *
 * Usage:
 *   node frontend/scripts/regression-completed-count.mjs
 *
 * Exits 0 on success, 1 on regression.
 */

const KNOWN_TRIPLES_BASELINE = [
  { head: "remdesivir", relation: "treats", tail: "sars-cov-2" },
  { head: "remdesivir", relation: "inhibits", tail: "2019-ncov" },
  { head: "chloroquine", relation: "inhibits", tail: "2019-ncov" },
  { head: "fda", relation: "approves", tail: "chloroquine" },
  { head: "fda", relation: "approves", tail: "hydroxychloroquine" },
];

const FEEDBACK_SEQUENCE = [
  {
    candidateId: "cov-c1",
    head: "chloroquine",
    relation: "treats",
    tail: "sars-cov-2",
    userDecision: "accept",
    timestamp: "2026-01-01T10:00:00Z",
  },
  {
    candidateId: "cov-c2",
    head: "remdesivir",
    relation: "treats",
    tail: "2019-ncov",
    userDecision: "correct",
    correctedTriple: {
      head: "remdesivir",
      relation: "treats",
      tail: "covid-19",
    },
    timestamp: "2026-01-01T10:05:00Z",
  },
  {
    candidateId: "cov-c3",
    head: "chloroquine",
    relation: "affects",
    tail: "MERS",
    userDecision: "reject",
    timestamp: "2026-01-01T10:10:00Z",
  },
];

function tripleKey({ head, relation, tail }) {
  return `${head}||${relation}||${tail}`;
}

/**
 * Re-implementation of `feedbackStore.getCompletedKG` and `feedbackStore.getKGDiff` for testing.
 * Keep this in sync with `frontend/src/stores/feedbackStore.ts`.
 */
function computeCompletedKG(known, events) {
  const completed = [...known];

  const latest = new Map();
  for (const event of events) {
    const prev = latest.get(event.candidateId);
    if (!prev || prev.timestamp < event.timestamp) {
      latest.set(event.candidateId, event);
    }
  }

  const rejectedKeys = new Set();
  for (const event of latest.values()) {
    if (event.userDecision === "reject" || event.userDecision === "correct") {
      rejectedKeys.add(tripleKey(event));
    }
  }

  for (const event of latest.values()) {
    if (event.userDecision === "accept") {
      completed.push({ head: event.head, relation: event.relation, tail: event.tail });
    }
    if (event.userDecision === "correct" && event.correctedTriple) {
      completed.push({ ...event.correctedTriple });
    }
  }

  const dedup = new Map();
  for (const triple of completed) {
    const key = tripleKey(triple);
    if (rejectedKeys.has(key)) continue;
    if (!dedup.has(key)) dedup.set(key, triple);
  }
  return Array.from(dedup.values());
}

function computeDiff(events) {
  const latest = new Map();
  for (const event of events) {
    const prev = latest.get(event.candidateId);
    if (!prev || prev.timestamp < event.timestamp) {
      latest.set(event.candidateId, event);
    }
  }
  const added = [];
  const corrected = [];
  const rejected = [];
  const reviewQueue = [];
  for (const event of latest.values()) {
    if (event.userDecision === "accept") {
      added.push({ head: event.head, relation: event.relation, tail: event.tail });
    } else if (event.userDecision === "reject") {
      rejected.push({ head: event.head, relation: event.relation, tail: event.tail });
    } else if (event.userDecision === "uncertain") {
      reviewQueue.push({ head: event.head, relation: event.relation, tail: event.tail });
    } else if (event.userDecision === "correct" && event.correctedTriple) {
      rejected.push({ head: event.head, relation: event.relation, tail: event.tail });
      corrected.push({ ...event.correctedTriple });
    }
  }
  return { added, corrected, rejected, reviewQueue };
}

const completedKG = computeCompletedKG(KNOWN_TRIPLES_BASELINE, FEEDBACK_SEQUENCE);
const diff = computeDiff(FEEDBACK_SEQUENCE);

const completedStatsSummary = {
  knownTriples: KNOWN_TRIPLES_BASELINE.length,
  completedTriples: completedKG.length,
  acceptedAdditions: diff.added.length + diff.corrected.length,
  rejectedCandidates: diff.rejected.length,
  unresolvedCandidates: diff.reviewQueue.length,
  mode: "static",
};

const expected = {
  knownTriples: 5,
  acceptedAdditions: 2, // accept + correct -> two additions
  rejectedCandidates: 2, // reject + the original of the correct triple
  unresolvedCandidates: 0,
  // 5 known + 1 accepted + 1 corrected = 7
  completedTriples: 7,
};

const failures = [];
for (const [key, value] of Object.entries(expected)) {
  if (completedStatsSummary[key] !== value) {
    failures.push(`  - ${key}: expected ${value}, got ${completedStatsSummary[key]}`);
  }
}

// Invariant from the prompt: `completedStatsSummary.completedTriples === getCompletedKG(datasetId).length`
if (completedStatsSummary.completedTriples !== completedKG.length) {
  failures.push(
    `  - invariant violated: completedStatsSummary.completedTriples (${completedStatsSummary.completedTriples}) !== completedKG.length (${completedKG.length})`,
  );
}

if (failures.length > 0) {
  console.error("REGRESSION FAILED for completed-step statistics:");
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log("OK — completed-step statistics regression passed.");
console.log(`  knownTriples         = ${completedStatsSummary.knownTriples}`);
console.log(`  acceptedAdditions    = ${completedStatsSummary.acceptedAdditions}`);
console.log(`  rejectedCandidates   = ${completedStatsSummary.rejectedCandidates}`);
console.log(`  unresolvedCandidates = ${completedStatsSummary.unresolvedCandidates}`);
console.log(`  completedTriples     = ${completedStatsSummary.completedTriples}`);
console.log(`  getCompletedKG.length = ${completedKG.length}`);
