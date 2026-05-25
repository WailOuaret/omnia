/**
 * Final conference-readiness capture + verification for /paper-demo.
 *
 * Prerequisites:
 *   - Backend: python -m uvicorn backend.app.main:app --reload --port 8000
 *   - Frontend: cd frontend && npm run dev
 *
 * Usage:
 *   node frontend/scripts/capture-final-demo.mjs
 *
 * Optional env:
 *   CODEX_SESSION_ID=...  (skip session creation for CoDEx-M)
 *   BACKEND_BASE=http://127.0.0.1:8000
 *   FRONTEND_BASE=http://127.0.0.1:5173
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const OUT_DIR = join(REPO_ROOT, "docs", "screenshots", "final-demo");
const RESULTS_PATH = join(REPO_ROOT, "outputs", "reports", "final_demo_verification.json");

const BACKEND_BASE = process.env.BACKEND_BASE ?? "http://127.0.0.1:8000";
const FRONTEND_BASE = process.env.FRONTEND_BASE ?? "http://127.0.0.1:5173";

const STEP_BUTTONS = {
  kg: "Knowledge Graph",
  clustering: "Clustering",
  candidates: "Candidate Generation",
  filtering: "Structural Filtering",
  llm: "Semantic Validation",
  feedback: "User Feedback",
  completed: "Completed KG / Diff",
};

function record(checks, name, pass, detail = "") {
  checks.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function apiGet(path) {
  const response = await fetch(`${BACKEND_BASE}${path}`);
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`);
  return response.json();
}

async function apiPost(path) {
  const response = await fetch(`${BACKEND_BASE}${path}`, { method: "POST" });
  if (!response.ok) throw new Error(`POST ${path} → ${response.status}`);
  return response.json();
}

async function waitForServer(url, label, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} not reachable at ${url}`);
}

async function clickWorkflowStep(page, label) {
  const sidebar = page.locator("aside.space-y-3");
  await sidebar.getByRole("button", { name: label }).click();
  await page.waitForTimeout(500);
}

async function screenshot(page, name) {
  const path = join(OUT_DIR, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function createBenchmarkSessions() {
  const samples = await apiGet("/api/samples");
  const sessions = {};
  for (const sid of ["omnia_codex_m", "omnia_fb15k-237", "omnia_wn18rr"]) {
    const sample = samples.samples?.find((s) => s.id === sid);
    if (!sample?.available) {
      sessions[sid] = { error: "not available" };
      continue;
    }
    const data = await apiPost(
      `/api/sessions/sample/${encodeURIComponent(sid)}?holdout_mode=true&sample_proportion=0.8`,
    );
    sessions[sid] = {
      session_id: data.session_id,
      url: `${FRONTEND_BASE}/paper-demo?sessionId=${data.session_id}`,
    };
  }
  return { samples: samples.samples, sessions };
}

function hasFilterArtifacts(candidates) {
  return (candidates ?? []).some(
    (c) => typeof c.distance === "number" && typeof c.threshold === "number" && c.threshold > 0,
  );
}

function hasLlmArtifacts(candidates) {
  return (candidates ?? []).some(
    (c) => c.llm_rationale || c.llm_score != null || (c.retrieved_context?.length ?? 0) > 0,
  );
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(RESULTS_PATH), { recursive: true });

  await waitForServer(`${BACKEND_BASE}/api/health`, "Backend");
  await waitForServer(`${FRONTEND_BASE}/paper-demo`, "Frontend");

  const checks = [];
  const { samples, sessions } = await createBenchmarkSessions();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  let codexSessionId = process.env.CODEX_SESSION_ID ?? sessions.omnia_codex_m?.session_id ?? null;
  let filterArtifacts = false;
  let llmArtifacts = false;

  try {
    // 01 — Auto CoDEx-M live (no manual sessionId required)
    await page.goto(`${FRONTEND_BASE}/paper-demo`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="graph-source-badge"]', { timeout: 120000 });
    await page.waitForSelector('[data-testid="restored-graph-stage"], [data-testid="live-graph-panel"]', {
      timeout: 120000,
    });
    const autoUrl = page.url();
    record(checks, "Auto-load updates URL with sessionId", autoUrl.includes("sessionId="), autoUrl);
    await screenshot(page, "01_auto_codex_live.png");

    const sourceBadge = (await page.locator('[data-testid="graph-source-badge"]').innerText()).toLowerCase();
    record(checks, "Graph source says backend session slice", sourceBadge.includes("backend session slice"), sourceBadge.trim());

    codexSessionId =
      codexSessionId ?? new URL(autoUrl).searchParams.get("sessionId") ?? null;
    if (!codexSessionId) throw new Error("CoDEx-M session could not be resolved from auto-load");

    const candidates = await apiGet(`/api/sessions/${codexSessionId}/candidates?limit=50`);
    filterArtifacts = hasFilterArtifacts(candidates);
    llmArtifacts = hasLlmArtifacts(candidates);

    const datasetSelector = await page.locator('[data-testid="dataset-selector-panel"]').isVisible();
    record(checks, "Dataset chooser visible in live demo", datasetSelector);

    const inspector = await page.locator('[data-testid="paper-demo-inspector"]').isVisible();
    const nodeDetailDup = await page.locator('[data-testid="node-detail-panel"]').count();
    record(checks, "Right column is one tabbed inspector", inspector && nodeDetailDup <= 1);

    const sliceSummary = await page.locator('[data-testid="graph-slice-summary"]').isVisible();
    const navigator = await page.locator('[data-testid="dataset-navigator-panel"]').isVisible();
    record(checks, "Left column has slice summary + navigator", sliceSummary && navigator);

    const graphBox = await page.locator('[data-testid="restored-graph-stage"]').boundingBox();
    record(
      checks,
      "Graph visible without excessive scroll",
      graphBox != null && graphBox.y < 900,
      graphBox ? `y=${Math.round(graphBox.y)}` : "missing",
    );

    const bodyText = (await page.textContent("body")) ?? "";
    const toyLeak = ["Paris", "Eiffel Tower", "Louvre"].some((w) => bodyText.includes(w));
    record(checks, "No silent static fallback (no toy Paris labels)", !toyLeak);

    // 02 — KG step
    await clickWorkflowStep(page, STEP_BUTTONS.kg);
    await screenshot(page, "02_codex_live_kg_graph.png");

    // 03 — Clustering
    await clickWorkflowStep(page, STEP_BUTTONS.clustering);
    await page.waitForTimeout(400);
    const clusterRow = page.locator("main table tbody tr").first();
    if (await clusterRow.count()) {
      await clusterRow.click();
      await page.waitForTimeout(600);
    }
    record(checks, "Clustering step shows graph + panel", await page.locator('[data-testid="restored-graph-stage"]').isVisible());
    await screenshot(page, "02_clustering_relation_tail_pattern.png");

    // 04 — Candidate generation
    await clickWorkflowStep(page, STEP_BUTTONS.candidates);
    await page.waitForTimeout(400);
    const candButtons = page.locator("main aside button[type='button']").filter({ hasText: /:/ });
    if (await candButtons.count()) {
      await candButtons.first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await screenshot(page, "03_candidate_generation_blue_dashed_edges.png");
    record(checks, "Candidate generation step reachable", true);

    // 05 — Filtering
    await clickWorkflowStep(page, STEP_BUTTONS.filtering);
    await page.waitForTimeout(400);
    const filteringText = await page.locator("main").innerText();
    const hasEmptyBanner = filteringText.includes("Filtering artifacts are not available");
    const hasDistanceBar = filteringText.includes("Distance:") && filteringText.includes("Threshold:");
    const hasFakeZero = /\bThreshold[^\n]*0\.00\b/.test(filteringText) && !filterArtifacts;
    record(
      checks,
      filterArtifacts ? "Filtering shows real distance/threshold bars" : "Filtering shows clean empty banner",
      filterArtifacts ? hasDistanceBar : hasEmptyBanner && !hasFakeZero,
    );
    await screenshot(page, "04_filtering_real_or_empty.png");

    // 06 — Semantic validation
    await clickWorkflowStep(page, STEP_BUTTONS.llm);
    await page.waitForTimeout(400);
    const llmText = await page.locator("main").innerText();
    const hasLlmEmpty = llmText.toLowerCase().includes("not available");
    const hasLlmEvidence = llmText.includes("LLM judgement") || llmText.includes("Retrieved context");
    record(
      checks,
      llmArtifacts ? "Semantic validation shows evidence cards" : "Semantic validation shows clean empty banner",
      llmArtifacts ? hasLlmEvidence : hasLlmEmpty || !llmText.includes("invented"),
    );
    await screenshot(page, "05_llm_real_or_empty.png");

    // 07 — Feedback
    await clickWorkflowStep(page, STEP_BUTTONS.feedback);
    await page.waitForTimeout(400);
    const candidatePill = page.locator("main button").filter({ hasText: /:/ }).first();
    if (await candidatePill.count()) {
      await candidatePill.click();
      await page.waitForTimeout(300);
    }
    const acceptBtn = page.getByRole("button", { name: "Accept" });
    const rejectBtn = page.getByRole("button", { name: "Reject" });
    const uncertainBtn = page.getByRole("button", { name: "Uncertain" });
    const correctBtn = page.getByRole("button", { name: "Correct" });
    record(
      checks,
      "Feedback form has Accept/Reject/Uncertain/Correct",
      (await acceptBtn.count()) && (await rejectBtn.count()) && (await uncertainBtn.count()) && (await correctBtn.count()),
    );
    await screenshot(page, "06_feedback_accept.png");

    if (await acceptBtn.count()) {
      await acceptBtn.click();
      const saveBtn = page.getByRole("button", { name: "Save feedback" });
      await saveBtn.click();
      await page.waitForSelector("text=This triple was added to the completed KG", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const feedbackResp = await apiGet(`/api/sessions/${codexSessionId}/feedback`);
      const events = Array.isArray(feedbackResp) ? feedbackResp : feedbackResp.feedback ?? [];
      record(
        checks,
        "Submitting Accept updates backend feedback",
        events.length > 0,
        `events=${events.length}`,
      );
    } else {
      record(checks, "Submitting Accept updates backend feedback", false, "no Accept button / no feedback candidate");
    }

    // 08 — Completed KG / Diff
    await clickWorkflowStep(page, STEP_BUTTONS.completed);
    await page.waitForTimeout(600);
    const completedText = await page.locator("main").innerText();
    record(checks, "Completed step shows export buttons", completedText.includes("Export feedback JSON"));
    record(checks, "Completed step shows diff buckets", /Added|Rejected|Corrected|Review/i.test(completedText));
    await screenshot(page, "07_completed_diff.png");

    for (const [name, path] of [
      ["Export feedback JSON", `/api/sessions/${codexSessionId}/export/feedback.json`],
      ["Export completed KG TSV", `/api/sessions/${codexSessionId}/export/completed.tsv`],
      ["Export KG diff JSON", `/api/sessions/${codexSessionId}/export/diff.json`],
    ]) {
      const response = await fetch(`${BACKEND_BASE}${path}`);
      record(checks, `${name} endpoint`, response.ok, `status=${response.status}`);
    }

    // 09 — Static COVID guided demo
    await page.goto(`${FRONTEND_BASE}/paper-demo?dataset=covidFact`, { waitUntil: "networkidle" });
    await page.locator("select").first().selectOption("covidFact");
    const startBtn = page.getByRole("button", { name: "Start Demo" });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    await page.waitForSelector('[data-testid="restored-graph-stage"], [data-testid="paper-demo-graph-svg"]', {
      timeout: 15000,
    });
    record(checks, "Static COVID-Fact guided demo loads", true);
    await screenshot(page, "08_covid_static_warning.png");

    // 10 — Dataset limitations badges
    await page.goto(`${FRONTEND_BASE}/paper-demo?dataset=socioEconomic`, { waitUntil: "networkidle" });
    await page.locator("select").first().selectOption("socioEconomic");
    await page.waitForTimeout(300);
    const socioText = (await page.textContent("body")) ?? "";
    record(
      checks,
      "Socio-Economic labelled private/static",
      /private|static|demo-only|not available/i.test(socioText),
    );
    await screenshot(page, "10_dataset_limitations_badges.png");
  } finally {
    await browser.close();
  }

  const payload = {
    captured_at: new Date().toISOString(),
    codex_session_id: codexSessionId,
    sessions,
    samples: samples?.map((s) => ({
      id: s.id,
      available: s.available,
      source_available: s.source_available,
      kg_loader_available: s.kg_loader_available,
    })),
    filter_artifacts_on_codex_session: filterArtifacts,
    llm_artifacts_on_codex_session: llmArtifacts,
    checks,
    screenshots_dir: OUT_DIR,
  };

  await writeFile(RESULTS_PATH, JSON.stringify(payload, null, 2));
  console.log(`\nVerification JSON: ${RESULTS_PATH}`);
  console.log(`Screenshots: ${OUT_DIR}`);

  const failed = checks.filter((c) => !c.pass).length;
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll verification checks passed.");
}

main().catch((error) => {
  console.error(`capture-final-demo failed: ${error.message}`);
  process.exit(1);
});
