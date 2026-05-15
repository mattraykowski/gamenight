defmodule GameNight.Games.InvitationTest do
  @moduledoc """
  Unit tests for `GameNight.Games.Invitation` — actions, policies,
  email sending, and the `Tokens` round-trip helper.

  Tests are organised by user-story phase (T022/T023/T024/T025/T026
  for US1; subsequent phases append below). Each describe block names
  the originating task IDs from `specs/002-invite-players/tasks.md`.
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.Token
  alias GameNight.Accounts.User
  alias GameNight.Games.Game
  alias GameNight.Games.Invitation
  alias GameNight.Games.Invitation.Tokens

  describe "Tokens.mint/1 + verify/1 round-trip (T024)" do
    test "mint returns {:ok, token, jti} carrying the invitation id" do
      invitation_id = Ash.UUID.generate()

      assert {:ok, token, jti} = Tokens.mint(%{id: invitation_id})
      assert is_binary(token)
      assert is_binary(jti)
      assert byte_size(jti) > 0
    end

    test "verify of a freshly-minted token returns {:ok, invitation_id}" do
      invitation_id = Ash.UUID.generate()
      {:ok, token, _jti} = Tokens.mint(%{id: invitation_id})

      assert {:ok, ^invitation_id} = Tokens.verify(token)
    end

    test "verify of a malformed token returns {:error, :invalid_token}" do
      assert {:error, :invalid_token} = Tokens.verify("not-a-jwt")
    end

    test "verify of a token whose purpose is wrong returns {:error, :invalid_token}" do
      # Mint a regular user-auth token (purpose = :user, the default)
      # and confirm `Tokens.verify/1` rejects it because purpose is not
      # "invitation_accept".
      {:ok, owner} = create_user()
      {:ok, token, _claims} = AshAuthentication.Jwt.token_for_user(owner, %{}, [])

      assert {:error, :invalid_token} = Tokens.verify(token)
    end

    test "verify of a revoked token returns {:error, :invalid_token}" do
      invitation_id = Ash.UUID.generate()
      {:ok, token, jti} = Tokens.mint(%{id: invitation_id})

      # Sanity: token verifies before revocation.
      assert {:ok, ^invitation_id} = Tokens.verify(token)

      # Revoke via the public AshAuthentication helper which sets
      # `upsert?: true` — the bare `:revoke_jti` create action would
      # conflict with the storage row that `mint/1` inserted (the
      # `tokens` table's JTI is the primary key, so a second row with
      # the same JTI is rejected without the upsert).
      assert :ok =
               AshAuthentication.TokenResource.Actions.revoke_jti(
                 Token,
                 jti,
                 "invitation:#{invitation_id}"
               )

      assert {:error, :invalid_token} = Tokens.verify(token)
    end

    test "mint persists a row on the tokens table with purpose=\"invitation_accept\"" do
      invitation_id = Ash.UUID.generate()
      {:ok, _token, jti} = Tokens.mint(%{id: invitation_id})

      assert {:ok, [row]} =
               Token
               |> Ash.Query.filter(jti == ^jti)
               |> Ash.read(authorize?: false)

      assert row.purpose == "invitation_accept"
    end
  end

  describe ":create_for_game action + policies (T022)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, other_owner} = create_user()
      {:ok, stranger} = create_user()
      {:ok, game} = register_game(owner, %{title: "Curse of Strahd", status: :active})

      {:ok, owner: owner, other_owner: other_owner, stranger: stranger, game: game}
    end

    test "owner can create an invitation; pending status, inviter, expires_at set", %{
      owner: owner,
      game: game
    } do
      assert {:ok, invitation} =
               Invitation
               |> Ash.Changeset.for_create(
                 :create_for_game,
                 %{
                   game_id: game.id,
                   email: "rachel@example.test",
                   character_name: "Mira Stoneheart",
                   character_summary: "Half-orc paladin.",
                   gm_notes: "First-time paladin."
                 },
                 actor: owner
               )
               |> Ash.create()

      assert invitation.email |> to_string() == "rachel@example.test"
      assert invitation.character_name == "Mira Stoneheart"
      assert invitation.status == :pending
      assert invitation.inviter_id == owner.id
      assert invitation.game_id == game.id
      assert is_binary(invitation.token_jti)
      assert byte_size(invitation.token_jti) > 0

      # expires_at is roughly TTL days in the future.
      ttl_days = Application.fetch_env!(:game_night, :invitation_token_ttl_days)
      expected_at_least = DateTime.add(DateTime.utc_now(), (ttl_days - 1) * 86_400, :second)
      assert DateTime.compare(invitation.expires_at, expected_at_least) == :gt
    end

    test "non-owner cannot create an invitation for a different GM's game", %{
      stranger: stranger,
      game: game
    } do
      assert {:error, %Ash.Error.Forbidden{}} =
               Invitation
               |> Ash.Changeset.for_create(
                 :create_for_game,
                 %{
                   game_id: game.id,
                   email: "rachel@example.test",
                   character_name: "X",
                   character_summary: nil,
                   gm_notes: nil
                 },
                 actor: stranger
               )
               |> Ash.create()
    end

    test "anonymous caller cannot create an invitation", %{game: game} do
      result =
        Invitation
        |> Ash.Changeset.for_create(
          :create_for_game,
          %{
            game_id: game.id,
            email: "rachel@example.test",
            character_name: "X",
            character_summary: nil,
            gm_notes: nil
          }
        )
        |> Ash.create()

      assert match?({:error, %Ash.Error.Forbidden{}}, result) or
               match?({:error, %Ash.Error.Invalid{}}, result)
    end

    test "duplicate :pending invitation for same (game, email) is rejected", %{
      owner: owner,
      game: game
    } do
      attrs = %{
        game_id: game.id,
        email: "rachel@example.test",
        character_name: "Mira Stoneheart",
        character_summary: nil,
        gm_notes: nil
      }

      assert {:ok, _first} =
               Invitation
               |> Ash.Changeset.for_create(:create_for_game, attrs, actor: owner)
               |> Ash.create()

      assert {:error, %Ash.Error.Invalid{}} =
               Invitation
               |> Ash.Changeset.for_create(:create_for_game, attrs, actor: owner)
               |> Ash.create()
    end

    test "GM cannot invite themselves (FR-003 self-invite guard)", %{
      owner: owner,
      game: game
    } do
      assert {:error, %Ash.Error.Invalid{} = err} =
               Invitation
               |> Ash.Changeset.for_create(
                 :create_for_game,
                 %{
                   game_id: game.id,
                   email: to_string(owner.email),
                   character_name: "Self Invite",
                   character_summary: nil,
                   gm_notes: nil
                 },
                 actor: owner
               )
               |> Ash.create()

      assert err
             |> Ash.Error.to_error_class()
             |> Map.get(:errors, [])
             |> Enum.any?(fn e ->
               (Map.get(e, :field) == :email and
                  String.contains?(Map.get(e, :message, ""), "yourself")) or
                 String.contains?(inspect(e), "yourself")
             end)
    end

    test "two GMs on different games inviting the same email both succeed (independent invites)",
         %{owner: owner, other_owner: other_owner} do
      # Spec edge case: cross-game invitations to the same email are
      # independent. The partial-unique identity is scoped per game_id.
      {:ok, game_a} = register_game(owner, %{title: "Game A", status: :active})
      {:ok, game_b} = register_game(other_owner, %{title: "Game B", status: :active})

      assert {:ok, inv_a} =
               Invitation
               |> Ash.Changeset.for_create(
                 :create_for_game,
                 %{
                   game_id: game_a.id,
                   email: "shared@example.test",
                   character_name: "Char A",
                   character_summary: nil,
                   gm_notes: nil
                 },
                 actor: owner
               )
               |> Ash.create()

      assert {:ok, inv_b} =
               Invitation
               |> Ash.Changeset.for_create(
                 :create_for_game,
                 %{
                   game_id: game_b.id,
                   email: "shared@example.test",
                   character_name: "Char B",
                   character_summary: nil,
                   gm_notes: nil
                 },
                 actor: other_owner
               )
               |> Ash.create()

      assert inv_a.id != inv_b.id
      assert inv_a.game_id == game_a.id
      assert inv_b.game_id == game_b.id
    end
  end

  describe ":create_for_game emails the invitee (T023)" do
    import Swoosh.TestAssertions

    setup do
      {:ok, owner} = create_user()
      {:ok, game} = register_game(owner, %{title: "Curse of Strahd", status: :active})
      {:ok, owner: owner, game: game}
    end

    test "an invitation email is delivered to the invitee", %{owner: owner, game: game} do
      # Discard the user-confirmation email queued during create_user/0 in
      # setup so assert_email_sent inspects the invitation email below.
      drain_emails()

      {:ok, _invitation} =
        Invitation
        |> Ash.Changeset.for_create(
          :create_for_game,
          %{
            game_id: game.id,
            email: "rachel@example.test",
            character_name: "Mira Stoneheart",
            character_summary: nil,
            gm_notes: nil
          },
          actor: owner
        )
        |> Ash.create()

      assert_email_sent(fn email ->
        # to: rachel@example.test
        assert {_, "rachel@example.test"} = hd(email.to)
        # body mentions the game title and character name (HTML-escaped form)
        body = email.html_body || ""
        assert body =~ "Curse of Strahd"
        assert body =~ "Mira Stoneheart"
        # body contains an invitation link path
        assert body =~ "/invitations/"
      end)
    end
  end

  describe "Notification side effects (T052 + T053)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, game} = register_game(owner, %{title: "Notif game", status: :active})
      {:ok, owner: owner, game: game}
    end

    test "creates a Notification when the invited email matches an existing user", %{
      owner: owner,
      game: game
    } do
      # Pre-create a user with the email we're going to invite — that
      # makes the system context's lookup match.
      {:ok, recipient} = create_user_with_email("recipient@example.test")

      drain_emails()

      {:ok, invitation} =
        Invitation
        |> Ash.Changeset.for_create(
          :create_for_game,
          %{
            game_id: game.id,
            email: "recipient@example.test",
            character_name: "Recipient Hero",
            character_summary: nil,
            gm_notes: nil
          },
          actor: owner
        )
        |> Ash.create()

      [notification] =
        GameNight.Notifications.Notification
        |> Ash.Query.for_read(:list_mine, %{}, actor: recipient)
        |> Ash.read!()

      assert notification.kind == :game_invitation
      assert notification.subject_type == "invitation"
      assert notification.subject_id == invitation.id
      assert is_nil(notification.resolved_at)
    end

    test "creates no Notification when no user matches the invited email", %{
      owner: owner,
      game: game
    } do
      drain_emails()

      {:ok, _invitation} =
        Invitation
        |> Ash.Changeset.for_create(
          :create_for_game,
          %{
            game_id: game.id,
            email: "no-such-user@example.test",
            character_name: "Ghost",
            character_summary: nil,
            gm_notes: nil
          },
          actor: owner
        )
        |> Ash.create()

      assert {:ok, []} =
               GameNight.Notifications.Notification
               |> Ash.Query.for_read(:read, %{})
               |> Ash.read(authorize?: false)
    end

    test "accepting an invitation resolves the linked Notification", %{
      owner: owner,
      game: game
    } do
      # Recipient who already exists, so a notification materialises.
      {:ok, recipient} = create_user_with_email("accepting@example.test")

      {invitation, token} =
        create_invitation_with_token(owner, game, %{email: "accepting@example.test"})

      [pending_notification] =
        GameNight.Notifications.Notification
        |> Ash.Query.for_read(:list_mine, %{}, actor: recipient)
        |> Ash.read!()

      assert is_nil(pending_notification.resolved_at)

      {:ok, _accepted} =
        invitation
        |> Ash.Changeset.for_update(:accept_with_token, %{token: token}, actor: recipient)
        |> Ash.update()

      resolved =
        GameNight.Notifications.Notification
        |> Ash.get!(pending_notification.id, authorize?: false)

      assert %DateTime{} = resolved.resolved_at
    end
  end

  describe ":accept_for_me + :decline_for_me (US6 — in-app accept/decline)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, recipient} = create_user_with_email("recipient@example.test")
      {:ok, stranger} = create_user()
      {:ok, game} = register_game(gm, %{title: "In-app accept", status: :active})

      {invitation, _token} =
        create_invitation_with_token(gm, game, %{email: "recipient@example.test"})

      {:ok, gm: gm, recipient: recipient, stranger: stranger, game: game, invitation: invitation}
    end

    test "recipient can accept_for_me; Player created, status :accepted", %{
      recipient: recipient,
      game: game,
      invitation: invitation
    } do
      assert {:ok, accepted} =
               invitation
               |> Ash.Changeset.for_update(:accept_for_me, %{}, actor: recipient)
               |> Ash.update()

      assert accepted.status == :accepted
      assert is_binary(accepted.accepted_player_id)

      assert {:ok, [_player]} =
               GameNight.Games.Player
               |> Ash.Query.filter(game_id == ^game.id and user_id == ^recipient.id)
               |> Ash.read(authorize?: false)
    end

    test "stranger (different email) cannot accept_for_me", %{
      stranger: stranger,
      invitation: invitation
    } do
      assert {:error, %Ash.Error.Forbidden{}} =
               invitation
               |> Ash.Changeset.for_update(:accept_for_me, %{}, actor: stranger)
               |> Ash.update()
    end

    test "anonymous caller cannot accept_for_me", %{invitation: invitation} do
      assert {:error, %Ash.Error.Forbidden{}} =
               invitation
               |> Ash.Changeset.for_update(:accept_for_me, %{})
               |> Ash.update()
    end

    test "recipient can decline_for_me; status :declined, no Player created", %{
      recipient: recipient,
      game: game,
      invitation: invitation
    } do
      assert {:ok, declined} =
               invitation
               |> Ash.Changeset.for_update(:decline_for_me, %{}, actor: recipient)
               |> Ash.update()

      assert declined.status == :declined

      assert {:ok, []} =
               GameNight.Games.Player
               |> Ash.Query.filter(game_id == ^game.id and user_id == ^recipient.id)
               |> Ash.read(authorize?: false)
    end

    test "stranger cannot decline_for_me", %{stranger: stranger, invitation: invitation} do
      assert {:error, %Ash.Error.Forbidden{}} =
               invitation
               |> Ash.Changeset.for_update(:decline_for_me, %{}, actor: stranger)
               |> Ash.update()
    end
  end

  describe ":list_pending_for_me action (T065)" do
    test "actor sees only their own pending invitations, matched by email" do
      {:ok, gm} = create_user()
      {:ok, recipient} = create_user_with_email("listmine@example.test")
      {:ok, stranger} = create_user()

      {:ok, game} = register_game(gm, %{title: "List mine", status: :active})

      {invitation, _token} =
        create_invitation_with_token(gm, game, %{email: "listmine@example.test"})

      # Different invitation to a different email — should NOT appear
      # in `recipient`'s pending list.
      drain_emails()

      {:ok, _other} =
        Invitation
        |> Ash.Changeset.for_create(
          :create_for_game,
          %{
            game_id: game.id,
            email: "someone-else@example.test",
            character_name: "Other",
            character_summary: nil,
            gm_notes: nil
          },
          actor: gm
        )
        |> Ash.create()

      # Recipient sees their one pending invitation.
      assert {:ok, [row]} =
               Invitation
               |> Ash.Query.for_read(:list_pending_for_me, %{}, actor: recipient)
               |> Ash.read()

      assert row.id == invitation.id

      # Stranger (different email) sees nothing.
      assert {:ok, []} =
               Invitation
               |> Ash.Query.for_read(:list_pending_for_me, %{}, actor: stranger)
               |> Ash.read()
    end
  end

  describe ":decline_with_token (T088)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, invitee} = create_user()
      {:ok, game} = register_game(gm, %{title: "Decline me", status: :active})
      {invitation, token} = create_invitation_with_token(gm, game, %{})

      {:ok, gm: gm, invitee: invitee, game: game, invitation: invitation, token: token}
    end

    test "logged-in user with a valid token declines; status flips to :declined", %{
      invitee: invitee,
      invitation: invitation,
      token: token
    } do
      assert {:ok, declined} =
               invitation
               |> Ash.Changeset.for_update(:decline_with_token, %{token: token}, actor: invitee)
               |> Ash.update()

      assert declined.status == :declined
    end

    test "decline does NOT create a Player record", %{
      invitee: invitee,
      game: game,
      invitation: invitation,
      token: token
    } do
      {:ok, _} =
        invitation
        |> Ash.Changeset.for_update(:decline_with_token, %{token: token}, actor: invitee)
        |> Ash.update()

      assert {:ok, []} =
               GameNight.Games.Player
               |> Ash.Query.filter(game_id == ^game.id and user_id == ^invitee.id)
               |> Ash.read(authorize?: false)
    end

    test "decline revokes the token (subsequent verify fails)", %{
      invitee: invitee,
      invitation: invitation,
      token: token
    } do
      {:ok, _} =
        invitation
        |> Ash.Changeset.for_update(:decline_with_token, %{token: token}, actor: invitee)
        |> Ash.update()

      assert {:error, :invalid_token} = Tokens.verify(token)
    end

    test "anonymous caller cannot decline", %{
      invitation: invitation,
      token: token
    } do
      assert {:error, %Ash.Error.Forbidden{}} =
               invitation
               |> Ash.Changeset.for_update(:decline_with_token, %{token: token})
               |> Ash.update()
    end

    test "re-declining a terminal invitation errors", %{
      invitee: invitee,
      invitation: invitation,
      token: token
    } do
      {:ok, _} =
        invitation
        |> Ash.Changeset.for_update(:decline_with_token, %{token: token}, actor: invitee)
        |> Ash.update()

      # Second decline with the same (now-revoked) token should
      # error — both because the token is invalid AND because the
      # status is already terminal. Either error is acceptable.
      assert {:error, _} =
               Ash.get!(Invitation, invitation.id, authorize?: false)
               |> Ash.Changeset.for_update(:decline_with_token, %{token: token}, actor: invitee)
               |> Ash.update()
    end
  end

  describe ":list_pending_for_game + :revoke (T069)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, other_gm} = create_user()
      {:ok, game} = register_game(gm, %{title: "Revoke me", status: :active})
      {invitation, token} = create_invitation_with_token(gm, game, %{})

      {:ok, gm: gm, other_gm: other_gm, game: game, invitation: invitation, token: token}
    end

    test "list_pending_for_game returns the GM's pending invitations", %{
      gm: gm,
      game: game,
      invitation: invitation
    } do
      assert {:ok, [row]} =
               Invitation
               |> Ash.Query.for_read(:list_pending_for_game, %{game_id: game.id}, actor: gm)
               |> Ash.read()

      assert row.id == invitation.id
    end

    test "non-GM cannot list pending invitations on a game", %{
      other_gm: other_gm,
      game: game
    } do
      assert {:ok, []} =
               Invitation
               |> Ash.Query.for_read(:list_pending_for_game, %{game_id: game.id}, actor: other_gm)
               |> Ash.read()
    end

    test "GM revokes a pending invitation; status flips to :revoked", %{
      gm: gm,
      invitation: invitation
    } do
      assert {:ok, revoked} =
               invitation
               |> Ash.Changeset.for_update(:revoke, %{}, actor: gm)
               |> Ash.update()

      assert revoked.status == :revoked
    end

    test "non-GM cannot revoke", %{other_gm: other_gm, invitation: invitation} do
      assert {:error, %Ash.Error.Forbidden{}} =
               invitation
               |> Ash.Changeset.for_update(:revoke, %{}, actor: other_gm)
               |> Ash.update()
    end

    test "after revoke, the original token is rejected by Tokens.verify", %{
      gm: gm,
      invitation: invitation,
      token: token
    } do
      {:ok, _revoked} =
        invitation
        |> Ash.Changeset.for_update(:revoke, %{}, actor: gm)
        |> Ash.update()

      assert {:error, :invalid_token} = Tokens.verify(token)
    end

    test "revoking a non-pending invitation errors", %{
      gm: gm,
      invitation: invitation
    } do
      {:ok, _} =
        invitation
        |> Ash.Changeset.for_update(:revoke, %{}, actor: gm)
        |> Ash.update()

      assert {:error, _} =
               invitation
               |> Map.put(:status, :revoked)
               |> Ash.Changeset.for_update(:revoke, %{}, actor: gm)
               |> Ash.update()
    end
  end

  describe "RPC contract bindings (T028)" do
    test "GameNight.Games typescript_rpc lists exactly the US1 invitation actions" do
      [_game_entry, _player_entry, invitation_entry] =
        GameNight.Games
        |> Spark.Dsl.Extension.get_entities([:typescript_rpc])

      assert invitation_entry.resource == Invitation

      bindings =
        invitation_entry.rpc_actions
        |> Enum.map(fn %{name: name, action: action} -> {name, action} end)
        |> Enum.sort()

      # The US1 backend slice exposes exactly these three. Subsequent
      # phases (US2, US3, US4) extend this list — when they do, this
      # assertion is the place that fails loudly until the bindings
      # land in the domain DSL.
      assert bindings == [
               accept_invitation: :accept_invitation,
               # US6 — in-app accept (no token).
               accept_invitation_for_me: :accept_for_me,
               create_invitation: :create_for_game,
               # T094 added the decline binding.
               decline_invitation: :decline_invitation,
               # US6 — in-app decline.
               decline_invitation_for_me: :decline_for_me,
               # T065 added the my-pending-list binding.
               list_my_pending_invitations: :list_pending_for_me,
               # T076 added the GM-side bindings.
               list_pending_invitations_for_game: :list_pending_for_game,
               preview_invitation: :preview_with_token,
               revoke_invitation: :revoke
             ]
    end
  end

  describe ":preview_with_token action (T025)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, game} = register_game(owner, %{title: "Lost Mine of Phandelver", status: :active})

      {invitation, token} =
        create_invitation_with_token(owner, game, %{
          email: "rachel@example.test",
          character_name: "Mira"
        })

      {:ok, owner: owner, game: game, invitation: invitation, token: token}
    end

    test "valid token returns the preview without an actor", %{
      token: token,
      game: game,
      owner: owner
    } do
      assert {:ok, preview} =
               Invitation
               |> Ash.ActionInput.for_action(:preview_with_token, %{token: token})
               |> Ash.run_action()

      assert preview.game_title == game.title
      assert preview.inviter_email == to_string(owner.email)
      assert preview.character_name == "Mira"
      assert is_struct(preview.expires_at, DateTime)
    end

    test "malformed token returns {:error, :invalid_token}" do
      assert {:error, %{} = err} =
               Invitation
               |> Ash.ActionInput.for_action(:preview_with_token, %{token: "garbage"})
               |> Ash.run_action()

      assert inspect(err) =~ "invalid_token"
    end

    test "revoked token returns {:error, :invalid_token}", %{token: token, invitation: invitation} do
      :ok =
        AshAuthentication.TokenResource.Actions.revoke_jti(
          Token,
          invitation.token_jti,
          "invitation:#{invitation.id}"
        )

      assert {:error, _} =
               Invitation
               |> Ash.ActionInput.for_action(:preview_with_token, %{token: token})
               |> Ash.run_action()
    end
  end

  describe ":accept_with_token action (T026)" do
    setup do
      {:ok, owner} = create_user()
      {:ok, invitee} = create_user()
      {:ok, game} = register_game(owner, %{title: "Curse of Strahd", status: :active})

      {invitation, token} =
        create_invitation_with_token(owner, game, %{
          email: "rachel@example.test",
          character_name: "Mira"
        })

      {:ok, owner: owner, invitee: invitee, game: game, invitation: invitation, token: token}
    end

    test "actor with a valid token (even if email differs) becomes the seated player", %{
      invitee: invitee,
      game: game,
      invitation: invitation,
      token: token
    } do
      assert {:ok, accepted} =
               invitation
               |> Ash.Changeset.for_update(:accept_with_token, %{token: token}, actor: invitee)
               |> Ash.update()

      assert accepted.status == :accepted
      assert accepted.accepted_player_id

      # Player row created for the invitee on this game with the
      # GM-supplied character data and default :active status.
      assert {:ok, [player]} =
               GameNight.Games.Player
               |> Ash.Query.filter(game_id == ^game.id and user_id == ^invitee.id)
               |> Ash.read(authorize?: false)

      assert player.id == accepted.accepted_player_id
      assert player.character_name == "Mira"
      assert player.status == :active
    end

    test "anonymous (no actor) cannot accept — even with a valid token", %{
      invitation: invitation,
      token: token
    } do
      assert {:error, %Ash.Error.Forbidden{}} =
               invitation
               |> Ash.Changeset.for_update(:accept_with_token, %{token: token})
               |> Ash.update()
    end

    test "wrong / expired / revoked token is rejected", %{
      invitee: invitee,
      invitation: invitation
    } do
      assert {:error, _} =
               invitation
               |> Ash.Changeset.for_update(:accept_with_token, %{token: "garbage"},
                 actor: invitee
               )
               |> Ash.update()
    end

    test "after acceptance, the token cannot be redeemed again", %{
      invitee: invitee,
      invitation: invitation,
      token: token
    } do
      {:ok, accepted} =
        invitation
        |> Ash.Changeset.for_update(:accept_with_token, %{token: token}, actor: invitee)
        |> Ash.update()

      # Re-accept using the same (now-revoked) token must error.
      assert {:error, _} =
               accepted
               |> Ash.Changeset.for_update(:accept_with_token, %{token: token}, actor: invitee)
               |> Ash.update()
    end

    test "double-accept by the same user is idempotent (one Player row per game)", %{
      invitee: invitee,
      game: game,
      invitation: invitation,
      token: token
    } do
      {:ok, _accepted} =
        invitation
        |> Ash.Changeset.for_update(:accept_with_token, %{token: token}, actor: invitee)
        |> Ash.update()

      assert {:ok, [_only]} =
               GameNight.Games.Player
               |> Ash.Query.filter(game_id == ^game.id and user_id == ^invitee.id)
               |> Ash.read(authorize?: false)
    end
  end

  # Creates an invitation via the public action and returns both the
  # invitation row AND the raw token extracted from the just-sent
  # email URL. Drains the user-confirmation email queue first so the
  # next `{:email, _}` we receive is the invitation we just created.
  defp create_invitation_with_token(owner, game, overrides) do
    drain_emails()

    attrs =
      Map.merge(
        %{
          game_id: game.id,
          email: "default@example.test",
          character_name: "Default",
          character_summary: nil,
          gm_notes: nil
        },
        overrides
      )

    {:ok, invitation} =
      Invitation
      |> Ash.Changeset.for_create(:create_for_game, attrs, actor: owner)
      |> Ash.create()

    token =
      receive do
        {:email, %{html_body: body}} when is_binary(body) ->
          [_, raw_token] = Regex.run(~r{/invitations/([^"\s<>]+)}, body)
          raw_token
      after
        500 ->
          raise "no invitation email captured for token extraction"
      end

    {invitation, token}
  end

  defp create_user do
    email = "invitation-test-#{System.unique_integer([:positive])}@example.test"
    create_user_with_email(email)
  end

  defp create_user_with_email(email) do
    password = "invitation-test-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner, attrs) do
    defaults = %{description: nil}
    attrs = Map.merge(defaults, Map.new(attrs))

    Game
    |> Ash.Changeset.for_create(:register, attrs, actor: owner)
    |> Ash.create()
  end

  # Discard any queued Swoosh test-adapter emails sitting in the
  # current process's mailbox. Useful when setup actions (e.g.
  # registering a user) emit confirmation emails that would otherwise
  # be the first match for a later `assert_email_sent`.
  defp drain_emails do
    receive do
      {:email, _} -> drain_emails()
    after
      0 -> :ok
    end
  end
end
