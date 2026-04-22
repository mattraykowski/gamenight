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

    ash_authentication_live_session :authenticated_routes do
      # in each liveview, add one of the following at the top of the module:
      #
      # If an authenticated user must be present:
      # on_mount {GameNightWeb.LiveUserAuth, :live_user_required}
      #
      # If an authenticated user *may* be present:
      # on_mount {GameNightWeb.LiveUserAuth, :live_user_optional}
      #
      # If an authenticated user must *not* be present:
      # on_mount {GameNightWeb.LiveUserAuth, :live_no_user}
    end

    post "/rpc/run", AshTypescriptRpcController, :run
    post "/rpc/validate", AshTypescriptRpcController, :validate
    get "/ash-typescript", PageController, :index
  end

  scope "/api/json" do
    pipe_through [:api]

    forward "/swaggerui", OpenApiSpex.Plug.SwaggerUI,
      path: "/api/json/open_api",
      default_model_expand_depth: 4

    forward "/", GameNightWeb.AshJsonApiRouter
  end

  scope "/", GameNightWeb do
    pipe_through :browser

    get "/", PageController, :spa
    get "/dashboard", PageController, :spa
    auth_routes AuthController, GameNight.Accounts.User, path: "/auth"
    sign_out_route AuthController

    # Remove these if you'd like to use your own authentication views
    sign_in_route register_path: "/register",
                  reset_path: "/reset",
                  auth_routes_prefix: "/auth",
                  on_mount: [{GameNightWeb.LiveUserAuth, :live_no_user}],
                  overrides: [
                    GameNightWeb.AuthOverrides,
                    Elixir.AshAuthentication.Phoenix.Overrides.DaisyUI
                  ]

    # Remove this if you do not want to use the reset password feature
    reset_route auth_routes_prefix: "/auth",
                overrides: [
                  GameNightWeb.AuthOverrides,
                  Elixir.AshAuthentication.Phoenix.Overrides.DaisyUI
                ]

    # Remove this if you do not use the confirmation strategy
    confirm_route GameNight.Accounts.User, :confirm_new_user,
      auth_routes_prefix: "/auth",
      overrides: [GameNightWeb.AuthOverrides, Elixir.AshAuthentication.Phoenix.Overrides.DaisyUI]

    # Remove this if you do not use the magic link strategy.
    magic_sign_in_route(GameNight.Accounts.User, :magic_link,
      auth_routes_prefix: "/auth",
      overrides: [GameNightWeb.AuthOverrides, Elixir.AshAuthentication.Phoenix.Overrides.DaisyUI]
    )
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

  # Playwright / E2E helper — guarded behind :dev_routes so the endpoint
  # is never mounted in production. The controller upserts a user and
  # stores them in the Phoenix session.
  if Application.compile_env(:game_night, :dev_routes) do
    scope "/test", GameNightWeb do
      pipe_through :test_session_api

      post "/sign-in-as", TestAuthController, :sign_in_as
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
