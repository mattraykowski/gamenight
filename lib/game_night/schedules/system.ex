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
  status is `:NP`, and no notifications fire.

  Body lands in T062 (US2) for the `:ready_for_availability` case
  and T151 (US9) for the `:posted` case.
  """
  @spec add_late_joiner(GameNight.Schedules.Schedule.t(), GameNight.Games.Player.t()) ::
          {:ok, GameNight.Schedules.ScheduleParticipant.t()} | {:error, term()}
  def add_late_joiner(_schedule, _player), do: {:error, :not_implemented}

  @doc """
  When the GM flips a day's `gm_status` to `:NA` while the schedule
  is `:ready_for_availability`, overwrite every linked participant's
  status for that day to `:NA` inside the same transaction.

  Body lands in T080 (US3).
  """
  @spec cascade_gm_na(GameNight.Schedules.Schedule.t(), 1..31, atom()) :: :ok | {:error, term()}
  def cascade_gm_na(_schedule, _day, _new_gm_status), do: {:error, :not_implemented}

  @doc """
  Insert one Notification row per recipient (kind = one of the four
  schedule kinds) and enqueue one Swoosh email; emit a telemetry
  span around the fan-out.

  Body lands in T060 (US2). Story phases call this from the
  transition / post / update / reminder paths.
  """
  @spec fan_out_notification(
          GameNight.Schedules.Schedule.t(),
          atom(),
          [GameNight.Schedules.ScheduleParticipant.t()]
        ) :: :ok | {:error, term()}
  def fan_out_notification(_schedule, _kind, _recipients), do: {:error, :not_implemented}

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
