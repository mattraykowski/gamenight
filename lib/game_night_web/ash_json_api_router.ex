defmodule GameNightWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [
      GameNight.Telemetry,
      GameNight.Games,
      GameNight.Notifications,
      GameNight.Schedules
    ],
    open_api: "/open_api"
end
