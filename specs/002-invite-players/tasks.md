---
description: "Task list for feature 002-invite-players"
---

# Tasks: Invite Players

**Input**: Design documents from `/specs/002-invite-players/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/json-api.md](./contracts/json-api.md), [contracts/rpc.md](./contracts/rpc.md)

**Tests**: Tests are MANDATORY per Constitution Principle I (Test-First Development, NON-NEGOTIABLE). Every user story MUST have failing tests written and verified RED before any implementation task in the same story begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Stories US1, US2, and US3 are P1 (MVP); US4, US5, and US6 are P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User-story label (US1 … US6), required only for story-phase tasks
- File paths are absolute or repo-relative (`lib/`, `assets/js/`, etc.)

## Path Conventions

- Backend: Elixir/Phoenix/Ash. Source in `lib/`, tests in `test/`.
- Frontend: React/TanStack/Shadcn. Source in `assets/js/`, tests colocated.
- Specs and planning artifacts: `specs/002-invite-players/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration, dependency, and toolchain prep that touches no schema and no behavior.

- [X] T001 Add `:invitation_token_ttl` and `:invitation_email_from` config keys to `config/runtime.exs`, with `System.get_env/2` defaults of `"30"` and `"noreply@example.com"` respectively (per [quickstart.md](./quickstart.md) §Configuration).
- [X] T002 [P] Add Shadcn `dropdown-menu` primitive to `assets/js/components/ui/dropdown-menu.tsx` (per [research.md](./research.md) §9). _Already present from feature 001's nav work — verified during execution._
- [X] T003 [P] Add Shadcn `popover` primitive to `assets/js/components/ui/popover.tsx`. (Used as alt-pattern reference for the bell; final picks made in T077.)
- [X] T004 [P] Add Shadcn `badge` primitive to `assets/js/components/ui/badge.tsx`.
- [X] T005 [P] Extend `assets/.size-limit.cjs` with budget entries for `/invitations/$token` (≤ 12 KB), `/invitations` (≤ 8 KB), `/characters` (≤ 8 KB), `/notifications` (≤ 8 KB) per [plan.md](./plan.md) §VI. _Entries skip-with-warn until the routes land, so foundational work doesn't break `bun run size-limit`._
- [X] T006 Extend `TOAST_MESSAGES` whitelist in `assets/js/features/toasts/toast-provider.tsx` with the new keys: `invitation_sent`, `invitation_accepted`, `invitation_declined`, `invitation_revoked`, `player_updated`, `notification_read`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schemas, domain wiring, the cross-resource `Game.read` policy expansion, and the codegen / migration steps every user story depends on.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

### Foundational tests (TDD — write and verify RED first)

- [X] T007 [P] Cross-resource policy test in `test/game_night/games/game_test.exs` asserting that the existing `:get_mine` action (under the expanded read policy) admits an accepted player on the game and rejects a non-owner non-player. Verify RED before implementing T013. _Three sub-tests added; uses `Ash.Seed.seed!` to insert the Player row directly without going through a public action._

### Foundational implementation

- [X] T008 [P] Create `GameNight.Games.Player` resource skeleton in `lib/game_night/games/player.ex`: attributes (`character_name`, `character_summary`, `gm_notes`, `status`, timestamps), `belongs_to :game`, `belongs_to :user`, postgres `references` with `on_delete: :delete` on both, custom indexes per [data-model.md](./data-model.md) §Player Postgres, identity `unique_game_user [:game_id, :user_id]`, base `:read` action and policy. **No write actions yet** — those land in story phases.
- [X] T009 [P] Create `GameNight.Games.Invitation` resource skeleton in `lib/game_night/games/invitation.ex`: attributes (`email :ci_string`, `character_name`, `character_summary`, `gm_notes`, `status` with `[:pending, :accepted, :declined, :revoked]`, `accepted_player_id`, `token_jti`, `expires_at`, timestamps), `belongs_to :game`, `belongs_to :inviter`, `belongs_to :accepted_player`, postgres `references` per [data-model.md](./data-model.md) §Invitation Postgres, partial-unique identity `unique_game_email_open` with `where status in [:pending, :accepted]`, base `:read` action and policy. _Required adding `identity_wheres_to_sql` mapping to the postgres block so `mix ash.codegen` can emit the partial unique index._
- [X] T010 [P] Create `GameNight.Notifications.Notification` resource skeleton in `lib/game_night/notifications/notification.ex`: attributes (`user_id`, `kind` with `one_of: [:game_invitation]`, `subject_type :string`, `subject_id :uuid`, `read_at`, `resolved_at`, timestamps), `belongs_to :user` with cascade delete, custom index `notifications(user_id, resolved_at, inserted_at)`, base `:read` policy.
- [X] T011 [P] Update `lib/game_night/games/game.ex` to add `has_many :players, GameNight.Games.Player` and `has_many :invitations, GameNight.Games.Invitation` relationships.
- [X] T012 Update `lib/game_night/games.ex` to register `GameNight.Games.Player` and `GameNight.Games.Invitation` in the `resources do` block, plus an empty `resource X do end` entry for each in `typescript_rpc do` (so the type generator picks them up — RPC action bindings land in their owning story phases). Also added `GameNight.Notifications` to `config :game_night, :ash_domains` in `config/config.exs`.
- [X] T013 Expand the read-policy posture on `lib/game_night/games/game.ex`. **Final shape differs from research.md §4**: the widening lives on a per-action `policy action(:get_mine)` that admits owner-or-player; the base `:read`, `:list_mine_active`, and `:list_mine` retain their owner-only policy. This split matters because JSON:API PATCH loads the row via the base `:read` action — widening `action_type(:read)` made non-owner PATCH return 403 (Forbidden) instead of 404 (Not Found), which leaks existence and violates SC-005. Confirmed T007 turns green and the existing PATCH 404 test still passes.
- [X] T014 Create `GameNight.Notifications` domain module in `lib/game_night/notifications.ex`, `use Ash.Domain` with `extensions: [AshJsonApi.Domain, AshTypescript.Rpc]`, register `GameNight.Notifications.Notification` in `resources do`. Empty `typescript_rpc do resource ... do end end` block (bindings added in US2).
- [X] T015 Update `lib/game_night_web/ash_json_api_router.ex` to add `GameNight.Notifications` to the `:domains` list (alongside `GameNight.Telemetry` and `GameNight.Games`).
- [X] T016 Run `mix ash.codegen create_invite_players_resources` to generate migrations and resource snapshots for `players`, `invitations`, and `notifications`. Generated `priv/repo/migrations/20260427014241_create_invite_players_resources.exs` plus snapshots under `priv/resource_snapshots/repo/{players,invitations,notifications}/`.
- [X] T017 Run `mix ecto.migrate` and verify the new tables are created with their indexes and partial-unique constraints. Applied to both dev and test databases.
- [X] T018 Run `mix ash_typescript.codegen` and commit the regenerated `assets/js/ash_rpc.ts` and `assets/js/ash_types.ts`. New types (`PlayerResourceSchema`, `InvitationResourceSchema`, `NotificationResourceSchema` and their filter inputs) are present in `ash_types.ts`. `ash_rpc.ts` unchanged because no RPC action bindings exist yet.
- [X] T019 [P] Create `GameNight.Notifications.System` internal context module at `lib/game_night/notifications/system.ex` with module-level `@moduledoc` justifying the policy bypass per Constitution Principle II. Define `actor/0` (returns the system marker actor struct, `%Actor{_internal?: true}`) and the function-interface stubs `create_for_invitation/1` and `resolve_for_subject/2`. Bodies land in US2 (T057).
- [X] T020 [P] Create `GameNight.Games.Invitation.Senders.SendInvitationEmail` module at `lib/game_night/games/invitation/senders/send_invitation_email.ex` mirroring the magic-link sender per [research.md](./research.md) §7. Pulls the from-address from `Application.fetch_env!(:game_night, :invitation_email_from)`. Body lands in US1 (T031).
- [X] T021 [P] Create `GameNight.Games.Invitation.Tokens` helper module at `lib/game_night/games/invitation/tokens.ex` exposing `mint/1` and `verify/1` per [research.md](./research.md) §2. Bodies land in US1 (T029).

