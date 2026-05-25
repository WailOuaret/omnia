/**
 * Static regression checks for the paper-demo live/static data boundary.
 *
 * These checks catch accidental reintroduction of old override paths:
 * static graph renderers in live mode, fake filtering defaults, and repeated
 * session creation without localStorage validation.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "src");

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

const checks = [
  {
    name: "live_mode_never_uses_benchmark_minigraph",
    file: "components/paper-demo/RestoredGraphStagePanel.tsx",
    test: (src) =>
      src.includes("if (graphPayload)") &&
      src.includes("<LiveGraphPanel") &&
      src.includes("Static fallback only"),
  },
  {
    name: "live_mode_never_uses_static_dataset_graph",
    file: "pages/PaperDemoPage.tsx",
    test: (src) =>
      src.includes("buildLiveOmniaViewModel") &&
      src.includes("isLiveModeActive") &&
      src.includes('useStaticPaperGraph={!isLiveModeActive'),
  },
  {
    name: "live_mode_candidates_from_backend_only",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) =>
      src.includes("sliceResp.candidates?.length ? sliceResp.candidates : candidatesResp") &&
      src.includes("listSessionCandidates"),
  },
  {
    name: "live_mode_clusters_from_backend_only",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) =>
      src.includes("sliceResp.clusters?.length ? sliceResp.clusters : clustersResp") &&
      src.includes("listSessionClusters"),
  },
  {
    name: "filtering_missing_artifact_shows_empty_banner_not_zero",
    file: "components/paper-demo/PaperDemoStepView.tsx",
    test: (src) =>
      src.includes("Filtering artifacts are not available for this session") &&
      !src.includes('value={thresholdSample?.toFixed(2) ?? "n/a"}'),
  },
  {
    name: "selected_candidate_persists_across_steps",
    file: "pages/PaperDemoPage.tsx",
    test: (src) =>
      src.includes("selectedCandidateId") &&
      src.includes("setActiveStep") &&
      !src.includes("setSelectedCandidateId(activeStep") &&
      !src.includes("setSelectedClusterId(activeStep"),
  },
  {
    name: "selected_cluster_persists_across_steps",
    file: "pages/PaperDemoPage.tsx",
    test: (src) =>
      src.includes("selectedClusterId") &&
      src.includes("onSelectCluster") &&
      src.includes("WorkflowStepMenu activeStep={activeStep}"),
  },
  {
    name: "cached_session_reused_on_refresh",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) =>
      src.includes('const SESSION_CACHE_KEY = "paperDemo.sessions"') &&
      src.includes("cachedSessionFor(") &&
      src.includes("validateSession(cached.sessionId)"),
  },
  {
    name: "invalid_session_recreated_once_only",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) =>
      src.includes("creatingRef.current") &&
      src.includes("Creating new backend session because cached session is invalid"),
  },
  {
    name: "covid_fact_static_only_no_backend_creation",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) =>
      src.includes("isBackendLoadable") &&
      src.includes("This dataset is static-only in the paper demo.") &&
      !src.includes('return "omnia_covid_fact";'),
  },
  {
    name: "socio_economic_static_only_no_backend_creation",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) => src.includes("This dataset is static-only in the paper demo."),
  },
];

let failed = 0;
for (const check of checks) {
  const src = read(check.file);
  if (!check.test(src)) {
    console.error(`FAIL: ${check.name}`);
    failed += 1;
  } else {
    console.log(`OK:   ${check.name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} paper-demo override regression check(s) failed.`);
  process.exit(1);
}

console.log("\nAll paper-demo override regression checks passed.");
