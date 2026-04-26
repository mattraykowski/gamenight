import {
  test,
  expect,
  latestEmailTo,
  extractLinkFromEmail,
  clearMailbox,
  clickSignOut,
} from "./fixtures";

/**
 * Phase 3 E2E: request → email captured → click link → submit new
 * password → land on /dashboard with the password_reset toast.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const RESET_EMAIL = `playwright-reset-${UNIQUE}@example.test`;
const INITIAL_PASSWORD = "playwright-initial-pw";
const NEW_PASSWORD = "playwright-new-pw-1";

test.describe("password reset flow", () => {
  test.beforeAll(async ({ request }) => {
    // Seed a user so the reset email actually goes out.
    await request.post("/test/sign-in-as", {
      data: { email: RESET_EMAIL },
      headers: { "content-type": "application/json" },
    });
  });

  test.beforeEach(async ({ request }) => {
    await clearMailbox(request);
  });

  test("unknown email shows the ambiguous confirmation (enumeration hidden)", async ({ page }) => {
    await page.goto("/reset");
    await page.getByLabel(/email/i).fill(`absent-${UNIQUE}@example.test`);
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /check your email/i })).toBeVisible();
  });

  test("full happy path: request → email → click link → new password → dashboard", async ({
    page,
    request,
  }) => {
    await page.goto("/reset");
    await page.getByLabel(/email/i).fill(RESET_EMAIL);
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /check your email/i })).toBeVisible();

    const email = await latestEmailTo(request, RESET_EMAIL);
    expect(email).not.toBeNull();
    const link = extractLinkFromEmail(email!, "/password-reset/");

    await page.goto(link);
    await expect(
      page.getByRole("heading", { level: 1, name: /choose a new password/i }),
    ).toBeVisible();

    await page.getByLabel(/^new password$/i).fill(NEW_PASSWORD);
    await page.getByLabel(/confirm new password/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("toast-success")).toContainText(
      /password has been reset/i,
    );

    // Sign out and confirm the new password works for sign-in.
    await clickSignOut(page);
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(RESET_EMAIL);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
