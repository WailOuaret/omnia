import { useEffect, useMemo, useState } from "react";
import { api, postFeedback as postFeedbackApi } from "../lib/api";
import { addFeedback, type UserFeedback } from "../stores/feedbackStore";

export type FeedbackMode = "static" | "live";
export type FeedbackStatus = "idle" | "syncing" | "synced" | "sync-failed";

export interface FeedbackBridge {
  mode: FeedbackMode;
  status: FeedbackStatus;
  lastMessage: string | null;
  sessionId: string | null;
  submit: (feedback: UserFeedback) => Promise<void>;
}

function readSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("sessionId") || params.get("session_id") || null;
}

export function useFeedbackBridge(): FeedbackBridge {
  const sessionId = useMemo(readSessionIdFromUrl, []);
  const [mode, setMode] = useState<FeedbackMode>(sessionId ? "live" : "static");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(
    sessionId ? "Probing backend session…" : "Static demo mode (no ?sessionId= provided).",
  );

  useEffect(() => {
    if (!sessionId) {
      setMode("static");
      setLastMessage("Static demo mode (no ?sessionId= provided).");
      return;
    }
    let cancelled = false;
    api
      .getSession(sessionId)
      .then(() => {
        if (cancelled) return;
        setMode("live");
        setLastMessage("Live backend feedback connected.");
      })
      .catch(() => {
        if (cancelled) return;
        setMode("static");
        setLastMessage(`Session ${sessionId} not found on backend; using static demo mode.`);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const submit = async (feedback: UserFeedback) => {
    addFeedback(feedback);
    if (!sessionId) {
      setStatus("synced");
      setLastMessage("Saved locally (static demo mode).");
      return;
    }
    setStatus("syncing");
    setLastMessage("Syncing with backend…");
    try {
      await postFeedbackApi(sessionId, {
        candidate_id: feedback.candidateId,
        Head: feedback.head,
        Relation: feedback.relation,
        Tail: feedback.tail,
        decision: feedback.userDecision,
        reason: feedback.reason ?? undefined,
        comment: feedback.comment,
        user_confidence: feedback.userConfidence,
        evidence_judgement: feedback.evidenceJudgement,
        corrected_triple: feedback.correctedTriple
          ? {
              Head: feedback.correctedTriple.head,
              Relation: feedback.correctedTriple.relation,
              Tail: feedback.correctedTriple.tail,
            }
          : undefined,
      });
      setStatus("synced");
      setMode("live");
      setLastMessage("Saved locally and synced with backend.");
    } catch (error) {
      console.warn("[paper-demo] backend feedback submission failed", error);
      setStatus("sync-failed");
      setLastMessage("Saved locally; backend sync failed.");
    }
  };

  return { mode, status, lastMessage, sessionId, submit };
}
