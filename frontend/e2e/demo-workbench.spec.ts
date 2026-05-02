import { expect, test, type Page, type Route } from "@playwright/test";

const PERSIST_KEY = "omnia-demo-store";

const SAMPLE_SESSION = {
  session_id: "test-session",
  dataset_name: "Demo CoDEx-M",
  source_type: "benchmark",
  holdout_mode: true,
  sample_proportion: 0.8,
  diagnostics: { triple_count: 8, missing_triples: 2 },
  warnings: [],
  steps: [],
  created_at: "2026-05-01T00:00:00",
  updated_at: "2026-05-01T00:00:00",
};

const SAMPLE_TRIPLES = [
  { Head: "Alice", Relation: "worksAt", Tail: "OmniaLab" },
  { Head: "Bob", Relation: "worksAt", Tail: "OmniaLab" },
  { Head: "Carla", Relation: "worksAt", Tail: "OmniaLab" },
  { Head: "Alice", Relation: "researches", Tail: "GraphCompletion" },
  { Head: "Bob", Relation: "researches", Tail: "GraphCompletion" },
  { Head: "Carla", Relation: "usesTool", Tail: "Ollama" },
  { Head: "Alice", Relation: "usesTool", Tail: "Ollama" },
];

const CANDIDATES = [
  {
    Head: "Carla",
    Relation: "researches",
    Tail: "GraphCompletion",
    DisplayHead: "Carla",
    DisplayRelation: "researches",
    DisplayTail: "GraphCompletion",
    status: "filtered_passed",
    Missing: 1,
    distance: 0.42,
    threshold: 0.8,
    filter_decision: "passed",
    cluster_ids: ["c1"],
    cluster_keys: ["researches\tGraphCompletion"],
    source_heads: ["Alice", "Bob"],
    rationale: "Heads Alice and Bob co-occur on (researches, GraphCompletion).",
    parsed_score: 0.82,
    decision: "accepted",
    prompt: "Is the triple plausible?",
    raw_response: "Yes",
    retrieved_context: ["Carla works in OmniaLab where graph completion research happens."],
    sentence_text: "Carla researches graph completion.",
    is_mock: true,
  },
  {
    Head: "Bob",
    Relation: "usesTool",
    Tail: "Ollama",
    DisplayHead: "Bob",
    DisplayRelation: "usesTool",
    DisplayTail: "Ollama",
    status: "filtered_passed",
    Missing: 0,
    distance: 0.55,
    threshold: 0.8,
    filter_decision: "passed",
    cluster_ids: ["c2"],
    cluster_keys: ["usesTool\tOllama"],
    source_heads: ["Alice", "Carla"],
    parsed_score: 0.41,
    decision: "rejected",
    prompt: "Is the triple plausible?",
    raw_response: "No",
    retrieved_context: ["Bob's research stack does not mention Ollama."],
    sentence_text: "Bob uses Ollama.",
    is_mock: true,
  },
  {
    Head: "Faris",
    Relation: "studiesAt",
    Tail: "DataCampus",
    DisplayHead: "Faris",
    DisplayRelation: "studiesAt",
    DisplayTail: "DataCampus",
    status: "filtered_rejected",
    distance: 1.12,
    threshold: 0.8,
    filter_decision: "rejected",
    cluster_ids: [],
    cluster_keys: [],
    source_heads: [],
    decision: "unresolved",
    is_mock: true,
  },
];

const COMPLETED = {
  summary: {
    known_triples: SAMPLE_TRIPLES.length,
    completed_triples: SAMPLE_TRIPLES.length + 1,
    accepted_additions: 1,
    rejected_candidates: 1,
    unresolved_candidates: 1,
    recovered_true_missing: 1,
    threshold: 0.8,
  },
  additions: [CANDIDATES[0]],
  rejected: [CANDIDATES[1]],
  unresolved: [CANDIDATES[2]],
  original_graph: { triples: SAMPLE_TRIPLES },
  completed_graph: { triples: [...SAMPLE_TRIPLES, CANDIDATES[0]] },
};

