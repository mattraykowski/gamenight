import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 3 Playwright config. Runs against a live Phoenix server so
 * E2E specs can exercise session-cookie auth end-to-end — the SPA
 * shell, JSON auth-state island, ash_typescript RPC, and the Phoenix
 * catch-all route all need to be in the request path for these tests
 * to be meaningful.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Assumes `mix ash.setup` has been run at least once. CI wires this
    // up explicitly; local devs either `mix setup` once or start
    // `mix phx.server` themselves and set `PLAYWRIGHT_BASE_URL`.
    command: "cd .. && mix phx.server",
    url: "http://localhost:4000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
