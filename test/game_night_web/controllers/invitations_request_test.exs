defmodule GameNightWeb.InvitationsRequestTest do
  @moduledoc """
  End-to-end request tests against `/api/invitations/**` for the
  US1 surface (create / preview / accept). Each test exercises the
  full endpoint → router → AshJsonApi → Ash action chain.

  Detailed action-layer + policy behaviour is tested in
  `test/game_night/games/invitation_test.exs`; this file covers the
  JSON:API wire contract — content types, status codes, envelope
  shapes, and the three routes' presence.
  """
  use GameNightWeb.ConnCase, async: false

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers
  alias GameNight.Accounts.User
  alias GameNight.Games.Game
  alias GameNight.Games.Invitation

  @jsonapi "application/vnd.api+json"

  describe "POST /api/invitations (T034 / T030)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, stranger} = create_user()
      {:ok, game} = register_game(owner, %{title: "Curse of Strahd", status: :active})
      drain_emails()
      {:ok, owner: owner, stranger: stranger, game: game}
    end

    test "owner creates an invitation; 201 + invitation payload", %{
      conn: conn,
      owner: owner,
      game: game
    } do
      conn =
        conn
        |> sign_in(owner)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/invitations", %{
          data: %{
            type: "invitation",
            attributes: %{
              email: "rachel@example.test",
              character_name: "Mira Stoneheart",
              character_summary: "Half-orc paladin.",
              gm_notes: "First-time player.",
              game_id: game.id
            }
          }
        })

      assert conn.status in [200, 201]
      body = json_response(conn, conn.status)
      assert %{"data" => %{"type" => "invitation", "attributes" => attrs}} = body
      assert attrs["email"] == "rachel@example.test"
      assert attrs["character_name"] == "Mira Stoneheart"
      assert attrs["status"] == "pending"
    end

    test "anonymous caller cannot create an invitation", %{conn: conn, game: game} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/invitations", %{
          data: %{
            type: "invitation",
            attributes: %{
              email: "rachel@example.test",
              character_name: "X",
              game_id: game.id
            }
          }
        })

      assert conn.status >= 400
    end

    test "non-owner cannot invite to a different GM's game", %{
      conn: conn,
      stranger: stranger,
      game: game
    } do
      conn =
        conn
        |> sign_in(stranger)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> post(~p"/api/invitations", %{
          data: %{
            type: "invitation",
            attributes: %{
              email: "rachel@example.test",
              character_name: "X",
              game_id: game.id
            }
          }
        })

      assert conn.status >= 400
    end
  end

  describe "GET /api/invitations/preview/:token (T034 / T032)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, game} = register_game(owner, %{title: "Lost Mine", status: :active})
      {invitation, token} = create_invitation_with_token(owner, game)
      {:ok, owner: owner, game: game, invitation: invitation, token: token}
    end

    test "valid token returns the preview payload", %{conn: conn, token: token, game: game} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/invitations/preview/#{token}")

      assert conn.status == 200
      # Generic-action routes (`route :get, …, :preview_with_token`)
      # return the action's raw value as JSON, not wrapped in the
      # JSON:API `{"data": {"attributes": …}}` envelope.
      body = json_response(conn, 200)
      assert body["game_title"] == game.title
      assert body["character_name"] == "Mira"
      assert is_binary(body["inviter_email"])
    end

    test "invalid token returns 4xx with an error envelope", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/invitations/preview/garbage-token")

      assert conn.status >= 400
    end
  end

  describe "PATCH /api/invitations/:id/accept (T034 / T033)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, invitee} = create_user()
      {:ok, game} = register_game(owner, %{title: "Roster route", status: :active})
      {invitation, token} = create_invitation_with_token(owner, game)

      {:ok, owner: owner, invitee: invitee, game: game, invitation: invitation, token: token}
    end

    test "logged-in user with token accepts; 200 + status :accepted", %{
      conn: conn,
      invitee: invitee,
      invitation: invitation,
      token: token
    } do
      conn =
        conn
        |> sign_in(invitee)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/invitations/#{invitation.id}/accept", %{
          data: %{token: token}
        })

      assert conn.status == 200
      # Generic-action route — body is the raw action result map.
      body = json_response(conn, 200)
      assert body["status"] == "accepted"
      assert body["id"] == invitation.id
      assert is_binary(body["accepted_player_id"])
    end

    test "anonymous caller cannot accept (no actor)", %{
      conn: conn,
      invitation: invitation,
      token: token
    } do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/invitations/#{invitation.id}/accept", %{
          data: %{token: token}
        })

      assert conn.status >= 400
    end
  end

  describe "PATCH /api/invitations/:id/decline (T089)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, invitee} = create_user()
      {:ok, game} = register_game(gm, %{title: "Decline route", status: :active})
      {invitation, token} = create_invitation_with_token(gm, game)
      {:ok, gm: gm, invitee: invitee, invitation: invitation, token: token}
    end

    test "logged-in user declines via the route; 200 + status :declined", %{
      conn: conn,
      invitee: invitee,
      invitation: invitation,
      token: token
    } do
      conn =
        conn
        |> sign_in(invitee)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/invitations/#{invitation.id}/decline", %{
          data: %{token: token}
        })

      assert conn.status == 200
      body = json_response(conn, 200)
      assert body["status"] == "declined"
    end

    test "anonymous caller cannot decline", %{
      conn: conn,
      invitation: invitation,
      token: token
    } do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/invitations/#{invitation.id}/decline", %{
          data: %{token: token}
        })

      assert conn.status >= 400
    end
  end

  describe "GET /api/invitations/by-game/:game_id/pending (T071)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, other_gm} = create_user()
      {:ok, game} = register_game(gm, %{title: "Pending list", status: :active})
      {invitation, _token} = create_invitation_with_token(gm, game)
      {:ok, gm: gm, other_gm: other_gm, game: game, invitation: invitation}
    end

    test "GM gets the pending list", %{conn: conn, gm: gm, game: game, invitation: invitation} do
      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/invitations/by-game/#{game.id}/pending")

      assert %{"data" => [entry]} = json_response(conn, 200)
      assert entry["id"] == invitation.id
      assert entry["attributes"]["status"] == "pending"
    end

    test "non-GM gets no rows", %{conn: conn, other_gm: other_gm, game: game} do
      conn =
        conn
        |> sign_in(other_gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/invitations/by-game/#{game.id}/pending")

      assert %{"data" => []} = json_response(conn, 200)
    end
  end

  describe "PATCH /api/invitations/:id/revoke (T071)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, other_gm} = create_user()
      {:ok, game} = register_game(gm, %{title: "Revoke", status: :active})
      {invitation, _token} = create_invitation_with_token(gm, game)
      {:ok, gm: gm, other_gm: other_gm, invitation: invitation}
    end

    test "GM revokes; status flips to :revoked", %{
      conn: conn,
      gm: gm,
      invitation: invitation
    } do
      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/invitations/#{invitation.id}/revoke", %{
          data: %{type: "invitation", id: invitation.id, attributes: %{}}
        })

      assert %{"data" => %{"attributes" => %{"status" => "revoked"}}} = json_response(conn, 200)
    end

    test "non-GM cannot revoke", %{
      conn: conn,
      other_gm: other_gm,
      invitation: invitation
    } do
      conn =
        conn
        |> sign_in(other_gm)
        |> put_req_header("accept", @jsonapi)
        |> put_req_header("content-type", @jsonapi)
        |> patch(~p"/api/invitations/#{invitation.id}/revoke", %{
          data: %{type: "invitation", id: invitation.id, attributes: %{}}
        })

      assert conn.status >= 400
    end
  end

  defp create_user do
    email = "invitations-req-#{System.unique_integer([:positive])}@example.test"
    password = "invitations-req-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner, attrs) do
    Game
    |> Ash.Changeset.for_create(:register, attrs, actor: owner)
    |> Ash.create()
  end

  defp create_invitation_with_token(owner, game) do
    drain_emails()

    {:ok, invitation} =
      Invitation
      |> Ash.Changeset.for_create(
        :create_for_game,
        %{
          game_id: game.id,
          email: "rachel@example.test",
          character_name: "Mira",
          character_summary: nil,
          gm_notes: nil
        },
        actor: owner
      )
      |> Ash.create()

    token =
      receive do
        {:email, %{html_body: body}} when is_binary(body) ->
          [_, raw_token] = Regex.run(~r{/invitations/([^"\s<>]+)}, body)
          raw_token
      after
        500 -> raise "no invitation email captured for token extraction"
      end

    {invitation, token}
  end

  defp drain_emails do
    receive do
      {:email, _} -> drain_emails()
    after
      0 -> :ok
    end
  end

  defp sign_in(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end
end
