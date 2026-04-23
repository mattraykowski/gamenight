import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 1 E2E: proves sign-out clears the session cookie client-side
 * and that a subsequent authenticated-only request is rejected.
 */

test.describe("sign-out", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, "playwright-sign-out@example.test");
  });

  test("clicking sign out returns the user to the home route unauthenticated", async ({
    page,
    request,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: /dashboard/i })).toBeVisible();

    await page.getByTestId("sign-out-button").click();

    // Landing page after sign-out is `/`.
    await expect(page).toHaveURL(/\/$/);

    // `/rpc/run` now requires a fresh sign-in — the session cookie
    // should have been cleared. Using page.request shares the browser
    // context's cookies, so a 401 proves the session is gone.
    const response = await page.request.post("/rpc/run", {
      data: { action: "read_current_user", fields: ["id"] },
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    expect(response.status()).not.toBe(200);
  });

  test("visiting /dashboard after sign-out bounces back to /sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("sign-out-button").click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
