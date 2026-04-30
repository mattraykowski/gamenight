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

  # RPC bindings the SPA calls via `/rpc/run`. Story phases add
  # rpc_action entries alongside their resource actions.
  typescript_rpc do
    resource GameNight.Schedules.Schedule do
      # US1 (T040).
      rpc_action :list_schedules_for_game, :list_for_game
      rpc_action :list_schedules_for_game_top_six, :list_for_game_top_six
      rpc_action :get_schedule_for_game, :get_for_game
      rpc_action :initiate_schedule, :initiate
      rpc_action :set_schedule_gm_day, :set_gm_day
      # US2 (T064).
      rpc_action :transition_schedule_to_ready, :transition_to_ready_for_availability
      # US3 (T084) — player-side reads.
      rpc_action :list_schedules_for_character, :list_for_player_character
      rpc_action :get_schedule_for_character, :get_for_player_character
      # US4 (T103).
      rpc_action :update_schedule_final_days, :update_final_days
      rpc_action :post_schedule, :post
      # US7 (T133).
      rpc_action :update_schedule_final_days_and_notify, :update_final_days_and_notify
      # US8 (T142).
      rpc_action :delete_schedule, :delete
      # Feature 004 (T014).
      rpc_action :list_schedules_for_calendar_month, :list_calendar_event_days_for_month
    end

    # Registered for type generation only.
    resource GameNight.Schedules.ScheduleDay

    resource GameNight.Schedules.ScheduleParticipant do
      # US3 (T084).
      rpc_action :set_schedule_participant_submission, :set_submission
      # US6 (T124).
      rpc_action :send_schedule_reminder, :send_reminder
    end

    resource GameNight.Schedules.ParticipantDay do
      # US3 (T084).
      rpc_action :set_participant_day_status, :set_status
    end
  end

  resources do
    resource GameNight.Schedules.Schedule
    resource GameNight.Schedules.ScheduleDay
    resource GameNight.Schedules.ScheduleParticipant
    resource GameNight.Schedules.ParticipantDay
  end
end
