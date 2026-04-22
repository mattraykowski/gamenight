# Plan: Bootstrap React SPA Toolchain

> Source PRD: [docs/prds/bootstrap-react-spa-toolchain.md](../docs/prds/bootstrap-react-spa-toolchain.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **SPA boundary**: The React SPA mounts at `/`. Phoenix serves a minimal
  shell HTML and uses a catch-all route to return the same shell for
  client-side paths so deep links work on first load. `ash_admin` /
  `ash_authentication_phoenix` remain at their existing mounts;
  LiveView moves under `/admin` for any non-auth flows.
- **Routes**:
  - `/` — SPA shell + first SPA route
  - `/dashboard` — authenticated SPA route (first real feature)
  - `/sign-in`, `/sign-out`, `/reset-password`, `/confirm` —
    `ash_authentication_phoenix` (unchanged)
  - `/admin/*` — `ash_admin` + LiveView
  - `/api/json/*` — `ash_json_api` (existing)
  - `/api/vitals` — new JSON:API endpoint for web-vitals reporting
  - `/rpc/run`, `/rpc/validate` — `ash_typescript` RPC (unchanged)
  - `/ash-typescript` — REMOVED in Phase 5
- **Auth**: Session-cookie based, reusing the existing Phoenix `:browser`
  pipeline (`fetch_session` + `load_from_session`). SPA reads the
  CSRF token from a `<meta name="csrf-token">` tag at boot and sends it
  as `x-csrf-token` on every mutation. 401s trigger one silent refresh
  attempt, then redirect to `/sign-in?redirect=<current>`. No tokens in
  `localStorage` / `sessionStorage`; access tokens (if used) in memory only.
- **Schema**: one new table backing a `PageMetric` Ash resource:
  `id`, `user_id` (nullable FK to users), `session_id`, `route`,
  `metric_name` (one of `lcp|inp|cls|ttfb|fcp`), `value` (float),
  `rating` (one of `good|needs-improvement|poor`), `user_agent`,
  `inserted_at`. Lives in a new `Telemetry` Ash domain to keep vitals
  orthogonal to `Accounts`.
- **Key models**: new Ash resource `PageMetric` (Telemetry domain).
  Existing `User`, `Token`, and any `Accounts` resources are unchanged
  by this plan except for the `user_id` FK used by `PageMetric`.
- **Build toolchain**: Vite (via `phoenix_vite` hex package) replaces
  `mix esbuild` and `mix tailwind`. Package manager is `bun`.
  Tailwind v4 via `@tailwindcss/vite`. React Compiler via the Vite/Babel
  plugin. `ash_typescript`-generated modules remain at
  `assets/js/ash_rpc.ts` and `assets/js/ash_types.ts` and remain
  committed.
- **API client boundary**: a single `createResourceHooks(generatedModule,
  options)` factory wraps `ash_typescript`-generated functions into
  TanStack Query hooks with hierarchical query-key factories, JSON:API
  envelope normalization, and a discriminated error union
  (`NetworkError | ValidationError | AuthError | UnknownError`).
  Components never call the generated client directly.
- **A11y foundation**: one shared `A11y` module provides
  `<A11yAnnouncer>` (one polite + one assertive `aria-live` region at
  the app root) and `useFocusOnRouteChange()` (focuses
  `[data-route-heading]`, announces `document.title` via the polite
  region). Every SPA route is responsible for rendering an `<h1
  data-route-heading>`.
- **Test layout**: Vitest unit/component tests colocated as
  `foo.test.ts` / `foo.test.tsx` next to source. Playwright E2E tests in
  `assets/e2e/`. Shared helper `expectNoAxeViolations(container)` is
  called by every component test; missing calls are blocked by review
  and, where practical, a lint rule.
- **CI boundary**: backend gates remain in `.github/workflows/ci.yml`
  (unchanged except that the `ash_typescript_drift` job moves out, see
  Phase 5). Frontend gates land in a new
  `.github/workflows/frontend.yml`. Both are required checks on `main`.
- **Bundle budget**: `size-limit` config — **350 KB gzipped** initial
  JS fails, **250 KB gzipped** warns, any >10 KB growth vs `main`
  fails. Per-route code-splitting via TanStack Router; `/` and
  `/dashboard` ship in the initial bundle, everything else is async.

---

## Phase 1: Build skeleton — Vite + bun + Phoenix + minimal `/` route

**User stories**: 1, 2, 3, 5, 6, 7, 8, 27, 29, 30

### What to build

The first tracer bullet cuts through the full build stack. After this
phase, a developer can run `bun run dev` alongside `mix phx.server`,
browse to `/`, and see a Shadcn-styled hello page rendered by a real
React SPA served through Phoenix via the Vite dev server.

Concretely, this phase:

- Installs `phoenix_vite` (igniter) and retires the esbuild/tailwind
  dev-time workflow. Production build switches to Vite's `build`
  output with manifest tracking.
- Adopts `bun` as the package manager; `ash_typescript.npm_install` is
  replaced with `bun install` orchestrated by `phoenix_vite`.
- Initializes Tailwind v4 via `@tailwindcss/vite` and Shadcn CLI with
  the default theme.
- Bootstraps TanStack Router (file-based, Vite plugin generating a
  committed `routeTree.gen.ts`) and TanStack Query (`QueryClientProvider`
  at the app root, `staleTime: 30_000` default).
- Adds ESLint flat config with TypeScript, React, React Hooks, React
  Compiler, `jsx-a11y`, `@tanstack/eslint-plugin-router`,
  `@tanstack/eslint-plugin-query`, and Prettier.
- Adds Vitest + React Testing Library + MSW v2 + `vitest-axe` with a
  shared `expectNoAxeViolations(container)` helper.
- Creates one SPA route at `/` rendering a Shadcn `<Button>` inside a
  page heading, with one passing component test (asserts rendered
  content + calls `expectNoAxeViolations`). Satisfies Principle I
  (tests ship with the skeleton).
- Deletes `daisyUI` usage; the existing `assets/js/index.tsx` demo is
  untouched until Phase 5 but the new `/` route does not use daisyUI.

### Acceptance criteria

- [ ] `bun install` succeeds from a clean clone.
- [ ] `mix phx.server` + `bun run dev` serve the SPA at `/` with HMR.
- [ ] `bun run build` produces a Vite manifest and Phoenix reads it.
- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bun run test` passes with at least one component test on `/`.
- [ ] `mix ash_typescript.codegen` still runs without errors.
- [ ] `mix precommit` and the existing backend `mix ci` still pass.
- [ ] The Shadcn default theme is applied; daisyUI is not present in
      the new route.

---

## Phase 2: Route-change a11y — focus + announcer + Playwright

**User stories**: 14, 15, 16

### What to build

The second tracer bullet adds the shared a11y foundation that every
future SPA route depends on, plus the E2E infrastructure that validates
it. After this phase, navigating between two SPA routes moves focus
correctly and announces via a polite live region, with Playwright
proving it.

Concretely, this phase:

- Builds the `A11y` module exposing `<A11yAnnouncer>` and
  `useFocusOnRouteChange()`. The announcer renders both polite and
  assertive `aria-live` regions at the app root. The hook subscribes to
  TanStack Router navigation events, focuses the first
  `[data-route-heading]`, and updates the polite region with
  `document.title`.
- Integrates the A11y module into the SPA shell so every route benefits
  without per-route wiring.
- Adds a second throwaway SPA route (`/about` or similar) purely to
  exercise navigation. This route is deleted or repurposed in Phase 3.
- Both routes render an `<h1 data-route-heading>` so the focus
  contract is visible.
- Installs Playwright + `@axe-core/playwright`, with one E2E test that
  navigates between the two routes and asserts (a) focus lands on the
  new `<h1>`, (b) the polite region contains the new page's title,
  (c) `@axe-core/playwright` reports no serious/critical violations on
  each route.
- Verifies Shadcn components used so far meet WCAG 2.5.8 (Target Size
  ≥24×24 CSS px); overrides defaults where they fall short.
- Adds Vitest unit tests for the `A11y` module (announcer renders both
  regions; hook subscribes/unsubscribes on mount/unmount).

### Acceptance criteria

- [ ] `<A11yAnnouncer>` is rendered once at the app root.
- [ ] Navigating between the two SPA routes moves focus to the new
      `<h1>` and updates the polite live region text.
- [ ] Playwright E2E passes locally against a running
      `mix phx.server`.
- [ ] `@axe-core/playwright` reports no serious/critical violations on
      either route.
- [ ] Vitest tests cover the `A11y` module's public surface.
- [ ] All icon buttons / interactive targets in the two routes are
      ≥24×24 CSS px.

---

## Phase 3: Auth + `/dashboard` (first real feature)

**User stories**: 9, 10, 12, 17, 22, 23, 28, 31

### What to build

The third tracer bullet delivers the first real, authenticated feature
end-to-end. After this phase, an unauthenticated visit to `/dashboard`
redirects to `/sign-in?redirect=/dashboard`; after login, the user
lands on `/dashboard` with "Welcome, {name}" rendered and focus on the
page heading.

Concretely, this phase:

- Adds the Phoenix-side glue: a `<meta name="csrf-token">` tag in the
  SPA shell layout; a catch-all Phoenix route that serves the shell for
  any unclaimed path (so `/dashboard` loads the shell on a hard
  refresh).
- Builds the API client wrapper: `createResourceHooks(generatedModule,
  options)` factory producing `useList/useGet/useCreate/useUpdate/
  useDelete` with typed, hierarchical query-key factories, JSON:API
  envelope normalization in the `queryFn`, and a discriminated error
  union.
- Builds the auth context: reads initial auth state from the shell
  (passed via a `<script type="application/json">` island or fetched via
  an auth probe endpoint), exposes `useAuth()`, and wraps the generated
  client so every mutation carries `x-csrf-token`.
- Implements the 401 interceptor: one silent refresh attempt; on a
  second 401, clear auth state and `router.navigate({ to: '/sign-in',
  search: { redirect: currentPath } })`.
- Ports the throwaway second route from Phase 2 into `/dashboard` (or
  deletes it and creates `/dashboard` fresh). Route has a `beforeLoad`
  guard that throws `redirect({ to: '/sign-in', search: { redirect:
  location.href } })` when unauthenticated.
- Adds a Playwright fixture that seeds a test user and returns an
  authenticated page, used by this phase's E2E tests.
- Writes tests:
  - Vitest + MSW: `createResourceHooks` normalizes JSON:API envelopes,
    sends CSRF header on mutations, narrows errors to the discriminated
    union, invalidates the right keys on mutation success.
  - Vitest + MSW: auth context's 401 flow (silent refresh then redirect
    with return URL).
  - Vitest: `/dashboard` component renders "Welcome, {name}" when
    auth resolves; `expectNoAxeViolations(container)` passes.
  - Playwright E2E: unauth → `/dashboard` redirects to
    `/sign-in?redirect=/dashboard`; after login, lands on `/dashboard`,
    user's name is visible, focus is on the heading, live region
    announced "Dashboard".

### Acceptance criteria

- [ ] `<meta name="csrf-token">` is present in the SPA shell.
- [ ] The catch-all Phoenix route returns the SPA shell for deep
      links like `/dashboard` on first load.
- [ ] Unauthenticated visit to `/dashboard` redirects to
      `/sign-in?redirect=/dashboard`.
- [ ] After login, `/dashboard` renders "Welcome, {name}" using data
      fetched via `createResourceHooks` → `ash_typescript` RPC.
- [ ] Mutations from the SPA carry the CSRF token header; removing
      the header causes the request to be rejected by Phoenix.
- [ ] 401 responses trigger one silent refresh; a second 401 clears
      auth and redirects to `/sign-in` with a return URL.
- [ ] All Vitest and Playwright tests for this phase pass.
- [ ] The Playwright test asserts route-change focus behavior on
      `/dashboard` specifically.

---

## Phase 4: Performance gates + vitals pipeline

**User stories**: 13, 19, 20, 24

### What to build

The fourth tracer bullet cuts through the performance instrumentation
stack end-to-end. After this phase, loading any SPA route produces a
real row in `page_metrics` via an authenticated JSON:API call, and CI
has a bundle-size budget wired.

Concretely, this phase:

- Creates the `Telemetry` Ash domain and `PageMetric` resource:
  attributes per the schema above, deny-by-default policies (anonymous
  sessions MAY create with stricter rate limiting; authenticated users
  MAY create with a higher rate limit; nobody else can read or write
  user-facing), and a `create` action accepting the vitals payload.
- Exposes `POST /api/vitals` via `ash_json_api` mapped to the create
  action. Adds basic rate limiting (e.g. `plug_attack` or equivalent)
  at the endpoint or action level.
- Runs `mix ash.codegen` to produce the migration, commits snapshots.
- Builds the `reportWebVitals` module: subscribes to `web-vitals`
  (`onLCP`, `onINP`, `onCLS`, `onTTFB`, `onFCP`), batches events, POSTs
  to `/api/vitals` with CSRF header and session id. Dev mode: 100%
  sample; prod: 10% (configurable). Fails silently on network error.
- Integrates `reportWebVitals` into the SPA shell.
- Configures `size-limit` (250 KB gzipped warn, 350 KB gzipped fail,
  >10 KB growth vs `main` fails). Adds a `bun run size-limit` script.
- Tests:
  - ExUnit: `PageMetric` create action accepts valid payload, rejects
    invalid rating/metric_name, stores row with correct associations.
  - ExUnit: policy tests — anonymous, authenticated, and rejected
    actors each behave as specified.
  - ExUnit: contract test — `POST /api/vitals` request shape is
    accepted; malformed shapes return `422`.
  - Vitest + MSW: reporter batches events, posts to correct endpoint,
    includes CSRF header, respects sample rate.

### Acceptance criteria

- [ ] `PageMetric` resource exists in a `Telemetry` domain with
      deny-by-default policies and snapshots committed.
- [ ] `POST /api/vitals` accepts a vitals payload and creates a
      `page_metrics` row; rate-limited.
- [ ] Loading `/dashboard` in the browser produces at least one
      `page_metrics` row (LCP) within 5 seconds.
- [ ] `bun run size-limit` reports initial bundle size; values are
      below the 350 KB fail threshold.
- [ ] Backend tests cover action, policy, and contract for
      `PageMetric`.
- [ ] Frontend tests cover the reporter's batching, sampling, and
      network shape.

---

## Phase 5: CI enforcement + legacy cleanup

**User stories**: 4, 11, 21, 25, 26

### What to build

The fifth tracer bullet makes every gate enforced automatically on
every PR, retires the legacy toolchain, and deletes the no-longer-used
demo page. After this phase, the constitution's frontend gates actually
block merges.

Concretely, this phase:

- Creates `.github/workflows/frontend.yml` triggered on PRs and pushes
  to `main`. Jobs (bun cached):
  - `lint` → `bun run lint`
  - `typecheck` → `bun run typecheck`. This job also runs
    `mix ash_typescript.codegen` and `git diff --exit-code` on the
    generated files; it absorbs the drift check.
  - `test` → `bun run test --coverage`
  - `size` → `bun run build && bun run size-limit`
  - `e2e` → starts a Postgres service, runs `mix phx.server` against
    a test DB, runs `bun run test:e2e` (Playwright +
    `@axe-core/playwright`).
- Removes the `ash_typescript_drift` job from `.github/workflows/ci.yml`
  (now covered by frontend.yml `typecheck`).
- Marks all frontend.yml jobs (and existing backend jobs) as required
  on `main` via branch protection (documented in the PR description
  since branch protection isn't a checked-in file).
- Cleans up `mix.exs`:
  - Remove `:esbuild` and `:tailwind` from deps.
  - Remove `assets.setup`, `assets.build`, `assets.deploy` aliases
    (or reduce them to `bun run build` delegations if `phoenix_vite`
    does not already replace them).
  - Verify the `setup` alias's `assets.setup` and
    `ash_typescript.npm_install` steps are replaced with `bun install`.
- Deletes `assets/js/index.tsx` (daisyUI demo), `assets/js/animation.ts`
  (only used by the demo), and the `/ash-typescript` route in
  `lib/game_night_web/router.ex`.
- Adds (or documents) enforcement of the `expectNoAxeViolations`
  requirement: if feasible, a simple ESLint rule flags component tests
  that render without calling the helper; otherwise, a note in
  `AGENTS.md` and code-review checklist suffices.

### Acceptance criteria

- [ ] `.github/workflows/frontend.yml` exists and runs five jobs.
- [ ] A PR that fails any frontend gate (lint, typecheck, test, size,
      e2e) blocks merge.
- [ ] A PR that lets `ash_typescript.codegen` drift fails the
      `typecheck` job.
- [ ] `:esbuild` and `:tailwind` are no longer in `mix.exs`; the app
      still compiles and the `setup` alias installs a working
      development environment from a clean clone.
- [ ] `/ash-typescript` returns 404; `assets/js/index.tsx` is deleted.
- [ ] `mix precommit` (backend) and `bun run` scripts (frontend) all
      pass on a clean clone.
- [ ] Every component test in the repo calls
      `expectNoAxeViolations(container)` on its rendered output, or
      has a documented, commented exemption.
