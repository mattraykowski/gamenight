# PRD: Bootstrap React SPA Toolchain

## Problem Statement

The constitution (`.specify/memory/constitution.md`) sets hard gates on the
frontend — WCAG 2.2 AA with route-change focus management (IV), Core Web
Vitals budgets for LCP/INP/CLS (VI), strict TDD (I), automated axe-core in
CI (IV), dependency auditing (II), a pure SPA with no RSC (III), and
session-cookie auth with CSRF (II). None of those gates can run today
because the frontend toolchain does not support them.

The current state:

- The frontend lives in `assets/` and is built by Phoenix's `mix esbuild`
  and `mix tailwind` aliases. There is no Vite, no dev server for a
  real SPA.
- `assets/package.json` has React 19 and `@types/react` but nothing else.
  There is no router, no query library, no test runner, no lint config,
  no Prettier, no bundle-size check, no a11y tooling, no `web-vitals`.
- `assets/js/index.tsx` is a static demo landing page for `ash_typescript`.
  It uses `daisyUI` classes, which the project's own `AGENTS.md` forbids.
  It is not a real SPA shell.
- `ash_typescript` generates `assets/js/ash_rpc.ts` and
  `assets/js/ash_types.ts` as the typed RPC client, but nothing wraps
  these calls for TanStack Query, and there is no integration test that
  the generated client typechecks against consumer code.
- The `.github/workflows/ci.yml` that landed alongside the backend
  tooling does not include any frontend job. PRs that change frontend
  code today have zero automated quality signal.
- Developers have no local commands to run a frontend test, an axe
  scan, or a bundle-size check before pushing.

Because feature work on GameNight (the GM-facing product) cannot begin
until these gates exist, this toolchain is on the critical path.

## Solution

Land a modern, Vite-based frontend toolchain as a single "big-bang"
change that pairs with the first real SPA feature. On merge, the repo
will have:

- **Vite + bun** as the sole frontend build tool, integrated with
  Phoenix via the `phoenix_vite` hex package (igniter installer,
  first-class bun support). The legacy `mix esbuild` and `mix tailwind`
  aliases are retired.
- **TanStack Router (file-based)** for client-side routing with typed
  navigation, search-param state, and route-level loaders.
- **TanStack Query** as the sole server-state store, with a
  non-zero default `staleTime`, hierarchical query-key factories, and
  suspense-enabled route loaders.
- **Tailwind v4** via `@tailwindcss/vite` and **Shadcn UI** (CLI
  default theme) for styled, accessible primitives. `daisyUI` is
  removed.
- **React Compiler** (stable in React 19) via the Vite/Babel plugin,
  with `eslint-plugin-react-compiler` enforcing opt-in compatibility.
- **Vitest + React Testing Library + MSW v2 + vitest-axe** for unit
  and component tests. Every component test asserts no
  `serious`/`critical` axe violations via a shared test helper.
- **Playwright + @axe-core/playwright** for end-to-end tests, running
  against a real `mix phx.server` with a test Postgres service.
- **`size-limit`** gating initial JS bundle at **350 KB gzipped**
  (fail) with a **250 KB gzipped** warning threshold.
- **`web-vitals`** library reporting real-user LCP/INP/CLS to a new
  Ash-backed endpoint `POST /api/vitals`, storing rows on a
  `PageMetric` resource for later analysis.
- **Session-cookie auth preserved** — the SPA is served by Phoenix at
  `/`, inherits the `:browser` pipeline's session, and reads the CSRF
  token from a `<meta>` tag for mutation requests. Admin stays on
  `ash_admin`/LiveView under a scoped prefix.
- **Route-change focus management + `aria-live` announcer** — a shared
  module ensures every SPA navigation moves focus to the page's
  primary heading and announces the transition.
- **Separate `frontend.yml` CI workflow** — lint, typecheck, unit tests,
  component tests, axe gate, Playwright, `size-limit` — all required
  before merge.

The "first feature" validating the stack is an **authenticated
`/dashboard` stub** that exercises the full path: session cookie →
CSRF → ash_typescript client wrapped in TanStack Query → auth guard
in `beforeLoad` → focus-managed route change → "Welcome, {user}"
render → reportWebVitals call → axe assertions → Playwright E2E.

