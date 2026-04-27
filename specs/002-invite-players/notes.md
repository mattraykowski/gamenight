# Feature 002 — Post-MVP follow-ups

Forward-looking record captured during implementation, intended for
future `/schedule` agents or routine cleanup PRs. Each item is small
enough to ship as its own change; none are blocking the feature
shipping as-is.

## Backend

### Per-route bundle budgets

`assets/.size-limit.cjs` (T005 / T121) declares per-route gzipped
budgets for the four new SPA routes (`/invitations/$token`,
`/invitations`, `/characters`, `/notifications`). The lookup keys
the chunks by manifest path (`js/routes/invitations.$token.tsx`),
but TanStack Router's code-split plugin emits route chunks as
anonymous async-load chunks that **do not appear as keyed
manifest entries** — only `js/index.tsx` is in the manifest's
top-level. Today the entries skip-with-warn and the global
initial-bundle budget (350 KB gzipped) is the enforced cap.

Follow-up: rework the per-route budget mechanism to match output
filenames instead of manifest keys (e.g., glob `priv/static/assets/*invitations*token*.js`),
or move per-route enforcement to a CI-side comparison against the
prior build's manifest. Not urgent — the global budget is well
under (214 KB / 350 KB cap as of US6 commit).

### Backwards-compat alias on `:invitation_email_from`

Phase 9 cleanup (T126) introduced `:transactional_email_from` as
the shared key all senders read. The legacy `:invitation_email_from`
remains as a fallback alias in `config/runtime.exs` for backward
compatibility. Once any deployment using the old env var has been
rotated, the alias and the dual-fallback in the config can be
removed.

### `:get_mine` action naming

Per [research.md §4](./research.md), the `:get_mine` action's name
is now slightly off — feature 002 expanded its policy to admit any
seated player, so "mine" is no longer literally accurate. A future
refactor could rename to `:get_visible` or split into two actions;
the SPA's generated client would need a single regen + import
update.

## Frontend

### Shadcn `DialogContent` text-foreground fix (shipped)

The shadcn `DialogContent` primitive (`assets/js/components/ui/dialog.tsx`)
originally set only `bg-background`. Radix portals dialog content
out of the SPA's `<div className="…text-foreground">` wrapper into
`document.body`, where daisyUI's `prefersdark: true` media query
gives the body a near-white text color when the system prefers
dark. The portaled content inherited that color, producing
white-on-white text in the GM invite modal (and latent risk in
`DeleteGameDialog`, `PlayerEditDialog`, `RevokeInvitationDialog`).
Fix: add `text-foreground` to the primitive's class list so dialogs
carry both background and foreground tokens explicitly. No follow-up
needed — recorded for future readers asking why the token is on the
primitive.

### WebSocket push for the bell

The bell currently polls `useUnreadCount` every 60 s
(`refetchInterval` + `refetchOnWindowFocus`). Spec SC-003 ("user
can accept in 30 s") is met because the count is measured from
*opening the list*, not from delivery — but a Phoenix Channel push
on notification create would make the bell reactive in real time
and is the natural next step if engagement metrics show users
waiting on the polling delay.

### `/characters/:id` standalone route

Today the dashboard's "My Characters" entries surface the
character + the game implicitly. Players who want to update their
character's display preferences or post a player-side bio would
need a per-character page. Out of scope for the GM-controlled v1
data model (`character_name` etc. are GM-only), but a natural
follow-up if the spec expands.

### Multi-character-per-game

Spec Q6 locked in one Player per `(game, user)`. Some campaigns
run with multiple characters per player (rotating party, NPC
companions). Lifting the unique constraint is a schema migration
plus UI work; the existing accept flow would need a "create new
character" action that runs separately from invitation accept.

## Process / spec hygiene

### Deferred Playwright E2Es

Six E2E specs are intentionally deferred from the per-story phases
(T048, T063, T087, T097, T110, T118). They share infrastructure —
`TestMailboxController` for fetching invitation tokens, multi-
context browser setup for the GM/recipient split, deterministic
seed data — and are best authored together in a dedicated session.
The integration coverage at the JSON:API request layer + per-route
SPA tests with MSW already exercises every branch.

### Manual a11y audit

T120 (Phase 9) and T128 (route-change focus E2E) are gated on
manual review. The bell's WCAG 2.4.11 (Focus Not Obscured)
assertion is part of T120 because Radix's DropdownMenu portal
lifts the panel outside the viewport flow — jsdom can't reliably
measure positional overlap. This is the correct medium for the
check.

### Lighthouse + security gates

T122 (Lighthouse) and T124 (Trivy / Sobelow / mix_audit / npm
audit / gitleaks) are CI-gated tasks that run on every PR per
constitution Principle II / VI. They are recorded as Phase 9 line
items so the constitutional checklist is satisfied; no local
action is required beyond ensuring the CI pipeline includes them.

### Dialyzer PLT priming

`mix dialyzer` requires a PLT cache that takes several minutes to
build the first time. Confirm the CI pipeline persists the PLT
across runs (typical pattern is `mix.lock`-keyed cache); local
`mix dialyzer --plt` is a one-time setup cost.

## Constitutional notes

### Per-action policy split on `Game.read`

Feature 002 split `Game.read` into per-action policies:
`:get_mine` admits owner + seated player, while base `:read`,
`:list_mine_active`, `:list_mine` stay owner-only. This was a
correction from the original research.md §4 design — see the
"Why per-action, not action_type" subsection there for the trap to
avoid (broad `action_type(:read)` widening leaks 403 vs 404 on
JSON:API PATCH). Future read actions on `Game` should follow the
same pattern: explicitly opt-in to the wider policy when the SPA
surface needs cross-tenant access.

### `gm_notes` field-policy ergonomics

The `Player.visible_gm_notes` calculation + `field_policy`
combination produces an `%Ash.ForbiddenField{}` sentinel for non-
GM callers (rather than `nil` or omission). The JSON:API
serialiser handles this correctly (the field is omitted on the
wire), but tests that read the calc value via Elixir struct
access need to assert against `%Ash.ForbiddenField{}` rather than
`is_nil/1`. See `test/game_night/games/player_test.exs` for the
established pattern.

### System-actor bypass marker

`GameNight.Notifications.System.Actor` is a `defstruct
_internal?: true` marker that the Notification resource's
`bypass action([…])` policies recognise. The defence-in-depth
posture (other actions still scope by `user_id == ^actor(:id)`,
which fails closed for the marker since it has no `:id`) is
tested in `test/game_night/notifications/system_test.exs`. Any
new cross-cutting domain that needs a similar privileged-write
context should mirror this pattern: narrow `bypass action([…])`
plus per-action user-scope checks elsewhere.
