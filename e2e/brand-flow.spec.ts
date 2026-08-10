import { expect, test } from "@playwright/test";

test("visitor-first public shell explains the value and exposes its core sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Engineerious" }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build AI systems that hold up outside the demo.",
    }),
  ).toBeVisible();
  await expect(page.getByText("For engineers and technical founders", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get the next field note" }).first()).toBeVisible();
  await expect(page.getByText("The first verified notes are under review.")).toBeVisible();
  await expect(page.getByRole("link", { name: "News", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Models", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Blog", exact: true }).first()).toBeVisible();

  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Learning how AI systems behave outside the demo.",
  );
});

test("news, models, and blog are distinct public endpoints", async ({ page }) => {
  const endpoints = [
    ["/news", "AI news, filtered for builders."],
    ["/models", "Model releases, translated into engineering impact."],
    ["/blog", "Deep dives from building and testing AI systems."],
  ] as const;

  for (const [path, heading] of endpoints) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('[data-feed-state="error"]')).toHaveCount(0);
  }
});

test("remaining deferred research surfaces return 404", async ({ request }) => {
  for (const path of ["/open-source", "/resources", "/submit"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
  }
});

test("newsletter error is truthful and recoverable", async ({ page }) => {
  await page.route("**/api/subscribe", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Newsletter is not connected yet." }),
    });
  });
  await page.goto("/subscribe");
  await page.getByLabel("Email address").fill("reader@example.com");
  await page.getByRole("button", { name: "Get the next note" }).click();
  await expect(page.getByRole("status")).toHaveText("Newsletter is not connected yet.");
  await expect(page.getByRole("status")).toHaveAttribute("data-subscribe-status", "error");
});

test("newsletter prevents duplicate submits while the provider is slow", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/subscribe", async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/subscribe");
  await page.getByLabel("Email address").fill("reader@example.com");
  const submit = page.getByRole("button", { name: "Get the next note" });
  await submit.click();
  await expect(page.getByRole("button", { name: "Subscribing…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(
    "Subscribed. Check your inbox for the confirmation.",
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
  expect(requests).toBe(1);
});
