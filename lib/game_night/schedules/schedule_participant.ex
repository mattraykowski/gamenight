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

    # Include the FK columns in the default response so the SPA can
    # identify "my participant" by player_id without having to load
    # the (private) belongs_to :player relationship. Mirrors the
    # `default_fields` pattern Schedule uses for game_id.
    default_fields [
      :id,
      :schedule_id,
      :player_id,
      :is_late_join,
      :np_only,
      :submitted_at,
      :joined_at,
      :inserted_at,
      :updated_at
    ]

    routes do
      base "/schedule_participants"

      patch :set_submission, route: "/:id/set-submission"
      patch :send_reminder, route: "/:id/send-reminder"
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

    update :send_reminder do
      description """
      GM-only — fan out a `:schedule_reminder` notification + email
      to the participant. Excluded for already-submitted
      participants (`submitted_at` set) and for `np_only`
      participants. No rate limit (FR-038) — every call materialises
      another row.
      """
      accept []
      require_atomic? false

      change after_action(fn _changeset, participant, _ctx ->
               loaded =
                 Ash.load!(participant,
                   [player: [:user], schedule: [game: [:owner]]],
                   authorize?: false
                 )

               case GameNight.Schedules.System.fan_out_notification(
                      loaded.schedule,
                      :schedule_reminder,
                      [loaded]
                    ) do
                 :ok -> {:ok, loaded}
                 {:error, reason} -> {:error, reason}
               end
             end)
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

    # FR-037 / FR-038 — GM-only reminders. Excluded for
    # already-submitted (submitted_at not nil) and np_only
    # participants. The action body itself doesn't gate; the
    # policy does.
    policy action(:send_reminder) do
      forbid_if expr(np_only == true)
      forbid_if expr(not is_nil(submitted_at))
      authorize_if expr(schedule.game.owner_id == ^actor(:id))
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
      # public? true so the FK column `schedule_id` appears in the
      # generated ash_typescript schema and the SPA can request it
      # in `fields`. The related Schedule resource still loads only
      # when explicitly requested as a nested field.
      public? true
      attribute_writable? true
    end

    belongs_to :player, GameNight.Games.Player do
      allow_nil? false
      # See note on :schedule above. ScheduleParticipant's read
      # policy already gates who can read the row at all; making the
      # belongs_to public only exposes the player_id FK column, not
      # the Player resource.
      public? true
      attribute_writable? true
    end

    has_many :participant_days, GameNight.Schedules.ParticipantDay do
      public? true
      destination_attribute :participant_id
    end
  end

  identities do
    identity :unique_per_schedule_player, [:schedule_id, :player_id]
  end
end
