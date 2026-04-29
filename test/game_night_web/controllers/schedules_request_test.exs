defmodule GameNightWeb.SchedulesRequestTest do
  @moduledoc """
  T026 — JSON:API request tests for the Schedule surface.

  Covers POST /api/schedules (initiate), GET /api/schedules/by-game/:game_id,
  GET /api/schedules/by-game/:game_id/top-six, GET /api/schedules/by-game/:game_id/:id,
  PATCH /api/schedules/:id/set-gm-day. Policy enforcement is also
  covered by the resource-level tests in
  `test/game_night/schedules/schedule_test.exs`; this file covers the
  JSON:API wire contract.
  """
  use GameNightWeb.ConnCase, async: false

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers
  alias GameNight.Accounts.User
  alias GameNight.Games.Game

  @jsonapi "application/vnd.api+json"

  describe "POST /api/schedules — :initiate (T026)" do
    test "GM successfully initiates a schedule", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)

      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/schedules", %{
          data: %{
            type: "schedule",
            attributes: %{
              month: 10,
              year: 2099,
              start_time: "19:00:00",
              end_time: "23:00:00",
              time_zone: "America/Chicago",
              game_id: game.id
            }
          }
        })

      assert %{"data" => %{"attributes" => attrs}} = json_response(conn, 201)
      assert attrs["status"] == "preparing"
      assert attrs["month"] == 10
      assert attrs["year"] == 2099
      assert attrs["name"] == "October 2099 7:00 PM – 11:00 PM"
    end

    test "non-owner cannot initiate on someone else's game", %{conn: conn} do
      {:ok, owner} = create_user()
      {:ok, intruder} = create_user()
      {:ok, game} = register_game(owner)

      conn =
        conn
        |> sign_in(intruder)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/schedules", %{
          data: %{
            type: "schedule",
            attributes: %{
              month: 10,
              year: 2099,
              start_time: "19:00:00",
              end_time: "23:00:00",
              time_zone: "America/Chicago",
              game_id: game.id
            }
          }
        })

      assert conn.status >= 400
    end

    test "rejects unknown timezone with a JSON:API error envelope", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)

      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/schedules", %{
          data: %{
            type: "schedule",
            attributes: %{
              month: 10,
              year: 2099,
              start_time: "19:00:00",
              end_time: "23:00:00",
              time_zone: "Atlantis/Lost_City",
              game_id: game.id
            }
          }
        })

      assert %{"errors" => [%{"detail" => detail} | _]} = json_response(conn, 400)
      assert detail =~ "timezone"
    end
  end

  describe "GET /api/schedules/by-game/:game_id — :list_for_game (T026)" do
    test "GM sees schedules for their game", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, _} = initiate(gm, game, %{month: 10, year: 2099})
      {:ok, _} = initiate(gm, game, %{month: 11, year: 2099})

      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/schedules/by-game/#{game.id}")

      assert %{"data" => entries} = json_response(conn, 200)
      assert length(entries) == 2
      # Sorted year DESC, month DESC.
      assert hd(entries)["attributes"]["month"] == 11
    end

    test "non-owner sees an empty list", %{conn: conn} do
      {:ok, owner} = create_user()
      {:ok, intruder} = create_user()
      {:ok, game} = register_game(owner)
      {:ok, _} = initiate(owner, game, %{month: 10, year: 2099})

      conn =
        conn
        |> sign_in(intruder)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/schedules/by-game/#{game.id}")

      assert %{"data" => []} = json_response(conn, 200)
    end
  end

  describe "GET /api/schedules/by-game/:game_id/top-six — :list_for_game_top_six (T026)" do
    test "caps at 6 entries", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      for month <- 1..7, do: {:ok, _} = initiate(gm, game, %{month: month, year: 2099})

      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/schedules/by-game/#{game.id}/top-six")

      assert %{"data" => entries} = json_response(conn, 200)
      assert length(entries) == 6
    end
  end

  describe "PATCH /api/schedules/:id/set-gm-day (T026)" do
    test "GM toggles a GM day status", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})

      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/schedules/#{schedule.id}/set-gm-day", %{
          data: %{
            type: "schedule",
            attributes: %{day: 5, status: "A"}
          }
        })

      assert %{"data" => _} = json_response(conn, 200)
    end
  end

  defp create_user do
    email = "schedules-req-#{System.unique_integer([:positive])}@example.test"
    password = "schedules-req-password-1"

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
    |> Ash.Changeset.for_create(:register, %{title: "Schedules req test", status: :active},
      actor: owner
    )
    |> Ash.create()
  end

  defp initiate(actor, game, overrides) do
    attrs =
      Map.merge(
        %{
          month: 10,
          year: 2099,
          start_time: ~T[19:00:00],
          end_time: ~T[23:00:00],
          time_zone: "America/Chicago",
          game_id: game.id
        },
        overrides
      )

    GameNight.Schedules.Schedule
    |> Ash.Changeset.for_create(:initiate, attrs, actor: actor)
    |> Ash.create()
  end

  defp sign_in(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end
end
