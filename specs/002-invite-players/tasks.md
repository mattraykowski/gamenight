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

- [ ] T001 Add `:invitation_token_ttl` and `:invitation_email_from` config keys to `config/runtime.exs`, with `System.get_env/2` defaults of `"30"` and `"noreply@example.com"` respectively (per [quickstart.md](./quickstart.md) §Configuration).
- [ ] T002 [P] Add Shadcn `dropdown-menu` primitive to `assets/js/components/ui/dropdown-menu.tsx` (per [research.md](./research.md) §9). Run via `pnpm dlx shadcn@latest add dropdown-menu` and commit the result.
- [ ] T003 [P] Add Shadcn `popover` primitive to `assets/js/components/ui/popover.tsx`. (Used as alt-pattern reference for the bell; final picks made in T077.)
- [ ] T004 [P] Add Shadcn `badge` primitive to `assets/js/components/ui/badge.tsx`.
- [ ] T005 [P] Extend `assets/.size-limit.json` with budget entries for `/invitations/$token` (≤ 12 KB), `/invitations` (≤ 8 KB), `/characters` (≤ 8 KB), `/notifications` (≤ 8 KB) per [plan.md](./plan.md) §VI.
- [ ] T006 Extend `TOAST_MESSAGES` whitelist in `assets/js/features/toasts/toast-provider.tsx` with the new keys: `invitation_sent`, `invitation_accepted`, `invitation_declined`, `invitation_revoked`, `player_updated`, `notification_read`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schemas, domain wiring, the cross-resource `Game.read` policy expansion, and the codegen / migration steps every user story depends on.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

### Foundational tests (TDD — write and verify RED first)

- [ ] T007 [P] Cross-resource policy test in `test/game_night/games/game_test.exs` asserting that the existing `:get_mine` action (under the expanded read policy) admits an accepted player on the game and rejects a non-owner non-player. Verify RED before implementing T013.

### Foundational implementation

- [ ] T008 [P] Create `GameNight.Games.Player` resource skeleton in `lib/game_night/games/player.ex`: attributes (`character_name`, `character_summary`, `gm_notes`, `status`, timestamps), `belongs_to :game`, `belongs_to :user`, postgres `references` with `on_delete: :delete` on both, custom indexes per [data-model.md](./data-model.md) §Player Postgres, identity `unique_game_user [:game_id, :user_id]`, base `:read` action and policy. **No write actions yet** — those land in story phases.
- [ ] T009 [P] Create `GameNight.Games.Invitation` resource skeleton in `lib/game_night/games/invitation.ex`: attributes (`email :ci_string`, `character_name`, `character_summary`, `gm_notes`, `status` with `[:pending, :accepted, :declined, :revoked]`, `accepted_player_id`, `token_jti`, `expires_at`, timestamps), `belongs_to :game`, `belongs_to :inviter`, `belongs_to :accepted_player`, postgres `references` per [data-model.md](./data-model.md) §Invitation Postgres, partial-unique identity `unique_game_email_open` with `where status in [:pending, :accepted]`, base `:read` action and policy.
- [ ] T010 [P] Create `GameNight.Notifications.Notification` resource skeleton in `lib/game_night/notifications/notification.ex`: attributes (`user_id`, `kind` with `one_of: [:game_invitation]`, `subject_type :string`, `subject_id :uuid`, `read_at`, `resolved_at`, timestamps), `belongs_to :user` with cascade delete, custom index `notifications(user_id, resolved_at, inserted_at)`, base `:read` policy.
- [ ] T011 [P] Update `lib/game_night/games/game.ex` to add `has_many :players, GameNight.Games.Player` and `has_many :invitations, GameNight.Games.Invitation` relationships.
- [ ] T012 Update `lib/game_night/games.ex` to register `GameNight.Games.Player` and `GameNight.Games.Invitation` in the `resources do` block. **Do not** declare `typescript_rpc` bindings yet — bindings land in their owning story phases.
- [ ] T013 Expand the `:read` policy on `lib/game_night/games/game.ex` to add a second `authorize_if expr(exists(players, user_id == ^actor(:id)))` clause per [research.md](./research.md) §4. Confirm T007 turns green.
- [ ] T014 Create `GameNight.Notifications` domain module in `lib/game_night/notifications.ex`, `use Ash.Domain` with `extensions: [AshJsonApi.Domain, AshTypescript.Rpc]`, register `GameNight.Notifications.Notification` in `resources do`. Empty `typescript_rpc do` block (bindings added in story phases).
- [ ] T015 Update `lib/game_night_web/ash_json_api_router.ex` to add `GameNight.Notifications` to the `:domains` list (alongside `GameNight.Telemetry` and `GameNight.Games`).
- [ ] T016 Run `mix ash.codegen create_invite_players_resources` to generate migrations and resource snapshots for `players`, `invitations`, and `notifications`. Commit the generated files under `priv/repo/migrations/` and `priv/resource_snapshots/repo/{players,invitations,notifications}/`.
- [ ] T017 Run `mix ecto.migrate` and verify the new tables are created with their indexes and partial-unique constraints.
- [ ] T018 Run `mix ash_typescript.codegen` and commit the regenerated `assets/js/ash_rpc.ts` and `assets/js/ash_types.ts`. Confirm `git diff --exit-code` is clean after a re-run.
- [ ] T019 [P] Create `GameNight.Notifications.System` internal context module at `lib/game_night/notifications/system.ex` with module-level `@moduledoc` justifying the policy bypass per Constitution Principle II. Define `actor/0` (returns the system marker actor struct) and the function-interface stubs `create_for_invitation/1` and `resolve_for_subject/2`. Bodies land in US2 (T036).
- [ ] T020 [P] Create `GameNight.Games.Invitation.Senders.SendInvitationEmail` module at `lib/game_night/games/invitation/senders/send_invitation_email.ex` mirroring the magic-link sender per [research.md](./research.md) §7. Pull the from-address from `Application.fetch_env!(:game_night, :invitation_email_from)`. Body lands in US1 (T031).
- [ ] T021 [P] Create `GameNight.Games.Invitation.Tokens` helper module at `lib/game_night/games/invitation/tokens.ex` exposing `mint/1` and `verify/1` per [research.md](./research.md) §2. Bodies land in US1 (T029).

