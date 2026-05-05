import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/game_night start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :game_night, GameNightWeb.Endpoint, server: true
end

config :game_night, GameNightWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

# Feature 002 — Invite Players + opportunistic cleanup of the
# pre-existing TODO from-address in the auth senders. Read in every
# environment so tests don't need env vars set; production should
# override via the env vars below per
# `specs/002-invite-players/quickstart.md`.
#
# `:transactional_email_from` is the shared from-address used by
# every Swoosh sender in `lib/game_night/**/senders/`. The legacy
# `:invitation_email_from` key remains as an alias of the same env
# var for backward compatibility — new senders read the shared key.
config :game_night,
  invitation_token_ttl_days:
    "INVITATION_TOKEN_TTL_DAYS" |> System.get_env("30") |> String.to_integer(),
  transactional_email_from:
    System.get_env(
      "TRANSACTIONAL_EMAIL_FROM",
      System.get_env("INVITATION_EMAIL_FROM", "noreply@example.com")
    ),
  invitation_email_from:
    System.get_env(
      "INVITATION_EMAIL_FROM",
      System.get_env("TRANSACTIONAL_EMAIL_FROM", "noreply@example.com")
    )

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  # Gigalixir's managed Postgres requires SSL; self-hosted/local
  # Postgres in a docker-compose stack typically doesn't speak it.
  # Default on so the Gigalixir path keeps working without setting
  # a new env var; opt out with DATABASE_SSL=false.
  database_ssl? = System.get_env("DATABASE_SSL", "true") not in ~w(false 0)

  repo_opts =
    [
      url: database_url,
      pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
      # For machines with several cores, consider starting multiple pools of `pool_size`
      # pool_count: 4,
      socket_options: maybe_ipv6
    ] ++
      if database_ssl? do
        # Gigalixir's managed Postgres uses certs not in the system
        # trust store, so skip CA verification. The connection is
        # still encrypted in transit; we just don't pin the issuer.
        [ssl: true, ssl_opts: [verify: :verify_none]]
      else
        [ssl: false]
      end

  config :game_night, GameNight.Repo, repo_opts

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  # Phoenix builds asset URLs from `host` and adds the scheme itself,
  # so PHX_HOST must be a bare hostname. Strip a stray scheme/path
  # rather than silently producing `https://[https://example.com]/…`
  # (Phoenix treats the colons as IPv6 and wraps the value in `[...]`).
  host =
    "PHX_HOST"
    |> System.get_env("example.com")
    |> String.replace_prefix("https://", "")
    |> String.replace_prefix("http://", "")
    |> String.split("/", parts: 2)
    |> List.first()

  config :game_night, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  # PhoenixVite.cache_static_manifest_latest/1 reads the Vite
  # manifest eagerly. runtime.exs is evaluated by some Mix tasks
  # (e.g. `mix assets.setup` via the :bun task's app.config load),
  # *before* vite has had a chance to write the manifest — so on a
  # cold buildpack build it would crash here. Skip the config when
  # the file isn't on disk yet; the production deploy will have it
  # by the time the endpoint actually starts.
  manifest_path =
    :game_night
    |> :code.priv_dir()
    |> to_string()
    |> Path.join("static/.vite/manifest.json")

  endpoint_opts = [
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base
  ]

  endpoint_opts =
    if File.exists?(manifest_path) do
      Keyword.put(
        endpoint_opts,
        :cache_static_manifest_latest,
        PhoenixVite.cache_static_manifest_latest(:game_night)
      )
    else
      endpoint_opts
    end

  config :game_night, GameNightWeb.Endpoint, endpoint_opts

  config :game_night,
    token_signing_secret:
      System.get_env("TOKEN_SIGNING_SECRET") ||
        raise("Missing environment variable `TOKEN_SIGNING_SECRET`!")

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :game_night, GameNightWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :game_night, GameNightWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.

  # Mailer — Resend over Swoosh. The Req-based api_client is wired
  # in at compile time in config/prod.exs.
  config :game_night, GameNight.Mailer,
    adapter: Resend.Swoosh.Adapter,
    api_key: System.fetch_env!("RESEND_API_KEY")
end
