defmodule GameNightWeb.Plugs.AuthRateLimiterTest do
  @moduledoc """
  Verifies that the auth rate limiter fires on the sign-in endpoint
  after the configured per-window budget is exhausted and returns the
  standard rate-limited envelope + `retry-after` header.

  Other endpoints share the same storage backend and plug wiring;
  testing sign_in gives us confidence in the whole table without a
  full matrix test.
  """
  use GameNightWeb.ConnCase, async: false

  setup do
    # Shared ETS store is long-lived, so each test walks into state
    # left by previous tests. Clear it so the per-window bucket starts
    # empty and the arithmetic in the test matches the limits.
    try do
      :ets.delete_all_objects(GameNightWeb.Plugs.AuthRateLimiter.Storage)
    rescue
      ArgumentError -> :ok
    end

    :ok
  end

  test "returns 429 after 5 sign-in attempts within the window", %{conn: _conn} do
    email = "ratelimit-#{System.unique_integer([:positive])}@example.test"

    for _ <- 1..5 do
      conn =
        build_json_conn()
        |> post(~p"/auth/user/password/sign_in", %{
          "user" => %{"email" => email, "password" => "wrong"}
        })

      assert conn.status in [401, 422]
    end

    conn =
      build_json_conn()
      |> post(~p"/auth/user/password/sign_in", %{
        "user" => %{"email" => email, "password" => "wrong"}
      })

    assert json_response(conn, 429) == %{
             "errors" => [
               %{
                 "field" => nil,
                 "message" => conn.resp_body |> Jason.decode!() |> get_error_message(),
                 "code" => "rate_limited"
               }
             ]
           }

    [retry_after] = get_resp_header(conn, "retry-after")
    assert {_secs, ""} = Integer.parse(retry_after)
  end

  defp build_json_conn do
    Phoenix.ConnTest.build_conn()
    |> put_req_header("accept", "application/json")
    |> put_req_header("content-type", "application/json")
  end

  defp get_error_message(%{"errors" => [%{"message" => message}]}), do: message
end
