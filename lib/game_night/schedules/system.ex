defmodule GameNight.Schedules.System do
  @moduledoc """
  Internal context for system-level Schedules writes — the only
  sanctioned bypass of the Schedules-domain resources'
  deny-by-default policies (Constitution Principle II).

  Why a system context exists: schedule lifecycle transitions
  (`:transition_to_ready_for_availability`, `:post`) and cascade
  flows (`cascade_gm_na`, `add_late_joiner`,
  `handle_player_destroy`) materialise rows for users **other than
  the acting GM**. Per-user policies on the actions would deny
  those writes. Rather than weaken the policies, the
  notification-and-cascade-writing paths run with a marker actor
  whose presence is the documented exception, mirroring the pattern
  established by `GameNight.Notifications.System` in feature 002.

  ### Policy posture

  - Each Schedules resource declares
    `bypass actor_attribute_equals(:_internal?, true)` that admits
    the marker actor on internal actions.
  - Every other action keeps its actor-scoped clause, so an
    external caller who constructs the marker actor and tries to
    call a non-bypassed action is still rejected.

  This module is **not** routed; it has no JSON:API or RPC surface.
  Callers are other internal modules and tests.

  Function shells live here at Phase 2; bodies are filled in their
  owning user-story phases.
  """

  defmodule Actor do
    @moduledoc """
    Marker actor used by `GameNight.Schedules.System` for
    privileged writes. See module docs for the full rationale.
    """
    defstruct _internal?: true

    @type t :: %__MODULE__{_internal?: boolean()}
  end

  @doc """
  The marker actor used by this module's privileged calls.
  """
  @spec actor() :: Actor.t()
  def actor, do: %Actor{_internal?: true}

  @doc """
  Transition `schedule` from `:preparing` to
  `:ready_for_availability`: link every accepted player, materialise
  per-day NA rows, fan out the `:schedule_ready_for_availability`
  notification + email per linked player.

  Body lands in T060 (US2).
  """
  @spec transition_to_ready(GameNight.Schedules.Schedule.t()) ::
          {:ok, GameNight.Schedules.Schedule.t()} | {:error, term()}
  def transition_to_ready(_schedule), do: {:error, :not_implemented}

  @doc """
  Transition `schedule` from `:ready_for_availability` to `:posted`:
  fill any null `final_status` per the truth-table rule, fan out
  the `:schedule_posted` notification + email per linked
  participant.

  Body lands in T102 (US4).
  """
  @spec post(GameNight.Schedules.Schedule.t()) ::
          {:ok, GameNight.Schedules.Schedule.t()} | {:error, term()}
  def post(_schedule), do: {:error, :not_implemented}

  @doc """
  Add a late-joining player to an in-progress (or posted) schedule.
  For `:ready_for_availability` schedules, the participant gets
  `is_late_join: true` and notifications fire. For `:posted`
  schedules, the participant gets `np_only: true`, every per-day
  status is `:NP`, and no notifications fire (`:posted` branch
  lands in T151/US9).
  """
  @spec add_late_joiner(GameNight.Schedules.Schedule.t(), GameNight.Games.Player.t()) ::
          {:ok, GameNight.Schedules.ScheduleParticipant.t()}
          | :ignored
          | {:error, term()}
  def add_late_joiner(schedule, player) do
    case schedule.status do
      :preparing ->
        # Players don't see :preparing schedules; nothing to link.
        :ignored

      :ready_for_availability ->
        link_active_late_joiner(schedule, player)

      :posted ->
        # T151 (US9) implements the NP linkage path.
        :ignored
    end
  end

  defp link_active_late_joiner(schedule, player) do
    days_in_month = Date.days_in_month(Date.new!(schedule.year, schedule.month, 1))
    actor = actor()

    with {:ok, participant} <- create_late_join_participant(schedule, player, actor),
         :ok <- create_late_join_days(schedule, participant, days_in_month, actor),
         schedule_loaded <- Ash.load!(schedule, [:participants], authorize?: false),
         :ok <-
           fan_out_notification(
             schedule_loaded,
             :schedule_ready_for_availability,
             [Ash.load!(participant, [player: [:user]], authorize?: false)]
           ) do
      {:ok, participant}
    end
  end

  defp create_late_join_participant(schedule, player, actor) do
    GameNight.Schedules.ScheduleParticipant
    |> Ash.Changeset.for_create(
      :create,
      %{is_late_join: true, np_only: false, joined_at: DateTime.utc_now()},
      actor: actor
    )
    |> Ash.Changeset.manage_relationship(:schedule, schedule, type: :append)
    |> Ash.Changeset.manage_relationship(:player, player, type: :append)
    |> Ash.create()
  end

  defp create_late_join_days(schedule, participant, days_in_month, actor) do
    Enum.reduce_while(1..days_in_month, :ok, fn day, _acc ->
      result =
        GameNight.Schedules.ParticipantDay
        |> Ash.Changeset.for_create(:create, %{day: day, status: :NA}, actor: actor)
        |> Ash.Changeset.manage_relationship(:participant, participant, type: :append)
        |> Ash.Changeset.manage_relationship(:schedule, schedule, type: :append)
        |> Ash.create()

      case result do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  @doc """
  Find every non-posted schedule on `game_id` and (re-)link the
  given Player to it via `add_late_joiner/2`. Called from
  `Player.create`'s after-action so a newly accepted player joins
  any schedules already in `:ready_for_availability`.

  Idempotent on the participant `:unique_per_schedule_player`
  identity — re-runs against an already-linked participant return
  `:ok`.
  """
  @spec link_player_to_open_schedules(Ecto.UUID.t(), GameNight.Games.Player.t()) :: :ok
  def link_player_to_open_schedules(game_id, player) do
    require Ash.Query

    open_schedules =
      GameNight.Schedules.Schedule
      |> Ash.Query.filter(game_id == ^game_id and status != :preparing)
      |> Ash.read!(authorize?: false)

    Enum.each(open_schedules, fn schedule ->
      case add_late_joiner(schedule, player) do
        {:ok, _} -> :ok
        :ignored -> :ok
        # Identity collision (player already linked) — treat as success.
        {:error, %Ash.Error.Invalid{}} -> :ok
        {:error, _} -> :ok
      end
    end)

    :ok
  end

  @doc """
  When the GM flips a day's `gm_status` to `:NA` while the schedule
  is `:ready_for_availability`, overwrite every linked participant's
  status for that day to `:NA`. Runs as a `bulk_update` for atomic
  fan-out across the schedule's ParticipantDay rows.
  """
  @spec cascade_gm_na(GameNight.Schedules.Schedule.t(), 1..31, atom()) ::
          :ok | {:error, term()}
  def cascade_gm_na(schedule, day, :NA) do
    require Ash.Query

    GameNight.Schedules.ParticipantDay
    |> Ash.Query.filter(schedule_id == ^schedule.id and day == ^day)
    |> Ash.bulk_update(:bulk_set_to_na, %{},
      actor: actor(),
      authorize?: true,
      strategy: [:stream],
      return_errors?: true
    )
    |> case do
      %Ash.BulkResult{status: :success} -> :ok
      %Ash.BulkResult{status: :empty} -> :ok
      %Ash.BulkResult{status: status, errors: errors} -> {:error, {status, errors}}
    end
  end

  def cascade_gm_na(_schedule, _day, _new_gm_status), do: :ok

  @doc """
  Insert one Notification row per recipient and enqueue one Swoosh
  email; emit a telemetry span around the fan-out.

  Recipients default to every linked, non-`np_only` participant on
  the schedule. Pass an explicit list to target a subset (used by
  `:send_reminder` in US6 to fan out to a single participant).

  See `specs/003-game-schedule/research.md` §9 for payload contract.
  """
  @spec fan_out_notification(GameNight.Schedules.Schedule.t(), atom()) ::
          :ok | {:error, term()}
  @spec fan_out_notification(
          GameNight.Schedules.Schedule.t(),
          atom(),
          [GameNight.Schedules.ScheduleParticipant.t()] | nil
        ) :: :ok | {:error, term()}
  def fan_out_notification(schedule, kind, recipients \\ nil) do
    :telemetry.span(
      [:game_night, :schedules, :fan_out],
      %{schedule_id: schedule.id, kind: kind},
      fn ->
        result = do_fan_out(schedule, kind, recipients)
        {result, %{schedule_id: schedule.id, kind: kind}}
      end
    )
  end

  defp do_fan_out(schedule, kind, recipients) do
    require Ash.Query

    schedule = ensure_loaded_for_fan_out(schedule)
    participants = resolve_recipients(schedule, recipients)
    payload = build_payload(schedule)

    Enum.reduce_while(participants, :ok, fn participant, _acc ->
      with {:ok, user_id} <- user_id_for_participant(participant),
           :ok <- create_notification(user_id, schedule, kind, payload),
           :ok <- enqueue_email(participant, schedule, kind, payload) do
        {:cont, :ok}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp ensure_loaded_for_fan_out(%{game: %Ash.NotLoaded{}} = schedule) do
    Ash.load!(schedule, [game: [:owner], participants: [player: [:user]]],
      authorize?: false
    )
  end

  defp ensure_loaded_for_fan_out(schedule) do
    Ash.load!(schedule, [game: [:owner], participants: [player: [:user]]],
      authorize?: false
    )
  end

  defp resolve_recipients(_schedule, recipients) when is_list(recipients), do: recipients

  defp resolve_recipients(schedule, nil) do
    schedule.participants
    |> List.wrap()
    |> Enum.reject(&(&1.np_only == true))
  end

  defp build_payload(schedule) do
    %{
      "schedule_id" => schedule.id,
      "schedule_name" => schedule_name(schedule),
      "game_id" => schedule.game_id,
      "game_name" => schedule.game.title,
      "gm_display_name" => gm_display_name(schedule.game.owner)
    }
  end

  defp schedule_name(%{name: name}) when is_binary(name), do: name

  defp schedule_name(schedule) do
    GameNight.Schedules.Calculations.Name.format(
      schedule.month,
      schedule.year,
      schedule.start_time,
      schedule.end_time
    )
  end

  defp gm_display_name(%{email: email}) when not is_nil(email), do: to_string(email)
  defp gm_display_name(_), do: "your GM"

  defp user_id_for_participant(%{player: %{user_id: user_id}}) when not is_nil(user_id),
    do: {:ok, user_id}

  defp user_id_for_participant(_), do: {:error, :missing_player_user}

  defp create_notification(user_id, schedule, kind, _payload) do
    GameNight.Notifications.Notification
    |> Ash.Changeset.for_create(
      :create_for_invitation,
      %{
        user_id: user_id,
        kind: kind,
        subject_type: "schedule",
        subject_id: schedule.id
      },
      actor: GameNight.Notifications.System.actor()
    )
    |> Ash.create()
    |> case do
      {:ok, _row} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp enqueue_email(participant, schedule, kind, payload) do
    sender_module = sender_for_kind(kind)

    if sender_module do
      case apply(sender_module, :send, [participant, schedule, payload]) do
        :ok -> :ok
        {:ok, _} -> :ok
        {:error, reason} -> {:error, reason}
      end
    else
      :ok
    end
  end

  defp sender_for_kind(:schedule_ready_for_availability),
    do: GameNight.Schedules.Senders.SendScheduleReadyEmail

  defp sender_for_kind(_), do: nil

  @doc """
  Cascade behavior on `GameNight.Games.Player.destroy`:

    * `:preparing` / `:ready_for_availability` schedule — destroy
      the participant (and its days, via FK cascade).
    * `:posted` schedule — preserve the row, flip `np_only: true`,
      null `submitted_at`, set every per-day status to `:NP`.

  See `specs/003-game-schedule/data-model.md` §ScheduleParticipant
  Player-removal handling. **Phase 2 foundational stub** — returns
  `:ok` without inspecting any participants. With no rows linked to
  the player, Player.destroy succeeds at the DB level (the RESTRICT
  FK has no rows to block on). With rows linked, the DB will reject
  the destroy with a constraint violation — which is the documented
  intermediate state. T151.5 (US9) implements the real branching.
  """
  @spec handle_player_destroy(GameNight.Games.Player.t()) :: :ok | {:error, term()}
  def handle_player_destroy(_player), do: :ok
end
