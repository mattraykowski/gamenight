defmodule GameNight.Schedules.ScheduleDay do
  @moduledoc """
  One row per (Schedule, day-of-month). Holds the GM's per-day
  availability and the GM's per-day Final decision (post-Scheduling-View).

  Skeleton resource for Phase 2 (Foundational) — declares the
  schema, identities, and `belongs_to :schedule` only. Story phases
  add the actions (`:set_gm_status`, `:set_final_status`),
  calculations (`:final_note_kind`, `:final_note_label`,
  `:gm_locked_na`), and the field policy on `gm_status`.

  See `specs/003-game-schedule/data-model.md` §ScheduleDay.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Schedules,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @gm_statuses [:NA, :I, :A, :IF]
  @final_statuses [:NA, :A]

  def gm_statuses, do: @gm_statuses
  def final_statuses, do: @final_statuses

  postgres do
    table "schedule_days"
    repo GameNight.Repo

    references do
      reference :schedule, on_delete: :delete
    end

    custom_indexes do
      index [:schedule_id, :day], name: "schedule_days_schedule_day_index"
    end
  end

  json_api do
    type "schedule_day"

    default_fields [
      :id,
      :schedule_id,
      :day,
      :gm_status,
      :final_status,
      :inserted_at,
      :updated_at
    ]

    routes do
      base "/schedule_days"
    end
  end

  typescript do
    type_name "ScheduleDay"
  end

  actions do
    defaults [:read, :destroy, create: :*, update: :*]
  end

  policies do
    bypass actor_attribute_equals(:_internal?, true) do
      authorize_if always()
    end

    # US1 + US3 — read admits the GM and any linked player on a
    # non-:preparing schedule. The field policy on `gm_status` below
    # strips the raw GM status from non-GM payloads — the
    # `gm_locked_na` calculation is what the player view consumes.
    policy action_type(:read) do
      authorize_if expr(schedule.game.owner_id == ^actor(:id))
      authorize_if expr(
                     exists(schedule.participants, player.user_id == ^actor(:id)) and
                       schedule.status != :preparing
                   )
    end
  end

  field_policies do
    # gm_status is GM-only. Non-GM readers get nil; the
    # `gm_locked_na` calculation is the supported player-side field.
    field_policy :gm_status do
      authorize_if expr(schedule.game.owner_id == ^actor(:id))
    end

    # Catch-all so the rest of the public surface stays readable for
    # everyone who passes the row-level read policy above.
    field_policy :* do
      authorize_if always()
    end
  end

  calculations do
    # Player-safe view of the GM's per-day status — exposes only
    # whether the day is locked NA, not the actual gm_status atom.
    calculate :gm_locked_na, :boolean, expr(gm_status == :NA) do
      public? true
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :day, :integer do
      allow_nil? false
      public? true
      constraints min: 1, max: 31
    end

    attribute :gm_status, :atom do
      allow_nil? false
      public? true
      default :NA
      constraints one_of: @gm_statuses
    end

    attribute :final_status, :atom do
      allow_nil? true
      public? true
      constraints one_of: @final_statuses
    end

    create_timestamp :inserted_at, public?: true
    update_timestamp :updated_at, public?: true
  end

  relationships do
    belongs_to :schedule, GameNight.Schedules.Schedule do
      allow_nil? false
      public? true
      attribute_writable? true
    end
  end

  identities do
    identity :unique_per_schedule_day, [:schedule_id, :day]
  end
end
