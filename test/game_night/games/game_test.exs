defmodule GameNight.Games.GameTest do
  @moduledoc """
  Unit tests for `GameNight.Games.Game` — structure, policies,
  actions. Tests are written phase-by-phase per the implementation
  plan at `specs/001-register-game/`; T004 starts with the domain /
  schema existence checks, and subsequent US phases append policy and
  action tests under their own `describe` blocks.
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias Ash.Domain.Info, as: DomainInfo
  alias Ecto.Adapters.SQL, as: Sql
  alias GameNight.Accounts.User
  alias GameNight.Games.Game

  describe "resource and domain wiring (T004)" do
    test "Game resource is backed by the games table" do
      assert Game.__schema__(:source) == "games"
    end

    test "Games domain knows about the Game resource" do
      assert DomainInfo.resources(GameNight.Games) == [Game]
    end
  end

  describe ":register action (T019 policies + T031 behaviour)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, owner: owner}
    end

    test "owner can register a game and owner_id is set to the actor's id", %{owner: owner} do
      {:ok, game} =
        Game
        |> Ash.Changeset.for_create(
          :register,
          %{title: "Lost Mine", description: "Opening adventure", status: :active},
          actor: owner
        )
        |> Ash.create()

      assert game.owner_id == owner.id
      assert game.title == "Lost Mine"
      assert game.status == :active
    end

    test "anonymous caller cannot register a game" do
      # Without an actor the policy denies the action AND
      # `relate_actor(:owner)` has nothing to relate to. Either error
      # path is acceptable — both prevent the row from being created.
      result =
        Game
        |> Ash.Changeset.for_create(
          :register,
          %{title: "No actor", status: :active}
        )
        |> Ash.create()

      assert match?({:error, %Ash.Error.Forbidden{}}, result) or
               match?({:error, %Ash.Error.Invalid{}}, result)
    end

    test "unknown status atom is rejected with Ash.Error.Invalid", %{owner: owner} do
      assert {:error, %Ash.Error.Invalid{}} =
               Game
               |> Ash.Changeset.for_create(
                 :register,
                 %{title: "Bad status", status: :wobbly},
                 actor: owner
               )
               |> Ash.create()
    end

    test "empty title is rejected with Ash.Error.Invalid", %{owner: owner} do
      assert {:error, %Ash.Error.Invalid{}} =
               Game
               |> Ash.Changeset.for_create(
                 :register,
                 %{title: "", status: :active},
                 actor: owner
               )
               |> Ash.create()
    end
  end

  describe ":list_mine_active action (T020 behaviour)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      {:ok, owner: owner, other: other}
    end

    test "returns only the actor's Active games, newest first", %{owner: owner, other: other} do
      {:ok, _paused} =
        register_game(owner, %{title: "Paused campaign", status: :paused})

      {:ok, older_active} =
        register_game(owner, %{title: "Older", status: :active})

      {:ok, _someone_elses} =
        register_game(other, %{title: "Stranger's", status: :active})

      # Small delay to make updated_at comparable.
      :timer.sleep(10)

      {:ok, newer_active} =
        register_game(owner, %{title: "Newer", status: :active})

      {:ok, results} =
        Game
        |> Ash.Query.for_read(:list_mine_active, %{}, actor: owner)
        |> Ash.read()

      ids = Enum.map(results, & &1.id)
      assert ids == [newer_active.id, older_active.id]
    end

    test "anonymous caller sees no games at all", %{owner: owner} do
      {:ok, _} = register_game(owner, %{title: "Visible to owner only", status: :active})

      assert {:ok, []} =
               Game
               |> Ash.Query.for_read(:list_mine_active, %{})
               |> Ash.read()
    end
  end

  describe ":get_mine action (T048 policies + behaviour)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      {:ok, game} = register_game(owner, %{title: "Mine", status: :active})
      {:ok, owner: owner, other: other, game: game}
    end

    test "owner can fetch their own game by id", %{owner: owner, game: game} do
      assert {:ok, loaded} =
               Game
               |> Ash.Query.for_read(:get_mine, %{id: game.id}, actor: owner)
               |> Ash.read_one()

      assert loaded.id == game.id
    end

    test "a different user receives :not_found (no leak)", %{other: other, game: game} do
      # Read returns nil for a row the actor cannot see — the policy
      # filter collapses to empty. The JSON:API / RPC layer surfaces
      # this as 404, equivalent to "does not exist".
      assert {:ok, nil} =
               Game
               |> Ash.Query.for_read(:get_mine, %{id: game.id}, actor: other)
               |> Ash.read_one()
    end

    test "anonymous caller cannot fetch any game", %{game: game} do
      assert {:ok, nil} =
               Game
               |> Ash.Query.for_read(:get_mine, %{id: game.id})
               |> Ash.read_one()
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

  defp create_user do
    email = "games-test-#{System.unique_integer([:positive])}@example.test"
    password = "games-test-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner, attrs) do
    defaults = %{description: nil}
    attrs = Map.merge(defaults, Map.new(attrs))

    Game
    |> Ash.Changeset.for_create(:register, attrs, actor: owner)
    |> Ash.create()
  end
end
