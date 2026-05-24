/**
 * Backend-first paper-demo session hook.
 *
 * In LIVE mode (URL has ?sessionId=…) this hook is the SOLE source of truth
 * for the paper demo's graph, clusters, candidates, filtering, LLM evaluations,
 * feedback, and completed-KG payloads. It calls the real backend artifacts and
 * never falls back to the static frontend demo-data configs.
 *
 * In STATIC mode (no sessionId) the hook resolves to a clear "static" sentinel
 * so the rest of the UI can use its existing DATASETS config fallback.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type BackendCandidateRow,
  type BackendClusterRow,
  type BackendGraphSlice,
  type BackendSessionMeta,
} from "../lib/api";

export type PaperDemoSessionMode = "live" | "static";

export type PaperDemoSliceMode =
  | "guided"
  | "entity"
  | "relation"
  | "cluster"
  | "candidate"
  | "feedback";

export interface PaperDemoSliceQuery {
  mode: PaperDemoSliceMode;
  entity?: string | null;
  relation?: string | null;
  clusterId?: string | null;
  candidateStatus?: string | null;
  feedbackBucket?: string | null;
  depth?: number;
  limitNodes?: number;
  limitEdges?: number;
}

export interface PaperDemoSessionState {
  /** "live" when a backend session is bound, "static" otherwise. */
  mode: PaperDemoSessionMode;
  sessionId: string | null;
  /** Session metadata pulled from /overview/meta. */
  meta: BackendSessionMeta | null;
  sessionMeta: BackendSessionMeta | null;
  /** Current bounded graph slice from the real backend session. */
  graphSlice: BackendGraphSlice | null;
  clusters: BackendClusterRow[];
  candidates: BackendCandidateRow[];
  feedback: Record<string, unknown> | null;
  completedPayload: Record<string, unknown> | null;
  loading: boolean;
  /** Human-readable error if the live mode probe or hydration failed. */
  error: string | null;
  /** Re-fetch every backend artifact. */
  refresh: () => Promise<void>;
  /** Apply a new slice. In static mode this is a no-op. */
  applySlice: (slice: PaperDemoSliceQuery) => Promise<void>;
  /** The slice query that produced the current `graphSlice` (or default guided). */
  activeSlice: PaperDemoSliceQuery;
  selectedSlice: PaperDemoSliceQuery;
  setSelectedSlice: (slice: PaperDemoSliceQuery) => Promise<void>;
  entitiesSearch: (query: string, limit?: number) => Promise<Array<{ id: string; label: string; degree: number }>>;
  relationsSearch: (query: string, limit?: number) => Promise<Array<{ id: string; label: string; count: number }>>;
}

const GUIDED: PaperDemoSliceQuery = { mode: "guided" };

function readSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("sessionId") || params.get("session_id") || null;
}

