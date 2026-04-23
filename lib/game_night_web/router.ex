defmodule GameNightWeb.Router do
  use GameNightWeb, :router

  use AshAuthentication.Phoenix.Router

  import AshAuthentication.Plug.Helpers

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {GameNightWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :load_from_session
    # Promote `current_user` to `actor` so Ash actions authorize against
    # the logged-in user. Without this, `/rpc/run` sees no actor and
    # every policy-checked action fails with "actor is required".
    plug :set_actor, :user
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug :load_from_bearer
    plug :set_actor, :user
  end

  # Browser pipeline for `auth_routes` endpoints. Accepts both HTML
  # (for defensive direct-navigation fallbacks) and JSON (the SPA's
  # primary form-submit content type). The rate limiter runs last so
  # session loading has already populated `conn.params` with the body
  # keys it reads for per-email keying.
  pipeline :auth_browser do
    plug :accepts, ["html", "json"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {GameNightWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :load_from_session
    plug :set_actor, :user
    plug GameNightWeb.Plugs.AuthRateLimiter
  end

  # Ingestion pipeline for `/api/vitals`: JSON:API content type,
  # session-aware so authenticated samples are attributed to a user,
  # and rate-limited to keep a runaway tab from flooding the table.
  # CSRF protection is intentionally absent — the endpoint accepts
  # anonymous writes and the route isn't used for state-changing
  # operations beyond appending to a telemetry table.
  pipeline :vitals_api do
    plug :accepts, ["json"]
    plug :fetch_session
    plug :load_from_session
    plug :set_actor, :user
    plug GameNightWeb.Plugs.VitalsRateLimiter
  end

  # Playwright / dev-only: a session-aware JSON pipeline that skips
  # CSRF protection so seed requests from the test harness don't need
  # to bootstrap a token first. Never mounted in production (see the
  # `dev_routes` guard around the test scope).
  pipeline :test_session_api do
    plug :accepts, ["json"]
    plug :fetch_session
    plug :put_secure_browser_headers
  end

  scope "/", GameNightWeb do
    pipe_through :browser

    post "/rpc/run", AshTypescriptRpcController, :run
    post "/rpc/validate", AshTypescriptRpcController, :validate
  end

  scope "/api" do
    pipe_through [:vitals_api]

    forward "/", GameNightWeb.AshJsonApiRouter
  end

  scope "/", GameNightWeb do
    pipe_through :browser

    get "/", PageController, :spa
    get "/dashboard", PageController, :spa
  end

  # The SPA sign-out button fetches `DELETE /sign-out` with
  # `Accept: application/json`; the browser pipeline only accepts
  # `html`, so sign-out lives under `:auth_browser` alongside the
  # other auth endpoints.
  scope "/", GameNightWeb do
    pipe_through :auth_browser

    delete "/sign-out", AuthController, :sign_out
    auth_routes AuthController, GameNight.Accounts.User, path: "/auth"
  end

  # Other scopes may use custom stacks.
  # scope "/api", GameNightWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:game_night, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: GameNightWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end

  if Application.compile_env(:game_night, :dev_routes) do
    import AshAdmin.Router

    scope "/admin" do
      pipe_through :browser

      ash_admin "/"
    end
  end

  # Playwright / E2E helpers — guarded behind :dev_routes so the
  # endpoints are never mounted in production. `TestAuthController`
  # upserts a user + stores them in the session; `TestMailboxController`
  # reads/clears the in-memory Swoosh local mailbox so specs can follow
  # token URLs from confirmation / reset / magic-link emails.
  if Application.compile_env(:game_night, :dev_routes) do
    scope "/test", GameNightWeb do
      pipe_through :test_session_api

      post "/sign-in-as", TestAuthController, :sign_in_as
      get "/mailbox", TestMailboxController, :index
      delete "/mailbox", TestMailboxController, :clear
    end
  end

  # Catch-all for deep-linked SPA routes (e.g. /dashboard on a hard
  # refresh). Kept at the very end so it does not shadow any explicitly
  # declared route above (auth, admin, dev).
  scope "/", GameNightWeb do
    pipe_through :browser

    get "/*path", PageController, :spa
  end
end
