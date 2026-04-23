# Implementation Plan: Register Game

**Branch**: `001-register-game` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-register-game/spec.md`

## Summary

Introduce a `GameNight.Games.Game` Ash resource owned by an authenticated
user, with deny-by-default `Ash.Policy.Authorizer` policies scoping
every action to the actor's own rows. Expose the resource on two
surfaces — the JSON:API block (canonical public contract, per
constitution Principle III) and the `AshTypescript.Rpc` domain block
(fast path for the SPA). The React SPA ships five thin routes
(`/games`, `/games/new`, `/games/:id`, `/games/:id/edit`) plus a
dashboard section that lists the user's Active games, all wired
through feature-level TanStack Query hooks over the
`createResourceHooks` factory that the auth work already established.
Destructive actions are gated by a reusable Shadcn `<Dialog>`-based
typed-confirmation modal. All work proceeds TDD, phase-by-phase, with
each of the spec's five user stories delivered as an independently
testable tracer bullet.

## Technical Context

**Language/Version**: Elixir ~> 1.15 (backend), TypeScript 5.7 /
React 19 (frontend). Per the constitution-level stack.
**Primary Dependencies**: `ash ~> 3.0`, `ash_postgres`, `ash_json_api`,
`ash_authentication`, `ash_typescript`, `open_api_spex`, Phoenix
~> 1.8, Bandit. Frontend: TanStack Router/Query, React Hook Form +
Zod, Shadcn primitives (`@radix-ui/react-dialog`, table/select/
textarea copies added to `assets/js/components/ui/` as needed), MSW
for test mocks, Playwright for E2E.
**Storage**: PostgreSQL via `ash_postgres`. One new table `games`.
**Testing**: ExUnit (resource, policy, JSON:API request, and
`Ash.read/update/destroy` action tests), Vitest + React Testing
Library + `vitest-axe` (components), Playwright + `@axe-core/
playwright` (E2E). No direct `Ecto.Repo` writes. MSW mocks both
`/rpc/run` (for SPA unit tests) and `/api/json/games/**` (for any
tests that exercise the JSON:API client explicitly).
**Target Platform**: Linux server (Phoenix/Bandit); SPA in the
latest-2 stable desktop and mobile browsers per constitution.
**Project Type**: Web application (Elixir/Phoenix backend + React SPA
under `assets/`).
**Performance Goals**: Dashboard with up to 50 active games
render-ready within 2 s on a standard desktop connection
(SC-003). JSON:API and RPC action p95 ≤ 150 ms under normal load.
No regression on existing Core Web Vitals budget (LCP ≤ 2.5 s,
INP ≤ 200 ms, CLS ≤ 0.1).
**Constraints**: Bundle delta ≤ 40 KB gzipped across the five new
routes combined (each route chunk lazy-loaded by the TanStack Router
plugin). Deny-by-default policies on every Game action; the base
`:read` action filters to `expr(owner_id == ^actor(:id))` so even
unscoped callers see only their own rows. No cross-tenant data
exposure (SC-005 E2E-verified).
**Scale/Scope**: 5 new SPA routes + 1 dashboard section, 1 Ash
resource, 1 new Ash domain (`GameNight.Games`), ~6 actions, ~20
functional requirements. The core loop is ~2 weeks of focused work
across the five phases below.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First Development (NON-NEGOTIABLE)**: **PASS**.
  - ExUnit: resource + action + policy tests for `GameNight.Games.Game`
    (each action has authorized and unauthorized test cases per
    constitution), JSON:API request tests against the generated
    routes, `AshTypescript.Rpc`-level tests that prove the named
    actions are exposed under the right domain config.
  - Vitest: colocated tests for every new SPA route and shared
    primitive (`GameForm`, `DeleteGameDialog`, `GamesTable`) with
    `expectNoAxeViolations` on each. MSW mocks `/rpc/run` at the
    same layer auth tests mock it.
  - Playwright: one E2E spec per user story (P1 create + dashboard;
    P2 view; P3 edit; P4 delete with typed confirmation; P5 all-games
    view), exercising the real JSON flow through `mix phx.server`.
  - Every commit that introduces behavior ships the failing test
    first per `/tdd` skill procedure. No scaffolding-only commits.

- **II. Security & Authorization by Default (NON-NEGOTIABLE)**: **PASS**.
  - New resource: `GameNight.Games.Game`. Authorizer:
    `Ash.Policy.Authorizer`. Every action has an explicit policy
    block. Base `:read` uses
    `authorize_if expr(owner_id == ^actor(:id))`; `:list_mine_active`
    and `:list_mine` inherit the same per-row filter. `:create`
    uses `authorize_if actor_present()` plus
    `change relate_actor(:owner)` to set the owner atomically.
    `:update` and `:destroy` use
    `authorize_if expr(owner_id == ^actor(:id))`. `owner_id` is
    immutable on update (`accept` excludes it).
  - No direct `Ecto.Repo` access anywhere in the feature — all paths
    go through Ash code interfaces on `GameNight.Games`.
  - No new auth flows, no new secrets. No new dependencies that
    would trigger Trivy / Sobelow / mix_audit / npm audit attention
    beyond the already-audited Shadcn/Radix lineage (the
    `@radix-ui/react-dialog` primitive is added to `assets/` —
    Radix is already vetted by the existing Checkbox/Label adds).
  - Route pipelines: RPC at `/rpc/run` inherits the existing
    `:browser` + `:load_from_session` + `:set_actor` chain. JSON:API
    at `/api/json/games/**` uses a new `:json_api_browser` pipeline
    that adds `:set_actor` to the existing JSON:API stack (same
    shape as the vitals pipeline, minus the rate limiter). CSRF
    enforcement follows the existing auth-work meta-tag pattern.

- **III. API Contract via JSON:API (NON-NEGOTIABLE)**: **PASS**.
  - `GameNight.Games.Game` declares a `json_api do ... end` block
    with resource type `"game"` and routes for `:read`,
    `:list_mine_active` (index alias `/active`), `:list_mine`
    (index alias `/all`), `:get_mine`, `:register`, `:update`, and
    `:destroy`. The `GameNight.Games` domain is registered in
    `GameNightWeb.AshJsonApiRouter` alongside `Telemetry`.
  - `open_api_spex` regenerates and the resulting spec is committed
    (drift gate catches any divergence).
  - `AshTypescript.Rpc` regeneration emits typed client functions
    for the same actions. The SPA consumes the RPC surface; the
    JSON:API surface remains available for external tooling and for
    any tests that want to exercise the canonical contract directly.
  - `mix ash.codegen --check` and the `ash_typescript.codegen` drift
    gate run on every PR per constitution §Development Workflow.
  - Pure-SPA boundary unchanged: no RSC, no SSR.

- **IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)**: **PASS**.
  - Five new routes (`/games`, `/games/new`, `/games/:id`,
    `/games/:id/edit`, plus the dashboard section) each render a
    `<h1 data-route-heading>` consumed by the existing
    `useFocusOnRouteChange` hook. Route-change announcements use
    the shared `A11yAnnouncer`.
  - `axe-core` runs against each route in Playwright and against
    each component test in Vitest (via `expectNoAxeViolations`).
  - The delete confirmation modal uses Radix `<Dialog>` via Shadcn:
    focus trap, Escape-to-close, backdrop dismiss, focus restoration
    to the trigger button all come from Radix — verified per Shadcn
    caveat (constitution Principle IV).
  - WCAG 2.2 new AA criteria: (2.4.11) sticky headers in the app
    shell already leave primary interactive elements visible — the
    new table and modal do not introduce obstructions;
    (2.5.7) no drag interactions in this feature; (2.5.8) action
    buttons (view/delete) are rendered at the Shadcn `sm` size
    (36px) — verified ≥24×24 CSS px.
  - Manual release audit (keyboard, screen reader, colour contrast)
    covers the new routes before release per constitution.

- **V. UX for Non-Technical Operators**: **PASS**.
  - Every form has explicit loading/empty/error states — the
    dashboard empty state branches on "no games at all" vs. "no
    Active games" per FR-008 and spec Edge Cases.
  - Typed-confirmation modal prevents accidental deletion; copy
    names the game being deleted.
  - Error messages written in plain language, no constraint names
    or stack traces surfaced.
  - All forms use Shadcn's `<Form>` + `FormField` / `FormMessage`
    (per AGENTS.md) with `mode: "onTouched"` validation.
  - Toast feedback for create/update/delete success via the toast
    provider added in the auth work (`TOAST_MESSAGES` whitelist
    extended with `game_created`, `game_updated`, `game_deleted`).

- **VI. Performance Discipline**: **PASS**.
  - Each new route chunk is lazy-loaded; total delta ≤ 40 KB gzipped.
    The form routes share one React Hook Form instance pattern with
    the auth routes; the table route reuses Shadcn's `<Table>` (new
    primitive, ~2 KB gzipped).
  - Ash actions emit `:telemetry` events automatically. The dashboard
    read (`list_mine_active`) is expected to return at most a few
    dozen rows in realistic use; an `AshPostgres` composite index
    on `(owner_id, status, updated_at DESC)` is added via the
    generated migration so the dashboard query is index-only.
  - `size-limit` check extended to fail if the `/games` or
    `/games/new` chunks grow past 15 KB gzipped individually.

All six principles pass. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-register-game/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── json-api.md      # JSON:API route surface (OpenAPI-compatible description)
│   └── rpc.md           # ash_typescript RPC surface (SPA-facing)
├── checklists/
│   └── requirements.md  # Produced by /speckit.specify
└── tasks.md             # Produced by /speckit.tasks (later)
```

### Source Code (repository root)

```text
lib/
├── game_night/
│   ├── games.ex                         # NEW: Ash domain (AshJsonApi + AshTypescript.Rpc)
│   └── games/
│       └── game.ex                      # NEW: Ash resource with actions + policies
└── game_night_web/
    ├── ash_json_api_router.ex           # UPDATED: add GameNight.Games to :domains
    └── router.ex                        # UPDATED: mount the Games JSON:API scope
                                         # (pipeline already exists via /api forward)

priv/
├── repo/migrations/
│   └── <timestamp>_create_games.exs     # NEW: generated by mix ash.codegen
└── resource_snapshots/
    └── repo/games/                       # NEW: Ash snapshot for Game

test/
├── game_night/
│   └── games/
│       └── game_test.exs                # NEW: actions + policies + JSON:API contract
└── game_night_web/
    └── controllers/
        └── games_request_test.exs       # NEW: end-to-end JSON:API request tests

assets/
├── js/
│   ├── ash_rpc.ts                       # REGENERATED by ash_typescript.codegen
│   ├── ash_types.ts                     # REGENERATED
│   ├── components/
│   │   └── ui/
│   │       ├── dialog.tsx               # NEW (Shadcn Radix Dialog)
│   │       ├── table.tsx                # NEW (Shadcn)
│   │       ├── select.tsx               # NEW (Shadcn Radix Select)
│   │       └── textarea.tsx             # NEW (Shadcn)
│   ├── features/
│   │   ├── games/
│   │   │   ├── hooks.ts                 # NEW: useListMineActive, useListMine, useGame,
│   │   │   │                            # useRegisterGame, useUpdateGame, useDestroyGame
│   │   │   ├── hooks.test.ts
│   │   │   ├── components/
│   │   │   │   ├── game-form.tsx        # NEW: shared form (create + edit)
│   │   │   │   ├── game-form.test.tsx
│   │   │   │   ├── games-table.tsx      # NEW: dashboard + all-games table body
│   │   │   │   ├── games-table.test.tsx
│   │   │   │   ├── delete-game-dialog.tsx  # NEW: typed-confirmation modal
│   │   │   │   ├── delete-game-dialog.test.tsx
│   │   │   │   └── empty-state.tsx      # NEW: dashboard / all-games empty state
│   │   │   └── schemas.ts               # NEW: shared Zod schema (title, description, status)
│   │   └── toasts/
│   │       └── toast-provider.tsx       # UPDATED: extend TOAST_MESSAGES whitelist
│   └── routes/
│       ├── dashboard.tsx                # UPDATED: insert "My Active Games" section
│       ├── dashboard.test.tsx           # UPDATED
│       ├── games.index.tsx              # NEW: /games (View All Games)
│       ├── games.index.test.tsx
│       ├── games.new.tsx                # NEW: /games/new (create form)
│       ├── games.new.test.tsx
│       ├── games.$id.tsx                # NEW: /games/:id (detail page)
│       ├── games.$id.test.tsx
│       ├── games.$id.edit.tsx           # NEW: /games/:id/edit (edit form)
│       └── games.$id.edit.test.tsx
└── e2e/
    ├── games-register.spec.ts           # NEW: P1 user story
    ├── games-view.spec.ts               # NEW: P2 user story
    ├── games-edit.spec.ts               # NEW: P3 user story
    ├── games-delete.spec.ts             # NEW: P4 user story
    └── games-all.spec.ts                # NEW: P5 user story
```

**Structure Decision**: Web-application layout (existing pattern
preserved). New backend files live under a new `GameNight.Games`
domain with one resource; new frontend files live under
`assets/js/features/games/` (hooks + components) and `assets/js/
routes/` (five route files). The layout follows the conventions set
by the auth SPA work (Phase 1–4 in `plans/replace-ash-auth-screens-with-spa.md`):
one feature module per bounded concern, one route file per URL, and
colocated Vitest tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — all six principles pass on the initial check. If a
post-Phase 1 re-check surfaces anything, it will be recorded here.
