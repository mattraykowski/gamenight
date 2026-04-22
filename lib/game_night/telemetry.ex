defmodule GameNight.Telemetry do
  @moduledoc """
  Telemetry domain. Holds `PageMetric` — web-vitals samples reported by
  the SPA. Kept orthogonal to `Accounts` so that vitals ingestion never
  touches user-facing authorization paths.
  """
  use Ash.Domain, otp_app: :game_night, extensions: [AshJsonApi.Domain]

  resources do
    resource GameNight.Telemetry.PageMetric
  end
end
