defmodule GameNight.Schedules.FanOutPerfTest do
  @moduledoc """
  T154.5 — encodes SC-002 quantitatively. Creates a 10-player schedule
  and asserts that `Schedule.transition_to_ready_for_availability`
  finishes (with all `Notification` rows visible) in <= 60 s under
  the standard test runner.

  Tagged `:perf` and excluded from the default `mix test` run via
  `test/test_helper.exs`. Intended to run in CI's nightly slot:

      mix test --include perf test/game_night/schedules/fan_out_perf_test.exs
  """
  use GameNight.DataCase, async: false

  require Ash.Query

  alias GameNight.Accounts.User
  alias GameNight.Games.{Game, Player}
  alias GameNight.Notifications.Notification
  alias GameNight.Schedules.Schedule

  @moduletag :perf

  test "transition_to_ready end-to-end completes within SC-002's 60 s ceiling for 10 players" do
    {:ok, gm} = create_user("gm")
    {:ok, game} = register_game(gm)

    for i <- 1..10 do
      {:ok, member} = create_user("member-#{i}")
      _ = seed_player!(game, member)
    end

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

    {us, {:ok, _ready}} =
      :timer.tc(fn ->
        schedule
        |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
        |> Ash.update()
      end)

    elapsed_ms = div(us, 1_000)

    notification_rows =
      Notification
      |> Ash.Query.filter(
        subject_type == "schedule" and subject_id == ^schedule.id and
          kind == :schedule_ready_for_availability
      )
      |> Ash.read!(authorize?: false)

    assert length(notification_rows) == 10

    assert elapsed_ms <= 60_000,
           "transition_to_ready_for_availability took #{elapsed_ms} ms; SC-002 budget is 60_000 ms"
  end

  defp create_user(prefix) do
    email = "perf-#{prefix}-#{:erlang.unique_integer([:positive])}@example.test"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: "perf-test-password-1",
      password_confirmation: "perf-test-password-1"
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: "Fan-out perf test", status: :active},
      actor: owner
    )
    |> Ash.create()
  end

  defp seed_player!(game, user) do
    Player
    |> Ash.Changeset.for_create(:create, %{
      game_id: game.id,
      user_id: user.id,
      character_name: "Perf Char",
      status: :active
    })
    |> Ash.create!(authorize?: false)
  end
end
