defmodule GameNight.Schedules do
  @moduledoc """
  Ash domain for monthly game-schedule lifecycle.

  This domain hosts four cooperating resources that together model
  one-month-at-a-time scheduling for a `GameNight.Games.Game`:

    * `Schedule` — the month + time-slot envelope and lifecycle
      state machine (`:preparing` → `:ready_for_availability` →
      `:posted`).
    * `ScheduleDay` — per (Schedule, day-of-month) GM availability
      and the GM's Final decision.
    * `ScheduleParticipant` — a player's character linked to a
      schedule.
    * `ParticipantDay` — per (ScheduleParticipant, day) the
      player's submitted availability.

  Derived presentation values such as `Schedule.name`
  (`"October 2026 7:00 PM – 11:00 PM"`) and the per-day
  `ScheduleDay.final_note_kind` are Ash calculations rather than
  stored columns — single source of truth, no drift, free to
  evolve their format without DB migration.

  The `GameNight.Schedules.System` internal context owns the
  privileged write paths (cascade flows, late-joiner linkage,
  notification fan-out, player-removal handling) and is the only
  sanctioned bypass of this domain's deny-by-default policies —
  see Constitution Principle II.

  Dual-exposed: every action surfaces on both JSON:API (canonical
  contract per Constitution Principle III) and the `ash_typescript`
  RPC channel (fast path for the SPA). Action and RPC bindings
  arrive in their owning user-story phases (US1 onwards).
  """
  use Ash.Domain,
    otp_app: :game_night,
    extensions: [AshJsonApi.Domain, AshTypescript.Rpc]

  # RPC bindings the SPA calls via `/rpc/run`.
  # Populated incrementally as user-story actions land.
  typescript_rpc do
  end

  resources do
  end
end
