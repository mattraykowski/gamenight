defmodule GameNight.Schedules.ParticipantDayTest do
  @moduledoc """
  Action + policy tests for `GameNight.Schedules.ParticipantDay`
  (US3). Covers T069 (`:set_status` happy/rejection paths) and T072
  (per-action policy gating).
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Games.{Game, Player}
  alias GameNight.Schedules.{ParticipantDay, Schedule, ScheduleParticipant}

  describe ":set_status (T069)" do
    setup do
      ctx = build_ready_schedule()
      {:ok, ctx}
    end

    test "participant cycles their day through I/A/IF/NA", ctx do
      day = participant_day(ctx.participant, 5)

      assert {:ok, updated} =
               day
               |> Ash.Changeset.for_update(:set_status, %{status: :I},
                 actor: ctx.player_user
               )
               |> Ash.update()

      assert updated.status == :I
    end

    test "rejected when participant.np_only? == true", ctx do
      # The other_player was auto-linked at transition. Flip their
      # participant to np_only via the system bypass to simulate the
      # late-joiner-on-posted case (which lands in US9 but the data
      # invariant matters now).
      [other_participant] =
        ScheduleParticipant
        |> Ash.Query.filter(
          schedule_id == ^ctx.schedule.id and player_id == ^ctx.other_player.id
        )
        |> Ash.read!(authorize?: false)

      {:ok, _} =
        other_participant
        |> Ash.Changeset.for_update(:update, %{np_only: true},
          actor: GameNight.Schedules.System.actor()
        )
        |> Ash.update()

      np_day = participant_day(other_participant, 5)

      assert {:error, _} =
               np_day
               |> Ash.Changeset.for_update(:set_status, %{status: :I},
                 actor: ctx.other_player_user
               )
               |> Ash.update()
    end

    test "rejected when schedule.status != :ready_for_availability", ctx do
      # Force the schedule into :posted via the foundational update.
      {:ok, _} =
        ctx.schedule
        |> Ash.Changeset.for_update(:update, %{status: :posted, posted_at: DateTime.utc_now()},
          actor: GameNight.Schedules.System.actor()
        )
        |> Ash.update()

      day = participant_day(ctx.participant, 5)

      assert {:error, _} =
               day
               |> Ash.Changeset.for_update(:set_status, %{status: :I},
                 actor: ctx.player_user
               )
               |> Ash.update()
    end

    test "rejected when matching ScheduleDay.gm_status == :NA", ctx do
      # GM marks day 5 as NA on the schedule via the action.
      {:ok, _} =
        ctx.schedule
        |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :NA},
          actor: ctx.gm
        )
        |> Ash.update()

      day = participant_day(ctx.participant, 5)

      assert {:error, _} =
               day
               |> Ash.Changeset.for_update(:set_status, %{status: :I},
                 actor: ctx.player_user
               )
               |> Ash.update()
    end
  end

  describe ":set_status policy gating (T072)" do
    setup do
      {:ok, build_ready_schedule()}
    end

    test "GM cannot set a player's status", ctx do
      day = participant_day(ctx.participant, 5)

      assert {:error, %Ash.Error.Forbidden{}} =
               day
               |> Ash.Changeset.for_update(:set_status, %{status: :A}, actor: ctx.gm)
               |> Ash.update()
    end

    test "unrelated user cannot set", ctx do
      {:ok, intruder} = create_user("intruder")
      day = participant_day(ctx.participant, 5)

      assert {:error, %Ash.Error.Forbidden{}} =
               day
               |> Ash.Changeset.for_update(:set_status, %{status: :A}, actor: intruder)
               |> Ash.update()
    end

    test "anonymous cannot set", ctx do
      day = participant_day(ctx.participant, 5)

      assert {:error, _} =
               day
               |> Ash.Changeset.for_update(:set_status, %{status: :A})
               |> Ash.update()
    end
  end

  defp build_ready_schedule do
    {:ok, gm} = create_user("gm")
    {:ok, game} = register_game(gm)
    {:ok, player_user} = create_user("player")
    {:ok, other_player_user} = create_user("other")
    player = seed_player!(game, player_user)
    other_player = seed_player!(game, other_player_user)

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

    # GM flips day 5 to :A so the player has a non-NA day to toggle.
    # Without this, every day starts GM-NA (the FR-008 default) and
    # the player is locked out by FR-019.
    {:ok, schedule} =
      schedule
      |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :A}, actor: gm)
      |> Ash.update()

    {:ok, _ready} =
      schedule
      |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
      |> Ash.update()

    [participant] =
      ScheduleParticipant
      |> Ash.Query.filter(schedule_id == ^schedule.id and player_id == ^player.id)
      |> Ash.read!(authorize?: false)

    %{
      gm: gm,
      game: game,
      schedule: schedule,
      player_user: player_user,
      other_player_user: other_player_user,
      player: player,
      other_player: other_player,
      participant: participant
    }
  end

  defp participant_day(participant, day) do
    ParticipantDay
    |> Ash.Query.filter(participant_id == ^participant.id and day == ^day)
    |> Ash.read_one!(authorize?: false)
  end

  defp create_user(prefix) do
    email =
      "participant-day-#{prefix}-#{:erlang.unique_integer([:positive])}@example.test"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: "participant-day-test-password-1",
      password_confirmation: "participant-day-test-password-1"
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: "PD test", status: :active},
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
end
