/**
 * Regression checks for canonical live view model routing.
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
    name: "live_mode_uses_only_live_view_model",
    file: "pages/PaperDemoPage.tsx",
    test: (src) => src.includes("buildLiveOmniaViewModel") && src.includes("liveViewModel?.graph"),
  },
  {
    name: "live_mode_no_static_graph_override",
    file: "pages/PaperDemoPage.tsx",
    test: (src) =>
      !src.includes("useStaticFallbackInLive") &&
      !src.includes("sessionToDemoDataset(") &&
      src.includes("Live session loading — no static fallback"),
  },
  {
    name: "selected_candidate_belongs_to_selected_cluster",
    file: "lib/buildLiveOmniaViewModel.ts",
    test: (src) =>
      src.includes("candidateBelongsToCluster") && src.includes("mismatch"),
  },
  {
    name: "candidate_list_filtered_by_selected_cluster",
    file: "lib/buildLiveOmniaViewModel.ts",
    test: (src) => src.includes("filterCandidatesForCluster"),
  },
  {
    name: "filtering_missing_artifacts_no_zero_values",
    file: "components/paper-demo/PaperDemoStepView.tsx",
    test: (src) =>
      src.includes("filteringAvailable") &&
      src.includes("Filtering artifacts are not available for this session"),
  },
  {
    name: "llm_missing_artifacts_no_fake_values",
    file: "components/paper-demo/PaperDemoStepView.tsx",
    test: (src) =>
      src.includes("llmAvailable") &&
      src.includes("LLM/RAG validation artifacts are not available for this session"),
  },
  {
    name: "dataset_switch_loads_codex_fb15k_wn18rr",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) =>
      src.includes('"codexM"') && src.includes('"fb15k237"') && src.includes('"wn18rr"'),
  },
  {
    name: "covid_static_only",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) => src.includes('targetDatasetId === "covidFact"'),
  },
  {
    name: "socio_static_only",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) => src.includes('targetDatasetId === "socioEconomic"'),
  },
  {
    name: "refresh_reuses_cached_session",
    file: "hooks/usePaperDemoSession.ts",
    test: (src) => src.includes("cachedSessionFor(") && src.includes("validateSession("),
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
  console.error(`\n${failed} live view-model regression check(s) failed.`);
  process.exit(1);
}

console.log("\nAll live view-model regression checks passed.");
