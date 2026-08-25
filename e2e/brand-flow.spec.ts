import { expect, test } from "@playwright/test";

test("visitor-first public shell has a usable identity, primary navigation, and main heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Engineerious home" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("I build AI systems");
  await expect(page.getByText("Tharun Chowdary Malepati · AI / ML Engineer")).toBeVisible();
  await expect(page.getByRole("region", { name: "Engineerious evidence standard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the Daily Brief" })).toBeVisible();

  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tharun Chowdary Malepati");
});

test("phase-one destinations are honest, linked, and never thin-indexed", async ({ page, request }) => {
  for (const path of ["/daily", "/ai", "/projects", "/projects/engineerious"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }

  for (const path of ["/daily", "/ai"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  await page.goto("/projects/engineerious");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Engineerious");
  await expect(page.getByRole("heading", { name: "Engineering decisions" })).toBeVisible();
  await expect(page.getByText("In development").first()).toBeVisible();
});

test("the 320px shell uses an accessible menu without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);

  const menuButton = page.getByRole("button", { name: "Open menu" });
  const searchButton = page.getByRole("button", { name: /Search/ });
  await expect(menuButton).toBeVisible();
  await expect(searchButton).toBeVisible();

  for (const control of [menuButton, searchButton]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await menuButton.click();
  const mobileMenu = page.locator("#mobile-primary-menu");
  await expect(mobileMenu).toBeVisible();
  for (const label of ["Daily", "Writing", "AI", "Projects", "About", "Subscribe"]) {
    await expect(mobileMenu.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await expect(mobileMenu).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("unfinished research surfaces stay closed and non-indexable", async ({ request }) => {
  for (const path of ["/news", "/news/1", "/models", "/models/1", "/resources"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
  }

  const blog = await request.get("/blog");
  expect(blog.status()).toBe(200);
});

test("deferred research routes move together behind PUBLIC_RESEARCH_ENABLED", async ({
  page,
  request,
}) => {
  const endpoints = [
    ["/open-source", "Open-source releases worth evaluating."],
    ["/submit", "Suggest a link for review"],
    ["/pillars/eval-first", null],
  ] as const;

  const gateProbe = await request.get("/open-source");
  const expectedStatus = gateProbe.status();
  expect([200, 404]).toContain(expectedStatus);

  for (const [path, heading] of endpoints) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(expectedStatus);

    if (expectedStatus === 404) {
      expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    } else {
      expect(response.headers()["x-robots-tag"], path).toBeUndefined();
      await page.goto(path);
      const pageHeading = page.getByRole("heading", { level: 1 });
      if (heading) await expect(pageHeading).toHaveText(heading);
      else await expect(pageHeading).toBeVisible();
    }
  }
});

test("sitemap never advertises closed or utility routes", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const sitemap = await response.text();

  for (const path of ["/news", "/models", "/resources", "/submit", "/daily", "/ai"]) {
    expect(sitemap, path).not.toContain(path);
  }
  expect(sitemap).toContain("/projects/engineerious");
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
  let markRequestStarted!: () => void;
  let releaseResponse!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await page.route("**/api/subscribe", async (route) => {
    requests += 1;
    markRequestStarted();
    await responseGate;
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
  await requestStarted;
  await expect(page.getByRole("button", { name: "Subscribing…" })).toBeDisabled();
  releaseResponse();
  await expect(page.getByRole("status")).toHaveText(
    "You're subscribed. We'll email you when there's something worth sharing.",
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
  expect(requests).toBe(1);
});
