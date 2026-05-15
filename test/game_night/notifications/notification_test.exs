defmodule GameNight.Notifications.NotificationTest do
  @moduledoc """
  Action + policy tests for `GameNight.Notifications.Notification`.

  Covers T049 (`:list_mine`, `:count_unread`), T050 (`:mark_read`),
  and the per-action defence-in-depth tests for T051's marker-actor
  rejection.
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Notifications.Notification
  alias GameNight.Notifications.System, as: NotificationsSystem

  describe ":list_mine action (T049)" do
    setup do
      {:ok, user_a} = create_user()
      {:ok, user_b} = create_user()
      {:ok, user_a: user_a, user_b: user_b}
    end

    test "returns only the actor's notifications, newest first", %{user_a: user_a, user_b: user_b} do
      seed_notification!(user_a, subject_id: Ash.UUID.generate())
      :timer.sleep(5)
      newer = seed_notification!(user_a, subject_id: Ash.UUID.generate())
      seed_notification!(user_b, subject_id: Ash.UUID.generate())

      {:ok, results} =
        Notification
        |> Ash.Query.for_read(:list_mine, %{}, actor: user_a)
        |> Ash.read()

      ids = Enum.map(results, & &1.id)
      assert length(ids) == 2
      # Newest first
      assert hd(ids) == newer.id
    end

    test "anonymous caller sees no rows (cross-tenant protection)", %{user_a: user_a} do
      seed_notification!(user_a, subject_id: Ash.UUID.generate())

      # The policy compiles `user_id == ^actor(:id)` to a row filter.
      # With no actor, that filter excludes every row — the caller
      # gets `{:ok, []}` (cross-tenant protection identical to the
      # pattern feature 001 established for Game.list_mine_active).
      result =
        Notification
        |> Ash.Query.for_read(:list_mine, %{})
        |> Ash.read()

      assert match?({:ok, []}, result) or match?({:error, %Ash.Error.Forbidden{}}, result)
    end
  end

  describe ":count_unread action (T049)" do
    setup do
      {:ok, user} = create_user()
      {:ok, user: user}
    end

    test "counts unread + unresolved notifications for the actor", %{user: user} do
      seed_notification!(user, subject_id: Ash.UUID.generate())
      seed_notification!(user, subject_id: Ash.UUID.generate())
      # A notification that's been resolved is excluded.
      resolved =
        seed_notification!(user, subject_id: Ash.UUID.generate())

      mark_resolved!(resolved)

      assert {:ok, 2} =
               Notification
               |> Ash.ActionInput.for_action(:count_unread, %{}, actor: user)
               |> Ash.run_action()
    end

    test "anonymous caller cannot read the count", %{user: user} do
      seed_notification!(user, subject_id: Ash.UUID.generate())

      result =
        Notification
        |> Ash.ActionInput.for_action(:count_unread, %{})
        |> Ash.run_action()

      assert match?({:error, %Ash.Error.Forbidden{}}, result)
    end
  end

  describe ":mark_read action (T050)" do
    setup do
      {:ok, user} = create_user()
      {:ok, other} = create_user()
      notification = seed_notification!(user, subject_id: Ash.UUID.generate())
      {:ok, user: user, other: other, notification: notification}
    end

    test "owner marks their notification read; sets read_at", %{
      user: user,
      notification: notification
    } do
      assert {:ok, updated} =
               notification
               |> Ash.Changeset.for_update(:mark_read, %{}, actor: user)
               |> Ash.update()

      assert %DateTime{} = updated.read_at
    end

    test "different user cannot mark someone else's notification read", %{
      other: other,
      notification: notification
    } do
      assert {:error, %Ash.Error.Forbidden{}} =
               notification
               |> Ash.Changeset.for_update(:mark_read, %{}, actor: other)
               |> Ash.update()
    end

    test "is idempotent — re-mark of already-read row stays valid", %{
      user: user,
      notification: notification
    } do
      {:ok, first} =
        notification
        |> Ash.Changeset.for_update(:mark_read, %{}, actor: user)
        |> Ash.update()

      {:ok, second} =
        first
        |> Ash.Changeset.for_update(:mark_read, %{}, actor: user)
        |> Ash.update()

      assert %DateTime{} = second.read_at
    end
  end

  describe "RPC contract bindings (T055)" do
    test "Notifications domain exposes exactly the three expected RPC bindings" do
      [resource_entry] =
        GameNight.Notifications
        |> Spark.Dsl.Extension.get_entities([:typescript_rpc])

      assert resource_entry.resource == Notification

      bindings =
        resource_entry.rpc_actions
        |> Enum.map(fn %{name: name, action: action} -> {name, action} end)
        |> Enum.sort()

      assert bindings == [
               count_my_unread: :count_unread,
               list_my_notifications: :list_mine,
               mark_notification_read: :mark_read
             ]
    end
  end

  describe "marker-actor rejection on non-bypassed actions (T051 defence in depth)" do
    setup do
      {:ok, user} = create_user()
      seed_notification!(user, subject_id: Ash.UUID.generate())
      {:ok, user: user}
    end

    test "external caller using the system marker actor on :list_mine is rejected" do
      # The marker actor (`%System.Actor{_internal?: true}`) has no
      # `:id` field, so `user_id == ^actor(:id)` evaluates to a
      # forbidden — even though the actor passes
      # `actor_attribute_equals(:_internal?, true)` for the
      # bypass-on-:create_for_invitation/:resolve_for_subject clause.
      result =
        Notification
        |> Ash.Query.for_read(:list_mine, %{}, actor: NotificationsSystem.actor())
        |> Ash.read()

      assert match?({:error, %Ash.Error.Forbidden{}}, result) or match?({:ok, []}, result)
    end

    test "external caller using the system marker actor on :count_unread returns 0", _ctx do
      # `:count_unread` is gated by `actor_present()`. The marker
      # actor is technically present, so the policy admits it — but
      # the action body filters by `user_id == ^actor.id`. Since the
      # marker has no `:id`, the count is 0. (Constitutional
      # equivalent to "fails closed on data scope".)
      assert {:ok, 0} =
               Notification
               |> Ash.ActionInput.for_action(:count_unread, %{},
                 actor: NotificationsSystem.actor()
               )
               |> Ash.run_action()
    end
  end

  describe "feature 003 — schedule notification kinds (T007)" do
    test "all four schedule kinds are accepted by :create_for_invitation" do
      {:ok, user} = create_user()
      subject_id = Ash.UUID.generate()

      for kind <- [
            :schedule_ready_for_availability,
            :schedule_posted,
            :schedule_updated,
            :schedule_reminder
          ] do
        result =
          Notification
          |> Ash.Changeset.for_create(
            :create_for_invitation,
            %{
              user_id: user.id,
              kind: kind,
              subject_type: "schedule",
              subject_id: subject_id
            },
            actor: NotificationsSystem.actor()
          )
          |> Ash.create()

        assert {:ok, %Notification{kind: ^kind}} = result,
               "expected kind #{inspect(kind)} to be accepted, got: #{inspect(result)}"
      end
    end

    test "an unknown kind is rejected by the constraint" do
      {:ok, user} = create_user()

      result =
        Notification
        |> Ash.Changeset.for_create(
          :create_for_invitation,
          %{
            user_id: user.id,
            kind: :totally_invalid_kind,
            subject_type: "schedule",
            subject_id: Ash.UUID.generate()
          },
          actor: NotificationsSystem.actor()
        )
        |> Ash.create()

      assert {:error, %Ash.Error.Invalid{}} = result
    end
  end

  defp create_user do
    email = "notif-test-#{System.unique_integer([:positive])}@example.test"
    password = "notif-test-password-1"

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

  defp mark_resolved!(%Notification{} = notification) do
    notification
    |> Ash.Changeset.for_update(
      :resolve_for_subject,
      %{resolved_at: DateTime.utc_now()},
      actor: NotificationsSystem.actor(),
      authorize?: false
    )
    |> Ash.update!()
  end
end
