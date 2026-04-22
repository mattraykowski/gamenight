defmodule GameNightWeb.AshJsonApiRouter do
  use AshJsonApi.Router,
    domains: [GameNight.Telemetry],
    open_api: "/open_api"
end
