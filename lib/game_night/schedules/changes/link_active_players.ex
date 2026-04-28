defmodule GameNight.Schedules.Changes.LinkActivePlayers do
  @moduledoc """
  Ash change attached to `Schedule.transition_to_ready_for_availability`.

  Fetches every `:active` Player on the schedule's game and creates
  one `ScheduleParticipant` row per player along with N
  `ParticipantDay` rows (one per day of the schedule's month, all
  defaulting to `:NA`). Idempotent on the
  `:unique_per_schedule_player` identity — a re-run materialises no
  duplicates.

  Runs as an `after_action` so the schedule's status update commits
  alongside the linked rows in the same transaction. If any
  participant insert fails the transaction rolls back and the
  schedule stays in `:preparing`.
  """

  use Ash.Resource.Change

  require Ash.Query

  alias GameNight.Schedules.{ParticipantDay, ScheduleParticipant}

  @impl true
  def change(changeset, _opts, _context) do
    Ash.Changeset.after_action(changeset, fn _changeset, schedule ->
      with {:ok, players} <- fetch_active_players(schedule.game_id),
           :ok <- create_participants_and_days(schedule, players) do
        {:ok, schedule}
      else
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  defp fetch_active_players(game_id) do
    GameNight.Games.Player
    |> Ash.Query.filter(game_id == ^game_id and status == :active)
    |> Ash.read(authorize?: false)
  end

  defp create_participants_and_days(schedule, players) do
    days_in_month = Date.days_in_month(Date.new!(schedule.year, schedule.month, 1))
    actor = GameNight.Schedules.System.actor()

    Enum.reduce_while(players, :ok, fn player, _acc ->
      case create_participant(schedule, player, actor) do
        {:ok, participant} ->
          case create_participant_days(schedule, participant, days_in_month, actor) do
            :ok -> {:cont, :ok}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp create_participant(schedule, player, actor) do
    attrs = %{
      schedule_id: schedule.id,
      player_id: player.id,
      is_late_join: false,
      np_only: false,
      joined_at: DateTime.utc_now()
    }

    ScheduleParticipant
    |> Ash.Changeset.for_create(:create, attrs, actor: actor)
    |> Ash.create()
  end

  defp create_participant_days(schedule, participant, days_in_month, actor) do
    Enum.reduce_while(1..days_in_month, :ok, fn day, _acc ->
      attrs = %{
        participant_id: participant.id,
        schedule_id: schedule.id,
        day: day,
        status: :NA
      }

      result =
        ParticipantDay
        |> Ash.Changeset.for_create(:create, attrs, actor: actor)
        |> Ash.create()

      case result do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end
end
