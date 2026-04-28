defmodule GameNight.Schedules.ScheduleTest do
  @moduledoc """
  Action + policy + calculation tests for `GameNight.Schedules.Schedule`.

  Phase 3 (US1) coverage:
    * T021 — `:initiate` happy path + validation branches
    * T022 — `:name` calculation (separate file, but exercised here)
    * T023 — `:set_gm_day` cycle + state-guard rejection on :posted
    * T024 — `:list_for_game` / `:list_for_game_top_six` / `:get_for_game`
    * T025 — policy gating (GM-only, non-owner forbidden, anonymous forbidden)
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Games.Game
  alias GameNight.Schedules.Schedule

  describe ":initiate action (T021)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, gm: gm, game: game}
    end

    test "creates a :preparing schedule and 31 ScheduleDay rows for October", %{
      gm: gm,
      game: game
    } do
      assert {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})

      assert schedule.status == :preparing
      assert schedule.month == 10
      assert schedule.year == 2099

      days = list_schedule_days(schedule)
      assert length(days) == 31
      assert Enum.all?(days, fn d -> d.gm_status == :NA end)
      assert Enum.map(days, & &1.day) |> Enum.sort() == Enum.to_list(1..31)
    end

    test "creates 28 days for non-leap February", %{gm: gm, game: game} do
      assert {:ok, schedule} = initiate(gm, game, %{month: 2, year: 2099})
      assert length(list_schedule_days(schedule)) == 28
    end

    test "creates 29 days for leap February", %{gm: gm, game: game} do
      assert {:ok, schedule} = initiate(gm, game, %{month: 2, year: 2096})
      assert length(list_schedule_days(schedule)) == 29
    end

    test "rejects a duplicate (game, year, month)", %{gm: gm, game: game} do
      {:ok, _first} = initiate(gm, game, %{month: 10, year: 2099})

      assert {:error, %Ash.Error.Invalid{} = err} =
               initiate(gm, game, %{month: 10, year: 2099})

      # Identity violation surfaces as "has already been taken" on
      # `game_id`. The user-facing copy in the SPA route maps this
      # error to FR-002's friendly message; here we just assert the
      # rejection is surfaced as an invalid-attribute error.
      assert Exception.message(err) =~ "already been taken"
    end

    test "rejects a month strictly before the current month in the GM's timezone", %{
      gm: gm,
      game: game
    } do
      # Use a tz-aware comparison: schedule for January 2024 (past
      # at the time these tests run; the year constraint allows 2024
      # so we exercise the validation, not the bound).
      assert {:error, %Ash.Error.Invalid{} = err} =
               initiate(gm, game, %{month: 1, year: 2024, time_zone: "America/Chicago"})

      assert Exception.message(err) =~ "current month or later"
    end

    test "allows the current month even if today is the last day", %{gm: gm, game: game} do
      now = DateTime.utc_now()

      assert {:ok, _schedule} =
               initiate(gm, game, %{month: now.month, year: now.year})
    end

    test "rejects an unknown timezone", %{gm: gm, game: game} do
      assert {:error, %Ash.Error.Invalid{} = err} =
               initiate(gm, game, %{
                 month: 10,
                 year: 2099,
                 time_zone: "Atlantis/Lost_City"
               })

      assert Exception.message(err) =~ "timezone" or Exception.message(err) =~ "time_zone"
    end

    test "accepts a midnight-crossing time slot", %{gm: gm, game: game} do
      assert {:ok, schedule} =
               initiate(gm, game, %{
                 month: 10,
                 year: 2099,
                 start_time: ~T[22:00:00],
                 end_time: ~T[02:00:00]
               })

      assert schedule.start_time == ~T[22:00:00]
      assert schedule.end_time == ~T[02:00:00]
    end
  end

  describe ":set_gm_day action (T023)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})
      {:ok, gm: gm, game: game, schedule: schedule}
    end

    test "cycles NA → I → A → IF → NA on the same day", %{gm: gm, schedule: schedule} do
      # Day 5 starts at NA (the default).
      {:ok, schedule} = set_gm_day(gm, schedule, 5, :I)
      assert day_status(schedule, 5) == :I

      {:ok, schedule} = set_gm_day(gm, schedule, 5, :A)
      assert day_status(schedule, 5) == :A

      {:ok, schedule} = set_gm_day(gm, schedule, 5, :IF)
      assert day_status(schedule, 5) == :IF

      {:ok, schedule} = set_gm_day(gm, schedule, 5, :NA)
      assert day_status(schedule, 5) == :NA
    end

    test "cascade does not fire while status is :preparing", %{
      gm: gm,
      schedule: schedule
    } do
      # No participants linked at :preparing; just verify the action
      # runs cleanly and doesn't error trying to fan out.
      assert {:ok, _} = set_gm_day(gm, schedule, 5, :NA)
    end

    @tag :pending_state_guard
    test "rejects when schedule.status == :posted (state guard per FR-010)", %{
      gm: gm,
      schedule: schedule
    } do
      # Force into :posted via the foundational update default.
      {:ok, posted} =
        schedule
        |> Ash.Changeset.for_update(:update, %{status: :posted, posted_at: DateTime.utc_now()},
          actor: GameNight.Schedules.System.actor()
        )
        |> Ash.update()

      assert {:error, %Ash.Error.Invalid{} = err} = set_gm_day(gm, posted, 5, :A)
      assert Exception.message(err) =~ "locked"
    end
  end

  describe "list/get actions (T024)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, gm: gm, game: game}
    end

    test ":list_for_game returns the GM's schedules sorted year/month DESC", %{
      gm: gm,
      game: game
    } do
      {:ok, _oct} = initiate(gm, game, %{month: 10, year: 2099})
      {:ok, _nov} = initiate(gm, game, %{month: 11, year: 2099})
      {:ok, _dec_next} = initiate(gm, game, %{month: 12, year: 2100})

      {:ok, results} =
        Schedule
        |> Ash.Query.for_read(:list_for_game, %{game_id: game.id}, actor: gm)
        |> Ash.read()

      assert Enum.map(results, &{&1.year, &1.month}) ==
               [{2100, 12}, {2099, 11}, {2099, 10}]
    end

    test ":list_for_game_top_six caps at 6 rows", %{gm: gm, game: game} do
      for {month, year} <- Enum.zip(1..7, List.duplicate(2099, 7)) do
        {:ok, _} = initiate(gm, game, %{month: month, year: year})
      end

      {:ok, results} =
        Schedule
        |> Ash.Query.for_read(:list_for_game_top_six, %{game_id: game.id}, actor: gm)
        |> Ash.read()

      assert length(results) == 6
    end

    test ":get_for_game loads schedule with schedule_days", %{gm: gm, game: game} do
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})

      {:ok, loaded} =
        Schedule
        |> Ash.Query.for_read(:get_for_game, %{id: schedule.id, game_id: game.id}, actor: gm)
        |> Ash.read_one()

      assert loaded.id == schedule.id
      assert length(loaded.schedule_days) == 31
    end
  end

  describe "policy gating (T025)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, intruder} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})
      {:ok, gm: gm, intruder: intruder, game: game, schedule: schedule}
    end

    test "non-owner cannot :initiate on the GM's game", %{intruder: intruder, game: game} do
      assert {:error, %Ash.Error.Forbidden{}} =
               initiate(intruder, game, %{month: 11, year: 2099})
    end

    test "non-owner cannot :list_for_game", %{intruder: intruder, game: game} do
      assert {:ok, []} =
               Schedule
               |> Ash.Query.for_read(:list_for_game, %{game_id: game.id}, actor: intruder)
               |> Ash.read()
    end

    test "anonymous cannot :initiate", %{game: game} do
      assert {:error, _} =
               Schedule
               |> Ash.Changeset.for_create(:initiate, %{
                 month: 11,
                 year: 2099,
                 start_time: ~T[19:00:00],
                 end_time: ~T[23:00:00],
                 time_zone: "America/Chicago",
                 game_id: game.id
               })
               |> Ash.create()
    end

    test "non-owner cannot :set_gm_day", %{intruder: intruder, schedule: schedule} do
      assert {:error, %Ash.Error.Forbidden{}} = set_gm_day(intruder, schedule, 5, :A)
    end
  end

  describe ":transition_to_ready_for_availability action (T051)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})

      # Seed two accepted players (members of the GM's game) so the
      # transition has rows to fan out to.
      {:ok, member_a} = create_user()
      {:ok, member_b} = create_user()
      player_a = seed_player!(game, member_a)
      player_b = seed_player!(game, member_b)

      {:ok,
       gm: gm,
       game: game,
       schedule: schedule,
       player_a: player_a,
       player_b: player_b}
    end

    test "creates one ScheduleParticipant per accepted Player + flips status", %{
      gm: gm,
      schedule: schedule,
      player_a: player_a,
      player_b: player_b
    } do
      assert {:ok, transitioned} = transition_to_ready(gm, schedule)

      assert transitioned.status == :ready_for_availability

      participants =
        GameNight.Schedules.ScheduleParticipant
        |> Ash.Query.filter(schedule_id == ^schedule.id)
        |> Ash.read!(authorize?: false)

      assert length(participants) == 2
      player_ids = participants |> Enum.map(& &1.player_id) |> Enum.sort()
      assert player_ids == Enum.sort([player_a.id, player_b.id])

      # Every participant got per-day NA rows for every day of the
      # month (October 2099 = 31 days).
      for participant <- participants do
        days =
          GameNight.Schedules.ParticipantDay
          |> Ash.Query.filter(participant_id == ^participant.id)
          |> Ash.read!(authorize?: false)

        assert length(days) == 31
        assert Enum.all?(days, &(&1.status == :NA))
      end
    end

    test "is idempotent under retry — re-calling does not duplicate participants", %{
      gm: gm,
      schedule: schedule
    } do
      {:ok, _} = transition_to_ready(gm, schedule)
      reloaded = Ash.get!(Schedule, schedule.id, authorize?: false)

      # Second call with a schedule already in :ready_for_availability
      # is rejected by the state validation; we assert it does NOT
      # create extra participants.
      _ = transition_to_ready(gm, reloaded)

      participants_count =
        GameNight.Schedules.ScheduleParticipant
        |> Ash.Query.filter(schedule_id == ^schedule.id)
        |> Ash.read!(authorize?: false)
        |> length()

      assert participants_count == 2
    end

    test "non-owner cannot transition", %{schedule: schedule} do
      {:ok, intruder} = create_user()
      assert {:error, %Ash.Error.Forbidden{}} = transition_to_ready(intruder, schedule)
    end

    test "anonymous cannot transition", %{schedule: schedule} do
      assert {:error, _} =
               schedule
               |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{})
               |> Ash.update()
    end
  end

  describe "player-side reads (US3)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      player = seed_player!(game, member)
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})

      # Flip a day to A so the schedule has visible content + transition.
      {:ok, schedule} =
        schedule
        |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :A}, actor: gm)
        |> Ash.update()

      {:ok, schedule} =
        schedule
        |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
        |> Ash.update()

      {:ok, gm: gm, game: game, schedule: schedule, member: member, player: player}
    end

    test ":list_for_player_character returns the schedule for a linked player", %{
      member: member,
      player: player,
      schedule: schedule
    } do
      {:ok, results} =
        Schedule
        |> Ash.Query.for_read(:list_for_player_character, %{player_id: player.id},
          actor: member
        )
        |> Ash.read()

      assert Enum.map(results, & &1.id) == [schedule.id]
    end

    test ":get_for_player_character returns the schedule for a linked player", %{
      member: member,
      player: player,
      schedule: schedule
    } do
      {:ok, loaded} =
        Schedule
        |> Ash.Query.for_read(
          :get_for_player_character,
          %{id: schedule.id, player_id: player.id},
          actor: member
        )
        |> Ash.read_one()

      assert loaded.id == schedule.id
    end

    test ":get_for_player_character with the SPA's nested fields load works", %{
      member: member,
      player: player,
      schedule: schedule
    } do
      # Mirrors the load shape `useGetScheduleForCharacter` issues.
      result =
        Schedule
        |> Ash.Query.for_read(
          :get_for_player_character,
          %{id: schedule.id, player_id: player.id},
          actor: member
        )
        |> Ash.Query.load([
          :schedule_days,
          :name,
          participants: [:player, participant_days: []]
        ])
        |> Ash.read_one()

      assert {:ok, %Schedule{} = loaded} = result
      assert loaded.id == schedule.id
      assert is_list(loaded.schedule_days)
      assert is_list(loaded.participants)
      [participant] = loaded.participants
      assert participant.player_id == player.id
      assert is_list(participant.participant_days)
    end

    test ":get_for_player_character returns nil for a non-linked player", %{
      schedule: schedule
    } do
      # Different game, different player — should not see the schedule.
      {:ok, intruder} = create_user()
      {:ok, intruder_game} = register_game(intruder)
      intruder_player = seed_player!(intruder_game, intruder)

      result =
        Schedule
        |> Ash.Query.for_read(
          :get_for_player_character,
          %{id: schedule.id, player_id: intruder_player.id},
          actor: intruder
        )
        |> Ash.read_one()

      assert match?({:ok, nil}, result) or match?({:error, _}, result)
    end
  end

  describe "GM-NA cascade (T070)" do
    setup do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      _ = seed_player!(game, member)
      {:ok, schedule} = initiate(gm, game, %{month: 10, year: 2099})

      # GM marks day 5 as :A so the player can have a non-NA value.
      {:ok, schedule} =
        schedule
        |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :A}, actor: gm)
        |> Ash.update()

      {:ok, schedule} =
        schedule
        |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
        |> Ash.update()

      {:ok, gm: gm, game: game, schedule: schedule, member: member}
    end

    test "flipping GM day to NA after transition cascades to participant_days", %{
      gm: gm,
      schedule: schedule,
      member: member
    } do
      [participant] =
        GameNight.Schedules.ScheduleParticipant
        |> Ash.Query.filter(schedule_id == ^schedule.id)
        |> Ash.read!(authorize?: false)

      day_5 =
        GameNight.Schedules.ParticipantDay
        |> Ash.Query.filter(participant_id == ^participant.id and day == 5)
        |> Ash.read_one!(authorize?: false)

      # Player toggles their day 5 to :I (allowed because GM day-5 is :A).
      {:ok, _} =
        day_5
        |> Ash.Changeset.for_update(:set_status, %{status: :I}, actor: member)
        |> Ash.update()

      # GM flips day 5 to :NA — cascade should overwrite the
      # participant's day 5 to :NA.
      {:ok, _} =
        schedule
        |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :NA}, actor: gm)
        |> Ash.update()

      reloaded =
        GameNight.Schedules.ParticipantDay
        |> Ash.Query.filter(participant_id == ^participant.id and day == 5)
        |> Ash.read_one!(authorize?: false)

      assert reloaded.status == :NA
    end
  end

  defp transition_to_ready(actor, schedule) do
    schedule
    |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: actor)
    |> Ash.update()
  end

  defp seed_player!(game, user) do
    GameNight.Games.Player
    |> Ash.Changeset.for_create(:create, %{
      game_id: game.id,
      user_id: user.id,
      character_name: "Test Char",
      status: :active
    })
    |> Ash.create!(authorize?: false)
  end

  defp create_user do
    email = "schedule-test-#{System.unique_integer([:positive])}@example.test"
    password = "schedule-test-password-1"

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
    |> Ash.Changeset.for_create(:register, %{title: "Schedule test", status: :active},
      actor: owner
    )
    |> Ash.create()
  end

  defp initiate(actor, game, overrides) do
    attrs =
      Map.merge(
        %{
          month: 10,
          year: 2099,
          start_time: ~T[19:00:00],
          end_time: ~T[23:00:00],
          time_zone: "America/Chicago",
          game_id: game.id
        },
        Map.new(overrides)
      )

    Schedule
    |> Ash.Changeset.for_create(:initiate, attrs, actor: actor)
    |> Ash.create()
  end

  defp set_gm_day(actor, schedule, day, status) do
    schedule
    |> Ash.Changeset.for_update(:set_gm_day, %{day: day, status: status}, actor: actor)
    |> Ash.update()
  end

  defp list_schedule_days(schedule) do
    GameNight.Schedules.ScheduleDay
    |> Ash.Query.filter(schedule_id == ^schedule.id)
    |> Ash.read!(authorize?: false)
  end

  defp day_status(schedule, day) do
    list_schedule_days(schedule)
    |> Enum.find(&(&1.day == day))
    |> Map.get(:gm_status)
  end
end
