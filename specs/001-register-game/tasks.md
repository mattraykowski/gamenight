---

description: "Task list for 001-register-game"
---

# Tasks: Register Game

**Input**: Design documents from `/specs/001-register-game/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Tests are MANDATORY per Constitution Principle I (Test-First
Development, NON-NEGOTIABLE). Every user story MUST have failing tests
written and verified RED before any implementation task in the same
story begins.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing. Phase 1 (Setup) and Phase 2 (Foundational)
gate every user story. Phases 3–7 correspond to user stories US1–US5
from [spec.md](./spec.md), in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1..US5)
- Paths are absolute repo-relative.

## Path Conventions

Backend: `lib/` (source) and `test/` (ExUnit). Frontend: `assets/js/`
(source and colocated Vitest tests) and `assets/e2e/` (Playwright).
Specs live under `specs/001-register-game/`.

---

## Phase 1: Setup

**Purpose**: Nothing new to install — the auth work already brought
in every frontend dep this feature needs (`react-hook-form`, `zod`,
Radix primitives). These tasks just confirm the branch is on a clean
starting baseline and prepare space for generated artifacts.

- [X] T001 Verify current branch is `001-register-game` and working tree is clean (no uncommitted changes outside this feature) via `git status`
- [X] T002 Confirm `mix ash.setup --quiet` runs cleanly and the existing test suites are green (`mix test`, `cd assets && bun run test && bun run lint && bun run typecheck && bun run test:e2e`) so any regressions in this feature are attributable to its own changes
- [X] T003 Create empty directories that phase 2+ will populate: `lib/game_night/games/`, `test/game_night/games/`, `assets/js/features/games/components/`, `assets/e2e/` (already exists — no-op; verify)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the `GameNight.Games` Ash domain, `Game`
resource, migration, JSON:API + RPC wiring, and regenerate the typed
client. Every user story depends on this being complete and green.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Resource and domain shell (tests written first per TDD)

- [X] T004 Add failing ExUnit test `test/game_night/games/game_test.exs` asserting `GameNight.Games.Game.__schema__(:source) == "games"` and that `Ash.Domain.Info.resources(GameNight.Games)` returns `[GameNight.Games.Game]` — this test must fail red because the modules do not exist yet
- [X] T005 Create `lib/game_night/games.ex` declaring the `GameNight.Games` domain with `extensions: [AshJsonApi.Domain, AshTypescript.Rpc]` and an empty `resources do end` block (do not add the resource yet so T004's failure shape is controlled)
- [X] T006 Create `lib/game_night/games/game.ex` with the attributes (`id`, `title`, `description`, `status`, `owner_id` via belongs_to, `inserted_at`, `updated_at`), the `belongs_to :owner` relationship, the `postgres do ... end` block with `references` and `custom_indexes` per [data-model.md](./data-model.md), the `policies do ... end` block per [research.md §5](./research.md#5), an empty `actions do ... end` block, and a `json_api do type "game" ; routes do end end` block so later tasks can extend it — no actions or routes yet, so any attempt to read/create fails
- [X] T007 Register the resource in the domain: add `resource GameNight.Games.Game` inside `resources do` in `lib/game_night/games.ex`; add `GameNight.Games` to the domain list in `config/config.exs` `config :game_night, ash_domains: [...]` so Ash can discover it
- [X] T008 Run `mix ash.codegen add_games_resource --quiet` to generate the Postgres migration at `priv/repo/migrations/<timestamp>_add_games_resource.exs` and the resource snapshot at `priv/resource_snapshots/repo/games/`; commit both
- [X] T009 Run `mix ecto.migrate` and verify T004's test now passes (module exists, schema source matches)
- [X] T010 Add a second failing test to `test/game_night/games/game_test.exs` asserting the Postgres composite index `games_owner_status_updated_at_index` exists on `[:owner_id, :status, :updated_at]` via `Ecto.Adapters.SQL.query!` against `pg_indexes`; this gates whether the index from the `custom_indexes` block actually landed in the generated migration

### JSON:API router wiring

- [X] T011 [P] Add a failing request test `test/game_night_web/controllers/games_request_test.exs` asserting an anonymous `GET /api/json/games/all` returns 401 (or whatever the session-loading pipeline surfaces as no-actor) — this must fail until the domain is registered with the JSON:API router
- [X] T012 Add `GameNight.Games` to `GameNightWeb.AshJsonApiRouter`'s `:domains` list (was `[GameNight.Telemetry]`, becomes `[GameNight.Telemetry, GameNight.Games]`)
- [X] T013 Decide and implement the JSON:API pipeline for Games (per plan.md post-design note): either (a) keep `:vitals_api` as-is and accept the misleading name, (b) rename `:vitals_api` → `:json_api_browser` and wire Games plus rate-limiter passthrough for vitals, or (c) split into two pipelines. Apply the chosen approach in `lib/game_night_web/router.ex`; make sure `:set_actor, :user` is in the pipeline so Ash policies see the authenticated user
- [X] T014 Re-run T011's test and verify it now fails with the expected-shape 401 (the domain routes exist but have no actions, so other responses would be wrong); the test will be extended in later phases as actions land

### `ash_typescript` RPC wiring

- [X] T015 [P] Add a failing ExUnit test `test/game_night/games/game_rpc_test.exs` asserting `AshTypescript.Rpc.actions_for(GameNight.Games)` lists all six expected RPC bindings (`list_mine_active`, `list_mine`, `get_mine`, `register_game`, `update_game`, `destroy_game`) — must fail red because the domain's `typescript_rpc do end` block is empty
- [X] T016 Add the `typescript_rpc do ... end` block to `lib/game_night/games.ex` per [contracts/rpc.md](./contracts/rpc.md), declaring all six bindings (names in T015); T015 still fails until the actions themselves exist in later phases, but the block is in place
- [X] T017 Run `mix ash_typescript.codegen` — it will emit warnings about missing actions but should regenerate `assets/js/ash_rpc.ts` and `assets/js/ash_types.ts` with whatever bindings are available; commit any baseline diff so later per-story regenerations have a clean delta

### Foundational gate

- [X] T018 Run `mix precommit` from the repo root; expect it to PASS except the pending action tests from T010 and T015 (document the expected reds in the PR or phase note). All other gates (Credo, format, codegen check, dialyzer) must be clean.

**Checkpoint**: Domain and resource compile; migration applied; JSON:API
and RPC bindings are visible in their respective routers; client
typescript is regenerated. User-story work can now begin.

---

## Phase 3: User Story 1 — Register a game and see it on the dashboard (P1) 🎯 MVP

**Goal**: A signed-in GM with zero games sees the dashboard empty
state, clicks through to the create form, submits a valid title +
description + status=Active, and lands back on the dashboard with
the new game visible in "My Active Games".

**Independent Test**: Playwright `assets/e2e/games-register.spec.ts`
seeds a fresh user via `/test/sign-in-as`, verifies the dashboard
empty state, creates a game via the form, and asserts the new row
appears in the dashboard table with the expected title.

### Tests for User Story 1 (REQUIRED — write and verify RED first) ⚠️

> **NON-NEGOTIABLE: Write these tests FIRST, run them, and verify they
> FAIL for the expected reason before any implementation task begins.**

#### Backend

- [X] T019 [P] [US1] Add policy tests to `test/game_night/games/game_test.exs`: (a) the owner can successfully run `Ash.create!(:register, …)` on `GameNight.Games.Game`, (b) an anonymous caller (no actor) is rejected by `Ash.Policy.AuthorizeError`, (c) `owner_id` in the resulting row equals the actor's id (set by `relate_actor(:owner)`), (d) submitting an unknown status atom fails with `Ash.Error.Invalid`
- [X] T020 [P] [US1] Add action tests to `test/game_night/games/game_test.exs`: (a) `Ash.read!(:list_mine_active, actor: owner)` returns only that owner's Active games, (b) games in other statuses owned by the same user are excluded, (c) games owned by a different user are excluded even if Active, (d) the result is sorted by `updated_at DESC`
- [X] T021 [P] [US1] Add JSON:API request tests to `test/game_night_web/controllers/games_request_test.exs`: (a) authenticated `GET /api/json/games/active` returns `200` with `data: []` for a user with no games, (b) same for a user with Active games returns the expected shape, (c) `POST /api/json/games` with a valid body returns `201` and the created resource, (d) `POST /api/json/games` with an empty title returns `422` with a field error on `title`
- [X] T022 [P] [US1] Extend the RPC contract test `test/game_night/games/game_rpc_test.exs`: call `registerGame` and `listMineActive` via `AshTypescript.Rpc.run!/3` directly and assert the return shapes match the types the SPA will consume

#### Frontend

- [X] T023 [P] [US1] Add `assets/js/features/games/schemas.test.ts` asserting the Zod schema (to be implemented) accepts valid input and rejects empty title, missing status, and invalid status atoms
- [ ] T024 [P] [US1] Add `assets/js/features/games/hooks.test.ts` with MSW-mocked `/rpc/run` handlers for `list_mine_active` and `register_game`: assert `useListMineActive` returns the mocked list, `useRegisterGame` posts the right body and invalidates `gamesKeys.all` on success; failure cases map to the discriminated `ApiError` union (validation, auth, network)
- [ ] T025 [P] [US1] Add `assets/js/features/games/components/game-form.test.tsx` asserting the shared `<GameForm>` renders all three fields, validates client-side via the Zod schema, and calls a provided `onSubmit` with the expected shape on valid submit; include `expectNoAxeViolations`
- [ ] T026 [P] [US1] Add `assets/js/features/games/components/games-table.test.tsx` asserting `<GamesTable>` renders rows with title, description (ellipsised on long values), and action cells (view + delete stub buttons). Assert each action button's rendered `getBoundingClientRect()` reports at least 24×24 CSS px (WCAG 2.5.8, constitution Principle IV — Shadcn icon-button defaults are borderline). Render one row with a 2000-character description and assert the rendered cell has the truncation class (`line-clamp-2`) or that the visible text length is bounded. Include `expectNoAxeViolations`
- [ ] T027 [P] [US1] Add `assets/js/features/games/components/empty-state.test.tsx` asserting both branches of the dashboard empty state render correctly (`no_games_at_all` → one CTA; `no_active_games` → two CTAs); include `expectNoAxeViolations`
- [ ] T028 [P] [US1] Add `assets/js/routes/games.new.test.tsx` exercising the create form inside the TanStack Router harness (same pattern as `sign-in.test.tsx`): valid submit navigates to `/dashboard`, MSW rejection surfaces an inline validation error AND the other form fields remain populated after the error (FR-022 "errors do not discard input"), already-authenticated guard would not redirect here (no guard needed — create is authenticated-only by the route chain); assert the heading carries `data-route-heading` and `tabIndex="-1"` (FR-023 focus contract)
- [ ] T029 [P] [US1] Extend `assets/js/routes/dashboard.test.tsx` with three new cases using the router harness: `no_games_at_all`, `no_active_games` (with a stubbed total count from `list_mine`), `has_active_games`; each renders the right copy/CTAs; include `expectNoAxeViolations`

#### E2E

- [X] T030 [P] [US1] Add `assets/e2e/games-register.spec.ts` covering the full happy path end-to-end: seed a fresh GM via `/test/sign-in-as`, record `performance.now()` after the dashboard load event fires, confirm the `no_games_at_all` empty state, click "Create new game", fill title + description + status=Active, submit, and assert the new row appears in the dashboard table. Record `performance.now()` again when the row is visible and assert the elapsed interactive time is under 30 seconds (SC-001 is "under 60 seconds of interaction time"; the 30s guard is a regression cap, not a product SLA)

### Implementation for User Story 1

#### Backend

- [X] T031 [US1] Implement the `:register` create action in `lib/game_night/games/game.ex` with `accept [:title, :description, :status]`, `change relate_actor(:owner)`, and the policy `policy action(:register) do authorize_if actor_present() end`; verify T019 and the relevant parts of T021/T022 now pass
- [X] T032 [US1] Implement the `:list_mine_active` read action in `lib/game_night/games/game.ex` with `prepare build(filter: [status: :active], sort: [updated_at: :desc])` and a policy under `action_type(:read)` with `authorize_if expr(owner_id == ^actor(:id))` (covers all named reads); verify T020 and the relevant parts of T021/T022 now pass
- [X] T033 [US1] Run `mix ash_typescript.codegen` and commit the regenerated `assets/js/ash_rpc.ts` / `assets/js/ash_types.ts`; verify T015 now fully passes
- [X] T034 [US1] In `lib/game_night/games/game.ex`, extend the `json_api.routes` block (created empty in T006) with `index :list_mine_active, route: "/active"` and `post :register`; verify the remaining parts of T021 pass

#### Frontend primitives

- [X] T035 [P] [US1] Copy Shadcn `textarea.tsx` into `assets/js/components/ui/textarea.tsx` (follow the Shadcn copy-paste flow from AGENTS.md; verify icon/interactive sizing; no Radix dep)
- [X] T036 [P] [US1] Copy Shadcn `select.tsx` into `assets/js/components/ui/select.tsx` — requires `@radix-ui/react-select` (add to `assets/package.json` via `bun add @radix-ui/react-select`)
- [X] T037 [P] [US1] Copy Shadcn `table.tsx` into `assets/js/components/ui/table.tsx` (no Radix dep)

#### Frontend feature module

- [X] T038 [US1] Create `assets/js/features/games/schemas.ts` with the shared Zod schema (`title`, `description`, `status`) used by create and edit forms; status enum pulled from the generated TypeScript type; T023 now passes
- [X] T039 [US1] Create `assets/js/features/games/hooks.ts` exporting `gamesKeys`, `useListMineActive`, and `useRegisterGame` per [contracts/rpc.md](./contracts/rpc.md); extend `TOAST_MESSAGES` in `assets/js/features/toasts/toast-provider.tsx` with `game_created`; T024 now passes
- [X] T040 [US1] Create `assets/js/features/games/components/game-form.tsx` — Shadcn `<Form>` + `<FormField>` for title (Input), description (Textarea), status (Select); `mode: "onTouched"`; pure form component that calls a prop `onSubmit(values: GameFormValues)`; T025 now passes
- [X] T041 [US1] Create `assets/js/features/games/components/games-table.tsx` rendering the table header + rows with title, description (truncated via `line-clamp-2`), and an actions cell with `View` link + `Delete` button stub (wired to the modal in US4); T026 now passes
- [X] T042 [US1] Create `assets/js/features/games/components/empty-state.tsx` rendering the two discriminated-state variants with correct copy and CTAs; T027 now passes

#### Routes

- [X] T043 [US1] Create `assets/js/routes/games.new.tsx` — `createFileRoute("/games/new")`, `beforeLoad` redirects unauthenticated users to `/sign-in?redirect=%2Fgames%2Fnew`; renders `<GameForm>` with an `onSubmit` that calls `useRegisterGame`; on success, push the `game_created` toast, then `navigate({ to: "/dashboard" })`; T028 now passes
- [X] T044 [US1] Update `assets/js/routes/dashboard.tsx` to render the "My Active Games" section: header with the title + "Create new game" primary `<Link>` + "View All Games" secondary link; body is `<GamesTable>` driven by `useListMineActive` + `useListMine` (for count), collapsing to `<EmptyState>` when the active list is empty; T029 passes
- [X] T045 [US1] Regenerate `assets/js/routeTree.gen.ts` (automatically done by the Vite plugin on next build — verify the new `/games/new` route is present)

#### Verification

- [X] T046 [US1] Run `mix test`, `bun run test`, `bun run lint`, `bun run typecheck` — all green
- [ ] T047 [US1] Run `bun run test:e2e -- games-register.spec.ts` against a live `mix phx.server` (rebuild assets first via `mix assets.build`); verify T030 passes end-to-end

**Checkpoint**: User Story 1 is independently demoable. A new GM can
register their first game via the SPA and see it on the dashboard.

---

## Phase 4: User Story 2 — View an individual game's details (P2)

**Goal**: Clicking "view" on a dashboard row (or a row in the
all-games list, once US5 ships) opens `/games/:id` with a stable,
labelled detail page that will anchor the edit form's layout in US3.

**Independent Test**: `assets/e2e/games-view.spec.ts` seeds a game,
navigates via the dashboard row's view link, and asserts the detail
page renders title, description, and status in the expected
positions; also asserts a guessed UUID for another owner's game
returns a not-found view.

### Tests for User Story 2 (REQUIRED — write and verify RED first) ⚠️

- [X] T048 [P] [US2] Extend `test/game_night/games/game_test.exs` with policy tests for `:get_mine`: (a) owner can `Ash.read_one!(:get_mine, arguments: %{id: id})`, (b) a different user receives `Ash.Error.Query.NotFound`, (c) anonymous receives `Ash.Policy.AuthorizeError`
- [X] T049 [P] [US2] Extend `test/game_night_web/controllers/games_request_test.exs` with a `GET /api/json/games/:id` test: owner gets 200 with the resource; a different authenticated user gets 404; an anonymous caller gets 401
- [X] T050 [P] [US2] Extend `test/game_night/games/game_rpc_test.exs` with a `getMine` happy-path and cross-tenant 404 case
- [X] T051 [P] [US2] Add `assets/js/features/games/components/game-field-row.test.tsx` asserting the `<GameFieldRow>` primitive renders in `view` and `edit` modes with identical layout wrappers (verified by `data-testid` or class fingerprints) so the mirror contract is covered
- [X] T052 [P] [US2] Add `assets/js/routes/games.$id.test.tsx` using the router harness: successful render shows title/description/status via `<GameFieldRow>` instances, an MSW 404 renders a "not found" state with a back-to-dashboard link, assert the detail page's `<h1>` carries `data-route-heading` and `tabIndex="-1"` (FR-023), include `expectNoAxeViolations`
- [X] T053 [P] [US2] Add `assets/e2e/games-view.spec.ts` covering: click view from the dashboard row, see the detail page; direct navigation to a stranger's game URL returns the not-found state

### Implementation for User Story 2

- [X] T054 [US2] Implement the `:get_mine` read action in `lib/game_night/games/game.ex` with `get? true`, `argument :id, :uuid, allow_nil?: false`, `filter expr(id == ^arg(:id))`; it inherits the shared read policy. Run `mix ash_typescript.codegen` and commit the regen; T048 / T050 pass
- [X] T055 [US2] Add `get :get_mine` to the `json_api do routes do ... end` block for `/api/json/games/:id`; T049 passes
- [X] T056 [US2] Extend `assets/js/features/games/hooks.ts` with `useGame(id: string)` backed by `getMine` RPC + `gamesKeys.detail(id)`; add any shared error-narrowing helper if needed
- [X] T057 [US2] Create `assets/js/features/games/components/game-field-row.tsx` — discriminated primitive accepting `mode: "view" | "edit"` plus a label and either a `value` (view) or a `render` callback for the form field (edit); T051 passes
- [X] T058 [US2] Create `assets/js/routes/games.$id.tsx` — `createFileRoute("/games/$id")`, `beforeLoad` redirects unauthenticated users, `loader` prefetches `useGame` (or the route just reads the hook inside the component — decide based on harness ergonomics); renders three `<GameFieldRow mode="view">` instances plus an `<Edit>` button linking to `/games/$id/edit` and a `<Delete>` button stub (wired in US4); T052 passes
- [X] T059 [US2] Update `assets/js/features/games/components/games-table.tsx` so the row's view action links to `/games/${game.id}` (was a stub in US1)

#### Verification

- [X] T060 [US2] Full gate run (`mix test`, `bun run test`, `bun run lint`, `bun run typecheck`, `bun run test:e2e -- games-view.spec.ts`); all green

**Checkpoint**: User Stories 1 AND 2 are independently demoable.

---

## Phase 5: User Story 3 — Edit a game (P3)

**Goal**: From the detail page, clicking edit opens `/games/:id/edit`
with the current values pre-filled in a form that visually mirrors
the detail page; saving persists the change and returns to the
detail page; changing status from Active to anything else removes
the game from "My Active Games" on the dashboard.

**Independent Test**: `assets/e2e/games-edit.spec.ts` seeds a game,
edits it to Paused, verifies the detail page reflects the change,
and verifies the dashboard no longer shows the game.

### Tests for User Story 3 (REQUIRED — write and verify RED first) ⚠️

- [X] T061 [P] [US3] Extend `test/game_night/games/game_test.exs` with policy + action tests for `:update`: owner can update title/description/status; a different user cannot; an unknown status is rejected; submitting `owner_id` in the input is ignored (not accepted by the action); `require_atomic? true` is preserved (assert via action introspection)
- [X] T062 [P] [US3] Extend `test/game_night_web/controllers/games_request_test.exs` with `PATCH /api/json/games/:id` cases: owner success, different-user 404, validation 422 on empty title
- [X] T063 [P] [US3] Extend `test/game_night/games/game_rpc_test.exs` with an `updateGame` happy-path and forbidden case
- [X] T064 [P] [US3] Add `assets/js/routes/games.$id.edit.test.tsx` using the router harness: pre-fills from a mocked `useGame`, submit navigates to `/games/$id` with the updated values, validation errors surface inline AND the other fields the user modified remain populated after the error (FR-022), assert the `<h1>` carries `data-route-heading` and `tabIndex="-1"` (FR-023), include `expectNoAxeViolations`
- [X] T065 [P] [US3] Add a mirrored-layout Vitest test at `assets/js/features/games/components/game-field-row.mirror.test.tsx` that renders both the detail-page row tree and the edit-form row tree for the same game and asserts layout fingerprints match (same `data-testid` sequence, same wrapper class tokens) — enforces FR-013 / SC-004 automatically
- [X] T066 [P] [US3] Add `assets/e2e/games-edit.spec.ts` covering the full flow: view → click edit → change status to Paused → save → detail page shows Paused → dashboard no longer lists the game

### Implementation for User Story 3

- [X] T067 [US3] Implement the `:update` action in `lib/game_night/games/game.ex` with `accept [:title, :description, :status]` and `require_atomic? true`; the shared `update/destroy` policy already authorizes-if `owner_id == ^actor(:id)`. Run `mix ash_typescript.codegen` and commit the regen; T061 / T063 pass
- [X] T068 [US3] Add `patch :update` to the `json_api do routes do ... end` block; T062 passes
- [X] T069 [US3] Extend `assets/js/features/games/hooks.ts` with `useUpdateGame` — invalidates `gamesKeys.detail(id)` and `gamesKeys.all` on success; extend `TOAST_MESSAGES` with `game_updated`
- [X] T070 [US3] Create `assets/js/routes/games.$id.edit.tsx` — `createFileRoute("/games/$id/edit")`, pre-fills from `useGame`, submits via `useUpdateGame`; on success, push the `game_updated` toast and navigate to `/games/$id`; uses `<GameFieldRow mode="edit">` instances rendered with the exact same parent layout as the view page; T064 / T065 pass
- [X] T071 [US3] Update `assets/js/routes/games.$id.tsx` so the `<Edit>` button links to `/games/$id/edit` (was a stub in US2)

#### Verification

- [X] T072 [US3] Full gate run; all green including T066 E2E

**Checkpoint**: Mirrored-layout contract is verifiable automatically;
status changes propagate to the dashboard.

---

## Phase 6: User Story 4 — Delete with typed confirmation (P4)

**Goal**: Every delete surface (dashboard row, detail page, all-games
row) opens a Shadcn Dialog-based typed-confirmation modal that
requires the GM to type `delete` before the confirm button enables.

**Independent Test**: `assets/e2e/games-delete.spec.ts` covers both
entry points (dashboard row, detail page), the near-miss cases
(disabled confirm), the cancel/Escape/backdrop close paths, and the
final post-delete landing location.

### Tests for User Story 4 (REQUIRED — write and verify RED first) ⚠️

- [X] T073 [P] [US4] Extend `test/game_night/games/game_test.exs` with policy + action tests for `:destroy`: owner can destroy; a different user cannot; destroying returns `:ok` and the row is gone
- [X] T074 [P] [US4] Extend `test/game_night_web/controllers/games_request_test.exs` with `DELETE /api/json/games/:id` cases: owner → 204, different user → 404, anonymous → 401
- [X] T075 [P] [US4] Extend `test/game_night/games/game_rpc_test.exs` with a `destroyGame` happy-path and forbidden case
- [X] T076 [P] [US4] Add `assets/js/features/games/components/delete-game-dialog.test.tsx` asserting: (a) confirm button is disabled initially, (b) disabled for near-misses `""`, `"Delete"`, `"delete "`, `"DELETE"`, (c) enabled for exact match `"delete"`, (d) cancel/Escape/backdrop close the dialog without calling the delete handler, (e) focus moves to the trigger button on close (Radix default — spot-check), (f) the confirm button is disabled while the mutation is in-flight so a second click cannot double-submit; include `expectNoAxeViolations` with the dialog open
- [X] T077 [P] [US4] Add `assets/e2e/games-delete.spec.ts` covering: delete from dashboard row (confirm disabled until typed; successful delete removes the row AND `page.url()` matches `/dashboard$` unchanged — FR-018 "stay on the same page" assertion), after deleting the only remaining Active game the dashboard shows the `no_active_games` (or `no_games_at_all`) empty state instead of a zero-row table, delete from detail page (successful delete navigates to `/dashboard`), Escape closes the dialog, backdrop-click closes the dialog

### Implementation for User Story 4

- [X] T078 [US4] Implement the `:destroy` action in `lib/game_night/games/game.ex`; the shared `update/destroy` policy covers authorization. Run `mix ash_typescript.codegen` and commit the regen; T073 / T075 pass
- [X] T079 [US4] Add `delete :destroy` to the `json_api do routes do ... end` block; T074 passes
- [X] T080 [US4] Copy Shadcn `dialog.tsx` into `assets/js/components/ui/dialog.tsx` — requires `@radix-ui/react-dialog` (add via `bun add @radix-ui/react-dialog`); verify icon sizes ≥24×24 CSS px per constitution Principle IV
- [X] T081 [US4] Extend `assets/js/features/games/hooks.ts` with `useDestroyGame` — invalidates `gamesKeys.all` and removes the `gamesKeys.detail(id)` cache entry on success; extend `TOAST_MESSAGES` with `game_deleted`
- [X] T082 [US4] Create `assets/js/features/games/components/delete-game-dialog.tsx` — Radix `<Dialog>` with a controlled text input, disabled confirm button gated by an exact-string comparison against `"delete"` (case-sensitive, whitespace-sensitive), identifies the game being deleted in the dialog heading; T076 passes
- [X] T083 [US4] Wire the delete dialog into `assets/js/features/games/components/games-table.tsx` (dashboard row): replace the stub delete button with the dialog trigger; on confirm, call `useDestroyGame`, push the `game_deleted` toast, and rely on query invalidation to refresh the table
- [X] T084 [US4] Wire the delete dialog into `assets/js/routes/games.$id.tsx` (detail page): on confirm, navigate to `/dashboard` and push the `game_deleted` toast

#### Verification

- [X] T085 [US4] Full gate run including T077 E2E; all green

**Checkpoint**: All delete surfaces gated consistently. Accidental
deletion is structurally prevented.

---

## Phase 7: User Story 5 — View all games (P5)

**Goal**: The "View All Games" link opens `/games` listing every
game the GM owns regardless of status, reusing the dashboard's
empty-state and table primitives with an added status column.

**Independent Test**: `assets/e2e/games-all.spec.ts` seeds games in
multiple statuses, clicks "View All Games" from the dashboard, and
asserts all statuses are visible; also asserts the delete dialog
works from an all-games row.

### Tests for User Story 5 (REQUIRED — write and verify RED first) ⚠️

- [X] T086 [P] [US5] Extend `test/game_night/games/game_test.exs` with action tests for `:list_mine`: returns the actor's games regardless of status, sorted by `updated_at DESC`
- [X] T087 [P] [US5] Extend `test/game_night_web/controllers/games_request_test.exs` with `GET /api/json/games/all` returning a mixed-status collection
- [X] T088 [P] [US5] Extend `test/game_night/games/game_rpc_test.exs` with a `listMine` happy-path
- [X] T089 [P] [US5] Add `assets/js/routes/games.index.test.tsx` using the router harness: renders a row per status, displays the status column, renders the shared empty state when the user has no games at all, assert the `<h1>` carries `data-route-heading` and `tabIndex="-1"` (FR-023), include `expectNoAxeViolations`
- [X] T090 [P] [US5] Add `assets/e2e/games-all.spec.ts` covering: navigation from dashboard "View All Games", visibility of a Paused game that is absent from the dashboard, deletion from an all-games row (assert `page.url()` matches `/games$` after the confirm click — FR-018 stay-in-place for the all-games surface)

### Implementation for User Story 5

- [X] T091 [US5] Implement the `:list_mine` read action in `lib/game_night/games/game.ex` with `prepare build(sort: [updated_at: :desc])`; inherits the shared read policy. Run `mix ash_typescript.codegen` and commit the regen; T086 / T088 pass
- [X] T092 [US5] Add `index :list_mine, route: "/all"` to the `json_api do routes do ... end` block; T087 passes
- [X] T093 [US5] Extend `assets/js/features/games/hooks.ts` with `useListMine`
- [X] T094 [US5] Extend `assets/js/features/games/components/games-table.tsx` to accept an optional `showStatus` prop; when true, render a status column — used by the all-games route but not by the dashboard (which filters to Active only)
- [X] T095 [US5] Create `assets/js/routes/games.index.tsx` — `createFileRoute("/games/")`, `beforeLoad` redirects unauthenticated users, renders `<GamesTable showStatus={true}>` driven by `useListMine` with the shared `<EmptyState>` for the no-games-at-all case; T089 passes
- [X] T096 [US5] Ensure the "View All Games" link in the dashboard section header (created in US1) points at `/games` (was a placeholder href or empty link)

#### Verification

- [X] T097 [US5] Full gate run including T090 E2E; all green

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification against the acceptance criteria in plan.md
§Technical Context and spec.md §Success Criteria, plus any
housekeeping that benefits from being done once after all five
stories are in.

- [X] T098 [P] Run `bun run size-limit` and verify each of the new route chunks (`/games`, `/games/new`, `/games/$id`, `/games/$id/edit`) is ≤15 KB gzipped and the total SPA initial bundle has not regressed past the 250 KB warn threshold; capture the report in the PR
- [ ] T099 [P] Run a local Lighthouse pass against `/dashboard` with 50 seeded Active games; verify LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 per SC-003 and constitution Principle VI
- [ ] T100 [P] Manual keyboard-only walkthrough of every new route and the delete dialog: confirm focus lands on each page's `<h1 data-route-heading>`, Escape closes dialogs, Enter submits forms, tab order is sensible; log findings in the PR body
- [ ] T101 [P] Manual screen-reader smoke (NVDA or VoiceOver) of the P1 flow (empty state → create → dashboard row appears) and the delete flow (dialog opens, focus trapped, announcement on close)
- [X] T102 Extend the `project_overview.md` memory entry to note that Games exist as a first-class resource under `GameNight.Games` (brief one-liner so future agent sessions do not have to re-derive the relationship)
- [X] T103 Run `mix precommit` and the full frontend gate one more time from a clean working tree; all checks green
- [X] T104 Execute the [quickstart.md](./quickstart.md) cross-phase verification block end-to-end to confirm the phase-independence promise held through polish
- [ ] T105 [P] Add `assets/e2e/games-performance.spec.ts` that seeds 50 Active games for a single GM via a new `/test/seed-games-as` helper (dev_routes-guarded, mirrors `/test/sign-in-as` shape), navigates to `/dashboard`, and asserts the dashboard is interactive (all 50 rows present + `<h1>` focused) within 2000ms of `page.goto` resolution. This automates SC-003 so regressions fail CI instead of waiting for a manual Lighthouse pass (T099 remains for Core Web Vitals coverage)
- [ ] T106 Extend `lib/game_night_web/controllers/test_auth_controller.ex` (or add a sibling `test_games_controller.ex`) with a `POST /test/seed-games-as` endpoint that takes `{email, count, status}` and bulk-creates games owned by that user via `Ash.bulk_create/4`. Guarded behind `:dev_routes` per the existing pattern. Required by T105

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Stories (Phases 3–7)**: All depend on Foundational completion.
  - Within-story order is strict (tests → backend impl → frontend impl → E2E verification).
  - Across stories, US1 is the MVP and should complete before any of US2–US5 merge (US2–US5 reuse the `feature/games/` module, the dashboard row "view/delete" affordances, and the `<GamesTable>` primitive that US1 creates).
- **Polish (Phase 8)**: Depends on all shipped user stories.

### User Story Dependencies (honestly)

- **US1 (P1)**: Blocked only by Foundational.
- **US2 (P2)**: Blocked by US1 for the `<GamesTable>` view-action wiring (T059) and the shared `features/games/` module, which US1 creates; the Ash action and JSON:API wiring are independent.
- **US3 (P3)**: Blocked by US2 for `<GameFieldRow>` (mirrored layout primitive).
- **US4 (P4)**: Independent of US2/US3 at the resource level; depends on US1 for the feature module and on US2/US5 for the second/third delete entry points (but the modal itself can land once US1 is in).
- **US5 (P5)**: Depends on US1 for `<GamesTable>` + `<EmptyState>` + the dashboard "View All Games" link.

### Within Each User Story

- All `[P]` tests in the "Tests for User Story N" block can run in
  parallel — they touch distinct files.
- Tests MUST verify RED before the corresponding implementation
  tasks begin (constitution Principle I).
- Backend action + policy lands before JSON:API route extension in
  the same story.
- RPC regeneration (`mix ash_typescript.codegen`) happens after
  every action implementation so the generated client stays in sync.
- Frontend hooks before components before routes.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (REQUIRED — verify RED before impl):
Task: "Backend policy tests for :register in test/game_night/games/game_test.exs"
Task: "Backend action tests for :list_mine_active in test/game_night/games/game_test.exs"
Task: "JSON:API request tests for /api/json/games/active and POST /api/json/games in test/game_night_web/controllers/games_request_test.exs"
Task: "RPC contract tests for registerGame and listMineActive in test/game_night/games/game_rpc_test.exs"
Task: "Zod schema tests in assets/js/features/games/schemas.test.ts"
Task: "Hook tests in assets/js/features/games/hooks.test.ts"
Task: "GameForm component tests in assets/js/features/games/components/game-form.test.tsx"
Task: "GamesTable component tests in assets/js/features/games/components/games-table.test.tsx"
Task: "EmptyState component tests in assets/js/features/games/components/empty-state.test.tsx"
Task: "/games/new route tests in assets/js/routes/games.new.test.tsx"
Task: "Dashboard route tests extension in assets/js/routes/dashboard.test.tsx"
Task: "Playwright games-register spec in assets/e2e/games-register.spec.ts"

# Launch all Shadcn primitive copies for User Story 1 together:
Task: "Copy textarea.tsx into assets/js/components/ui/textarea.tsx"
Task: "Copy select.tsx into assets/js/components/ui/select.tsx"
Task: "Copy table.tsx into assets/js/components/ui/table.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — CRITICAL; blocks every story.
3. Complete Phase 3 (User Story 1 — Register + dashboard).
4. **STOP and VALIDATE**: run T047 against a live server and the full
   gate suite (T046). If green, US1 is the MVP and is demoable.

### Incremental Delivery

1. Setup + Foundational → resource + bindings in place.
2. Add US1 → Test independently → Demo (MVP!).
3. Add US2 → Test independently → Demo (detail page).
4. Add US3 → Test independently → Demo (edit; mirrored layout).
5. Add US4 → Test independently → Demo (delete with typed confirmation).
6. Add US5 → Test independently → Demo (full management surface).
7. Polish → performance / a11y audit / memory update.

Each story adds value without breaking the previous stories. The
`<GamesTable>` stub actions created in US1 are filled in US2 (view)
and US4 (delete) in order.

### Parallel Team Strategy

With multiple contributors after Foundational is green:

- Dev A: US1 end-to-end (the MVP anchor).
- Dev B: start US4 (delete dialog primitive + backend `:destroy`) in
  parallel once US1's feature module scaffolding is merged —
  US4 does not need the detail or edit pages, only the dashboard row.
- Dev C: pick up US2 after US1's `<GamesTable>` exists, and chain
  into US3 immediately (mirrored primitive benefits from pair work).
- Dev D: US5 after US1's table + empty-state components exist.

---

## Notes

- `[P]` tasks touch different files and can run concurrently.
- `[Story]` labels trace each task back to a spec user story.
- Every phase ends with a full gate run (`mix precommit` + frontend
  typecheck/lint/test/E2E).
- Commit after each logical group — phase checkpoints are natural
  commit boundaries.
- Do not merge a phase until its acceptance criterion (plan.md,
  research.md, quickstart.md) is verified.
- Avoid cross-story dependencies that break independence. When a
  task crosses stories (e.g., T059 wiring in US2 that depends on
  US1's table), the task is listed under the story that introduces
  the change, and the dependency is noted inline.
