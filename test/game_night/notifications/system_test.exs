defmodule GameNight.Notifications.SystemTest do
  @moduledoc """
  Tests for `GameNight.Notifications.System` — the internal context
  that owns the privileged write paths into the Notification
  resource.

  Covers T051 (system-action behaviour + idempotency + the
  defence-in-depth negative tests).
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Notifications.Notification
  alias GameNight.Notifications.System, as: NotificationsSystem

  describe "create_for_invitation/1 (T051)" do
    test "creates exactly one Notification when a user with the matching email exists" do
      {:ok, user} = create_user("rachel@example.test")

      invitation = stub_invitation(user.email, Ash.UUID.generate())
      assert :ok = NotificationsSystem.create_for_invitation(invitation)

      assert [notification] = list_for(user)
      assert notification.user_id == user.id
      assert notification.kind == :game_invitation
      assert notification.subject_type == "invitation"
      assert notification.subject_id == invitation.id
    end

    test "creates no Notification when no user matches the email" do
      invitation = stub_invitation("nobody@example.test", Ash.UUID.generate())
      assert :ok = NotificationsSystem.create_for_invitation(invitation)

      assert [] =
               Notification
               |> Ash.Query.for_read(:read, %{})
               |> Ash.read!(authorize?: false)
    end

    test "is idempotent on re-call (upsert via :unique_user_subject_kind)" do
      {:ok, user} = create_user("idempotent@example.test")
      invitation = stub_invitation(user.email, Ash.UUID.generate())

      assert :ok = NotificationsSystem.create_for_invitation(invitation)
      assert :ok = NotificationsSystem.create_for_invitation(invitation)

      assert [_only] = list_for(user)
    end
  end

  describe "resolve_for_subject/2 (T051)" do
    test "sets resolved_at on every notification matching subject_type + subject_id" do
      {:ok, user_a} = create_user("a@example.test")
      {:ok, user_b} = create_user("b@example.test")
      shared_subject = Ash.UUID.generate()

      seed_for(user_a, "invitation", shared_subject)
      seed_for(user_b, "invitation", shared_subject)
      # Unrelated subject — should remain unresolved.
      unrelated = seed_for(user_a, "invitation", Ash.UUID.generate())

      assert :ok = NotificationsSystem.resolve_for_subject("invitation", shared_subject)

      [a_row, b_row] =
        Notification
        |> Ash.Query.filter(subject_id == ^shared_subject)
        |> Ash.read!(authorize?: false)

      assert %DateTime{} = a_row.resolved_at
      assert %DateTime{} = b_row.resolved_at

      unrelated_after =
        Notification
        |> Ash.get!(unrelated.id, authorize?: false)

      assert is_nil(unrelated_after.resolved_at)
    end

    test "is a no-op when no rows match" do
      assert :ok =
               NotificationsSystem.resolve_for_subject("invitation", Ash.UUID.generate())
    end
  end

  defp create_user(email) do
    password = "system-test-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp stub_invitation(email, id) do
    # Mirrors the subset of `%GameNight.Games.Invitation{}` that
    # `create_for_invitation/1` reads. Using a plain map here keeps
    # the system-context tests independent of the Invitation
    # resource's lifecycle so an unrelated change to that resource
    # can't silently break this one.
    %{email: Ash.CiString.new(email), id: id}
  end

  defp seed_for(user, subject_type, subject_id) do
    Notification
    |> Ash.Changeset.for_create(
      :create_for_invitation,
      %{
        user_id: user.id,
        kind: :game_invitation,
        subject_type: subject_type,
        subject_id: subject_id
      },
      actor: NotificationsSystem.actor()
    )
    |> Ash.create!()
  end

  defp list_for(user) do
    Notification
    |> Ash.Query.for_read(:list_mine, %{}, actor: user)
    |> Ash.read!()
  end
end