## User Stories

1. As a backend engineer, I want one canonical frontend build command
   (`bun run build`), so that I can stop reasoning about two parallel
   build systems.
2. As a frontend engineer, I want `bun run dev` to start Vite's dev
   server with HMR integrated into Phoenix, so that I can iterate on
   the SPA without restarting Phoenix.
3. As a developer, I want `bun run test` to run all Vitest unit and
   component tests with MSW and axe, so that I can verify my changes
   before pushing.
4. As a developer, I want `bun run test:e2e` to spin up a real
   Phoenix server and Postgres and run the Playwright suite, so that
   I can verify integration against session cookies and CSRF.
5. As a developer, I want `bun run lint` to run ESLint with the
   React Compiler and `jsx-a11y` plugins, so that I can catch
   memoization and accessibility issues statically.
6. As a developer, I want `bun run typecheck` to verify that my
   component code correctly consumes the `ash_typescript`-generated
   client, so that a backend resource change surfaces frontend
   type errors immediately.
7. As a developer, I want a file-based route directory so that adding
   a new SPA page is "create a file in `routes/`", so that routing
   scales without manual config.
8. As a developer, I want typed navigation (`<Link to="/games/$id">`),
   so that renaming a route surfaces a TypeScript error at every
   call site rather than a 404 at runtime.
9. As a developer, I want a shared `createResourceHooks` factory that
   turns an ash_typescript-generated module into
   `useList/useGet/useCreate/useUpdate/useDelete` TanStack Query
   hooks, so that wiring a new Ash resource into the SPA takes one
   line, not twenty.
10. As a developer, I want the JSON:API envelope
    (`{data: {attributes: ...}}`) normalized in the query function,
    so that components consume flat objects and never see the
    envelope shape.
11. As a developer, I want every component test to automatically run
    an axe scan on the rendered output, so that accessibility
    regressions cannot be merged by forgetting to add a test.
12. As a developer, I want a shared Playwright fixture that logs in
    a test user and returns an authenticated page, so that E2E tests
    start from a realistic session without repeating the auth dance.
13. As a non-technical GM using the app on an unreliable café
    Wi-Fi connection, I want the SPA to load in under 2.5 s (LCP),
    so that I don't abandon before it renders.
14. As a non-technical GM using a keyboard-only workflow, I want
    focus to move to the new page's heading on every route change,
    so that I know where I am in the app.
15. As a non-technical GM using a screen reader, I want every route
    transition announced in a polite live region, so that I am not
    silently navigated to a new page.
16. As a non-technical GM tapping icon buttons on a phone, I want every
    tap target to be at least 24×24 CSS pixels (WCAG 2.5.8), so that
    I don't miss-tap adjacent buttons.
17. As a non-technical GM signing into the dashboard, I want the
    browser-standard "Welcome, Matt" greeting to appear without a
    visible flash of unauthenticated content, so that my session
    feels stable.
18. As a non-technical GM submitting a form, I want validation to fire
    `onBlur` first and `onChange` only after my first error, so that
    I'm not punished mid-typing (Principle V / AGENTS.md).
19. As a reliability engineer, I want real-user LCP/INP/CLS reported
    to the backend from every session, so that regressions show up
    in the `PageMetric` table, not just in a Lighthouse lab run.
20. As a reliability engineer, I want the vitals endpoint rate-limited
    and authenticated, so that it is not a DoS or spam vector.
21. As a security reviewer, I want frontend dependencies scanned on
    every PR, so that a vulnerable transitive npm package blocks
    merge just like a vulnerable Hex package does.
22. As a security reviewer, I want the SPA to use session cookies
    marked `HttpOnly` + `Secure` + `SameSite=Lax` with CSRF protection
    on mutations, so that an XSS bug cannot exfiltrate auth state.
23. As a security reviewer, I want every mutation request to include
    the Phoenix CSRF token, so that a cookie-auth'd request from a
    malicious origin fails.
24. As a product manager, I want a hard bundle-size gate at 350 KB
    gzipped (initial JS) with a warning at 250 KB, so that the app
    doesn't quietly bloat over time.
