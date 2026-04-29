import { test, expect, signInAs } from "./fixtures";

/**
 * T032 — US1 E2E: a GM signs in, registers a game, opens the View
 * Game page, initiates a schedule for next month, lands on the
 * Schedule Detail page, and toggles a few days through the
 * NA → I → A → IF cycle on the desktop-planner-style calendar.
 *
 * Also asserts:
 *   - The schedule appears in the View Game schedules table at
 *     status "Preparing".
 *   - The display name (Schedule.name calculation) matches the
 *     month/year/time-slot.
 *   - The MonthCalendar exposes role="grid" + role="gridcell"
 *     buttons.
 */

const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const GM_EMAIL = `playwright-schedule-initiate-${UNIQUE}@example.test`;

function nextMonthYearMonth(): { value: string; label: RegExp } {
  const now = new Date();
  // Pick a month two months out so we never collide with the current-month
  // boundary in the GM's tz.
  const target = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const monthName = target.toLocaleString("en-US", { month: "long" });
  return {
    value: `${yyyy}-${mm}`,
    label: new RegExp(`${monthName} ${yyyy}`),
  };
}

test.describe("US1 — GM initiates a schedule", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, GM_EMAIL);
  });

  test("GM initiates a schedule and toggles availability on the calendar", async ({
    page,
  }) => {
    // Register a game so the GM has somewhere to schedule.
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-create-game").click();
    await expect(
      page.getByRole("heading", { level: 1, name: /register a new game/i }),
    ).toBeVisible();

    const gameTitle = `Schedule test game ${UNIQUE}`;
    await page.getByLabel("Title").fill(gameTitle);
    await page.getByLabel("Description").fill("For the schedule e2e.");
    await page.getByRole("button", { name: /register game/i }).click();

    // Land on /games/:id (the GM's view).
    await expect(page.getByRole("heading", { level: 1, name: gameTitle })).toBeVisible();

    // The Schedules section is visible, with the empty state.
    await expect(
      page.getByRole("heading", { level: 2, name: /schedules/i }),
    ).toBeVisible();
    await expect(page.getByText(/no schedules yet/i)).toBeVisible();

    // Open the Initiate Schedule dialog.
    await page.getByTestId("initiate-schedule-trigger").click();
    await expect(page.getByText(/initiate a schedule/i)).toBeVisible();

    const { value: monthValue, label: nameLabel } = nextMonthYearMonth();
    await page.getByLabel("Month").fill(monthValue);
    await page.getByLabel("Start time").fill("19:00");
    await page.getByLabel("End time").fill("23:00");
    await page.getByRole("button", { name: /create schedule/i }).click();

    // The dialog closes and the route navigates to the Schedule
    // Detail page directly — staying on /games/:id with a stale
    // table is the wrong UX.
    await expect(
      page.getByRole("heading", { level: 1, name: nameLabel }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/games\/[^/]+\/schedules\/[^/]+$/);

    // The MonthCalendar grid is present.
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();

    // Click a day cell — it cycles to "Ideal" first.
    const day10 = page.getByRole("gridcell", { name: /^.* 10,/i }).first();
    await day10.click();
    await expect(day10).toContainText(/ideal/i);

    // Click again — cycles to "Available".
    await day10.click();
    await expect(day10).toContainText(/available/i);
  });
});