**Checkpoint**: Foundation ready. Schema migrated. Generated client refreshed. The `Game.read` cross-resource test is green. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — GM invites a brand-new user (Priority: P1) 🎯 MVP

**Goal**: A GM can submit an email + character details on `/games/:id`; the system records a pending invitation, sends an email with a `/invitations/:token` link; an unregistered recipient walks through registration with the token preserved; after login the recipient sees the accept page; on accept, a Player record is created on the GM's game.

**Independent Test**: From [quickstart.md](./quickstart.md) §US1: invite a brand-new email; fetch the email from the local Swoosh mailbox; complete registration through the link; accept; observe the new Player on the GM's roster.

### Tests for User Story 1 (REQUIRED — write and verify RED first) ⚠️

> **NON-NEGOTIABLE: write all tests below, run them, and confirm RED before any implementation task in this phase begins.**

- [ ] T022 [P] [US1] Action + policy tests for `Invitation.create_for_game` in `test/game_night/games/invitation_test.exs`: GM-only authorization (owner ✓, non-owner ✗, anonymous ✗); duplicate email on same game returns conflict; self-invite is rejected; **two GMs on different games each inviting the same email both succeed and produce two independent pending invitations (spec edge case "Two different GMs invite the same person to two different games"; the partial-unique identity is scoped per `game_id`)**; `inviter_id` set from actor; `status` defaults to `:pending`; `expires_at` reflects the configured TTL.
- [ ] T023 [P] [US1] Email-side test in `test/game_night/games/invitation_test.exs` using Swoosh's `assert_email_sent`: assert the invitation email is enqueued with `to: invitation.email`, the URL `~p"/invitations/#{token}"`, and HTML-escaped game title + character name.
- [ ] T024 [P] [US1] Token round-trip test in `test/game_night/games/invitation_test.exs`: `Tokens.mint/1` returns a JWT whose `Tokens.verify/1` resolves to the invitation; revoked tokens fail verify; expired tokens fail verify; tokens with the wrong purpose fail verify.
- [ ] T025 [P] [US1] Action test for `Invitation.preview_with_token` in `test/game_night/games/invitation_test.exs`: returns `{game_title, inviter_email, character_name, expires_at}` for a valid token without an actor; returns `:invalid_token` for revoked/expired/wrong-purpose tokens.
- [ ] T026 [P] [US1] Action test for `Invitation.accept_with_token` in `test/game_night/games/invitation_test.exs`: with a valid token and a logged-in actor whose email DIFFERS from the invitation email, the action still succeeds (token-bearer auth per [research.md](./research.md) §2); creates a `Player` row with the GM-supplied character_name/summary/gm_notes and `status: :active`; revokes the token; flips invitation `status` to `:accepted`; sets `accepted_player_id`. Idempotent re-accept returns the same Player.
- [ ] T027 [P] [US1] JSON:API request tests in `test/game_night_web/controllers/invitations_request_test.exs` for `POST /api/json/invitations`, `GET /api/json/invitations/preview/:token`, `PATCH /api/json/invitations/:id/accept` — authorized + unauthorized + 422 invalid_token cases per [contracts/json-api.md](./contracts/json-api.md).
- [ ] T028 [P] [US1] RPC contract test in `test/game_night/games/invitation_test.exs` asserting `AshTypescript.Rpc.actions_for(GameNight.Games)` lists `:create_invitation`, `:preview_invitation`, `:accept_invitation` exactly per [contracts/rpc.md](./contracts/rpc.md).

### Implementation for User Story 1

