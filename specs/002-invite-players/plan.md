# Implementation Plan: Invite Players

**Branch**: `002-invite-players` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-invite-players/spec.md`

## Summary

Add two new Ash resources (`Player`, `Invitation`) to the existing
`GameNight.Games` domain, plus a new `GameNight.Notifications` domain
hosting a polymorphic `Notification` resource. Invitations are
created by a GM, mailed via the existing Swoosh + AshAuthentication
sender pattern, and carry a token minted into the existing
`GameNight.Accounts.Token` table with a custom `:invitation_accept`
purpose. The token-bearer can accept regardless of the email they
register with; an in-app notification is materialised at invite-time
when the email matches an existing user. The SPA gains five new
routes (`/invitations/:token`, `/invitations`, `/notifications`,
`/characters`, plus the updated `/games/:id` view) and a redesigned
two-column dashboard with `My Characters` left and `My Games` right.
`Game.read` is expanded so accepted players can view games they're
seated at. `gm_notes` is field-policy-gated so it leaks to no one
but the GM. All work proceeds TDD per the constitution, with each
of the spec's six user stories delivered as an independently
testable tracer bullet.

## Technical Context

**Language/Version**: Elixir ~> 1.15 (backend), TypeScript 5.7 / React 19 (frontend). Constitutional baseline.
**Primary Dependencies**: `ash ~> 3.0`, `ash_postgres`, `ash_json_api`, `ash_authentication`, `ash_typescript`, `open_api_spex`, `swoosh`, Phoenix ~> 1.8, Bandit. Frontend: TanStack Router/Query, React Hook Form + Zod, Shadcn primitives (existing — `dropdown-menu`, `popover`, and `badge` may need to be added for the notifications bell), MSW, Playwright. **No new top-level dependencies are anticipated** — the invitation token flow rides existing AshAuthentication machinery, and email rides existing `GameNight.Mailer`.
**Storage**: PostgreSQL via `ash_postgres`. Three new tables: `players`, `invitations`, `notifications`. Token rows live in the existing `tokens` table with a new `purpose` value `"invitation_accept"`.
**Testing**: ExUnit (resource, policy, JSON:API request, RPC binding tests; new email-rendering test using Swoosh's `assert_email_sent`/local mailbox; token round-trip test). Vitest + RTL + `vitest-axe` for components and hooks. Playwright + `@axe-core/playwright` for E2E. The existing `TestMailboxController` (`/test/mailbox`) is reused so Playwright specs can fish invitation tokens out of test emails. No direct `Ecto.Repo` writes anywhere in the feature.
**Target Platform**: Linux server (Phoenix/Bandit); SPA in latest-2 stable desktop and mobile browsers per constitution.
**Project Type**: Web application (Elixir/Phoenix backend + React SPA under `assets/`).
**Performance Goals**: Dashboard with up to 50 player records and 50 active games render-ready within 2 s on a standard desktop connection (SC-002 for "My Characters" parity with existing dashboard target). Invitation accept and decline RPCs p95 ≤ 200 ms (one DB write + one notification update + one token-revoke). Email send is asynchronous (Swoosh local-adapter in test, configured production adapter elsewhere) and is not on the critical path of the GM's invite-submit response. No regression on existing Core Web Vitals budgets.
**Constraints**: Bundle delta ≤ 50 KB gzipped across the new routes combined (each route chunk lazy-loaded via TanStack Router). Deny-by-default policies on every new action. Cross-tenant data exposure remains 0% — the new "I'm a player" branch on `Game.read` is bounded by `exists(players, user_id == ^actor(:id))` and is policy-tested in both directions. `gm_notes` MUST never serialise for a non-GM caller (SC-005 hard-zero criterion).
**Scale/Scope**: 2 new Ash resources + 1 new Ash domain + 1 expanded resource (Game), ~16 actions across the new resources, 4 new SPA routes + 1 dashboard rewrite + 1 game-detail update + 1 navbar component (notifications bell), ~29 functional requirements across 6 user stories. The core loop is ~3 weeks of focused work across the six phases below.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First Development (NON-NEGOTIABLE)**: **PASS**.
  - ExUnit: action + policy tests for `GameNight.Games.Player` and `GameNight.Games.Invitation` (each action has authorized, unauthorized, and anonymous cases per constitution); a dedicated cross-resource test asserting `Game.read` admits an accepted player and rejects a non-player; field-policy tests asserting `gm_notes` is null for non-GM callers regardless of action; an `Invitation.accept` test that exercises the token round-trip via `AshAuthentication.TokenResource`; a Swoosh `assert_email_sent` test for `SendInvitationEmail`. Notifications tests cover the create-on-invite-when-email-matches branch and the resolve-on-accept/decline/revoke branches.
  - Vitest: colocated tests for every new SPA route and shared primitive (`InvitationForm`, `PlayersTable`, `PendingInvitationsList`, `MyCharactersColumn`, `MyGamesColumn`, `NotificationsBell`, `NotificationsList`, `AcceptInvitationCard`) with `expectNoAxeViolations` on each. MSW mocks `/rpc/run` for all new actions.
  - Playwright: one E2E spec per priority-bearing story (US1 new-user invite end-to-end including registration, US2 existing-user invite, US3 GM roster + status edit + revoke, US4 decline, US5 dashboard My Characters, US6 in-app notification accept). The new-user spec exercises the real `TestMailboxController` to fetch the invitation token from the local Swoosh mailbox.
  - Every commit that introduces behaviour ships its failing test first per `/tdd` skill procedure. No scaffolding-only commits.

- **II. Security & Authorization by Default (NON-NEGOTIABLE)**: **PASS**.
  - **New resources**:
    - `GameNight.Games.Player`: deny-by-default. Read actions split — `:list_for_game` (admits GM and players-of-game) excludes `gm_notes`; `:list_for_gm` admits only the GM and includes `gm_notes`; `:list_mine` admits the actor for their own player rows; `:update` admits only the GM. `gm_notes` is `public? false` and is loaded explicitly by `:list_for_gm` via a calculation guarded by a field policy that re-asserts GM-ness as defence in depth (see [research.md §5](./research.md)). The unique `(game_id, user_id)` constraint plus an Ash changeset validation prevents the duplicate-Player race (FR-014, SC-006).
    - `GameNight.Games.Invitation`: deny-by-default. `:create_for_game` admits only the actor who owns the target game (`game.owner_id == ^actor(:id)`); `:list_pending_for_game` admits only the GM; `:list_pending_for_me` admits the actor and filters by `email == ^actor(:email)` (resolves a fresh user to any pending invitation against their primary email); `:accept_with_token` admits any actor with a valid, non-revoked, non-expired token whose `purpose == "invitation_accept"` resolves to a `pending` invitation; `:decline_with_token` symmetric; `:revoke` admits only the GM.
    - `GameNight.Notifications.Notification`: deny-by-default. `:list_mine` and `:mark_read` admit only the actor for their own rows. Notifications are created and resolved by **system actions** invoked from `Invitation` changes — confined to a clearly named internal context (`GameNight.Notifications.System`) and justified in a top-of-module comment per constitution.
  - **Game.read policy expansion**: the existing `policy action_type(:read) do authorize_if expr(owner_id == ^actor(:id)) end` is extended with a second `authorize_if expr(exists(players, user_id == ^actor(:id)))` clause. The `:list_mine` and `:list_mine_active` named reads keep their `prepare build(filter: …)` so the dashboard right-column is unchanged; only `:get_mine` newly admits accepted players. Tested in both directions (player can read; non-player non-owner gets 404).
  - **Token & session storage**: invitation tokens use the existing AshAuthentication `tokens` table (purpose `"invitation_accept"`, subject `"invitation:#{id}"`, default expiration 30 days, configurable via `config :game_night, :invitation_token_ttl`). The token is delivered by email and exists only in the URL the recipient holds; it never lands in `localStorage`/`sessionStorage`. Acceptance produces a session via the standard auth flow (the recipient is already logged in by then); no new auth flow is introduced. CSRF on the SPA's accept/decline mutations rides the same `:browser` pipeline as existing RPC.
  - **CI security gates**: Trivy / Sobelow / mix_audit / npm audit / gitleaks all run on every PR per constitution; no new dependencies expected, so attention to those gates is the standard regression-watching kind. Sobelow `--strict` keeps reading the new sender for HTML-injection patterns — invitation HTML uses the same template helpers as the magic-link sender, which Sobelow has already cleared.
  - **Input trust boundaries**: every new action's `accept` list is restricted to user-mutable attributes; `String.to_atom/1` is not used on input anywhere in this feature (statuses go through `Ash.Type.Atom` constraints, not `to_atom`). Email addresses are normalised to `:ci_string` via the same path the auth resource uses.
  - **No direct Repo access**: every read and write goes through Ash code interfaces on `GameNight.Games` or `GameNight.Notifications`. No exceptions in this feature.

- **III. API Contract via JSON:API (NON-NEGOTIABLE)**: **PASS**.
  - Both new resources declare a `json_api do ... end` block. `Player` exposes `:list_for_game`, `:list_for_gm`, `:list_mine`, `:update`; `Invitation` exposes `:create_for_game`, `:list_pending_for_game`, `:list_pending_for_me`, `:accept_with_token`, `:decline_with_token`, `:revoke`. `Notification` exposes `:list_mine` and `:mark_read`. The new domains/resources are registered in `GameNightWeb.AshJsonApiRouter` (`domains: [GameNight.Telemetry, GameNight.Games, GameNight.Notifications]`).
  - `open_api_spex` regenerates and the resulting spec is committed; the drift gate catches any divergence.
  - `AshTypescript.Rpc` regeneration emits typed client functions for the same actions. The SPA consumes the RPC surface via `createResourceHooks`-style feature hooks; the JSON:API surface remains available for tests and external tooling.
  - `mix ash.codegen --check` and the `ash_typescript.codegen` drift gate run on every PR per constitution §Development Workflow.
  - Pure-SPA boundary unchanged: no RSC, no SSR.

- **IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)**: **PASS**.
  - Five new SPA routes (`/invitations/:token`, `/invitations`, `/notifications`, `/characters`, plus the updated `/games/:id`) each render a `<h1 data-route-heading>` consumed by `useFocusOnRouteChange`. Route-change announcements use the shared `A11yAnnouncer`.
  - `axe-core` runs against each route in Playwright and against each component test in Vitest (via `expectNoAxeViolations`).
  - The notifications bell is a Radix `<DropdownMenu>` (Shadcn) — focus trap, Escape-to-close, focus restoration. The accept/decline confirmation on `/invitations/:token` is a static page (not a modal), so no dialog primitive is required there; the GM-side revoke uses the existing Shadcn `<Dialog>` with the typed-confirmation pattern from feature 001.
  - WCAG 2.2 new AA criteria: (2.4.11) the notifications dropdown closes on focus-visible blur and never overlaps the route's primary `<h1>`; (2.5.7) no drag interactions; (2.5.8) bell-button + dropdown items + accept/decline buttons are sized at the existing Shadcn `sm`/icon defaults (≥36×36 / ≥24×24 verified per component).
  - Per-release manual audit covers the new routes and the bell dropdown (keyboard, screen reader, contrast).

- **V. UX for Non-Technical Operators**: **PASS**.
  - Every form has explicit loading, empty, and error states. The dashboard's two columns each have a discriminated empty state (`no_characters` / `no_games`).
  - Destructive actions: revoking a pending invitation uses the typed-confirmation `<Dialog>` from feature 001 (typing the invitee's email confirms). Declining an invitation also confirms (lighter-weight — single click + are-you-sure modal, no typed input).
  - Error messages in plain language: "We couldn't send the invitation — try again or check the email address" rather than constraint-name leakage. The token-not-found path on `/invitations/:token` reads "This invitation link is no longer valid. Ask the GM to send a new one." rather than exposing the token resource error.
  - Forms use Shadcn's `<Form>` + `FormField`/`FormMessage` with `mode: "onTouched"` validation; submit buttons are disabled only with a visible reason ("Email is required" inline rather than a silent disabled state).
  - Toast feedback for invitation-sent / accepted / declined / revoked / player-updated rides the existing `TOAST_MESSAGES` whitelist, extended with the new keys.

- **VI. Performance Discipline**: **PASS**.
  - New route chunks are lazy-loaded; total delta ≤ 50 KB gzipped. The `size-limit` config gains entries for `/invitations/$token` (≤ 12 KB), `/invitations` (≤ 8 KB), `/characters` (≤ 8 KB), `/notifications` (≤ 8 KB). The dashboard rewrite stays under its existing budget.
  - Ash actions emit `:telemetry` automatically. The new hot reads are `:list_pending_for_me` (called on login + on notification poll/refresh), `:list_mine` on `Player` (My Characters), and `:list_for_game` on `Player` (game detail). Composite indexes:
    - `players(user_id, status, updated_at DESC)` — My Characters dashboard sort.
    - `players(game_id, status, updated_at DESC)` — game-detail roster sort.
    - `invitations(game_id, status, updated_at DESC)` — GM-side pending list.
    - `invitations(email, status)` — list-pending-for-me lookup.
    - `notifications(user_id, resolved_at, inserted_at DESC)` — bell dropdown unread query.
  - Backend p95 budget: each new action ≤ 150 ms p95 under normal load. `Invitation.create_for_game` is the heaviest path (insert + token store + conditional notification insert + Swoosh enqueue) and is budgeted at ≤ 250 ms p95 with the email send moved off the request path via Swoosh's async behaviour where the configured adapter supports it (production-only optimisation; test/dev use the local synchronous mailbox).
  - Lighthouse CI runs against `/dashboard`, `/games/:id`, and `/invitations/:token` on every PR.

All six principles pass. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-invite-players/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── json-api.md      # JSON:API surface for Player, Invitation, Notification
│   └── rpc.md           # ash_typescript RPC surface (SPA-facing)
├── checklists/
│   └── requirements.md  # Produced by /speckit.specify
└── tasks.md             # Produced by /speckit.tasks (later)
```

