import { expect, test } from "@playwright/test";

test.describe("/paper-demo", () => {
  test("legacy ?paper=1 redirects to standalone COVID paper demo (not dashboard)", async ({ page }) => {
    await page.goto("/?paper=1");
    await expect(page).toHaveURL(/\/paper-demo$/);
    await expect(page.getByTestId("paper-demo-root")).toBeVisible();

    await expect(page.getByText("Run OMNIA pipeline")).toHaveCount(0);
    await expect(page.getByText("Toy Company KG")).toHaveCount(0);

    await expect(page.getByTestId("paper-explanation-triple")).toContainText(/chloroquine/i);
    await expect(page.getByTestId("paper-explanation-triple")).toContainText(/sars-cov-2/i);
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText("missing candidate");

    await expect(page.getByTestId("paper-cand-row-c1")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/of 6$/)).toBeVisible();

    await page.goto("/demo?paper=1");
    await expect(page).toHaveURL(/\/paper-demo$/);
  });

  test("loads paper layout, captions, and stage tabs without runtime clutter", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/paper-demo");

    await expect(page.getByTestId("paper-demo-data-badge")).toContainText(/COVID-Fact/i);
    await expect(page.getByText(/precomputed.*reproducible/i)).toBeVisible();
    await expect(page.getByTestId("paper-guided-story")).toContainText(/OMNIA proposes t4/i);
    await expect(page.getByTestId("paper-pipeline-strip")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Candidate Triples" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Graph Visualization" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Explanation & Validation" })).toBeVisible();
    await expect(page.getByTestId("paper-figure-captions")).toBeVisible();
    await expect(page.getByTestId("paper-figure-captions").getByText("Graph Visualization")).toBeVisible();
    await expect(page.getByTestId("paper-figure-captions").getByText("Candidate Panel")).toBeVisible();
    await expect(page.getByTestId("paper-figure-captions").getByText(/Explanation & Validation Panel/)).toBeVisible();

    await expect(page.getByText("Explainability Log")).toHaveCount(0);
    await expect(page.getByText(/Ollama/i)).toHaveCount(0);
    await expect(page.getByText(/API status/i)).toHaveCount(0);

    const { maxScrollWidth, clientWidth } = await page.evaluate(() => ({
      maxScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(maxScrollWidth).toBeLessThanOrEqual(clientWidth + 8);
  });

  test("defaults to candidate c1 (chloroquine treats sars-cov-2) synced across panels", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/paper-demo");

    const c1 = page.getByTestId("paper-cand-row-c1");
    await expect(c1).toHaveAttribute("aria-selected", "true");
    const expl = page.getByTestId("paper-explanation-panel");
    await expect(page.getByTestId("paper-explanation-triple")).toContainText(/chloroquine/i);
    await expect(page.getByTestId("paper-explanation-triple")).toContainText(/treats/i);
    await expect(page.getByTestId("paper-explanation-triple")).toContainText(/sars-cov-2/i);
    await expect(expl.getByText("Structural Score:")).toBeVisible();
    await expect(expl.getByText("0.90").first()).toBeVisible();
    await expect(expl.getByText("0.42").first()).toBeVisible();
    await expect(expl.getByText("0.80").first()).toBeVisible();
    await expect(expl.getByText(/Curator decision:/)).toBeVisible();
    await expect(expl.getByText(/pending/).first()).toBeVisible();
  });

  test("non-main candidate disables Accept/Reject and does not advance graph on click", async ({ page }) => {
    await page.goto("/paper-demo");

    await page.getByTestId("paper-cand-row-c6").click();
    await expect(page.getByTestId("paper-main-example-banner")).toBeVisible();
    await expect(page.getByTestId("paper-main-example-banner")).toContainText(/main COVID running example only/i);

    await expect(page.getByTestId("paper-accept-btn")).toBeDisabled();
    await expect(page.getByTestId("paper-reject-btn")).toBeDisabled();

    await page.getByTestId("paper-accept-btn").click({ force: true });
    await expect(page.getByTestId("paper-tab-after")).not.toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "missing");
  });

  test("Return to main selects c1 and Missing Triple stage", async ({ page }) => {
    await page.goto("/paper-demo");

    await page.getByTestId("paper-tab-after").click();
    await expect(page.getByTestId("paper-tab-after")).toHaveAttribute("aria-selected", "true");

    await page.getByTestId("paper-cand-row-c6").click();
    await page.getByTestId("paper-return-main-example").click();
    await expect(page.getByTestId("paper-cand-row-c1")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("paper-explanation-triple")).toContainText(/chloroquine/i);
    await expect(page.getByTestId("paper-main-example-banner")).toHaveCount(0);
    await expect(page.getByTestId("paper-tab-missing")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "missing");
  });

  test("stage tabs update graph data-step and annotations", async ({ page }) => {
    await page.goto("/paper-demo");

    await page.getByTestId("paper-tab-before").click();
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "before");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText("Input KG before OMNIA completion");

    await page.getByTestId("paper-tab-missing").click();
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "missing");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText("missing candidate");

    await page.getByTestId("paper-tab-after").click();
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "after");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText("accepted relation");
  });

  test("Accept on c1 switches to After KG and confirms t4 integration", async ({ page }) => {
    await page.goto("/paper-demo");
    await expect(page.getByTestId("paper-cand-row-c1")).toHaveAttribute("aria-selected", "true");

    await page.getByTestId("paper-accept-btn").click();

    await expect(page.getByTestId("paper-tab-after")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "after");
    await expect(page.getByTestId("paper-explanation-panel")).toContainText(
      "Accepted: t4 has been integrated into the completed KG.",
    );
    await expect(page.getByTestId("paper-explanation-panel")).toContainText(/Curator decision:/);
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText(
      "t4 integrated as an accepted relation in the completed KG",
    );
  });

  test("deep link ?stage=cluster opens cluster stage", async ({ page }) => {
    await page.goto("/paper-demo?stage=cluster");
    await expect(page.getByTestId("paper-tab-cluster")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "cluster");
  });

  test("capture mode hides Paper screenshot mode control", async ({ page }) => {
    await page.goto("/paper-demo?capture=1&stage=missing");
    await expect(page.getByTestId("paper-screenshot-mode-btn")).toHaveCount(0);
    await expect(page.getByTestId("paper-demo-script-checklist")).toHaveCount(0);
  });

  test("no horizontal overflow at common viewports", async ({ page }) => {
    const sizes: [number, number][] = [
      [1366, 768],
      [1280, 720],
      [1024, 768],
      [390, 844],
    ];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/paper-demo");
      const { maxScrollWidth, clientWidth } = await page.evaluate(() => ({
        maxScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(maxScrollWidth, `overflow at ${w}x${h}`).toBeLessThanOrEqual(clientWidth + 8);
    }
  });
});
