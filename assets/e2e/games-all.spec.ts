import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 7 (US5) E2E: the GM clicks "View All Games" from the
 * dashboard and sees every game they own regardless of status,
 * including games that were filtered out of "My Active Games".
 * Deletion from an all-games row works the same way as from the
 * dashboard.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const EMAIL = `playwright-games-all-${UNIQUE}@example.test`;

test.describe("view all games", () => {
  test("navigating via dashboard link shows games in all statuses", async ({ page }) => {
    await signInAs(page, EMAIL);

    // Register two games and mark one as Paused so the dashboard
    // filter excludes it.
    await page.goto("/games/new");
    const activeTitle = `Active Game ${UNIQUE}`;
    await page.getByLabel("Title").fill(activeTitle);
    await page.getByRole("button", { name: /register game/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/games/new");
    const pausedTitle = `Paused Game ${UNIQUE}`;
    await page.getByLabel("Title").fill(pausedTitle);
    await page.getByLabel("Description").fill("Will be paused.");
    await page.getByRole("button", { name: /register game/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Pause the second game.
    await page.goto("/dashboard");
    const pausedRow = page.locator("tr", { hasText: pausedTitle });
    await pausedRow.getByRole("link", { name: /^view$/i }).click();
    await page.getByRole("link", { name: /^edit$/i }).click();
    await page.getByRole("combobox", { name: /status/i }).click();
    await page.getByRole("option", { name: "Paused" }).click();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page).toHaveURL(/\/games\/[0-9a-f-]+$/);

    // Dashboard only shows the Active game.
    await page.goto("/dashboard");
    await expect(page.getByText(activeTitle)).toBeVisible();
    await expect(page.getByText(pausedTitle)).toHaveCount(0);

    // All Games shows both.
    await page.getByTestId("dashboard-view-all-games").click();
    await expect(page).toHaveURL(/\/games\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: /all games/i })).toBeVisible();
    await expect(page.getByText(activeTitle)).toBeVisible();
    await expect(page.getByText(pausedTitle)).toBeVisible();
  });

  test("deleting from an all-games row removes the row and stays on /games", async ({ page }) => {
    await signInAs(page, EMAIL);

    await page.goto("/games/new");
    const doomedTitle = `To Delete From All ${UNIQUE}`;
    await page.getByLabel("Title").fill(doomedTitle);
    await page.getByRole("button", { name: /register game/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByTestId("dashboard-view-all-games").click();
    await expect(page).toHaveURL(/\/games\/?$/);
    await expect(page.getByText(doomedTitle)).toBeVisible();

    const row = page.locator("tr", { hasText: doomedTitle });
    await row.getByRole("button", { name: /^delete$/i }).click();
    await page.getByTestId("delete-game-confirmation-input").fill("delete");
    await page.getByTestId("delete-game-confirm").click();

    await expect(page).toHaveURL(/\/games\/?$/);
    await expect(page.getByText(doomedTitle)).toHaveCount(0);
  });
});
