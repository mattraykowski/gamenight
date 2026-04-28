# `ash_typescript` RPC Contract — Game Schedule

This document captures the typed RPC surface that `ash_typescript.codegen` emits for the SPA. The actual file is regenerated to `assets/js/ash_rpc.ts`; this is the reviewer-facing summary.

All RPC functions return `{ success, data, errors }` per the project-wide convention from feature 002. The SPA wraps each in a TanStack-Query hook at `assets/js/features/schedules/hooks.ts`.

---

## RPC function map

| RPC name | Ash action | Domain | Input shape | Output shape |
| --- | --- | --- | --- | --- |
| `initiateSchedule` | `Schedule.initiate` | `GameNight.Schedules` | `{ gameId: string; month: 1..12; year: number; startTime: string (HH:MM:SS); endTime: string; timeZone: string }` | `Schedule` (with `name`) |
| `listSchedulesForGame` | `Schedule.list_for_game` | | `{ gameId: string }` | `Schedule[]` |
| `listSchedulesForGameTopSix` | `Schedule.list_for_game_top_six` | | `{ gameId: string }` | `Schedule[]` (max 6) |
| `getScheduleForGame` | `Schedule.get_for_game` | | `{ id: string; gameId: string }` | `Schedule` (with `schedule_days`, `participants`, `participant_days` loaded) |
| `setScheduleGmDay` | `Schedule.set_gm_day` | | `{ id: string; day: 1..31; status: "NA" \| "I" \| "A" \| "IF" }` | `Schedule` |
| `transitionScheduleToReady` | `Schedule.transition_to_ready_for_availability` | | `{ id: string }` | `Schedule` |
| `postSchedule` | `Schedule.post` | | `{ id: string }` | `Schedule` |
| `updateScheduleFinalDays` | `Schedule.update_final_days` | | `{ id: string; finalDays: { day: number; status: "NA" \| "A" }[] }` | `Schedule`. Allowed in `:ready_for_availability` or `:posted`. Used by the per-cell mutation hook on the Scheduling View. |
| `updateScheduleFinalDaysAndNotify` | `Schedule.update_final_days_and_notify` | | as above | `Schedule`. Allowed only in `:posted`. |
| `deleteSchedule` | `Schedule.delete` | | `{ id: string; confirmation: string }` | `{ id: string }` |
| `listSchedulesForCharacter` | `Schedule.list_for_player_character` | | `{ playerId: string }` | `Schedule[]` |
| `getScheduleForCharacter` | `Schedule.get_for_player_character` | | `{ id: string; playerId: string }` | `Schedule` (filtered loads) |
| `listScheduleParticipants` | `ScheduleParticipant.list_for_schedule` | | `{ scheduleId: string }` | `ScheduleParticipant[]` |
| `setScheduleParticipantSubmission` | `ScheduleParticipant.set_submission` | | `{ id: string }` | `ScheduleParticipant` |
| `sendScheduleReminder` | `ScheduleParticipant.send_reminder` | | `{ id: string }` | `ScheduleParticipant` |
| `setParticipantDayStatus` | `ParticipantDay.set_status` | | `{ id: string; status: "NA" \| "I" \| "A" \| "IF" }` | `ParticipantDay` |

---

## Generated TypeScript types

`ash_typescript.codegen` emits in `assets/js/ash_types.ts`:

```ts
export type ScheduleStatus = "preparing" | "ready_for_availability" | "posted";
export type AvailabilityStatus = "NA" | "I" | "A" | "IF";
export type ParticipantDayStatus = AvailabilityStatus | "NP";
export type FinalStatus = "NA" | "A";
export type FinalNoteKind = "good_day" | "maybe" | "maybe_with_if" | "host_unavailable" | "bad_day";

export interface Schedule {
  id: string;
  game_id: string;
  month: number;
  year: number;
  start_time: string;       // "HH:MM:SS"
  end_time: string;
  time_zone: string;
  status: ScheduleStatus;
  posted_at: string | null;
  inserted_at: string;
  updated_at: string;
  // calculations:
  name: string;
  submission_count?: number;
  participant_count?: number;
  // loaded relations:
  schedule_days?: ScheduleDay[];
  participants?: ScheduleParticipant[];
}

export interface ScheduleDay {
  id: string;
  schedule_id: string;
  day: number;
  gm_status: AvailabilityStatus | null;   // null when field-policy-stripped for non-GMs
  final_status: FinalStatus | null;
  // calculations:
  gm_locked_na: boolean;
  final_note_kind?: FinalNoteKind;
  final_note_label?: string;
}

export interface ScheduleParticipant {
  id: string;
  schedule_id: string;
  player_id: string;
  submitted_at: string | null;
  joined_at: string;
  is_late_join: boolean;
  np_only: boolean;
  // loaded relations:
  player?: Player;          // from feature 002
  participant_days?: ParticipantDay[];
}

export interface ParticipantDay {
  id: string;
  participant_id: string;
  schedule_id: string;
  day: number;
  status: ParticipantDayStatus;
}
```

