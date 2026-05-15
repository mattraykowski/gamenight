---

description: "Task list for the Landing Page feature (006-landing-page)"
---

# Tasks: Landing Page

**Input**: Design documents from `/specs/006-landing-page/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/](./contracts/)

**Tests**: MANDATORY per Constitution Principle I (Test-First Development,
NON-NEGOTIABLE). Every component or route test phase must be written and
verified RED before its implementation tasks begin. Per
`AGENTS.md` → "Frontend test guidelines", every Vitest test that
renders DOM MUST call `expectNoAxeViolations(container)`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependencies on incomplete tasks — safe
  to run in parallel
- **[Story]**: Maps the task to a user story (US1, US2, US3)
- File paths are absolute or repo-rooted; pick whichever the task
  description shows

## Path Conventions

GameNight default: backend at repo root (`lib/`, `test/`); frontend in
`assets/` (source `assets/js/`, styles `assets/css/`, e2e
`assets/e2e/`, static assets served from `priv/static/`). This feature
is **frontend-only** — no `lib/` or `test/` paths appear below.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Documenting build-time configuration and reserving the OG
image asset path. No business logic.

- [X] T001 [P] Add `VITE_SITE_ORIGIN`, `VITE_CONTACT_EMAIL`, `VITE_SOCIAL_URL` documentation block to `assets/.env.example`. Each entry MUST have a one-line comment explaining the value, the dev fallback, and the production-source-of-truth (e.g., "set in deploy config to the canonical site origin"). If `assets/.env.example` does not exist, create it.
- [X] T002 [P] Reserve the OG image path by committing a 1200×630 placeholder PNG at `priv/static/images/og/landing.png`. Source: any single-color parchment-tinted PNG with the literal text "GameNight (placeholder)" — generated locally via ImageMagick or an equivalent and optimized with `pngquant`. The branded final asset is delivered in T033 [US3]; this placeholder unblocks every other task that references the path.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build-time config module + per-route metadata constants.
Both are consumed by all three user stories, so they MUST land before
any story-specific component is built.

**⚠️ CRITICAL**: No user story work can begin until this phase
completes.

- [X] T003 Write site-config tests at `assets/js/lib/config/site-config.test.ts` covering: (a) `siteOrigin` has no trailing slash; (b) `contactEmail` matches `/.+@.+/`; (c) `socialUrl` parses as a URL; (d) the three constants are exported and typed. Run tests, verify RED.
- [X] T004 Implement the site-config module at `assets/js/lib/config/site-config.ts` per [data-model.md](./data-model.md) C1 — read `import.meta.env.VITE_SITE_ORIGIN`, `VITE_CONTACT_EMAIL`, `VITE_SOCIAL_URL` with the documented fallbacks. Re-run T003 tests, verify GREEN.
- [X] T005 Write per-route meta tests at `assets/js/features/landing/content/meta.test.ts` covering, for `landingMeta` / `privacyMeta` / `termsMeta`: title length ≤ 70, description length ≤ 160, `ogImagePath` starts with `/`, `ogTitle` and `ogDescription` are non-empty strings, the literal copy from [contracts/route-contracts.md](./contracts/route-contracts.md) matches. Run tests, verify RED.
- [X] T006 Implement `assets/js/features/landing/content/meta.ts` per [data-model.md](./data-model.md) C2 with the three exported constants populated from [contracts/route-contracts.md](./contracts/route-contracts.md). Re-run T005 tests, verify GREEN.

**Checkpoint**: Foundation ready — user stories may begin in priority
order (or in parallel given staffing).

---

## Phase 3: User Story 1 — First-time visitor converts (Priority: P1) 🎯 MVP

**Goal**: Replace the placeholder `/` with a scannable, GM-first
marketing page (hero → how-it-works → feature highlights → closing
CTA → marketing footer), plus stub `/privacy` and `/terms` pages so
the footer is never broken. The page is anonymous-only at this point;
the welcome-back banner ships in US2 and OG/Twitter share metadata
ships in US3.

**Independent Test**: Open `/` in an Incognito window. Scroll the
full page. Click **Register** in the hero, confirm `/register`. Open
`/?invite=abc123`, click **Register**, confirm the destination
preserves `?invite=abc123`. Click **Privacy** in the footer, confirm
`/privacy` renders the draft disclaimer + structured body. Same for
**Terms**. Run the new Vitest suite — all green, all
`expectNoAxeViolations` pass.

### Tests for User Story 1 (REQUIRED — write and verify RED first) ⚠️

> **NON-NEGOTIABLE: Write these tests FIRST, run them, and verify
> they FAIL for the expected reason before any implementation task in
> this phase begins.** Every test that renders DOM MUST call
> `expectNoAxeViolations(container)`.

- [X] T007 [P] [US1] Write `assets/js/features/landing/components/draft-disclaimer.test.tsx` asserting: renders with `role="status"`, contains the canonical regex `/draft.*not legal advice/i`, links the contact mailto from `siteConfig.contactEmail`, axe-clean.
- [X] T008 [P] [US1] Write `assets/js/features/landing/components/landing-hero.test.tsx` asserting: a single `h1` with text "GameNight" carrying `data-route-heading + tabIndex={-1}`; the tagline `<p>` from [contracts/route-contracts.md](./contracts/route-contracts.md); exactly three value-prop bullets; primary `<a>`/`<Link>` with accessible name "Register" pointing to `/register`; secondary affordance with accessible name matching `/sign in/i` pointing to `/sign-in`; axe-clean. Cover the query-param preservation behavior (`/?invite=abc123` → both CTAs preserve `?invite=abc123` in their hrefs).
- [X] T009 [P] [US1] Write `assets/js/features/landing/components/how-it-works.test.tsx` asserting: an `<ol>` with exactly three `<li>` numbered steps whose visible text matches the three steps in [contracts/route-contracts.md](./contracts/route-contracts.md); a section heading; axe-clean.
- [X] T010 [P] [US1] Write `assets/js/features/landing/components/feature-highlights.test.tsx` asserting: exactly four highlight items, each with a heading and a body line, matching the four highlights in [contracts/route-contracts.md](./contracts/route-contracts.md); a section heading; axe-clean.
- [X] T011 [P] [US1] Write `assets/js/features/landing/components/closing-cta.test.tsx` asserting: section heading, one reinforcing line, primary `<Link>` with accessible name "Register" pointing to `/register`; query-param preservation; axe-clean.
- [X] T012 [P] [US1] Write `assets/js/features/landing/components/marketing-footer.test.tsx` asserting: a `<footer>` landmark; copyright text including `new Date().getFullYear()`; Privacy link → `/privacy`; Terms link → `/terms`; Contact link → `mailto:${siteConfig.contactEmail}`; one social link → `siteConfig.socialUrl` with `target="_blank" rel="noreferrer"`; each interactive element's hit area ≥ 24×24 (assert via class probe or layout test); axe-clean.
- [X] T013 [P] [US1] Update `assets/js/routes/index.test.tsx` (anonymous-only describe block at this point) to assert: hero, how-it-works, feature-highlights, closing-cta, and marketing-footer all render; **no welcome-back banner** when no `<AuthProvider>` is mounted; the route's `head()` factory output includes `<title>` matching `landingMeta.title` and `<meta name="description">` matching `landingMeta.description` (assert via `Route.options.head?.()` — no jsdom dependency); query-param preservation (`/?invite=abc`); axe-clean. Existing tests in this file should be replaced; capture the prior assertions as a regression note in the commit message.
- [X] T014 [P] [US1] Write `assets/js/routes/privacy.test.tsx` asserting: a single `h1` "Privacy Policy" with `data-route-heading + tabIndex={-1}`; the canonical "draft, not legal advice" disclaimer (via `<DraftDisclaimer />` regex match); a "Last revised" line; the structured section headings from [contracts/privacy-stub.md](./contracts/privacy-stub.md); the Contact mailto; the marketing footer is rendered; the route's `head()` returns the `privacyMeta` title and description; axe-clean.
- [X] T015 [P] [US1] Write `assets/js/routes/terms.test.tsx` mirroring T014 against [contracts/terms-stub.md](./contracts/terms-stub.md): `h1` "Terms of Service", same disclaimer assertion, the structured section headings, contact mailto, footer present, head config asserts `termsMeta`, axe-clean.
- [X] T016 [P] [US1] Add a Playwright smoke at `assets/e2e/landing.spec.ts` covering: (a) anonymous visit to `/` shows the hero h1 in the accessibility tree; (b) clicking the primary `Register` link navigates to `/register`; (c) visiting `/?invite=abc123` and clicking `Register` navigates with query preserved; (d) the footer's `Privacy` and `Terms` links each open the corresponding stub page with the disclaimer visible; (e) **viewport responsiveness (FR-020)**: at a mobile viewport (`375×812`), the hero, how-it-works, feature highlights, and footer all reflow to a single column with no horizontal scrollbar (`page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)`); at a desktop viewport (`1440×900`), the body content does not stretch beyond the configured max width. Use the existing `assets/e2e/fixtures.ts` infrastructure. Run tests, verify RED.

### Implementation for User Story 1

- [X] T017 [P] [US1] Implement `assets/js/features/landing/components/draft-disclaimer.tsx`. A small section with `role="status"`, gold-bordered parchment treatment, the canonical disclaimer text from [contracts/privacy-stub.md](./contracts/privacy-stub.md), and a `mailto:${siteConfig.contactEmail}` link.
- [X] T018 [P] [US1] Implement `assets/js/features/landing/components/landing-hero.tsx`. Compose: `<header>`, `<h1 data-route-heading tabIndex={-1}>` with the wordmark, the tagline `<p>`, an `<ul>` of three value-prop bullets, a primary `<Link to="/register" search={preserveSearch}>` rendered as a default-size shadcn `<Button>`, and a secondary `<Link to="/sign-in" search={preserveSearch}>` rendered as a `<Button variant="link">`. Use [contracts/route-contracts.md](./contracts/route-contracts.md) verbatim for the visible copy.
- [X] T019 [P] [US1] Implement `assets/js/features/landing/components/how-it-works.tsx` rendering the three numbered steps verbatim from [contracts/route-contracts.md](./contracts/route-contracts.md), as an `<ol>` with the section heading marked up so screen-reader users skim it sensibly.
- [X] T020 [P] [US1] Implement `assets/js/features/landing/components/feature-highlights.tsx` rendering the four highlights verbatim from [contracts/route-contracts.md](./contracts/route-contracts.md), as cards or rows depending on viewport (Tailwind responsive classes; no JS-driven layout).
- [X] T021 [P] [US1] Implement `assets/js/features/landing/components/closing-cta.tsx`: heading + reinforcing line + primary `<Link to="/register" search={preserveSearch}>` rendered as a default-size shadcn `<Button>`.
- [X] T022 [P] [US1] Implement `assets/js/features/landing/components/marketing-footer.tsx`. A `<footer>` landmark with the copyright line, three text links (`Privacy` → `/privacy`, `Terms` → `/terms`, `Contact` → `mailto:${siteConfig.contactEmail}`), and one social `<a>` to `siteConfig.socialUrl` with `target="_blank" rel="noreferrer"`. Each text link has `py-2` for ≥ 24 px hit area.
- [X] T023 [P] [US1] Implement `assets/js/features/landing/content/privacy-draft.tsx`. Render every section from [contracts/privacy-stub.md](./contracts/privacy-stub.md) verbatim (replacing `{contactEmail}` with `siteConfig.contactEmail`). Keep the structure section-by-section so a future copy edit is one paragraph at a time.
- [X] T024 [P] [US1] Implement `assets/js/features/landing/content/terms-draft.tsx` mirroring T023 against [contracts/terms-stub.md](./contracts/terms-stub.md).
- [X] T025 [US1] Overhaul `assets/js/routes/index.tsx` to compose `<LandingHero />`, `<HowItWorks />`, `<FeatureHighlights />`, `<ClosingCta />`, `<MarketingFooter />` in order. Define `head: () => ({ meta: [{ title: landingMeta.title }, { name: "description", content: landingMeta.description }] })`. The query-param-preserving `Link` `search` callback is the function `(prev) => prev` (TanStack Router idiom). The welcome-back banner is **not** wired here — that lands in T031 [US2]. Depends on T017–T022. Re-run T013, verify GREEN.
- [X] T026 [US1] Implement `assets/js/routes/privacy.tsx` rendering `<DraftDisclaimer />` then `<PrivacyDraft />` then `<MarketingFooter />`, with `head: () => ({ meta: [{ title: privacyMeta.title }, { name: "description", content: privacyMeta.description }] })`. The `<h1 data-route-heading tabIndex={-1}>` lives inside `<PrivacyDraft />`. Depends on T017, T022, T023. Re-run T014, verify GREEN.
- [X] T027 [US1] Implement `assets/js/routes/terms.tsx` mirroring T026 with `<TermsDraft />` and `termsMeta`. Depends on T017, T022, T024. Re-run T015, verify GREEN.
- [X] T027a [US1] Regenerate the TanStack Router route tree (run `bun run dev` once or `bunx tsr generate` from `assets/`) so `assets/js/routeTree.gen.ts` includes the new `/privacy` and `/terms` routes. Commit the regenerated file. CI will fail without it (per AGENTS.md "routeTree.gen.ts is committed").
- [ ] T028 [US1] Re-run T016 Playwright smoke, verify GREEN. If a test fails, fix the implementation — never the test.

**Checkpoint**: User Story 1 fully functional. The MVP can ship: a
prospective GM lands on `/`, understands the product, clicks
`Register`, and follows the existing registration flow. Footer links
no longer dangle.

---

## Phase 4: User Story 2 — Authenticated welcome-back banner (Priority: P2)

**Goal**: An authenticated visitor at `/` sees a slim banner above
the hero and reaches `/dashboard` in one click. The marketing
content remains scrollable below.

**Independent Test**: Sign in. Navigate to `/`. Confirm the banner
appears at the top. Click `Go to dashboard`, confirm `/dashboard`.
Sign out, refresh `/`, confirm the banner is gone.

### Tests for User Story 2 (REQUIRED — write and verify RED first) ⚠️

- [X] T029 [P] [US2] Write `assets/js/features/landing/components/welcome-back-banner.test.tsx` asserting: returns `null` when no `<AuthProvider>` is mounted (covers the optional-auth case); returns `null` when `auth.isAuthenticated === false`; renders a banner region with the welcome message and a `<Link to="/dashboard">` rendered as a default-size shadcn `<Button>` when authenticated; uses the email-derived friendly name when `useCurrentUser()` resolves; falls back to a generic message while pending and on error (does not hide); axe-clean. Mock `useCurrentUser` per existing patterns in `assets/js/features/current-user/hooks.test.ts`.
- [X] T030 [P] [US2] Add an authenticated-state describe block to `assets/js/routes/index.test.tsx` asserting: when mounted with an authenticated `<AuthProvider>` initialState, the welcome-back banner is in the document and the marketing content remains rendered below; clicking `Go to dashboard` navigates to `/dashboard`; on simulated session expiry (re-render with anonymous state), the banner disappears with no flash. Run tests, verify RED.

### Implementation for User Story 2

- [X] T031 [P] [US2] Implement `assets/js/features/landing/components/welcome-back-banner.tsx`. Use `useOptionalAuth()` to gate rendering. When authenticated, call `useCurrentUser()` and derive `friendlyName` per the existing dashboard pattern (`displayName.split("@")[0] || "Adventurer"`). Render a `position: relative` banner (NOT sticky/fixed — see Constitution IV / 2.4.11) with the welcome line and a `<Link to="/dashboard">` button. No banner = no `position: fixed/sticky` regression on the existing global navbar.
- [X] T032 [US2] Wire `<WelcomeBackBanner />` into `assets/js/routes/index.tsx` immediately above `<LandingHero />`. Re-run T030, verify GREEN.

**Checkpoint**: Authenticated returners are one click from
`/dashboard` again. Both US1 and US2 are independently functional.

---

## Phase 5: User Story 3 — Share-ready unfurl (Priority: P3)

**Goal**: Pasting the production URL into Discord / Slack / iMessage
unfurls with the configured title, description, and a branded OG
image.

**Independent Test**: Build a production bundle with a real
`VITE_SITE_ORIGIN`, deploy to staging, paste the URL into Discord, a
Slack DM, and iMessage. Each unfurl renders the title, the
description, and the 1200×630 OG image without fallback or broken
thumbnail. Run quickstart.md "Share preview" section.

### Tests for User Story 3 (REQUIRED — write and verify RED first) ⚠️

- [X] T033 [P] [US3] Extend the head config tests across `assets/js/routes/index.test.tsx`, `privacy.test.tsx`, `terms.test.tsx` to assert that each route's `head()` factory output now includes the OG and Twitter Card meta tags from [contracts/route-contracts.md](./contracts/route-contracts.md), and that the `og:image` / `twitter:image` URLs are absolute (`${siteConfig.siteOrigin}${meta.ogImagePath}` — assert against the constructed URL string, not jsdom). Run tests, verify RED.

### Implementation for User Story 3

- [X] T034 [US3] Extend each route's `head()` factory in `assets/js/routes/index.tsx`, `privacy.tsx`, `terms.tsx` to emit OG (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:image:width`, `og:image:height`) and Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) meta. Compose absolute URLs by concatenating `siteConfig.siteOrigin + meta.ogImagePath`. Re-run T033, verify GREEN.
- [ ] T035 [US3] Replace the placeholder OG image at `priv/static/images/og/landing.png` with the final 1200×630 brand-only asset (parchment surface, "GameNight" wordmark in Noto Serif, the page tagline below in Be Vietnam Pro, plus the `<CornerOrnament>` motif). Optimize via `pngquant` or `oxipng`; final ≤ 100 KB. Run quickstart.md "Share preview" against a staging deploy.

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Run the manual accessibility smoke from [quickstart.md](./quickstart.md) ("Accessibility — manual audit"): keyboard-only walk of `/`, `/privacy`, `/terms`; route-change focus moves to the page `<h1>` and is announced; reduced-motion behavior; target-size verification on footer links and the banner button. Record results in the PR description.
- [ ] T037 [P] Run the Lighthouse mobile / 4G smoke from [quickstart.md](./quickstart.md) ("Performance smoke") against `/`. Confirm LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Capture the report and link it from the PR description.
- [X] T038 Verify per-route bundle budgets (≤ 6 KB gzipped for `/`, ≤ 2 KB gzipped each for `/privacy` and `/terms`) via the project's existing size-limit configuration. If `size-limit` does not yet have entries for these routes, add them in the same task. Failing budgets blocks the PR — adjust the implementation, not the budget.
- [ ] T039 Run `mix precommit` from the repo root and `bun run test` plus `bun run test:e2e` from `assets/`. All gates green.
- [X] T040 [P] Reduced-motion compliance check (FR-021): grep the `assets/js/features/landing/` tree for CSS classes implying motion (`transition-`, `animate-`, `motion-safe:`, `motion-reduce:`). For every match, either (a) confirm a matching `motion-reduce:` variant suppresses the effect, or (b) add a Vitest test in the relevant `*.test.tsx` that mocks `window.matchMedia('(prefers-reduced-motion: reduce)')` and asserts the animation class is absent. If zero matches found, record "no motion shipped" in the PR description and consider FR-021 satisfied vacuously.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: independent of everything else; T001 and T002 may run in parallel.
- **Foundational (Phase 2)**: depends on Setup. T003–T006 are sequential within Phase 2 (test → implement → test → implement). Blocks every user story.
- **User Stories (Phase 3+)**: depend on Foundational (Phase 2). May run in parallel across stories given staffing; in solo execution, take in priority order P1 → P2 → P3.
- **Polish (Phase 6)**: depends on whichever stories are in scope for the release.

