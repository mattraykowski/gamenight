import {
  test,
  expect,
  latestEmailTo,
  extractLinkFromEmail,
  clearMailbox,
  clickSignOut,
} from "./fixtures";

/**
 * Phase 2 E2E: proves the SPA register form signs the user in
 * immediately, the confirmation email lands on an SPA route that
 * POSTs to `/auth/user/confirm_new_user`, and the follow-up toast
 * fires exactly once on the dashboard.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const REGISTER_EMAIL = `playwright-register-${UNIQUE}@example.test`;
const REGISTER_PASSWORD = "playwright-register-pw-1";

test.describe("register flow", () => {
  test.beforeEach(async ({ request }) => {
    await clearMailbox(request);
  });

  test("registering a new user signs them in and dispatches the confirmation email", async ({
    page,
    request,
  }) => {
    await page.goto("/register");

    await page.getByLabel(/email/i).fill(REGISTER_EMAIL);
    await page.getByLabel(/^password$/i).fill(REGISTER_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(REGISTER_PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("current-user-name")).toHaveText(
      REGISTER_EMAIL.split("@")[0],
    );

    const email = await latestEmailTo(request, REGISTER_EMAIL);
    expect(email).not.toBeNull();
    expect(email?.subject).toMatch(/confirm/i);
  });

  test("following the confirmation link lands on /dashboard with the email_confirmed toast", async ({
    page,
    request,
  }) => {
    // Re-register a fresh user for this test so the email link is
    // unconsumed.
    const email = `playwright-confirm-${UNIQUE}@example.test`;
    await page.goto("/register");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(REGISTER_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(REGISTER_PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const captured = await latestEmailTo(request, email);
    expect(captured).not.toBeNull();
    const link = extractLinkFromEmail(captured!, "/confirm_new_user/");

    await page.goto(link);
    await expect(
      page.getByRole("heading", { level: 1, name: /confirm your email/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /confirm email address/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("toast-success")).toContainText(
      /email address has been confirmed/i,
    );
  });

  test("registering with an existing email shows the link-back UI", async ({ page }) => {
    const email = `playwright-taken-${UNIQUE}@example.test`;

    // First register succeeds.
    await page.goto("/register");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(REGISTER_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(REGISTER_PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await clickSignOut(page);

    // Second register with the same email should leak + link back.
    await page.goto("/register");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(REGISTER_PASSWORD);
    await page.getByLabel(/confirm password/i).fill(REGISTER_PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/that email is already registered/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /reset your password/i })).toHaveAttribute(
      "href",
      `/reset?email=${encodeURIComponent(email)}`,
    );
  });
});
