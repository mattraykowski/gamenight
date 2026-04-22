defmodule GameNightWeb.VitalsTest do
  @moduledoc """
  HTTP-level tests for the `POST /api/vitals` contract and the
  `plug_attack` throttle in front of it. Anything deeper (attribute
  validation, policies) lives in `GameNight.Telemetry.PageMetricTest`.
  """
  use GameNightWeb.ConnCase, async: false

  @valid_payload %{
    "data" => %{
      "type" => "page-metric",
      "attributes" => %{
        "session_id" => "test-session-1",
        "route" => "/dashboard",
        "metric_name" => "lcp",
        "value" => 1234.5,
        "rating" => "good",
        "user_agent" => "Mozilla/5.0 (test)"
      }
    }
  }

  setup do
    reset_rate_limiter!()
    :ok
  end

  describe "POST /api/vitals" do
    test "accepts a well-formed JSON:API payload and persists a PageMetric row", %{conn: conn} do
      conn =
        conn
        |> put_req_header("content-type", "application/vnd.api+json")
        |> put_req_header("accept", "application/vnd.api+json")
        |> post(~p"/api/vitals", Jason.encode!(@valid_payload))

      body = json_response(conn, 201)
      assert %{"data" => %{"type" => "page-metric", "id" => id}} = body
      assert is_binary(id)
    end

    test "rejects a payload with an unknown metric name with a 400-class error", %{conn: conn} do
      bad = put_in(@valid_payload, ["data", "attributes", "metric-name"], "bogus")

      conn =
        conn
        |> put_req_header("content-type", "application/vnd.api+json")
        |> put_req_header("accept", "application/vnd.api+json")
        |> post(~p"/api/vitals", Jason.encode!(bad))

      assert conn.status in 400..499
      assert %{"errors" => [_ | _]} = json_response(conn, conn.status)
    end

    test "emits 429 once the anonymous bucket is exhausted", %{conn: conn} do
      # Fire enough requests to exceed the anonymous limit defined in
      # VitalsRateLimiter. We reset the bucket in setup so this runs
      # independent of whatever else touched the table.
      limit = 60

      for _ <- 1..limit do
        conn
        |> put_req_header("content-type", "application/vnd.api+json")
        |> put_req_header("accept", "application/vnd.api+json")
        |> post(~p"/api/vitals", Jason.encode!(@valid_payload))
      end

      over =
        conn
        |> put_req_header("content-type", "application/vnd.api+json")
        |> put_req_header("accept", "application/vnd.api+json")
        |> post(~p"/api/vitals", Jason.encode!(@valid_payload))

      assert over.status == 429
      assert get_resp_header(over, "retry-after") != []
    end
  end

  defp reset_rate_limiter! do
    storage = GameNightWeb.Plugs.VitalsRateLimiter.Storage

    try do
      :ets.delete_all_objects(storage)
    rescue
      ArgumentError -> :ok
    end
  end
end
