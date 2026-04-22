import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Phase 2 focus/announce coverage survives Phase 3's removal of the
 * `/about` route by asserting the mechanism against `/` (the only
 * always-public SPA route). The authenticated route-change transition
 * to `/dashboard` is covered in `dashboard.spec.ts`.
 */
test.describe("Route-change accessibility (Principle IV)", () => {
  test("/ has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1, name: "GameNight" }).waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("the landing page exposes the data-route-heading contract", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1, name: "GameNight" });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAttribute("data-route-heading", "true");
  });
});