const CLUSTERS = {
  clusters: [
    {
      cluster_id: "c1",
      cluster_key: "researches\tGraphCompletion",
      cluster_key_display: "researches → GraphCompletion",
      relation: "researches",
      tail: "GraphCompletion",
      heads: ["Alice", "Bob"],
      display_heads: ["Alice", "Bob"],
      display_relation: "researches",
      display_tail: "GraphCompletion",
      size: 2,
      source_triple_count: 2,
      member_triple_count: 4,
    },
    {
      cluster_id: "c2",
      cluster_key: "usesTool\tOllama",
      cluster_key_display: "usesTool → Ollama",
      relation: "usesTool",
      tail: "Ollama",
      heads: ["Alice", "Carla"],
      display_heads: ["Alice", "Carla"],
      display_relation: "usesTool",
      display_tail: "Ollama",
      size: 2,
      source_triple_count: 2,
      member_triple_count: 3,
    },
  ],
  summary: { total_clusters: 2 },
};

async function seedSession(page: Page) {
  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            session: payload.session,
            logs: [],
            guidedStep: 0,
            demoConfig: {
              format: "triples",
              strategy: "rag",
              topK: 2,
              maxCandidates: 24,
              filteringEnabled: true,
              forceMock: true,
              preferredDevice: "cuda",
            },
          },
          version: 0,
        }),
      );
    },
    { key: PERSIST_KEY, payload: { session: SAMPLE_SESSION } },
  );
}

async function stubDemoApi(page: Page) {
  const handle = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/sessions/test-session/candidates", (route) =>
    handle(route, {
      candidates: CANDIDATES,
      summary: { generated_count: CANDIDATES.length },
    }),
  );
  await page.route("**/api/sessions/test-session/completed", (route) => handle(route, COMPLETED));
  await page.route("**/api/sessions/test-session/clusters", (route) => handle(route, CLUSTERS));
  await page.route("**/api/sessions/test-session/logs", (route) => handle(route, { logs: [] }));
  await page.route("**/api/sessions/test-session/demo/refinement", (route) =>
    handle(route, { status: "ok", total_refinements: 1 }),
  );
  await page.route("**/api/sessions/test-session/pipeline/run**", (route) =>
    handle(route, { steps: [], summary: COMPLETED.summary }),
  );
}

test.describe("/demo paper workbench", () => {
  test("loads without horizontal overflow when no session (1366×768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "OMNIA paper demo" })).toBeVisible();

    const { maxScrollWidth, clientWidth } = await page.evaluate(() => ({
      maxScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(maxScrollWidth).toBeLessThanOrEqual(clientWidth + 8);
  });

  test("paper toggle is reachable in both no-session and session states", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("link", { name: /Paper \/ screenshot layout/i })).toBeVisible();
    await page.getByRole("link", { name: /Paper \/ screenshot layout/i }).click();
    await expect(page).toHaveURL(/\/paper-demo$/);
    await expect(page.getByTestId("paper-demo-root")).toBeVisible();
    await expect(page.getByRole("link", { name: /Standard demo chrome/i })).toBeVisible();
  });
});