---

## Notification kind extensions

`assets/js/features/notifications/kinds.ts` extends the discriminated union:

```ts
export type NotificationKind =
  | "game_invitation"                         // existing
  | "schedule_ready_for_availability"
  | "schedule_posted"
  | "schedule_updated"
  | "schedule_reminder";

export interface ScheduleNotificationPayload {
  schedule_id: string;
  schedule_name: string;
  game_id: string;
  game_name: string;
  gm_display_name: string;
}
```

The bell renderer (`<NotificationsBell>` from feature 002) receives a kind and dispatches to a per-kind row component. Schedule kinds render `"<game_name> — <schedule_name>"` with a deep link to `/characters/$playerId/schedules/$scheduleId`.

---

## Final Note truth table (shared between server and client)

Both `GameNight.Schedules.Calculations.FinalNoteKind` (Elixir) and `assets/js/features/schedules/final-note.ts` (TypeScript) implement the rule below. The shared truth-table fixture lives at `test/support/schedule_final_note_fixtures.exs` and is consumed by both `final_note_kind_test.exs` (ExUnit) and `final-note.test.ts` (Vitest), so any divergence fails CI.

For a given day, with `gm` ∈ {NA, I, A, IF} and `participants` an array of `:NA | :I | :A | :IF` (NP late-joiners excluded), `n = participants.length`:

```text
if (gm == NA) → host_unavailable
else if (every p in participants is I or A and gm in [I, A]) → good_day
else if (any p == IF or gm == IF) → maybe_with_if  (carries the array of IF participant names; "GM" appended when gm == IF)
else if (count(p in [NA, IF]) > floor(n / 5)) → bad_day
else if (count(p in [NA, IF]) > 0) → maybe
else if (n == 0 and gm in [I, A]) → good_day
else → bad_day
```

Test fixture cases (must match in both languages):

| gm | participants | n | expected kind |
| --- | --- | --- | --- |
| `A` | `[]` | 0 | `good_day` |
| `NA` | `[A, A, A]` | 3 | `host_unavailable` |
| `A` | `[A, A, A, A, A]` | 5 | `good_day` |
| `A` | `[A, NA, A, A, A]` | 5 | `maybe` |
| `A` | `[A, NA, NA, A, A]` | 5 | `bad_day` |
| `A` | `[A, IF, A, A, A]` | 5 | `maybe_with_if` |
| `A` | `[NA]` | 1 | `bad_day` (1 > floor(1/5) = 0) |
| `I` | `[I, A, I]` | 3 | `good_day` |
| `IF` | `[A, A, A]` | 3 | `maybe_with_if` (gm contributes its own IF — NB: the rule above covers participant IFs; the GM-IF case treats the GM as a participant for the purpose of the IF check; this is captured in the truth table fixture) |

(The last row exposes a subtle requirement: the GM is also a "participant" for IF detection but not for the count denominator. The truth table fixture canonicalises this; the calculation modules must read fixtures rather than re-deriving the rule, so the test/calc relationship stays one-way.)

---

## Hook layer

The TanStack-Query feature hooks at `assets/js/features/schedules/hooks.ts` follow the feature-002 idiom:

```ts
export function useGetScheduleForGame(id: string, gameId: string) {
  return useQuery({
    queryKey: schedulesKeys.gm(id),
    queryFn: async () => {
      const { success, data, errors } = await getScheduleForGame({ id, gameId });
      if (!success) throw narrowApiError(errors);
      return data;
    },
  });
}

export function useSetParticipantDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setParticipantDayStatus,
    onMutate: ({ id, status }) => {
      // optimistic local cache update for snappy planner clicks
    },
    onError: (err, vars, ctx) => { /* rollback */ },
    onSettled: (_d, _e, vars) => qc.invalidateQueries({ queryKey: schedulesKeys.player(vars.scheduleId) }),
  });
}
```

Key semantics:
- Optimistic updates on `setParticipantDayStatus` and `setScheduleGmDay` for INP latency targets.
- Mutations on the GM Scheduling View Final column do NOT optimistically update; they wait on server confirmation because the Final Note classification depends on the canonical state and visibly changes color on the same click.
- On `transitionScheduleToReady`, `postSchedule`, and `delete*` we invalidate the schedule list and detail keys so the View Game table picks up the new state on the next render.
