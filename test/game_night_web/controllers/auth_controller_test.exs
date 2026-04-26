defmodule GameNightWeb.AuthControllerTest do
  @moduledoc """
  Exercises the SPA contract for `AuthController`: JSON responses on
  `Accept: application/json`, plus the defensive HTML fallback. The
  full Ash action path is covered by higher-level tests; here we
  assert the controller's wire format (status codes, JSON envelope,
  content-negotiation).
  """
  use GameNightWeb.ConnCase, async: false

  require Ash.Query

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers

  @password "sp4mm4ble-password"

  describe "POST /auth/user/password/sign_in (JSON)" do
    setup do
      email = unique_email()
      {:ok, _user} = register_user(email)
      {:ok, email: email}
    end

    test "responds 200 with `{user: {id, email}}` on correct credentials", %{
      conn: conn,
      email: email
    } do
      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> put_req_header("content-type", "application/json")
        |> post(~p"/auth/user/password/sign_in", %{
          "user" => %{"email" => email, "password" => @password}
        })

      assert %{"user" => %{"id" => _id, "email" => ^email}} = json_response(conn, 200)
    end

    test "responds 401 with the `invalid_credentials` envelope on bad password", %{
      conn: conn,
      email: email
    } do
      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> put_req_header("content-type", "application/json")
        |> post(~p"/auth/user/password/sign_in", %{
          "user" => %{"email" => email, "password" => "nope"}
        })

      assert %{"errors" => [error]} = json_response(conn, 401)
      assert error["field"] == nil
      assert error["code"] == "invalid_credentials"
      assert error["message"] =~ ~r/incorrect/i
    end

    test "responds 401 with the same envelope on an unknown email", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> put_req_header("content-type", "application/json")
        |> post(~p"/auth/user/password/sign_in", %{
          "user" => %{"email" => "ghost@example.test", "password" => "whatever"}
        })

      assert %{"errors" => [error]} = json_response(conn, 401)
      assert error["code"] == "invalid_credentials"
    end
  end

  describe "POST /auth/user/password/sign_in (HTML fallback)" do
    test "redirects to `/` with a session cookie on success", %{conn: conn} do
      email = unique_email()
      {:ok, _user} = register_user(email)

      conn =
        post(conn, ~p"/auth/user/password/sign_in", %{
          "user" => %{"email" => email, "password" => @password}
        })

      assert redirected_to(conn, 302) == "/"
    end

    test "redirects to `/sign-in?error=generic` on failure", %{conn: conn} do
      conn =
        post(conn, ~p"/auth/user/password/sign_in", %{
          "user" => %{"email" => "ghost@example.test", "password" => "nope"}
        })

      assert redirected_to(conn, 302) == "/sign-in?error=generic"
    end
  end

  describe "DELETE /sign-out" do
    setup do
      email = unique_email()
      {:ok, _user} = register_user(email)
      {:ok, email: email}
    end

    test "responds 200 with `{ok: true}` on JSON request", %{conn: conn, email: email} do
      conn = sign_in(conn, email)

      conn =
        conn
        |> put_req_header("accept", "application/json")
        |> delete(~p"/sign-out")

      assert json_response(conn, 200) == %{"ok" => true}
      # Session key for the subject should be gone.
      refute get_session(conn, "user_token")
    end

    test "redirects to `/` on HTML request", %{conn: conn, email: email} do
      conn =
        conn
        |> sign_in(email)
        |> delete(~p"/sign-out")

      assert redirected_to(conn, 302) == "/"
    end
  end

  defp register_user(email) do
    GameNight.Accounts.User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: @password,
      password_confirmation: @password
    })
    |> Ash.create(authorize?: false)
  end

  defp sign_in(conn, email) do
    user =
      GameNight.Accounts.User
      |> Ash.Query.for_read(:sign_in_with_password, %{email: email, password: @password})
      |> Ash.read_one!(authorize?: false)

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end

  defp unique_email do
    "auth-test-#{System.unique_integer([:positive])}@example.test"
  end
end
