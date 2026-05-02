import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionSummary } from "../types";

interface DemoConfig {
  format: "triples" | "sentences";
  strategy: "zero" | "context" | "rag";
  topK: number;
  maxCandidates: number;
  filteringEnabled: boolean;
  forceMock: boolean;
  preferredDevice: "cuda" | "cpu";
}

interface SessionStore {
  session: SessionSummary | null;
  logs: Array<Record<string, unknown>>;
  guidedStep: number;
  demoConfig: DemoConfig;
  setSession: (session: SessionSummary | null) => void;
  setLogs: (logs: Array<Record<string, unknown>>) => void;
  setGuidedStep: (step: number) => void;
  patchDemoConfig: (patch: Partial<DemoConfig>) => void;
  reset: () => void;
}

const defaultConfig: DemoConfig = {
  format: "triples",
  strategy: "rag",
  topK: 2,
  maxCandidates: 24,
  filteringEnabled: true,
  forceMock: false,
  preferredDevice: "cuda",
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      session: null,
      logs: [],
      guidedStep: 0,
      demoConfig: defaultConfig,
      setSession: (session) => set({ session }),
      setLogs: (logs) => set({ logs }),
      setGuidedStep: (guidedStep) => set({ guidedStep }),
      patchDemoConfig: (patch) =>
        set((state) => ({
          demoConfig: { ...state.demoConfig, ...patch },
        })),
      reset: () =>
        set({
          session: null,
          logs: [],
          guidedStep: 0,
          demoConfig: defaultConfig,
        }),
    }),
    { name: "omnia-demo-store" },
  ),
);
