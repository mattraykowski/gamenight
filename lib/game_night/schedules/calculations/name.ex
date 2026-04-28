defmodule GameNight.Schedules.Calculations.Name do
  @moduledoc """
  Ash calculation module for `Schedule.name`.

  Composes the schedule's display name from `month`, `year`,
  `start_time`, `end_time`. Format: `"<Month> <Year> <Start> – <End>"`
  with 12-hour AM/PM times.

  The bare formatter is exposed as `format/4` so the calculation
  has a tested pure function as its core.
  """
  use Ash.Resource.Calculation

  @month_names ~w(
    January February March April May June
    July August September October November December
  )

  @impl true
  def load(_query, _opts, _context), do: [:month, :year, :start_time, :end_time]

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn r ->
      format(r.month, r.year, r.start_time, r.end_time)
    end)
  end

  @doc """
  Pure formatter for the display name. Tested directly in
  `test/game_night/schedules/calculations/name_test.exs`.
  """
  @spec format(integer(), integer(), Time.t(), Time.t()) :: String.t()
  def format(month, year, %Time{} = start_time, %Time{} = end_time) do
    "#{month_name(month)} #{year} #{format_time(start_time)} – #{format_time(end_time)}"
  end

  defp month_name(month) when month in 1..12, do: Enum.at(@month_names, month - 1)

  defp format_time(%Time{hour: 0, minute: minute}), do: "12:#{pad(minute)} AM"
  defp format_time(%Time{hour: 12, minute: minute}), do: "12:#{pad(minute)} PM"

  defp format_time(%Time{hour: hour, minute: minute}) when hour < 12,
    do: "#{hour}:#{pad(minute)} AM"

  defp format_time(%Time{hour: hour, minute: minute}),
    do: "#{hour - 12}:#{pad(minute)} PM"

  defp pad(minute) when minute < 10, do: "0#{minute}"
  defp pad(minute), do: Integer.to_string(minute)
end
