defmodule GameNight.Schedules.ScheduleParticipant do
  @moduledoc """
  Links a player's character (`GameNight.Games.Player`) to a
  `Schedule`. One row per (Schedule, Player).

  `np_only?` is `true` when the participant joined a schedule that
  was already `:posted` — every `participant_day` is `:NP` and the
  calendar is read-only/grayed for that participant.
  `is_late_join?` is `true` for any participant linked after the
  schedule transitioned to `:ready_for_availability` (for telemetry).

  The `player_id` FK is `ON DELETE RESTRICT` — Player removal is
  intercepted by `GameNight.Schedules.System.handle_player_destroy/1`
  so non-posted schedules' participants cascade-delete while posted
  schedules' participants are preserved with `np_only?: true`.
  See `specs/003-game-schedule/data-model.md` §ScheduleParticipant
  Player-removal handling.

  Skeleton for Phase 2 (Foundational). Story phases add the named
  actions.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Schedules,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "schedule_participants"
    repo GameNight.Repo

    references do
      reference :schedule, on_delete: :delete
      reference :player, on_delete: :restrict
    end

    custom_indexes do
      index [:schedule_id, :np_only, :submitted_at, :joined_at],
        name: "schedule_participants_roster_index"

      index [:player_id, :schedule_id],
        name: "schedule_participants_player_schedule_index"
    end
  end

  json_api do
    type "schedule_participant"

    routes do
      base "/schedule_participants"

      patch :set_submission, route: "/:id/set-submission"
    end
  end

  typescript do
    type_name "ScheduleParticipant"
  end

  actions do
    defaults [:read, :destroy, create: :*, update: :*]

    update :set_submission do
      description """
      Mark the participant as having submitted their availability
      (FR-021). Idempotent — re-calling preserves the original
      `submitted_at`. All-NA submissions count: the action does not
      check whether any per-day rows differ from the default
      (research.md §18).
      """
      accept []
      require_atomic? false

      change fn changeset, _ctx ->
        case Ash.Changeset.get_data(changeset, :submitted_at) do
          nil -> Ash.Changeset.force_change_attribute(changeset, :submitted_at, DateTime.utc_now())
          _ -> changeset
        end
      end
    end
  end

  policies do
    bypass actor_attribute_equals(:_internal?, true) do
      authorize_if always()
    end

    policy action(:set_submission) do
      authorize_if expr(player.user_id == ^actor(:id))
      forbid_if expr(np_only == true)
      forbid_if expr(schedule.status != :ready_for_availability)
    end

    # Reads admit the GM (for the roster) and the linked player
    # themselves (for their own submission).
    policy action_type(:read) do
      authorize_if expr(schedule.game.owner_id == ^actor(:id))
      authorize_if expr(player.user_id == ^actor(:id))
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :is_late_join, :boolean do
      allow_nil? false
      public? true
      default false
    end

    attribute :np_only, :boolean do
      allow_nil? false
      public? true
      default false
    end

    attribute :submitted_at, :utc_datetime_usec do
      allow_nil? true
      public? true
    end

    attribute :joined_at, :utc_datetime_usec do
      allow_nil? false
      public? true
      default &DateTime.utc_now/0
    end

    create_timestamp :inserted_at, public?: true
    update_timestamp :updated_at, public?: true
  end

  relationships do
    belongs_to :schedule, GameNight.Schedules.Schedule do
      allow_nil? false
      public? false
      attribute_writable? true
    end

    belongs_to :player, GameNight.Games.Player do
      allow_nil? false
      public? false
      attribute_writable? true
    end

    has_many :participant_days, GameNight.Schedules.ParticipantDay do
      destination_attribute :participant_id
    end
  end

  identities do
    identity :unique_per_schedule_player, [:schedule_id, :player_id]
  end
end
