# Phase 1 Data Model: Invite Players

**Feature**: 002-invite-players
**Plan**: [plan.md](./plan.md)

Three new resources, two new tables in the existing `GameNight.Games`
domain (`Player`, `Invitation`), one new resource and table in the
new `GameNight.Notifications` domain (`Notification`). The existing
`GameNight.Games.Game` resource gains two `has_many` relationships
and an expanded `:read` policy.

## Entity: Player

A user seated at a game, identified by their account, with character
data the GM controls. Unique per `(game_id, user_id)`.

### Attributes

| Name                | Type                  | Nullable | Public? | Constraints / Notes                                                                       |
|---------------------|-----------------------|----------|---------|-------------------------------------------------------------------------------------------|
| `id`                | `uuid`                | no       | yes     | Primary key.                                                                              |
| `game_id`           | `uuid`                | no       | no      | FK to `games.id`. Set via `manage_relationship :game` on create.                          |
| `user_id`           | `uuid`                | no       | no      | FK to `users.id`. Set on accept; immutable after create.                                  |
| `character_name`    | `string`              | no       | yes     | `constraints min_length: 1, max_length: 120`. GM-controlled.                              |
| `character_summary` | `string`              | yes      | yes     | `constraints max_length: 4000`. GM-controlled.                                            |
| `gm_notes`          | `string`              | yes      | **no**  | `constraints max_length: 4000`. **Never serialised by default.** See `:visible_gm_notes` calculation below. |
| `status`            | `atom`                | no       | yes     | `constraints one_of: [:active, :inactive, :done]`, `default :active`.                      |
| `inserted_at`       | `utc_datetime_usec`   | no       | yes     | `create_timestamp`.                                                                       |
| `updated_at`        | `utc_datetime_usec`   | no       | yes     | `update_timestamp`. Drives sort order on roster + dashboard.                              |

### Calculations

| Name                | Type      | Expression                                                      | Public? | Field policy                                                |
|---------------------|-----------|-----------------------------------------------------------------|---------|-------------------------------------------------------------|
| `visible_gm_notes`  | `string`  | `expr(if(^actor(:id) == game.owner_id, gm_notes, nil))`         | yes     | `field_policy :visible_gm_notes do authorize_if expr(game.owner_id == ^actor(:id)) end` |

### Relationships

| Name      | Type         | Target                       | Required | Notes                                                                                       |
|-----------|--------------|------------------------------|----------|---------------------------------------------------------------------------------------------|
| `game`    | `belongs_to` | `GameNight.Games.Game`       | yes      | FK attribute `game_id`.                                                                     |
| `user`    | `belongs_to` | `GameNight.Accounts.User`    | yes      | FK attribute `user_id`.                                                                     |

### Postgres

```elixir
postgres do
  table "players"
  repo GameNight.Repo

  references do
    reference :game, on_delete: :delete
    reference :user, on_delete: :delete
  end

  custom_indexes do
    index [:user_id, :status, :updated_at],
      name: "players_user_status_updated_at_index"
    index [:game_id, :status, :updated_at],
      name: "players_game_status_updated_at_index"
  end
end

identities do
  identity :unique_game_user, [:game_id, :user_id]
end
```

`on_delete: :delete` on both FKs satisfies the spec edge cases:
deleting a Game removes its roster; deleting a user account removes
that user's player rows from every game they were in.

### Actions

| Name                  | Type      | Accept                                            | Notes                                                                                  |
|-----------------------|-----------|---------------------------------------------------|----------------------------------------------------------------------------------------|
| `:read`               | `read`    | —                                                 | Base. Policies admit GM of the game OR the player themselves.                          |
| `:list_for_game`      | `read`    | `argument :game_id, :uuid, allow_nil?: false`     | Returns players for a game; admits GM and any seated player; **does not select** `visible_gm_notes`.  |
| `:list_for_gm`        | `read`    | `argument :game_id, :uuid, allow_nil?: false`     | Returns players for a game; **GM-only**; selects `visible_gm_notes`.                   |
| `:list_mine`          | `read`    | —                                                 | Returns the actor's own player rows. Filter: `expr(user_id == ^actor(:id))`.            |
| `:update`             | `update`  | `[:character_name, :character_summary, :gm_notes, :status]` | GM-only; `require_atomic? true`.                                              |

