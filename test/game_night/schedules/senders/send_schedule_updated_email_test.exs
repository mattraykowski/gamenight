defmodule GameNight.Schedules.Senders.SendScheduleUpdatedEmailTest do
  @moduledoc """
  T131 — asserts the rendered subject for the "schedule updated"
  email is "<game_name> schedule for <schedule_name> was updated".
  """
  use GameNight.DataCase, async: false

  import Swoosh.TestAssertions

  alias GameNight.Accounts.User
  alias GameNight.Games.{Game, Player}
  alias GameNight.Schedules.Schedule

  test "subject reads '<game_name> schedule for <schedule_name> was updated'" do
    {:ok, gm} = create_user("gm")
    {:ok, game} = register_game(gm, "Updated email test")
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

    {:ok, ready} =
      schedule
      |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
      |> Ash.update()

    {:ok, posted} =
      ready
      |> Ash.Changeset.for_update(:update_final_days, %{final_days: [%{day: 5, status: :A}]},
        actor: gm
      )
      |> Ash.update()

    {:ok, posted} =
      posted
      |> Ash.Changeset.for_update(:post, %{}, actor: gm)
      |> Ash.update()

    drain_emails()

    {:ok, _} =
      posted
      |> Ash.Changeset.for_update(
        :update_final_days_and_notify,
        %{final_days: [%{day: 5, status: :NA}]},
        actor: gm
      )
      |> Ash.update()

    schedule_name = "October 2099 7:00 PM – 11:00 PM"

    assert_email_sent(fn email ->
      email.subject == "Updated email test schedule for #{schedule_name} was updated"
    end)
  end

  defp create_user(prefix) do
    email = "schedule-updated-email-#{prefix}-#{:erlang.unique_integer([:positive])}@example.test"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: "schedule-updated-email-test-password-1",
      password_confirmation: "schedule-updated-email-test-password-1"
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner, title) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: title, status: :active}, actor: owner)
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
