import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BACKEND_BASE = process.env.REAL_DEMO_BACKEND_URL ?? "http://127.0.0.1:8000";
const FRONTEND_BASE = process.env.REAL_DEMO_FRONTEND_URL ?? "http://127.0.0.1:5173";
const OUT_DIR = join(process.cwd(), "test-results", "real-demo");

const STEP_LABELS = [
  "Knowledge Graph",
  "Clustering",
  "Candidate Generation",
  "Structural Filtering",
  "Semantic Validation",
  "User Feedback",
  "Completed KG / Diff",
];

function fail(message) {
  throw new Error(message);
}

async function apiGet(path) {
  const response = await fetch(`${BACKEND_BASE}${path}`);
  if (!response.ok) {
    fail(`GET ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function apiPost(path) {
  const response = await fetch(`${BACKEND_BASE}${path}`, { method: "POST" });
  if (!response.ok) {
    fail(`POST ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function assertNoToyData(text) {
  const toyWords = ["Paris", "Eiffel Tower", "Louvre", "Tourism"];
  const hits = toyWords.filter((word) => text.includes(word));
  if (hits.length > 0) {
    fail(`Static toy data leaked into live mode: ${hits.join(", ")}`);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const samplesPayload = await apiGet("/api/samples");
  const realAvailable = (samplesPayload.samples ?? []).filter(
    (sample) =>
      ["omnia_codex_m", "omnia_fb15k-237", "omnia_wn18rr"].includes(sample.id) && sample.available,
  );
  if (realAvailable.length === 0) {
    fail("No real dataset available. Run python scripts/setup_real_datasets.py");
  }

  const preferred = realAvailable.find((s) => s.id === "omnia_codex_m") ?? realAvailable[0];
  const sessionPayload = await apiPost(
    `/api/sessions/sample/${encodeURIComponent(
      preferred.id,
    )}?holdout_mode=true&sample_proportion=0.8`,
  );
  const sessionId = sessionPayload.session_id;
  if (!sessionId) fail("Session creation response did not include session_id");

  const slicePayload = await apiGet(`/api/sessions/${sessionId}/graph/slice?mode=guided`);
  if (slicePayload.source !== "backend_session") {
    fail(`Expected backend_session source, got: ${slicePayload.source}`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  try {
    await page.goto(`${FRONTEND_BASE}/paper-demo?sessionId=${sessionId}`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector('[data-testid="graph-source-badge"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="dataset-navigator-panel"]', { timeout: 15000 });

    const sourceBadge = (await page.locator('[data-testid="graph-source-badge"]').innerText()).toLowerCase();
    if (!sourceBadge.includes("backend session slice")) {
      fail(`Graph source badge does not indicate backend session slice:\n${sourceBadge}`);
    }

    const navigatorText = await page.locator('[data-testid="dataset-navigator-panel"]').innerText();
    if (!navigatorText.toLowerCase().includes("explore real session data")) {
      fail("Navigator is not in real-session mode.");
    }

    const pageText = await page.textContent("body");
    assertNoToyData(pageText ?? "");

    for (let i = 0; i < STEP_LABELS.length; i += 1) {
      const label = STEP_LABELS[i];
      await page.getByRole("button", { name: label }).click();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: join(OUT_DIR, `${String(i + 1).padStart(2, "0")}-${label.replace(/[^\w]+/g, "_")}.png`),
        fullPage: true,
      });
    }

    const clusters = await apiGet(`/api/sessions/${sessionId}/clusters`);
    if (!Array.isArray(clusters)) {
      fail("Clusters endpoint did not return an array payload.");
    }
    const candidates = await apiGet(`/api/sessions/${sessionId}/candidates?limit=20`);
    if (!Array.isArray(candidates)) {
      fail("Candidates endpoint did not return an array payload.");
    }

    console.log("real-demo diagnostic passed");
    console.log(`session_id=${sessionId}`);
    console.log(`screenshots_dir=${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`real-demo diagnostic failed: ${error.message}`);
  process.exit(1);
});
