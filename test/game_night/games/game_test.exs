defmodule GameNight.Games.GameTest do
  @moduledoc """
  Unit tests for `GameNight.Games.Game` — structure, policies,
  actions. Tests are written phase-by-phase per the implementation
  plan at `specs/001-register-game/`; T004 starts with the domain /
  schema existence checks, and subsequent US phases append policy and
  action tests under their own `describe` blocks.
  """
  use GameNight.DataCase, async: false

  alias Ash.Domain.Info, as: DomainInfo
  alias Ecto.Adapters.SQL, as: Sql
  alias GameNight.Games.Game

  describe "resource and domain wiring (T004)" do
    test "Game resource is backed by the games table" do
      assert Game.__schema__(:source) == "games"
    end

    test "Games domain knows about the Game resource" do
      assert DomainInfo.resources(GameNight.Games) == [Game]
    end
  end

  describe "postgres indexes (T010)" do
    test "composite index on (owner_id, status, updated_at) exists" do
      %Postgrex.Result{rows: rows} =
        Sql.query!(
          GameNight.Repo,
          """
          SELECT indexdef
          FROM pg_indexes
          WHERE tablename = 'games'
            AND indexname = 'games_owner_status_updated_at_index'
          """,
          []
        )

      [[indexdef]] = rows
      # Composite covering the filter (status) + sort (updated_at) used
      # by list_mine_active, plus the owner scope from the policy.
      assert indexdef =~ "owner_id"
      assert indexdef =~ "status"
      assert indexdef =~ "updated_at"
    end
  end
end
