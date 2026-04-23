defmodule GameNightWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [GameNight.Telemetry, GameNight.Games],
    open_api: "/open_api"
end
