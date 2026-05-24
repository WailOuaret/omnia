/**
 * Regression checks for live-mode graph routing (Ticket: teacher-ready demo).
 * Ensures live sessions use LiveGraphPanel, not BenchmarkMiniGraph, and the
 * dataset chooser remains visible.
 *
 * Usage: node frontend/scripts/regression-live-mode.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "src");

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

const checks = [
  {
    name: "RestoredGraphStagePanel routes graphPayload to LiveGraphPanel",
    file: "components/paper-demo/RestoredGraphStagePanel.tsx",
    test: (src) => src.includes("graphPayload") && src.includes("<LiveGraphPanel"),
  },
  {
    name: "BenchmarkMiniGraph marked static fallback only",
    file: "components/paper-demo/BenchmarkMiniGraph.tsx",
    test: (src) => src.toLowerCase().includes("static fallback"),
  },
  {
    name: "PaperDemoPage builds interactiveGraphPayload from backend slice",
    file: "pages/PaperDemoPage.tsx",
    test: (src) =>
      src.includes("sessionSliceToGraphPayload") && src.includes("interactiveGraphPayload"),
  },
  {
    name: "Dataset chooser dropdown preserved in DatasetSelectorPanel",
    file: "components/paper-demo/DatasetSelectorPanel.tsx",
    test: (src) =>
      src.includes('data-testid="dataset-selector-dropdown"') &&
      src.includes("Create session for selected dataset"),
  },
  {
    name: "Live mode does not pass useStaticPaperGraph when session is live",
    file: "pages/PaperDemoPage.tsx",
    test: (src) => src.includes('useStaticPaperGraph={!isLiveMode'),
  },
  {
    name: "sessionSliceToGraphPayload reads BackendGraphSlice directly",
    file: "lib/sessionSliceToGraphPayload.ts",
    test: (src) => src.includes("slice.nodes") && src.includes("slice.edges"),
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
  console.error(`\n${failed} live-mode regression check(s) failed.`);
  process.exit(1);
}

console.log("\nAll live-mode regression checks passed.");
