/** Hosted (e.g. Vercel) demo helpers — teacher link works without a deployed FastAPI backend. */

export function isBrowserHostedDemo(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith(".vercel.app") || hostname.includes(".vercel.app");
}

/** True when the UI should not attempt live backend session creation (Vercel / no API URL). */
export function prefersStaticTeacherDemo(): boolean {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBase) return false;

  if (typeof window === "undefined") return false;

  const { hostname, port } = window.location;
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";

  // Local Vite dev server proxies /api to :8000 — keep live mode available.
  if (isLocalHost && port && port !== "8000") return false;

  return isBrowserHostedDemo() || !isLocalHost;
}

export function defaultDatasetForHost(): "covidFact" | "codexM" {
  return prefersStaticTeacherDemo() ? "covidFact" : "codexM";
}
