defmodule GameNight.Schedules.Schedule.Actions.ListCalendarEventDaysForMonth do
  @moduledoc """
  Feature 004 — generic action that returns the read-only
  `CalendarEventDay` projection for the calendar surface.

  Per [data-model.md](../../../../specs/004-full-calendar/data-model.md):
  for `(actor, year, month)`, find every posted schedule the actor is
  connected to (game owner OR non-`np_only` participant), then emit
  one row per Final-A `ScheduleDay`. Rows are flat maps suitable for
  `{:array, :map}` serialisation; no resource module backs them.

  Anonymous actor → empty list (defence-in-depth alongside the
  route's auth gate).
  """

  use Ash.Resource.Actions.Implementation

  require Ash.Query

  @impl true
  def run(input, _opts, context) do
    actor = Map.get(context, :actor)
    year = Map.fetch!(input.arguments, :year)
    month = Map.fetch!(input.arguments, :month)
    do_run(year, month, actor)
  end

  defp do_run(_year, _month, nil), do: {:ok, []}

  defp do_run(year, month, actor) do
    metadata = %{actor_id: actor.id, year: year, month: month}

    :telemetry.span(
      [:game_night, :schedules, :list_calendar_event_days_for_month],
      metadata,
      fn ->
        # `authorize?: false` is intentional: the explicit per-actor
        # filter below IS the authorisation gate, and we deliberately
        # bypass the resource policies here because (a) running with
        # `actor: actor` would also apply the Game resource's read
        # policy to the relationship load, which is owner-only and
        # would null out `schedule.game` for a player participant; and
        # (b) the action returns a derived projection — not raw
        # Schedule rows — so the resource policy isn't the right
        # boundary anyway. The action's own policy
        # (`policy action(:list_calendar_event_days_for_month)`) is
        # the public boundary; this filter is the data scope.
        schedules =
          GameNight.Schedules.Schedule
          |> Ash.Query.filter(
            year == ^year and
              month == ^month and
              status == :posted and
              (game.owner_id == ^actor.id or
                 exists(participants, player.user_id == ^actor.id and np_only == false))
          )
          |> Ash.Query.load([:schedule_days, :game, participants: [:player]])
          |> Ash.read!(authorize?: false)

        rows =
          schedules
          |> Enum.flat_map(&rows_for_schedule(&1, actor))
          |> Enum.sort_by(fn row -> {row.date, row.game_title} end)

        {{:ok, rows}, Map.put(metadata, :row_count, length(rows))}
      end
    )
  end

  defp rows_for_schedule(schedule, actor) do
    role = role_for(schedule, actor)
    character_id = character_id_for(schedule, actor, role)
    target_route = target_route_for(role)
    time_slot_label = format_time_slot(schedule.start_time, schedule.end_time)

    schedule.schedule_days
    |> Enum.filter(&(&1.final_status == :A))
    |> Enum.map(fn day ->
      %{
        date: Date.new!(schedule.year, schedule.month, day.day),
        schedule_id: schedule.id,
        game_id: schedule.game_id,
        game_title: schedule.game.title,
        time_slot_label: time_slot_label,
        role: role,
        character_id: character_id,
        target_route: target_route
      }
    end)
  end

  # GM wins the tie when an actor is somehow both owner and seated
  # player on the same schedule (FR-010 spec / data-model §2.4).
  defp role_for(schedule, actor) do
    if schedule.game.owner_id == actor.id, do: :gm, else: :player
  end

  defp character_id_for(_schedule, _actor, :gm), do: nil

  defp character_id_for(schedule, actor, :player) do
    schedule.participants
    |> Enum.find(fn p -> p.player && p.player.user_id == actor.id end)
    |> case do
      nil -> nil
      participant -> participant.player_id
    end
  end

  defp target_route_for(:gm), do: "/games/$gameId/schedules/$scheduleId"
  defp target_route_for(:player), do: "/characters/$characterId/schedules/$scheduleId"

  @doc """
  Public formatter for a schedule's time-slot label. Mirrors the
  output of `Schedules.Calculations.Name` for the time portion.
  """
  @spec format_time_slot(Time.t(), Time.t()) :: String.t()
  def format_time_slot(%Time{} = start_time, %Time{} = end_time) do
    "#{format_time(start_time)} – #{format_time(end_time)}"
  end

  defp format_time(%Time{hour: 0, minute: minute}), do: "12:#{pad(minute)} AM"
  defp format_time(%Time{hour: 12, minute: minute}), do: "12:#{pad(minute)} PM"

  defp format_time(%Time{hour: hour, minute: minute}) when hour < 12,
    do: "#{hour}:#{pad(minute)} AM"

  defp format_time(%Time{hour: hour, minute: minute}),
    do: "#{hour - 12}:#{pad(minute)} PM"

  defp pad(minute) when minute < 10, do: "0#{minute}"
  defp pad(minute), do: Integer.to_string(minute)
end
