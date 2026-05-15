# Quickstart: Landing Page

How to verify the landing-page feature locally during and after
implementation. This is also the manual smoke that gates the
release-time WCAG audit (Constitution Principle IV).

---

## Prerequisites

- The repo is set up per `AGENTS.md`. `mix setup` and
  `bun install --frozen-lockfile` (in `assets/`) have been run.
- You can sign in with a test account. If you don't have one, register
  one at `/register` after the dev server starts.

---

## Run the app in dev

```sh
# From the repo root:
mix phx.server
# Visit http://localhost:4000/
```

Optional env (Vite picks them up at SPA build time):

```
# assets/.env.local
VITE_SITE_ORIGIN=http://localhost:4000
VITE_CONTACT_EMAIL=hello@example.com
VITE_SOCIAL_URL=https://github.com/your-org/game_night
```

---

## Anonymous experience (User Story 1)

1. Open `/` in an Incognito / Private window (no auth cookie).
2. **Above the fold**: confirm the hero shows the **GameNight**
   wordmark, a one-line tagline, exactly three value-prop bullets, a
   primary **Register** button, and a secondary **Sign in** affordance.
3. **No banner**: the slim "welcome back" banner MUST NOT appear.
4. Scroll. Confirm in order:
   - **How it works** — three numbered steps (register a game →
     invite players → schedule the month).
   - **Feature highlights** — at least four highlight items.
   - **Closing CTA** — heading, one reinforcing line, **Register**
     button.
   - **Marketing footer** — copyright, Privacy, Terms, Contact mailto,
     social link.
5. Click **Register** in the hero. Confirm you land on `/register`.
6. Back-button to `/`, click the bottom **Register**. Confirm you
   land on `/register`.
7. Back-button, click **Sign in**. Confirm you land on `/sign-in`.
8. Open `/?invite=abc123` directly. Click **Register**. Confirm the
   destination URL preserves `?invite=abc123` (FR-011).

---

## Authenticated experience (User Story 2)

1. Sign in.
2. Navigate to `/` (e.g. by clicking the GameNight wordmark in the
   header, or typing the bare path).
3. Confirm the slim **welcome back** banner appears at the top of the
   page, above the hero. The marketing content is still scrollable
   below.
4. Click **Go to dashboard** in the banner. Confirm you land on
   `/dashboard`.
5. Back-button to `/`. Sign out from the global user menu. Confirm
   the banner disappears and the page reverts to the anonymous shape
   without a full reload artifact.

---

## Stub pages (User Story 1, FR-014)

1. From `/`, click **Privacy** in the marketing footer. Confirm:
   - URL is `/privacy`.
   - Page renders the **draft disclaimer** callout near the top.
   - Heading is `Privacy Policy`.
   - Page renders the structured sections from
     `contracts/privacy-stub.md`.
   - There is a `mailto:` link in the Contact section that opens the
     mail client to `{contactEmail}`.
2. Click the GameNight wordmark in the header. Confirm you return to
   `/`.
3. Click **Terms** in the footer. Confirm the equivalent for
   `/terms` and `contracts/terms-stub.md`.

---

## Share preview (User Story 3)

1. Build the SPA for production with a real `VITE_SITE_ORIGIN`:

   ```sh
   cd assets
   VITE_SITE_ORIGIN=https://your-staging.example.com bun run build
   ```

2. Deploy or proxy a copy that serves at the configured origin.
3. Paste the production URL into a Discord channel, a Slack DM, and
   an iMessage thread.
4. Confirm each unfurl shows:
   - The configured `<title>`.
   - The configured meta description.
   - The 1200×630 OG image (`/images/og/landing.png`) — not a
     fallback or a broken thumbnail.

If an unfurl is wrong, check:

- Does `https://{origin}/images/og/landing.png` return 200 with the
  right `Content-Type: image/png`?
- Is the OG meta in the rendered HTML head? (`view-source:` and grep
  for `og:image`.)
- Are the absolute URLs correct? Discord caches aggressively; append
  a query string to bust the cache during testing.

---

## Accessibility — manual audit

Before tagging a release, run the keyboard / screen-reader checks
that axe-core cannot catch:

1. **Keyboard-only**: tab through `/` end-to-end. Every interactive
   element should be reachable, the focus ring should be visible,
   and the order should match the visual order. The same pass on
   `/privacy` and `/terms`.
2. **Route-change focus**: from the dashboard, navigate to `/`. Focus
   should land on the `GameNight` `<h1>` and the screen-reader
   should announce something like "GameNight, run your tabletop
   campaign with confidence". Same check from `/` to `/privacy`.
3. **Screen reader smoke**: VoiceOver on macOS or NVDA on Windows.
   Confirm headings render in a logical order, the disclaimer
   callouts are announced (`role="status"`), and the welcome-back
   banner (when present) is announced as a banner / region.
4. **Reduced motion**: in browser dev tools, simulate
   `prefers-reduced-motion: reduce`. Reload `/`. No animations or
   scroll-reveal effects fire.
5. **Target size**: confirm every footer link, the banner button, and
   the hero CTAs meet ≥ 24×24 CSS pixels.

---

## Performance smoke

1. Build the SPA for production (`bun run build` in `assets/`).
2. Open `/` in Chrome with a Lighthouse audit on Mobile / 4G:
   - LCP ≤ 2.5 s.
   - INP ≤ 200 ms.
   - CLS ≤ 0.1.
3. Bundle: confirm the route chunk for `/` is ≤ 6 KB gzipped, and
   that `/privacy` and `/terms` are ≤ 2 KB gzipped each. The
   project's `size-limit` configuration enforces these in CI; this
   step is just to spot-check locally before raising the PR.

---

## What "done" looks like

- `mix precommit` passes.
- `bun run test` (Vitest) passes; every component test in
  `assets/js/features/landing/components/` calls
  `expectNoAxeViolations(container)`.
- `bun run e2e` (Playwright) passes; the new conversion smoke is
  green.
- `mix ash.codegen --check` and `mix ash_typescript.codegen` are both
  clean (this feature does not touch them, but the gate still runs).
- The OG image is committed at `priv/static/images/og/landing.png`
  and the unfurl preview test passes against a deployed staging URL.
- The manual a11y / performance smokes above are recorded in the
  release notes.
