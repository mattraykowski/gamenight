defmodule GameNight.Games do
  @moduledoc """
  Ash domain for registered games owned by a Game Master.

  Dual-exposed: every action surfaces on both JSON:API (canonical
  contract, per constitution Principle III) and the ash_typescript
  RPC channel (fast path for the SPA). Actions and policies live on
  the `GameNight.Games.Game` resource.
  """
  use Ash.Domain,
    otp_app: :game_night,
    extensions: [AshJsonApi.Domain, AshTypescript.Rpc]

  # RPC bindings the SPA calls via `/rpc/run`. Declaring bindings for
  # actions that do not yet exist on the resource would trip
  # AshTypescript.Rpc.VerifyRpc at compile time, so each binding is
  # added alongside its resource action in the corresponding user-
  # story phase. The resource itself is registered here (without
  # rpc_action entries) so the typed client picks up the Game type.
  typescript_rpc do
    resource GameNight.Games.Game do
      rpc_action :list_mine_active, :list_mine_active
      rpc_action :list_mine, :list_mine
      rpc_action :get_mine, :get_mine
      rpc_action :register_game, :register
      rpc_action :update_game, :update
      rpc_action :destroy_game, :destroy
    end

    # Feature 002 — registered here so the typed client picks up the
    # Player + Invitation types. RPC action bindings are added in
    # their owning user-story phases (US1 / US3) once the underlying
    # Ash actions exist.
    resource GameNight.Games.Player do
    end

    resource GameNight.Games.Invitation do
    end
  end

  resources do
    resource GameNight.Games.Game
    resource GameNight.Games.Player
    resource GameNight.Games.Invitation
  end
end
