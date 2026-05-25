export type DemoMode = "static" | "live" | "auto";

export function getDemoMode(): DemoMode {
  const fallback = import.meta.env.PROD ? "static" : "auto";
  const raw = (import.meta.env.VITE_DEMO_MODE ?? fallback).trim().toLowerCase();
  if (raw === "static" || raw === "live" || raw === "auto") return raw;
  return fallback;
}

export function isStaticDemoMode(): boolean {
  return getDemoMode() === "static";
}

export function isLiveDemoMode(): boolean {
  return getDemoMode() === "live";
}
