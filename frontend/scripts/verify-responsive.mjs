/**
 * Responsive screenshot verification for /paper-demo.
 *
 * Prerequisites:
 *   1. Frontend dev server running: cd frontend && npm run dev
 *   2. Playwright browsers installed: cd frontend && npx playwright install chromium
 *
 * Usage:
 *   cd frontend
 *   node scripts/verify-responsive.mjs
 *
 * Optional env:
 *   PAPER_DEMO_URL=http://127.0.0.1:5173/paper-demo
 */

import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const screenshotRoot = path.join(repoRoot, "docs", "screenshots");

const BASE_URL = process.env.PAPER_DEMO_URL ?? "http://127.0.0.1:5173/paper-demo";

const VIEWPORTS = [
  { label: "1366", width: 1366, height: 768 },
  { label: "1920", width: 1920, height: 1080 },
];

const WORKFLOW_STEPS = [
  "Knowledge Graph",
  "Clustering",
  "Candidate Generation",
  "Structural Filtering",
  "Semantic Validation",
  "User Feedback",
  "Completed KG / Diff",
];

const DATASETS = [
  { id: "covidFact", slug: "covid-fact" },
  { id: "codexM", slug: "codex-m" },
  { id: "fb15k237", slug: "fb15k237" },
  { id: "wn18rr", slug: "wn18rr" },
  { id: "socioEconomic", slug: "socio-economic" },
];

async function assertNoHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
}

async function startDemo(page, datasetId) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  const landingSelect = page.locator("select").first();
  if (await landingSelect.isVisible()) {
    await landingSelect.selectOption(datasetId);
    await page.getByRole("button", { name: "Start Demo" }).click();
    await page.waitForSelector('[data-testid="restored-graph-stage"], [data-testid="graph-comparison-panel"]', {
      timeout: 15000,
    });
    return;
  }
  const sidebarSelect = page.locator("aside select").first();
  await sidebarSelect.selectOption(datasetId);
}

async function clickStep(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function capture(page, outDir, name) {
  const noOverflow = await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  return noOverflow;
}

async function main() {
  const reportLines = [
    "# Responsive screenshot report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE_URL}`,
    "",
    "## Results",
    "",
    "| Viewport | Screenshot | No horizontal overflow |",
    "| --- | --- | --- |",
  ];

  let allPassed = true;

  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of VIEWPORTS) {
      const outDir = path.join(screenshotRoot, viewport.label);
      await mkdir(outDir, { recursive: true });

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      // Landing
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      const landingOk = await capture(page, outDir, "00-landing");
      reportLines.push(`| ${viewport.label} | 00-landing.png | ${landingOk ? "PASS" : "FAIL"} |`);
      allPassed &&= landingOk;

      // COVID-Fact full workflow
      await startDemo(page, "covidFact");
      for (const step of WORKFLOW_STEPS) {
        await clickStep(page, step);
        const slug = step.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
        const ok = await capture(page, outDir, `covid-${slug}`);
        reportLines.push(`| ${viewport.label} | covid-${slug}.png | ${ok ? "PASS" : "FAIL"} |`);
        allPassed &&= ok;
      }

      // Other datasets — completed step only
      for (const dataset of DATASETS.slice(1)) {
        await startDemo(page, dataset.id);
        await clickStep(page, "Completed KG / Diff");
        await page.waitForSelector('[data-testid="graph-comparison-panel"]', { timeout: 10000 });
        const ok = await capture(page, outDir, `${dataset.slug}-completed`);
        reportLines.push(`| ${viewport.label} | ${dataset.slug}-completed.png | ${ok ? "PASS" : "FAIL"} |`);
        allPassed &&= ok;
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  reportLines.push("");
  reportLines.push(`## Overall: ${allPassed ? "PASS" : "PARTIAL — overflow detected on one or more screenshots"}`);
  reportLines.push("");
  reportLines.push("Screenshots saved under `docs/screenshots/1366/` and `docs/screenshots/1920/`.");

  const reportPath = path.join(repoRoot, "RESPONSIVE_SCREENSHOT_REPORT.md");
  await writeFile(reportPath, reportLines.join("\n"), "utf8");
  console.log(`Report written to ${reportPath}`);
  console.log(allPassed ? "ALL OVERFLOW CHECKS PASSED" : "OVERFLOW CHECKS FAILED — see report");
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
