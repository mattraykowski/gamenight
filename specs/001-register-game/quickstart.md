# Quickstart: Register Game (for implementers)

**Feature**: 001-register-game
**Plan**: [plan.md](./plan.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/)

This quickstart is for anyone picking up this plan to implement.
Each phase delivers one of the spec's five user stories as a
tracer-bullet vertical slice — backend actions/policies, JSON:API +
RPC exposure, SPA route, tests, E2E — so the feature is demoable
after each phase. Phases are sequenced to deliver the highest-value
story first (P1) and end with the lowest (P5).

Every phase follows TDD. Write the failing test first, make it pass,
refactor. `mix precommit` plus the frontend gates (`bun run test`,
`bun run lint`, `bun run typecheck`, `bun run test:e2e`) must pass
before declaring a phase complete.

## Environment setup

```sh
mix ash.setup --quiet
cd assets && bun install && cd ..
```

Playwright runs against `mix phx.server` on `:4000`; the
auth-work `webServer` config in `assets/playwright.config.ts` spawns
one automatically per spec. Use `/test/sign-in-as` (existing
dev-routes helper) to seed an authenticated user in E2E tests.

## Phase 0: Plumbing (resource + domain + routers)

Smallest possible setup so later phases have a place to land.

1. **Ash domain + resource (failing test first)**:
   - Create `test/game_night/games/game_test.exs` with one test:
     "the resource compiles with the six declared actions". Run —
     fails (module does not exist).
   - Create `lib/game_night/games.ex` (empty domain shell).
   - Create `lib/game_night/games/game.ex` with attributes,
     relationships, `postgres do`, actions (empty bodies), and
     policies per [data-model.md](./data-model.md).
   - Run `mix ash.codegen add_games_resource` to generate the
     migration and snapshots. Commit the migration.
   - Run the test — passes.
2. **JSON:API router**:
   - Add `GameNight.Games` to `GameNightWeb.AshJsonApiRouter`'s
     `:domains`. Add a new `:json_api_browser` pipeline in
     `lib/game_night_web/router.ex` (or route the existing `/api`
     scope through a session-loading pipeline — decide during
     implementation). Request test: an authenticated GET on
     `/api/json/games/all` returns `{data: []}`.
3. **RPC domain wiring**:
   - Add the `typescript_rpc` block to `GameNight.Games` with the
     six bindings per [contracts/rpc.md](./contracts/rpc.md).
   - Run `mix ash_typescript.codegen`. Commit
     `assets/js/ash_rpc.ts` + `assets/js/ash_types.ts`.
   - Contract test: `AshTypescript.Rpc.actions_for(GameNight.Games)`
     returns the expected list.

**Phase 0 acceptance**: `mix precommit` clean; an authenticated
call to `listMineActive()` from an ad-hoc script returns `[]`.

## Phase 1: Register + dashboard (P1 — MVP)

Deliverable: a signed-in GM with zero games sees the dashboard
empty state, clicks through to the create form, creates a game with
status Active, and sees it in "My Active Games".

1. **Backend**:
   - Flesh out `:register` action body (`change relate_actor(:owner)`,
     `accept [:title, :description, :status]`).
   - Flesh out `:list_mine_active`. Add the composite Postgres
     index per data-model.
   - Tests: policy tests (authorized + forbidden + anonymous for
     both actions), action-level tests for register (happy + empty
     title + explicit status override), request test for
     `GET /api/json/games/active`, and an RPC contract test for
     `listMineActive` and `registerGame`.
2. **Frontend shared primitives**:
   - Copy Shadcn primitives into `assets/js/components/ui/`:
     `textarea.tsx`, `select.tsx`. Add each to the existing
     component index if there is one.
   - Add `assets/js/features/games/schemas.ts` with the Zod schema.
   - Add `assets/js/features/games/hooks.ts` with
     `useListMineActive`, `useRegisterGame`, and `gamesKeys`.
     Extend `TOAST_MESSAGES` with `game_created`.
   - Unit tests for each (MSW-mocked `/rpc/run`).
3. **Routes**:
   - `routes/games.new.tsx`: Shadcn `<Form>` + `FormField` for
     `title` (Input), `description` (Textarea), `status` (Select).
     On success → toast + `router.navigate({ to: "/dashboard" })`.
     Vitest + axe.
   - `routes/dashboard.tsx`: insert the "My Active Games" section
     above the existing "Welcome, …" copy. Table header with
     title + primary "Create new game" button + "View All Games"
     link. Body uses `<GamesTable>` (new shared component) or the
     `<EmptyState>` component driven by the discriminated state from
     [research.md §8](./research.md). Update `dashboard.test.tsx`
     to cover the three branches (no_games_at_all / no_active /
     has_active).
4. **E2E**:
   - `games-register.spec.ts`: seed a GM via `/test/sign-in-as`,
     verify the empty state, click through, submit the form,
     assert the new row appears in the dashboard table.

**Phase 1 acceptance**: Playwright `games-register.spec.ts` passes
against a live server. Dashboard renders all three states in
Vitest. P1 user story demoable.

## Phase 2: Detail view (P2)

Deliverable: clicking "view" on a dashboard row lands on
`/games/:id` showing the game's title, description, and status with
the same visual regions the edit form will use in Phase 3.

1. **Backend**: flesh out `:get_mine` (inherits `:read` policy).
   Tests: policy + action + JSON:API request (`GET /api/json/games/:id`
   returning the row; different-owner 404) + RPC contract for
   `getMine`.
