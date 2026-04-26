import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 4 (US2) E2E: the GM clicks the view action on a dashboard
 * row and lands on /games/$id showing the game's title, description,
 * and status via `<GameFieldRow>` primitives. Cross-tenant access
 * via a guessed id returns a not-found view.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const OWNER_EMAIL = `playwright-games-view-${UNIQUE}@example.test`;
const OTHER_EMAIL = `playwright-other-${UNIQUE}@example.test`;

test.describe("view game detail", () => {
  test("register a game, click view, see the detail page with labelled regions", async ({
    page,
  }) => {
    await signInAs(page, OWNER_EMAIL);
    await page.goto("/games/new");

    const title = `Detail Campaign ${UNIQUE}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("For the detail spec.");
    await page.getByRole("button", { name: /register game/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: /^view$/i }).first().click();

    await expect(page).toHaveURL(/\/games\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByTestId("game-field-title")).toBeVisible();
    await expect(page.getByTestId("game-field-description")).toBeVisible();
    await expect(page.getByTestId("game-field-status")).toBeVisible();
    await expect(page.getByTestId("game-detail-title")).toHaveText(title);
  });

  test("direct visit to a stranger's game url shows the not-found view", async ({
    page,
    context,
  }) => {
    // Register a game as OWNER and capture its url.
    await signInAs(page, OWNER_EMAIL);
    await page.goto("/games/new");
    const title = `Stranger's Game ${UNIQUE}`;
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: /register game/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: /^view$/i }).first().click();
    const strangerUrl = page.url();

    // Swap identity and try to reach the OWNER's game.
    await context.clearCookies();
    await signInAs(page, OTHER_EMAIL);
    await page.goto(strangerUrl);

    await expect(page.getByRole("heading", { level: 1, name: /game not found/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to dashboard/i })).toBeVisible();
  });
});
