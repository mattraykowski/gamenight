defmodule GameNightWeb.NotificationsRequestTest do
  @moduledoc """
  End-to-end JSON:API request tests for `/api/notifications/**`
  (T054). Detailed action-layer + policy behaviour is tested in
  `test/game_night/notifications/{notification,system}_test.exs`;
  this file covers the wire contract.
  """
  use GameNightWeb.ConnCase, async: false

  require Ash.Query

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers
  alias GameNight.Accounts.User
  alias GameNight.Notifications.Notification
  alias GameNight.Notifications.System, as: NotificationsSystem

  @jsonapi "application/vnd.api+json"

  describe "GET /api/notifications" do
    setup do
      {:ok, owner} = create_user()
      {:ok, recipient} = create_user()
      seed_notification!(owner, subject_id: Ash.UUID.generate())
      seed_notification!(recipient, subject_id: Ash.UUID.generate())
      {:ok, owner: owner, recipient: recipient}
    end

    test "authenticated user sees only their own notifications", %{conn: conn, owner: owner} do
      conn =
        conn
        |> sign_in(owner)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/notifications")

      assert %{"data" => entries} = json_response(conn, 200)
      assert length(entries) == 1
    end

    test "anonymous caller sees no rows", %{conn: conn} do
      # The policy compiles `user_id == ^actor(:id)` to a row filter;
      # an anonymous request collapses to 200 with empty data — the
      # cross-tenant protection is "you see only your own", not
      # "the endpoint refuses you".
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/notifications")

      if conn.status == 200 do
        assert %{"data" => []} = json_response(conn, 200)
      else
        assert conn.status >= 400
      end
    end
  end

  describe "GET /api/notifications/unread-count" do
    setup do
      {:ok, owner} = create_user()
      seed_notification!(owner, subject_id: Ash.UUID.generate())
      seed_notification!(owner, subject_id: Ash.UUID.generate())
      {:ok, owner: owner}
    end

    test "returns the actor's unread+unresolved count", %{conn: conn, owner: owner} do
      conn =
        conn
        |> sign_in(owner)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/notifications/unread-count")

      # Generic-action route — body is the raw integer.
      assert json_response(conn, 200) == 2
    end

    test "anonymous caller is rejected", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/notifications/unread-count")

      assert conn.status >= 400
    end
  end

  describe "PATCH /api/notifications/:id" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other} = create_user()
      notification = seed_notification!(owner, subject_id: Ash.UUID.generate())
      {:ok, owner: owner, other: other, notification: notification}
    end

    test "owner marks their notification read", %{
      conn: conn,
      owner: owner,
      notification: notification
    } do
      conn =
        conn
        |> sign_in(owner)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/notifications/#{notification.id}", %{
          data: %{type: "notification", id: notification.id, attributes: %{}}
        })

      assert %{"data" => %{"attributes" => attrs}} = json_response(conn, 200)
      assert is_binary(attrs["read_at"])
    end

    test "different user cannot mark someone else's notification read", %{
      conn: conn,
      other: other,
      notification: notification
    } do
      conn =
        conn
        |> sign_in(other)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/notifications/#{notification.id}", %{
          data: %{type: "notification", id: notification.id, attributes: %{}}
        })

      assert conn.status >= 400
    end
  end

  defp create_user do
    email = "notif-req-#{System.unique_integer([:positive])}@example.test"
    password = "notif-req-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp seed_notification!(user, opts) do
    Notification
    |> Ash.Changeset.for_create(
      :create_for_invitation,
      %{
        user_id: user.id,
        kind: :game_invitation,
        subject_type: "invitation",
        subject_id: Keyword.fetch!(opts, :subject_id)
      },
      actor: NotificationsSystem.actor()
    )
    |> Ash.create!()
  end

  defp sign_in(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end
end