### User Story Dependencies

- **US1 (P1)**: requires Phase 2. Self-contained otherwise.
- **US2 (P2)**: requires Phase 2 and the existence of `routes/index.tsx` from T025. Otherwise independent of US1's other components.
- **US3 (P3)**: requires Phase 2 and the existence of `routes/index.tsx`, `routes/privacy.tsx`, and `routes/terms.tsx` from T025–T027. Independent of US2.

### Within Each User Story

- Tests written first, run, verified RED before implementation begins (Constitution Principle I).
- Component implementations (T017–T024, T031) happen in any order subject to file independence (`[P]`).
- Route compositions (T025, T026, T027, T032, T034) depend on their components being implemented and on the existing `__root.tsx` layout (untouched in this feature).

### Parallel Opportunities

- T001, T002 in parallel.
- T007–T016 in parallel (10 tests, 10 files).
- T017–T024 in parallel after the matching tests are RED.
- T029, T030 in parallel.
- T033 is a single test extension across three files — write as one task.
- Across stories: with multiple developers, US1 / US2 / US3 may proceed concurrently after Phase 2.

---

## Parallel Example: User Story 1 tests

```bash
# Launch all US1 component tests in parallel — every one of these is
# in its own file, so there are no merge conflicts:

Task: "Write draft-disclaimer.test.tsx" (T007)
Task: "Write landing-hero.test.tsx" (T008)
Task: "Write how-it-works.test.tsx" (T009)
Task: "Write feature-highlights.test.tsx" (T010)
Task: "Write closing-cta.test.tsx" (T011)
Task: "Write marketing-footer.test.tsx" (T012)

# Then route-level test files in parallel:

Task: "Update routes/index.test.tsx" (T013)
Task: "Write routes/privacy.test.tsx" (T014)
Task: "Write routes/terms.test.tsx" (T015)
Task: "Write assets/e2e/landing.spec.ts" (T016)

# Verify all RED, then launch component implementations in parallel:

Task: "Implement draft-disclaimer.tsx" (T017)
Task: "Implement landing-hero.tsx" (T018)
Task: "Implement how-it-works.tsx" (T019)
Task: "Implement feature-highlights.tsx" (T020)
Task: "Implement closing-cta.tsx" (T021)
Task: "Implement marketing-footer.tsx" (T022)
Task: "Implement privacy-draft.tsx" (T023)
Task: "Implement terms-draft.tsx" (T024)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001–T002): documenting env vars + reserving the OG image path.
2. Phase 2 (T003–T006): site-config + per-route meta constants. RED → GREEN per task.
3. Phase 3 (T007–T028): tests for every component and route, all RED → all GREEN.
4. **Stop and validate**: run the quickstart.md anonymous walk + the Vitest suite + the Playwright `landing.spec.ts`. Ship to staging.

### Incremental Delivery

1. MVP (US1) ships. Marketing page + stubs live; auth'd users still see the page (no banner) and can sign out / register without regression.
2. US2 (T029–T032) adds the welcome-back banner. Ship.
3. US3 (T033–T035) adds OG/Twitter Card metadata + the branded OG image. Ship.
4. Polish (T036–T039) gates the release.

### Parallel Team Strategy

Once Phase 2 lands:

- Developer A: US1 component tests + implementations (T007–T028).
- Developer B: US2 (T029–T032) — pulls in `routes/index.tsx` once T025 lands.
- Developer C: US3 (T033–T035) — pulls in all three routes once T025–T027 land.

The hand-offs are limited to the route files, so `git rebase`-style coordination is sufficient — no shared component is edited by more than one story.

---

## Notes

- `[P]` tasks operate on different files with no incomplete-task dependencies.
- `[Story]` labels (US1 / US2 / US3) trace tasks back to the spec's user stories; setup, foundational, and polish tasks have no story label.
- Verify tests RED before implementation; verify GREEN after. The
  `/speckit-implement` flow handles this automatically when invoked.
- Commit at each natural checkpoint (e.g., after T006, after T028, after T032, after T035) so the history is bisectable.
- Avoid: cross-story dependencies that would block a single-story slice from shipping.
