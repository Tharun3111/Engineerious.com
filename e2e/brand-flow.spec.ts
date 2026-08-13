import { expect, test } from "@playwright/test";

test("visitor-first public shell explains the value and exposes its core sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Engineerious" }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Turn AI releases into engineering decisions.",
    }),
  ).toBeVisible();
  await expect(page.getByText("AI news, model analysis, and production guides", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Read AI news" }).first()).toBeVisible();
  await expect(page.getByText("Finished analysis moves to the engineering blog after review.")).toBeVisible();
  await expect(page.getByRole("link", { name: "AI news", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Models", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Blog", exact: true }).first()).toBeVisible();

  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Turning AI engineering work into useful public knowledge.",
  );
});

test("news, models, and blog are distinct public endpoints", async ({ page }) => {
  const endpoints = [
    ["/news", "AI news for engineering decisions."],
    ["/models", "Model updates compared for real-world use."],
    ["/blog", "Practical guides for building reliable AI systems."],
  ] as const;

  for (const [path, heading] of endpoints) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('[data-feed-state="error"]')).toHaveCount(0);
  }
});

test("open-source, resources, and submit are live once PUBLIC_RESEARCH_ENABLED=true", async ({
  page,
  request,
}) => {
  const endpoints = [
    ["/open-source", "Open-source releases worth evaluating."],
    ["/resources", "Guides and templates for reliable AI systems"],
    ["/submit", "Suggest a link for review"],
  ] as const;

  for (const [path, heading] of endpoints) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["x-robots-tag"], path).toBeUndefined();

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
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
  await page.getByRole("button", { name: "Subscribe for updates" }).click();
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
  const submit = page.getByRole("button", { name: "Subscribe for updates" });
  await submit.click();
  await expect(page.getByRole("button", { name: "Subscribing…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(
    "You're subscribed. Check your inbox to confirm.",
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
  expect(requests).toBe(1);
});
