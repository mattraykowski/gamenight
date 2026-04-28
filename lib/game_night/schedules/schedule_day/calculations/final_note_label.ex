defmodule GameNight.Schedules.ScheduleDay.Calculations.FinalNoteLabel do
  @moduledoc """
  Sibling of `FinalNote`. Returns the human-readable label string
  ("Good Day", "Bad Day", "Maybe", "Maybe, talk to <names>").
  """
  use Ash.Resource.Calculation

  alias GameNight.Schedules.Calculations.FinalNoteKind
  alias GameNight.Schedules.ScheduleDay.Calculations.FinalNote

  @impl true
  def load(_query, _opts, _context), do: [:schedule_id, :day, :gm_status]

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn record ->
      {kind, names} = FinalNote.compute(record)
      FinalNoteKind.label(kind, names)
    end)
  end
end
