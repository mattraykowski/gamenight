import { test, expect, signInAs } from "./fixtures";

/**
 * Phase 4 acceptance: loading `/dashboard` in a real browser produces
 * at least one `page_metrics` row within a few seconds. We assert on
 * the network request rather than on the database so the test stays
 * agnostic to which metric fired first (Chromium will usually emit
 * FCP and TTFB before LCP; any of them satisfies the contract).
 */
test("SPA ships at least one /api/vitals sample on /dashboard", async ({ page }) => {
  await signInAs(page, "playwright@example.test");

  // Watch for the POST rather than the response: the flush path uses
  // `navigator.sendBeacon` on page-hide, and beacons don't surface a
  // response object to Playwright. The request itself is enough to
  // prove the reporter wired up correctly — the backend contract is
  // covered by `test/game_night_web/controllers/vitals_test.exs`.
  const vitalsRequest = page.waitForRequest(
    (req) => req.url().endsWith("/api/vitals") && req.method() === "POST",
    { timeout: 15_000 },
  );

  await page.goto("/dashboard");
  await page.getByRole("heading", { level: 1, name: /welcome back/i }).waitFor();

  // Give web-vitals time to measure LCP, then nudge the page toward
  // hidden to flush the reporter. Two routes usually fire during a
  // navigation: the idle flush (5s) or the beacon on `pagehide`.
  await page.waitForTimeout(6_000);

  const request = await vitalsRequest;
  expect(request.url()).toMatch(/\/api\/vitals$/);
});
