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
  alias GameNight.Schedules.ScheduleParticipant
  alias GameNight.SchedulesFixtures

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

    @tag :pending_t151_5
    test "destroying a player linked to a :preparing schedule cascades the participant" do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, member} = create_user()
      player = seed_player!(game, member)
      schedule = SchedulesFixtures.system_create_preparing_schedule(game)
      _participant = SchedulesFixtures.add_player_link(schedule, player)

      assert {:ok, _} =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      assert [] =
               ScheduleParticipant
               |> Ash.Query.filter(player_id == ^player.id)
               |> Ash.read!(authorize?: false)
    end

    @tag :pending_t151_5
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

      assert {:ok, _} =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      assert [] =
               ScheduleParticipant
               |> Ash.Query.filter(player_id == ^player.id)
               |> Ash.read!(authorize?: false)
    end

    @tag :pending_t151_5
    test "destroying a player linked to a :posted schedule preserves the participant as np_only" do
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

      assert {:ok, _} =
               player
               |> Ash.Changeset.for_destroy(:destroy, %{}, actor: gm, authorize?: false)
               |> Ash.destroy()

      preserved =
        ScheduleParticipant
        |> Ash.get!(participant.id, authorize?: false)

      assert preserved.np_only == true
      assert preserved.submitted_at == nil
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
end
