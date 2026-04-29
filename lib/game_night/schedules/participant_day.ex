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

    default_fields [
      :id,
      :participant_id,
      :schedule_id,
      :day,
      :status,
      :inserted_at,
      :updated_at
    ]

    routes do
      base "/participant_days"

      patch :set_status, route: "/:id/set-status"
    end
  end

  typescript do
    type_name "ParticipantDay"
  end

  actions do
    # Foundational system-actor defaults; the validation on
    # :set_status forces non-atomic update mode for that named
    # action, which doesn't propagate to the catch-all :update.
    defaults [:read, :destroy, create: :*]

    update :update do
      accept [:day, :status, :participant_id, :schedule_id]
      require_atomic? false
    end

    update :set_status do
      description """
      The participant's per-day availability toggle. Restricted to
      the participant's user; the parent schedule must be in
      `:ready_for_availability` (FR-024 — posted schedules are
      read-only). NP-only participants can never call this; the
      schedule's per-day GM-NA lock also denies the call.
      """

      accept []
      require_atomic? false

      argument :status, :atom, allow_nil?: false, constraints: [one_of: [:NA, :I, :A, :IF]]

      validate {GameNight.Schedules.ParticipantDay.Validations.SetStatusAllowed, []}

      change set_attribute(:status, arg(:status))
    end

    update :bulk_set_to_na do
      description """
      System-only — overwrite per-day status to :NA. Called by the
      `Schedules.System.cascade_gm_na/3` flow when a GM flips a day
      to NA on a `:ready_for_availability` schedule.
      """
      accept []
      require_atomic? false

      change set_attribute(:status, :NA)
    end

    update :bulk_set_to_np do
      description """
      System-only — overwrite per-day status to :NP. Called when a
      late-joining player is linked to a `:posted` schedule (US9)
      or when an existing player is removed from a game and their
      `ScheduleParticipant` rows on `:posted` schedules are
      preserved as np_only.
      """
      accept []
      require_atomic? false

      change set_attribute(:status, :NP)
    end
  end

  policies do
    bypass actor_attribute_equals(:_internal?, true) do
      authorize_if always()
    end

    # Reads admit the schedule's GM (for the Scheduling View) and
    # the participant's own user (for their per-character schedule
    # view). Status-write is gated separately by :set_status.
    policy action_type(:read) do
      authorize_if expr(participant.schedule.game.owner_id == ^actor(:id))
      authorize_if expr(participant.player.user_id == ^actor(:id))
    end

    policy action(:set_status) do
      authorize_if expr(participant.player.user_id == ^actor(:id))
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
      # public? true so the participant_id FK is selectable via
      # `fields`. The participant row itself is still gated by
      # ScheduleParticipant's policies.
      public? true
      attribute_writable? true
    end

    belongs_to :schedule, GameNight.Schedules.Schedule do
      allow_nil? false
      public? true
      attribute_writable? true
    end
  end

  identities do
    identity :unique_per_participant_day, [:participant_id, :day]
  end

  @doc false
  def gm_na_for_day?(schedule_id, day) do
    require Ash.Query

    case GameNight.Schedules.ScheduleDay
         |> Ash.Query.filter(schedule_id == ^schedule_id and day == ^day)
         |> Ash.read_one(authorize?: false) do
      {:ok, %{gm_status: :NA}} -> true
      _ -> false
    end
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
