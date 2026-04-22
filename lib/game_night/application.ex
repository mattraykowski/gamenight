defmodule GameNight.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      GameNightWeb.Telemetry,
      GameNight.Repo,
      {DNSCluster, query: Application.get_env(:game_night, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: GameNight.PubSub},
      # Start a worker by calling: GameNight.Worker.start_link(arg)
      # {GameNight.Worker, arg},
      # Start to serve requests, typically the last entry
      GameNightWeb.Endpoint,
      {AshAuthentication.Supervisor, [otp_app: :game_night]}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: GameNight.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    GameNightWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
