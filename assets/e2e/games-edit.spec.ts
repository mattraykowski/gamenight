import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 5 (US3) E2E: from the detail page, click Edit, change the
 * status from Active to Paused, save, land back on the detail page
 * with the new values, and verify the game has disappeared from
 * "My Active Games" on the dashboard (status transition → filter).
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const EMAIL = `playwright-games-edit-${UNIQUE}@example.test`;

test.describe("edit game", () => {
  test("changing status to Paused removes the game from the dashboard", async ({ page }) => {
    await signInAs(page, EMAIL);

    // Register.
    await page.goto("/games/new");
    const title = `Editable Campaign ${UNIQUE}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Starts Active.");
    await page.getByRole("button", { name: /register game/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(title)).toBeVisible();

    // View → Edit.
    await page.getByRole("link", { name: /^view$/i }).first().click();
    await expect(page).toHaveURL(/\/games\/[0-9a-f-]+$/);
    // The Edit action is wrapped in Shadcn's Button-with-asChild, so
    // its rendered role is `link` (the underlying TanStack Router
    // <Link>) rather than a <button>. The data-testid anchors the
    // click regardless of the role Shadcn renders.
    await page.getByRole("link", { name: /^edit$/i }).click();
    await expect(page).toHaveURL(/\/games\/[0-9a-f-]+\/edit$/);

    // Status: Active → Paused. Use the Radix Select combobox.
    await page.getByRole("combobox", { name: /status/i }).click();
    await page.getByRole("option", { name: "Paused" }).click();
    await page.getByRole("button", { name: /save changes/i }).click();

    // Detail page shows the new status.
    await expect(page).toHaveURL(/\/games\/[0-9a-f-]+$/);
    await expect(page.getByTestId("game-detail-status")).toHaveText(/paused/i);

    // Dashboard no longer lists the game.
    await page.goto("/dashboard");
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