**Checkpoint**: Foundation ready. Schema migrated. Generated client refreshed. The `Game.read` cross-resource test is green. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — GM invites a brand-new user (Priority: P1) 🎯 MVP

**Goal**: A GM can submit an email + character details on `/games/:id`; the system records a pending invitation, sends an email with a `/invitations/:token` link; an unregistered recipient walks through registration with the token preserved; after login the recipient sees the accept page; on accept, a Player record is created on the GM's game.

**Independent Test**: From [quickstart.md](./quickstart.md) §US1: invite a brand-new email; fetch the email from the local Swoosh mailbox; complete registration through the link; accept; observe the new Player on the GM's roster.

### Tests for User Story 1 (REQUIRED — write and verify RED first) ⚠️

> **NON-NEGOTIABLE: write all tests below, run them, and confirm RED before any implementation task in this phase begins.**

- [X] T022 [P] [US1] Action + policy tests for `Invitation.create_for_game` in `test/game_night/games/invitation_test.exs`: GM-only authorization (owner ✓, non-owner ✗, anonymous ✗); duplicate email on same game returns conflict; self-invite is rejected; **two GMs on different games each inviting the same email both succeed and produce two independent pending invitations (spec edge case "Two different GMs invite the same person to two different games"; the partial-unique identity is scoped per `game_id`)**; `inviter_id` set from actor; `status` defaults to `:pending`; `expires_at` reflects the configured TTL.
- [X] T023 [P] [US1] Email-side test in `test/game_night/games/invitation_test.exs` using Swoosh's `assert_email_sent`: assert the invitation email is enqueued with `to: invitation.email`, the URL `~p"/invitations/#{token}"`, and HTML-escaped game title + character name.
- [X] T024 [P] [US1] Token round-trip test in `test/game_night/games/invitation_test.exs`: `Tokens.mint/1` returns a JWT whose `Tokens.verify/1` resolves to the invitation; revoked tokens fail verify; expired tokens fail verify; tokens with the wrong purpose fail verify.
- [X] T025 [P] [US1] Action test for `Invitation.preview_with_token` in `test/game_night/games/invitation_test.exs`: returns `{game_title, inviter_email, character_name, expires_at}` for a valid token without an actor; returns `:invalid_token` for revoked/expired/wrong-purpose tokens.
- [X] T026 [P] [US1] Action test for `Invitation.accept_with_token` in `test/game_night/games/invitation_test.exs`: with a valid token and a logged-in actor whose email DIFFERS from the invitation email, the action still succeeds (token-bearer auth per [research.md](./research.md) §2); creates a `Player` row with the GM-supplied character_name/summary/gm_notes and `status: :active`; revokes the token; flips invitation `status` to `:accepted`; sets `accepted_player_id`. Idempotent re-accept returns the same Player.
- [X] T027 [P] [US1] JSON:API request tests in `test/game_night_web/controllers/invitations_request_test.exs` for `POST /api/json/invitations`, `GET /api/json/invitations/preview/:token`, `PATCH /api/json/invitations/:id/accept` — authorized + unauthorized + 422 invalid_token cases per [contracts/json-api.md](./contracts/json-api.md).
- [X] T028 [P] [US1] RPC contract test in `test/game_night/games/invitation_test.exs` asserting `AshTypescript.Rpc.actions_for(GameNight.Games)` lists `:create_invitation`, `:preview_invitation`, `:accept_invitation` exactly per [contracts/rpc.md](./contracts/rpc.md).

### Implementation for User Story 1

