defmodule GameNight.Schedules.ParticipantDay.Validations.SetStatusAllowed do
  @moduledoc """
  Validation attached to `ParticipantDay.set_status` enforcing the
  three rejection branches from the spec:

  1. NP-only participants can never set their per-day status.
  2. The parent schedule must be `:ready_for_availability` (FR-024).
  3. The matching `ScheduleDay.gm_status` must NOT be `:NA`
     (the GM-locked-NA rule from FR-019).

  Plain-language messages per Constitution Principle V.
  """
  use Ash.Resource.Validation

  require Ash.Query

  @impl true
  def validate(changeset, _opts, _context) do
    case changeset.data do
      %{__struct__: GameNight.Schedules.ParticipantDay} = pd ->
        with {:ok, pd} <-
               Ash.load(pd, [participant: [:schedule], schedule: []], authorize?: false) do
          cond do
            pd.participant.np_only == true ->
              {:error, field: :status, message: "This day is read-only."}

            pd.schedule.status != :ready_for_availability ->
              {:error,
               field: :status,
               message:
                 "You can't change availability on a schedule that isn't open for input."}

            gm_na?(pd.participant.schedule_id, pd.day) ->
              {:error,
               field: :status,
               message: "The GM marked this day Not Available."}

            true ->
              :ok
          end
        else
          _ ->
            {:error,
             field: :status, message: "could not load participant context for validation"}
        end

      _ ->
        :ok
    end
  end

  defp gm_na?(schedule_id, day) do
    case GameNight.Schedules.ScheduleDay
         |> Ash.Query.filter(schedule_id == ^schedule_id and day == ^day)
         |> Ash.read_one(authorize?: false) do
      {:ok, %{gm_status: :NA}} -> true
      _ -> false
    end
  end
end
