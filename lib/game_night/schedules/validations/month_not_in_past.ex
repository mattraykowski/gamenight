defmodule GameNight.Schedules.Validations.MonthNotInPast do
  @moduledoc """
  Validates that the schedule's `(month, year)` is not strictly
  earlier than the current month in the GM's local timezone (the
  `:time_zone` attribute on the same changeset).

  The current month MUST be allowed regardless of how few days
  remain (FR-003).
  """
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, _opts, _context) do
    month = Ash.Changeset.get_attribute(changeset, :month)
    year = Ash.Changeset.get_attribute(changeset, :year)
    tz = Ash.Changeset.get_attribute(changeset, :time_zone)

    cond do
      is_nil(month) or is_nil(year) ->
        :ok

      is_nil(tz) or not is_binary(tz) ->
        # Defer to the timezone validation.
        :ok

      true ->
        now =
          case DateTime.now(tz) do
            {:ok, dt} -> dt
            # Tzdata not available — fall back to UTC. Story-scale
            # accuracy at month boundaries is preserved by the
            # spec's GM-tz contract.
            {:error, _} -> DateTime.utc_now()
          end

        current_key = now.year * 100 + now.month
        candidate_key = year * 100 + month

        if candidate_key < current_key do
          {:error, field: :month, message: "You can only schedule the current month or later."}
        else
          :ok
        end
    end
  end
end