2. **Frontend**:
   - `useGame(id)` hook.
   - `<GameFieldRow>` primitive (the mirrored-layout enabler — see
     [research.md §7](./research.md)).
   - `routes/games.$id.tsx`: renders the row for title,
     description, and status. Edit + Delete action buttons
     (delete wired up in Phase 4 — for now it renders a disabled
     button or omits delete entirely depending on taste).
3. **Wiring**: dashboard row's view action links to
   `/games/$id`. Update `games-register.spec.ts` to follow a view
   link and see the new row (optional; can be deferred to a
   dedicated `games-view.spec.ts`).
4. **E2E**: `games-view.spec.ts`. Includes the cross-tenant check
   asserting 404 for a guessed other-owner ID.

**Phase 2 acceptance**: detail page renders correctly, cross-tenant
404 verified in E2E.

## Phase 3: Edit (P3)

Deliverable: the edit form shares `<GameFieldRow>` layout with the
detail page; changing status to Paused removes the game from "My
Active Games" on the next dashboard visit.

1. **Backend**: flesh out `:update` (`require_atomic? true`, accept
   list excludes `:owner_id`). Tests: policy + action +
   `PATCH /api/json/games/:id` request (happy, forbidden,
   validation) + `updateGame` RPC.
2. **Frontend**:
   - `useUpdateGame` hook with the right cache invalidations.
     Extend `TOAST_MESSAGES` with `game_updated`.
   - `routes/games.$id.edit.tsx`: reuses the Zod schema from
     Phase 1, pre-fills from the `useGame` hook, submits via
     `useUpdateGame`. On success → toast + navigate back to
     `/games/:id`.
3. **Mirrored layout verification**: add a Vitest test that renders
   both pages side-by-side and asserts the `<GameFieldRow>` count
   and `data-testid` layout match.
4. **E2E**: `games-edit.spec.ts`. Covers "status change removes
   from dashboard table" per spec Acceptance Scenario 3.4.

**Phase 3 acceptance**: mirrored-layout assertion passes; dashboard
updates correctly after a status change in E2E.

## Phase 4: Delete with typed confirmation (P4)

Deliverable: `<DeleteGameDialog>` is reusable from the dashboard row
AND the detail page; both sites verify the modal's typed gate works.

1. **Backend**: flesh out `:destroy`. Tests: policy + action +
   `DELETE /api/json/games/:id` request (happy, forbidden) +
   `destroyGame` RPC.
2. **Frontend**:
   - Copy Shadcn `dialog.tsx` into `assets/js/components/ui/`.
   - `components/delete-game-dialog.tsx`: Radix Dialog with a
     controlled input and a disabled confirm button until the
     input exactly matches `"delete"`. Exposes an imperative open
     function or a `<Trigger>` slot — decide during implementation.
     Focus trap, Escape dismiss, backdrop dismiss, focus
     restoration all come from Radix.
   - Unit test each near-miss
     (`""`, `"Delete"`, `"delete "`, `"DELETE"`) + the matching
     case. `expectNoAxeViolations` on the open modal.
   - Integrate into the dashboard row and detail page.
     Extend `TOAST_MESSAGES` with `game_deleted`.
     Detail page's delete success navigates to `/dashboard`.
3. **E2E**: `games-delete.spec.ts`. Includes Escape-to-close,
   backdrop-click-to-close, and the full delete-from-detail flow
   that ends on `/dashboard` with the row gone.

**Phase 4 acceptance**: typed gate behaves exactly per
FR-016 / FR-017; deletes from both surfaces end up where the spec
says they should.

## Phase 5: View All Games (P5)

Deliverable: the "View All Games" link opens `/games` which lists
every game the GM owns, regardless of status.

1. **Backend**: flesh out `:list_mine`. Tests: policy + action +
   `GET /api/json/games/all` request + `listMine` RPC.
2. **Frontend**:
   - `useListMine` hook.
   - `routes/games.index.tsx`: same `<GamesTable>` as the
     dashboard but with a status column added. Uses the same
     `<EmptyState>` as the dashboard (driven by the same
     discriminated state). Both delete and view actions per row.
3. **E2E**: `games-all.spec.ts`. Covers navigating from the
   dashboard's "View All Games" link, seeing a Paused game there
   but NOT on the dashboard, and deleting from the all-games row.

**Phase 5 acceptance**: cross-page navigation + mixed-status listing
works end-to-end.

## Cross-phase verification (before merge)

Every phase ends with these gates clean:

```sh
mix precommit                          # format, compile -Wall, credo --strict,
                                        # tests, ash.codegen --check, mix_audit

cd assets
bun run test                            # Vitest suite
bun run lint                            # ESLint
bun run typecheck                       # tsc --noEmit
bun run test:e2e                        # Playwright (spawns mix phx.server)
```

The plan's Technical Context targets:

- `/games` + `/games/new` route chunks each ≤ 15 KB gzipped.
- No regression on LCP / INP / CLS baselines (Lighthouse CI).
- Dashboard with 50 Active games renders in < 2 s
  (covered by the composite Postgres index + SC-003).

## Relationship to the auth work

This feature builds directly on [plans/replace-ash-auth-screens-with-spa.md](../../plans/replace-ash-auth-screens-with-spa.md)
(auth SPA migration, merged as `baacc1a`). Specifically:

- Reuses `createResourceHooks`, `buildCSRFHeaders`, and the
  toast provider that shipped with the auth work.
- Extends the existing `<AuthProvider>` → `<ToastProvider>` →
  `<RouterProvider>` tree in `index.tsx` (no new providers).
- The `/test/sign-in-as` helper seeds E2E auth exactly as it does
  in the auth specs.
- The delete confirmation modal is the first use of Shadcn `<Dialog>`
  in this codebase; the primitive is added here and future features
  inherit it.
