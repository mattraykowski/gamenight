import { test, expect, latestEmailTo, extractLinkFromEmail, clearMailbox } from "./fixtures";

/**
 * Phase 4 E2E: request → email captured → click link → confirm
 * informational banner visible → click button → /dashboard with the
 * signed_in toast.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const MAGIC_EMAIL = `playwright-magic-${UNIQUE}@example.test`;

test.describe("magic-link flow", () => {
  test.beforeEach(async ({ request }) => {
    await clearMailbox(request);
  });

  test("requesting a magic link for a new email sends the email and lands on confirmation", async ({
    page,
    request,
  }) => {
    await page.goto("/magic-link");
    await page.getByLabel(/email/i).fill(MAGIC_EMAIL);
    await page.getByRole("button", { name: /send sign-in link/i }).click();

    await expect(page.getByRole("heading", { level: 1, name: /check your email/i })).toBeVisible();

    const email = await latestEmailTo(request, MAGIC_EMAIL);
    expect(email).not.toBeNull();
    expect(email?.subject).toMatch(/login link/i);
  });

  test("following the magic link signs the user in", async ({ page, request }) => {
    const email = `playwright-magic-signin-${UNIQUE}@example.test`;

    await page.goto("/magic-link");
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole("button", { name: /send sign-in link/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /check your email/i })).toBeVisible();

    const captured = await latestEmailTo(request, email);
    expect(captured).not.toBeNull();
    const link = extractLinkFromEmail(captured!, "/magic_link/");

    await page.goto(link);
    await expect(
      page.getByRole("heading", { level: 1, name: /sign in to game night/i }),
    ).toBeVisible();
    await expect(page.getByTestId("magic-link-banner")).toContainText(email);

    await page.getByRole("button", { name: /sign in to game night/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("current-user-email")).toHaveText(email);
    await expect(page.getByTestId("toast-success")).toContainText(/welcome back/i);
  });
});
