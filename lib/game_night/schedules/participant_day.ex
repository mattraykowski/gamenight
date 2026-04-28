defmodule GameNight.Schedules.ParticipantDay do
  @moduledoc """
  One row per (ScheduleParticipant, day-of-month). Holds the
  player's submitted availability for that day.

  `:NP` is the only status valid for `np_only?: true` participants
  (late-joiners on a `:posted` schedule). For all other
  participants, `:NP` is rejected.

  `schedule_id` is denormalised — the FK is duplicated from
  `participant.schedule_id` so per-schedule reads can hit a single
  index without joining `schedule_participants`. A validation
  guarantees `participant.schedule_id == schedule_id` on every
  insert/update.

  Skeleton for Phase 2 (Foundational). Story phases add the named
  actions and the validations.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Schedules,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @statuses [:NA, :I, :A, :IF, :NP]

  def statuses, do: @statuses

  postgres do
    table "participant_days"
    repo GameNight.Repo

    references do
      reference :participant, on_delete: :delete
      reference :schedule, on_delete: :delete
    end

    custom_indexes do
      index [:participant_id, :day], name: "participant_days_participant_day_index"
    end
  end

  json_api do
    type "participant_day"

    routes do
      base "/participant_days"
    end
  end

  typescript do
    type_name "ParticipantDay"
  end

  actions do
    defaults [:read, :destroy, create: :*, update: :*]
  end

  policies do
    bypass actor_attribute_equals(:_internal?, true) do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :day, :integer do
      allow_nil? false
      public? true
      constraints min: 1, max: 31
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :NA
      constraints one_of: @statuses
    end

    create_timestamp :inserted_at, public?: true
    update_timestamp :updated_at, public?: true
  end

  relationships do
    belongs_to :participant, GameNight.Schedules.ScheduleParticipant do
      allow_nil? false
      public? false
      attribute_writable? true
    end

    belongs_to :schedule, GameNight.Schedules.Schedule do
      allow_nil? false
      public? false
      attribute_writable? true
    end
  end

  identities do
    identity :unique_per_participant_day, [:participant_id, :day]
  end

  validations do
    # The denormalisation invariant — `participant.schedule_id`
    # must equal the row's `schedule_id`. Story phases tighten this
    # with explicit error messages.
    validate fn changeset, _context ->
      participant_id = Ash.Changeset.get_attribute(changeset, :participant_id)
      schedule_id = Ash.Changeset.get_attribute(changeset, :schedule_id)

      cond do
        is_nil(participant_id) or is_nil(schedule_id) ->
          :ok

        true ->
          case GameNight.Schedules.ScheduleParticipant
               |> Ash.get(participant_id, authorize?: false) do
            {:ok, %{schedule_id: ^schedule_id}} ->
              :ok

            {:ok, _} ->
              {:error,
               field: :schedule_id,
               message: "must match participant.schedule_id (denormalisation invariant)"}

            {:error, _} ->
              {:error, field: :participant_id, message: "is invalid"}
          end
      end
    end
  end
end