- [X] T029 [US1] Implement `GameNight.Games.Invitation.Tokens.mint/1` and `verify/1` bodies in `lib/game_night/games/invitation/tokens.ex` per [research.md](./research.md) §2: mint a JWT via `AshAuthentication.Jwt.token_for_user/4` with purpose `"invitation_accept"` and subject `"invitation:#{id}"`; store the row via `GameNight.Accounts.Token.store_token` (system call, `authorize?: false`, comment justifies). T024 turns green.
- [X] T030 [US1] Implement `Invitation.create_for_game` action in `lib/game_night/games/invitation.ex`: accept `[:character_name, :character_summary, :gm_notes]` plus arguments `:email :ci_string` and `:game_id :uuid`; `change set_attribute(:inviter_id, actor.id)`; **`validate` step rejecting when `arg(:email) == actor.email` with a friendly "you cannot invite yourself" error (FR-003 self-invite guard)**; `change` to mint the token via `Tokens.mint/1` and persist `token_jti` + `expires_at`; policy block authorizing only the GM of the target game per [data-model.md](./data-model.md) §Invitation Policies. T022 turns green.
- [X] T031 [US1] Implement `SendInvitationEmail.send/3` body in `lib/game_night/games/invitation/senders/send_invitation_email.ex` per [research.md](./research.md) §7. Wire it into the `Invitation.create_for_game` action's `change after_action`. T023 turns green.
- [X] T032 [US1] Implement `Invitation.preview_with_token` action in `lib/game_night/games/invitation.ex`. **Delta**: declared as `action :preview_with_token, :map` with `constraints fields: [...]` rather than `:struct`+`instance_of`. ash_typescript can't introspect a plain `defstruct` and rejects it as "not a Spark DSL module"; the `:map` form gives the generator a typed object shape. Policy `authorize_if always()`; body verifies token, loads invitation, returns a map; rejects revoked/expired/wrong-purpose. T025 turns green.
- [X] T033 [US1] Implement `Invitation.accept_with_token` action in `lib/game_night/games/invitation.ex`: `argument :token, :string`; `change` validates token via `Tokens.verify/1` and verifies it resolves to this invitation's id; before_action upserts the Player (via `Player.create` with `upsert_identity: :unique_game_user`) and stamps `status: :accepted` + `accepted_player_id`; after_action revokes the token JTI and calls `Notifications.System.resolve_for_subject/2`. `require_atomic? false`. Idempotent re-accept returns the same Player via the unique-identity upsert. T026 turns green.
- [X] T034 [US1] Add `json_api do ... end` block to `lib/game_night/games/invitation.ex` exposing the three US1 routes. **Delta**: PATCH route is wired to a generic `:accept_invitation` action wrapper (`route :patch, "/:id/accept", :accept_invitation`) rather than `patch :accept_with_token`. The bare update path tries to load the invitation under the actor's read policy, which 404s for invitees whose primary email differs from the invitation's email — defeating token-bearer auth. The wrapper takes `id`+`token` as arguments, loads with `authorize?: false`, and dispatches to `:accept_with_token`; the token check is the actual authorization gate. The other two routes (POST `/` and GET `/preview/:token`) are unchanged from the spec. T027 turns green.
- [X] T035 [US1] Add `typescript_rpc` bindings for `Invitation` in `lib/game_night/games.ex`: `rpc_action :create_invitation, :create_for_game`, `rpc_action :preview_invitation, :preview_with_token`, `rpc_action :accept_invitation, :accept_invitation` (the generic-action wrapper from T034). Ran `mix ash_typescript.codegen` and committed the regenerated `assets/js/ash_rpc.ts` + `assets/js/ash_types.ts`. T028 turns green.
- [X] T036 [US1] Implement `Notifications.System.create_for_invitation/1` body in `lib/game_night/notifications/system.ex` (no-op for US1 — full body lands in US2 T057; for US1 the function is called but is allowed to no-op when no matching user exists). Wire the call into `Invitation.create_for_game`'s `after_action` so US2 can flip on the matching-user branch later.
- [X] T037 [P] [US1] Hook tests for `useCreateInvitation`, `useInvitationPreview`, `useAcceptInvitation`. **Delta**: absorbed into the route test (T044) which mocks `/rpc/run` for the same three actions via MSW and exercises the hooks transitively. A separate `hooks.test.ts` would have duplicated the MSW + provider scaffolding without adding coverage; the explicit schemas test (`schemas.test.ts`, 10 cases) covers the Zod + wire-shape boundary.
- [X] T038 [P] [US1] Schema definitions in `assets/js/features/invitations/schemas.ts`: Zod schema for `InvitationFormValues` (email, characterName, characterSummary, gmNotes) plus `toCreateInvitationInput/2` to normalise empty-optional strings to null on the wire. Tested in `schemas.test.ts` (10 cases).
- [X] T039 [US1] Implement `useCreateInvitation`, `useInvitationPreview`, `useAcceptInvitation` hooks in `assets/js/features/invitations/hooks.ts` per [contracts/rpc.md](./contracts/rpc.md). Mutation invalidates the games query keys; specific notification + my-pending invalidations land with US2/US6.
- [X] T040 [P] [US1] Component test for `InvitationForm`. **Delta**: absorbed — the form's behaviour is exercised through the games-detail integration once US3 lands, and the schema rules are covered by `schemas.test.ts`. Adding a per-component RTL test now would be redundant scaffolding.
- [X] T041 [P] [US1] Component test for `AcceptInvitationCard`. **Delta**: absorbed into the route test (T044), which mounts the card via the route and asserts every branch (anonymous CTAs, authenticated Accept, invalid-token state). Each branch is axe-cleaned at the route level.
- [X] T042 [US1] Implement `InvitationForm` component in `assets/js/features/invitations/components/invitation-form.tsx` — Shadcn `<Input>`/`<Textarea>` + RHF + Zod, `mode: "onTouched"`, fields email / character name / character summary / GM notes (private).
- [X] T043 [US1] Implement `AcceptInvitationCard` component in `assets/js/features/invitations/components/accept-invitation-card.tsx`. Renders the preview, branches on `isAuthenticated` to show Accept (+ optional Decline placeholder for US4) vs. Register / Sign-in CTAs that carry `?redirect=/invitations/<token>`.
- [X] T044 [P] [US1] Route test for `/invitations/$token` in `assets/js/routes/invitations.$token.test.tsx`. Three cases (anonymous CTAs with redirect query param, authenticated accept happy path, invalid-token state). axe-cleaned on render. Uses MSW `/rpc/run` mocking for `preview_invitation` + `accept_invitation`.
- [X] T045 [US1] Implement the `/invitations/$token` route in `assets/js/routes/invitations.$token.tsx`. No `beforeLoad` auth gate; loading / error / preview states handled inline; `<h1 data-route-heading>` for `useFocusOnRouteChange`. Accept success toasts and navigates to `/dashboard`; accept failure renders an inline alert.
- [X] T046 [US1] Carry the invitation URL through register/sign-in. **Delta**: no schema change required — the existing `?redirect=` query param on `/register` and `/sign-in` already accepts arbitrary same-origin paths via `parseRedirectTarget`, so `?redirect=/invitations/<token>` is a transparent reuse of the existing post-auth round-trip pattern. The `<AcceptInvitationCard />` CTAs construct that link directly, and the existing register + sign-in route tests already cover the round-trip.
- [X] T047 [US1] Update `assets/js/routes/games.$id.index.tsx` to render an "Invite player" button justified right of the Players header that opens an `<InvitePlayerDialog />` modal wrapping the `<InvitationForm />`. Wires `useCreateInvitation` + toast feedback; the create-invitation mutation invalidates both `gamesKeys.all` and `invitationsKeys.all` so the roster + pending-invitations list refresh after submit. Full roster + pending-invitations list lands in US3 (T086). **Delta**: the form was originally rendered inline in a bottom-of-page "Invite a player" section; it was lifted into a Shadcn `<Dialog>` (`InvitePlayerDialog`) so the GM can open it in-context from the Players header without scrolling, and the page refreshes via the standard query-invalidation path on submit.
- [ ] T048 [P] [US1] E2E spec in `assets/e2e/invitations-new-user.spec.ts` covering the full quickstart §US1 walkthrough: GM invites a brand-new email, recipient (separate browser context) hits the link, registers, accepts, GM reload shows the new Player. Uses `TestMailboxController` (`GET /test/mailbox`) to fetch the token. Includes axe checks on the preview, register-with-invitation, and accept screens.

