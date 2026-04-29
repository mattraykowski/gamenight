defmodule GameNight.Schedules.SystemTest do
  @moduledoc """
  Foundational tests for `GameNight.Schedules.System`.

  At Phase 2, only T020.6's player-removal-cascade contract is in
  scope. Story phases (US2, US3, US4, US9) extend this file with
  the transition / post / cascade-NA / late-joiner / fan-out flows.
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Games.{Game, Player}
  alias GameNight.Notifications.Notification
  alias GameNight.Schedules.Schedule
  alias GameNight.Schedules.ScheduleParticipant
  alias GameNight.SchedulesFixtures

  import Swoosh.TestAssertions

  describe "Player.destroy → handle_player_destroy/1 (T020.6)" do
    test "destroys a player with no schedule participants (foundational happy path)" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      player = seed_player!(game, member)

      assert :ok =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      assert {:error, _} = Ash.get(Player, player.id, authorize?: false)
    end

    test "destroying a player linked to a :preparing schedule cascades the participant" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      player = seed_player!(game, member)
      schedule = SchedulesFixtures.system_create_preparing_schedule(game)
      _participant = SchedulesFixtures.add_player_link(schedule, player)

      assert :ok =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      assert [] =
               ScheduleParticipant
               |> Ash.Query.filter(player_id == ^player.id)
               |> Ash.read!(authorize?: false)
    end

    test "destroying a player linked to a :ready_for_availability schedule cascades the participant" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      player = seed_player!(game, member)
      schedule = SchedulesFixtures.system_create_preparing_schedule(game)
      _participant = SchedulesFixtures.add_player_link(schedule, player)

      # Force into :ready_for_availability — story phases will use
      # the named transition action; here we mutate the attribute
      # directly via the foundational update default.
      {:ok, _} =
        schedule
        |> Ash.Changeset.for_update(:update, %{status: :ready_for_availability},
          actor: SchedulesFixtures.system_actor()
        )
        |> Ash.update()

      assert :ok =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      assert [] =
               ScheduleParticipant
               |> Ash.Query.filter(player_id == ^player.id)
               |> Ash.read!(authorize?: false)
    end

    test "destroying a player linked to a :posted schedule is rejected (FK RESTRICT preserves history)" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      player = seed_player!(game, member)
      schedule = SchedulesFixtures.system_create_preparing_schedule(game)
      participant = SchedulesFixtures.add_player_link(schedule, player)

      {:ok, _} =
        schedule
        |> Ash.Changeset.for_update(:update, %{status: :posted, posted_at: DateTime.utc_now()},
          actor: SchedulesFixtures.system_actor()
        )
        |> Ash.update()

      assert {:error, _} =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      # Player and participant both untouched — the row stays in
      # place to preserve the schedule's historical record.
      assert {:ok, _} = Ash.get(Player, player.id, authorize?: false)
      preserved = Ash.get!(ScheduleParticipant, participant.id, authorize?: false)
      assert preserved.player_id == player.id
    end
  end

  describe "transition_to_ready end-to-end (T052)" do
    test "fans out one Notification + one email per linked player" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member_a} = create_user()
      {:ok, member_b} = create_user()
      player_a = seed_player!(game, member_a)
      _player_b = seed_player!(game, member_b)

      # Discard registration-confirm emails so the schedule-ready
      # emails are the first ones assert_email_sent matches against.
      drain_emails()

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

      assert {:ok, _ready} =
               schedule
               |> Ash.Changeset.for_update(
                 :transition_to_ready_for_availability,
                 %{},
                 actor: gm
               )
               |> Ash.update()

      # Two Notification rows materialised, one per linked player.
      notifications =
        Notification
        |> Ash.Query.filter(
          subject_type == "schedule" and subject_id == ^schedule.id
        )
        |> Ash.read!(authorize?: false)

      assert length(notifications) == 2

      assert Enum.all?(
               notifications,
               &(&1.kind == :schedule_ready_for_availability)
             )

      user_ids = notifications |> Enum.map(& &1.user_id) |> Enum.sort()
      assert user_ids == Enum.sort([member_a.id, member_b.id])

      # An email landed in the local Swoosh mailbox for each player.
      assert_email_sent(fn email ->
        email.subject =~ "is ready for your availability" and
          email.to |> List.first() |> elem(1) == to_string(member_a.email)
      end)

      assert_email_sent(fn email ->
        email.subject =~ "is ready for your availability" and
          email.to |> List.first() |> elem(1) == to_string(member_b.email)
      end)

      _ = player_a
    end

    test "fan_out_notification telemetry span fires" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      _ = seed_player!(game, member)

      drain_emails()

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

      ref = :telemetry_test.attach_event_handlers(self(), [
        [:game_night, :schedules, :fan_out, :start],
        [:game_night, :schedules, :fan_out, :stop]
      ])

      try do
        {:ok, _} =
          schedule
          |> Ash.Changeset.for_update(
            :transition_to_ready_for_availability,
            %{},
            actor: gm
          )
          |> Ash.update()

        assert_received {[:game_night, :schedules, :fan_out, :start], ^ref, _, _}
        assert_received {[:game_night, :schedules, :fan_out, :stop], ^ref, _, _}
      after
        :telemetry.detach(ref)
      end
    end
  end

  describe "add_late_joiner against :ready_for_availability (T053)" do
    test "creates a participant with is_late_join: true + sends notification" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, original_member} = create_user()
      _ = seed_player!(game, original_member)

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

      {:ok, _ready} =
        schedule
        |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
        |> Ash.update()

      # New member joins after the transition.
      {:ok, late_member} = create_user()

      # Drain after create_user() to discard the confirm-email so
      # the next assert_email_sent matches the schedule-ready email
      # that the after_action will fire.
      drain_emails()

      late_player = seed_player!(game, late_member)

      # The Player create's after_action should have linked them.
      [late_participant] =
        ScheduleParticipant
        |> Ash.Query.filter(schedule_id == ^schedule.id and player_id == ^late_player.id)
        |> Ash.read!(authorize?: false)

      assert late_participant.is_late_join == true
      assert late_participant.np_only == false

      # And per-day NA rows materialised.
      participant_days =
        GameNight.Schedules.ParticipantDay
        |> Ash.Query.filter(participant_id == ^late_participant.id)
        |> Ash.read!(authorize?: false)

      assert length(participant_days) == 31

      # Notification + email fired for the late joiner.
      [notification] =
        Notification
        |> Ash.Query.filter(
          subject_type == "schedule" and subject_id == ^schedule.id and
            user_id == ^late_member.id
        )
        |> Ash.read!(authorize?: false)

      assert notification.kind == :schedule_ready_for_availability

      assert_email_sent(fn email ->
        email.subject =~ "is ready for your availability" and
          email.to |> List.first() |> elem(1) == to_string(late_member.email)
      end)
    end
  end

  describe "add_late_joiner against :posted (T147 / US9)" do
    test "creates an np_only participant with every day :NP and no notification" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, original_member} = create_user()
      _ = seed_player!(game, original_member)

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

      {:ok, ready} =
        schedule
        |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
        |> Ash.update()

      {:ok, posted} =
        ready
        |> Ash.Changeset.for_update(:post, %{}, actor: gm)
        |> Ash.update()

      {:ok, late_member} = create_user()

      drain_emails()

      late_player = seed_player!(game, late_member)

      [late_participant] =
        ScheduleParticipant
        |> Ash.Query.filter(schedule_id == ^posted.id and player_id == ^late_player.id)
        |> Ash.read!(authorize?: false)

      assert late_participant.is_late_join == true
      assert late_participant.np_only == true

      participant_days =
        GameNight.Schedules.ParticipantDay
        |> Ash.Query.filter(participant_id == ^late_participant.id)
        |> Ash.read!(authorize?: false)

      assert length(participant_days) == 31
      assert Enum.all?(participant_days, &(&1.status == :NP))

      assert [] =
               Notification
               |> Ash.Query.filter(
                 subject_type == "schedule" and subject_id == ^posted.id and
                   user_id == ^late_member.id
               )
               |> Ash.read!(authorize?: false)

      assert_no_email_sent()
    end
  end

  defp create_user do
    email = "schedule-system-test-#{System.unique_integer([:positive])}@example.test"
    password = "schedule-system-test-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: "Schedule system test", status: :active},
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