No `:create` is exposed publicly. Players are created **only** through
`Invitation.accept_with_token` via `manage_relationship`; the
`Player.create` action is implicit on the resource and policy-bypassed
by AshAuthentication-interaction-style logic in the accept path
(documented and bounded — see Invitation §Actions below).

### Policies

```elixir
policies do
  policy action(:list_for_game) do
    authorize_if expr(game.owner_id == ^actor(:id))
    authorize_if expr(exists(game.players, user_id == ^actor(:id)))
  end

  policy action(:list_for_gm) do
    authorize_if expr(game.owner_id == ^actor(:id))
  end

  policy action(:list_mine) do
    authorize_if expr(user_id == ^actor(:id))
  end

  policy action(:update) do
    authorize_if expr(game.owner_id == ^actor(:id))
  end

  policy action_type(:read) do
    authorize_if expr(game.owner_id == ^actor(:id))
    authorize_if expr(user_id == ^actor(:id))
  end
end

field_policies do
  field_policy :visible_gm_notes do
    authorize_if expr(game.owner_id == ^actor(:id))
  end
end
```

### State transitions

`status` has no enforced lifecycle. Any of `:active`, `:inactive`,
`:done` may transition to any other via `:update`. The SPA's
`<PlayerEditDialog>` exposes all three options to the GM.

### Validation rules

- **FR-013**: `character_name` is `allow_nil? false` with `min_length: 1`.
- **FR-014**: unique `(game_id, user_id)` enforced at the DB level.
  The application surfaces a friendly error on conflict; idempotent
  re-acceptance still yields one row.
- **FR-016**: `status` is one of three atoms.
- **FR-020**: `gm_notes` is `public? false`; `visible_gm_notes`
  calculation gates loading by GM-ness; field policy is the
  defence-in-depth backstop.

### JSON:API serialisation

- Resource type: `"player"`.
- Default attributes serialised: `character_name`, `character_summary`,
  `status`, `inserted_at`, `updated_at`.
- `:list_for_gm` additionally selects `visible_gm_notes`; client
  receives a `gm_notes` field whose value is the actual string for
  the GM and `null` for any other authorised caller (defence in
  depth, though the action's policy already prevents non-GMs from
  reaching it).
- Relationships serialised: `game`, `user`.

Route definitions live in [contracts/json-api.md](./contracts/json-api.md).

## Entity: Invitation

A pending offer from a GM to an email address, carrying the
GM-provided character data that becomes the Player record on
acceptance.

### Attributes

