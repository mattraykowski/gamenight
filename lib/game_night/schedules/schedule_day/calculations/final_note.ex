defmodule GameNight.Schedules.ScheduleDay.Calculations.FinalNote do
  @moduledoc """
  Ash calculation that loads the participants + their per-day rows
  for the same `(schedule_id, day)` and classifies the result via
  `Calculations.FinalNoteKind.classify/3`.

  Returns the kind atom only (`:good_day | :maybe | :maybe_with_if
  | :bad_day`); the human-readable label lives in the sibling
  `FinalNoteLabel` calculation so the two can be requested
  independently.
  """
  use Ash.Resource.Calculation

  require Ash.Query

  alias GameNight.Schedules.Calculations.FinalNoteKind
  alias GameNight.Schedules.ParticipantDay
  alias GameNight.Schedules.ScheduleParticipant

  @impl true
  def load(_query, _opts, _context), do: [:schedule_id, :day, :gm_status]

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn record ->
      {kind, _names} = compute(record)
      kind
    end)
  end

  @doc false
  def compute(%{schedule_id: schedule_id, day: day, gm_status: gm_status}) do
    {participant_statuses, if_names} = participant_data(schedule_id, day)
    FinalNoteKind.classify(gm_status, participant_statuses, if_names)
  end

  defp participant_data(schedule_id, day) do
    # Find the IF participant ids first so we can name them.
    participants =
      ScheduleParticipant
      |> Ash.Query.filter(schedule_id == ^schedule_id and np_only == false)
      |> Ash.Query.load(:player)
      |> Ash.read!(authorize?: false)

    days =
      ParticipantDay
      |> Ash.Query.filter(schedule_id == ^schedule_id and day == ^day)
      |> Ash.read!(authorize?: false)

    days_by_participant = Map.new(days, &{&1.participant_id, &1.status})

    statuses =
      participants
      |> Enum.map(&Map.get(days_by_participant, &1.id, :NA))
      |> Enum.reject(&(&1 == :NP))

    if_names =
      participants
      |> Enum.filter(&(Map.get(days_by_participant, &1.id) == :IF))
      |> Enum.map(&player_display_name(&1.player))

    {statuses, if_names}
  end

  defp player_display_name(%{character_name: name}) when is_binary(name) and name != "",
    do: name

  defp player_display_name(_), do: "a player"
end
