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

  typescript do
    type_name "Player"
  end

  actions do
    defaults [:read]
  end

  policies do
    # Base `:read` policy — admits the GM of the player's game OR the
    # user the player record belongs to. Story phases add per-action
    # policies on top of this for `:list_for_game`, `:list_for_gm`,
    # `:list_mine`, and `:update`.
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

  identities do
    # FR-014 — at most one Player per (game, user). The unique index
    # is the authoritative gate; application-level checks would race.
    identity :unique_game_user, [:game_id, :user_id]
  end
end
