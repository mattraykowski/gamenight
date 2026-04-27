defmodule GameNight.Games.GameRpcTest do
  @moduledoc """
  Contract tests for the `ash_typescript` RPC bindings on the
  `GameNight.Games` domain. These prove that the SPA's generated
  client surface stays in sync with the resource's declared
  RPC-exposed actions — if anyone drops or renames a binding, this
  test fails loudly instead of producing silent drift against
  `assets/js/ash_rpc.ts`.
  """
  use GameNight.DataCase, async: false

  alias AshTypescript.Rpc.Info, as: RpcInfo

  describe "typescript_rpc declarations (T015)" do
    test "Games domain exposes exactly the expected RPC bindings (T015 + feature 002 US1 additions)" do
      declared_names =
        GameNight.Games
        |> RpcInfo.typescript_rpc()
        |> Enum.flat_map(fn resource_entry ->
          Enum.map(resource_entry.rpc_actions, & &1.name)
        end)
        |> Enum.sort()

      expected = [
        # Feature 001 — Game resource.
        :destroy_game,
        :get_mine,
        :list_mine,
        :list_mine_active,
        :register_game,
        :update_game,
        # Feature 002 US1 — Invitation backend.
        :accept_invitation,
        :create_invitation,
        :preview_invitation
      ]

      assert declared_names == Enum.sort(expected)
    end

    test "listMineActive and registerGame RPC bindings are exposed (T022 — US1)" do
      # A narrower contract test that US1 can land green without
      # waiting for US2-5 to add their bindings. This proves the
      # two SPA-facing actions US1 needs are reachable via RPC.
      declared =
        GameNight.Games
        |> RpcInfo.typescript_rpc()
        |> Enum.flat_map(fn resource_entry ->
          Enum.map(resource_entry.rpc_actions, & &1.name)
        end)

      assert :list_mine_active in declared
      assert :register_game in declared
    end
  end
end
