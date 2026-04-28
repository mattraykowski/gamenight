defmodule GameNight.Schedules.Changes.ComputeFinalDefault do
  @moduledoc """
  Ash change attached to `Schedule.post`. After the schedule has
  flipped to `:posted`, fills any null `final_status` per the
  truth-table rule:

    * `:good_day` day → `final_status: :A`
    * everything else → `final_status: :NA`

  Days the GM has explicitly set via `:update_final_days` (the
  pre-post per-cell editor in the Scheduling View) are preserved —
  this change only fills the still-null cells.
  """
  use Ash.Resource.Change

  require Ash.Query

  alias GameNight.Schedules.ScheduleDay
  alias GameNight.Schedules.ScheduleDay.Calculations.FinalNote

  @impl true
  def change(changeset, _opts, _context) do
    Ash.Changeset.after_action(changeset, fn _changeset, schedule ->
      case fill_final_defaults(schedule) do
        :ok -> {:ok, schedule}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  defp fill_final_defaults(schedule) do
    # Only days with no GM-set final_status are touched; the others
    # keep whatever the GM picked during the Scheduling View flow.
    pending =
      ScheduleDay
      |> Ash.Query.filter(schedule_id == ^schedule.id and is_nil(final_status))
      |> Ash.read!(authorize?: false)

    Enum.reduce_while(pending, :ok, fn day, _acc ->
      {kind, _names} = FinalNote.compute(day)
      target = if kind == :good_day, do: :A, else: :NA

      result =
        day
        |> Ash.Changeset.for_update(:set_final_status, %{final_status: target},
          actor: GameNight.Schedules.System.actor()
        )
        |> Ash.update()

      case result do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end
end