| Name                | Type                  | Nullable | Public? | Constraints / Notes                                                                       |
|---------------------|-----------------------|----------|---------|-------------------------------------------------------------------------------------------|
| `id`                | `uuid`                | no       | yes     | Primary key.                                                                              |
| `game_id`           | `uuid`                | no       | no      | FK to `games.id`.                                                                         |
| `inviter_id`        | `uuid`                | no       | no      | FK to `users.id`. The GM at invite time. Redundant with `game.owner_id` for v1 (game's owner cannot change), but kept explicitly for audit. |
| `email`             | `ci_string`           | no       | yes     | The invited address. Normalised case-insensitively (matches `User.email`).                |
| `character_name`    | `string`              | no       | yes     | `constraints min_length: 1, max_length: 120`. Snapshot at invite time.                    |
| `character_summary` | `string`              | yes      | yes     | `constraints max_length: 4000`. Snapshot at invite time.                                  |
| `gm_notes`          | `string`              | yes      | **no**  | `constraints max_length: 4000`. Same privacy posture as Player.gm_notes (only GM reads).   |
| `status`            | `atom`                | no       | yes     | `constraints one_of: [:pending, :accepted, :declined, :revoked]`, `default :pending`.     |
| `accepted_player_id`| `uuid`                | yes      | no      | FK to `players.id`. Set on acceptance; null otherwise.                                    |
| `token_jti`         | `string`              | no       | no      | The JTI of the issued AshAuthentication token. Used to revoke on `:revoke`.               |
| `expires_at`        | `utc_datetime_usec`   | no       | yes     | Mirrors the token's expiration; surfaced to the SPA so the accept page can show "expires in 5 days". |
| `inserted_at`       | `utc_datetime_usec`   | no       | yes     | `create_timestamp`.                                                                       |
| `updated_at`        | `utc_datetime_usec`   | no       | yes     | `update_timestamp`.                                                                       |

### Calculations

| Name                | Type      | Expression                                                                            | Public? | Field policy                                              |
|---------------------|-----------|---------------------------------------------------------------------------------------|---------|-----------------------------------------------------------|
| `visible_gm_notes`  | `string`  | `expr(if(^actor(:id) == game.owner_id, gm_notes, nil))`                               | yes     | `authorize_if expr(game.owner_id == ^actor(:id))`         |

### Relationships

| Name              | Type         | Target                       | Required | Notes                                                  |
|-------------------|--------------|------------------------------|----------|--------------------------------------------------------|
| `game`            | `belongs_to` | `GameNight.Games.Game`       | yes      | FK attribute `game_id`.                                |
| `inviter`         | `belongs_to` | `GameNight.Accounts.User`    | yes      | FK attribute `inviter_id`.                             |
| `accepted_player` | `belongs_to` | `GameNight.Games.Player`     | no       | FK attribute `accepted_player_id`.                     |

### Postgres

```elixir
postgres do
  table "invitations"
  repo GameNight.Repo

  references do
    reference :game, on_delete: :delete
    reference :inviter, on_delete: :delete
    reference :accepted_player, on_delete: :nilify
  end

  custom_indexes do
    index [:game_id, :status, :updated_at],
      name: "invitations_game_status_updated_at_index"
    index [:email, :status],
      name: "invitations_email_status_index"
  end
end

identities do
  # Spec: a GM cannot invite the same email twice while a pending
  # or accepted invite for that email exists on the same game.
  # Modelled as a partial unique index in the migration; Ash
  # `identities` block declares the logical key, and the migration
  # adds the `WHERE status IN ('pending', 'accepted')` predicate.
  identity :unique_game_email_open, [:game_id, :email] do
    where expr(status in [:pending, :accepted])
  end
end
```

### Actions

| Name                       | Type      | Accept / Args                                                            | Notes                                                                                                  |
|----------------------------|-----------|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `:read`                    | `read`    | —                                                                        | Base; policies enumerate per-action below.                                                             |
| `:list_pending_for_game`   | `read`    | `argument :game_id, :uuid, allow_nil?: false`                            | GM-only. `prepare build(filter: [game_id: ^arg(:game_id), status: :pending], sort: [updated_at: :desc])`. |
| `:list_pending_for_me`     | `read`    | —                                                                        | Filters `email == ^actor(:email) AND status == :pending`. Used by /invitations and the bell-derived view (we still materialise notifications, but this read drives the /invitations page). |
| `:preview_with_token`      | `action`  | `argument :token, :string, allow_nil?: false`                            | Returns `{game_title, inviter_email, character_name, expires_at}`. Token-bearer auth, no actor required. |
| `:create_for_game`         | `create`  | `[:character_name, :character_summary, :gm_notes]` + arguments `:email`, `:game_id` | GM-only. Sets `inviter_id` from actor; mints token; stores token row; sends email; conditionally creates Notification. |
| `:accept_with_token`       | `update`  | argument `:token, :string, allow_nil?: false`                            | Actor required (any logged-in user). Token must verify, be unrevoked, unexpired, purpose `"invitation_accept"`. Creates `Player`; flips status to `:accepted`; revokes token; resolves Notification. |
| `:decline_with_token`      | `update`  | argument `:token, :string, allow_nil?: false`                            | Actor required. Token-bearer authenticates. Flips status to `:declined`; revokes token; resolves Notification. |
| `:revoke`                  | `update`  | —                                                                        | GM-only. Flips status to `:revoked`; revokes token; resolves Notification.                              |

### Policies

```elixir
policies do
  policy action(:create_for_game) do
    authorize_if expr(^arg(:game_id) in ^actor_owned_game_ids())
  end

  policy action([:list_pending_for_game, :revoke]) do
    authorize_if expr(game.owner_id == ^actor(:id))
  end

  policy action(:list_pending_for_me) do
    authorize_if expr(email == ^actor(:email))
  end

  policy action(:preview_with_token) do
    # No actor needed; the action's body verifies the token.
    authorize_if always()
  end

  policy action([:accept_with_token, :decline_with_token]) do
    # Actor is required (the action body enforces token validity);
    # any authenticated user can act on a token they hold.
    authorize_if actor_present()
  end

  policy action_type(:read) do
    authorize_if expr(game.owner_id == ^actor(:id))
    authorize_if expr(email == ^actor(:email))
  end
end

field_policies do
  field_policy :visible_gm_notes do
    authorize_if expr(game.owner_id == ^actor(:id))
  end
end
```

`actor_owned_game_ids/0` is a custom check that returns the actor's
owned-game ids; documented and tested. Policy authors who prefer
inline expressions can substitute
`expr(exists(game, owner_id == ^actor(:id) and id == ^arg(:game_id)))`
which produces equivalent SQL.

### State transitions

```text
[ pending ] ─ accept ─→ [ accepted ]
     │
     ├── decline ─→ [ declined ]
     └── revoke ─→ [ revoked ]
```

`accepted`, `declined`, and `revoked` are terminal. The action layer
rejects transitions out of terminal states with a friendly error
("This invitation has already been accepted/declined/revoked").

### Token lifecycle

- **On `:create_for_game`**: an AshAuthentication JWT is minted with
  `purpose: "invitation_accept"`, `subject: "invitation:#{id}"`,
  expiration from the configured TTL (default 30 days). The token's
  JTI is captured into `token_jti` on the row and the token row is
  `store_token`-ed via `GameNight.Accounts.Token`.
- **On `:accept_with_token` / `:decline_with_token` / `:revoke`**:
  the action calls `GameNight.Accounts.Token.revoke_jti(token_jti)`
  to revoke the row. Subsequent verifies fail closed.

### JSON:API serialisation

- Resource type: `"invitation"`.
- Default attributes serialised: `email`, `character_name`,
  `character_summary`, `status`, `expires_at`, `inserted_at`,
  `updated_at`. `gm_notes` is excluded (private); the calculation
  `visible_gm_notes` is selectable by the GM only.
- Relationships: `game`, `inviter`, `accepted_player`.

## Entity: Notification (in `GameNight.Notifications`)

A polymorphic in-app entry shown to a single user. Today only one
kind exists (`:game_invitation`); the schema is shaped for future
kinds.

### Attributes

| Name            | Type                  | Nullable | Public? | Constraints / Notes                                                                       |
|-----------------|-----------------------|----------|---------|-------------------------------------------------------------------------------------------|
| `id`            | `uuid`                | no       | yes     | Primary key.                                                                              |
| `user_id`       | `uuid`                | no       | no      | FK to `users.id`. The recipient.                                                          |
| `kind`          | `atom`                | no       | yes     | `constraints one_of: [:game_invitation]`. Discriminator for SPA renderers.                |
| `subject_type`  | `string`              | no       | yes     | Free-form; `"invitation"` for v1.                                                         |
| `subject_id`    | `uuid`                | no       | yes     | The id of the subject row (no FK — polymorphic).                                          |
| `read_at`       | `utc_datetime_usec`   | yes      | yes     | Set when the user marks the notification read; null otherwise.                            |
| `resolved_at`   | `utc_datetime_usec`   | yes      | yes     | Set when the underlying subject is resolved (accept/decline/revoke).                      |
| `inserted_at`   | `utc_datetime_usec`   | no       | yes     | `create_timestamp`.                                                                       |
| `updated_at`    | `utc_datetime_usec`   | no       | yes     | `update_timestamp`.                                                                       |

### Relationships

| Name   | Type         | Target                       | Required | Notes                                                          |
|--------|--------------|------------------------------|----------|----------------------------------------------------------------|
| `user` | `belongs_to` | `GameNight.Accounts.User`    | yes      | FK attribute `user_id`. Cascade delete on user removal.        |

### Postgres

```elixir
postgres do
  table "notifications"
  repo GameNight.Repo

  references do
    reference :user, on_delete: :delete
  end

  custom_indexes do
    index [:user_id, :resolved_at, :inserted_at],
      name: "notifications_user_resolved_inserted_index"
  end
end
```

### Actions

| Name              | Type      | Args                                                | Notes                                                                                                  |
|-------------------|-----------|-----------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `:list_mine`      | `read`    | optional `argument :unread_only, :boolean, default: false` | Filters `user_id == ^actor(:id)`; if `unread_only`, also filters `is_nil(resolved_at) and is_nil(read_at)`. Sort `inserted_at DESC`. |
| `:count_unread`   | `read`    | —                                                   | `aggregate :count` over the filtered relation. Drives the bell badge.                                  |
| `:mark_read`      | `update`  | `[:read_at]`                                        | Sets `read_at` to `now()` if null; admits actor for own row only.                                      |
| `:create_for_invitation` | `create` | `[:user_id, :kind, :subject_type, :subject_id]`  | **System action** — only callable from `GameNight.Notifications.System` with `authorize?: false`.       |
| `:resolve_for_subject`   | `update` | `argument :subject_type, :string`, `argument :subject_id, :uuid` | **System action** — sets `resolved_at` for any matching row. Bypassed authorisation; called from Invitation transitions. |

### Policies

```elixir
policies do
  bypass actor_attribute_equals(:_internal?, true) do
    # Marker actor for system actions invoked from the notifications
    # context module. This is the documented exception per
    # constitution Principle II.
    authorize_if always()
  end

  policy action(:list_mine) do
    authorize_if expr(user_id == ^actor(:id))
  end

  policy action(:count_unread) do
    authorize_if expr(user_id == ^actor(:id))
  end

  policy action(:mark_read) do
    authorize_if expr(user_id == ^actor(:id))
  end

  policy action_type(:read) do
    authorize_if expr(user_id == ^actor(:id))
  end
end
```

The `_internal?` marker actor is a struct
(`%GameNight.Notifications.System.Actor{_internal?: true}`) used
only by the system context. Tests assert that an external caller
constructing this struct directly is still rejected by every policy
that does not name `bypass actor_attribute_equals(:_internal?, true)`
— in practice, only `:create_for_invitation` and
`:resolve_for_subject` admit it.

### Invariants

- One Notification per `(user_id, subject_type, subject_id, kind)` —
  enforced by an Ash identity + partial unique index. The system
  action is idempotent: re-calling `create_for_invitation` for an
  existing notification is a no-op (`upsert? true`).

## Updated entity: `GameNight.Games.Game`

### Relationships (added)

| Name           | Type        | Target                          | Notes                                                  |
|----------------|-------------|---------------------------------|--------------------------------------------------------|
| `players`      | `has_many`  | `GameNight.Games.Player`        | FK `game_id`. Drives the cross-resource read policy.   |
| `invitations`  | `has_many`  | `GameNight.Games.Invitation`    | FK `game_id`.                                          |

### Policies (changed)

```elixir
policies do
  policy action_type(:read) do
    authorize_if expr(owner_id == ^actor(:id))
    authorize_if expr(exists(players, user_id == ^actor(:id)))
  end

  policy action(:register) do
    authorize_if actor_present()
  end

  policy action_type([:update, :destroy]) do
    authorize_if expr(owner_id == ^actor(:id))
  end
end
```

The `:list_mine_active` and `:list_mine` actions retain their
`prepare build(filter: [owner_id: …])` chain unchanged — only
`:get_mine` newly admits accepted players.

## Migration order

`mix ash.codegen` will generate three migrations. The expected
dependency order (so the generated migrations can be applied without
hand-editing):

1. `players` — references `games` (existing) and `users` (existing).
2. `invitations` — references `games`, `users`, and `players`
   (created in step 1; the `accepted_player_id` FK is nullable so
   the dependency order is not strictly required, but Ash will
   emit them in a deterministic order).
3. `notifications` — references only `users`.

Run order is enforced by Ecto migration timestamps; we let
`mix ash.codegen` produce them and commit unchanged.

## Cross-references

- JSON:API contract: [contracts/json-api.md](./contracts/json-api.md)
- RPC contract: [contracts/rpc.md](./contracts/rpc.md)
- Token strategy: [research.md §2](./research.md)
- Notification materialisation: [research.md §3](./research.md)
- Game.read expansion: [research.md §4](./research.md)
- gm_notes privacy: [research.md §5](./research.md)
