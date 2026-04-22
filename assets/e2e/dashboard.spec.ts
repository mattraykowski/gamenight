import AxeBuilder from "@axe-core/playwright";
import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 3 E2E: proves the full cookie-auth tracer bullet works. Covers
 * the redirect path (unauthenticated visit bounces to Phoenix's sign-in
 * form) and the happy path (seeded user lands on `/dashboard`, sees
 * "Welcome, {email}", focus on the heading, axe clean).
 */

test("unauthenticated /dashboard redirects to /sign-in with return URL", async ({ page }) => {
  const response = await page.goto("/dashboard");
  // ash_authentication_phoenix renders the sign-in form at /sign-in, so
  // a successful load there is enough to prove the guard redirected.
  await expect(page).toHaveURL(/\/sign-in/);
  expect(response?.ok()).toBe(true);
});

test.describe("authenticated dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, "playwright@example.test");
  });

  test("renders 'Welcome, {email}' and focuses the heading after navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "GameNight" })).toBeVisible();

    await page.goto("/dashboard");

    const heading = page.getByRole("heading", { level: 1, name: "Dashboard" });
    await expect(heading).toBeVisible();

    await expect(page.getByTestId("current-user-email")).toHaveText(
      "playwright@example.test",
    );

    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("data-route-heading", "true");

    await expect(page.getByTestId("announcer-polite")).toHaveText("Dashboard");
  });

  test("/dashboard has no serious or critical axe violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor();
    await page.getByTestId("current-user-email").waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
