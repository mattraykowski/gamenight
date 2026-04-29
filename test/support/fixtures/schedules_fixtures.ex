defmodule GameNight.SchedulesFixtures do
  @moduledoc """
  Reusable factory helpers for the `Schedules` domain in tests.

  Tests alias this module explicitly per the project convention (no
  auto-import via `data_case.ex`). Mirror the
  `GameNight.AccountsFixtures` pattern from feature 001.

  These helpers run with `actor: GameNight.Schedules.System.actor()`
  so they bypass the per-action policies that story phases will add.
  """

  alias GameNight.Schedules.{Schedule, ScheduleParticipant}

  @doc """
  Default attribute map for `Schedule.create`. Overrides via opts.
  """
  def build_schedule_attrs(overrides \\ %{}) do
    Map.merge(
      %{
        month: 10,
        year: 2026,
        start_time: ~T[19:00:00],
        end_time: ~T[23:00:00],
        time_zone: "America/Chicago",
        status: :preparing
      },
      Map.new(overrides)
    )
  end

  @doc """
  Create a `:preparing` schedule for a game using the system bypass
  actor. Foundational helper — story phases will likely call the
  named `:initiate` action via a higher-level helper.
  """
  def system_create_preparing_schedule(game, overrides \\ %{}) do
    attrs =
      overrides
      |> build_schedule_attrs()
      |> Map.put(:game_id, game.id)

    Schedule
    |> Ash.Changeset.for_create(:create, attrs, actor: system_actor())
    |> Ash.create!()
  end

  @doc """
  Add a `ScheduleParticipant` linking a player to a schedule, using
  the system bypass actor. Story phases will replace direct creates
  with the `:transition_to_ready_for_availability` and
  `:add_late_joiner` flows.
  """
  def add_player_link(schedule, player, overrides \\ %{}) do
    attrs =
      Map.merge(
        %{
          schedule_id: schedule.id,
          player_id: player.id,
          is_late_join: false,
          np_only: false,
          joined_at: DateTime.utc_now()
        },
        Map.new(overrides)
      )

    ScheduleParticipant
    |> Ash.Changeset.for_create(:create, attrs, actor: system_actor())
    |> Ash.create!()
  end

  @doc """
  Marker actor that admits the foundational `_internal?` policy
  bypass declared on each Schedules resource. Mirrors
  `GameNight.Notifications.System.actor/0`.
  """
  def system_actor, do: %{_internal?: true}
end
