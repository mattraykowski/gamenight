defmodule GameNight.Schedules.Schedule do
  @moduledoc """
  One month's schedule for one `GameNight.Games.Game`.

  Holds the month/year/time-slot envelope and the lifecycle status
  (`:preparing` → `:ready_for_availability` → `:posted`). The display
  name (e.g. `"October 2026 7:00 PM – 11:00 PM"`) is derived via an
  Ash calculation rather than stored, per the user's directive.

  Skeleton resource for Phase 2 (Foundational) — declares the
  schema, identities, and `belongs_to :game` only. Story phases
  (US1 onwards) add the named actions, calculations, policies, and
  the JSON:API/RPC bindings.

  See `specs/003-game-schedule/data-model.md` §Schedule for the
  full attribute, action, and policy tables.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Schedules,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @statuses [:preparing, :ready_for_availability, :posted]

  def statuses, do: @statuses

  postgres do
    table "schedules"
    repo GameNight.Repo

    references do
      reference :game, on_delete: :delete
    end

    custom_indexes do
      index [:game_id, :year, :month],
        name: "schedules_game_year_month_index"
    end
  end

  json_api do
    type "schedule"

    routes do
      base "/schedules"
    end
  end

  typescript do
    type_name "Schedule"
  end

  actions do
    # Foundational stubs — story phases REPLACE these with the
    # constrained named actions from the data model.
    defaults [:read, :destroy, create: :*, update: :*]
  end

  policies do
    # Foundational stub — story phases add per-action policies.
    # Until then, allow internal actor for fixture/test setup only.
    bypass actor_attribute_equals(:_internal?, true) do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :month, :integer do
      allow_nil? false
      public? true
      constraints min: 1, max: 12
    end

    attribute :year, :integer do
      allow_nil? false
      public? true
      constraints min: 2024, max: 2100
    end

    attribute :start_time, :time do
      allow_nil? false
      public? true
    end

    attribute :end_time, :time do
      allow_nil? false
      public? true
    end

    attribute :time_zone, :string do
      allow_nil? false
      public? true
      constraints min_length: 1, max_length: 64
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :preparing
      constraints one_of: @statuses
    end

    attribute :posted_at, :utc_datetime_usec do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at, public?: true
    update_timestamp :updated_at, public?: true
  end

  relationships do
    belongs_to :game, GameNight.Games.Game do
      allow_nil? false
      public? false
      attribute_writable? true
    end

    has_many :schedule_days, GameNight.Schedules.ScheduleDay
    has_many :participants, GameNight.Schedules.ScheduleParticipant
  end

  identities do
    # FR-002: at most one schedule per game per month/year.
    identity :unique_per_game_month, [:game_id, :year, :month]
  end
end