- [ ] T029 [US1] Implement `GameNight.Games.Invitation.Tokens.mint/1` and `verify/1` bodies in `lib/game_night/games/invitation/tokens.ex` per [research.md](./research.md) §2: mint a JWT via `AshAuthentication.Jwt.token_for_user/4` with purpose `"invitation_accept"` and subject `"invitation:#{id}"`; store the row via `GameNight.Accounts.Token.store_token` (system call, `authorize?: false`, comment justifies). T024 turns green.
- [ ] T030 [US1] Implement `Invitation.create_for_game` action in `lib/game_night/games/invitation.ex`: accept `[:character_name, :character_summary, :gm_notes]` plus arguments `:email :ci_string` and `:game_id :uuid`; `change set_attribute(:inviter_id, actor.id)`; **`validate` step rejecting when `arg(:email) == actor.email` with a friendly "you cannot invite yourself" error (FR-003 self-invite guard)**; `change` to mint the token via `Tokens.mint/1` and persist `token_jti` + `expires_at`; policy block authorizing only the GM of the target game per [data-model.md](./data-model.md) §Invitation Policies. T022 turns green.
- [ ] T031 [US1] Implement `SendInvitationEmail.send/3` body in `lib/game_night/games/invitation/senders/send_invitation_email.ex` per [research.md](./research.md) §7. Wire it into the `Invitation.create_for_game` action's `change after_action`. T023 turns green.
- [ ] T032 [US1] Implement `Invitation.preview_with_token` action in `lib/game_night/games/invitation.ex` as `action :preview_with_token, :struct` per [data-model.md](./data-model.md): policy `authorize_if always()`; body verifies token, loads invitation by id, returns the preview struct; rejects revoked/expired/wrong-purpose. T025 turns green.
- [ ] T033 [US1] Implement `Invitation.accept_with_token` action in `lib/game_night/games/invitation.ex`: `argument :token, :string`; `change` validates token via `Tokens.verify/1`; `change` creates the Player via `manage_relationship` against the bypassed system actor; `change` revokes the token JTI; `change` flips `status` to `:accepted` and sets `accepted_player_id`; `require_atomic? false` (multi-step). Conflict on `(game_id, user_id)` unique index translates to a friendly `:already_a_player` error per [research.md](./research.md) §11. T026 turns green.
- [ ] T034 [US1] Add `json_api do ... end` block to `lib/game_night/games/invitation.ex` exposing `:create_for_game` (POST `/`), `:preview_with_token` (GET `/preview/:token`), `:accept_with_token` (PATCH `/:id/accept`) per [contracts/json-api.md](./contracts/json-api.md) §Invitation routes. T027 turns green.
- [ ] T035 [US1] Add `typescript_rpc` bindings for `Invitation` in `lib/game_night/games.ex`: `rpc_action :create_invitation, :create_for_game`, `rpc_action :preview_invitation, :preview_with_token`, `rpc_action :accept_invitation, :accept_with_token`. Run `mix ash_typescript.codegen` and commit the regenerated `assets/js/ash_rpc.ts` + `assets/js/ash_types.ts`. T028 turns green.
- [ ] T036 [US1] Implement `Notifications.System.create_for_invitation/1` body in `lib/game_night/notifications/system.ex` (no-op for US1 — full body lands in US2 T057; for US1 the function is called but is allowed to no-op when no matching user exists). Wire the call into `Invitation.create_for_game`'s `after_action` so US2 can flip on the matching-user branch later.
- [ ] T037 [P] [US1] Hook tests in `assets/js/features/invitations/hooks.test.ts` for `useCreateInvitation`, `useInvitationPreview`, `useAcceptInvitation` (MSW mocks `/rpc/run`). Verify RED before T039.
- [ ] T038 [P] [US1] Schema definitions in `assets/js/features/invitations/schemas.ts`: Zod schemas for `CreateInvitationInput` (email, character_name, character_summary, gm_notes) and `AcceptInvitationInput` (id, token).
- [ ] T039 [US1] Implement `useCreateInvitation`, `useInvitationPreview`, `useAcceptInvitation` hooks in `assets/js/features/invitations/hooks.ts` per [contracts/rpc.md](./contracts/rpc.md). Mutation invalidates per the table in that file. T037 turns green.
- [ ] T040 [P] [US1] Component test for `InvitationForm` in `assets/js/features/invitations/components/invitation-form.test.tsx` (axe + happy path + validation error path). Verify RED before T042.
- [ ] T041 [P] [US1] Component test for `AcceptInvitationCard` in `assets/js/features/invitations/components/accept-invitation-card.test.tsx` (renders preview; accept button calls mutation; invalid-token state). Verify RED before T043.
- [ ] T042 [US1] Implement `InvitationForm` component in `assets/js/features/invitations/components/invitation-form.tsx` (Shadcn `<Form>`, `<FormField>`, RHF + Zod, `mode: "onTouched"`). T040 turns green.
- [ ] T043 [US1] Implement `AcceptInvitationCard` component in `assets/js/features/invitations/components/accept-invitation-card.tsx`. T041 turns green.
- [ ] T044 [P] [US1] Route test for `/invitations/$token` in `assets/js/routes/invitations.$token.test.tsx`: anonymous viewer sees preview + redirect-to-register CTA carrying the token; authed viewer sees the AcceptInvitationCard; invalid-token state renders the friendly copy. Verify RED before T045.
- [ ] T045 [US1] Implement the `/invitations/$token` route in `assets/js/routes/invitations.$token.tsx` with no `beforeLoad` auth gate; if not authenticated, render preview + sign-in/register CTAs that pass `?invitation=<token>` per [research.md](./research.md) §8. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T044 turns green.
- [ ] T046 [US1] Update `assets/js/routes/register.tsx` and `assets/js/routes/sign-in.tsx` (and their `validateSearch` schemas) to accept an optional `invitation` query param and append it to the post-auth `redirect` target so the invitee returns to `/invitations/<token>` after signing in. Update the existing tests in `assets/js/routes/register.test.tsx` and `assets/js/routes/sign-in.test.tsx` to cover the round-trip.
- [ ] T047 [US1] Update `assets/js/routes/games.$id.index.tsx` (and its `.test.tsx`) to render the `<InvitationForm />` for the GM. Existing test updates only — full GM-side roster + pending list lands in US3.
- [ ] T048 [P] [US1] E2E spec in `assets/e2e/invitations-new-user.spec.ts` covering the full quickstart §US1 walkthrough: GM invites a brand-new email, recipient (separate browser context) hits the link, registers, accepts, GM reload shows the new Player. Uses `TestMailboxController` (`GET /test/mailbox`) to fetch the token. Includes axe checks on the preview, register-with-invitation, and accept screens.

