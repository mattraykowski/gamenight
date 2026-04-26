import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 6 (US4) E2E: the typed-confirmation modal gates every delete
 * surface (dashboard row and detail page). The confirm button is
 * disabled until the GM types the exact confirmation code.
 *
 * Covers FR-016 / FR-017 / FR-018 / SC-002.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const EMAIL = `playwright-games-delete-${UNIQUE}@example.test`;

async function registerGame(page: Parameters<typeof signInAs>[0], title: string) {
  await page.goto("/games/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: /register game/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(title)).toBeVisible();
}

test.describe("delete game", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, EMAIL);
  });

  test("confirm button is disabled until the exact code is typed (dashboard row)", async ({
    page,
  }) => {
    const title = `To Delete Dashboard ${UNIQUE}`;
    await registerGame(page, title);

    await page.getByTestId(/^game-row-delete-/).first().click();

    const confirmBtn = page.getByTestId("delete-game-confirm");
    const input = page.getByTestId("delete-game-confirmation-input");

    await expect(confirmBtn).toBeDisabled();
    await input.fill("Delete"); // wrong case
    await expect(confirmBtn).toBeDisabled();
    await input.fill("delete "); // trailing whitespace
    await expect(confirmBtn).toBeDisabled();
    await input.fill("delete"); // exact match
    await expect(confirmBtn).toBeEnabled();

    await confirmBtn.click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("Escape closes the dialog without deleting", async ({ page }) => {
    const title = `Keep Me ${UNIQUE}`;
    await registerGame(page, title);

    await page.getByTestId(/^game-row-delete-/).first().click();
    await expect(page.getByTestId("delete-game-confirm")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("delete-game-confirm")).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("deleting from the detail page returns to /dashboard", async ({ page }) => {
    const title = `To Delete Detail ${UNIQUE}`;
    await registerGame(page, title);

    await page.getByRole("link", { name: /^view$/i }).first().click();
    await expect(page).toHaveURL(/\/games\/[0-9a-f-]+$/);

    await page.getByTestId("game-detail-delete").click();
    await page.getByTestId("delete-game-confirmation-input").fill("delete");
    await page.getByTestId("delete-game-confirm").click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