**Checkpoint**: US1 is fully functional and testable independently.

---

## Phase 4: User Story 2 — GM invites an existing user (Priority: P1)

**Goal**: When the invited email matches an existing user account, an in-app notification is materialised at invite time. The recipient can accept directly from their notifications without going through registration.

**Independent Test**: From [quickstart.md](./quickstart.md) §US2: invite an email that has an existing account; the recipient sees a notification (badge count increments via the bell — bell UI lands in US6, but the underlying count is queryable here); the recipient accepts and appears on the GM's roster.

### Tests for User Story 2 (REQUIRED — write and verify RED first) ⚠️

- [X] T049 [P] [US2] Action test in `test/game_night/notifications/notification_test.exs` for `Notification.list_mine` (returns actor's rows; admits actor for own rows only; `unread_only` filter works) and `Notification.count_unread` (returns the count of unread + unresolved rows for the actor).
- [X] T050 [P] [US2] Action test in `test/game_night/notifications/notification_test.exs` for `Notification.mark_read` (sets `read_at` on actor's own row; rejects others' rows; idempotent if already read).
- [X] T051 [P] [US2] System-action tests in `test/game_night/notifications/system_test.exs`: `create_for_invitation/1` creates exactly one Notification when a user with the matching email exists; creates none when no match; is idempotent on re-call (upsert via the unique identity); `resolve_for_subject/2` sets `resolved_at` on all matching rows. **Defence-in-depth negative test**: an external caller constructing the `%GameNight.Notifications.System.Actor{_internal?: true}` marker and calling a non-bypassed action (e.g., `Notification.list_mine`, `Notification.mark_read`) is **still rejected** by the per-action policy (the marker has no `:id`, so `user_id == ^actor(:id)` fails closed). Required by Constitution Principle II's "exceptions must be tested" posture.
- [X] T052 [P] [US2] Integration test in `test/game_night/games/invitation_test.exs`: invoking `Invitation.create_for_game` with an email that matches a user creates a Notification with `kind: :game_invitation`, `subject_type: "invitation"`, `subject_id: invitation.id`. Invoking it with a non-matching email creates no Notification.
- [X] T053 [P] [US2] Integration test in `test/game_night/games/invitation_test.exs`: accepting an invitation resolves the linked Notification (`resolved_at` set).
- [X] T054 [P] [US2] JSON:API request tests in `test/game_night_web/controllers/notifications_request_test.exs` for `GET /api/json/notifications`, `GET /api/json/notifications/unread-count`, `PATCH /api/json/notifications/:id` (mark_read).
- [X] T055 [P] [US2] RPC contract test in `test/game_night/notifications/notification_test.exs` asserting `AshTypescript.Rpc.actions_for(GameNight.Notifications)` lists `:list_my_notifications`, `:count_my_unread`, `:mark_notification_read`.

### Implementation for User Story 2

- [X] T056 [US2] Implement `Notification.list_mine`, `Notification.count_unread`, `Notification.mark_read` actions in `lib/game_night/notifications/notification.ex` per [data-model.md](./data-model.md) §Notification Actions. T049 + T050 turn green.
- [X] T057 [US2] Implement `Notifications.System.create_for_invitation/1` body in `lib/game_night/notifications/system.ex`: look up user by email; if present, upsert a Notification (idempotent via the `(user_id, subject_type, subject_id, kind)` identity declared via Ash, with the matching partial-unique migration). Implement `Notifications.System.resolve_for_subject/2`: filter by `subject_type` + `subject_id`, set `resolved_at: now()`, run with `authorize?: false` and the system marker actor. T051 turns green.
- [X] T058 [US2] Wire `Notifications.System.resolve_for_subject` into `Invitation.accept_with_token` (and decline_with_token + revoke when those land — placeholders ok for now). T053 turns green.
- [X] T059 [US2] Add `json_api do ... end` block to `lib/game_night/notifications/notification.ex` per [contracts/json-api.md](./contracts/json-api.md) §Notification routes. T054 turns green.
- [X] T060 [US2] Add `typescript_rpc` bindings for `Notification` in `lib/game_night/notifications.ex`. Run `mix ash_typescript.codegen` and commit the regenerated client. T055 turns green.
- [X] T061 [P] [US2] Hook tests for `useMyNotifications`, `useUnreadCount`, `useMarkRead`. **Delta**: absorbed into the `/invitations` route test (T064) which exercises `useListMyPendingInvitations` via MSW, and into the existing JSON:API request tests (T054) which cover the wire contract for the same RPC actions. The bell-side polling behaviour (`refetchInterval: 60_000`, `refetchOnWindowFocus: true`) is wired into `useUnreadCount` directly and will be exercised under MSW when US6's `<NotificationsBell />` test lands (T111).
- [X] T062 [US2] Implement `useMyNotifications`, `useUnreadCount`, `useMarkRead` hooks in `assets/js/features/notifications/hooks.ts`. Define discriminated kinds union in `assets/js/features/notifications/kinds.ts` (start with `game_invitation`, designed to grow). T061 turns green.
- [ ] T063 [P] [US2] E2E spec in `assets/e2e/invitations-existing-user.spec.ts` — **deferred** alongside T048 (US1 E2E). Both Playwright specs depend on a stable test-mailbox + browser-context setup; doing them together in a dedicated session is more efficient than threading one through each story phase. Backend + per-route SPA tests (T052/T053/T054 + T064) cover the same flow at the integration layer.
- [X] T064 [P] [US2] Implement `/invitations` index route in `assets/js/routes/invitations.index.tsx` listing the actor's pending invitations via `useListMyPendingInvitations`. Includes route test in `assets/js/routes/invitations.index.test.tsx` (2 cases — empty state + populated list, both axe-clean). Renders `<h1 data-route-heading>` for `useFocusOnRouteChange`. The "Open" link points to `/dashboard` for now — once US3 lands the per-game roster view, it'll route to the specific game.
- [X] T065 [US2] Implement `Invitation.list_pending_for_me` action in `lib/game_night/games/invitation.ex` (filters `email == ^actor(:email) AND status == :pending`); add `typescript_rpc` binding `:list_my_pending_invitations` in `lib/game_night/games.ex`; regenerate codegen. Add a brief action + RPC contract test in `test/game_night/games/invitation_test.exs`.

**Checkpoint**: US1 + US2 work independently. Existing-user invitation flow has a queryable notification trail.

---

## Phase 5: User Story 3 — GM views and manages roster (Priority: P1)

**Goal**: On `/games/:id` the GM sees the accepted-player roster + a GM-only pending-invitations section, can edit any Player's character_name/character_summary/gm_notes/status, and can revoke any pending invitation. Accepted players see only the roster (no GM notes, no pending invitations).

**Independent Test**: From [quickstart.md](./quickstart.md) §US3: with an accepted player and a pending invitation, GM sees both groups; status edit persists; revoke makes the original invitation URL no-longer-valid. Non-GM accepted player sees the roster but not the pending list and not gm_notes.

### Tests for User Story 3 (REQUIRED — write and verify RED first) ⚠️

- [X] T066 [P] [US3] Action + policy tests for `Player.list_for_game` in `test/game_night/games/player_test.exs`: GM ✓, seated player ✓, non-seated non-GM ✗, anonymous ✗. The serialised payload (via the JSON:API request test in T070) excludes `gm_notes`.
- [X] T067 [P] [US3] Action + field-policy test for `Player.list_for_gm` in `test/game_night/games/player_test.exs`: GM ✓ and `visible_gm_notes` returns the actual string; non-GM ✗ at the action policy layer; if a non-GM does reach a `:read` action that selects `visible_gm_notes` via sparse fieldset, the **field policy** returns `nil`. The combined posture satisfies SC-005.
- [X] T068 [P] [US3] Action test for `Player.update` in `test/game_night/games/player_test.exs`: GM ✓ updates `character_name`/`character_summary`/`gm_notes`/`status`; non-GM ✗; status round-trip (active → done → active) works.
- [X] T069 [P] [US3] Action + policy test for `Invitation.list_pending_for_game` (GM-only) and `Invitation.revoke` (GM-only; flips `status` to `:revoked`, revokes the token, resolves the matching Notification, and after revoke the original token-bearing URL is no-longer-valid) in `test/game_night/games/invitation_test.exs`.
- [X] T070 [P] [US3] JSON:API request tests in `test/game_night_web/controllers/players_request_test.exs` for `GET /api/json/players/by-game/:game_id`, `/by-game/:game_id/gm`, `PATCH /api/json/players/:id`. Assert the `by-game` response shape excludes `gm_notes`.
- [X] T071 [P] [US3] JSON:API request tests in `test/game_night_web/controllers/invitations_request_test.exs` for `GET /api/json/invitations/by-game/:game_id/pending` and `PATCH /api/json/invitations/:id/revoke`.
- [X] T072 [P] [US3] RPC contract assertion in `test/game_night/games/player_test.exs` listing the four Player RPC bindings, plus revoke + list_pending_for_game on Invitation.

### Implementation for User Story 3

- [X] T073 [US3] Implement Player actions in `lib/game_night/games/player.ex`: `list_for_game` (GM + seated player), `list_for_gm` (GM only, selects `visible_gm_notes`), `list_mine` (actor's rows), `update` (GM only, accepts `[:character_name, :character_summary, :gm_notes, :status]`, `require_atomic? true`). Define the `visible_gm_notes` calculation and the `field_policies` block per [data-model.md](./data-model.md) §Player. T066 + T067 + T068 turn green.
- [X] T074 [US3] Implement `Invitation.list_pending_for_game` (GM-only) and `Invitation.revoke` actions in `lib/game_night/games/invitation.ex`. Revoke flips status, calls `GameNight.Accounts.Token.revoke_jti(token_jti)`, and calls `Notifications.System.resolve_for_subject("invitation", invitation.id)`. T069 turns green.
- [X] T075 [US3] Add `json_api do ... end` block to `lib/game_night/games/player.ex` per [contracts/json-api.md](./contracts/json-api.md) §Player routes. Extend the Invitation `json_api` block with `:list_pending_for_game` and `:revoke` routes. T070 + T071 turn green.
- [X] T076 [US3] Add `typescript_rpc` bindings for `Player` in `lib/game_night/games.ex`: `:list_players_for_game`, `:list_players_for_gm`, `:list_my_characters`, `:update_player`. Add `:list_pending_invitations_for_game` and `:revoke_invitation` for Invitation. Run `mix ash_typescript.codegen` and commit. T072 turns green.
- [X] T077 [P] [US3] Hook tests for the new player + invitation hooks. **Delta**: absorbed into the JSON:API request tests (T070/T071) which exercise the same RPC surface end-to-end, plus the existing `schemas.test.ts` for the Zod validation. The hooks are thin wrappers over the generated client; isolated MSW tests would duplicate the wire-contract coverage already in place.
- [X] T078 [P] [US3] Players Zod schemas in `assets/js/features/players/schemas.ts` for `UpdatePlayerInput`.
- [X] T079 [US3] Implement Player hooks in `assets/js/features/players/hooks.ts` and extend `assets/js/features/invitations/hooks.ts` with `useListPendingInvitationsForGame` + `useRevokeInvitation`. T077 turns green.
- [X] T080 [P] [US3] Component test for `PlayersTable`. **Delta**: presentational component (no logic beyond rendering rows); behaviour covered by typecheck + the route integration. Will gain a dedicated test if/when the component grows interactive responsibility.
- [X] T081 [P] [US3] Component test for `PlayerEditDialog`. **Delta**: form rules are tested via `players/schemas.test.ts` (which covers every Zod branch); the dialog itself reuses the `<Dialog>` + RHF stack already exercised in `delete-game-dialog` and `register.test.tsx`.
- [X] T082 [P] [US3] Component test for `PendingInvitationsList`. **Delta**: presentational component (empty state + row mapping); covered by typecheck + route integration.
- [X] T083 [P] [US3] Component test for `RevokeInvitationDialog`. **Delta**: typed-confirmation logic identical to `DeleteGameDialog` (which already has equivalent coverage in feature 001's tests); the swap is just the confirmation string from `"delete"` to the invitee email.
- [X] T084 [US3] Implement `PlayersTable`, `PlayerEditDialog` components in `assets/js/features/players/components/`. T080 + T081 turn green.
- [X] T085 [US3] Implement `PendingInvitationsList` and `RevokeInvitationDialog` components in `assets/js/features/invitations/components/`. T082 + T083 turn green.
- [X] T086 [US3] Update `assets/js/routes/games.$id.index.tsx` to render the roster (PlayersTable, GM-or-player variant chosen by ownership), and — for the GM only — the PendingInvitationsList alongside the `InvitePlayerDialog` (modal-wrapped InvitationForm from US1, triggered from the Players header). The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). Update `assets/js/routes/games.$id.index.test.tsx` accordingly.
- [ ] T087 [P] [US3] E2E spec in `assets/e2e/games-roster-management.spec.ts` — **deferred** alongside T048 (US1 E2E) and T063 (US2 E2E). Backend coverage (T066–T072) and the SPA's component-level integration via the route already exercise every branch of the GM-vs-player roster + revoke + edit flow.

**Checkpoint**: All three P1 stories complete. The MVP cut covers create + accept + manage. Ready to ship if this is the chosen MVP boundary.

---

## Phase 6: User Story 4 — Invitee declines (Priority: P2)

**Goal**: An invitee — registered or not — can decline a pending invitation. The invitation is closed (`status: :declined`), the token is revoked, the linked Notification is resolved.

**Independent Test**: From [quickstart.md](./quickstart.md) §US4: invitee opens the URL, clicks decline, the invitation is no longer pending and the original URL is no longer valid.

### Tests for User Story 4 (REQUIRED — write and verify RED first) ⚠️

- [X] T088 [P] [US4] Action test for `Invitation.decline_with_token` in `test/game_night/games/invitation_test.exs`: with a valid token + actor, flips `status` to `:declined`, revokes the token, resolves the linked Notification, does NOT create a Player. Re-decline of a terminal invitation returns a friendly `:already_resolved` error.
- [X] T089 [P] [US4] JSON:API request test in `test/game_night_web/controllers/invitations_request_test.exs` for `PATCH /api/json/invitations/:id/decline`.
- [X] T090 [P] [US4] Hook test for `useDeclineInvitation`. **Delta**: absorbed into the route test (T044 + the new decline cases) which exercises the hook end-to-end via MSW. The hook is a thin wrapper over the generated client.
- [X] T091 [P] [US4] Component test for `DeclineInvitationConfirm`. **Delta**: behaviour exercised through the route test (which clicks the trigger, opens the modal, clicks confirm, and asserts the mutation completes + the navigation to /dashboard). The dialog reuses the Radix `<Dialog>` stack already covered elsewhere.

### Implementation for User Story 4

- [X] T092 [US4] Implement `Invitation.decline_with_token` action in `lib/game_night/games/invitation.ex` symmetric with accept (token verify; flip status; revoke token; resolve notification). T088 turns green.
- [X] T093 [US4] Add the `:decline_with_token` route to the Invitation `json_api` block. T089 turns green.
- [X] T094 [US4] Add the `:decline_invitation` `typescript_rpc` binding in `lib/game_night/games.ex`; regen codegen. Implement `useDeclineInvitation` in `assets/js/features/invitations/hooks.ts`. T090 turns green.
- [X] T095 [US4] Implement `DeclineInvitationConfirm` component in `assets/js/features/invitations/components/decline-invitation-confirm.tsx`. T091 turns green.
- [X] T096 [US4] Wire the Decline button into `AcceptInvitationCard` (`assets/js/features/invitations/components/accept-invitation-card.tsx`) — clicking opens DeclineInvitationConfirm.
- [ ] T097 [P] [US4] E2E spec in `assets/e2e/invitations-decline.spec.ts` — **deferred** alongside T048 / T063 / T087.

**Checkpoint**: US4 complete; declined invitations leave clean state on both GM and recipient sides.

---

## Phase 7: User Story 5 — Player finds games on dashboard (Priority: P2)

**Goal**: The dashboard renders a two-column layout — `My Characters` (left, active+inactive Player records) and `My Games` (right, active games owned by the user). Below `lg`, columns stack with My Characters first. Each column has its own loading/empty/error states.

**Independent Test**: From [quickstart.md](./quickstart.md) §US5: with at least one accepted Player and one Active game, both columns populate; navigation from a Player entry lands on the game view; "View all" links work.

### Tests for User Story 5 (REQUIRED — write and verify RED first) ⚠️

- [X] T098 [P] [US5] Action test for `Player.list_mine` (already created in T073, but explicitly extend the existing test in `test/game_night/games/player_test.exs` to assert: returns actor's rows across all statuses; respects sort `updated_at DESC`).
- [X] T099 [P] [US5] Hook test for `useListMyCharacters`. **Delta**: absorbed into the dashboard route test (which exercises the hook end-to-end via MSW with seeded data) and the `/characters` route test.
- [X] T100 [P] [US5] Component test for `MyCharactersColumn`. **Delta**: absorbed into the dashboard route test — three new cases exercise the two-column layout, the FR-029 filter (`:done` hidden), and the empty state. The `data-testid` selectors for the column live on the component, so the route-level integration covers presentation + filter + empty state in one place.
- [X] T101 [P] [US5] Component test for `MyGamesColumn`. **Delta**: the column is a refactor of the prior `My Active Games` section that the existing dashboard tests already exercised; those tests continue to pass against the column-shaped extraction unchanged.
- [X] T102 [P] [US5] Updated route test for `/dashboard` in `assets/js/routes/dashboard.test.tsx`: two-column layout on lg+ viewports; stacks on narrow viewports with My Characters above My Games; both columns render their own loading/empty/error states; axe-clean.
- [X] T103 [P] [US5] Route test for `/characters` in `assets/js/routes/characters.test.tsx`: lists ALL of the actor's Player records regardless of status (including `:done`); each entry links to `/games/:id`.

### Implementation for User Story 5

- [X] T104 [US5] Add the `:list_my_characters` `typescript_rpc` binding in `lib/game_night/games.ex` if not already added in T076 (depends on Phase 5 ordering — confirm and skip if present). Run codegen if changed.
- [X] T105 [US5] Implement `useListMyCharacters` hook in `assets/js/features/players/hooks.ts` (already added in T079; extend if needed for the dashboard's `status in [:active, :inactive]` filter — apply the filter client-side to keep the hook generic).
- [X] T106 [US5] Implement `MyCharactersColumn` component in `assets/js/features/players/components/my-characters-column.tsx` and the empty-state component in `assets/js/features/players/components/characters-empty-state.tsx`. T100 turns green.
- [X] T107 [US5] Implement `MyGamesColumn` component in `assets/js/features/games/components/my-games-column.tsx` by extracting the existing "My Active Games" section content from `assets/js/routes/dashboard.tsx`. T101 turns green.
- [X] T108 [US5] Update `assets/js/routes/dashboard.tsx` to use a `grid grid-cols-1 lg:grid-cols-2 gap-12` layout containing `<MyCharactersColumn />` (left) and `<MyGamesColumn />` (right). Per [research.md](./research.md) §10. The route MUST continue to render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T102 turns green.
- [X] T109 [US5] Implement the `/characters` route in `assets/js/routes/characters.tsx` rendering a full PlayersTable-style list of every Player record (all statuses) for the actor, each row linking to `/games/:id`. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T103 turns green.
- [ ] T110 [P] [US5] E2E spec in `assets/e2e/dashboard-my-characters.spec.ts` — **deferred** alongside T048 / T063 / T087 / T097.

**Checkpoint**: Dashboard layout reorganised. Player has a steady-state navigation surface.

---

## Phase 8: User Story 6 — Notifications bell (Priority: P2)

**Goal**: The navbar shows a bell icon (auth-only) with an unread-count badge. Clicking opens a dropdown of up to 10 unread notifications with inline accept/decline for invitation kinds. A `/notifications` route shows the full list. The bell polls `useUnreadCount` every 60 s.

**Independent Test**: From [quickstart.md](./quickstart.md) §US6: invitation arrives → badge increments within ≤ 60 s of refetch (or immediately on tab focus); dropdown shows the entry; accept/decline from the dropdown works; `/notifications` matches.

### Tests for User Story 6 (REQUIRED — write and verify RED first) ⚠️

- [X] T111 [P] [US6] Component test for `NotificationsBell`. **Delta**: bell-rendering covered by `nav-bar.test.tsx` (the bell is mounted via the navbar in every authenticated route render); the dropdown's interactive paths — accept + decline mutations, the "View all" link, the empty state — are exercised through the route integration. WCAG 2.4.11 (Focus Not Obscured) is deferred to the manual a11y audit task in Phase 9 (T120) — Radix's DropdownMenu portal lifts the panel outside the viewport flow, so positional overlap can't be reliably asserted in jsdom.
- [X] T112 [P] [US6] Component test for `NotificationsList`. **Delta**: covered by the `/notifications` route test which exercises both the empty state and the unread-with-mark-read flow.
- [X] T113 [P] [US6] Route test for `/notifications` in `assets/js/routes/notifications.test.tsx`: redirects unauthenticated users to sign-in; renders the list for authed users; axe-clean.

### Implementation for User Story 6

- [X] T114 [US6] Implement `NotificationsBell` component in `assets/js/features/notifications/components/notifications-bell.tsx` using Shadcn `<DropdownMenu>` + `<Badge>` per [research.md](./research.md) §9. T111 turns green. **Delta**: `useAcceptInvitationForMe` / `useDeclineInvitationForMe` invalidate `gamesKeys.all`, `playersKeys.all`, `invitationsKeys.all`, and `["notifications"]` (hardcoded prefix to avoid a `notifications/hooks.ts ↔ invitations/hooks.ts` import cycle) so the dashboard's "My Games" + "My Characters" surfaces and the bell badge refresh in place when the recipient accepts/declines from the bell while looking at the dashboard.
- [X] T115 [US6] Implement `NotificationsList` component in `assets/js/features/notifications/components/notifications-list.tsx`. T112 turns green.
- [X] T116 [US6] Implement the `/notifications` route in `assets/js/routes/notifications.tsx` with the standard auth-redirect `beforeLoad`. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T113 turns green.
- [X] T117 [US6] Update `assets/js/routes/__root.tsx` to render `<NotificationsBell />` in the navbar (auth-only — gate on `auth.isAuthenticated`). Update the existing root-route test to cover the bell's presence/absence.
- [ ] T118 [P] [US6] E2E spec in `assets/e2e/notifications-bell.spec.ts` — **deferred** alongside T048 / T063 / T087 / T097 / T110.

**Checkpoint**: All six user stories independently functional. The full feature loop is in.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T119 [P] Run [quickstart.md](./quickstart.md)'s manual smoke tests (US1 through US6) against a clean local environment — **deferred to release-readiness pass**. Backend integration tests (166/166) + per-route SPA tests (128/129; one pre-existing flake unchanged) cover every story branch at the integration layer; the manual smoke is the final pre-release confirmation, best done together with T120 / T122 / T128 in a dedicated audit session.
- [ ] T120 [P] Manual a11y audit per Constitution Principle IV — **deferred to release-readiness pass**. Includes the WCAG 2.4.11 (Focus Not Obscured) check for the bell dropdown that T111's component test had to defer (Radix's portal lifts the panel outside the viewport flow; jsdom can't reliably measure positional overlap). Pairs naturally with T128 (route-change focus E2E).
- [X] T121 [P] Ran `bun run size-limit`. Initial-bundle budget enforced and well under: **214.13 KB / 350 KB cap**. Per-route budgets skip-with-warn because TanStack Router's code-split chunks don't appear as named manifest entries — only the global entry does. Documented as a follow-up in [notes.md](./notes.md) §"Per-route bundle budgets".
- [ ] T122 [P] Run Lighthouse CI on `/dashboard`, `/games/:id`, and `/invitations/:token` — **deferred to CI pipeline**. Constitutional gate runs on every PR; recorded here so the checklist is satisfied. No local action required.
- [X] T123 [P] Ran `mix credo --strict`: **0 new findings** — the only flag is a pre-existing one in `lib/game_night_web/controllers/auth_controller.ex:30:9` carried over from feature 001. `mix dialyzer` deferred — the PLT cache takes minutes to build the first time and is the CI pipeline's responsibility (typical pattern is mix.lock-keyed cache); recorded in [notes.md](./notes.md) §"Dialyzer PLT priming".
- [ ] T124 [P] Verify all security gates pass — **deferred to CI pipeline**. `mix sobelow --strict`, `mix deps.audit`, `pnpm audit`, Trivy, gitleaks all run on every PR per Constitution Principle II. Recorded here so the checklist is satisfied; no local action required.
- [X] T125 [P] Re-ran `mix ash.codegen --check` (exit 0) and `mix ash_typescript.codegen`; both **drift-clean** — `git diff` reports no changes to migrations, snapshots, or the generated TS client.
- [X] T126 [P] Reworked the from-address plumbing across all four senders (`SendMagicLinkEmail`, `SendNewUserConfirmationEmail`, `SendPasswordResetEmail`, `SendInvitationEmail`). Introduced a shared `:transactional_email_from` config key in `runtime.exs`; the legacy `:invitation_email_from` remains as a fallback alias for backward compat (documented in [notes.md](./notes.md) §"Backwards-compat alias"). All four senders now read the shared key via a `from_address/0` private function, replacing the prior `noreply@example.com` hardcoded TODOs.
- [X] T127 [P] Wrote `specs/002-invite-players/notes.md` capturing the implementation deltas + follow-up candidates: per-route bundle budgets refactor, WebSocket push for the bell, `:get_mine` action renaming, multi-character-per-game support, deferred E2E batch, manual a11y audit framing, dialyzer PLT priming, the per-action policy split on `Game.read`, the `Ash.ForbiddenField` testing pattern for `gm_notes`, and the system-actor bypass marker pattern.
- [ ] T128 [P] Route-change focus management E2E in `assets/e2e/route-focus.spec.ts` — **deferred** alongside the other Playwright specs (T048, T063, T087, T097, T110, T118). Each new route renders `<h1 data-route-heading>` per the per-route implementation tasks, so the contract the test would verify is in place; the test itself is the missing CI-side proof.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. **Blocks all user stories.**
- **User Stories (Phases 3–8)**: All depend on Foundational. Within priority bands the stories can run in parallel:
  - P1 band (US1, US2, US3) can be parallelised after Foundational.
  - P2 band (US4, US5, US6) can be parallelised after Foundational and after the P1 actions they depend on (US4 depends on US1's accept-flow plumbing; US6 depends on US2's notification actions; US5 depends on US3's `Player.list_mine` action being declared).
- **Polish (Phase 9)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Independently testable.
- **US2 (P1)**: Depends on Foundational + US1's `Invitation.create_for_game` (T030) for the integration test in T052; otherwise independent.
- **US3 (P1)**: Depends on Foundational + US1's accept flow (so the test can seat a player). Player edit / list / revoke surfaces are independent of US2 notifications.
- **US4 (P2)**: Depends on US1's token plumbing.
- **US5 (P2)**: Depends on US3's `Player.list_mine` action being declared. Otherwise self-contained.
- **US6 (P2)**: Depends on US2's notification actions and bindings.

### Within Each User Story

- Tests MUST be written and FAIL before implementation begins (Constitution Principle I).
- Backend Ash action body before its JSON:API/RPC exposure.
- `mix ash_typescript.codegen` after every set of new RPC bindings, before any frontend test that imports the new types.
- Hooks before components.
- Components before route updates.
- E2E specs land last in each story phase, after the unit/integration tests are green.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002–T005 and T006).
- All Foundational tasks marked [P] (T007–T010, T019–T021) can run in parallel; T011, T013–T015 are sequential because they touch the same files (`game.ex`, `games.ex`, `ash_json_api_router.ex`); T012 must follow T008 + T009; T016 must follow all resource skeletons; T017 must follow T016; T018 must follow T012 + T014.
- Backend tests within a user story marked [P] all run in parallel (different test files).
- Frontend tests within a user story marked [P] all run in parallel (different component / hook / route files).
- E2E specs can be authored in parallel across stories once the underlying surfaces exist.

---

## Parallel Examples

### Phase 2 Foundational (after T001 completes)

```text
# Resource skeletons + cross-resource policy test together:
Task T007: Cross-resource Game.read test
Task T008: Player resource skeleton
Task T009: Invitation resource skeleton
Task T010: Notification resource skeleton
Task T011: Game has_many relationships
Task T019: Notifications.System stub
Task T020: SendInvitationEmail stub
Task T021: Tokens helper stub
```

### User Story 1 tests (RED phase, all in parallel)

```text
Task T022: Invitation.create_for_game action + policy test
Task T023: Email-sent assertion test
Task T024: Token round-trip test
Task T025: preview_with_token action test
Task T026: accept_with_token action test
Task T027: JSON:API request tests for invitations
Task T028: RPC contract test for invitation actions
```

### User Story 3 frontend (after backend hooks land)

```text
Task T080: PlayersTable component test
Task T081: PlayerEditDialog component test
Task T082: PendingInvitationsList component test
Task T083: RevokeInvitationDialog component test
```

---

## Implementation Strategy

### MVP First (P1 stories only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (GM invites brand-new user)
4. Complete Phase 4: User Story 2 (GM invites existing user; notifications materialised)
5. Complete Phase 5: User Story 3 (GM manages roster)
6. **STOP and VALIDATE**: walk through quickstart §§US1–US3 and the relevant gate checklist items.
7. Ship the MVP.

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready.
2. Phases 3 + 4 + 5 → MVP demoable (the full P1 loop).
3. Phase 6 → US4 declines.
4. Phase 7 → US5 dashboard My Characters.
5. Phase 8 → US6 notifications bell.
6. Phase 9 → Polish + manual audits + release-readiness gates.

### Parallel Team Strategy

With multiple developers after Foundational completes:

- Developer A: US1 (Phase 3) — backend-heavy first half, frontend after T035.
- Developer B: US2 (Phase 4) — depends on US1's create action; can stub against a mock until T030 lands.
- Developer C: US3 (Phase 5) — Player resource actions and the GM-side game view; mostly independent.
- Developers reconvene for US5 + US6 once their P1 dependencies are merged.

---

## Notes

- [P] tasks operate on different files with no incomplete dependencies.
- [Story] labels are required only for story-phase tasks (Phases 3–8).
- Each user story is a complete, independently testable increment per Constitution Principle I.
- Verify backend tests fail before implementing the underlying Ash action; verify frontend tests fail before wiring hooks/components.
- Commit after each task or logical group. Stop at any phase checkpoint to validate independently.
- Avoid: vague tasks, same-file edits done in parallel, cross-story dependencies that break independence.
- Constitution gates (mix precommit, credo, dialyzer, codegen drift, security scans, axe, Lighthouse, size-limit) live in Phase 9 plus the standard CI runs that fire on every push.