**Checkpoint**: US1 is fully functional and testable independently.

---

## Phase 4: User Story 2 — GM invites an existing user (Priority: P1)

**Goal**: When the invited email matches an existing user account, an in-app notification is materialised at invite time. The recipient can accept directly from their notifications without going through registration.

**Independent Test**: From [quickstart.md](./quickstart.md) §US2: invite an email that has an existing account; the recipient sees a notification (badge count increments via the bell — bell UI lands in US6, but the underlying count is queryable here); the recipient accepts and appears on the GM's roster.

### Tests for User Story 2 (REQUIRED — write and verify RED first) ⚠️

- [ ] T049 [P] [US2] Action test in `test/game_night/notifications/notification_test.exs` for `Notification.list_mine` (returns actor's rows; admits actor for own rows only; `unread_only` filter works) and `Notification.count_unread` (returns the count of unread + unresolved rows for the actor).
- [ ] T050 [P] [US2] Action test in `test/game_night/notifications/notification_test.exs` for `Notification.mark_read` (sets `read_at` on actor's own row; rejects others' rows; idempotent if already read).
- [ ] T051 [P] [US2] System-action tests in `test/game_night/notifications/system_test.exs`: `create_for_invitation/1` creates exactly one Notification when a user with the matching email exists; creates none when no match; is idempotent on re-call (upsert via the unique identity); `resolve_for_subject/2` sets `resolved_at` on all matching rows. **Defence-in-depth negative test**: an external caller constructing the `%GameNight.Notifications.System.Actor{_internal?: true}` marker and calling a non-bypassed action (e.g., `Notification.list_mine`, `Notification.mark_read`) is **still rejected** by the per-action policy (the marker has no `:id`, so `user_id == ^actor(:id)` fails closed). Required by Constitution Principle II's "exceptions must be tested" posture.
- [ ] T052 [P] [US2] Integration test in `test/game_night/games/invitation_test.exs`: invoking `Invitation.create_for_game` with an email that matches a user creates a Notification with `kind: :game_invitation`, `subject_type: "invitation"`, `subject_id: invitation.id`. Invoking it with a non-matching email creates no Notification.
- [ ] T053 [P] [US2] Integration test in `test/game_night/games/invitation_test.exs`: accepting an invitation resolves the linked Notification (`resolved_at` set).
- [ ] T054 [P] [US2] JSON:API request tests in `test/game_night_web/controllers/notifications_request_test.exs` for `GET /api/json/notifications`, `GET /api/json/notifications/unread-count`, `PATCH /api/json/notifications/:id` (mark_read).
- [ ] T055 [P] [US2] RPC contract test in `test/game_night/notifications/notification_test.exs` asserting `AshTypescript.Rpc.actions_for(GameNight.Notifications)` lists `:list_my_notifications`, `:count_my_unread`, `:mark_notification_read`.

### Implementation for User Story 2

- [ ] T056 [US2] Implement `Notification.list_mine`, `Notification.count_unread`, `Notification.mark_read` actions in `lib/game_night/notifications/notification.ex` per [data-model.md](./data-model.md) §Notification Actions. T049 + T050 turn green.
- [ ] T057 [US2] Implement `Notifications.System.create_for_invitation/1` body in `lib/game_night/notifications/system.ex`: look up user by email; if present, upsert a Notification (idempotent via the `(user_id, subject_type, subject_id, kind)` identity declared via Ash, with the matching partial-unique migration). Implement `Notifications.System.resolve_for_subject/2`: filter by `subject_type` + `subject_id`, set `resolved_at: now()`, run with `authorize?: false` and the system marker actor. T051 turns green.
- [ ] T058 [US2] Wire `Notifications.System.resolve_for_subject` into `Invitation.accept_with_token` (and decline_with_token + revoke when those land — placeholders ok for now). T053 turns green.
- [ ] T059 [US2] Add `json_api do ... end` block to `lib/game_night/notifications/notification.ex` per [contracts/json-api.md](./contracts/json-api.md) §Notification routes. T054 turns green.
- [ ] T060 [US2] Add `typescript_rpc` bindings for `Notification` in `lib/game_night/notifications.ex`. Run `mix ash_typescript.codegen` and commit the regenerated client. T055 turns green.
- [ ] T061 [P] [US2] Hook tests in `assets/js/features/notifications/hooks.test.ts` for `useMyNotifications`, `useUnreadCount` (including the polling behavior — assert `refetchInterval: 60_000` and `refetchOnWindowFocus: true`), and `useMarkRead`. Verify RED.
- [ ] T062 [US2] Implement `useMyNotifications`, `useUnreadCount`, `useMarkRead` hooks in `assets/js/features/notifications/hooks.ts`. Define discriminated kinds union in `assets/js/features/notifications/kinds.ts` (start with `game_invitation`, designed to grow). T061 turns green.
- [ ] T063 [P] [US2] E2E spec in `assets/e2e/invitations-existing-user.spec.ts`: GM invites an existing user's email; sign in as the recipient; assert `useUnreadCount` reads 1 (via a temporary debug attribute on a hidden DOM element or via the bell once US6 lands — for US2 standalone, query the JSON:API directly); accept via the notifications-derived list at `/invitations` (separate small route added in T064); GM reload shows the player.
- [ ] T064 [P] [US2] Implement `/invitations` index route in `assets/js/routes/invitations.index.tsx` listing the actor's pending invitations via `useListMyPendingInvitations` (note: `Invitation.list_pending_for_me` action lands here too — see T065). Each row links to `/invitations/<token>`. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). Includes route test in `assets/js/routes/invitations.index.test.tsx`.
- [ ] T065 [US2] Implement `Invitation.list_pending_for_me` action in `lib/game_night/games/invitation.ex` (filters `email == ^actor(:email) AND status == :pending`); add `typescript_rpc` binding `:list_my_pending_invitations` in `lib/game_night/games.ex`; regenerate codegen. Add a brief action + RPC contract test in `test/game_night/games/invitation_test.exs`.

**Checkpoint**: US1 + US2 work independently. Existing-user invitation flow has a queryable notification trail.

---

## Phase 5: User Story 3 — GM views and manages roster (Priority: P1)

**Goal**: On `/games/:id` the GM sees the accepted-player roster + a GM-only pending-invitations section, can edit any Player's character_name/character_summary/gm_notes/status, and can revoke any pending invitation. Accepted players see only the roster (no GM notes, no pending invitations).

**Independent Test**: From [quickstart.md](./quickstart.md) §US3: with an accepted player and a pending invitation, GM sees both groups; status edit persists; revoke makes the original invitation URL no-longer-valid. Non-GM accepted player sees the roster but not the pending list and not gm_notes.

### Tests for User Story 3 (REQUIRED — write and verify RED first) ⚠️

- [ ] T066 [P] [US3] Action + policy tests for `Player.list_for_game` in `test/game_night/games/player_test.exs`: GM ✓, seated player ✓, non-seated non-GM ✗, anonymous ✗. The serialised payload (via the JSON:API request test in T070) excludes `gm_notes`.
- [ ] T067 [P] [US3] Action + field-policy test for `Player.list_for_gm` in `test/game_night/games/player_test.exs`: GM ✓ and `visible_gm_notes` returns the actual string; non-GM ✗ at the action policy layer; if a non-GM does reach a `:read` action that selects `visible_gm_notes` via sparse fieldset, the **field policy** returns `nil`. The combined posture satisfies SC-005.
- [ ] T068 [P] [US3] Action test for `Player.update` in `test/game_night/games/player_test.exs`: GM ✓ updates `character_name`/`character_summary`/`gm_notes`/`status`; non-GM ✗; status round-trip (active → done → active) works.
- [ ] T069 [P] [US3] Action + policy test for `Invitation.list_pending_for_game` (GM-only) and `Invitation.revoke` (GM-only; flips `status` to `:revoked`, revokes the token, resolves the matching Notification, and after revoke the original token-bearing URL is no-longer-valid) in `test/game_night/games/invitation_test.exs`.
- [ ] T070 [P] [US3] JSON:API request tests in `test/game_night_web/controllers/players_request_test.exs` for `GET /api/json/players/by-game/:game_id`, `/by-game/:game_id/gm`, `PATCH /api/json/players/:id`. Assert the `by-game` response shape excludes `gm_notes`.
- [ ] T071 [P] [US3] JSON:API request tests in `test/game_night_web/controllers/invitations_request_test.exs` for `GET /api/json/invitations/by-game/:game_id/pending` and `PATCH /api/json/invitations/:id/revoke`.
- [ ] T072 [P] [US3] RPC contract assertion in `test/game_night/games/player_test.exs` listing the four Player RPC bindings, plus revoke + list_pending_for_game on Invitation.

### Implementation for User Story 3

- [ ] T073 [US3] Implement Player actions in `lib/game_night/games/player.ex`: `list_for_game` (GM + seated player), `list_for_gm` (GM only, selects `visible_gm_notes`), `list_mine` (actor's rows), `update` (GM only, accepts `[:character_name, :character_summary, :gm_notes, :status]`, `require_atomic? true`). Define the `visible_gm_notes` calculation and the `field_policies` block per [data-model.md](./data-model.md) §Player. T066 + T067 + T068 turn green.
- [ ] T074 [US3] Implement `Invitation.list_pending_for_game` (GM-only) and `Invitation.revoke` actions in `lib/game_night/games/invitation.ex`. Revoke flips status, calls `GameNight.Accounts.Token.revoke_jti(token_jti)`, and calls `Notifications.System.resolve_for_subject("invitation", invitation.id)`. T069 turns green.
- [ ] T075 [US3] Add `json_api do ... end` block to `lib/game_night/games/player.ex` per [contracts/json-api.md](./contracts/json-api.md) §Player routes. Extend the Invitation `json_api` block with `:list_pending_for_game` and `:revoke` routes. T070 + T071 turn green.
- [ ] T076 [US3] Add `typescript_rpc` bindings for `Player` in `lib/game_night/games.ex`: `:list_players_for_game`, `:list_players_for_gm`, `:list_my_characters`, `:update_player`. Add `:list_pending_invitations_for_game` and `:revoke_invitation` for Invitation. Run `mix ash_typescript.codegen` and commit. T072 turns green.
- [ ] T077 [P] [US3] Hook tests in `assets/js/features/players/hooks.test.ts` for `useListPlayersForGame`, `useListPlayersForGm`, `useUpdatePlayer`. Hook tests in `assets/js/features/invitations/hooks.test.ts` for `useListPendingInvitationsForGame` and `useRevokeInvitation` (extend the existing file). Verify RED.
- [ ] T078 [P] [US3] Players Zod schemas in `assets/js/features/players/schemas.ts` for `UpdatePlayerInput`.
- [ ] T079 [US3] Implement Player hooks in `assets/js/features/players/hooks.ts` and extend `assets/js/features/invitations/hooks.ts` with `useListPendingInvitationsForGame` + `useRevokeInvitation`. T077 turns green.
- [ ] T080 [P] [US3] Component test for `PlayersTable` in `assets/js/features/players/components/players-table.test.tsx`: renders both the player-view variant (no gm_notes column) and the GM-view variant (gm_notes column). Axe-clean.
- [ ] T081 [P] [US3] Component test for `PlayerEditDialog` in `assets/js/features/players/components/player-edit-dialog.test.tsx`: form opens, validates, submits, status select shows three options.
- [ ] T082 [P] [US3] Component test for `PendingInvitationsList` in `assets/js/features/invitations/components/pending-invitations-list.test.tsx`: each row shows email + character_name + revoke button.
- [ ] T083 [P] [US3] Component test for `RevokeInvitationDialog` in `assets/js/features/invitations/components/revoke-invitation-dialog.test.tsx`: typed-confirmation pattern (must type the invitee's email; submit disabled until exact match).
- [ ] T084 [US3] Implement `PlayersTable`, `PlayerEditDialog` components in `assets/js/features/players/components/`. T080 + T081 turn green.
- [ ] T085 [US3] Implement `PendingInvitationsList` and `RevokeInvitationDialog` components in `assets/js/features/invitations/components/`. T082 + T083 turn green.
- [ ] T086 [US3] Update `assets/js/routes/games.$id.index.tsx` to render the roster (PlayersTable, GM-or-player variant chosen by ownership), and — for the GM only — the PendingInvitationsList alongside the InvitationForm from US1. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). Update `assets/js/routes/games.$id.index.test.tsx` accordingly.
- [ ] T087 [P] [US3] E2E spec in `assets/e2e/games-roster-management.spec.ts` walking the quickstart §US3 flow end-to-end: GM views roster + pending; second profile (seated player) sees roster but not pending; non-GM non-player gets 404; GM edits a status; GM revokes an invitation; the revoked URL renders the friendly invalid-token state.

**Checkpoint**: All three P1 stories complete. The MVP cut covers create + accept + manage. Ready to ship if this is the chosen MVP boundary.

---

## Phase 6: User Story 4 — Invitee declines (Priority: P2)

**Goal**: An invitee — registered or not — can decline a pending invitation. The invitation is closed (`status: :declined`), the token is revoked, the linked Notification is resolved.

**Independent Test**: From [quickstart.md](./quickstart.md) §US4: invitee opens the URL, clicks decline, the invitation is no longer pending and the original URL is no longer valid.

### Tests for User Story 4 (REQUIRED — write and verify RED first) ⚠️

- [ ] T088 [P] [US4] Action test for `Invitation.decline_with_token` in `test/game_night/games/invitation_test.exs`: with a valid token + actor, flips `status` to `:declined`, revokes the token, resolves the linked Notification, does NOT create a Player. Re-decline of a terminal invitation returns a friendly `:already_resolved` error.
- [ ] T089 [P] [US4] JSON:API request test in `test/game_night_web/controllers/invitations_request_test.exs` for `PATCH /api/json/invitations/:id/decline`.
- [ ] T090 [P] [US4] Hook test in `assets/js/features/invitations/hooks.test.ts` for `useDeclineInvitation` (extends file).
- [ ] T091 [P] [US4] Component test for `DeclineInvitationConfirm` in `assets/js/features/invitations/components/decline-invitation-confirm.test.tsx`: lightweight modal — single confirm click, no typed input.

### Implementation for User Story 4

- [ ] T092 [US4] Implement `Invitation.decline_with_token` action in `lib/game_night/games/invitation.ex` symmetric with accept (token verify; flip status; revoke token; resolve notification). T088 turns green.
- [ ] T093 [US4] Add the `:decline_with_token` route to the Invitation `json_api` block. T089 turns green.
- [ ] T094 [US4] Add the `:decline_invitation` `typescript_rpc` binding in `lib/game_night/games.ex`; regen codegen. Implement `useDeclineInvitation` in `assets/js/features/invitations/hooks.ts`. T090 turns green.
- [ ] T095 [US4] Implement `DeclineInvitationConfirm` component in `assets/js/features/invitations/components/decline-invitation-confirm.tsx`. T091 turns green.
- [ ] T096 [US4] Wire the Decline button into `AcceptInvitationCard` (`assets/js/features/invitations/components/accept-invitation-card.tsx`) — clicking opens DeclineInvitationConfirm.
- [ ] T097 [P] [US4] E2E spec in `assets/e2e/invitations-decline.spec.ts` covering quickstart §US4 end-to-end.

**Checkpoint**: US4 complete; declined invitations leave clean state on both GM and recipient sides.

---

## Phase 7: User Story 5 — Player finds games on dashboard (Priority: P2)

**Goal**: The dashboard renders a two-column layout — `My Characters` (left, active+inactive Player records) and `My Games` (right, active games owned by the user). Below `lg`, columns stack with My Characters first. Each column has its own loading/empty/error states.

**Independent Test**: From [quickstart.md](./quickstart.md) §US5: with at least one accepted Player and one Active game, both columns populate; navigation from a Player entry lands on the game view; "View all" links work.

### Tests for User Story 5 (REQUIRED — write and verify RED first) ⚠️

- [ ] T098 [P] [US5] Action test for `Player.list_mine` (already created in T073, but explicitly extend the existing test in `test/game_night/games/player_test.exs` to assert: returns actor's rows across all statuses; respects sort `updated_at DESC`).
- [ ] T099 [P] [US5] Hook test in `assets/js/features/players/hooks.test.ts` for `useListMyCharacters` (extend file).
- [ ] T100 [P] [US5] Component test for `MyCharactersColumn` in `assets/js/features/players/components/my-characters-column.test.tsx`: filters out `:done` status; empty state copy matches "You haven't been invited to any games yet"; renders character_name + game.title per row.
- [ ] T101 [P] [US5] Component test for `MyGamesColumn` in `assets/js/features/games/components/my-games-column.test.tsx`: refactors the existing dashboard's "My Active Games" section into a column-shaped component; preserves the existing `no_games_at_all` / `no_active_games` discriminated empty state from `assets/js/features/games/components/empty-state.tsx`.
- [ ] T102 [P] [US5] Updated route test for `/dashboard` in `assets/js/routes/dashboard.test.tsx`: two-column layout on lg+ viewports; stacks on narrow viewports with My Characters above My Games; both columns render their own loading/empty/error states; axe-clean.
- [ ] T103 [P] [US5] Route test for `/characters` in `assets/js/routes/characters.test.tsx`: lists ALL of the actor's Player records regardless of status (including `:done`); each entry links to `/games/:id`.

### Implementation for User Story 5

- [ ] T104 [US5] Add the `:list_my_characters` `typescript_rpc` binding in `lib/game_night/games.ex` if not already added in T076 (depends on Phase 5 ordering — confirm and skip if present). Run codegen if changed.
- [ ] T105 [US5] Implement `useListMyCharacters` hook in `assets/js/features/players/hooks.ts` (already added in T079; extend if needed for the dashboard's `status in [:active, :inactive]` filter — apply the filter client-side to keep the hook generic).
- [ ] T106 [US5] Implement `MyCharactersColumn` component in `assets/js/features/players/components/my-characters-column.tsx` and the empty-state component in `assets/js/features/players/components/characters-empty-state.tsx`. T100 turns green.
- [ ] T107 [US5] Implement `MyGamesColumn` component in `assets/js/features/games/components/my-games-column.tsx` by extracting the existing "My Active Games" section content from `assets/js/routes/dashboard.tsx`. T101 turns green.
- [ ] T108 [US5] Update `assets/js/routes/dashboard.tsx` to use a `grid grid-cols-1 lg:grid-cols-2 gap-12` layout containing `<MyCharactersColumn />` (left) and `<MyGamesColumn />` (right). Per [research.md](./research.md) §10. The route MUST continue to render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T102 turns green.
- [ ] T109 [US5] Implement the `/characters` route in `assets/js/routes/characters.tsx` rendering a full PlayersTable-style list of every Player record (all statuses) for the actor, each row linking to `/games/:id`. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T103 turns green.
- [ ] T110 [P] [US5] E2E spec in `assets/e2e/dashboard-my-characters.spec.ts`: with seeded fixtures, the dashboard renders both columns; the player entry navigates correctly; a viewport-resize check confirms the stacking order on narrow.

**Checkpoint**: Dashboard layout reorganised. Player has a steady-state navigation surface.

---

## Phase 8: User Story 6 — Notifications bell (Priority: P2)

**Goal**: The navbar shows a bell icon (auth-only) with an unread-count badge. Clicking opens a dropdown of up to 10 unread notifications with inline accept/decline for invitation kinds. A `/notifications` route shows the full list. The bell polls `useUnreadCount` every 60 s.

**Independent Test**: From [quickstart.md](./quickstart.md) §US6: invitation arrives → badge increments within ≤ 60 s of refetch (or immediately on tab focus); dropdown shows the entry; accept/decline from the dropdown works; `/notifications` matches.

### Tests for User Story 6 (REQUIRED — write and verify RED first) ⚠️

- [ ] T111 [P] [US6] Component test for `NotificationsBell` in `assets/js/features/notifications/components/notifications-bell.test.tsx`: badge hidden when count is zero; badge shows count when > 0; dropdown opens on click; entries render by kind via the `kinds.ts` discriminator; inline accept calls the mutation and closes the dropdown; keyboard navigation (Tab/Enter/Escape) covered; **the open dropdown panel does NOT visually obscure the host page's `<h1 data-route-heading>` (WCAG 2.4.11 Focus Not Obscured) — mount the bell inside a stub layout containing the H1 and assert via `getBoundingClientRect` that the panel's bounding rectangle does not intersect the H1's bounding rectangle when the bell trigger has focus**; axe-clean.
- [ ] T112 [P] [US6] Component test for `NotificationsList` in `assets/js/features/notifications/components/notifications-list.test.tsx`: renders both unread and read entries; mark-read button updates state; pagination not required for v1 — show all.
- [ ] T113 [P] [US6] Route test for `/notifications` in `assets/js/routes/notifications.test.tsx`: redirects unauthenticated users to sign-in; renders the list for authed users; axe-clean.

### Implementation for User Story 6

- [ ] T114 [US6] Implement `NotificationsBell` component in `assets/js/features/notifications/components/notifications-bell.tsx` using Shadcn `<DropdownMenu>` + `<Badge>` per [research.md](./research.md) §9. T111 turns green.
- [ ] T115 [US6] Implement `NotificationsList` component in `assets/js/features/notifications/components/notifications-list.tsx`. T112 turns green.
- [ ] T116 [US6] Implement the `/notifications` route in `assets/js/routes/notifications.tsx` with the standard auth-redirect `beforeLoad`. The route's component MUST render its primary `<h1 data-route-heading>` so the existing `useFocusOnRouteChange` hook moves focus on navigation (Constitution Principle IV NON-NEGOTIABLE). T113 turns green.
- [ ] T117 [US6] Update `assets/js/routes/__root.tsx` to render `<NotificationsBell />` in the navbar (auth-only — gate on `auth.isAuthenticated`). Update the existing root-route test to cover the bell's presence/absence.
- [ ] T118 [P] [US6] E2E spec in `assets/e2e/notifications-bell.spec.ts`: send an invitation to an existing user; sign in as that user; assert the badge shows 1; open the dropdown; accept inline; the badge clears.

**Checkpoint**: All six user stories independently functional. The full feature loop is in.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T119 [P] Run [quickstart.md](./quickstart.md)'s manual smoke tests (US1 through US6) against a clean local environment; record any deltas or copy fixes in this PR.
- [ ] T120 [P] Manual a11y audit per Constitution Principle IV: keyboard-only navigation through `/invitations/:token`, `/invitations`, `/notifications`, `/characters`, `/dashboard`, and the bell dropdown — **including verification that with the bell dropdown open at every viewport size in CI's matrix, the dropdown does not obscure the focused element or the route's `<h1 data-route-heading>` (WCAG 2.4.11)**. Screen-reader smoke (NVDA on Windows or VoiceOver on macOS) on US1 and US3 happy paths. Document the audit and the WCAG 2.4.11 verification in the PR description.
- [ ] T121 [P] Run `cd assets && pnpm size-limit` and confirm each new chunk is within its budget per T005. If over, code-split or justify in a Complexity Tracking entry on plan.md.
- [ ] T122 [P] Run Lighthouse CI on `/dashboard`, `/games/:id`, and `/invitations/:token` and confirm LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 per Constitution Principle VI.
- [ ] T123 [P] Run `mix credo --strict` and `mix dialyzer`; fix any new findings; prefer fixing the underlying issue over adding suppressions.
- [ ] T124 [P] Verify all security gates pass: `mix sobelow --strict`, `mix deps.audit` (mix_audit), `pnpm audit`, Trivy filesystem scan, gitleaks. Fix or escalate any high-severity findings.
- [ ] T125 [P] Re-run `mix ash.codegen --check` and `mix ash_typescript.codegen` followed by `git diff --exit-code` on the generated client; the build must be drift-clean.
- [ ] T126 [P] Update the existing senders to read from `:invitation_email_from` config (or a shared `:transactional_email_from`) — opportunistic fix-up for the TODO in `SendMagicLinkEmail`, `SendNewUserConfirmationEmail`, and `SendPasswordResetEmail`. Mention this in the PR description (out of scope for the spec, in scope for the cleanup pass).
- [ ] T127 [P] Add a follow-up note in `specs/002-invite-players/notes.md` (NEW) listing post-MVP candidates surfaced during implementation: WebSocket push for the bell, "remove accepted player" admin action, declined-invite cleanup cron, `/characters/:id` standalone route, multi-character-per-game support. This is a forward-looking record for `/schedule` follow-ups.
- [ ] T128 [P] Route-change focus management E2E in `assets/e2e/route-focus.spec.ts` per Constitution Principle IV: navigate from `/dashboard` to each new route (`/invitations/$token`, `/invitations`, `/notifications`, `/characters`) and to the updated `/games/$id` view, asserting after each navigation that (a) `document.activeElement` matches the route's `<h1 data-route-heading>`, and (b) the polite `aria-live` announcer region was updated with the new page title. axe-core does not catch this; this task is the constitutional gate.

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
