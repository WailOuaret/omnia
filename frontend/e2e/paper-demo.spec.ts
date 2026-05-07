import { expect, test } from "@playwright/test";

test.describe("/paper-demo", () => {
  test("direct route and stage query work", async ({ page }) => {
    await page.goto("/paper-demo?stage=filtering");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "filtering");
    await page.goto("/paper-demo?stage=cluster");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toHaveAttribute("data-step", "cluster");
  });

  test("c1 accept flow requires validation", async ({ page }) => {
    await page.goto("/paper-demo?stage=llm");
    // Candidate is c1 by default; local validation resets on candidate change, but not on stage change.
    await page.getByRole("button", { name: /Proceed to Semantic Validation/ }).click();

    // Decision buttons must stay blocked until both evidence judgement + quality category are selected.
    await expect(page.getByRole("button", { name: /Proceed to Your Decision/ })).toBeDisabled();

    await page.getByRole("button", { name: "Supports" }).click();
    await page.getByLabel("Missing but supported by source").check();

    await expect(page.getByRole("button", { name: /Proceed to Your Decision/ })).toBeEnabled();
    await page.getByRole("button", { name: /Proceed to Your Decision/ }).click();
    await page.getByRole("button", { name: "✓ Accept triple" }).click();
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText("ACCEPTED +1");
  });

  test("c2 reject flow and radio quality single-choice", async ({ page }) => {
    await page.goto("/paper-demo?stage=llm");
    await page.getByTestId("paper-cand-row-c2").click();
    await page.getByRole("button", { name: /Proceed to Semantic Validation/ }).click();

    await page.getByRole("button", { name: "Contradicts" }).click();
    await page.getByLabel("Incorrect relation").check();
    await expect(page.getByLabel("Correct triple")).not.toBeChecked();
    await page.getByPlaceholder("Corrected relation").fill("affects");
    await page.getByRole("button", { name: /Proceed to Your Decision/ }).click();
    await page.getByRole("button", { name: "✗ Reject triple" }).click();
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toContainText("REJECTED · not added");
  });

  test("validation blocking resets on candidate switch", async ({ page }) => {
    await page.goto("/paper-demo?stage=llm");
    await page.getByRole("button", { name: /Proceed to Semantic Validation/ }).click();
    await expect(page.getByRole("button", { name: /Proceed to Your Decision/ })).toBeDisabled();
    await page.getByRole("button", { name: "Supports" }).click();
    await expect(page.getByRole("button", { name: /Proceed to Your Decision/ })).toBeDisabled();
    await page.getByLabel("Correct triple").check();
    await expect(page.getByRole("button", { name: /Proceed to Your Decision/ })).toBeEnabled();
    await page.getByTestId("paper-cand-row-c2").click();
    await expect(page.getByRole("button", { name: /Proceed to Your Decision/ })).toBeDisabled();
  });

  test("stage detail panel appears for direct route", async ({ page }) => {
    await page.goto("/paper-demo?stage=filtering");
    await expect(page.getByTestId("paper-step-detail")).toContainText("Embedding-based filtering");
    await expect(page.getByTestId("paper-step-detail")).toContainText("71.08%");
  });

  test("mobile viewport and screenshot mode", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/paper-demo?capture=1&stage=after");
    await expect(page.locator('[data-testid="paper-demo-graph-svg"]')).toBeVisible();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 6);
    expect(hasOverflow).toBeFalsy();
  });
});
