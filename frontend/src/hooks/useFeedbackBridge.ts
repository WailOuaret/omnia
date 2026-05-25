import { useCallback, useEffect, useMemo, useState } from "react";
import { api, postFeedback as postFeedbackApi } from "../lib/api";
import {
  adaptCompletedResponse,
  adaptFeedbackResponse,
  mergeFeedbackByCandidate,
  type BackendCompletedResponse,
  type BackendFeedbackResponse,
  type CompletedSummaryView,
} from "../lib/adapters";
import { addFeedback, getFeedbackForDataset, type UserFeedback } from "../stores/feedbackStore";

export type FeedbackMode = "static" | "live";
export type FeedbackStatus = "idle" | "hydrating" | "syncing" | "synced" | "sync-failed";

export interface FeedbackBridge {
  mode: FeedbackMode;
  status: FeedbackStatus;
  lastMessage: string | null;
  sessionId: string | null;
  /** Latest known feedback list. In live mode this is the merged server + client state.
   *  In static mode it is `null` and consumers should fall back to `getFeedbackForDataset`. */
  hydratedFeedback: UserFeedback[] | null;
  /** Latest completed-step summary from the backend. `null` in static mode or before hydration. */
  completedSummary: CompletedSummaryView | null;
  /** Submit one decision. Always writes to localStorage. Posts to backend if sessionId is set. */
  submit: (feedback: UserFeedback) => Promise<void>;
  /** Force a re-fetch of feedback + completed payload from the backend. No-op in static mode. */
  refresh: () => Promise<void>;
}

function readSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("sessionId") || params.get("session_id") || null;
}

export function useFeedbackBridge(
  datasetId?: string | null,
  sessionIdOverride?: string | null,
): FeedbackBridge {
  const urlSessionId = useMemo(readSessionIdFromUrl, []);
  const sessionId = sessionIdOverride ?? urlSessionId;
  const [mode, setMode] = useState<FeedbackMode>(sessionId ? "live" : "static");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(
    sessionId ? "Probing backend session…" : "Static demo mode (no ?sessionId= provided).",
  );
  const [hydratedFeedback, setHydratedFeedback] = useState<UserFeedback[] | null>(null);
  const [completedSummary, setCompletedSummary] = useState<CompletedSummaryView | null>(null);

  const hydrate = useCallback(
    async (targetDatasetId: string | null | undefined) => {
      if (!sessionId) return;
      setStatus("hydrating");
      try {
        const [feedbackResponse, completedResponse] = await Promise.all([
          api.getFeedback(sessionId).catch((error) => {
            console.warn("[paper-demo] getFeedback failed during hydration", error);
            return null;
          }),
          api.getCompleted(sessionId).catch((error) => {
            console.warn("[paper-demo] getCompleted failed during hydration", error);
            return null;
          }),
        ]);

        const dsId = targetDatasetId ?? "";
        const serverList = adaptFeedbackResponse(
          feedbackResponse as BackendFeedbackResponse | null,
          dsId,
        );
        const clientList = dsId ? getFeedbackForDataset(dsId) : [];
        const merged = mergeFeedbackByCandidate(serverList, clientList);
        setHydratedFeedback(merged);
        setCompletedSummary(
          adaptCompletedResponse(completedResponse as BackendCompletedResponse | null),
        );
        setMode("live");
        setStatus("synced");
        setLastMessage("Live backend feedback connected.");
      } catch (error) {
        console.warn("[paper-demo] hydration failed", error);
        setStatus("sync-failed");
        setLastMessage("Hydration failed; static demo mode.");
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) {
      setMode("static");
      setLastMessage("Static demo mode (no ?sessionId= provided).");
      setHydratedFeedback(null);
      setCompletedSummary(null);
      return;
    }
    let cancelled = false;
    api
      .getSession(sessionId)
      .then(async () => {
        if (cancelled) return;
        setMode("live");
        setLastMessage("Live backend feedback connected.");
        await hydrate(datasetId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setMode("static");
        setLastMessage(`Session ${sessionId} not found on backend; using static demo mode.`);
        setHydratedFeedback(null);
        setCompletedSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, datasetId, hydrate]);

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
      setMode("live");
      // Re-hydrate so the UI reflects the authoritative server state, including
      // any backend-side enrichment (LLM/filtering metadata, threshold suggestion).
      await hydrate(feedback.datasetId);
      setStatus("synced");
      setLastMessage("Saved locally and synced with backend.");
    } catch (error) {
      console.warn("[paper-demo] backend feedback submission failed", error);
      setStatus("sync-failed");
      setLastMessage("Saved locally; backend sync failed.");
    }
  };

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    await hydrate(datasetId ?? null);
  }, [sessionId, datasetId, hydrate]);

  return {
    mode,
    status,
    lastMessage,
    sessionId,
    hydratedFeedback,
    completedSummary,
    submit,
    refresh,
  };
}
