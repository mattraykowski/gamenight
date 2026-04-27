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

    test "Games domain knows about the Game, Player, and Invitation resources" do
      # Feature 002 added Player and Invitation alongside Game.
      assert DomainInfo.resources(GameNight.Games) == [
               GameNight.Games.Game,
               GameNight.Games.Player,
               GameNight.Games.Invitation
             ]
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

  describe ":update action (T061 policies + behaviour)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      {:ok, game} = register_game(owner, %{title: "Mine", status: :active})
      {:ok, owner: owner, other: other, game: game}
    end

    test "owner can change title/description/status", %{owner: owner, game: game} do
      {:ok, updated} =
        game
        |> Ash.Changeset.for_update(
          :update,
          %{title: "Renamed", description: "Now explained.", status: :paused},
          actor: owner
        )
        |> Ash.update()

      assert updated.title == "Renamed"
      assert updated.description == "Now explained."
      assert updated.status == :paused
      assert updated.owner_id == owner.id
    end

    test "different user cannot update", %{other: other, game: game} do
      assert {:error, %Ash.Error.Forbidden{}} =
               game
               |> Ash.Changeset.for_update(:update, %{title: "Hacked"}, actor: other)
               |> Ash.update()
    end

    test "unknown status atom is rejected", %{owner: owner, game: game} do
      assert {:error, %Ash.Error.Invalid{}} =
               game
               |> Ash.Changeset.for_update(:update, %{status: :wobbly}, actor: owner)
               |> Ash.update()
    end

    test "empty title is rejected", %{owner: owner, game: game} do
      assert {:error, %Ash.Error.Invalid{}} =
               game
               |> Ash.Changeset.for_update(:update, %{title: ""}, actor: owner)
               |> Ash.update()
    end

    test "update action is declared atomic", _ do
      action = Ash.Resource.Info.action(Game, :update)
      assert action.require_atomic? == true
    end
  end

  describe ":list_mine action (T086 behaviour)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      {:ok, owner: owner, other: other}
    end

    test "returns all of the actor's games regardless of status, newest first", %{
      owner: owner,
      other: other
    } do
      {:ok, _strangers} = register_game(other, %{title: "Stranger's", status: :active})
      {:ok, paused} = register_game(owner, %{title: "Paused", status: :paused})
      :timer.sleep(5)
      {:ok, active} = register_game(owner, %{title: "Active", status: :active})
      :timer.sleep(5)
      {:ok, done} = register_game(owner, %{title: "Done", status: :completed})

      {:ok, results} =
        Game
        |> Ash.Query.for_read(:list_mine, %{}, actor: owner)
        |> Ash.read()

      ids = Enum.map(results, & &1.id)
      # Newest first + cross-tenant isolation.
      assert ids == [done.id, active.id, paused.id]
    end
  end

  describe ":destroy action (T073 policies + behaviour)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      {:ok, game} = register_game(owner, %{title: "Doomed", status: :active})
      {:ok, owner: owner, other: other, game: game}
    end

    test "owner can destroy their own game", %{owner: owner, game: game} do
      assert :ok =
               game
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: owner)
               |> Ash.destroy()

      assert {:ok, nil} =
               Game
               |> Ash.Query.for_read(:get_mine, %{id: game.id}, actor: owner)
               |> Ash.read_one()
    end

    test "different user cannot destroy", %{other: other, game: game} do
      assert {:error, %Ash.Error.Forbidden{}} =
               game
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: other)
               |> Ash.destroy()
    end
  end

  describe "cross-resource :read policy expansion (feature 002 T007 + T013)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, player_user} = create_user()
      {:ok, stranger} = create_user()
      {:ok, game} = register_game(owner, %{title: "Roster check", status: :active})

      _player =
        Ash.Seed.seed!(GameNight.Games.Player, %{
          game_id: game.id,
          user_id: player_user.id,
          character_name: "Tabaxi Bard",
          character_summary: nil,
          gm_notes: nil,
          status: :active
        })

      {:ok, owner: owner, player_user: player_user, stranger: stranger, game: game}
    end

    test "an accepted player can :get_mine the game they're seated at", %{
      player_user: player_user,
      game: game
    } do
      # Before T013 lands the `exists(players, user_id == ^actor(:id))`
      # clause on Game.read, this assertion FAILS — `get_mine` returns
      # `nil` for any non-owner. After T013, it returns the game.
      assert {:ok, loaded} =
               Game
               |> Ash.Query.for_read(:get_mine, %{id: game.id}, actor: player_user)
               |> Ash.read_one()

      refute is_nil(loaded), "expected accepted player to read the game; policy expansion missing?"
      assert loaded.id == game.id
    end

    test "a non-owner non-player still gets nil (cross-tenant isolation preserved)", %{
      stranger: stranger,
      game: game
    } do
      assert {:ok, nil} =
               Game
               |> Ash.Query.for_read(:get_mine, %{id: game.id}, actor: stranger)
               |> Ash.read_one()
    end

    test "list_mine_active for the player_user does NOT include the GM's game", %{
      player_user: player_user
    } do
      # Named reads keep their owner-scoped `prepare build(filter: …)`
      # clause; the policy expansion only widens which actors can read,
      # not which rows the named read returns.
      assert {:ok, []} =
               Game
               |> Ash.Query.for_read(:list_mine_active, %{}, actor: player_user)
               |> Ash.read()
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
