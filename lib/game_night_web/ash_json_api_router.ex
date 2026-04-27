defmodule GameNightWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [GameNight.Telemetry, GameNight.Games, GameNight.Notifications],
    open_api: "/open_api"
end
