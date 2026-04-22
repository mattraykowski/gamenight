<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0
Bump rationale: MINOR. Adds new mandatory guidance to four existing
sections (Principles II, III, IV; Development Workflow). No principle
removed or relaxed; no NON-NEGOTIABLE rule softened. Per the
versioning policy, adding mandatory guidance is a MINOR bump.

Amendment history:
  1.0.0 (2026-04-21): First ratified constitution.
  1.1.0 (2026-04-21): Added Credo and Dialyzer as mandatory CI gates.
  1.2.0 (2026-04-21): Absorbed findings from Ash + React/TanStack
    best-practice review (see below).

Principles (no renames or removals in this amendment):
  I. Test-First Development (NON-NEGOTIABLE)
  II. Security & Authorization by Default (NON-NEGOTIABLE) — expanded
  III. API Contract via JSON:API (NON-NEGOTIABLE) — expanded
  IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE) — expanded
  V. User Experience for Non-Technical Operators
  VI. Performance Discipline via Core Web Vitals

Modifications:
  ~ Principle II — added "No direct data-layer access" rule (Ash code
    interfaces only; Ecto Repo writes bypass policies) and "Token &
    session storage" rule (httpOnly cookies, in-memory access tokens,
    CSRF protection for cookie-auth'd mutations).
  ~ Principle III — clarified that the React app is a pure SPA;
    React Server Components, Next.js, and SSR frameworks are
    out of scope.
  ~ Principle IV — added "Route-change focus management" rule and
    explicit enumeration of WCAG 2.2 AA new criteria (2.4.11 Focus
    Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target Size).
  ~ Development Workflow & Quality Gates — added `mix ash.codegen
    --check` (snapshot drift) and `ash_typescript.codegen` +
    `git diff --exit-code` (generated-client drift) as mandatory
    CI gates.

Added sections: none
Removed sections: none

Templates status:
  ✅ .specify/memory/constitution.md (this file)
  ✅ .specify/templates/plan-template.md — Constitution Check
     prompts expanded to surface the new rules
  ✅ .specify/templates/tasks-template.md — compatible
  ✅ .specify/templates/spec-template.md — compatible
  ✅ .specify/templates/checklist-template.md — compatible

Follow-up implementation TODOs (not constitution changes, but
required for the gates to be enforceable):
  - Add `:credo` and `:dialyxir` to `mix.exs` dev/test deps and
    wire `mix credo --strict` + `mix dialyzer` into `precommit`
    and CI.
  - Wire `mix ash.codegen --check` and `mix ash_typescript.codegen`
    (with `git diff --exit-code`) into CI.
  - Adopt `size-limit` (or equivalent) with a documented bundle
    budget (initial target: ~170 KB gzipped for the SPA entry).
  - Adopt `web-vitals` library reporting real-user INP.
  - Wire `@axe-core/playwright` at the route level and
    `vitest-axe` at the component level.
  - Enable React Compiler via the SWC/Babel plugin and keep
    `eslint-plugin-react-compiler` on.
-->

# GameNight Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

All production code MUST be written using strict red-green-refactor TDD.
For every change:

1. Write a failing test that expresses the behavior.
2. Run the test and verify it FAILS for the expected reason (RED).
3. Write the minimum code to make it pass (GREEN).
4. Refactor with the test suite protecting the behavior.

Commit and PR discipline MUST reflect this: a commit that introduces
new behavior MUST either include the failing test in the same commit
or be preceded by a commit that adds the failing test. PRs that add
implementation without accompanying tests MUST be rejected, including
scaffolding, glue code, and "trivial" helpers.

**Backend**: ExUnit covers Ash resources, actions, policies, and
Phoenix controllers. Policy tests MUST cover both authorized and
unauthorized paths. JSON:API endpoints MUST have request-level tests.

**Frontend**: Vitest (or equivalent) + React Testing Library for
components and hooks; Playwright for critical end-to-end user
journeys. Visual-only changes still require a test asserting the
intended DOM/behavior contract.

**Rationale**: Tests are the only durable specification of behavior.
Test-after leaves behavior unpinned; test-first forces a design that
is observable and debuggable from day one.

### II. Security & Authorization by Default (NON-NEGOTIABLE)

Security is not a review-time concern; it is a gate enforced by the
system.

