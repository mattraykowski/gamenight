defmodule GameNight.Games.Player do
  @moduledoc """
  A user seated at a Game with character data the GM controls.

  Skeleton resource for feature 002 (Invite Players) — declares the
  schema, relationships, postgres references, identity, indexes, and
  the base `:read` action with a deny-by-default policy. Story phases
  add the named read actions (`:list_for_game`, `:list_for_gm`,
  `:list_mine`), the `:update` action, the `:visible_gm_notes`
  calculation, and the field policy on `gm_notes`.

  See `specs/002-invite-players/data-model.md` §Player for the full
  attribute and policy tables.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Games,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @statuses [:active, :inactive, :done]

  def statuses, do: @statuses

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

  json_api do
    type "player"

    routes do
      base "/players"

      # Roster — admits GM and seated players.
      index :list_for_game, route: "/by-game/:game_id"

      # GM-only roster + visible_gm_notes. `default_fields` includes
      # the calculation in the response attributes (default
      # serialisation only emits attributes; calcs ride along when
      # explicitly listed).
      index :list_for_gm,
        route: "/by-game/:game_id/gm",
        default_fields: [
          :character_name,
          :character_summary,
          :status,
          :visible_gm_notes
        ]

      # The actor's own player rows across every game.
      index :list_mine, route: "/mine"

      # GM-only edit.
      patch :update
    end
  end

  field_policies do
    # `visible_gm_notes` is the only path to `gm_notes`; admit only
    # the GM. Non-GM callers see `null` even if they explicitly
    # request the field via sparse fieldsets — that's the SC-005
    # zero-leak guarantee.
    field_policy :visible_gm_notes do
      authorize_if expr(game.owner_id == ^actor(:id))
    end

    # Once any `field_policy` is declared, Ash requires every public
    # field to be covered. The action-level policies above already
    # gate access to the resource as a whole; this catch-all
    # delegates field-level authorisation to those — anyone who can
    # read the row can read every other field on it.
    field_policy :* do
      authorize_if always()
    end
  end

  typescript do
    type_name "Player"
  end

  actions do
    defaults [:read]

    # Internal create — invoked from `Invitation.accept_with_token`
    # via `authorize?: false`. Not exposed to JSON:API or RPC. The
    # `upsert?` semantics make double-accept idempotent: if a Player
    # already exists for `(game_id, user_id)`, the existing row is
    # returned unchanged (we deliberately do NOT overwrite the GM's
    # current character data on a re-accept of a stale token).
    create :create do
      accept [:game_id, :user_id, :character_name, :character_summary, :gm_notes, :status]
      upsert? true
      upsert_identity :unique_game_user
      upsert_fields []

      # Feature 003 (T063) — when a Player accepts an invitation
      # (Invitation.accept_with_token calls this action) and the
      # game has open schedules already in :ready_for_availability,
      # link them retroactively. No-op for fresh games with no
      # schedules. The hook is :ok-or-no-op — schedule failures
      # don't block player creation.
      change after_action(fn _changeset, player, _ctx ->
               GameNight.Schedules.System.link_player_to_open_schedules(
                 player.game_id,
                 player
               )

               {:ok, player}
             end)
    end

    # Feature 003 (T020.5) — Player removal cascades into the
    # Schedules domain via a before_action. The FK on
    # `schedule_participants.player_id` is `ON DELETE RESTRICT` so
    # the schedule cascade MUST run before the row is destroyed —
    # otherwise the DB rejects the destroy.
    #
    # Phase 2 stub: `handle_player_destroy/1` is a no-op; the
    # three-branch behavior (destroy participants for non-posted
    # schedules / preserve with NP for posted) lands in T151.5
    # (US9). Until then, destroying a player who is linked to any
    # schedule will fail at the DB level with an FK violation —
    # which is the documented intermediate state.
    destroy :destroy do
      # The before_action hook calls into the Schedules domain to
      # cascade conditionally — non-atomic by nature.
      require_atomic? false

      change before_action(fn changeset, _ctx ->
               case GameNight.Schedules.System.handle_player_destroy(changeset.data) do
                 :ok -> changeset
                 {:error, reason} -> Ash.Changeset.add_error(changeset, reason)
               end
             end)
    end

    read :list_for_game do
      description """
      The roster for a specific game. Admits the GM and any user
      who is a seated player on the game. Excludes `gm_notes` from
      the default serialisation; the `visible_gm_notes` calculation
      is the only path to the field and is itself GM-gated.
      """

      argument :game_id, :uuid, allow_nil?: false

      prepare build(filter: expr(game_id == ^arg(:game_id)), sort: [updated_at: :desc])
    end

    read :list_for_gm do
      description """
      GM-only roster read that also loads the `visible_gm_notes`
      calculation. Identical row set to `:list_for_game` (so GM and
      players see the same Player records); the difference is the
      additional GM-private field.
      """

      argument :game_id, :uuid, allow_nil?: false

      prepare build(
                filter: expr(game_id == ^arg(:game_id)),
                sort: [updated_at: :desc],
                load: [:visible_gm_notes]
              )
    end

    read :list_mine do
      description """
      The current actor's own Player records across every game.
      Drives the dashboard's "My Characters" column and the
      `/characters` route (US5). Sort newest-touched first.
      """

      prepare build(filter: expr(user_id == ^actor(:id)), sort: [updated_at: :desc])
    end

    update :update do
      description "GM-only edit of a player's character data and status."
      accept [:character_name, :character_summary, :gm_notes, :status]
      require_atomic? true
    end
  end

  policies do
    # `:list_for_game` — GM of the game OR a user who is themselves a
    # seated player on the same game.
    policy action(:list_for_game) do
      authorize_if expr(game.owner_id == ^actor(:id))
      authorize_if expr(exists(game.players, user_id == ^actor(:id)))
    end

    # `:list_for_gm` — GM only. The action loads `visible_gm_notes`
    # which is itself field-policy-gated; the action policy is the
    # outer ring of the defence-in-depth posture.
    policy action(:list_for_gm) do
      authorize_if expr(game.owner_id == ^actor(:id))
    end

    # `:list_mine` — actor reads their own player rows.
    policy action(:list_mine) do
      authorize_if expr(user_id == ^actor(:id))
    end

    # `:update` — GM only.
    policy action(:update) do
      authorize_if expr(game.owner_id == ^actor(:id))
    end

    # Base `:read` policy (and any other read action that doesn't
    # have its own policy block). Admits the GM of the player's
    # game OR the user the player record belongs to.
    policy action_type(:read) do
      authorize_if expr(game.owner_id == ^actor(:id))
      authorize_if expr(user_id == ^actor(:id))
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :character_name, :string do
      allow_nil? false
      public? true
      constraints min_length: 1, max_length: 120
    end

    attribute :character_summary, :string do
      allow_nil? true
      public? true
      constraints max_length: 4000
    end

    # Private — `public? false` keeps `gm_notes` out of every default
    # JSON:API and RPC serialisation. The `:list_for_gm` action (added
    # in US3) loads it via the `:visible_gm_notes` calculation, which
    # is itself field-policy-gated as defence in depth (research.md §5).
    attribute :gm_notes, :string do
      allow_nil? true
      public? false
      constraints max_length: 4000
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :active
      constraints one_of: @statuses
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :game, GameNight.Games.Game do
      allow_nil? false
      public? false
      attribute_writable? true
    end

    belongs_to :user, GameNight.Accounts.User do
      allow_nil? false
      public? false
      attribute_writable? true
    end
  end

  calculations do
    # GM-gated view of `gm_notes`. The expression returns the
    # underlying value; the matching `field_policy :visible_gm_notes`
    # above is the access gate — Ash returns `nil` to non-GM
    # callers for `forbidden_field`, satisfying SC-005's zero-leak
    # guarantee.
    calculate :visible_gm_notes, :string, expr(gm_notes) do
      public? true
    end
  end

  identities do
    # FR-014 — at most one Player per (game, user). The unique index
    # is the authoritative gate; application-level checks would race.
    identity :unique_game_user, [:game_id, :user_id]
  end
end
