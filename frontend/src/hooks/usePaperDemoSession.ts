/**
 * Backend-first paper-demo session hook with stable auto-session binding.
 *
 * LIVE mode (CoDEx-M, FB15K-237, WN18RR):
 * - Validates URL sessionId, then localStorage cache, then creates once.
 * - Never creates while already creating; reuses valid cached sessions on refresh.
 *
 * STATIC mode (COVID-Fact, Socio-Economic, backend unavailable):
 * - Returns a clear static sentinel so UI uses DATASETS fallback only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type BackendCandidateRow,
  type BackendClusterRow,
  type BackendGraphSlice,
  type BackendSessionMeta,
} from "../lib/api";
import type { DemoDatasetId } from "../demo-data/types";
import { getDemoMode } from "../lib/demoMode";
import { demoDatasetIdToSampleId, sampleIdToDemoDatasetId } from "../lib/sessionToDemoDataset";

export type PaperDemoSessionMode = "live" | "static";
export type PaperDemoSliceMode =
  | "guided"
  | "overview"
  | "entity"
  | "relation"
  | "cluster"
  | "candidate"
  | "feedback";
export type SessionBindStatus = "idle" | "checking" | "creating" | "ready" | "static";

export interface PaperDemoSliceQuery {
  mode: PaperDemoSliceMode;
  entity?: string | null;
  relation?: string | null;
  clusterId?: string | null;
  candidateId?: string | null;
  candidateStatus?: string | null;
  feedbackBucket?: string | null;
  depth?: number;
  limitNodes?: number;
  limitEdges?: number;
  expandContext?: boolean;
}

export interface PaperDemoSessionState {
  mode: PaperDemoSessionMode;
  sessionId: string | null;
  bindStatus: SessionBindStatus;
  meta: BackendSessionMeta | null;
  sessionMeta: BackendSessionMeta | null;
  graphSlice: BackendGraphSlice | null;
  clusters: BackendClusterRow[];
  candidates: BackendCandidateRow[];
  feedback: Record<string, unknown> | null;
  completedPayload: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applySlice: (slice: PaperDemoSliceQuery) => Promise<void>;
  activeSlice: PaperDemoSliceQuery;
  selectedSlice: PaperDemoSliceQuery;
  setSelectedSlice: (slice: PaperDemoSliceQuery) => Promise<void>;
  recreateSession: () => Promise<void>;
  entitiesSearch: (query: string, limit?: number) => Promise<Array<{ id: string; label: string; degree: number }>>;
  relationsSearch: (query: string, limit?: number) => Promise<Array<{ id: string; label: string; count: number }>>;
}

const SESSION_CACHE_KEY = "paperDemo.sessions";
const GUIDED: PaperDemoSliceQuery = {
  mode: "guided",
  limitNodes: 100,
  limitEdges: 200,
  expandContext: true,
};

interface CachedSessionEntry {
  sessionId: string;
  createdAt: string;
  datasetId: DemoDatasetId;
}

type SessionCache = Partial<Record<DemoDatasetId, CachedSessionEntry>>;

function readSessionIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("sessionId") || params.get("session_id") || null;
}

function readDatasetFromUrl(): DemoDatasetId | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const dataset = params.get("dataset");
  if (
    dataset === "codexM" ||
    dataset === "fb15k237" ||
    dataset === "wn18rr" ||
    dataset === "covidFact" ||
    dataset === "socioEconomic"
  ) {
    return dataset;
  }
  return null;
}

function isBackendLoadable(
  datasetId: DemoDatasetId | null | undefined,
): datasetId is "codexM" | "fb15k237" | "wn18rr" {
  return datasetId === "codexM" || datasetId === "fb15k237" || datasetId === "wn18rr";
}

function readSessionCache(): SessionCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SessionCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionCache(cache: SessionCache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
}

function cachedSessionFor(datasetId: DemoDatasetId): CachedSessionEntry | null {
  const entry = readSessionCache()[datasetId];
  if (!entry?.sessionId) return null;
  return entry;
}

function saveCachedSession(datasetId: DemoDatasetId, sessionId: string) {
  const cache = readSessionCache();
  cache[datasetId] = {
    sessionId,
    createdAt: new Date().toISOString(),
    datasetId,
  };
  writeSessionCache(cache);
}

function updatePaperDemoUrl(datasetId: DemoDatasetId, sessionId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.pathname = "/paper-demo";
  url.searchParams.set("dataset", datasetId);
  if (sessionId) url.searchParams.set("sessionId", sessionId);
  else url.searchParams.delete("sessionId");
  window.history.replaceState({}, "", url.toString());
}

async function validateSession(sessionId: string): Promise<boolean> {
  try {
    await api.getSessionMeta(sessionId);
    return true;
  } catch {
    return false;
  }
}

export function usePaperDemoSession(datasetId: DemoDatasetId | null = null): PaperDemoSessionState {
  const effectiveDatasetId = datasetId ?? readDatasetFromUrl() ?? null;
  const [sessionId, setSessionId] = useState<string | null>(() => readSessionIdFromUrl());
  const [bindStatus, setBindStatus] = useState<SessionBindStatus>("idle");
  const [mode, setMode] = useState<PaperDemoSessionMode>(() =>
    readSessionIdFromUrl() ? "live" : "static",
  );
  const [meta, setMeta] = useState<BackendSessionMeta | null>(null);
  const [graphSlice, setGraphSlice] = useState<BackendGraphSlice | null>(null);
  const [clusters, setClusters] = useState<BackendClusterRow[]>([]);
  const [candidates, setCandidates] = useState<BackendCandidateRow[]>([]);
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const [completedPayload, setCompletedPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(
    Boolean(effectiveDatasetId && isBackendLoadable(effectiveDatasetId) && getDemoMode() !== "static"),
  );
  const [error, setError] = useState<string | null>(null);
  const [activeSlice, setActiveSlice] = useState<PaperDemoSliceQuery>(GUIDED);
  const creatingRef = useRef(false);
  const boundDatasetRef = useRef<DemoDatasetId | null>(null);
  const bindTargetRef = useRef<DemoDatasetId | null>(null);

  const fetchAll = useCallback(
    async (slice: PaperDemoSliceQuery, targetSessionId: string) => {
      setLoading(true);
      setError(null);
      try {
        const metaResp = await api.getSessionMeta(targetSessionId).catch((err) => {
          console.warn("[paper-demo] getSessionMeta failed", err);
          return null;
        });

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
        const effectiveSlice =
          slice.mode === "guided" && selectedSliceFromMeta ? selectedSliceFromMeta : slice;

        const [sliceResp, clustersResp, candidatesResp, feedbackResp, completedResp] = await Promise.all([
          api.getGraphSlice(targetSessionId, effectiveSlice).catch((err) => {
            console.warn("[paper-demo] getGraphSlice failed", err);
            return null;
          }),
          api.listSessionClusters(targetSessionId).catch((err) => {
            console.warn("[paper-demo] clusters failed", err);
            return [] as BackendClusterRow[];
          }),
          api
            .listSessionCandidates(targetSessionId, {
              status: effectiveSlice.candidateStatus ?? undefined,
              clusterId: effectiveSlice.clusterId ?? undefined,
              relation: effectiveSlice.relation ?? undefined,
            })
            .catch((err) => {
              console.warn("[paper-demo] candidates failed", err);
              return [] as BackendCandidateRow[];
            }),
          api.getFeedback(targetSessionId).catch((err) => {
            console.warn("[paper-demo] feedback failed", err);
            return null;
          }),
          api.getCompleted(targetSessionId).catch((err) => {
            console.warn("[paper-demo] completed failed", err);
            return null;
          }),
        ]);

        if (metaResp) {
          setMeta(metaResp);
          setMode("live");
        } else if (!metaResp && !sliceResp) {
          setMode("static");
          setError("Could not reach the live graph sample.");
        }

        setGraphSlice(sliceResp);
        setClusters(sliceResp && sliceResp.clusters?.length ? sliceResp.clusters : clustersResp ?? []);
        setCandidates(sliceResp && sliceResp.candidates?.length ? sliceResp.candidates : candidatesResp ?? []);
        setFeedback(feedbackResp);
        setCompletedPayload(completedResp);
        setActiveSlice(effectiveSlice);
      } catch (err) {
        console.error("[paper-demo] fetchAll error", err);
        setError(err instanceof Error ? err.message : "Could not load the live graph sample.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const bindSession = useCallback(
    async (targetDatasetId: DemoDatasetId, force = false) => {
      if (getDemoMode() === "static") {
        setMode("static");
        setBindStatus("static");
        setSessionId(null);
        setLoading(false);
        setError(null);
        updatePaperDemoUrl(targetDatasetId, null);
        return;
      }

      if (!isBackendLoadable(targetDatasetId)) {
        setMode("static");
        setBindStatus("static");
        setSessionId(null);
        setLoading(false);
        setError(
          targetDatasetId === "covidFact" || targetDatasetId === "socioEconomic"
            ? "This dataset uses a prepared example in the paper demo."
            : null,
        );
        updatePaperDemoUrl(targetDatasetId, null);
        return;
      }

      if (creatingRef.current) return;

      setBindStatus("checking");
      setLoading(true);
      setError(null);

      const sampleId = demoDatasetIdToSampleId(targetDatasetId);
      if (!sampleId) {
        setMode("static");
        setBindStatus("static");
        setLoading(false);
        setError("This dataset uses a prepared example in the paper demo.");
        return;
      }

      if (!force) {
        const urlSessionId = readSessionIdFromUrl();
        const urlDataset = readDatasetFromUrl();
        if (urlSessionId && (!urlDataset || urlDataset === targetDatasetId) && (await validateSession(urlSessionId))) {
          console.info(`Using existing backend session: ${urlSessionId}`);
          setSessionId(urlSessionId);
          setMode("live");
          setBindStatus("ready");
          boundDatasetRef.current = targetDatasetId;
          updatePaperDemoUrl(targetDatasetId, urlSessionId);
          saveCachedSession(targetDatasetId, urlSessionId);
          await fetchAll(GUIDED, urlSessionId);
          return;
        }

        const cached = cachedSessionFor(targetDatasetId);
        if (cached && (await validateSession(cached.sessionId))) {
          console.info(`Using existing backend session: ${cached.sessionId}`);
          setSessionId(cached.sessionId);
          setMode("live");
          setBindStatus("ready");
          boundDatasetRef.current = targetDatasetId;
          updatePaperDemoUrl(targetDatasetId, cached.sessionId);
          await fetchAll(GUIDED, cached.sessionId);
          return;
        }
      }

      creatingRef.current = true;
      setBindStatus("creating");
      console.warn("Creating new backend session because cached session is invalid.");
      try {
        const response = await api.createSampleSession(sampleId, true, 0.8);
        console.info(`Created new backend session: ${response.session_id}`);
        saveCachedSession(targetDatasetId, response.session_id);
        setSessionId(response.session_id);
        setMode("live");
        setBindStatus("ready");
        boundDatasetRef.current = targetDatasetId;
        updatePaperDemoUrl(targetDatasetId, response.session_id);
        await fetchAll(GUIDED, response.session_id);
      } catch (err) {
        setMode("static");
        setBindStatus("static");
        setError(err instanceof Error ? err.message : "Could not load the live graph sample.");
      } finally {
        creatingRef.current = false;
        setLoading(false);
      }
    },
    [fetchAll],
  );

  useEffect(() => {
    if (!effectiveDatasetId) {
      setMode("static");
      setBindStatus("static");
      setLoading(false);
      return;
    }
    if (getDemoMode() === "static") {
      setMode("static");
      setBindStatus("static");
      setSessionId(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (bindTargetRef.current === effectiveDatasetId) return;
    bindTargetRef.current = effectiveDatasetId;
    void bindSession(effectiveDatasetId);
  }, [effectiveDatasetId, bindSession]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    await fetchAll(activeSlice, sessionId);
  }, [sessionId, fetchAll, activeSlice]);

  const applySlice = useCallback(
    async (slice: PaperDemoSliceQuery) => {
      if (!sessionId) {
        setActiveSlice(slice);
        return;
      }
      await fetchAll(slice, sessionId);
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
      await fetchAll(slice, sessionId);
    },
    [sessionId, fetchAll],
  );

  const recreateSession = useCallback(async () => {
    if (!effectiveDatasetId || !isBackendLoadable(effectiveDatasetId)) return;
    boundDatasetRef.current = null;
    bindTargetRef.current = null;
    await bindSession(effectiveDatasetId, true);
  }, [effectiveDatasetId, bindSession]);

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
    bindStatus,
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
    recreateSession,
    entitiesSearch,
    relationsSearch,
  };
}

export { isBackendLoadable, sampleIdToDemoDatasetId };