export function usePaperDemoSession(): PaperDemoSessionState {
  const sessionId = useMemo(readSessionIdFromUrl, []);
  const [mode, setMode] = useState<PaperDemoSessionMode>(sessionId ? "live" : "static");
  const [meta, setMeta] = useState<BackendSessionMeta | null>(null);
  const [graphSlice, setGraphSlice] = useState<BackendGraphSlice | null>(null);
  const [clusters, setClusters] = useState<BackendClusterRow[]>([]);
  const [candidates, setCandidates] = useState<BackendCandidateRow[]>([]);
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const [completedPayload, setCompletedPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [activeSlice, setActiveSlice] = useState<PaperDemoSliceQuery>(GUIDED);

  const fetchAll = useCallback(
    async (slice: PaperDemoSliceQuery) => {
      if (!sessionId) {
        setMode("static");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [metaResp] = await Promise.all([
          api.getSessionMeta(sessionId).catch((err) => {
            console.warn("[paper-demo] getSessionMeta failed", err);
            return null;
          }),
        ]);
        const selectedSliceFromMeta = metaResp?.selected_slice
          ? {
              mode: (metaResp.selected_slice.mode as PaperDemoSliceMode) ?? "guided",
              entity: metaResp.selected_slice.entity ?? null,
              relation: metaResp.selected_slice.relation ?? null,
              clusterId: metaResp.selected_slice.cluster_id ?? null,
              candidateStatus: metaResp.selected_slice.candidate_status ?? null,
              feedbackBucket: metaResp.selected_slice.feedback_bucket ?? null,
            }
          : null;
        const effectiveSlice = slice.mode === "guided" && selectedSliceFromMeta ? selectedSliceFromMeta : slice;
        const [sliceResp, clustersResp, candidatesResp, feedbackResp, completedResp] = await Promise.all([
          api
            .getGraphSlice(sessionId, effectiveSlice)
            .catch((err) => {
              console.warn("[paper-demo] getGraphSlice failed", err);
              return null;
            }),
          api.listSessionClusters(sessionId).catch((err) => {
            console.warn("[paper-demo] clusters failed", err);
            return [] as BackendClusterRow[];
          }),
          api
            .listSessionCandidates(sessionId, {
              status: effectiveSlice.candidateStatus ?? undefined,
              clusterId: effectiveSlice.clusterId ?? undefined,
              relation: effectiveSlice.relation ?? undefined,
            })
            .catch((err) => {
              console.warn("[paper-demo] candidates failed", err);
              return [] as BackendCandidateRow[];
            }),
          api.getFeedback(sessionId).catch((err) => {
            console.warn("[paper-demo] feedback failed", err);
            return null;
          }),
          api.getCompleted(sessionId).catch((err) => {
            console.warn("[paper-demo] completed failed", err);
            return null;
          }),
        ]);

        if (metaResp) {
          setMeta(metaResp);
          setMode("live");
        } else if (!metaResp && !sliceResp) {
          // Session probe failed completely — fall back gracefully.
          setMode("static");
          setError(
            `Could not reach backend session ${sessionId}. Showing static demo fallback.`,
          );
        }
        setGraphSlice(sliceResp);
        setClusters(clustersResp ?? []);
        setCandidates(candidatesResp ?? []);
        setFeedback(feedbackResp);
        setCompletedPayload(completedResp);
        setActiveSlice(effectiveSlice);
      } catch (err) {
        console.error("[paper-demo] fetchAll error", err);
        setError(
          err instanceof Error ? err.message : "Backend hydration failed for the paper demo.",
        );
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;
    void fetchAll(GUIDED);
  }, [sessionId, fetchAll]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    await fetchAll(activeSlice);
  }, [sessionId, fetchAll, activeSlice]);

  const applySlice = useCallback(
    async (slice: PaperDemoSliceQuery) => {
      if (!sessionId) {
        setActiveSlice(slice);
        return;
      }
      await fetchAll(slice);
    },
    [sessionId, fetchAll],
  );

  const setSelectedSlice = useCallback(
    async (slice: PaperDemoSliceQuery) => {
      if (!sessionId) {
        setActiveSlice(slice);
        return;
      }
      await api.postDemoSlice(sessionId, {
        mode: slice.mode,
        entity: slice.entity ?? null,
        relation: slice.relation ?? null,
        cluster_id: slice.clusterId ?? null,
        candidate_status: slice.candidateStatus ?? null,
        feedback_bucket: slice.feedbackBucket ?? null,
        limit: slice.limitEdges ?? 150,
      });
      await fetchAll(slice);
    },
    [sessionId, fetchAll],
  );

  const entitiesSearch = useCallback(
    async (query: string, limit = 20) => {
      if (!sessionId) return [];
      const response = await api.listSessionEntities(sessionId, query, limit);
      const entities = response.entities ?? [];
      return (entities as Array<{ id: string; label: string; degree?: number }>).map((row) => ({
        id: row.id,
        label: row.label ?? row.id,
        degree: row.degree ?? 0,
      }));
    },
    [sessionId],
  );

  const relationsSearch = useCallback(
    async (query: string, limit = 20) => {
      if (!sessionId) return [];
      const response = await api.listSessionRelations(sessionId, query, limit);
      return (response.relations ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        count: row.count,
      }));
    },
    [sessionId],
  );

  return {
    mode,
    sessionId,
    meta,
    sessionMeta: meta,
    graphSlice,
    clusters,
    candidates,
    feedback,
    completedPayload,
    loading,
    error,
    refresh,
    applySlice,
    activeSlice,
    selectedSlice: activeSlice,
    setSelectedSlice,
    entitiesSearch,
    relationsSearch,
  };
}
