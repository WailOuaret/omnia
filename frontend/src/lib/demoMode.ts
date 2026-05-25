export type DemoMode = "static" | "live" | "auto";

export function getDemoMode(): DemoMode {
  const raw = (import.meta.env.VITE_DEMO_MODE ?? "auto").trim().toLowerCase();
  if (raw === "static" || raw === "live" || raw === "auto") return raw;
  return "auto";
}

export function isStaticDemoMode(): boolean {
  return getDemoMode() === "static";
}

export function isLiveDemoMode(): boolean {
  return getDemoMode() === "live";
}
