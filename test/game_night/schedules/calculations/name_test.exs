defmodule GameNight.Schedules.Calculations.NameTest do
  @moduledoc """
  T022 — `Schedule.name` calculation.

  Composes a human-readable display name from `month`, `year`,
  `start_time`, and `end_time`. Format: `"<Month> <Year> <Start> – <End>"`
  with AM/PM 12-hour times.
  """
  use ExUnit.Case, async: true

  alias GameNight.Schedules.Calculations.Name

  defp call(month, year, start_time, end_time) do
    Name.format(month, year, start_time, end_time)
  end

  test "October 2026 7pm-11pm" do
    assert call(10, 2026, ~T[19:00:00], ~T[23:00:00]) ==
             "October 2026 7:00 PM – 11:00 PM"
  end

  test "morning slot" do
    assert call(3, 2027, ~T[09:30:00], ~T[12:00:00]) ==
             "March 2027 9:30 AM – 12:00 PM"
  end

  test "midnight-crossing slot" do
    assert call(12, 2026, ~T[22:00:00], ~T[02:00:00]) ==
             "December 2026 10:00 PM – 2:00 AM"
  end

  test "single-digit minute is preserved" do
    assert call(5, 2027, ~T[19:05:00], ~T[20:05:00]) ==
             "May 2027 7:05 PM – 8:05 PM"
  end

  test "12 PM (noon) renders as 12:00 PM" do
    assert call(7, 2027, ~T[12:00:00], ~T[14:00:00]) ==
             "July 2027 12:00 PM – 2:00 PM"
  end

  test "12 AM (midnight) renders as 12:00 AM" do
    assert call(8, 2027, ~T[00:00:00], ~T[02:00:00]) ==
             "August 2027 12:00 AM – 2:00 AM"
  end
end
