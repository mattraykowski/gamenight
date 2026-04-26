import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 3 (US1) E2E: a GM signs in, sees the empty state on the
 * dashboard, clicks through to the create form, submits valid
 * values, and returns to the dashboard with the new game visible in
 * "My Active Games".
 *
 * Also timed (SC-001): the elapsed interactive time from dashboard
 * ready → row visible must stay under 30 seconds as a regression
 * cap. The product SLA is under 60s; 30s is an internal safety
 * margin.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const REGISTER_EMAIL = `playwright-games-${UNIQUE}@example.test`;

test.describe("register game", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, REGISTER_EMAIL);
  });

  test("empty dashboard invites the GM to register their first game", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 1, name: /dashboard/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /my active games/i }),
    ).toBeVisible();
    await expect(page.getByTestId("games-empty-no-games")).toBeVisible();
  });

  test("registering a new Active game lands it on the dashboard under the 60s SLA", async ({
    page,
  }) => {
    const start = Date.now();

    await page.goto("/dashboard");
    await expect(page.getByTestId("games-empty-no-games")).toBeVisible();

    await page.getByTestId("dashboard-create-game").click();
    await expect(
      page.getByRole("heading", { level: 1, name: /register a new game/i }),
    ).toBeVisible();

    const title = `Curse of Strahd ${UNIQUE}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Gothic horror campaign.");
    // Status defaults to Active — no need to change it.
    await page.getByRole("button", { name: /register game/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(title)).toBeVisible();

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(30_000);
  });
});
