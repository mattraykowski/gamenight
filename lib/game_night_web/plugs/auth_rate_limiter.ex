defmodule GameNightWeb.Plugs.AuthRateLimiter do
  @moduledoc """
  Per-endpoint throttling for the `auth_routes`-generated controller
  endpoints. Defends against credential stuffing, account-farming,
  reset-email bombing, and token brute-force by keying each endpoint
  on the most specific combination available:

  - `POST /auth/user/password/sign_in` — IP + normalized email
  - `POST /auth/user/password/register` — IP
  - `POST /auth/user/password/reset_request` + `magic_link/request` —
    IP AND normalized email (email bucket protects a victim from being
    bombed; IP bucket protects against distributed submission)
  - `POST /auth/user/password/reset` — IP
  - `POST /auth/user/magic_link` (sign-in) — IP
  - `POST /auth/user/confirm_new_user` — IP

  The dispatcher exposes neither path params nor strategy metadata at
  plug time (those resolve inside the `auth_routes` controller), so the
  plug classifies by matching on the request path prefix. That is
  tight enough because the set of endpoints is small and fixed, and
  the classification lives next to the rules it protects.

  Email keys are normalised (`downcase` + `trim`) so case and
  whitespace variations do not create separate buckets. IP keys are
  endpoint-name-prefixed so a flood on one endpoint does not starve
  another, matching the `vitals:` prefix convention in
  `GameNightWeb.Plugs.VitalsRateLimiter`.
  """
  use PlugAttack

  @window_ms 60_000
  @reset_window_ms 15 * 60_000

  # In dev / test, the E2E suite runs many auth POSTs in quick
  # succession. The first rule short-circuits the pipeline with
  # `:allow` when the `:dev_routes` flag is on (i.e. the same signal
  # that enables the Swoosh mailbox and `/test/sign-in-as`) so
  # Playwright isn't fighting the limiter. Production keeps the full
  # protection because `:dev_routes` is disabled there.
  rule "skip when dev_routes is enabled", _conn do
    if dev_routes_enabled?(), do: {:allow, :dev}
  end

  # Per-endpoint limits — single source of truth.
  @sign_in_limit 5
  @register_limit 3
  @reset_request_per_email 3
  @reset_request_per_ip 20
  @reset_limit 10
  @magic_request_per_email 3
  @magic_request_per_ip 20
  @magic_sign_in_limit 10
  @confirm_limit 10

  rule "sign_in", conn do
    if match_path?(conn, "POST", ["auth", "user", "password", "sign_in"]) do
      email = normalized_email(conn)

      throttle("auth:sign_in:ip:#{remote_ip(conn)}:email:#{email}",
        limit: @sign_in_limit,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  rule "register", conn do
    if match_path?(conn, "POST", ["auth", "user", "password", "register"]) do
      throttle("auth:register:ip:#{remote_ip(conn)}",
        limit: @register_limit,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  rule "reset_request per-email", conn do
    if match_path?(conn, "POST", ["auth", "user", "password", "reset_request"]) do
      throttle("auth:reset_request:email:#{normalized_email(conn)}",
        limit: @reset_request_per_email,
        period: @reset_window_ms,
        storage: storage()
      )
    end
  end

  rule "reset_request per-IP", conn do
    if match_path?(conn, "POST", ["auth", "user", "password", "reset_request"]) do
      throttle("auth:reset_request:ip:#{remote_ip(conn)}",
        limit: @reset_request_per_ip,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  rule "reset", conn do
    if match_path?(conn, "POST", ["auth", "user", "password", "reset"]) do
      throttle("auth:reset:ip:#{remote_ip(conn)}",
        limit: @reset_limit,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  rule "magic_link request per-email", conn do
    if match_path?(conn, "POST", ["auth", "user", "magic_link", "request"]) do
      throttle("auth:magic_request:email:#{normalized_email(conn)}",
        limit: @magic_request_per_email,
        period: @reset_window_ms,
        storage: storage()
      )
    end
  end

  rule "magic_link request per-IP", conn do
    if match_path?(conn, "POST", ["auth", "user", "magic_link", "request"]) do
      throttle("auth:magic_request:ip:#{remote_ip(conn)}",
        limit: @magic_request_per_ip,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  rule "magic_link sign-in", conn do
    if match_path?(conn, "POST", ["auth", "user", "magic_link"]) do
      throttle("auth:magic_sign_in:ip:#{remote_ip(conn)}",
        limit: @magic_sign_in_limit,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  rule "confirm_new_user", conn do
    if match_path?(conn, "POST", ["auth", "user", "confirm_new_user"]) do
      throttle("auth:confirm:ip:#{remote_ip(conn)}",
        limit: @confirm_limit,
        period: @window_ms,
        storage: storage()
      )
    end
  end

  def allow_action(conn, {:throttle, data}, _opts), do: put_retry_after(conn, data)
  def allow_action(conn, _data, _opts), do: conn

  def block_action(conn, {:throttle, data}, _opts) do
    retry_after = retry_after_seconds(data)

    conn
    |> put_retry_after(data)
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(
      429,
      Jason.encode!(%{
        errors: [
          %{
            field: nil,
            message: "Too many attempts. Try again in #{retry_after}s.",
            code: "rate_limited"
          }
        ]
      })
    )
    |> Plug.Conn.halt()
  end

  def block_action(conn, _data, _opts), do: conn

  defp match_path?(%Plug.Conn{method: method, path_info: path_info}, method, segments),
    do: path_info == segments

  defp match_path?(_conn, _method, _segments), do: false

  defp normalized_email(conn) do
    conn.params
    |> Map.get("user", %{})
    |> Map.get("email", "")
    |> to_string()
    |> String.trim()
    |> String.downcase()
    |> case do
      "" -> "_blank"
      email -> email
    end
  end

  defp remote_ip(conn), do: conn.remote_ip |> :inet.ntoa() |> to_string()

  defp storage, do: {PlugAttack.Storage.Ets, __MODULE__.Storage}

  defp dev_routes_enabled?, do: Application.get_env(:game_night, :dev_routes, false)

  defp put_retry_after(conn, data) when is_list(data) do
    case Keyword.get(data, :expires_at) do
      expires_at when is_integer(expires_at) ->
        Plug.Conn.put_resp_header(
          conn,
          "retry-after",
          Integer.to_string(retry_after_seconds(data))
        )

      _ ->
        conn
    end
  end

  defp put_retry_after(conn, _), do: conn

  defp retry_after_seconds(data) when is_list(data) do
    case Keyword.get(data, :expires_at) do
      expires_at when is_integer(expires_at) ->
        max(0, div(expires_at - System.system_time(:millisecond), 1_000) + 1)

      _ ->
        60
    end
  end

  defp retry_after_seconds(_), do: 60
end
