import { useEffect, useMemo, useState } from "react";
import type { DemoCandidate, DemoDatasetId } from "../../demo-data/types";
import type { UserFeedback } from "../../stores/feedbackStore";
import type { FeedbackStatus } from "../../hooks/useFeedbackBridge";

interface UserFeedbackPanelProps {
  candidate: DemoCandidate;
  datasetId: DemoDatasetId;
  onFeedbackSubmit: (feedback: UserFeedback) => void;
  existingFeedback?: UserFeedback;
  /** Bridge status. When `syncing` the submit button is disabled. */
  bridgeStatus?: FeedbackStatus;
}

export function UserFeedbackPanel({
  datasetId,
  candidate,
  onFeedbackSubmit,
  existingFeedback,
  bridgeStatus,
}: UserFeedbackPanelProps) {
  const [decision, setDecision] = useState<UserFeedback["userDecision"]>(
    existingFeedback?.userDecision ?? "accept",
  );
  const [reason, setReason] = useState<UserFeedback["reason"]>(existingFeedback?.reason ?? "correct");
  const [evidenceJudgement, setEvidenceJudgement] = useState<UserFeedback["evidenceJudgement"]>(
    existingFeedback?.evidenceJudgement ?? "not_checked",
  );
  const [userConfidence, setUserConfidence] = useState<UserFeedback["userConfidence"]>(
    existingFeedback?.userConfidence ?? "medium",
  );
  const [comment, setComment] = useState<string>(existingFeedback?.comment ?? "");
  const [correctedHead, setCorrectedHead] = useState<string>(
    existingFeedback?.correctedTriple?.head ?? candidate.head,
  );
  const [correctedRelation, setCorrectedRelation] = useState<string>(
    existingFeedback?.correctedTriple?.relation ?? candidate.relation,
  );
  const [correctedTail, setCorrectedTail] = useState<string>(
    existingFeedback?.correctedTriple?.tail ?? candidate.tail,
  );
  const [effectMessage, setEffectMessage] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");

  // Ticket 3a + 3b: reset form whenever the selected candidate changes (or the
  // existing feedback for that candidate is reloaded from hydration). Preload
  // every field — including comment and the corrected-triple fields — so the
  // user sees their last submission instead of stale state from another candidate.
  useEffect(() => {
    setDecision(existingFeedback?.userDecision ?? "accept");
    setReason(existingFeedback?.reason ?? "correct");
    setEvidenceJudgement(existingFeedback?.evidenceJudgement ?? "not_checked");
    setUserConfidence(existingFeedback?.userConfidence ?? "medium");
    setComment(existingFeedback?.comment ?? "");
    setCorrectedHead(existingFeedback?.correctedTriple?.head ?? candidate.head);
    setCorrectedRelation(existingFeedback?.correctedTriple?.relation ?? candidate.relation);
    setCorrectedTail(existingFeedback?.correctedTriple?.tail ?? candidate.tail);
    setEffectMessage("");
    setValidationError("");
  }, [candidate.candidateId, candidate.head, candidate.relation, candidate.tail, existingFeedback]);

  const verdict: UserFeedback["llmVerdict"] = useMemo(() => {
    if (candidate.llmVerdict === "valid") return "valid";
    if (candidate.llmVerdict === "invalid") return "invalid";
    return "uncertain";
  }, [candidate.llmVerdict]);

  const filterPassed =
    candidate.distance !== undefined && candidate.threshold !== undefined
      ? candidate.distance <= candidate.threshold
      : null;

  const isSyncing = bridgeStatus === "syncing";

  const handleSubmit = () => {
    setValidationError("");
    if (decision === "correct") {
      const hasAnyCorrection =
        correctedHead.trim().length > 0 ||
        correctedRelation.trim().length > 0 ||
        correctedTail.trim().length > 0;
      if (!hasAnyCorrection) {
        setValidationError(
          "Correct decision requires at least one of head, relation, or tail to be non-empty.",
        );
        return;
      }
      const identicalToOriginal =
        correctedHead.trim() === candidate.head &&
        correctedRelation.trim() === candidate.relation &&
        correctedTail.trim() === candidate.tail;
      if (identicalToOriginal) {
        setValidationError(
          "Corrected triple is identical to the original. Edit at least one field, or pick Accept instead.",
        );
        return;
      }
    }

    const feedback: UserFeedback = {
      id: `fb_${Math.random().toString(36).slice(2, 10)}`,
      datasetId,
      candidateId: candidate.candidateId,
      head: candidate.head,
      relation: candidate.relation,
      tail: candidate.tail,
      llmVerdict: verdict,
      userDecision: decision,
      reason,
      comment: comment || undefined,
      userConfidence,
      evidenceJudgement,
      correctedTriple:
        decision === "correct"
          ? {
              head: correctedHead.trim() || candidate.head,
              relation: correctedRelation.trim() || candidate.relation,
              tail: correctedTail.trim() || candidate.tail,
            }
          : undefined,
      timestamp: new Date().toISOString(),
    };
    onFeedbackSubmit(feedback);
    if (decision === "accept") {
      setEffectMessage("This triple was added to the completed KG.");
    } else if (decision === "reject") {
      setEffectMessage(
        "This triple was removed from the completed KG and stored as a rejected example.",
      );
    } else if (decision === "uncertain") {
      setEffectMessage("This triple was sent to the review queue for expert review.");
    } else {
      setEffectMessage(
        "The original triple was rejected and the corrected triple was added to the completed KG.",
      );
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Human feedback (after LLM validation)</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-semibold">Candidate triple:</span>{" "}
          <span className="break-all font-mono">
            ({candidate.head}, {candidate.relation}, {candidate.tail})
          </span>
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
          <p className="font-semibold uppercase tracking-wide text-slate-500">Structural evidence</p>
          <p>
            <span className="font-semibold">TransE distance:</span>{" "}
            {candidate.distance !== undefined ? candidate.distance.toFixed(2) : "—"}
          </p>
          <p>
            <span className="font-semibold">Threshold τ:</span>{" "}
            {candidate.threshold !== undefined ? candidate.threshold.toFixed(2) : "—"}
          </p>
          <p>
            <span className="font-semibold">Result:</span>{" "}
            {filterPassed === null ? "—" : filterPassed ? "PASSED" : "FILTERED OUT"}
          </p>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
          <p className="font-semibold uppercase tracking-wide text-slate-500">Semantic evidence</p>
          <p>
            <span className="font-semibold">LLM verdict:</span> {candidate.llmVerdict ?? "—"}
          </p>
          <p>
            <span className="font-semibold">Confidence:</span>{" "}
            {candidate.llmConfidence !== undefined ? candidate.llmConfidence.toFixed(2) : "—"}
          </p>
          {candidate.llmRationale ? (
            <p className="mt-1 text-[11px] text-slate-600">{candidate.llmRationale}</p>
          ) : null}
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
          <p className="font-semibold uppercase tracking-wide text-slate-500">Retrieved RAG context</p>
          {candidate.retrievedContext && candidate.retrievedContext.length > 0 ? (
            <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-600">
              {candidate.retrievedContext.map((ctx, idx) => (
                <li key={idx}>{ctx}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">No context retrieved.</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {(["accept", "reject", "uncertain", "correct"] as const).map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => setDecision(option)}
            disabled={isSyncing}
            className={`rounded border px-2 py-1.5 ${
              decision === option
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            } ${isSyncing ? "opacity-60" : ""}`}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Reason
        </label>
        <select
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={reason ?? "other"}
          onChange={(event) => setReason(event.target.value as UserFeedback["reason"])}
          disabled={isSyncing}
        >
          <option value="correct">Correct relation</option>
          <option value="wrong_relation">Wrong relation</option>
          <option value="wrong_head">Wrong head entity</option>
          <option value="wrong_tail">Wrong tail entity</option>
          <option value="not_enough_evidence">Not enough evidence</option>
          <option value="duplicate">Duplicate / already known</option>
          <option value="too_general">Too general</option>
          <option value="too_specific">Too specific</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="mt-3 grid gap-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evidence judgement
          </label>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={evidenceJudgement}
            onChange={(event) =>
              setEvidenceJudgement(event.target.value as UserFeedback["evidenceJudgement"])
            }
            disabled={isSyncing}
          >
            <option value="evidence_supports">Evidence supports</option>
            <option value="evidence_contradicts">Evidence contradicts</option>
            <option value="evidence_insufficient">Evidence insufficient</option>
            <option value="not_checked">Not checked</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            User confidence
          </label>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={userConfidence}
            onChange={(event) =>
              setUserConfidence(event.target.value as UserFeedback["userConfidence"])
            }
            disabled={isSyncing}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {decision === "correct" ? (
        <div className="mt-3 grid gap-2">
          <input
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={correctedHead}
            onChange={(event) => setCorrectedHead(event.target.value)}
            placeholder="Corrected head"
            disabled={isSyncing}
          />
          <input
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={correctedRelation}
            onChange={(event) => setCorrectedRelation(event.target.value)}
            placeholder="Corrected relation"
            disabled={isSyncing}
          />
          <input
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={correctedTail}
            onChange={(event) => setCorrectedTail(event.target.value)}
            placeholder="Corrected tail"
            disabled={isSyncing}
          />
        </div>
      ) : null}

      <textarea
        className="mt-3 h-20 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        placeholder="Comment (optional)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        disabled={isSyncing}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSyncing}
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            isSyncing
              ? "border-slate-300 bg-slate-300 text-slate-600"
              : "border-slate-900 bg-slate-900 text-white"
          }`}
        >
          {isSyncing ? "Syncing…" : "Save feedback"}
        </button>
        {isSyncing ? (
          <span className="text-xs text-slate-500" aria-live="polite">
            Waiting for backend acknowledgement…
          </span>
        ) : null}
      </div>
      {validationError ? (
        <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-sm text-rose-800">
          {validationError}
        </p>
      ) : null}
      {effectMessage ? (
        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-800">
          {effectMessage}
        </p>
      ) : null}
    </section>
  );
}
