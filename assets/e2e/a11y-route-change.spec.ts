import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Route-change accessibility (Principle IV)", () => {
  test("moves focus to the destination page's h1 on SPA navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "GameNight" })).toBeVisible();

    await page.getByRole("link", { name: "About" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "About GameNight" })).toBeVisible();

    // Principle IV: focus MUST move to the destination page's primary heading.
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("data-route-heading", "true");
    await expect(focused).toContainText("About GameNight");
  });

  test("announces the destination heading text via the polite live region", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).click();

    const politeRegion = page.getByTestId("announcer-polite");
    await expect(politeRegion).toHaveText("About GameNight");
  });

  test("/ has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1, name: "GameNight" }).waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking).toEqual([]);
  });

  test("/about has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("heading", { level: 1, name: "About GameNight" }).waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking).toEqual([]);
  });
});
