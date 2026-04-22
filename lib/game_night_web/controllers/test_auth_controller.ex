defmodule GameNightWeb.TestAuthController do
  @moduledoc """
  Playwright support: seeds a user in the dev/test database and installs
  them in the Phoenix session so E2E specs can cover authenticated
  flows without exercising the full sign-in form.

  Mounted only when `:dev_routes` is enabled; the router excludes this
  endpoint from production.
  """
  use GameNightWeb, :controller

  require Ash.Query
  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers

  @default_password "playwright-password-1"

  def sign_in_as(conn, params) do
    email = Map.get(params, "email", "playwright@example.test")
    user = get_or_create_user!(email)

    conn
    |> AuthPlugHelpers.store_in_session(user)
    |> put_status(:ok)
    |> json(%{user: %{id: user.id, email: to_string(user.email)}})
  end

  defp get_or_create_user!(email) do
    case read_user(email) do
      nil ->
        register_user!(email)

      _user ->
        # `register_with_password` attaches a freshly-minted JWT (and
        # its persisted Token row) to `__metadata__.token`, which is
        # what `store_in_session/2` reads when the resource has
        # `require_token_presence_for_authentication?`. A user we only
        # re-read from the database has no such token, so for the
        # repeat-seed case we run the sign-in-with-password action to
        # mint a fresh token through the usual auth code path.
        sign_in_user!(email)
    end
  end

  defp sign_in_user!(email) do
    GameNight.Accounts.User
    |> Ash.Query.for_read(:sign_in_with_password, %{
      email: email,
      password: @default_password
    })
    |> Ash.read_one!(authorize?: false)
  end

  defp read_user(email) do
    import Ash.Expr
    ci_email = Ash.CiString.new(email)

    GameNight.Accounts.User
    |> Ash.Query.filter(expr(email == ^ci_email))
    |> Ash.read_one!(authorize?: false)
  end

  defp register_user!(email) do
    GameNight.Accounts.User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: @default_password,
      password_confirmation: @default_password
    })
    |> Ash.create!(authorize?: false)
  end
end