25. As a product manager, I want a PR that fails any gate
    (lint, typecheck, test, axe, bundle, Playwright) to block merge,
    so that feature velocity cannot trade against quality.
26. As a reviewer, I want PRs to show separate green ticks for
    backend (`ci.yml`) and frontend (`frontend.yml`), so that I can
    see at a glance which side changed and which gates ran.
27. As the project maintainer, I want the React Compiler enabled via
    the Vite plugin, so that I don't have to hand-roll `useMemo` and
    `useCallback` all over the codebase.
28. As the project maintainer, I want the `ash_typescript` generated
    client checked in and CI-verified for drift, so that a developer
    cannot forget to regenerate after an Ash resource change.
29. As the project maintainer, I want Shadcn installed with the CLI
    default theme, so that we can bikeshed theming later once there
    is more than one page.
30. As the project maintainer, I want tests colocated (`foo.test.ts`
    next to `foo.ts`) with E2E in `assets/e2e/`, so that any file's
    tests are one directory entry away.
31. As the project maintainer, I want this migration to deliver a
    working `/dashboard` route in the same PR, so that we know the
    whole stack works end-to-end before calling the migration done.

## Implementation Decisions

### Toolchain and build

- Adopt `phoenix_vite` (hex) as the Phoenix↔Vite integration. Run
  its igniter installer to scaffold the `vite.config.ts`, wire
  manifest tracking for LiveView's `app.js`, and configure `:bun`
  as the JS runtime.
- Retire `mix esbuild` and `mix tailwind` from `mix.exs` aliases.
  Replace `assets.setup`, `assets.build`, and `assets.deploy` with
  `bun`-based equivalents that invoke `vite build` and `vite
  build --ssrManifest` as appropriate.
- Remove the `:esbuild` and `:tailwind` deps from `mix.exs` (or
  demote them to unused) only after `phoenix_vite` ships the
  production pipeline successfully.
- Switch the package manager to `bun`. Remove the
  `ash_typescript.npm_install` step from `assets.setup` and replace
  with `bun install` (which `phoenix_vite` can orchestrate).
- Keep `assets/js/app.js` (LiveView client) in the new build; Vite
  produces it as a secondary entry alongside the SPA entry.

### SPA shell and routing

- The SPA mounts at `/`. Phoenix serves a minimal shell HTML from
  the `:browser` pipeline at `/`; a Phoenix catch-all route returns
  the same shell for client-side routes so that deep links work on
  first load.
- LiveView admin surfaces move under a scoped prefix (`/admin`);
  `ash_admin` and `ash_authentication_phoenix` remain at their
  existing mounts. Only `/` and unclaimed client-side paths are
  owned by the SPA.
- TanStack Router uses **file-based routing** with the Vite plugin
  generating `routeTree.gen.ts`. The generated file is committed.
- Typed navigation (`<Link to="...">`) is the only allowed form;
  string route literals in consumer code are an ESLint warning.

### Auth integration

- The SPA is authenticated by the existing Phoenix `:browser`
  pipeline's session cookie (`fetch_session` +
  `load_from_session`). No new token storage is introduced.
- The Phoenix shell template includes a `<meta name="csrf-token">`
  tag; the SPA reads it at boot, wraps the generated API client so
  that every mutation request sends the token in the
  `x-csrf-token` header.
- A 401 interceptor on the wrapped client clears client-side auth
  state and navigates to `/sign-in` via `router.navigate` with a
  `redirect=` search param for return-after-login.
- `beforeLoad` guards on protected routes throw `redirect({ to: '/sign-in', search: { redirect: location.href } })` when the auth
  context has no user.

### API client integration

- The `ash_typescript`-generated modules (`assets/js/ash_rpc.ts`,
  `assets/js/ash_types.ts`) remain at their current paths and
  remain committed.
- A new module exposes a `createResourceHooks(generatedModule,
  options)` factory producing `useList`, `useGet`, `useCreate`,
  `useUpdate`, `useDelete` hooks. Each hook:
  - Uses a hierarchical, typed query-key factory
    (`keys.all`, `keys.list(filters)`, `keys.detail(id)`).
  - Normalizes JSON:API envelope / RPC response shape in the
    `queryFn` so the caller sees a flat domain object.
  - Wraps thrown errors in a discriminated union
    (`NetworkError | ValidationError | AuthError | UnknownError`).