- **Ash policies deny-by-default**: Every Ash resource MUST declare
  explicit policies. A resource or action without policies MUST NOT
  be reachable from any external surface. Bypasses (e.g., system
  actions) MUST be confined to clearly named internal contexts and
  justified in code.
- **CI security gates** block merges on findings of any severity
  classified `high` or above:
  - **Trivy** — filesystem, container image, and IaC scans.
  - **Sobelow** — Elixir/Phoenix SAST, run with `--strict`.
  - **mix_audit** — Elixir dependency CVE scan.
  - **npm audit** (or equivalent, e.g. `osv-scanner`) — JS dependency
    CVE scan for `assets/`.
  - **Secret scanning** (gitleaks or trufflehog) — runs on every PR
    and as a pre-commit hook. Detected secrets MUST be rotated, not
    merely removed from history.
- **Input trust boundaries**: All input crossing a trust boundary
  (HTTP request, message bus, user upload) MUST be validated by Ash
  changesets, action arguments, or explicit schema validation.
  `String.to_atom/1` on user input is forbidden.
- **Secrets**: MUST be loaded from runtime configuration, never
  committed. `config/runtime.exs` is the only sanctioned location
  for `System.get_env/1` reads.
- **No direct data-layer access**: Writes and reads on user-facing
  paths MUST go through Ash code interfaces on the domain (e.g.,
  `MyApp.Accounts.register_user!/1`). Direct `Ecto.Repo.insert/2`,
  `Repo.update/2`, or `Repo.delete/2` calls bypass Ash policies,
  validations, changes, and notifications, and are forbidden outside
  (a) hand-written data migrations in `priv/repo/migrations/`, and
  (b) clearly named reporting/analytics modules that perform reads
  only and are excluded from user-facing routes. Exceptions MUST
  be marked in code with a comment explaining why Ash is bypassed.
- **Token & session storage**: Session and refresh tokens MUST be
  delivered in cookies marked `HttpOnly`, `Secure`, and `SameSite=Lax`
  (or stricter). Access tokens MUST live in memory only (module-level
  variable or auth context); persisting them to `localStorage` or
  `sessionStorage` is forbidden. Any mutation authenticated by cookie
  MUST be protected against CSRF via a double-submit token or
  `SameSite=Strict` on the auth cookie — Phoenix's built-in CSRF
  protections MUST be enabled on the JSON:API mutation pipeline.

**Rationale**: Authorization bugs are the highest-impact class of
defects this application can ship. Deny-by-default + automated
scanning makes "forgot to add a policy" or "accidentally committed a
token" structurally impossible, not merely discouraged.

### III. API Contract via JSON:API (NON-NEGOTIABLE)

The user-facing HTTP API is JSON:API, implemented exclusively via
`ash_json_api`. The following rules apply:

- Every user-facing endpoint MUST be defined on an Ash resource's
  `json_api` block. Hand-rolled Phoenix controllers for the public
  API are forbidden except for auth callbacks and health checks.
- The OpenAPI specification generated by `ash_json_api` +
  `open_api_spex` is the contract. Frontend types MUST be generated
  by `ash_typescript` from this contract — no hand-written API client
  types.
- Contract changes (added/removed/renamed attributes, relationships,
  or actions) MUST be called out in the PR description and version
  the API accordingly when breaking.
- `ash_admin` and LiveView-backed admin/internal surfaces are exempt
  from the JSON:API rule but MUST still enforce Ash policies.
- **Pure SPA, no RSC**: The React app in `assets/` is a pure
  client-side SPA. React Server Components, Next.js, Remix, and any
  other SSR/RSC framework are out of scope for this codebase.
  Introducing one would constitute a MAJOR constitutional amendment.

**Rationale**: A single source of truth (Ash resources) drives API
behavior, docs, and frontend types. This eliminates drift between
backend and frontend, which is the most common bug class in
full-stack apps.

### IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)

Every user-facing surface MUST meet WCAG 2.2 Level AA. This is
enforced on two axes:

- **Automated in CI**: `axe-core` (via `@axe-core/playwright` or
  `vitest-axe`) MUST run against every route and every significant
  component. Any violation at severity `serious` or `critical` blocks
  the PR.
- **Manual audit per release**: Before any tagged release to
  production, a documented audit MUST cover (a) keyboard-only
  navigation of all primary user flows, (b) screen-reader smoke test
  of P1 flows (NVDA on Windows or VoiceOver on macOS), and (c)
  colour-contrast verification for any new palette tokens.

