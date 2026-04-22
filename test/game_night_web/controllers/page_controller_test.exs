defmodule GameNightWeb.PageControllerTest do
  use GameNightWeb.ConnCase

  describe "GET /" do
    test "serves the SPA shell with a CSRF token", %{conn: conn} do
      conn = get(conn, ~p"/")
      html = html_response(conn, 200)
      assert html =~ ~s(id="app")
      assert html =~ ~s(name="csrf-token")
    end

    test "embeds a JSON auth-state island describing an anonymous session", %{conn: conn} do
      conn = get(conn, ~p"/")
      html = html_response(conn, 200)
      assert html =~ ~s(id="auth-state")
      assert html =~ ~s("user":null)
    end
  end

  describe "GET /dashboard (deep link)" do
    test "returns the SPA shell so the client-side route can boot on hard refresh",
         %{conn: conn} do
      conn = get(conn, "/dashboard")
      html = html_response(conn, 200)
      assert html =~ ~s(id="app")
      assert html =~ ~s(id="auth-state")
    end
  end

  describe "catch-all SPA route" do
    test "returns the SPA shell for any unclaimed path", %{conn: conn} do
      conn = get(conn, "/some/nested/client-route")
      html = html_response(conn, 200)
      assert html =~ ~s(id="app")
    end
  end
end
