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
      rpc_action :register_game, :register
    end
  end

  resources do
    resource GameNight.Games.Game
  end
end