Shadcn components are not accessible by default merely by being
Shadcn. Each adopted primitive MUST be verified.

Additional SPA-specific requirements:

- **Route-change focus management**: On every SPA navigation, focus
  MUST move to the destination page's primary heading (`<h1>`) or a
  documented skip target, and the transition MUST be announced via a
  polite `aria-live` region. TanStack Router does not do this
  automatically — the project provides a single, shared focus/announce
  mechanism that every route uses. This is the single most commonly
  missed SPA a11y requirement and axe-core does not catch it.
- **WCAG 2.2 AA new criteria** — beyond the 2.1 baseline, each of
  these MUST be verified during the per-release manual audit:
  - **2.4.11 Focus Not Obscured (Minimum)**: focused elements MUST
    NOT be entirely hidden by sticky headers, cookie banners, or
    chat widgets.
  - **2.5.7 Dragging Movements**: every drag interaction (reordering,
    slider thumbs, DnD) MUST have a non-drag alternative (click
    buttons, keyboard controls).
  - **2.5.8 Target Size (Minimum)**: interactive targets MUST be at
    least 24×24 CSS pixels, unless they are inline in a sentence or
    user-agent default. Shadcn's default icon-button size is
    borderline — verify per component.

**Rationale**: Accessibility regressions compound and are expensive
to fix retroactively. Per-PR automation catches the easy 80%; the
per-release manual pass catches the semantic issues automation
cannot see.

### V. User Experience for Non-Technical Operators

The primary users (GMs organizing game nights) are not technical.
Every feature MUST be designed for that audience:

- Error messages are written in plain language, name what happened,
  and suggest a next step. Raw stack traces, error codes, and
  database constraint names MUST NOT be surfaced to end users.
- Every asynchronous or stateful interaction has explicit loading,
  empty, and error states. "Blank screen while waiting" is a defect.
- Destructive actions (delete, leave game, remove player) require
  confirmation and MUST be reversible within the same session where
  technically feasible.
- Forms MUST use native HTML input types, clear labels (not
  placeholders-as-labels), and inline validation. Submit buttons
  MUST be disabled only with a visible reason.
- Copy is reviewed for jargon. "Session", "scope", "resource" are
  engineering terms and do not appear in UI text.

**Rationale**: A powerful feature that a GM cannot figure out is a
feature the product does not have. UX quality is a product
requirement, not polish.

### VI. Performance Discipline via Core Web Vitals

Frontend performance is gated; backend performance is measured and
guided.

- **Frontend CI gates** (Lighthouse CI or equivalent, on a
  representative device profile):
  - Largest Contentful Paint (LCP) ≤ 2.5 s
  - Interaction to Next Paint (INP) ≤ 200 ms
  - Cumulative Layout Shift (CLS) ≤ 0.1
  A PR that regresses any of these past the threshold MUST be
  justified in a Complexity Tracking entry or blocked.
- **Backend instrumentation**: All JSON:API actions MUST emit
  `:telemetry` events with duration. Slow queries (Ecto threshold:
  500 ms) MUST log with the query and stacktrace. An action that
  regresses p95 latency by >50% vs. its prior 7-day baseline is a
  defect and MUST be investigated before the next release.
- **Budget rule**: Bundle size for the React app is capped; exceeding
  the cap requires either a code-split or a documented justification.

**Rationale**: Non-technical users abandon slow interfaces silently.
Core Web Vitals are the industry-standard proxy for perceived speed;
treating them as budgets prevents death-by-a-thousand-regressions.

## Technology & Architecture Constraints

**Backend** (repository root):

- Elixir ~> 1.15, Phoenix ~> 1.8, Ash ~> 3.0.
- Data layer: `ash_postgres` on PostgreSQL. Migrations are generated
  from Ash resources via `mix ash.codegen`; hand-written migrations
  are discouraged.
- Auth: `ash_authentication` / `ash_authentication_phoenix`.
- Public API: `ash_json_api` + `open_api_spex`.
- Admin: `ash_admin` + Phoenix LiveView.
- HTTP client: `:req`. `:httpoison`, `:tesla`, `:httpc` are forbidden.
- Background/telemetry: `telemetry`, `telemetry_metrics`,
  `telemetry_poller`.

**Frontend** (`assets/`):

- React, TanStack (Router + Query as applicable), Shadcn UI,
  `ash_typescript`-generated client.
