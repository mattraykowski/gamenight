# RPC Contract: Full Calendar

This feature adds **one** new RPC binding. No existing bindings are
changed.

---

## `list_schedules_for_calendar_month` (new)

| Field | Value |
| --- | --- |
| Resource | `GameNight.Schedules.Schedule` |
| Action | `:list_calendar_event_days_for_month` |
| RPC alias | `list_schedules_for_calendar_month` |
| HTTP verb | `GET` |
| Action type | generic action returning `{:array, :map}` |

### Input

```json
{
  "year": 2026,
  "month": 11
}
```

| Argument | Type | Constraints |
| --- | --- | --- |
| `year` | `:integer` | 4-digit year. No min / max — unbounded per spec FR-016. |
| `month` | `:integer` | `1..12`. |

### Output

A JSON array of `CalendarEventDay` rows (see [data-model.md](../data-model.md) §1):

```json
[
  {
    "date": "2026-11-05",
    "schedule_id": "01940a4f-1b1f-7c0a-9e5b-b8c9d0e1f2a3",
    "game_id": "01940a4d-c40a-700b-9d5e-1234567890ab",
    "game_title": "Curse of Strahd",
    "time_slot_label": "7:00 PM – 11:00 PM",
    "role": "gm",
    "character_id": null,
    "target_route": "/games/$gameId/schedules/$scheduleId"
  },
  {
    "date": "2026-11-12",
    "schedule_id": "01940a51-9e2b-7d3c-9f1a-aabbccddeeff",
    "game_id": "01940a4e-2c0d-7f1b-8a4c-fedcba987654",
    "game_title": "Lost Mines of Phandelver",
    "time_slot_label": "6:00 PM – 9:00 PM",
    "role": "player",
    "character_id": "01940a52-7d8e-7a9b-bb1c-001122334455",
    "target_route": "/characters/$characterId/schedules/$scheduleId"
  }
]
```

Rows are sorted ascending by `date`, then by `game_title`.

### Authorization

| Caller | Result |
| --- | --- |
| Anonymous (`actor: nil`) | Empty list (policy denies; defence in depth — FR-017 also blocks at the route level). |
| Authenticated, no posted schedules in (year, month) for any game they're connected to | Empty list (200, valid empty result). |
| Authenticated, GM on at least one game with a posted schedule in (year, month) | One row per Final-A day on each such schedule. |
| Authenticated, non-NP participant on at least one schedule in (year, month) | One row per Final-A day on each such schedule. |
| Authenticated, **only** NP-only participant on a schedule (late joiner who has every day NP) | That schedule contributes nothing. |

### Side effects

None. This is a pure read.

### Telemetry

The action emits a `[:game_night, :schedules, :list_calendar_event_days_for_month]`
span. Span metadata: `actor_id`, `year`, `month`, `row_count`. p95
target: ≤ 50 ms.

### Cache invalidation (SPA side)

The TanStack Query cache key is
`["schedules", "calendar", actorId, year, month]`. The following
existing mutations MUST be extended to invalidate any cached calendar
queries (any year / month) for the current actor:

- `Schedule.update_final_days` (any change to a Final value can add
  or remove an event from the calendar).
- `Schedule.update_final_days_and_notify` (same).
- `Schedule.post` (a newly posted schedule's Final-A days appear).
- `Schedule.delete` (events for that schedule disappear).

Implementation: each existing hook's `onSuccess` adds
`queryClient.invalidateQueries({ queryKey: schedulesKeys.calendar(actorId) })`
alongside its existing detail / byGame invalidations.

---

## TypeScript types (regenerated)

After the action lands, `mix ash_typescript.codegen` will produce:

```ts
export type ListSchedulesForCalendarMonthInput = {
  year: number;
  month: number;
};

export type CalendarEventDay = {
  date: string;            // ISO YYYY-MM-DD
  scheduleId: string;
  gameId: string;
  gameTitle: string;
  timeSlotLabel: string;
  role: "gm" | "player";
  characterId: string | null;
  targetRoute: string;
};

export type ListSchedulesForCalendarMonthResult =
  | { success: true; data: CalendarEventDay[] }
  | { success: false; errors: AshRpcError[] };

export function listSchedulesForCalendarMonth(
  config: {
    input: ListSchedulesForCalendarMonthInput;
    headers?: Record<string, string>;
    fetchOptions?: RequestInit;
    customFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  }
): Promise<ListSchedulesForCalendarMonthResult>;
```

`mix ash.codegen --check` and `mix ash_typescript.codegen` +
`git diff --exit-code` are part of the gate — drift fails CI.