### Source Code (repository root)

```text
lib/
├── game_night/
│   ├── games.ex                                    # UPDATED: register Player + Invitation; expand typescript_rpc
│   ├── games/
│   │   ├── game.ex                                 # UPDATED: expand :read policy; add has_many :players, has_many :invitations
│   │   ├── player.ex                               # NEW: Ash resource with actions + policies + field policy on gm_notes
│   │   └── invitation.ex                           # NEW: Ash resource with token round-trip actions + policies
│   ├── notifications.ex                            # NEW: Ash domain (AshJsonApi + AshTypescript.Rpc)
│   ├── notifications/
│   │   ├── notification.ex                         # NEW: polymorphic Ash resource (subject_type + subject_id)
│   │   └── system.ex                               # NEW: internal context that creates/resolves notifications via system actions; bypassed policies justified in module @moduledoc
│   └── games/
│       └── invitation/
│           └── senders/
│               └── send_invitation_email.ex        # NEW: Swoosh sender mirroring SendMagicLinkEmail shape
└── game_night_web/
    ├── ash_json_api_router.ex                      # UPDATED: add GameNight.Notifications to :domains
    └── router.ex                                    # No structural change; new resources route under existing /api forward

priv/
├── repo/migrations/
│   ├── <ts>_create_players.exs                     # NEW (mix ash.codegen)
│   ├── <ts>_create_invitations.exs                 # NEW (mix ash.codegen)
│   └── <ts>_create_notifications.exs               # NEW (mix ash.codegen)
└── resource_snapshots/
    └── repo/
        ├── players/                                # NEW
        ├── invitations/                            # NEW
        └── notifications/                          # NEW

test/
├── game_night/
│   ├── games/
│   │   ├── player_test.exs                         # NEW
│   │   ├── invitation_test.exs                     # NEW (includes token round-trip + email-sent assertions)
│   │   └── game_test.exs                           # UPDATED: cross-resource :read admits accepted player
│   └── notifications/
│       ├── notification_test.exs                   # NEW
│       └── system_test.exs                         # NEW (assert system actions create+resolve as expected)
└── game_night_web/
    └── controllers/
        ├── players_request_test.exs                # NEW
        ├── invitations_request_test.exs            # NEW
        └── notifications_request_test.exs          # NEW

assets/
├── js/
│   ├── ash_rpc.ts                                  # REGENERATED by ash_typescript.codegen
│   ├── ash_types.ts                                # REGENERATED
│   ├── components/
│   │   └── ui/
│   │       ├── dropdown-menu.tsx                   # NEW (Shadcn Radix DropdownMenu) — for bell
│   │       ├── popover.tsx                         # NEW (Shadcn Radix Popover) — possible alt for bell; pick one in tasks
│   │       └── badge.tsx                           # NEW (Shadcn) — unread-count badge on the bell
│   ├── features/
│   │   ├── players/
│   │   │   ├── hooks.ts                            # NEW: useListMyCharacters, useListPlayersForGame, useListPlayersForGm, useUpdatePlayer
│   │   │   ├── hooks.test.ts
│   │   │   ├── components/
│   │   │   │   ├── players-table.tsx               # NEW: roster table on /games/:id (player view + GM view variants)
│   │   │   │   ├── players-table.test.tsx
│   │   │   │   ├── player-edit-dialog.tsx          # NEW: GM edits a player (character_name, summary, gm_notes, status)
│   │   │   │   ├── player-edit-dialog.test.tsx
│   │   │   │   ├── my-characters-column.tsx        # NEW: dashboard left column
│   │   │   │   ├── my-characters-column.test.tsx
│   │   │   │   └── characters-empty-state.tsx      # NEW: dashboard left empty state
│   │   │   └── schemas.ts                          # NEW: shared Zod for character_name, summary, gm_notes, status
│   │   ├── invitations/
│   │   │   ├── hooks.ts                            # NEW: useCreateInvitation, useListPendingForGame, useAcceptInvitation, useDeclineInvitation, useRevokeInvitation, useListPendingForMe
│   │   │   ├── hooks.test.ts
│   │   │   ├── components/
│   │   │   │   ├── invitation-form.tsx             # NEW: GM invite form (rendered inside InvitePlayerDialog on /games/:id)
│   │   │   │   ├── invitation-form.test.tsx
│   │   │   │   ├── invite-player-dialog.tsx        # NEW: modal wrapper around InvitationForm, triggered from the Players header
│   │   │   │   ├── invite-player-dialog.test.tsx
│   │   │   │   ├── pending-invitations-list.tsx    # NEW: GM-only on /games/:id
│   │   │   │   ├── pending-invitations-list.test.tsx
│   │   │   │   ├── revoke-invitation-dialog.tsx    # NEW: typed-confirmation modal (mirrors delete-game-dialog pattern)
│   │   │   │   ├── revoke-invitation-dialog.test.tsx
│   │   │   │   ├── accept-invitation-card.tsx      # NEW: rendered on /invitations/:token after auth
│   │   │   │   ├── accept-invitation-card.test.tsx
│   │   │   │   ├── decline-invitation-confirm.tsx  # NEW: lightweight confirm modal
│   │   │   │   └── decline-invitation-confirm.test.tsx
│   │   │   └── schemas.ts                          # NEW: shared Zod for email + character_name + summary + gm_notes
│   │   ├── notifications/
│   │   │   ├── hooks.ts                            # NEW: useMyNotifications, useUnreadCount, useMarkRead
│   │   │   ├── hooks.test.ts
│   │   │   ├── components/
│   │   │   │   ├── notifications-bell.tsx          # NEW: navbar bell + badge + dropdown (Radix DropdownMenu)
│   │   │   │   ├── notifications-bell.test.tsx
│   │   │   │   ├── notifications-list.tsx          # NEW: /notifications full-page list
│   │   │   │   └── notifications-list.test.tsx
│   │   │   └── kinds.ts                            # NEW: discriminated union of notification kinds (start with "game_invitation"; designed to grow)
│   │   ├── games/
│   │   │   └── components/
│   │   │       ├── my-games-column.tsx             # NEW: dashboard right column (renames the existing My Active Games section)
│   │   │       └── my-games-column.test.tsx
│   │   └── toasts/
│   │       └── toast-provider.tsx                  # UPDATED: extend TOAST_MESSAGES whitelist
│   └── routes/
│       ├── dashboard.tsx                           # UPDATED: two-column layout (My Characters left, My Games right)
│       ├── dashboard.test.tsx                      # UPDATED
│       ├── characters.tsx                          # NEW: /characters all-statuses Player list (links each to /games/:id)
│       ├── characters.test.tsx
│       ├── invitations.index.tsx                   # NEW: /invitations — pending invitations addressed to me
│       ├── invitations.index.test.tsx
│       ├── invitations.$token.tsx                  # NEW: /invitations/:token — accept/decline page (handles new-user redirect-to-register flow)
│       ├── invitations.$token.test.tsx
│       ├── notifications.tsx                       # NEW: /notifications full list
│       ├── notifications.test.tsx
│       ├── games.$id.index.tsx                     # UPDATED: render PlayersTable + (GM-only) PendingInvitationsList + Invite-player button (in Players header) opening InvitePlayerDialog
│       ├── games.$id.index.test.tsx                # UPDATED
│       └── __root.tsx                              # UPDATED: insert NotificationsBell into the navbar (auth-only render)
└── e2e/
    ├── invitations-new-user.spec.ts                # NEW: US1 (uses TestMailboxController)
    ├── invitations-existing-user.spec.ts           # NEW: US2
    ├── games-roster-management.spec.ts             # NEW: US3 (revoke + status edit)
    ├── invitations-decline.spec.ts                 # NEW: US4
    ├── dashboard-my-characters.spec.ts             # NEW: US5
    └── notifications-bell.spec.ts                  # NEW: US6
```

**Structure Decision**: Web-application layout (existing pattern preserved). New backend files live under the existing `GameNight.Games` domain (Player + Invitation per Q1) and a new `GameNight.Notifications` domain (per Q3 — Notification is polymorphic and designed to grow beyond invitations, which earns it its own bounded concern). Frontend files follow feature-folder conventions established by the auth and games work: one feature folder per concern, colocated Vitest tests, route files named to match URL segments. The notifications bell lives in the navbar via `__root.tsx` so every authenticated route shows it.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — all six principles pass on the initial check. The two non-default choices ((a) reusing AshAuthentication's `tokens` table for invitation tokens, (b) materialising `Notification` rather than deriving the list) are documented in [research.md §2](./research.md) and [research.md §3](./research.md); neither is a constitutional violation, and both are the result of explicit grilling-round decisions to align with existing patterns and stated forward direction. If a post-Phase 1 re-check surfaces anything, it will be recorded here.
