# Quickstart: Invite Players

**Feature**: 002-invite-players
**Plan**: [plan.md](./plan.md)

This document is the operator-and-contributor cheat sheet for the
feature: how a developer iterates on it locally, how a tester
exercises every story, and how a reviewer verifies the constitutional
gates pass.

## Prerequisites

- Local dev environment per the existing project README
  (`mix setup`, Postgres running, Phoenix dev server on `:4000`,
  Vite dev assets via `mix phx.server`).
- A test user account (or use the `/test/sign-in-as` controller
  guarded behind `:dev_routes`).
- Swoosh local mailbox available at `/dev/mailbox` for inspecting
  invitation emails in dev.

## Configuration

Add to `config/runtime.exs` (defaults provided so tests don't fail
without env vars):

```elixir
config :game_night,
  invitation_token_ttl: System.get_env("INVITATION_TOKEN_TTL_DAYS", "30") |> String.to_integer(),
  invitation_email_from: System.get_env("INVITATION_EMAIL_FROM", "noreply@example.com")
```

`invitation_token_ttl` is read by
`GameNight.Games.Invitation.create_for_game` when minting the JWT;
`invitation_email_from` is read by
`GameNight.Games.Invitation.Senders.SendInvitationEmail`.

## Local iteration

1. Generate migrations and snapshots after editing the resources:
   ```sh
   mix ash.codegen --check    # fails if drift exists
   mix ash.codegen            # writes migrations + snapshots
   mix ecto.migrate
   ```
2. Regenerate the TypeScript client:
   ```sh
   mix ash_typescript.codegen
   ```
   The generated files (`assets/js/ash_rpc.ts`, `assets/js/ash_types.ts`)
   are committed; CI runs `git diff --exit-code` after regen.
3. Run the full backend suite:
   ```sh
   mix test
   mix credo --strict
   mix dialyzer
   ```
4. Run the frontend suite:
   ```sh
   cd assets && pnpm test
   cd assets && pnpm playwright test
   ```

## Story walk-through (manual smoke test)

### US1 — GM invites a brand-new user

1. Sign in as a user who owns at least one game (or create one via
   `/games/new`).
2. Open `/games/:id`.
3. Click the "Invite player" button (justified right of the Players section header). The invitation form opens in a modal. Fill in:
   - email: `newperson@example.com`
   - character name: `Mira Stoneheart`
   - character summary: `Half-orc paladin.`
   - GM notes: `First-time player.`
4. Submit. Toast appears: "Invitation sent." The modal closes and the
   page's pending-invitations section refreshes to include the new
   row.
5. Open `/dev/mailbox`. The invitation email is at the top.
6. Copy the URL inside the email; paste into a new browser
   profile / private window (so you're acting as a stranger).
7. The accept page renders with the game title and character name.
8. Click "Sign in or register to accept". You land on `/register`
   with the invitation token preserved as a search param.
9. Register with `newperson@example.com`. After confirm + login,
   you land back on the accept page.
10. Click "Accept". Toast confirms; you're redirected to the
    game's view page (or the dashboard).
11. Sign back in as the GM. The roster on `/games/:id` now shows
    Mira; the pending-invitations section is empty.

### US2 — GM invites an existing user

1. Sign in as a user with an existing account (e.g. seeded by
   `/test/sign-in-as`).
2. Repeat US1 with the existing user's email. After step 5, the
   invitation also appears in the existing user's notifications
   bell (badge count: 1).
3. Sign in as the recipient. Click the bell; click the invitation
   entry; the preview page accepts directly without registration.

### US3 — GM manages the roster

1. Sign in as a GM with at least one accepted player and one
   pending invitation on a game.
2. Open `/games/:id`. Confirm:
   - The roster shows accepted players to the GM and to any seated
     player (verify in a second profile that a non-player non-GM
     gets a 404).
   - The pending-invitations section is visible only to the GM.
3. Edit a player's character name + status (set to `inactive`).
   Save. Confirm persistence on reload.
4. Revoke the pending invitation: click "Revoke", type the
   invitee's email to confirm, submit. The invitation disappears
   from the pending section. Visit the original invitation URL in
   another browser — the page renders "no longer valid."

### US4 — Invitee declines

1. Send an invitation per US1.
2. As the recipient, open the invitation URL.
3. Click "Decline". The page confirms; the invitation disappears
   from the recipient's notifications and the GM's pending list
   shows it as declined or it's removed (per spec, declined
   invitations are no longer pending).

