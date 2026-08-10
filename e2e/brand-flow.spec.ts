import { expect, test } from "@playwright/test";

test("creator-first public shell has no public research feed", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "I learn AI systems by building, testing, and explaining them.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Work with me" })).toBeVisible();
  await expect(page.getByText("The first field notes are under review.")).toBeVisible();
  await expect(page.getByRole("link", { name: "News", exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "About", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Learning how AI systems behave outside the demo.",
  );
});

test("deferred research surfaces return 404", async ({ request }) => {
  for (const path of ["/news", "/models", "/open-source", "/resources", "/submit"]) {
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
  await page.getByRole("button", { name: "Subscribe" }).click();
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
  const submit = page.getByRole("button", { name: "Subscribe" });
  await submit.click();
  await expect(page.getByRole("button", { name: "Subscribing…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(
    "Subscribed. Check your inbox for the confirmation.",
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
  expect(requests).toBe(1);
});
