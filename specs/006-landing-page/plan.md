# Implementation Plan: Landing Page

**Branch**: `006-landing-page` | **Date**: 2026-05-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-landing-page/spec.md`

---

## Summary

Replace the current one-line placeholder at `/` with an appealing, GM-first
marketing page that explains what GameNight does, walks a prospective Game
Master through how the product is used, surfaces a few feature highlights,
and converts to **Register**. Authenticated visitors see the same content
with a slim "welcome back" banner that one-clicks them to `/dashboard`.
Add `/privacy` and `/terms` stub routes that ship draft, best-practice
policy content (with a clear "draft, not legal advice" disclaimer) so the
new marketing footer is never broken. Add Open Graph / Twitter Card
metadata so URL pastes in Slack / Discord / iMessage unfurl cleanly.

**Technical approach**:

- **Frontend-only feature.** No backend changes — no Ash resources, no
  JSON:API actions, no migrations, no auth changes.
- **TanStack Router `head` API** (available in `@tanstack/react-router`
  1.160+, already pinned) is the per-route source of truth for `<title>`,
  meta description, OG / Twitter Card tags. No new SEO/head-management
  dependency.
- **Adventurer's Journal design system** (parchment surface, Noto Serif
  headlines, forest-green primary, gold tertiary) is consumed via the
  existing `--gn-*` and shadcn semantic tokens in
  [`assets/css/app.css`](../../assets/css/app.css). No new tokens, no
  product imagery, no stock illustration (FR-019).
- **Static OG image** committed at `priv/static/images/og/landing.png`
  (1200×630, brand-only — wordmark + tagline on parchment, generated
  once and kept versioned). Absolute URL composed from a runtime-config
  base URL.
- **Feature directory** at `assets/js/features/landing/` for all of the
  page's section components (hero, how-it-works, feature highlights,
  closing CTA, welcome-back banner, marketing footer) and the content
  modules for the privacy / terms drafts.
- **Tests-first per the constitution.** Vitest + React Testing Library
  + `expectNoAxeViolations(...)` for every rendered component; one
  Playwright smoke covering the conversion flow and a smoke check for
  query-param preservation. Route-change focus on `<h1 data-route-heading>`
  is opted into via the existing `useFocusOnRouteChange` hook (no new
  mechanism).

This feature ships with **zero new persisted data**, **zero schema
migrations**, **zero new write paths**, **zero new runtime
dependencies**, and **zero changes to authenticated chrome** (the new
marketing footer renders only on `/`, `/privacy`, and `/terms`).

## Technical Context

**Language/Version**: TypeScript 5.x; React 19.1; TanStack Router 1.160+; Vite 6.3.
**Primary Dependencies**: TanStack Router (`head` API for per-route document head), shadcn `<Button>`, existing `<CornerOrnament>` decorative primitive, existing `useFocusOnRouteChange` + `<A11yAnnouncer>`. **No new dependencies.**
**Storage**: N/A. Pure UI feature; the contact email and the canonical site origin are read from build/runtime config (Vite `import.meta.env`) so they can change without re-shipping markup (FR-015).
**Testing**: Vitest + React Testing Library + vitest-axe (component, route, hook); Playwright smoke for the conversion flow on `/`. Per the constitution and `assets/test/a11y` conventions, every rendered component test calls `expectNoAxeViolations(container)`.
**Target Platform**: Modern evergreen browsers (latest 2 of Chrome / Firefox / Safari / Edge; Mobile Safari + Android Chrome latest 2). Pure SPA; no SSR/RSC.
**Project Type**: Web app (Phoenix backend + React/TanStack SPA), already established. This feature lives entirely in `assets/js/` plus a single static image under `priv/static/images/og/`.
**Performance Goals**: SC-006 — LCP ≤ 2.5 s on a mid-tier mobile device over 4G for a cold visit to `/`. INP ≤ 200 ms (Constitution VI). The page is text + small SVG ornaments only; no hero image or video.
**Constraints**: WCAG 2.2 AA (Constitution IV) — keyboard reachable, axe-clean, route-change focus, 24×24 minimum target size on the welcome-back banner button and footer link affordances. `prefers-reduced-motion` honored for any decorative transitions. Bundle delta budget: ≤ 6 KB gzipped for the landing route chunk and ≤ 2 KB each for the privacy/terms route chunks (matches the per-route budget pattern from feature 003 / 004).
**Scale/Scope**: One overhauled route (`/`), two new stub routes (`/privacy`, `/terms`), one feature directory (`assets/js/features/landing/`) with ~6 section components, one static OG image asset, no backend changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First Development (NON-NEGOTIABLE)** — **PASS**.
  - Vitest: per-component tests (`landing-hero.test.tsx`, `how-it-works.test.tsx`, `feature-highlights.test.tsx`, `closing-cta.test.tsx`, `welcome-back-banner.test.tsx`, `marketing-footer.test.tsx`) — every test renders DOM and calls `expectNoAxeViolations(container)`.
  - Vitest: route-level tests for `/`, `/privacy`, `/terms` — assert sections present, h1 is unique, `data-route-heading + tabIndex={-1}` on h1, query-param preservation on Register / Sign in clicks, banner-only-when-authed behavior, axe-clean.
  - Vitest: `head` config test for each route — assert title, meta description, OG / Twitter Card tags resolve to the configured values via the TanStack Router head API (asserted on the `Route.options.head` result, not on jsdom — keeps the test deterministic).
  - Playwright smoke: anonymous visit to `/` → click primary CTA → `/register`. Authenticated visit to `/` → click banner CTA → `/dashboard`. Smoke runs as part of the existing Playwright suite; not a new lane.
  - Every test goes RED first per `/speckit-implement`.

- **II. Security & Authorization by Default (NON-NEGOTIABLE)** — **PASS / N/A**.
  - No Ash resources are touched. No new actions, no new policies. The only new code paths are anonymous-reachable view code.
  - No new secrets. The contact email is **not** a secret — it's a public address that ships in the rendered HTML — but it's centralized in one config module (`assets/js/lib/config/site-config.ts`) so it can change in one place. The canonical origin (used to construct absolute OG image URLs) is read from `import.meta.env.VITE_SITE_ORIGIN` with a localhost fallback for dev.
  - No new dependencies → Trivy / npm audit / Sobelow have nothing new to scan against. Existing security gates continue to apply unchanged.
  - No authentication flows change. The welcome-back banner is rendered conditionally on the existing `useOptionalAuth` value already populated by the `<script id="auth-state">` JSON island; it does **not** introduce any token reads or storage.
  - No CSRF / cookie behavior change.

- **III. API Contract via JSON:API (NON-NEGOTIABLE)** — **PASS / N/A**.
  - No new Ash `json_api` blocks, no contract changes. `mix ash.codegen --check` and `mix ash_typescript.codegen` continue to pass without regenerating anything.
  - Pure SPA — no SSR, no RSC. The `head` API renders into the document on the client; this is the established TanStack Router idiom and stays within pure-SPA boundaries.

- **IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)** — **PASS**.
  - axe-core via vitest-axe asserted in every component and route test (FR-022 is enforced by the lane that already runs on every test).
  - Route-change focus management: each new route's primary heading carries `data-route-heading + tabIndex={-1}`; the existing `<FocusManager>` mounted in `__root.tsx` moves focus there on navigation and the existing `<A11yAnnouncer>` announces the destination. This feature **opts into** the established mechanism — it does not reinvent it.
  - WCAG 2.2 new AA criteria:
    - **2.4.11 Focus Not Obscured**: the welcome-back banner is `position: relative` (not sticky/fixed). The site-wide sticky `<NavBar>` already accounts for focus visibility on every other route; it continues to do so here.
    - **2.5.7 Dragging Movements**: no drag interactions on this surface.
    - **2.5.8 Target Size (≥ 24×24)**: hero CTAs use shadcn's default-size `<Button>` (≥ 32 px tall — passes). The welcome-back banner's "Go to dashboard" link is rendered as a default-size `<Button>` (passes). Footer links are inline text but each receives `py-2` to push the hit area to ≥ 24 px (verified per-component).
  - `prefers-reduced-motion` honored on any transitions or scroll-reveal effects we ship; tests assert that animation-related classes are not applied when the media query is set (mocked via `matchMedia`).
  - Manual keyboard / screen-reader smoke before release: tab through `/` end-to-end; VoiceOver / NVDA pass on the hero, banner, footer, and stub-page disclaimers. Recorded in `quickstart.md`.

- **V. UX for Non-Technical Operators** — **PASS**.
  - Copy is reviewed for plain language: no engineering jargon ("session", "scope", "resource") in the visible page text. The drafted privacy/terms stubs are written for a layperson and avoid legalese where avoidable; required legal terms are kept short and parenthesized in plain language.
  - No destructive actions on this surface; no forms; no async loading state to design (the page is statically rendered client-side).
  - The "draft, not legal advice" disclaimer at the top of `/privacy` and `/terms` is in plain language and unmissable (a styled callout, not a fine-print line at the bottom).

- **VI. Performance Discipline** — **PASS**.
  - Targets: SC-006 LCP ≤ 2.5 s on mid-tier mobile / 4G. The page is text + a couple of small SVG ornaments — LCP element is the hero `<h1>`. The OG image is **never** rendered on-page (only emitted in `<meta>` tags), so it does not impact LCP.
  - Bundle: ≤ 6 KB gzipped for the `/` route chunk; ≤ 2 KB each for `/privacy` and `/terms`. The size-limit budget pattern from earlier features extends to these route chunks.
  - INP ≤ 200 ms is trivially met on a static page with no JS-heavy interactions.
  - No new telemetry on the backend (no actions added). Frontend `web-vitals` reporting (already wired) continues to capture LCP/INP/CLS for these routes.

**Result**: All six principles PASS. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-landing-page/
├── plan.md                      # This file
├── research.md                  # Phase 0 — head API, OG image, content drafting
├── data-model.md                # Phase 1 — config + content shapes (no entities)
├── quickstart.md                # Phase 1 — verify locally
├── contracts/
│   ├── route-contracts.md       # Phase 1 — route + head metadata contract
│   ├── privacy-stub.md          # Phase 1 — drafted /privacy body
│   └── terms-stub.md            # Phase 1 — drafted /terms body
├── checklists/
│   └── requirements.md          # From /speckit-specify
└── tasks.md                     # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code

**Backend**: no changes.

**Frontend** (one overhauled route, two new routes, one feature dir, one new config module, one static asset):

```text
assets/js/
├── routes/
│   ├── index.tsx                          # OVERHAUL — composes the landing page sections
│   ├── index.test.tsx                     # extend — anonymous + authed states, query-param preservation, axe, head config
│   ├── privacy.tsx                        # NEW — renders <PrivacyDraft /> with disclaimer
│   ├── privacy.test.tsx                   # NEW — heading, disclaimer, mailto, axe
│   ├── terms.tsx                          # NEW — renders <TermsDraft /> with disclaimer
│   └── terms.test.tsx                     # NEW
├── features/landing/
│   ├── components/
│   │   ├── landing-hero.tsx               # NEW — wordmark, tagline, 3 bullets, primary/secondary CTAs
│   │   ├── landing-hero.test.tsx
│   │   ├── how-it-works.tsx               # NEW — 3 numbered steps
│   │   ├── how-it-works.test.tsx
│   │   ├── feature-highlights.tsx         # NEW — ≥4 highlight cards
│   │   ├── feature-highlights.test.tsx
│   │   ├── closing-cta.tsx                # NEW — repeats primary Register CTA
│   │   ├── closing-cta.test.tsx
│   │   ├── welcome-back-banner.tsx        # NEW — slim banner; renders only when authed
│   │   ├── welcome-back-banner.test.tsx
│   │   ├── marketing-footer.tsx           # NEW — copyright, Privacy, Terms, Contact mailto, social
│   │   └── marketing-footer.test.tsx
│   └── content/
│       ├── meta.ts                        # NEW — title, description, OG / Twitter Card config consumed by Route.head
│       ├── privacy-draft.tsx              # NEW — drafted stub body
│       └── terms-draft.tsx                # NEW — drafted stub body
└── lib/
    └── config/
        └── site-config.ts                 # NEW — { siteOrigin, contactEmail, socialUrl } derived from import.meta.env

priv/static/images/og/
└── landing.png                            # NEW — 1200×630 brand-only OG image
```

**Structure Decision**: Web application; this feature lives entirely in `assets/js/` plus one static image. Pattern matches features 003 / 004: feature components live in `assets/js/features/<feature>/components/`, route files stay thin and compose the feature components, and per-component tests own the axe assertion.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified.**

No violations. Table omitted.

---

## Notes

- The user, via `/speckit-plan` arguments, expanded FR-014's interpretation: privacy/terms stubs ship **drafted best-practice content** (not "coming soon" placeholders). The spec was updated in lockstep, and the drafted bodies live under `contracts/privacy-stub.md` and `contracts/terms-stub.md`. The implementation pulls those drafts into JSX modules under `assets/js/features/landing/content/`.
- The phrase "draft — not legal advice; consult counsel before relying on this document" is non-negotiable on both stub pages. It is asserted in the route tests so a future edit cannot silently remove it.
- The OG image is **not** in scope for tasteful product art — it's a brand-only mark on parchment. Any iteration toward a richer marketing image is a follow-up.
