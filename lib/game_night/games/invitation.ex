defmodule GameNight.Games.Invitation do
  @moduledoc """
  A pending offer from a GM to an email address, carrying GM-provided
  character data that becomes a `Player` record on acceptance.

  Skeleton resource for feature 002 (Invite Players) — declares the
  schema, relationships, postgres references, identities (including
  the partial-unique constraint on `(game_id, email)` for open
  invitations), and the base `:read` action with a deny-by-default
  policy. Story phases add the named actions
  (`:create_for_game`, `:list_pending_for_game`, `:list_pending_for_me`,
  `:preview_with_token`, `:accept_with_token`, `:decline_with_token`,
  `:revoke`), the `:visible_gm_notes` calculation, and the field
  policy on `gm_notes`.

  See `specs/002-invite-players/data-model.md` §Invitation for the
  full attribute and policy tables, and §2 of `research.md` for the
  AshAuthentication-backed token strategy.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Games,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @statuses [:pending, :accepted, :declined, :revoked]

  def statuses, do: @statuses

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

    # Required by ash_postgres so the migration generator emits a
    # partial unique index matching the `:unique_game_email_open`
    # identity. The SQL fragment is the WHERE clause appended to the
    # generated `CREATE UNIQUE INDEX` statement.
    identity_wheres_to_sql unique_game_email_open: "status IN ('pending', 'accepted')"
  end

  typescript do
    type_name "Invitation"
  end

  actions do
    defaults [:read]
  end

  policies do
    # Base `:read` policy — the GM of the invitation's game and the
    # invited recipient (matched by email) can read. Story phases add
    # per-action policies on top of this for the named actions.
    policy action_type(:read) do
      authorize_if expr(game.owner_id == ^actor(:id))
      authorize_if expr(email == ^actor(:email))
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :email, :ci_string do
      allow_nil? false
      public? true
    end

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

    # Private — `public? false`; `:visible_gm_notes` calculation
    # (added in US3) gates by GM-ness via field policy.
    attribute :gm_notes, :string do
      allow_nil? true
      public? false
      constraints max_length: 4000
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :pending
      constraints one_of: @statuses
    end

    # JTI of the AshAuthentication token minted on creation. Used to
    # revoke on `:revoke` / `:accept_with_token` / `:decline_with_token`.
    # Not exposed on the public contract — the token itself only ever
    # lives in the email URL.
    attribute :token_jti, :string do
      allow_nil? false
      public? false
    end

    attribute :expires_at, :utc_datetime_usec do
      allow_nil? false
      public? true
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

    belongs_to :inviter, GameNight.Accounts.User do
      allow_nil? false
      public? false
      attribute_writable? true
    end

    belongs_to :accepted_player, GameNight.Games.Player do
      allow_nil? true
      public? false
      attribute_writable? true
    end
  end

  identities do
    # Spec edge case "duplicate email on same game" — block adding a
    # second `:pending` or `:accepted` invitation for the same email
    # on the same game. Terminal `:declined`/`:revoked` rows are
    # excluded from the partial index so the GM can re-invite after
    # closing a previous attempt.
    identity :unique_game_email_open, [:game_id, :email] do
      where expr(status in [:pending, :accepted])
    end
  end
end
