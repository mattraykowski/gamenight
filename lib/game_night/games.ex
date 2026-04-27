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
    # Player + Invitation types. RPC action bindings are added
    # alongside the underlying Ash actions in their owning
    # user-story phases (US1 — Invitation create/preview/accept;
    # US3 — Player and remaining Invitation actions).
    resource GameNight.Games.Player do
      rpc_action :list_players_for_game, :list_for_game
      rpc_action :list_players_for_gm, :list_for_gm
      rpc_action :list_my_characters, :list_mine
      rpc_action :update_player, :update
    end

    resource GameNight.Games.Invitation do
      rpc_action :create_invitation, :create_for_game
      rpc_action :preview_invitation, :preview_with_token
      # Wired to the `:accept_invitation` generic-action wrapper
      # rather than `:accept_with_token` directly so the JSON:API
      # PATCH route and the RPC channel share a single token-bearer
      # entry point. See research.md §2 and
      # `lib/game_night/games/invitation/actions/accept_invitation.ex`.
      rpc_action :accept_invitation, :accept_invitation
      rpc_action :accept_invitation_for_me, :accept_for_me
      rpc_action :decline_invitation, :decline_invitation
      rpc_action :decline_invitation_for_me, :decline_for_me
      rpc_action :list_my_pending_invitations, :list_pending_for_me
      rpc_action :list_pending_invitations_for_game, :list_pending_for_game
      rpc_action :revoke_invitation, :revoke
    end
  end

  resources do
    resource GameNight.Games.Game
    resource GameNight.Games.Player
    resource GameNight.Games.Invitation
  end
end
