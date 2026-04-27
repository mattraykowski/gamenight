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

  json_api do
    type "invitation"

    routes do
      base "/invitations"

      # GM-only — body carries email, character_name, character_summary,
      # gm_notes, plus the game relationship (so game_id is supplied
      # via the JSON:API relationship payload).
      post :create_for_game

      # Token-bearer auth (no actor required); returns a preview map
      # (game_title, inviter_email, character_name, expires_at).
      # Generic action exposed via `route` because JSON:API has no
      # native verb for "fetch by opaque token without resource id".
      route :get, "/preview/:token", :preview_with_token

      # Logged-in user accepts an invitation by id + token. Wired
      # to the generic `:accept_invitation` action (which calls
      # through to `:accept_with_token` internally) so the route
      # avoids a JSON:API load step that would 404 for invitees
      # whose email doesn't match the invitation's invited email.
      route :patch, "/:id/accept", :accept_invitation
    end
  end

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

    read :read_for_accept do
      description """
      Permissive load action used solely by the JSON:API
      `PATCH /:id/accept` route (`accept_with_token`). Admits any
      logged-in actor so a recipient whose primary email differs
      from the invitation's invited address can still accept via the
      link they hold. The token verification happens inside the
      `:accept_with_token` action's body — that is the actual
      authorization gate.
      """
      argument :id, :uuid, allow_nil?: false
      get? true
      filter expr(id == ^arg(:id))
    end

    create :create_for_game do
      description "GM creates an invitation for a game they own."
      accept [:character_name, :character_summary, :gm_notes]

      argument :email, :ci_string do
        allow_nil? false
      end

      argument :game_id, :uuid do
        allow_nil? false
      end

      # FR-003 — self-invite guard. A GM cannot invite their own
      # email address. Friendly error with the field set so JSON:API
      # surfaces it inline.
      validate fn changeset, _context ->
        actor = changeset.context[:private][:actor] || changeset.context[:actor]

        actor_email =
          case actor do
            %{email: email} -> email |> to_string() |> String.downcase()
            _ -> nil
          end

        arg_email =
          changeset
          |> Ash.Changeset.get_argument(:email)
          |> to_string()
          |> String.downcase()

        if actor_email && actor_email == arg_email do
          {:error, field: :email, message: "you cannot invite yourself"}
        else
          :ok
        end
      end

      change set_attribute(:email, arg(:email))
      change set_attribute(:game_id, arg(:game_id))
      # Use an expression rather than `relate_actor(:inviter)` so an
      # anonymous request (no actor) produces a clean validation
      # error (`inviter_id` is `allow_nil?: false`) rather than
      # raising during changeset construction. The policy below
      # would have rejected the anonymous request anyway, but Ash
      # evaluates changes first.
      change set_attribute(:inviter_id, expr(^actor(:id)))
      change GameNight.Games.Invitation.Changes.MintTokenAndDeliver
    end

    action :preview_with_token, :map do
      description "Preview an invitation by token; token-bearer auth, no actor required."

      argument :token, :string do
        allow_nil? false
        sensitive? true
      end

      # `:map` with explicit field constraints so `ash_typescript`
      # can emit a typed object shape for the SPA. Returning a plain
      # map (rather than a `defstruct`) keeps the action body
      # straightforward and avoids registering the Preview as an Ash
      # resource purely for its return type.
      constraints fields: [
                    id: [type: :uuid, allow_nil?: false],
                    game_title: [type: :string, allow_nil?: false],
                    inviter_email: [type: :string, allow_nil?: false],
                    character_name: [type: :string, allow_nil?: false],
                    expires_at: [type: :utc_datetime_usec, allow_nil?: false]
                  ]

      run GameNight.Games.Invitation.Actions.PreviewWithToken
    end

    update :accept_with_token do
      description "Accept an invitation using a valid token; creates the Player record."
      accept []

      argument :token, :string do
        allow_nil? false
        sensitive? true
      end

      require_atomic? false
      change GameNight.Games.Invitation.Changes.Accept
    end

    # Generic-action wrapper for the JSON:API `PATCH /:id/accept`
    # route. The bare `:accept_with_token` update action requires the
    # invitation to be loadable by the actor's policy, but the
    # invitee's email may differ from the invitation's email — see
    # research.md §2 ("token-bearer auth"). This wrapper sidesteps
    # the load step entirely: it accepts `id` + `token` as arguments,
    # loads internally with `authorize?: false`, and dispatches to
    # `:accept_with_token`. The action requires an actor — that IS
    # the JSON:API gate.
    action :accept_invitation, :map do
      argument :id, :uuid, allow_nil?: false
      argument :token, :string, allow_nil?: false, sensitive?: true

      constraints fields: [
                    id: [type: :uuid, allow_nil?: false],
                    status: [type: :atom, allow_nil?: false],
                    accepted_player_id: [type: :uuid, allow_nil?: true]
                  ]

      run GameNight.Games.Invitation.Actions.AcceptInvitation
    end
  end

  policies do
    # Base read — GM of the invitation's game OR the invited recipient
    # (matched by email).
    policy action_type(:read) do
      authorize_if expr(game.owner_id == ^actor(:id))
      authorize_if expr(email == ^actor(:email))
    end


    # GM-only create. The custom check inspects the changeset's
    # `:game_id` argument and verifies ownership against the Game
    # table directly.
    policy action(:create_for_game) do
      authorize_if GameNight.Games.Invitation.Policies.GameOwnedByActor
    end

    # Preview is token-bearer auth: any caller (including anonymous)
    # can resolve the preview by holding the token. The action's
    # body (`Actions.PreviewWithToken`) verifies the token signature,
    # expiration, and revocation status — that IS the authorization
    # gate.
    policy action(:preview_with_token) do
      authorize_if always()
    end

    # Accept requires an actor (any logged-in user). The token is
    # the proof-of-invitation; the action's `Changes.Accept` body
    # verifies it. We do NOT require the actor's email to match the
    # invitation's email — see research.md §2 ("token-bearer auth").
    policy action([:accept_with_token, :accept_invitation]) do
      authorize_if actor_present()
    end

    # `:read_for_accept` is the load step for the (deprecated)
    # `PATCH /:id/accept` JSON:API route variant. Retained for
    # internal use; the JSON:API surface now uses `:accept_invitation`
    # which has no separate load step.
    policy action(:read_for_accept) do
      authorize_if actor_present()
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
