import { test as base, type Page } from "@playwright/test";

/**
 * Shared Playwright fixtures for Phase 3 E2E tests.
 *
 * `authedPage` seeds a user via the dev/test-only `POST /test/sign-in-as`
 * endpoint and returns a browser context with the Phoenix session cookie
 * already set. Tests that want an unauthenticated browser continue to
 * use the default `page` fixture.
 */

export interface AuthedPageOptions {
  email?: string;
}

export async function signInAs(page: Page, email: string): Promise<void> {
  const response = await page.request.post("/test/sign-in-as", {
    data: { email },
    headers: { "content-type": "application/json" },
  });
  if (!response.ok()) {
    throw new Error(
      `seed failed: ${response.status()} ${await response.text()}`,
    );
  }
}

export const test = base.extend<{ authedPage: Page; authedEmail: string }>({
  authedEmail: "playwright@example.test",
  authedPage: async ({ browser, authedEmail }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAs(page, authedEmail);
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
