defmodule GameNight.Schedules.ScheduleParticipantTest do
  @moduledoc """
  T118 — :send_reminder action.

  Per FR-037 / FR-038:
    * GM-only.
    * Excluded for already-submitted participants.
    * Excluded for np_only participants.
    * No rate limit (clicking many times fires many notifications +
      emails).
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Games.{Game, Player}
  alias GameNight.Notifications.Notification
  alias GameNight.Schedules.{Schedule, ScheduleParticipant}

  import Swoosh.TestAssertions

  describe ":send_reminder (T118)" do
    setup do
      ctx = build_ready_schedule_with_member()
      {:ok, ctx}
    end

    test "GM fires a reminder — notification + email per call", %{
      gm: gm,
      member: member,
      participant: participant
    } do
      drain_emails()

      assert {:ok, _} =
               participant
               |> Ash.Changeset.for_update(:send_reminder, %{}, actor: gm)
               |> Ash.update()

      [notification] =
        Notification
        |> Ash.Query.filter(
          subject_type == "schedule" and user_id == ^member.id and
            kind == :schedule_reminder
        )
        |> Ash.read!(authorize?: false)

      assert notification.kind == :schedule_reminder

      assert_email_sent(fn email ->
        email.subject =~ "Reminder" and
          email.to |> List.first() |> elem(1) == to_string(member.email)
      end)
    end

    test "no rate limit — every call produces another notification + email", %{
      gm: gm,
      participant: participant
    } do
      drain_emails()

      for _ <- 1..3 do
        {:ok, _} =
          participant
          |> Ash.Changeset.for_update(:send_reminder, %{}, actor: gm)
          |> Ash.update()
      end

      count =
        Notification
        |> Ash.Query.filter(
          subject_type == "schedule" and subject_id == ^participant.schedule_id and
            kind == :schedule_reminder
        )
        |> Ash.read!(authorize?: false)
        |> length()

      assert count == 3
    end

    test "rejected when the participant has already submitted", %{
      gm: gm,
      member: member,
      participant: participant
    } do
      {:ok, _} =
        participant
        |> Ash.Changeset.for_update(:set_submission, %{}, actor: member)
        |> Ash.update()

      reloaded = Ash.get!(ScheduleParticipant, participant.id, authorize?: false)

      assert {:error, %Ash.Error.Forbidden{}} =
               reloaded
               |> Ash.Changeset.for_update(:send_reminder, %{}, actor: gm)
               |> Ash.update()
    end

    test "rejected for np_only participants", %{gm: gm, participant: participant} do
      {:ok, np} =
        participant
        |> Ash.Changeset.for_update(:update, %{np_only: true},
          actor: GameNight.Schedules.System.actor()
        )
        |> Ash.update()

      assert {:error, %Ash.Error.Forbidden{}} =
               np
               |> Ash.Changeset.for_update(:send_reminder, %{}, actor: gm)
               |> Ash.update()
    end

    test "non-owner cannot send reminders", %{participant: participant} do
      {:ok, intruder} = create_user("intruder")

      assert {:error, %Ash.Error.Forbidden{}} =
               participant
               |> Ash.Changeset.for_update(:send_reminder, %{}, actor: intruder)
               |> Ash.update()
    end
  end

  defp build_ready_schedule_with_member do
    {:ok, gm} = create_user("gm")
    {:ok, game} = register_game(gm)
    {:ok, member} = create_user("member")
    _ = seed_player!(game, member)

    {:ok, schedule} =
      Schedule
      |> Ash.Changeset.for_create(
        :initiate,
        %{
          month: 10,
          year: 2099,
          start_time: ~T[19:00:00],
          end_time: ~T[23:00:00],
          time_zone: "America/Chicago",
          game_id: game.id
        },
        actor: gm
      )
      |> Ash.create()

    {:ok, schedule} =
      schedule
      |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :A}, actor: gm)
      |> Ash.update()

    {:ok, schedule} =
      schedule
      |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
      |> Ash.update()

    [participant] =
      ScheduleParticipant
      |> Ash.Query.filter(schedule_id == ^schedule.id and player.user_id == ^member.id)
      |> Ash.read!(authorize?: false)

    %{gm: gm, game: game, schedule: schedule, member: member, participant: participant}
  end

  defp create_user(prefix) do
    email = "schedule-participant-#{prefix}-#{:erlang.unique_integer([:positive])}@example.test"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: "schedule-participant-test-password-1",
      password_confirmation: "schedule-participant-test-password-1"
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: "Reminder test", status: :active},
      actor: owner
    )
    |> Ash.create()
  end

  defp seed_player!(game, user) do
    Player
    |> Ash.Changeset.for_create(:create, %{
      game_id: game.id,
      user_id: user.id,
      character_name: "Test Char",
      status: :active
    })
    |> Ash.create!(authorize?: false)
  end

  defp drain_emails do
    receive do
      {:email, _} -> drain_emails()
    after
      0 -> :ok
    end
  end
end
