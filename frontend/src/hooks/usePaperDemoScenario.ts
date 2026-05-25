import { useCallback, useEffect, useMemo, useState } from "react";
import type { DemoDatasetId } from "../demo-data/types";
import { buildScenarioViewModel, type StaticOmniaViewModel } from "../lib/buildScenarioViewModel";
import { SCENARIO_FILES, type PaperDemoScenario } from "../types/scenario";
import {
  addFeedback,
  getFeedbackForDataset,
  type UserFeedback,
} from "../stores/feedbackStore";

type Decision = "accept" | "reject" | "uncertain" | "correct";

export interface UsePaperDemoScenarioOptions {
  enabled?: boolean;
  activeStep?: string;
  selectedClusterId?: string | null;
  selectedCandidateId?: string | null;
}

export function usePaperDemoScenario(
  datasetId: DemoDatasetId | null,
  {
    enabled = true,
    activeStep = "kg",
    selectedClusterId = null,
    selectedCandidateId = null,
  }: UsePaperDemoScenarioOptions = {},
) {
  const [scenario, setScenario] = useState<PaperDemoScenario | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [feedbackEvents, setFeedbackEvents] = useState<UserFeedback[]>([]);
  const [feedbackRevision, setFeedbackRevision] = useState(0);

  useEffect(() => {
    if (!enabled || !datasetId) {
      setScenario(null);
      setStatus("idle");
      return;
    }

    const path = SCENARIO_FILES[datasetId];
    if (!path) {
      setScenario(null);
      setStatus("error");
      setError(`No static scenario file for dataset ${datasetId}.`);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    void fetch(path)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load ${path} (${response.status})`);
        const contentType = response.headers.get("content-type") ?? "";
        const text = await response.text();
        if (
          text.trimStart().startsWith("<!") ||
          (!contentType.includes("json") && text.includes("<html"))
        ) {
          throw new Error(
            `Scenario asset missing at ${path}. The deployed build does not include demo-scenarios JSON files yet.`,
          );
        }
        const payload = JSON.parse(text) as PaperDemoScenario;
        if (!payload?.datasetId || !payload?.overviewSlice) {
          throw new Error(`Invalid scenario JSON at ${path}.`);
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setScenario(payload);
        setStatus("ready");
        setFeedbackEvents(getFeedbackForDataset(datasetId));
      })
      .catch((err) => {
        if (cancelled) return;
        setScenario(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not load static scenario.");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, datasetId]);

  useEffect(() => {
    if (!enabled || !datasetId || status !== "ready") return;
    setFeedbackEvents(getFeedbackForDataset(datasetId));
  }, [enabled, datasetId, status, feedbackRevision]);

  const feedbackDecisions = useMemo(() => {
    const map: Record<string, Decision> = {};
    const sorted = [...feedbackEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of sorted) {
      map[event.candidateId] = event.userDecision;
    }
    return map;
  }, [feedbackEvents]);

  const viewModel = useMemo<StaticOmniaViewModel | null>(() => {
    if (!scenario || status !== "ready") return null;
    return buildScenarioViewModel({
      scenario,
      activeStep,
      selectedClusterId,
      selectedCandidateId,
      feedbackDecisions,
    });
  }, [scenario, status, activeStep, selectedClusterId, selectedCandidateId, feedbackDecisions]);

  const submitFeedbackDecision = useCallback(
    (feedback: UserFeedback) => {
      if (!datasetId) return;
      addFeedback(feedback);
      setFeedbackEvents(getFeedbackForDataset(datasetId));
      setFeedbackRevision((revision) => revision + 1);
    },
    [datasetId],
  );

  return {
    scenario,
    status,
    error,
    viewModel,
    feedbackEvents,
    feedbackDecisions,
    submitFeedbackDecision,
    refresh: () => setFeedbackRevision((revision) => revision + 1),
  };
}
