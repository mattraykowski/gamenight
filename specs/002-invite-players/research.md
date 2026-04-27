# Phase 0 Research: Invite Players

**Feature**: 002-invite-players
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

The spec carried no `[NEEDS CLARIFICATION]` markers — the two
grilling rounds during specification and planning resolved the
remaining design branches. This document records the decisions plus
the patterns that shape the rest of the plan, so downstream phases
(`/speckit.tasks`, `/speckit.implement`) have a single reference.

## 1. Domain placement: extend `GameNight.Games`; new `GameNight.Notifications`

**Decision**: Add `Player` and `Invitation` resources to the existing
`GameNight.Games` domain (one bounded concern: "what a GM owns and
runs"). Introduce a new `GameNight.Notifications` domain for
`Notification`, designed from day one to host other notification
kinds.

**Rationale**:

- `Player` and `Invitation` are tightly coupled to `Game` — they
  belong to a game, their policies pivot on game ownership, and the
  game-detail screen is where they're produced and consumed. Adding
  them to `GameNight.Games` keeps the cross-resource policy
  expressions short (`expr(game.owner_id == ^actor(:id))`) and lets
  the `typescript_rpc do ... end` block grow in one place.
- `Notification` is explicitly **polymorphic by design** (the spec
  treats invitations as one of several future entry types). It is
  cross-cutting; coupling its lifecycle to `Games` would force
  every future kind to live in `Games` too. A new domain is the
  honest place.
- The `Notification` resource references the invitation through a
  string `subject_type` + uuid `subject_id` pair (loose coupling)
  rather than a `belongs_to :invitation` (tight coupling), so adding
  a second kind in the future does not require schema migrations.

**Alternatives considered**:

- *Single-domain everything (Player + Invitation + Notification all
  in `GameNight.Games`)*. Rejected — couples notifications to games
  in a way the spec explicitly says will not hold.
- *Three new domains (`Players`, `Invitations`, `Notifications`)*.
  Rejected — over-segmented for two resources that always travel
  together with `Game`.

## 2. Invitation tokens: reuse the AshAuthentication `tokens` table

**Decision**: Mint invitation tokens through
`AshAuthentication.TokenResource` (`GameNight.Accounts.Token`) using
a new purpose `"invitation_accept"` and a non-user subject of the
form `"invitation:#{invitation_id}"`. The token is a JWT (default
AshAuthentication shape) carrying that subject, signed by
`GameNight.Secrets`. The URL is `/invitations/:token` where
`:token` is the JWT itself.

**Rationale**:

- The codebase already has the token machinery, signing secret,
  storage, expiration, revocation, and `expunge_expired` action.
  Adding a parallel table for invitation tokens would duplicate
  infrastructure without adding capability.
- AshAuthentication's `subject` field is conventionally
  `"user:#{id}"` but it's a free-form string — using
  `"invitation:#{id}"` is constitutional: the resource accepts any
  subject, and our acceptance code never confuses one subject namespace
  for another because purpose-matching gates the lookup.
- Revocation is free: revoking a pending invitation calls
  `Token.revoke_jti` for the JTI we minted, and a subsequent
  `Token.revoked?` check at acceptance time fails closed.
- Expiration is free: AshAuthentication's `expunge_expired` cron
  removes our rows alongside everyone else's.

**Implementation sketch**:

```elixir
# In Invitation.create_for_game's after_action (or via a Change):
{:ok, token, _claims} =
  AshAuthentication.Jwt.token_for_user(
    %{id: invitation.id, __struct__: GameNight.Games.Invitation},
    %{"purpose" => "invitation_accept"},
    GameNight.Accounts.User,                       # the auth-resource that owns the secret
    purpose: :invitation_accept,
    token_lifetime: invitation_token_ttl()         # default 30 days, configurable
  )

# Store with non-user subject:
GameNight.Accounts.Token
|> Ash.Changeset.for_create(:store_token, %{
     token: token,
     purpose: "invitation_accept",
     extra_data: %{"subject" => "invitation:#{invitation.id}"}
   })
|> Ash.create!(authorize?: false)                   # system action; comment justifies bypass
```

On accept:

```elixir
case AshAuthentication.Jwt.verify(token, GameNight.Accounts.User) do
  {:ok, %{"purpose" => "invitation_accept"} = claims, _} ->
    if Token.revoked?(token), do: error(:invalid_token)
    invitation_id = parse_subject!(claims["sub"])           # "invitation:<uuid>"
    invitation = Ash.get!(Invitation, invitation_id, authorize?: false)
    accept!(invitation, actor: current_user)
  _ -> error(:invalid_token)
end
```

The non-user subject is the only place we deviate from
AshAuthentication's stock JWT helpers — `Jwt.token_for_user/4`
expects a struct with an `:id`, which our invitation has. The
subject string ends up `"invitation:<uuid>"` (we set the prefix
explicitly in claims overrides) so the existing user-subject parser
in AshAuthentication never matches it. Token rows we mint look
identical in shape to user tokens; only `purpose` and `subject`
distinguish them.

**Alternatives considered**:

- *Per-invitation random token attribute on the Invitation
  resource (e.g., `:secure_token, :string`).* Simpler at first
  glance but reinvents revocation, expiration, and signing — and
  collides with the constitution's preference for reusing existing
  cryptographic infrastructure.
- *Phoenix.Token signed payload with no DB row*. Rejected —
  revocation requires a denylist anyway, which is what
  `AshAuthentication.TokenResource` already provides.

**Awkwardness disclosure**: AshAuthentication's user-token paths
expect a user as the subject, so our acceptance code resolves the
subject manually rather than calling AshAuthentication's normal
"sign in this token holder" flow. The token does **not** authenticate
the holder as a user — it authenticates them as an invitation
holder. The actor for the acceptance action is the **session user**
(the holder may be logged in as any account); the token grants
"acceptance rights" to whoever is logged in at the time. This
matches the spec edge case "user registers with a different email,
the link still works" — the link is the proof.

## 3. Notifications: materialise (one row per notification)

**Decision**: Create a `Notification` resource with attributes
`user_id`, `kind`, `subject_type`, `subject_id`, `read_at`,
`resolved_at`, `inserted_at`, `updated_at`. On invitation create, if
the invited email matches an existing user, insert one
`Notification` with `kind: :game_invitation`,
`subject_type: "invitation"`, `subject_id: invitation.id`. On
accept/decline/revoke, update the matching notification's
`resolved_at`. Reads filter on `is_nil(resolved_at)` for the
"unread/active" bell view, and admit `resolved_at != nil` for a
history view (out of scope for this feature but the schema supports
it).

**Rationale**:

- The spec explicitly states the notifications list will grow beyond
  invitations. A derived view (joining users to pending invitations
  by email) works for v1 but ossifies the list shape: every new
  kind would either need to be retro-fitted into the same join or
  layered on as a parallel derived view, which is exactly the
  pattern we're trying to avoid.
- Materialisation lets us do read-after-insert exactly once per
  notification — no recomputation on every poll.
- `read_at` and `resolved_at` are separate so a user can dismiss a
  notification without resolving the underlying subject (read but
  unactioned) or vice versa (the GM revokes; the recipient never
  saw the entry, but it's resolved).

**Polymorphism shape**:

- `kind` is an `Ash.Type.Atom` constrained to a `one_of` enum.
  Today's enum is `[:game_invitation]`. Adding a new kind is a
  one-line atom addition + a new SPA renderer in
  `assets/js/features/notifications/kinds.ts`.
- `subject_type` is a string (`"invitation"`, future: `"comment"`,
  `"announcement"`, etc.). It's redundant with `kind` for v1 (1:1)
  but is stored separately so a kind can someday point at multiple
  subject types if needed.
- The SPA renders each notification by `kind`, fetching subject
  data lazily where possible. For `game_invitation` the bell entry
  shows just the GM's email and game title (loaded on the
  `Notification` itself via a calculation), avoiding an N+1.

**Alternatives considered**:

- *Derived view (no Notification table)*. Rejected — see above.
  Forward-looking cost of refactoring later exceeds the cost of
  building the table once now.
- *Notification with concrete `belongs_to :invitation`*. Rejected —
  defeats the polymorphism intent.

## 4. `Game.read` policy expansion: add an `exists/2` clause for players

**Decision**:

```elixir
policy action_type(:read) do
  authorize_if expr(owner_id == ^actor(:id))
  authorize_if expr(exists(players, user_id == ^actor(:id)))
end
```

The named reads keep their `prepare build(filter: …)`:
`:list_mine_active` and `:list_mine` still filter on
`owner_id == ^actor(:id)`, so the dashboard right-column behaviour
is unchanged. `:get_mine` newly admits an accepted player viewing
the game they're in.

**Rationale**:

- The expansion is the smallest change that satisfies FR-018:
  "the game view screen MUST display the list of accepted Players
  for that game ... to anyone who is permitted to view the game".
- `exists/2` over the `:players` `has_many` relationship resolves to
  a single `EXISTS (SELECT 1 FROM players ...)` SQL clause —
  `ash_postgres` keeps the read efficient.
- Keeping the named reads' filters intact means the GM dashboard
  stays GM-only. We do **not** want a player's accepted games to
  show up in the GM's "My Active Games" — those are different lists
  and different routes.

**Naming caveat**: the action `:get_mine` becomes a slight misnomer
once players use it ("mine" = "I own it" historically; now also "I
play it"). We accept the cosmetic drift in v1; renaming is a future
refactor that touches the SPA's generated client and isn't worth a
contract churn for this feature. Reading the action's docstring
keeps the intent clear.

**Test shape**: in addition to the existing owner / non-owner /
anonymous cases, add (a) "an accepted player can `:get_mine` the
game they're playing in", and (b) "a previously-accepted player
whose Player row was destroyed cannot read the game any more". The
second case is what the cross-resource clause must reliably reject.

**Alternatives considered**:

- *Separate `:get_for_viewer` action*. Rejected — the SPA already
  imports `getMine`, and adding a parallel action splits the surface
  with no real benefit. One action, one policy expression.

## 5. `gm_notes` privacy: `public? false` + dedicated GM action + field policy as defence in depth

**Decision**: `gm_notes` is declared `public? false` on the `Player`
resource. The default JSON:API/RPC serialisation of any Player read
therefore excludes it. A dedicated `:list_for_gm` action loads
`gm_notes` via a calculated field, and a field policy on the
calculation re-asserts GM-ness:

```elixir
attributes do
  attribute :gm_notes, :string do
    allow_nil? true
    public? false                                   # never serialised by default
    constraints max_length: 4000
  end
end

calculations do
  calculate :visible_gm_notes, :string,
    expr(if(^actor(:id) == game.owner_id, gm_notes, nil)) do
    public? true
  end
end

field_policies do
  field_policy :visible_gm_notes do
    authorize_if expr(game.owner_id == ^actor(:id))
  end
end
```

`:list_for_gm` selects `:visible_gm_notes`; `:list_for_game` does
not. Even if a non-GM caller crafted a sparse fieldset request for
`visible_gm_notes`, the field policy rejects it (returns `nil`).
The two-actions surface is the **public contract**; the field policy
is the **defence in depth** that satisfies the spec's hard-zero
criterion (SC-005).

**Rationale**:

- A single attribute with a single rule, gated in two stacked ways
  (action selection + field policy), is the strongest practical
  posture in Ash: the JSON:API contract is unambiguous (two actions
  with two field-set defaults), and the policy fails closed under
  any sparse-fieldset gymnastics.
- `gm_notes` doesn't need to be visible at the SQL level for any
  player-facing read, so a calculation gate is appropriate.

**Alternatives considered**:

- *Single action + sparse-fieldset-driven access*. Rejected — relies
  on the client to ask for the right fields, and any future
  contributor can accidentally widen the default fields.
- *Two physical fields (gm_notes_public + gm_notes_private)*.
  Rejected — invents a redundant column and complicates updates.

## 6. Player statuses: `[:active, :inactive, :done]` exactly as spec'd

**Decision**: `Player.status` is `Ash.Type.Atom` with
`constraints one_of: [:active, :inactive, :done]`, default
`:active`. No alias for "pending" — pending is the **invitation**'s
status, not the player's. A `Player` row exists only after
acceptance.

**Rationale**:

- Matches the spec verbatim; stakeholders signed off on these three
  values. Renaming to avoid the `:active` overlap with `Game.status`
  would be premature optimisation — the values are scoped per
  resource and never collide in practice.
- Three statuses is intentionally small; expansion is a future
  amendment, not a v1 ambiguity.

## 7. Email sender: mirror `SendMagicLinkEmail`

**Decision**: The new `GameNight.Games.Invitation.Senders.SendInvitationEmail`
mirrors the shape of `GameNight.Accounts.User.Senders.SendMagicLinkEmail`:

```elixir
defmodule GameNight.Games.Invitation.Senders.SendInvitationEmail do
  use AshAuthentication.Sender                       # for the @impl + verified routes helpers
  use GameNightWeb, :verified_routes
  import Swoosh.Email
  alias GameNight.Mailer

  @impl true
  def send(invitation, token, _opts) do
    new()
    |> from({"Game Night", from_address()})
    |> to(to_string(invitation.email))
    |> subject("You've been invited to a game")
    |> html_body(body(token: token, invitation: invitation))
    |> Mailer.deliver!()
  end

  defp body(%{token: token, invitation: invitation}) do
    url = url(~p"/invitations/#{token}")
    """
    <p>#{Phoenix.HTML.html_escape_to_string(invitation.character_name)}
       has been invited to #{Phoenix.HTML.html_escape_to_string(invitation.game.title)}.</p>
    <p><a href="#{url}">#{url}</a></p>
    """
  end

  defp from_address, do: Application.fetch_env!(:game_night, :invitation_email_from)
end
```

`use AshAuthentication.Sender` provides the `@impl` for the
3-arity `send/3` callback. Even though `Invitation` is not a
strategy on the User resource, the sender behaviour is small enough
that adopting the existing macro keeps the file pattern uniform; if
that becomes a constitutional eyebrow-raise, the feature can drop to
a plain Swoosh module — the call sites only invoke `send/3`. The
TODO `from` address in the existing senders is replaced with a
configured value from `runtime.exs`, fixing a latent issue across
all senders in the same PR (out of scope for spec change but
mentioned in commit notes).

**HTML escaping**: every interpolated attribute (game title,
character name) goes through `Phoenix.HTML.html_escape_to_string/1`
to satisfy Sobelow's XSS check. The token is URL-only (no HTML
context) so it doesn't need additional escaping beyond `~p`.

**Async vs sync**: dev/test use Swoosh's local adapter
(synchronous, captured by the existing `TestMailboxController`).
Production should use the configured adapter. The Invitation
`:create_for_game` action awaits the send to surface delivery
errors to the GM in v1 (FR-001 expects acknowledgement), but a
follow-up can move the send to a Swoosh-async / Oban job once we
have one.

**Alternatives considered**:

- *Reuse `SendMagicLinkEmail` directly with a different purpose*.
  Rejected — copy collides; magic-link emails read "Click to sign
  in", invitation emails read differently.
- *Single generic transactional sender with a template registry*.
  Over-engineered for v1; revisit when the third sender lands.

## 8. SPA route: `/invitations/:token` flow for unregistered users

**Decision**: The route is rendered by a public TanStack Router page
that does not require authentication in `beforeLoad`. On render:

1. If `auth.isAuthenticated`, call `acceptInvitationPreview({ token })`
   to fetch a preview (game title, GM name, character name) **without
   accepting**. Show the accept/decline UI.
2. If not authenticated, render a "you've been invited" preview
   (with the same RPC, fetched via a token-only path that bypasses
   the actor requirement; the preview action's policy admits the
   token-bearer) and a primary CTA "Sign in or register to accept"
   that pushes the user to `/register?invitation=:token` (preferred
   for a brand-new user) and a secondary "I already have an account"
   link to `/sign-in?invitation=:token`. After successful auth, the
   register/sign-in routes redirect back to `/invitations/:token`.
3. After auth, the page re-runs and falls into branch 1.

The `?invitation=:token` query param is plumbed through the existing
`/register` and `/sign-in` routes via their search-param schemas
(both routes already use `redirect` for the same purpose; the
invitation token is an additional optional search key passed through
their `redirect` URLs).

**Rationale**:

- Preserves the invitation context across registration without
  introducing a new auth flow or a new token type. The token sits
  in the URL through register → sign-in → return-to.
- The "preview" RPC is the surface that lets us render a meaningful
  pre-auth screen without exposing the invitation to anyone with the
  bare email address.

**Implementation note**: The "preview" action
(`Invitation.preview_with_token`) is an `action :preview_with_token`
returning a struct (`game_title`, `inviter_email`, `character_name`,
`expires_at`) without granting any mutation rights. Its policy
admits any caller who presents a valid, non-expired, non-revoked
token — actor presence is **not** required.

## 9. Notifications bell: Radix DropdownMenu in the navbar

**Decision**: Add a `<NotificationsBell />` component into
`__root.tsx`'s navbar (only when authenticated). The bell renders a
Shadcn `<DropdownMenu>` whose trigger is an icon button with an
unread-count `<Badge>`. The dropdown shows up to 10 unread
notifications, an "all read" empty state, and a footer link to
`/notifications` for the full list. The badge polls
`useUnreadCount()` every 60 s while the tab is visible (TanStack
Query's `refetchInterval` + `refetchOnWindowFocus`); no WebSocket /
LiveView push in v1.

**Rationale**:

- Bell + badge is the universal, immediately-recognisable pattern.
  Dropdown rather than a separate page keeps the action one click
  away.
- 60 s polling is acceptable for v1; the spec's success metrics
  (SC-003: "existing user can accept in under 30 seconds from
  opening the email or notifications list") are measured from when
  the user opens the list, not from when the system delivers the
  invitation. WebSocket push is a future optimisation.
- TanStack Query handles tab-visibility pause for free, so a polling
  bell does not burn battery on backgrounded tabs.

**Alternatives considered**:

- *LiveView island* for the bell. Rejected — constitution forbids
  user-facing LiveView surfaces; the SPA is the only client.
- *Phoenix channel push* over WebSocket. Out of scope for v1;
  noted as the natural next step if SC-003 latency becomes an
  issue.

## 10. Dashboard layout: CSS grid two columns; asymmetric filters per Q6 C

**Decision**: The dashboard's two columns are rendered by
`<MyCharactersColumn />` (left) and `<MyGamesColumn />` (right),
inside a `grid grid-cols-1 lg:grid-cols-2 gap-12` wrapper on the
existing `<main className="mx-auto max-w-4xl px-6 py-12">` shell.
Below `lg`, the columns stack with My Characters above My Games.

- **Right column** (`<MyGamesColumn />`) reuses
  `useListMineActive()`. The section header "My Games" includes a
  "View all" link to `/games` and a "Create new game" button (both
  existing — moved from the current "My Active Games" section into
  this column).
- **Left column** (`<MyCharactersColumn />`) calls a new
  `useListMyCharacters()` that wraps the new `Player.list_mine`
  action with a filter `status in [:active, :inactive]` — i.e.,
  excludes `:done`. A "View all" link points to `/characters`,
  which renders all Player records regardless of status. There is
  no "Create new character" CTA on the dashboard — characters are
  created by accepting invitations, not by self-service.
- Each column shows a column-specific empty state: no characters
  reads "You haven't been invited to any games yet"; no active
  games reads the existing dashboard copy.
- Mobile (below `lg`): the columns stack with My Characters first.
  This matches the spec assumption: "narrow-viewport (mobile)
  layout is left to standard responsive behavior — the two columns
  may stack with My Characters above My Games".

**Rationale**:

- Asymmetry is intentional (Q6 C): the GM column shows what's
  actually being run *right now* (Active); the player column shows
  characters the user is still engaged with (Active + Inactive)
  while hiding "done" characters that would clutter the view.
- The current dashboard's discriminated empty state for games
  (`no_games_at_all` / `no_active_games`) is preserved as-is in the
  right column — moving it to a separate component is a refactor
  this feature already needs to do for the two-column rewrite.

**Alternatives considered**:

- *Symmetric (Active-only on both sides)*. Rejected per Q6.
- *All-statuses-on-left, Active-on-right*. The chosen middle
  ground; "done" characters are off the dashboard but one click
  away on `/characters`.

## 11. Concurrency and the unique-Player race

**Decision**: A unique constraint `unique_index(:players,
[:game_id, :user_id])` lives on the `players` table. The
`Invitation.accept_with_token` action wraps the player-create in a
`require_atomic? true` block; on a unique-violation, the action
returns a friendly "you're already a player on this game" error and
the underlying invitation is still marked `:accepted` (idempotent
re-acceptance produces the same observable outcome).

**Rationale**:

- Postgres serialises the unique-index check; the constraint is the
  authoritative gate. Application-level pre-checks ("does a Player
  already exist?") would still race; the unique index is the only
  honest answer.
- Idempotency at the Invitation level means a user double-clicking
  "Accept" cannot produce two rows or one accepted + one error
  state.

## 12. Telemetry, indexes, and budgets

**Decision**: Each new action emits Ash's standard telemetry; no
custom spans. Composite indexes match the filter+sort shape exactly
(see plan.md §VI). The `size-limit` config gains four new entries
keyed off the new route chunk paths.

**Rationale**: Mirrors feature 001's posture and the constitution's
performance discipline.

## 13. Agent context update (CLAUDE.md)

**Decision**: Update the pointer between the `<!-- SPECKIT START -->`
and `<!-- SPECKIT END -->` markers in `CLAUDE.md` to reference this
plan and its supporting artifacts. Standard Phase 1 step.

**Rationale**: Downstream agents invoked by `/speckit.tasks` and
`/speckit.implement` need a canonical pointer to the current feature
plan; the SPECKIT marker block is the agreed location.
