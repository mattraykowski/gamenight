defmodule GameNightWeb.GamesRequestTest do
  @moduledoc """
  End-to-end request tests against `/api/json/games/**`. Each test
  exercises the full endpoint → router → Ash action chain with a real
  `Phoenix.ConnTest.build_conn/0`. Policy enforcement is covered by
  the resource-level tests in `test/game_night/games/game_test.exs`;
  this file covers the JSON:API wire contract.
  """
  use GameNightWeb.ConnCase, async: false

  require Ash.Query

  @jsonapi "application/vnd.api+json"

  describe "GET /api/json/games/all (T011 baseline)" do
    test "anonymous caller is rejected (no actor loaded)", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/json/games/all")

      # Before the routes block is populated the router surfaces a
      # 404 JSON:API error; after US5 lands the route the policy layer
      # converts to a 403/404 for anonymous access. The important
      # guarantee today is: no success response for anonymous.
      assert conn.status >= 400
    end
  end
end
