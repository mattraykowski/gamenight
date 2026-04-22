defmodule GameNightWeb.PageController do
  use GameNightWeb, :controller

  @doc """
  Serves the SPA shell for `/` and any unclaimed deep-link path (e.g.
  `/dashboard` on a hard refresh). The template embeds a JSON island
  describing the current session so the SPA's auth context can hydrate
  synchronously without an extra network round-trip.
  """
  def spa(conn, _params) do
    conn
    |> put_root_layout(html: {GameNightWeb.Layouts, :spa_root})
    |> assign(:auth_state, auth_state(conn))
    |> render(:spa)
  end

  defp auth_state(conn) do
    case conn.assigns[:current_user] do
      nil ->
        %{user: nil}

      %{} = user ->
        %{
          user: %{
            id: user.id,
            email: to_string(user.email)
          }
        }
    end
  end
end
