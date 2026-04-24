import { test as base, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Shared Playwright fixtures.
 *
 * `authedPage` seeds a user via the dev/test-only `POST /test/sign-in-as`
 * endpoint and returns a browser context with the Phoenix session cookie
 * already set. Tests that want an unauthenticated browser continue to
 * use the default `page` fixture.
 *
 * `latestEmailTo` / `extractLinkFromEmail` are helpers for the email
 * flows (confirm, reset, magic-link) — they read from the Swoosh
 * in-memory mailbox via `/test/mailbox`.
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

/**
 * Opens the navbar user menu and clicks "Sign out". Helper so every
 * spec that needs to drop auth doesn't have to remember the two-step
 * dropdown dance.
 */
export async function clickSignOut(page: Page): Promise<void> {
  await page.getByTestId("user-menu-trigger").click();
  await page.getByTestId("user-menu-sign-out").click();
}

export interface CapturedEmail {
  to: Array<{ name: string; address: string }>;
  from: { name: string; address: string } | null;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  inserted_at: string;
}

/**
 * Returns the most recent email delivered to the given address via
 * the dev Swoosh mailbox, or `null` if nothing has been sent. Polls
 * briefly because senders run in the controller's request cycle and
 * tests can race the delivery callback.
 */
export async function latestEmailTo(
  request: APIRequestContext,
  to: string,
  { timeoutMs = 5_000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<CapturedEmail | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await request.get(`/test/mailbox?to=${encodeURIComponent(to)}`);
    if (response.ok()) {
      const body = (await response.json()) as { emails: CapturedEmail[] };
      if (body.emails.length > 0) return body.emails[0] ?? null;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

/**
 * Scans the HTML body of an email for the first anchor whose `href`
 * contains `hrefPathPrefix`. Useful for extracting the confirm / reset
 * / magic-link URL a sender module embedded in the message — callers
 * pass the known path prefix (e.g. `/confirm_new_user/` or
 * `/password-reset/`). The Ash senders use `url(~p"...")` which
 * generates absolute URLs (`http://localhost:4000/...`), so we match
 * on a substring rather than a prefix.
 */
export function extractLinkFromEmail(
  email: CapturedEmail,
  hrefPathPrefix: string,
): string {
  const html = email.html_body ?? email.text_body ?? "";
  const pattern = new RegExp(
    `href=["']([^"']*${escapeRegExp(hrefPathPrefix)}[^"'\\s]+)["']`,
    "i",
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(
      `no link matching ${hrefPathPrefix} in email subject: ${email.subject}`,
    );
  }
  return match[1]!;
}

export async function clearMailbox(request: APIRequestContext): Promise<void> {
  const response = await request.delete("/test/mailbox");
  if (!response.ok()) {
    throw new Error(`clear mailbox failed: ${response.status()}`);
  }
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