### US5 — Player finds their games on the dashboard

1. As a user with at least one accepted player record AND owning
   at least one active game, open `/dashboard`.
2. On a desktop viewport, two columns render: "My Characters"
   left, "My Games" right.
3. Each column has its own loading/empty/error states. With at
   least one row in each, both populate.
4. Resize to mobile (or Chrome DevTools narrow): columns stack
   with My Characters above My Games.
5. With no Player records: the left column shows "You haven't
   been invited to any games yet."
6. Click a player entry → navigates to that game's view page.

### US6 — Notifications bell

1. As a logged-in user, the navbar shows a bell icon with a badge
   when there are unread notifications.
2. Click the bell. Up to 10 unread entries render. Each entry is
   a one-click accept/decline (for invitations).
3. Click an entry to navigate to its full page; the entry is
   marked read.
4. From the dropdown footer, "View all" navigates to
   `/notifications`.

## Constitutional gate checklist

Run before opening the PR — these are the same gates CI enforces.

- [ ] `mix format --check-formatted`
- [ ] `mix compile --warnings-as-errors`
- [ ] `mix test` (full backend suite, all new tests included)
- [ ] `mix credo --strict`
- [ ] `mix dialyzer`
- [ ] `mix ash.codegen --check`
- [ ] `mix ash_typescript.codegen` then `git diff --exit-code`
- [ ] `cd assets && pnpm typecheck`
- [ ] `cd assets && pnpm lint`
- [ ] `cd assets && pnpm test`
- [ ] `cd assets && pnpm playwright test` (smoke suite)
- [ ] `cd assets && pnpm size-limit` (under the documented budgets)
- [ ] Sobelow `--strict`, mix_audit, npm audit, Trivy, gitleaks all
      green (these run on push; locally they're optional).
- [ ] axe-core: no `serious`/`critical` violations on the new
      routes (Vitest + Playwright).
- [ ] Lighthouse CI on the new routes within budget
      (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1).
- [ ] Manual keyboard pass on `/invitations/:token`, `/notifications`,
      and the bell dropdown (per Principle IV; logged in the PR).

## Where the artifacts live

- Spec: [spec.md](./spec.md)
- Plan: [plan.md](./plan.md)
- Research: [research.md](./research.md)
- Data model: [data-model.md](./data-model.md)
- Contracts: [contracts/json-api.md](./contracts/json-api.md), [contracts/rpc.md](./contracts/rpc.md)
- Tasks (created by `/speckit.tasks`): `./tasks.md`

## Common pitfalls

- **Forgetting to regenerate** after touching a resource. Both
  `mix ash.codegen --check` and the `ash_typescript.codegen` drift
  gate fail the build with clear messages — re-run the codegen
  commands and commit.
- **`gm_notes` leaking** through a sparse-fieldset request on
  `:list_for_game`. The field policy fails closed — if you see a
  test failure that says non-GM saw `null` instead of the string,
  that is the *correct* behavior. Asserting non-null is the bug.
- **Token-bearer authentication confusion**: the JWT does not
  authenticate the bearer as a user. The actor on
  `:accept_with_token` is the *currently-logged-in* user. The token
  authorises *the action*, not *the actor*. If you find yourself
  reaching for `assign_actor_from_token`, stop and re-read research.md §2.
- **Dashboard column overlap on tablets**: the breakpoint is `lg`
  (1024 px). On 800–1023 px tablets the columns stack — verified
  in Playwright as part of the dashboard E2E spec.
