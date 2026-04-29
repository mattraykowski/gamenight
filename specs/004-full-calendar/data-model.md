# Phase 1 Data Model: Full Calendar

This feature **adds no persisted entities**. There are zero new
tables, zero new columns, zero new migrations. Every "event" surfaced
on the calendar is **derived at read time** from rows that already
exist in feature 003's `Schedule`, `ScheduleDay`,
`ScheduleParticipant`, and `Game` tables.

What follows describes the **read-side projection** the new action
returns and the **derivation rules** that produce it.

---

## §1. The projection: `CalendarEventDay`

`CalendarEventDay` is a flat, read-only struct. The Ash read action
returns a list of these. There is **no resource module**; the action
returns plain maps shaped per the projection. (Ash's `:array, :map`
return type or a `Ash.TypedStruct` is sufficient — final shape
chosen during implementation.)

| Field | Type | Notes |
| --- | --- | --- |
| `date` | `:date` | Calendar date the game runs (year-month-day). |
| `schedule_id` | `:uuid` | The source schedule. |
| `game_id` | `:uuid` | The source schedule's parent game. |
| `game_title` | `:string` | The game's user-facing title (display). |
| `time_slot_label` | `:string` | Pre-formatted time-slot string (e.g. `"7:00 PM – 11:00 PM"`). Server-formatted to spare the SPA timezone math. |
| `role` | `:atom` (`:gm \| :player`) | The current user's role on this schedule. |
| `character_id` | `:uuid` (nullable) | Set when `role == :player`; identifies the user's character on this schedule. Nil when `role == :gm`. |
| `target_route` | `:string` | The SPA route key the SPA navigates to on click. `"/games/$gameId/schedules/$scheduleId"` for GM events, `"/characters/$characterId/schedules/$scheduleId"` for player events. |

The SPA treats this as the canonical click-target — backend decides
the route, frontend just navigates. This keeps the both-roles
tiebreaker (GM wins) server-authoritative.

---

## §2. Derivation rules

For a given `(actor, year, month)`:

1. **Source schedules**: `Schedule` rows where:
   - `month == ^month and year == ^year` (matches the schedule's own
     month-bound; feature 003 invariant), AND
   - `status == :posted`, AND
   - one of:
     - `game.owner_id == ^actor(:id)` (GM role), OR
     - `exists(participants, player.user_id == ^actor(:id) and np_only == false)` (player role, late-joiners excluded).

2. **Source schedule_days**: for each source schedule, every
   `ScheduleDay` where `final_status == :A`.

3. **Row construction**: for each (schedule, schedule_day) pair from
   step 2, emit one `CalendarEventDay` row:
   - `date = Date.new!(schedule.year, schedule.month, schedule_day.day)`.
   - `schedule_id = schedule.id`.
   - `game_id = schedule.game_id`.
   - `game_title = schedule.game.title` (loaded with the schedule).
   - `time_slot_label = format_time_slot(schedule.start_time, schedule.end_time)` — see §3.
   - `role`: `:gm` if `schedule.game.owner_id == actor.id`, else `:player`.
   - `character_id`: nil for `:gm`; otherwise the participant's `player_id` (the project conflates `Player` with "character" — feature 002 convention).
   - `target_route`: `"/games/$gameId/schedules/$scheduleId"` for GM, `"/characters/$characterId/schedules/$scheduleId"` for player.

4. **Both-roles tiebreaker**: if a user somehow satisfies both the GM
   and the player branch on the same schedule (edge case — registration
   flows don't allow it today), the row emitted has `role = :gm`. This
   matches FR-010 in the spec.

5. **Sort order**: rows are sorted ascending by `date`, then by
   `game_title`. (Stable + scannable.)

---

## §3. Time-slot formatting

`format_time_slot(start_time, end_time)` produces a single-line
human label. Examples:

| start | end | label |
| --- | --- | --- |
| `~T[19:00:00]` | `~T[23:00:00]` | `"7:00 PM – 11:00 PM"` |
| `~T[09:00:00]` | `~T[13:00:00]` | `"9:00 AM – 1:00 PM"` |
| `~T[22:00:00]` | `~T[02:00:00]` | `"10:00 PM – 2:00 AM"` (cross-midnight) |

The function is a thin wrapper around Elixir's `Calendar.strftime/2`.
Time zone is **not** part of the label — the spec defers timezone
display to the user's browser, and a posted schedule already commits
to the GM's IANA zone in the source data.

---

## §4. Authorization

The action's policy is the only gate:

```elixir
policy action(:list_calendar_event_days_for_month) do
  authorize_if expr(game.owner_id == ^actor(:id))
  authorize_if expr(
    exists(participants, player.user_id == ^actor(:id) and np_only == false)
  )
end
```

Read further: the existing per-resource bypass for the system actor
(`actor_attribute_equals(:_internal?, true)`) still applies — relevant
for tests / fixtures.

**Anonymous** actor → both `authorize_if` clauses fail → empty list,
indistinguishable from "no events this month". The route itself
already redirects anonymous to sign-in (FR-017), so this is a
defence-in-depth posture.

---

## §5. What is NOT in this projection

Explicitly excluded — these are **not** event-days for the spec's
purposes:

- `:preparing` and `:ready_for_availability` schedules → no events.
- Final-NA days on posted schedules → no events.
- NP-only late-joiner participants → no events for them on the schedule
  they joined late.
- Cancelled / paused / completed games → posted schedules' Final-A
  days continue to surface per spec FR-019. Game status is
  independent of the calendar projection by design.

---

## §6. State transitions

The projection is fully derived. There is no state to transition.
When any source row changes (schedule deleted, Final value flipped,
game ownership transferred, participant becomes np_only, etc.),
the next read of the action sees the new truth automatically.

The TanStack Query cache for the calendar route is invalidated by:

- **Mutations on this branch**: none — the calendar has no mutations.
- **Cross-cutting invalidations**: any feature-003 mutation that
  touches a posted schedule's `final_status` (`Schedule.update_final_days`,
  `Schedule.update_final_days_and_notify`) or that destroys the
  schedule (`Schedule.delete`) should also invalidate any cached
  calendar queryKey. We add `schedulesKeys.calendar` invalidations
  to those existing hooks during implementation.
