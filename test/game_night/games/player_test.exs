defmodule GameNight.Games.PlayerTest do
  @moduledoc """
  Action + policy + field-policy tests for `GameNight.Games.Player`
  (T066–T068).
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Games.Game
  alias GameNight.Games.Player

  describe ":list_for_game (T066)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, stranger} = create_user()
      {:ok, game} = register_game(gm)
      seed_player!(game, player_user)

      {:ok, gm: gm, player_user: player_user, stranger: stranger, game: game}
    end

    test "GM reads the roster", %{gm: gm, game: game} do
      assert {:ok, [player]} =
               Player
               |> Ash.Query.for_read(:list_for_game, %{game_id: game.id}, actor: gm)
               |> Ash.read()

      assert player.character_name == "Test Char"
      # `:list_for_game` does not load the `:visible_gm_notes`
      # calculation by default, and `gm_notes` is `public? false` so
      # it's never on the JSON:API / RPC payload. The wire-level
      # zero-leak guarantee is exercised by the JSON:API request
      # test (T070).
    end

    test "seated player reads the roster", %{
      player_user: player_user,
      game: game
    } do
      assert {:ok, [_player]} =
               Player
               |> Ash.Query.for_read(:list_for_game, %{game_id: game.id}, actor: player_user)
               |> Ash.read()
    end

    test "non-GM non-player gets nothing (cross-tenant protection)", %{
      stranger: stranger,
      game: game
    } do
      assert {:ok, []} =
               Player
               |> Ash.Query.for_read(:list_for_game, %{game_id: game.id}, actor: stranger)
               |> Ash.read()
    end

    test "anonymous caller gets nothing", %{game: game} do
      assert {:ok, []} =
               Player
               |> Ash.Query.for_read(:list_for_game, %{game_id: game.id})
               |> Ash.read()
    end
  end

  describe ":list_for_gm (T067)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, game} = register_game(gm)
      seed_player!(game, player_user, gm_notes: "secret GM notes")

      {:ok, gm: gm, player_user: player_user, game: game}
    end

    test "GM reads visible_gm_notes (the field returns the value)", %{gm: gm, game: game} do
      assert {:ok, [player]} =
               Player
               |> Ash.Query.for_read(:list_for_gm, %{game_id: game.id}, actor: gm)
               |> Ash.read()

      assert player.visible_gm_notes == "secret GM notes"
    end

    test "non-GM cannot use :list_for_gm at all", %{
      player_user: player_user,
      game: game
    } do
      assert {:ok, []} =
               Player
               |> Ash.Query.for_read(:list_for_gm, %{game_id: game.id}, actor: player_user)
               |> Ash.read()
    end

    test "field policy on visible_gm_notes hides the value from a non-GM caller", %{
      player_user: player_user,
      game: game
    } do
      # Even if a non-GM caller goes through `:list_for_game` and
      # asks for `visible_gm_notes` via sparse fieldsets, the field
      # policy fails closed — the value is replaced with an
      # `%Ash.ForbiddenField{}` sentinel rather than the secret
      # string. The JSON:API / RPC serialisation layers omit
      # `ForbiddenField` from the wire payload (SC-005 zero-leak).
      {:ok, [player]} =
        Player
        |> Ash.Query.for_read(:list_for_game, %{game_id: game.id}, actor: player_user)
        |> Ash.Query.load(:visible_gm_notes)
        |> Ash.read()

      assert match?(%Ash.ForbiddenField{}, player.visible_gm_notes)
    end
  end

  describe ":list_mine (T068)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, game} = register_game(gm)
      seed_player!(game, player_user)

      {:ok, player_user: player_user}
    end

    test "actor reads their own player rows", %{player_user: player_user} do
      assert {:ok, [_row]} =
               Player
               |> Ash.Query.for_read(:list_mine, %{}, actor: player_user)
               |> Ash.read()
    end
  end

  describe ":list_mine returns all statuses sorted desc (T098)" do
    test "returns rows across :active, :inactive, :done — sorted by updated_at DESC" do
      {:ok, gm} = create_user()
      {:ok, player_user} = create_user()

      {:ok, game_a} = register_game(gm)
      {:ok, game_b} = register_game(gm)
      {:ok, game_c} = register_game(gm)

      _oldest =
        seed_player_with_status!(game_a, player_user, :active, "Oldest active")

      :timer.sleep(5)

      _middle =
        seed_player_with_status!(game_b, player_user, :inactive, "Middle inactive")

      :timer.sleep(5)

      _newest =
        seed_player_with_status!(game_c, player_user, :done, "Newest done")

      assert {:ok, results} =
               Player
               |> Ash.Query.for_read(:list_mine, %{}, actor: player_user)
               |> Ash.read()

      # All three statuses are returned — :done is NOT filtered out
      # at the action layer. (The dashboard's My Characters column
      # applies its own client-side filter to hide :done per FR-029.)
      statuses = Enum.map(results, & &1.status) |> Enum.sort()
      assert statuses == [:active, :done, :inactive]

      # Newest-touched first.
      character_names = Enum.map(results, & &1.character_name)
      assert hd(character_names) == "Newest done"
      assert List.last(character_names) == "Oldest active"
    end
  end

  describe ":update (T068)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, other_gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, game} = register_game(gm)
      player = seed_player!(game, player_user)

      {:ok, gm: gm, other_gm: other_gm, player_user: player_user, player: player}
    end

    test "GM can change character_name, character_summary, gm_notes, status", %{
      gm: gm,
      player: player
    } do
      {:ok, updated} =
        player
        |> Ash.Changeset.for_update(
          :update,
          %{
            character_name: "Mira (renamed)",
            character_summary: "Now retired.",
            gm_notes: "Player decided to step back.",
            status: :inactive
          },
          actor: gm
        )
        |> Ash.update()

      assert updated.character_name == "Mira (renamed)"
      assert updated.character_summary == "Now retired."
      assert updated.status == :inactive
    end

    test "non-GM cannot update", %{other_gm: other_gm, player: player} do
      assert {:error, %Ash.Error.Forbidden{}} =
               player
               |> Ash.Changeset.for_update(:update, %{character_name: "Hacked"}, actor: other_gm)
               |> Ash.update()
    end

    test "the player whose row this is cannot update their own character data", %{
      player_user: player_user,
      player: player
    } do
      assert {:error, %Ash.Error.Forbidden{}} =
               player
               |> Ash.Changeset.for_update(:update, %{character_name: "self-edit"}, actor: player_user)
               |> Ash.update()
    end

    test "status can round-trip (active → done → active)", %{gm: gm, player: player} do
      {:ok, p1} =
        player
        |> Ash.Changeset.for_update(:update, %{status: :done}, actor: gm)
        |> Ash.update()

      assert p1.status == :done

      {:ok, p2} =
        p1
        |> Ash.Changeset.for_update(:update, %{status: :active}, actor: gm)
        |> Ash.update()

      assert p2.status == :active
    end
  end

  defp create_user do
    email = "player-test-#{System.unique_integer([:positive])}@example.test"
    password = "player-test-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: "Player test", status: :active}, actor: owner)
    |> Ash.create()
  end

  defp seed_player!(game, user, opts \\ []) do
    Player
    |> Ash.Changeset.for_create(
      :create,
      %{
        game_id: game.id,
        user_id: user.id,
        character_name: "Test Char",
        character_summary: nil,
        gm_notes: Keyword.get(opts, :gm_notes, "secret notes"),
        status: :active
      }
    )
    |> Ash.create!(authorize?: false)
  end

  defp seed_player_with_status!(game, user, status, character_name) do
    Player
    |> Ash.Changeset.for_create(
      :create,
      %{
        game_id: game.id,
        user_id: user.id,
        character_name: character_name,
        character_summary: nil,
        gm_notes: nil,
        status: status
      }
    )
    |> Ash.create!(authorize?: false)
  end
end
