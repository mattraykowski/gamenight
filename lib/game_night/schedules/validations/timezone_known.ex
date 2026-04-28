defmodule GameNight.Schedules.Validations.TimezoneKnown do
  @moduledoc """
  Validates that the `:time_zone` attribute is a known IANA zone
  name per `Tzdata.zone_exists?/1`. Plain-language error message
  per Constitution Principle V.
  """
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, _opts, _context) do
    case Ash.Changeset.get_attribute(changeset, :time_zone) do
      nil ->
        :ok

      tz when is_binary(tz) ->
        if Tzdata.zone_exists?(tz) do
          :ok
        else
          {:error, field: :time_zone, message: "must be a known timezone (got: #{tz})"}
        end

      other ->
        {:error,
         field: :time_zone, message: "must be a string timezone name (got: #{inspect(other)})"}
    end
  end
end
