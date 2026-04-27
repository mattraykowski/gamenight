defmodule GameNightWeb.PlayersRequestTest do
  @moduledoc """
  JSON:API wire-contract tests for `/api/players/**` (T070).
  Action-layer behaviour and field-policy zero-leak guarantees are
  exercised in `test/game_night/games/player_test.exs`; this file
  covers the wire contract — content types, status codes, and the
  GM-vs-non-GM serialisation difference for `gm_notes`.
  """
  use GameNightWeb.ConnCase, async: false

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers
  alias GameNight.Accounts.User
  alias GameNight.Games.Game
  alias GameNight.Games.Player

  @jsonapi "application/vnd.api+json"

  describe "GET /api/players/by-game/:game_id" do
    setup do
      {:ok, gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, stranger} = create_user()
      {:ok, game} = register_game(gm)
      seed_player!(game, player_user, gm_notes: "GM-only secret")

      {:ok, gm: gm, player_user: player_user, stranger: stranger, game: game}
    end

    test "GM receives the roster", %{conn: conn, gm: gm, game: game} do
      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/players/by-game/#{game.id}")

      assert %{"data" => [entry]} = json_response(conn, 200)
      assert entry["attributes"]["character_name"] == "Test Char"
      # gm_notes is not on the default roster payload; the GM-only
      # `/by-game/:game_id/gm` route is the only path to it.
      refute Map.has_key?(entry["attributes"], "gm_notes")
      refute Map.has_key?(entry["attributes"], "visible_gm_notes")
    end

    test "seated player sees the roster but no GM-private fields", %{
      conn: conn,
      player_user: player_user,
      game: game
    } do
      conn =
        conn
        |> sign_in(player_user)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/players/by-game/#{game.id}")

      assert %{"data" => [entry]} = json_response(conn, 200)
      refute Map.has_key?(entry["attributes"], "gm_notes")
    end

    test "non-GM non-player sees no rows", %{conn: conn, stranger: stranger, game: game} do
      conn =
        conn
        |> sign_in(stranger)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/players/by-game/#{game.id}")

      assert %{"data" => []} = json_response(conn, 200)
    end
  end

  describe "GET /api/players/by-game/:game_id/gm" do
    setup do
      {:ok, gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, game} = register_game(gm)
      seed_player!(game, player_user, gm_notes: "GM-only secret")

      {:ok, gm: gm, player_user: player_user, game: game}
    end

    test "GM gets visible_gm_notes on the payload", %{conn: conn, gm: gm, game: game} do
      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/players/by-game/#{game.id}/gm")

      assert %{"data" => [entry]} = json_response(conn, 200)
      assert entry["attributes"]["visible_gm_notes"] == "GM-only secret"
    end

    test "non-GM gets no rows on the GM-only route", %{
      conn: conn,
      player_user: player_user,
      game: game
    } do
      conn =
        conn
        |> sign_in(player_user)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/players/by-game/#{game.id}/gm")

      assert %{"data" => []} = json_response(conn, 200)
    end
  end

  describe "PATCH /api/players/:id" do
    setup do
      {:ok, gm} = create_user()
      {:ok, other_gm} = create_user()
      {:ok, player_user} = create_user()
      {:ok, game} = register_game(gm)
      player = seed_player!(game, player_user, gm_notes: "before")

      {:ok, gm: gm, other_gm: other_gm, player: player}
    end

    test "GM updates a player's status + character_name", %{
      conn: conn,
      gm: gm,
      player: player
    } do
      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/players/#{player.id}", %{
          data: %{
            type: "player",
            id: player.id,
            attributes: %{character_name: "Renamed", status: "inactive"}
          }
        })

      assert %{"data" => %{"attributes" => attrs}} = json_response(conn, 200)
      assert attrs["character_name"] == "Renamed"
      assert attrs["status"] == "inactive"
    end

    test "non-GM cannot update", %{conn: conn, other_gm: other_gm, player: player} do
      conn =
        conn
        |> sign_in(other_gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/players/#{player.id}", %{
          data: %{type: "player", id: player.id, attributes: %{character_name: "Hacked"}}
        })

      assert conn.status >= 400
    end
  end

  defp create_user do
    email = "players-req-#{System.unique_integer([:positive])}@example.test"
    password = "players-req-password-1"

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
    |> Ash.Changeset.for_create(:register, %{title: "Roster", status: :active}, actor: owner)
    |> Ash.create()
  end

  defp seed_player!(game, user, opts) do
    Player
    |> Ash.Changeset.for_create(:create, %{
      game_id: game.id,
      user_id: user.id,
      character_name: "Test Char",
      character_summary: nil,
      gm_notes: Keyword.get(opts, :gm_notes, nil),
      status: :active
    })
    |> Ash.create!(authorize?: false)
  end

  defp sign_in(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end
end
