import { test, expect } from "./fixtures";

/**
 * Phase 1 E2E: proves that the SPA-owned sign-in page lets a known
 * user sign in with email + password, lands them on `/dashboard`, and
 * that an already-authenticated visit to `/sign-in` bounces to the
 * redirect target without re-prompting.
 *
 * The `/test/sign-in-as` fixture seeds a user with the default
 * password `playwright-password-1` the first time it runs; subsequent
 * tests just re-sign-in that user via the normal sign-in form.
 */

const TEST_EMAIL = "playwright-sign-in@example.test";
const TEST_PASSWORD = "playwright-password-1";

test.describe("password sign-in", () => {
  test.beforeAll(async ({ request }) => {
    // Seed the user through /test/sign-in-as (which registers via
    // Ash's register_with_password action, matching the real sign-up
    // flow).
    const response = await request.post("/test/sign-in-as", {
      data: { email: TEST_EMAIL },
      headers: { "content-type": "application/json" },
    });
    if (!response.ok()) {
      throw new Error(`seed failed: ${response.status()} ${await response.text()}`);
    }
  });

  test("unauthenticated visit to /sign-in shows the SPA form", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { level: 1, name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel(/keep me signed in/i)).toBeVisible();
  });

  test("wrong password surfaces the inline error without navigating", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByTestId("auth-form-error")).toContainText(
      /incorrect email or password/i,
    );
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("correct credentials land on /dashboard with the expected email", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: /dashboard/i })).toBeVisible();
    await expect(page.getByTestId("current-user-email")).toHaveText(TEST_EMAIL);
  });

  test("an already-authenticated visit to /sign-in redirects to the redirect target", async ({
    page,
  }) => {
    // Authenticate via the form first.
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Now revisit /sign-in with a redirect — should bounce to the
    // target without re-prompting.
    await page.goto("/sign-in?redirect=%2Fdashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
