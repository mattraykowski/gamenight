# JSON:API Contract — Game Schedule

This document captures the JSON:API surface emitted by `ash_json_api` for the four new resources, plus the OpenAPI implications. The actual contract is generated; this file is the human-readable summary that reviewers check during the contract-drift PR review.

The base API path is unchanged from features 001/002: `/api/json`. All endpoints assume a Bearer token (web cookie session) and a `Content-Type: application/vnd.api+json`. JSON:API error responses follow the standard `{ "errors": [...] }` envelope.

---

## Resource type names

| Ash resource | JSON:API `type` | Base route |
| --- | --- | --- |
| `GameNight.Schedules.Schedule` | `"schedule"` | `/api/json/schedules` |
| `GameNight.Schedules.ScheduleDay` | `"schedule_day"` | `/api/json/schedule_days` (read-only via includes) |
| `GameNight.Schedules.ScheduleParticipant` | `"schedule_participant"` | `/api/json/schedule_participants` |
| `GameNight.Schedules.ParticipantDay` | `"participant_day"` | `/api/json/participant_days` |

---

## `Schedule` endpoints

### `POST /api/json/schedules` — `:initiate`

Authorised: actor is the GM of the target `game_id`.

Request body:
```json
{
  "data": {
    "type": "schedule",
    "attributes": {
      "month": 10,
      "year": 2026,
      "start_time": "19:00:00",
      "end_time": "23:00:00",
      "time_zone": "America/Chicago"
    },
    "relationships": {
      "game": { "data": { "type": "game", "id": "<game-id>" } }
    }
  }
}
```

Validation errors (HTTP 422):
- `month not in 1..12`.
- `time_zone unknown` (not in Tzdata).
- `month/year strictly before current month in time_zone` → message `"You can only schedule the current month or later."`
- Identity violation `unique_per_game_month` → message `"There's already a schedule for <Month> <Year>. Delete it first to start over."` (FR-002).

Success response (HTTP 201): the new schedule with `name` calculation included by default.

### `GET /api/json/schedules?filter[game_id]=<id>&page[limit]=6` — `:list_for_game_top_six`

Authorised: GM of game.

Default sort: `year DESC, month DESC`. Returns up to 6 schedules. Includes `submission_count` and `participant_count` calculations.

### `GET /api/json/schedules?filter[game_id]=<id>` — `:list_for_game`

As above without the `:limit` 6.

### `GET /api/json/schedules/:id?include=schedule_days,participants.player,participants.participant_days` — `:get_for_game`

Authorised: GM of game. Loads everything the Schedule Detail page needs.

### `PATCH /api/json/schedules/:id` — generic mutation router

The Ash JSON:API integration emits one `PATCH` route per update action; the SPA prefers RPC for these. JSON:API mutations include:

- `:set_gm_day` — body carries `meta.action_input: { day, status }`.
- `:transition_to_ready_for_availability` — empty `meta.action_input`.
- `:post` — empty.
- `:update_final_days` (allowed in `:ready_for_availability` or `:posted`) and `:update_final_days_and_notify` (allowed only in `:posted`) — `meta.action_input: { final_days: [{day, status}, ...] }`.

### `DELETE /api/json/schedules/:id` — `:delete`

Body MUST include `meta.action_input: { confirmation: "delete" }` (FR-043). Server-side validation rejects any other value with HTTP 422 and message `"Type \"delete\" exactly to confirm."`.

### `GET /api/json/schedules?filter[player_character_id]=<player-id>` — `:list_for_player_character`

Authorised: linked player (the actor whose user owns the player). Filters out `:preparing` schedules.

### `GET /api/json/schedules/:id?filter[player_character_id]=<player-id>&include=schedule_days,participants[where:id=<my-participant>].participant_days` — `:get_for_player_character`

The query is shaped so a player only ever sees their own participant + days, plus `schedule_days` (with `gm_status` field-policy-stripped to nil for non-GMs; the `gm_locked_na` calculation is included instead).

---

## `ScheduleParticipant` endpoints

### `GET /api/json/schedule_participants?filter[schedule_id]=<id>` — `:list_for_schedule`

Authorised: GM (returns all rows) or self-participant (filtered to own row only). Includes `player`, `participant_days`.

### `PATCH /api/json/schedule_participants/:id` — `:set_submission` or `:send_reminder`

- `:set_submission` body: empty `meta.action_input`. Sets `submitted_at` to now if null. Authorised to the participant.
- `:send_reminder` body: empty `meta.action_input`. Authorised to the GM. Triggers fan-out.

---

## `ParticipantDay` endpoints

### `PATCH /api/json/participant_days/:id` — `:set_status`

Authorised to the participant whose `player.user_id == ^actor(:id)`.

Body:
```json
{
  "data": {
    "type": "participant_day",
    "id": "<id>",
    "attributes": { "status": "I" }
  }
}
```

Validation errors:
- Status not in `[NA, I, A, IF]` → 422.
- Schedule status not `:ready_for_availability` → 422 `"You can't change availability on a schedule that isn't open for input."`
- Participant `np_only?: true` → 422 `"This day is read-only."` (defensive — the UI never offers the action here).
- Matching `ScheduleDay.gm_status == :NA` → 422 `"The GM marked this day Not Available."` (defensive — UI grays the cell).

---

## `ScheduleDay` endpoints

`ScheduleDay` has no public mutation endpoints; mutations route through `Schedule.set_gm_day` / `Schedule.post` / `Schedule.update_final_days` / `Schedule.update_final_days_and_notify`. The resource is exposed for `include` traversal only.

`gm_status` is field-policy-gated (see [data-model.md](../data-model.md) §ScheduleDay) — non-GM readers receive `null` for this attribute; they read `gm_locked_na :: :boolean` instead, which is a calculation that returns true when `gm_status == :NA`.

---

## Calculations exposed in the contract

The following Ash calculations appear in JSON:API payloads:

| Resource | Calculation | Type | Default loaded? | Notes |
| --- | --- | --- | --- | --- |
| `Schedule` | `name` | string | yes | e.g. `"October 2026 7:00 PM – 11:00 PM"` |
| `Schedule` | `submission_count` | integer | no | loaded by table view |
| `Schedule` | `participant_count` | integer | no | loaded by table view |
| `ScheduleDay` | `final_note_kind` | atom (`good_day` / `maybe` / `maybe_with_if` / `bad_day`) | no | loaded by Scheduling View |
| `ScheduleDay` | `final_note_label` | string | no | loaded by Scheduling View |
| `ScheduleDay` | `gm_locked_na` | boolean | yes (replaces gm_status for non-GMs) | |

---

## OpenAPI drift gate

`mix ash_json_api.codegen` regenerates the OpenAPI spec at `priv/static/openapi.json` (existing path from feature 001). The drift gate (`git diff --exit-code priv/static/openapi.json` in CI) blocks merges with uncommitted changes. PR descriptions for any breaking change MUST flag it.

---

## Error format

All 4xx/5xx responses use the JSON:API error envelope:

```json
{
  "errors": [
    {
      "status": "422",
      "code": "validation_error",
      "title": "Validation failed",
      "detail": "<human plain-language message>",
      "source": { "pointer": "/data/attributes/start_time" }
    }
  ]
}
```

Per Principle V, `detail` MUST be plain language. The mapping from Ash error types (constraint violation, validation error, forbidden, not_found) to the messages above is centralized in `GameNightWeb.AshJsonApi.ErrorRenderer` (existing module from feature 001).