- Global `QueryClient` defaults: `staleTime: 30_000` (30 s),
  `gcTime: 5 * 60_000`, `retry: 1`, `refetchOnWindowFocus: false`
  for mutations.

### Accessibility

- A single `A11y` module exposes:
  - `<A11yAnnouncer />` component that renders one polite
    `aria-live` region and one assertive `aria-live` region at the
    app root.
  - `useFocusOnRouteChange()` hook subscribing to TanStack Router
    navigation events; on navigation, focuses the first
    `[data-route-heading]` element (default: the route's `<h1>`),
    and announces the new `document.title` via the polite region.
- Every Shadcn component is verified against WCAG 2.2 AA new
  criteria at adoption time; the PRD scope only requires adopting
  the Shadcn defaults and verifying the handful used by
  `/dashboard` (Button, Card, potentially Avatar).
- Icon buttons used on `/dashboard` MUST meet 2.5.8 (≥24×24 CSS
  px); Shadcn defaults are verified and overridden where needed.

### Performance

- `size-limit` config defines one entry: the SPA initial bundle
  (excluding async route chunks). Limit: **350 KB gzipped**. Warn
  threshold at **250 KB** via a separate CI job that does not
  block merge but is visible on the PR.
- The CI bundle-size job compares against the base branch; a PR
  that grows initial bundle by >10 KB vs `main` fails even if
  under 350 KB absolute.
- TanStack Router per-route code-splitting is used for all routes
  except `/` and `/dashboard`; these two ship in the initial
  bundle.
- React Compiler is enabled via the Vite plugin. The ESLint plugin
  `eslint-plugin-react-compiler` runs in CI and locally to catch
  un-optimizable code.
- `web-vitals` library is initialized in the SPA shell;
  `onLCP`, `onINP`, `onCLS`, `onTTFB`, `onFCP` handlers post a
  sampled batch to `POST /api/vitals` (100% sample in dev; 10%
  sample in prod; configurable).

### Vitals backend

- A new Ash resource `PageMetric` in the existing `Accounts` domain
  (or a new `Telemetry` domain if cleaner) stores: `id`, `user_id`
  (nullable), `session_id`, `route`, `metric_name`
  (`lcp|inp|cls|ttfb|fcp`), `value`, `rating` (`good|needs-improvement|poor`), `user_agent`, `inserted_at`.
- A `create` action accepts the payload, policed deny-by-default:
  anonymous sessions MAY create (rate-limited); authenticated
  users MAY create (higher rate limit).
- Exposed as `POST /api/vitals` via `ash_json_api`. A
  `PlugAttack`-style rate limiter (or equivalent) caps requests
  per IP.
- No admin UI ships in this PRD; querying the table happens via
  `ash_admin` or direct SQL until a dashboard PRD is drafted.

### ESLint / Prettier

- ESLint flat config at `assets/eslint.config.ts`, registering:
  `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-compiler`,
  `eslint-plugin-jsx-a11y`, `@tanstack/eslint-plugin-router`,
  `@tanstack/eslint-plugin-query`, `eslint-config-prettier`.
- Prettier at `assets/.prettierrc.json` with a minimal config (width
  100, no semi-opinionated overrides).

### CI

- Create `.github/workflows/frontend.yml` as a separate workflow,
  triggered on PRs and pushes to `main`.
- Jobs (each on ubuntu-latest, bun cached):
  - `lint`: `bun run lint`
  - `typecheck`: `bun run typecheck` (also runs `mix
    ash_typescript.codegen` and asserts no diff, covering the
    drift check)
  - `test`: `bun run test --coverage`
  - `size`: `bun run build && bun run size-limit`
  - `e2e`: starts `mix phx.server` with a Postgres service,
    runs `bun run test:e2e` (Playwright + @axe-core/playwright)
- The existing `ci.yml` (`elixir` backend job) is unchanged except
  for a small adjustment: the `ash_typescript_drift` job is removed
  from `ci.yml` and moved into `frontend.yml`'s `typecheck` job,
  since that is the job that actually consumes the generated
  client.
- All frontend jobs are required checks on the `main` branch.

### Big-bang cadence

- This PRD delivers, in one PR (or one merged branch):
  1. `phoenix_vite` installation + Vite/bun bootstrap.
  2. Tailwind v4 + Shadcn CLI init with default theme.
  3. TanStack Router + TanStack Query bootstrap.
  4. ESLint + Prettier flat config.
  5. Vitest + RTL + MSW v2 + vitest-axe setup.
  6. Playwright + @axe-core/playwright setup.
  7. size-limit config.
  8. `web-vitals` + `reportWebVitals` module.
  9. `PageMetric` Ash resource + `POST /api/vitals` endpoint.
  10. `A11y` module (focus + announcer).
  11. API client wrapper (`createResourceHooks`).
  12. Auth context + 401 interceptor.
  13. `/dashboard` authenticated stub route.
  14. `.github/workflows/frontend.yml`.
  15. Removal of `:esbuild`, `:tailwind` mix deps and associated
      aliases once the Vite pipeline is proven.

## Testing Decisions

### What makes a good test in this codebase

- **Tests assert observable behavior** (what the user or caller
  sees), not implementation details (hook internals, render
  counts, CSS class names).
- **Tests query by role, label, or text**, per React Testing
  Library philosophy. Selectors like `getByTestId` are a last
  resort; selectors like `getByClassName` are forbidden.
- **Component tests use MSW** for the network boundary. Do not
  mock the generated API client; mock at HTTP. This catches
  serialization, URL shape, and auth-header bugs that a
  function-level mock would miss.
- **E2E tests use a real Phoenix backend** with a seeded test DB.
  Playwright fixtures handle login once and reuse the session.
- **Tests fail red before the implementation lands** (Principle I).
  PR reviewers look for commits that add the test separately from
  the implementation, or for a single commit where the test is
  written first within the diff.

### Modules that MUST have tests

Per constitution Principle I, every functional module in this PRD
has tests. Specifically:

1. **`A11y` module** (`useFocusOnRouteChange`, `<A11yAnnouncer>`)
   - Vitest: announcer renders both polite and assertive regions;
     hook subscribes/unsubscribes correctly on mount/unmount.
   - Playwright (on `/dashboard`): assert that focus is on the
     page's `<h1>` after navigating, and that the polite region
     contains the new page's title text. This is listed
     explicitly because route-change focus is a Principle IV
     NON-NEGOTIABLE that automated axe does not catch.
2. **API client wrapper** (`createResourceHooks`)
   - Vitest + MSW: each generated hook returns the normalized
     shape, sends the CSRF header on mutations, invalidates the
     correct keys on mutation success, and narrows errors to the
     discriminated union.
3. **Auth context + 401 interceptor**
   - Vitest + MSW: 401 response triggers one silent refresh
     attempt; a second 401 clears auth and navigates to
     `/sign-in?redirect=...`.
4. **Vitals reporter** (`reportWebVitals`)
   - Vitest + MSW: batches events and posts to `/api/vitals`;
     drops silently if the user opts out; respects the sample
     rate.
5. **`PageMetric` Ash resource**
   - ExUnit action test: valid payload creates a row.
   - ExUnit policy test: unauthorized actor is denied; authorized
     actor is allowed.
   - ExUnit contract test: JSON:API `POST /api/vitals` accepts the
     expected shape and rejects malformed payloads.
6. **`/dashboard` route**
   - Vitest component test: when auth context resolves a user,
     renders "Welcome, {name}". Asserts no serious/critical axe
     violations via the shared `expectNoAxeViolations` helper.
   - Playwright E2E: unauthenticated visit redirects to
     `/sign-in?redirect=/dashboard`; after login, lands on
     `/dashboard` with the user's name visible and focus on the
     page heading.

### Shared test helper (enforced)

A shared helper `expectNoAxeViolations(container)` wraps
`vitest-axe`. Every component test MUST call it on its primary
render output. A lint rule or a per-file eslint-comment rule
enforces this; at minimum, the module-README documents the
requirement, and reviewers block PRs missing it.

### Prior art

There is no existing frontend test infrastructure in this repo.
For backend tests, follow the pattern already established in
`test/` (ExUnit + Ash.Test). For the two new backend components
(`PageMetric` resource + `/api/vitals` endpoint), follow the
resource/policy/action test pattern used in the existing
`GameNight.Accounts` domain.

## Out of Scope

- **Theming.** Shadcn's CLI default is adopted; any custom palette
  or dark-mode toggle is a separate design PRD.
- **Internationalization.** Gettext backend exists; frontend i18n
  (e.g., `react-i18next`) is deferred until a locale beyond
  English is required.
- **Real dashboard features.** `/dashboard` in this PRD is a stub:
  auth check + greeting. GM/game/player features are their own
  PRDs.
- **Admin UI for `PageMetric`.** Rows are queryable via
  `ash_admin` by default; a bespoke vitals dashboard is deferred.
- **Service Worker / offline support.** No PWA scope in this PRD.
- **Bundle optimization beyond `size-limit`.** Tree-shaking
  pathologies, image optimization, and font subsetting are not
  addressed here; the PRD lands the budget and the measurement,
  not the tuning.
- **CSP headers.** The Sobelow finding about missing CSP surfaced
  by the backend CI is a separate security task; this PRD does
  not attempt to design a CSP that fits Vite's dev-server
  behavior.
- **Visual regression testing.** Playwright has visual-diff
  support, but adopting it requires a baseline and a review
  process that is out of scope here.
- **React Hook Form + Zod forms module.** No forms ship in this
  PRD (no feature needs them yet). The first feature that does
  will land the Shadcn `<Form>` wrapper pattern; this PRD
  deliberately leaves that for then to avoid speculative
  abstraction.

## Further Notes

- **Dependency on `phoenix_vite`.** If the package proves
  incompatible (regressions in 0.x, missing features), the
  fallback is a hand-rolled Vite+Phoenix integration: Vite's dev
  server proxied from Phoenix in dev, Vite's `build` output
  served as static files in prod, manifest loaded via
  `Phoenix.Router` helper. Verified as technically feasible by
  community blog posts; more config but no blockers.
- **Dependency on bun.** Bun's compatibility with Vite and Vitest
  is strong as of 2026, but the Playwright CLI has had friction
  historically. Fallback: keep bun for package management; invoke
  Playwright via `npx playwright` under the hood if bun's
  execution has issues.
- **LiveView coexistence.** LiveView is not removed. `ash_admin`
  and `ash_authentication_phoenix` continue to work. `app.js`
  (the LiveView client) is still built as a secondary Vite entry.
  Any user-facing (non-admin) LiveView routes currently in the
  router (there are none today besides the
  `ash_authentication_live_session` scaffolding) are either
  deleted or moved to `/admin` as part of this PR.
- **Removal of `/ash-typescript` demo page.** The existing
  `assets/js/index.tsx` demo (which uses daisyUI and is not a real
  feature) is deleted. Its content is not worth preserving; the
  route `/ash-typescript` is removed from the router.
- **CSRF token exposure.** The Phoenix shell template MUST render
  `<meta name="csrf-token" content={csrf_token()}>`. Verify this
  is still present after any Layouts refactor.
- **Constitution alignment.** After merge, every frontend gate in
  the constitution (Principles I, II, III, IV, VI) is actually
  enforceable. The constitution's v1.2.0 Sync Impact Report lists
  these tooling items as follow-ups; this PRD closes them.
- **Size budget rationale.** 350 KB gzipped initial JS is
  intentionally generous for a React 19 + TanStack + Shadcn
  baseline. It leaves room for one or two app-specific vendor
  chunks without forcing micro-optimization early. The 250 KB
  warn threshold creates social pressure before a hard failure.
- **Why big-bang rather than incremental.** An incremental
  migration would leave two build systems running for an extended
  period; given the current frontend is a demo page with no real
  users, the inventory of "live code that must keep working
  during migration" is effectively zero, which makes big-bang
  the safer and faster path.
