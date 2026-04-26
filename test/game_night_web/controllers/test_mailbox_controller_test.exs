defmodule GameNightWeb.TestMailboxControllerTest do
  @moduledoc """
  Unit tests for the dev-routes `/test/mailbox` controller. The route
  itself is only mounted under `:dev_routes`, so we bypass the router
  and invoke the controller actions directly with a plain `conn`. The
  Playwright specs exercise the full HTTP path against `mix phx.server`.
  """
  use GameNightWeb.ConnCase, async: false

  alias GameNightWeb.TestMailboxController
  alias Swoosh.Adapters.Local.Storage.Memory

  setup do
    Memory.delete_all()
    :ok
  end

  describe "index/2" do
    test "returns all emails newest-first when no recipient filter is given" do
      push_email(to: "first@example.test", subject: "First")
      push_email(to: "second@example.test", subject: "Second")

      conn = TestMailboxController.index(make_conn(), %{})

      assert conn.status == 200
      assert %{"emails" => [latest, earlier]} = Jason.decode!(conn.resp_body)
      assert latest["subject"] == "Second"
      assert earlier["subject"] == "First"
    end

    test "filters by recipient (case-insensitive, trimmed)" do
      push_email(to: "target@example.test", subject: "Target")
      push_email(to: "other@example.test", subject: "Other")

      conn =
        TestMailboxController.index(make_conn(), %{"to" => "  TARGET@example.test  "})

      assert %{"emails" => [email]} = Jason.decode!(conn.resp_body)
      assert email["subject"] == "Target"
      [%{"address" => address}] = email["to"]
      assert address == "target@example.test"
    end

    test "serialises html_body/text_body so fixtures can extract link URLs" do
      push_email(
        to: "link@example.test",
        subject: "Click here",
        html: ~s(<p><a href="/confirm_new_user/abc123">Confirm</a></p>)
      )

      conn =
        TestMailboxController.index(make_conn(), %{"to" => "link@example.test"})

      assert %{"emails" => [email]} = Jason.decode!(conn.resp_body)
      assert email["html_body"] =~ ~s(href="/confirm_new_user/abc123")
    end
  end

  describe "clear/2" do
    test "empties the mailbox and returns {ok: true}" do
      push_email(to: "delete-me@example.test", subject: "Gone")

      conn = TestMailboxController.clear(make_conn(), %{})

      assert conn.status == 200
      assert Jason.decode!(conn.resp_body) == %{"ok" => true}
      assert Memory.all() == []
    end
  end

  defp make_conn do
    Phoenix.ConnTest.build_conn()
    |> Plug.Conn.put_private(:phoenix_endpoint, GameNightWeb.Endpoint)
  end

  defp push_email(opts) do
    import Swoosh.Email

    new()
    |> from({"noreply", "noreply@example.test"})
    |> to(opts[:to])
    |> subject(opts[:subject] || "Test")
    |> html_body(opts[:html] || "<p>body</p>")
    |> text_body(opts[:text] || "body")
    |> Memory.push()
  end
end