test.describe("/demo populated workbench", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await stubDemoApi(page);
  });

  test("shell renders the four named layout slots without overflow at 1366×768", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/demo");
    await expect(page.getByTestId("demo-shell-metrics")).toBeVisible();
    await expect(page.getByTestId("demo-shell-steps")).toBeVisible();
    await expect(page.getByTestId("demo-shell-graph")).toBeVisible();
    await expect(page.getByTestId("demo-shell-explanation")).toBeVisible();

    const { maxScrollWidth, clientWidth } = await page.evaluate(() => ({
      maxScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(maxScrollWidth).toBeLessThanOrEqual(clientWidth + 8);
  });

  test("selecting a candidate updates explanation panel and search filters the queue", async ({
    page,
  }) => {
    await page.goto("/demo");

    const rows = page.getByTestId("demo-candidate-row");
    await expect(rows.first()).toBeVisible();
    await rows.nth(1).click();

    const explanationCandidate = page.getByTestId("demo-explanation-candidate");
    await expect(explanationCandidate).toContainText("Bob");
    await expect(explanationCandidate).toContainText("usesTool");
    await expect(explanationCandidate).toContainText("Ollama");
    await expect(page.getByTestId("demo-explanation-decision")).toHaveText("rejected");

    await page.getByRole("searchbox", { name: /Search candidate triples/i }).fill("studiesAt");
    await expect(page.getByTestId("demo-candidate-row")).toHaveCount(1);
  });

  test("status filter narrows queue to a single dominant decision", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("tab", { name: "Rejected" }).click();
    const rows = page.getByTestId("demo-candidate-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-status", "llm_rejected");
  });

  test("workbench tabs swap content between Missing → Filter → After → Diff", async ({ page }) => {
    await page.goto("/demo");

    const tabs = page.getByRole("tablist", { name: "Graph workbench view" });
    await tabs.getByRole("tab", { name: "Missing" }).click();
    await expect(page.getByTestId("demo-missing-view")).toBeVisible();

    await tabs.getByRole("tab", { name: "Filtering" }).click();
    await expect(page.getByTestId("demo-filtering-histogram")).toBeVisible();

    await tabs.getByRole("tab", { name: "After KG" }).click();
    await expect(
      page.getByTestId("demo-shell-graph").getByText("Accepted", { exact: false }).first(),
    ).toBeVisible();

    await tabs.getByRole("tab", { name: "Diff" }).click();
    const compare = page.getByTestId("demo-diff-compare");
    await expect(compare).toBeVisible();
    await expect(compare.getByText("Before KG", { exact: true })).toBeVisible();
    await expect(compare.getByText("After KG", { exact: false }).first()).toBeVisible();
  });

  test("paper layout link opens standalone paper-demo route", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator("div[data-paper-mode='off'].min-h-screen").first()).toBeVisible();
    await page.getByRole("link", { name: /Paper \/ screenshot layout/i }).click();
    await expect(page).toHaveURL(/\/paper-demo$/);
    await expect(page.getByTestId("paper-demo-root")).toBeVisible();
  });

  test("mobile layout (≤768px) stacks the rail, graph, and panels vertically", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 414, height: 900 });
    await page.goto("/demo");

    const stepsBox = await page.getByTestId("demo-shell-steps").boundingBox();
    const graphBox = await page.getByTestId("demo-shell-graph").boundingBox();
    const explanationBox = await page.getByTestId("demo-shell-explanation").boundingBox();
    expect(stepsBox && graphBox && explanationBox).toBeTruthy();
    if (stepsBox && graphBox && explanationBox) {
      expect(graphBox.y).toBeGreaterThanOrEqual(stepsBox.y + stepsBox.height - 4);
      expect(explanationBox.y).toBeGreaterThanOrEqual(graphBox.y + graphBox.height - 4);
    }
  });

  test("teacher-mockup elements render: combined score, verdict, evidence, A/B/C strip", async ({
    page,
  }) => {
    await page.goto("/demo");
    await expect(page.getByTestId("demo-candidate-combined-score").first()).toBeVisible();
    await expect(page.getByTestId("demo-explanation-verdict")).toBeVisible();
    await expect(page.getByTestId("demo-explanation-evidence")).toBeVisible();
    await expect(page.getByTestId("demo-footer-captions")).toBeVisible();
    await expect(page.getByTestId("demo-candidate-pagination")).toContainText("of 3");
    await expect(page.getByLabel("Sort candidates")).toBeVisible();
  });

  test("accept button posts a refinement decision", async ({ page }) => {
    let capturedDecision: string | null = null;
    await page.route("**/api/sessions/test-session/demo/refinement", async (route) => {
      const post = route.request().postDataJSON();
      capturedDecision = (post as { decision?: string })?.decision ?? null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", total_refinements: 1 }),
      });
    });
    await page.goto("/demo");
    await page
      .getByRole("button", { name: /Accept suggested triple into completed graph/i })
      .click();
    await expect.poll(() => capturedDecision).toBe("accept");
  });
});