- Styling: Tailwind CSS v4 with the project-standard import syntax
  (`@import "tailwindcss" source(none);` + `@source` directives).
- Build: esbuild for the SPA bundle, served from Phoenix in
  development; static assets via `phx.digest` in production.
- End-user routes are served by the React SPA. LiveView is reserved
  for admin/internal surfaces (e.g., `ash_admin`, operator tools).

**Repository layout**:

- Backend source: `lib/`, tests: `test/`.
- Frontend source: `assets/js/`, `assets/css/`, tests colocated or in
  `assets/test/` as conventions evolve.
- Specs and planning artifacts: `specs/<feature-branch>/`.
- Constitution and templates: `.specify/`.

**Supported browsers**: Latest 2 stable versions of Chrome, Firefox,
Safari, and Edge. Mobile Safari and Chrome on Android (latest 2).
IE and legacy Edge are not supported.

## Development Workflow & Quality Gates

**Every pull request** MUST pass, at minimum:

1. `mix precommit` — format, `compile --warnings-as-errors`, full
   test suite, unused deps check.
2. **Credo** — `mix credo --strict`. Any warning or higher blocks
   the PR. Credo's configuration lives at `.credo.exs` and MUST be
   tracked in version control.
3. **Dialyzer** — `mix dialyzer` (via `:dialyxir`) against a cached
   PLT. Zero new warnings required; suppressions MUST use explicit
   `@dialyzer` attributes or `.dialyzer_ignore.exs` entries with a
   code comment explaining why.
4. **Ash resource-snapshot drift** — `mix ash.codegen --check` MUST
   pass. Any drift between Ash resources and `priv/resource_snapshots`
   or generated migrations blocks the PR; regenerate and commit.
5. **Generated TypeScript client drift** — `mix ash_typescript.codegen`
   run in CI followed by `git diff --exit-code` on the generated
   client path. Drift blocks the PR; regenerate and commit.
6. Frontend: typecheck, lint, Vitest suite, Playwright smoke suite.
7. Security gates per Principle II (Trivy, Sobelow, mix_audit, JS
   dependency audit, secret scan).
8. Accessibility gates per Principle IV (axe-core against changed
   routes; route-change focus/announce behavior covered by
   integration tests).
9. Performance gates per Principle VI (Lighthouse CI against affected
   routes, bundle-size budget check).
10. At least one reviewing human MUST confirm the Constitution Check
    in the plan was met.

**Planning artifacts** (`/specs/*/plan.md`) MUST include a
Constitution Check section that explicitly addresses each principle.
Violations MUST be justified in the Complexity Tracking table; an
unjustified violation blocks the plan.

**Release cadence**: A release is gated on the manual WCAG audit
(Principle IV), verification of performance baselines (Principle
VI), and a green security scan of the release artifact.

**Conflict resolution**: This constitution supersedes `AGENTS.md`,
`CLAUDE.md`, and any ad-hoc team document. Where `AGENTS.md`
provides Phoenix-, Elixir-, or UI-specific tactical guidance that
does not conflict with these principles, it remains authoritative at
that level.

## Governance

**Amendment procedure**: Amendments are proposed via PR modifying
this file. The PR MUST:

1. State the motivation and cite the specific principle or section
   changed.
2. Update the Sync Impact Report at the top of this file.
3. Propagate required changes to `.specify/templates/*` in the same
   PR.
4. Receive approval from a project maintainer before merge.

**Versioning policy** (semantic):

- **MAJOR**: A principle is removed, materially redefined, or a
  NON-NEGOTIABLE rule is relaxed.
- **MINOR**: A new principle or section is added, or an existing
  principle is expanded with new mandatory guidance.
- **PATCH**: Clarifications, wording, typo fixes, or non-semantic
  refinements that do not change the set of rules.

**Compliance review**: PR authors self-attest compliance in the PR
description. Reviewers MUST block PRs that violate a NON-NEGOTIABLE
principle without a Complexity Tracking justification. A quarterly
review of the last 90 days of merged PRs samples for drift; findings
produce either PR-level fixes or a constitution amendment.

**Runtime guidance**: Use `AGENTS.md` (and the aliased `CLAUDE.md`)
for day-to-day development idioms that implement this constitution.

**Version**: 1.2.0 | **Ratified**: 2026-04-21 | **Last Amended**: 2026-04-21
