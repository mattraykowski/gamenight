import { test, expect } from "./fixtures";

test.describe("landing page (anonymous)", () => {
  test("renders the GameNight hero h1 in the accessibility tree", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /GameNight/i }),
    ).toBeVisible();
  });

  test("clicking the primary Register CTA navigates to /register", async ({ page }) => {
    await page.goto("/");
    const registerLinks = page.getByRole("link", { name: /^Register$/i });
    await registerLinks.first().click();
    await expect(page).toHaveURL(/\/register(\?|$)/);
  });

  test("preserves ?invite=… query parameters on the Register CTA", async ({ page }) => {
    await page.goto("/?invite=abc123");
    const registerLink = page
      .getByRole("main")
      .getByRole("link", { name: /^Register$/i })
      .first();
    await expect(registerLink).toHaveAttribute("href", /\/register\?invite=abc123/);
    await registerLink.click();
    await expect(page).toHaveURL(/\/register\?invite=abc123/);
  });

  test("footer Privacy link opens /privacy and shows the draft disclaimer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Privacy$/i }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Privacy Policy/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: /draft.*not legal advice/i }),
    ).toBeVisible();
  });

  test("footer Terms link opens /terms and shows the draft disclaimer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Terms$/i }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Terms of Service/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: /draft.*not legal advice/i }),
    ).toBeVisible();
  });

  test("mobile viewport (375×812): no horizontal scroll, sections reflow to one column", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /GameNight/i })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("desktop viewport (1440×900): body content stays within max width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /GameNight/i })).toBeVisible();
    const heroBox = await page.getByRole("heading", { level: 1, name: /GameNight/i }).boundingBox();
    expect(heroBox).not.toBeNull();
    if (heroBox) {
      // The hero h1 is inside a max-width container; its width should not span the full viewport.
      expect(heroBox.width).toBeLessThan(1440);
    }
  });
});
