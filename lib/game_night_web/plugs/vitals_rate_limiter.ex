defmodule GameNightWeb.Plugs.VitalsRateLimiter do
  @moduledoc """
  Throttles writes to `POST /api/vitals` so that a misbehaving tab —
  whether a bug or a malicious loop — can't flood the database.

  Authenticated callers get a more generous bucket because their
  identity is already gated by the session cookie; anonymous callers
  are keyed on the remote IP. When the bucket is empty we respond with
  `429 Too Many Requests` and the standard `retry-after` header.

  Numbers were picked to comfortably exceed real-world web-vitals
  traffic (LCP+INP+CLS+TTFB+FCP = 5 samples per page load, plus some
  churn for SPA navigations) while still tripping well before a write
  flood costs us anything.
  """
  use PlugAttack

  # Per-minute bucket windows keyed on the caller.
  @window_ms 60_000
  @anonymous_limit 60
  @authenticated_limit 600

  rule "throttle authenticated vitals posts", conn do
    if conn.method == "POST" and current_user_id(conn) do
      throttle("vitals:user:#{current_user_id(conn)}",
        limit: @authenticated_limit,
        period: @window_ms,
        storage: {PlugAttack.Storage.Ets, __MODULE__.Storage}
      )
    end
  end

  rule "throttle anonymous vitals posts", conn do
    if conn.method == "POST" and is_nil(current_user_id(conn)) do
      throttle("vitals:ip:#{remote_ip(conn)}",
        limit: @anonymous_limit,
        period: @window_ms,
        storage: {PlugAttack.Storage.Ets, __MODULE__.Storage}
      )
    end
  end

  def allow_action(conn, {:throttle, data}, _opts) do
    conn
    |> put_retry_after(data)
  end

  def allow_action(conn, _data, _opts), do: conn

  def block_action(conn, {:throttle, data}, _opts) do
    conn
    |> put_retry_after(data)
    |> Plug.Conn.put_resp_content_type("application/vnd.api+json")
    |> Plug.Conn.send_resp(
      429,
      Jason.encode!(%{
        errors: [
          %{
            status: "429",
            code: "rate_limited",
            title: "Too Many Requests",
            detail: "Vitals ingestion is rate-limited. Retry after the window resets."
          }
        ]
      })
    )
    |> Plug.Conn.halt()
  end

  def block_action(conn, _data, _opts), do: conn

  defp put_retry_after(conn, data) when is_list(data) do
    case Keyword.get(data, :expires_at) do
      expires_at when is_integer(expires_at) ->
        retry_after_seconds =
          max(0, div(expires_at - System.system_time(:millisecond), 1_000) + 1)

        Plug.Conn.put_resp_header(conn, "retry-after", Integer.to_string(retry_after_seconds))

      _ ->
        conn
    end
  end

  defp put_retry_after(conn, _), do: conn

  defp current_user_id(conn) do
    case conn.assigns[:current_user] do
      %{id: id} -> id
      _ -> nil
    end
  end

  defp remote_ip(conn) do
    conn.remote_ip |> :inet.ntoa() |> to_string()
  end
end
