defmodule GameNight.Games.Game do
  @moduledoc """
  A registered game-night context owned by a Game Master (User).

  Every action is deny-by-default and scoped to the actor's own rows
  via `expr(owner_id == ^actor(:id))`. `:register` uses `actor_present/0`
  + `relate_actor(:owner)` to set ownership atomically on create.
  `owner_id` is immutable after create (excluded from `:update` accept).

  See `specs/001-register-game/data-model.md` for the attribute,
  action, and policy tables, and `research.md §5` for the policy
  rationale.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Games,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @statuses [:active, :paused, :cancelled, :completed]

  def statuses, do: @statuses

  postgres do
    table "games"
    repo GameNight.Repo

    references do
      reference :owner, on_delete: :delete
    end

    custom_indexes do
      index [:owner_id, :status, :updated_at],
        name: "games_owner_status_updated_at_index"
    end
  end

  json_api do
    type "game"

    routes do
      base "/games"

      index :list_mine_active, route: "/active"
      index :list_mine, route: "/all"
      get :get_mine, route: "/:id"
      post :register
      patch :update
      delete :destroy
    end
  end

  typescript do
    type_name "Game"
  end

  actions do
    defaults [:read]

    read :list_mine_active do
      description "Return the actor's games whose status is Active, newest-updated first."
      prepare build(filter: [status: :active], sort: [updated_at: :desc])
    end

    read :list_mine do
      description "Return every one of the actor's games, regardless of status."
      prepare build(sort: [updated_at: :desc])
    end

    read :get_mine do
      description "Fetch one of the actor's games by id. Cross-tenant access returns not-found."
      get? true

      argument :id, :uuid do
        allow_nil? false
      end

      filter expr(id == ^arg(:id))
    end

    create :register do
      description "Register a new game owned by the current actor."
      accept [:title, :description, :status]
      change relate_actor(:owner)
    end

    update :update do
      description "Update a game's editable attributes. owner_id is excluded and immutable."
      accept [:title, :description, :status]
      require_atomic? true
    end

    destroy :destroy do
      description "Hard-delete a game. The owner-scoped policy gates access."
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if expr(owner_id == ^actor(:id))
    end

    policy action(:register) do
      authorize_if actor_present()
    end

    policy action_type([:update, :destroy]) do
      authorize_if expr(owner_id == ^actor(:id))
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      constraints min_length: 1, max_length: 120
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      constraints max_length: 2000
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
    belongs_to :owner, GameNight.Accounts.User do
      allow_nil? false
      public? false
      attribute_writable? true
    end
  end
end
