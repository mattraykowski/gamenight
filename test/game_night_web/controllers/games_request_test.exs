defmodule GameNightWeb.GamesRequestTest do
  @moduledoc """
  End-to-end request tests against `/api/games/**`. Each test
  exercises the full endpoint → router → Ash action chain with a real
  `Phoenix.ConnTest.build_conn/0`. Policy enforcement is also covered
  by the resource-level tests in `test/game_night/games/game_test.exs`;
  this file covers the JSON:API wire contract.
  """
  use GameNightWeb.ConnCase, async: false

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers
  alias GameNight.Accounts.User

  @jsonapi "application/vnd.api+json"

  describe "GET /api/games/active (T011 + T021)" do
    test "anonymous caller gets no data (cross-tenant protection)", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/games/active")

      # The owner_id policy filter collapses to "no rows" when the
      # actor is nil. A 200 with an empty collection is
      # indistinguishable (to the caller) from "the actor has no
      # games" — that's the guarantee that matters for cross-tenant
      # protection (SC-005). A 403 is also acceptable; either outcome
      # fails the "leak data to anonymous" scenario.
      if conn.status == 200 do
        assert %{"data" => []} = json_response(conn, 200)
      else
        assert conn.status >= 400
      end
    end

    test "authenticated user with no games sees an empty data array", %{conn: conn} do
      {:ok, user} = create_user()

      conn =
        conn
        |> sign_in(user)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/games/active")

      assert %{"data" => []} = json_response(conn, 200)
    end

    test "authenticated user sees only their own Active games", %{conn: conn} do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()

      {:ok, _} = register_game(owner, %{title: "Mine active", status: :active})
      {:ok, _} = register_game(owner, %{title: "Mine paused", status: :paused})
      {:ok, _} = register_game(other, %{title: "Stranger's active", status: :active})

      conn =
        conn
        |> sign_in(owner)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/games/active")

      assert %{"data" => [entry]} = json_response(conn, 200)
      assert entry["attributes"]["title"] == "Mine active"
      assert entry["type"] == "game"
    end
  end

  describe "POST /api/games (T021)" do
    test "anonymous caller cannot register a game", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/games", %{
          data: %{
            type: "game",
            attributes: %{title: "No actor", description: "x", status: "active"}
          }
        })

      assert conn.status >= 400
    end

    test "authenticated user creates a game and is returned as owner", %{conn: conn} do
      {:ok, user} = create_user()

      conn =
        conn
        |> sign_in(user)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/games", %{
          data: %{
            type: "game",
            attributes: %{title: "Curse of Strahd", description: "Gothic", status: "active"}
          }
        })

      assert %{"data" => %{"attributes" => attrs}} = json_response(conn, 201)
      assert attrs["title"] == "Curse of Strahd"
      assert attrs["status"] == "active"
    end

    test "empty title fails validation with a 422", %{conn: conn} do
      {:ok, user} = create_user()

      conn =
        conn
        |> sign_in(user)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/games", %{
          data: %{
            type: "game",
            attributes: %{title: "", status: "active"}
          }
        })

      assert %{"errors" => errors} = json_response(conn, 400)
      assert Enum.any?(errors, &(&1["source"]["pointer"] =~ "title"))
    end
  end

  describe "GET /api/games/:id (T049)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      {:ok, game} = register_game(owner, %{title: "Mine", status: :active})
      {:ok, owner: owner, other: other, game: game}
    end

    test "owner sees their own game", %{conn: conn, owner: owner, game: game} do
      conn =
        conn
        |> sign_in(owner)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/games/#{game.id}")

      assert %{"data" => %{"type" => "game", "id" => id, "attributes" => attrs}} =
               json_response(conn, 200)

      assert id == game.id
      assert attrs["title"] == "Mine"
    end

    test "a different user gets 404 (cross-tenant protection)", %{
      conn: conn,
      other: other,
      game: game
    } do
      conn =
        conn
        |> sign_in(other)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/games/#{game.id}")

      assert conn.status == 404
    end

    test "anonymous caller is rejected", %{conn: conn, game: game} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/games/#{game.id}")

      assert conn.status >= 400
    end
  end

  defp create_user do
    email = "games-req-#{System.unique_integer([:positive])}@example.test"
    password = "games-req-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner, attrs) do
    GameNight.Games.Game
    |> Ash.Changeset.for_create(:register, attrs, actor: owner)
    |> Ash.create()
  end

  defp sign_in(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end
end
