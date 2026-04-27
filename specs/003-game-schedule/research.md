# Phase 0 Research: Game Schedule

## §1. Derived display values via Ash calculations (the user's directive)

**Decision**: Express every derived presentation value as an Ash `calculate` block on the resource. Specifically:

- `Schedule.name :: :string` — composed from `month`, `year`, `start_time`, `end_time`. Implemented as a calculation **module** (`GameNight.Schedules.Calculations.Name`) rather than an inline `expr/1`, because formatting requires `Calendar.strftime/2` and locale-aware AM/PM rendering that is beyond Ash's expression DSL.
- `ScheduleDay.final_note_kind :: :atom` (one of `:good_day | :maybe | :maybe_with_if | :bad_day`) — composed from `gm_status` and the related `participant_days` for the same `day`. Implemented as a calculation module that loads `participant_days` via the Ash load API.

**Rationale**:
1. Calculations are first-class members of the resource contract: they participate in JSON:API serialization, are loadable via `?fields[schedule]=name`, and surface in the `ash_typescript`-generated client without any extra wiring. A stored column would require a `change` to keep it consistent with `month`/`year`/`start_time`/`end_time` — adding write paths for a value that is purely a function of other fields invites drift.
2. Calculations are testable in isolation (`Ash.calculate/3` invocation in ExUnit), separate from the create/update path.
3. They participate in field policies — if a future requirement says "name is hidden from non-GMs," it can be field-policy-gated like any attribute.
4. The user's directive ("derive that using Ash best practices") explicitly chooses this path.

**Alternatives considered**:
- **Stored column kept in sync via a `change`**: rejected for the drift reason above and because Ash codegen emits a meaningless migration each time the format string changes.
- **Computed in the view layer (Phoenix or React)**: rejected because the SPA would need three pieces (month, year, time-slot) to render every reference — every list, every breadcrumb, every email subject. Centralising in the resource keeps every consumer pointed at one source.

**Implementation note**: For `Schedule.name`, mark `public? true` and include in the JSON:API default fields. For `final_note_kind`, mark `public? true` and load on demand by the Scheduling View; do not include in default fields because its load cost (joining `participant_days` for one day) is not free for list payloads.

## §2. Domain placement: `GameNight.Schedules` rather than extending `GameNight.Games`

**Decision**: Introduce a new Ash domain `GameNight.Schedules` housing `Schedule`, `ScheduleDay`, `ScheduleParticipant`, `ParticipantDay`, plus the `System` internal context and the cascade `change` modules.

**Rationale**:
1. Bounded concern: schedule lifecycle (`preparing` → `ready_for_availability` → `posted`), notification fan-out, GM-NA cascade, late-joiner NP marking, and Final Note classification together represent enough internal logic to constitute its own domain. Mixing this into `GameNight.Games` would dilute the Game/Player/Invitation domain that already exists.
2. Precedent: feature 002 split `Notifications` out for the same reason — a polymorphic resource with four-plus action surfaces and its own internal context. The Schedules domain follows that pattern exactly.
3. JSON:API router ergonomics: a separate `domains:` entry in `AshJsonApiRouter` keeps the URL space tidy (`/api/json/schedules`, `/api/json/schedule_days`, etc.) and makes drift gates per-domain.
4. Cross-domain references (`ScheduleParticipant.player_id` → `GameNight.Games.Player`) are unambiguous and testable.

**Alternatives considered**:
- **Extend `GameNight.Games`**: rejected as above (concern creep).
- **Multiple domains (one per resource)**: over-fragments. The four resources cooperate closely.

## §3. The `<MonthCalendar>` component: bespoke vs `react-day-picker`

**Decision**: Build a bespoke `<MonthCalendar>` component using Tailwind + the existing Shadcn `<button>` primitive. It is a `<table role="grid">` of seven columns (Mon–Sun, configurable to start-of-week per locale, default Sunday-first to match the user's planner aesthetic) × 5 or 6 week-rows; each interactive cell is a `<button>` with `role="gridcell"`.

**Rationale**:
1. **Mental-model mismatch.** Shadcn's `<Calendar>` is a thin wrapper over `react-day-picker`, whose entire API is built around "select a date" (single, multiple, or range). The schedule calendar's interaction is fundamentally different: every cell is independently four-state-cyclable. Adapting day-picker via its `Day` slot or `selected` set requires bypassing most of its behaviour and re-introducing focus management on top.
2. **Accessibility predictability.** A bespoke `role="grid"` with explicit roving-tabindex + arrow-key handlers is mechanical to test and matches the WAI-ARIA Grid Pattern. Trying to thread that through day-picker's slots adds opacity to a NON-NEGOTIABLE constitutional gate (Principle IV).
3. **Visual contract.** The user's directive — "desktop planner calendar in styling" — implies a wall-calendar look (large square cells, day number top-left, status badge filling the rest, weekend differentiation). Day-picker's defaults are tuned for compact pickers and resisting them costs more than starting fresh.
4. **Bundle.** `react-day-picker` is ≈ 18 KB gzipped; the bespoke grid is < 4 KB. The savings amortize across two routes.

**Alternatives considered**:
- **Adopt Shadcn `<Calendar>` and override `Day` slot**: feasible but requires fighting the primitive on focus + selection semantics; estimated more code than building fresh.
- **Adopt `@react-aria/calendar`**: gives a perfect grid pattern but introduces React Aria as a new dependency just for this feature. Not justified.

**Implementation note**:
- Cell variants: `available`, `ideal`, `available_if`, `not_available`, `not_present`, `out_of_month` (leading/trailing-week spacers), `gm_locked_na` (player view, GM-NA day).
- Keyboard: ↑/↓ ±7 days, ←/→ ±1 day, Home = first of month, End = last of month, PgUp/PgDn (out of scope for v1 — single-month). Enter/Space cycles status. Tab moves focus out of the grid.
- Announcements: when a cell's status changes, write `<DayName>, <Status>` to the shared `aria-live="polite"` region.

## §4. Final Note classification: server calculation + client mirror

**Decision**: Implement the four-branch classification rule in two places:
1. `GameNight.Schedules.Calculations.FinalNoteKind` — Ash calculation module, returns `:good_day | :maybe | :maybe_with_if | :bad_day` and the list of IF-player names. Used by the player-facing widget on the character "View Game" page where loading a server-precomputed badge avoids over-fetching participant rows.
2. `assets/js/features/schedules/final-note.ts` — pure TypeScript function with the same input/output. Used by `<DayMatrixTable>` on the GM Scheduling View where every participant's day status is already loaded, so client computation is free and avoids a round-trip on every Final-toggle.

**Rationale**:
- Computing twice is normally a smell, but this rule is small (≤ 20 LOC each) and slow to change. The constitution's "single source of truth" principle is satisfied by the **shared truth table** ([./contracts/rpc.md](./contracts/rpc.md) §Final Note Truth Table) that drives both an ExUnit test (`final_note_kind_test.exs`) and a Vitest test (`final-note.test.ts`).
- The alternative — only server, force a round trip per toggle — degrades INP and is wasteful when the data is already loaded.
- The alternative — only client, force every consumer (including future email digests, future analytics) to reimplement — would re-introduce drift.

**Truth table** (exact rule, codified in shared test data):

For a given `day`, let `P = { participant statuses for the day, excluding NP late-joiners }`, `gm` = GM status for the day, `n = |P|`.

| Condition (evaluated top to bottom; first match wins) | `kind` | `label` |
| --- | --- | --- |
| `gm == :NA` | `:bad_day` | `"Bad Day"` (background red) |
| `gm in [:I, :A] AND every p in P is :I or :A` | `:good_day` | `"Good Day"` (background green) |
| `count(p in P, p == :IF) >= 1` | `:maybe_with_if` | `"Maybe, talk to <comma-separated IF names>"` (background yellow) |
| `count(p in P, p in [:NA, :IF]) > n / 5` *(strict, integer-divided)* | `:bad_day` | `"Bad Day"` (background red) |
| `count(p in P, p in [:NA, :IF]) <= n / 5 AND > 0` | `:maybe` | `"Maybe"` (background yellow) |
| `n == 0 AND gm in [:I, :A]` | `:good_day` | `"Good Day"` (background green) |
| otherwise | `:bad_day` | `"Bad Day"` (background red) |

(The "more than one-fifth" rule with `n < 5` reduces to "1 or more" which is the spec assumption already documented.)

**Color/non-color cue**: each kind also carries a leading icon to satisfy WCAG 1.4.1 (Use of Color):
- `:good_day` → ✓ + green
- `:maybe` → ⚠ + yellow
- `:maybe_with_if` → ⚠ + yellow + the IF names
- `:bad_day` → ✕ + red

**Pre-post Final persistence**: Per [data-model.md](./data-model.md) §`:update_final_days`, the GM's per-cell Final toggles in the Scheduling View persist via `Schedule.update_final_days` while the schedule is `:ready_for_availability`. When the view first opens, the client renders pre-fill values from the truth-table rule but does not write them; the persisted `final_status` remains `null` until the GM either toggles a cell or the `Schedule.post` action runs `ComputeFinalDefault` (which fills only the still-`null` days). This keeps "GM never touched the cell" distinguishable from "GM explicitly set NA" in case a future feature wants to surface that distinction.

## §5. Player linkage and the "joined late" cases

**Decision**: A `ScheduleParticipant` row carries two boolean flags:
- `np_only? :: boolean` — set true when the participant joined a schedule that was already `posted`. NP-only participants do not contribute to submission counts and their cells are read-only/grayed.
- `is_late_join? :: boolean` — set true when the participant was created after the schedule transitioned to `ready_for_availability`. Used only for telemetry / audit; behavior is otherwise identical to original participants for non-posted schedules.

`Schedule.System.add_late_joiner/2` is the single entry point for both cases. It examines schedule status:
- `:preparing` — reject (schedule not yet visible to players; shouldn't be reachable, but defensive).
- `:ready_for_availability` — create participant with `np_only: false, is_late_join: true`, every `participant_day` initialised to NA, send the same `:schedule_ready_for_availability` notification + email as original participants.
- `:posted` — create participant with `np_only: true, is_late_join: true`, every `participant_day` initialised to NP, no notification (they didn't miss anything time-sensitive — the schedule is locked).

**Rationale**:
1. Distinguishing NP-only from regular linkage at the row level keeps the read policy simple: the Scheduling View filters `np_only: false` for submission counts; the player view honors `np_only` to render every cell as read-only.
2. The flag also drives the "Send Reminder" eligibility (FR-037 — NP-only participants are excluded from the reminder list).

**Alternatives considered**:
- **Materialize NP cells as a per-day status enum value with no flag**: rejected because the policy logic ("can this user submit availability?") would have to inspect every participant_day rather than a single bool on the participant row.
- **Don't link NP-only participants at all; render past schedules from the schedule alone**: rejected because the player still needs to see the days the GM committed to, and rendering an empty/grayed calendar without a participant link diverges from the rest of the system.

## §6. Player removal: cleanup on non-posted schedules; freeze on posted

**Decision**: When a `GameNight.Games.Player` row is destroyed, the Player resource's `:destroy` action runs a `before_action` introduced by this feature that explicitly handles the cascade per branch (the FK on `schedule_participants.player_id` is `ON DELETE RESTRICT` to force the application path):
- Delete the `ScheduleParticipant` and all `ParticipantDay` rows for any non-posted schedule (`preparing` or `ready_for_availability`).
- For `posted` schedules: leave the rows in place but mark the participant `np_only: true`, null `submitted_at`, and overwrite every `participant_day.status` to `:NP`, so the historical record stays intact and the view renders as for a late joiner.

The submission count denominator (FR-036) computes from `count(participants where np_only == false)` so removed-from-non-posted players naturally drop out and removed-from-posted players (which won't happen until a future feature anyway) preserve historical truth.

**Rationale**:
1. Deleting the player's submission from a posted schedule would silently rewrite history. Leaving the row + flagging it preserves the audit trail without confusing the GM.
2. For non-posted schedules, the participant has no committed value to preserve; the cleanest behavior is to remove the link.

**Alternatives considered**:
- **Soft-delete on Player**: out of scope — feature 002 chose hard-delete and this feature inherits.
- **Always preserve participant rows**: would require additional UI to distinguish "is this person still in the game?" everywhere a participant column appears. Not worth the cost in v1.

## §7. Time slot representation and timezone

**Decision**:
- `start_time :: :time` and `end_time :: :time` (Erlang `~T` literals) on the `Schedule` resource, both required.
- `time_zone :: :string` (IANA tz name) on the `Schedule` resource, captured from the GM's browser at initiation and validated against `Tzdata`'s known-zones list.
- Time slots may cross midnight; the resource declares no constraint that `end_time > start_time`. The day a slot belongs to is the day the slot **starts in** (FR-007).

**Rationale**:
1. `:time` types serialize cleanly to JSON:API and `ash_typescript` and avoid the timezone-on-time confusion that `:datetime` would invite (a calendar slot is "every Wednesday at 7pm-11pm in the GM's local time," not a single instant).
2. Storing the IANA tz name (not an offset) future-proofs across DST boundaries.
3. The browser supplies the IANA name via `Intl.DateTimeFormat().resolvedOptions().timeZone`; the SPA sends it as part of the create payload. Validation rejects unknown zones with a plain-language error.

**Alternatives considered**:
- **Store `:utc_datetime` for both ends with a date**: rejected because schedules don't have a single canonical day — they have a month, and each day inherits the same time slot.
- **Store `start_time` as `:string`**: rejected; loses ordering and validation.

## §8. Past-month check: GM timezone, integer compare

**Decision**: `Schedule.initiate` validates the chosen `(month, year)` is `>= current_month_year_in_gm_timezone(time_zone)` where the GM's tz comes from the same payload field as §7. The validation is a custom `Ash.Resource.Validation` because the comparison needs the actor's submitted tz, not server tz.

**Rationale**:
1. A GM in `America/Los_Angeles` initiating at 11pm on Sept 30 is in October by Pacific time; the server (UTC) sees Oct 1. Using the server tz would erroneously block October-from-the-GM's-perspective initiations near midnight. The user explicitly chose GM-tz semantics.
2. Integer comparison avoids any DST or end-of-month edge-case surprises that a `Date.compare/2` of "first of month" would invite.

## §9. Notification fan-out and email

**Decision**: Each notification-emitting action calls a single internal function `GameNight.Schedules.System.fan_out_notification(schedule, kind, recipients)` which:
1. Inserts one `Notification` row per recipient (kind = one of the four new schedule kinds).
2. Enqueues one Swoosh email per recipient via `Mailer.deliver/1` (production: configured async adapter; test: local synchronous mailbox).
3. Emits a `:telemetry` span around the fan-out.

The notification kinds extend the existing discriminated union (kept in `notifications/kinds.ts` on the SPA):
- `:schedule_ready_for_availability` → email subject `"<Game name> schedule for <Month Year> is ready for your availability"`.
- `:schedule_posted` → `"<Game name> schedule for <Month Year> has been posted"`.
- `:schedule_updated` → `"<Game name> schedule for <Month Year> was updated"`.
- `:schedule_reminder` → `"Reminder: <GM name> is waiting on your availability for <Month Year>"`.

Each notification's `subject_type/subject_id` points at the `Schedule` row; `payload` carries `{ schedule_id, schedule_name, game_id, game_name, gm_display_name }`. `gm_display_name` is required by the reminder-email subject template and is included in every kind for symmetry — the bell dropdown and the `/notifications` page render and link without an extra fetch, and email senders read directly from the payload rather than re-querying the schedule's owner.

**Rationale**:
1. Mirrors feature 002's invitation notification pattern exactly — minimal new surface, maximum reuse of the existing fan-out, telemetry, and rendering paths.
2. Centralising fan-out in `System.fan_out_notification/3` keeps the notification + email atomicity guarantee (success of both, or rollback the schedule transition) in one place.

## §10. Posted-schedule visibility on the player dashboard

**Decision**: The dashboard "My Characters" rows already exist (feature 002). Each row links to `/characters/$id`. That page renders:
- All the columns the dashboard row already shows (game name, character name, status, summary, etc.).
- A "Schedules" section that renders the **current month** and **upcoming month** posted schedules (if any) inline as compact `<MonthCalendar>` views in read-only mode (status pulled from `participant_days` joined to the player's participant link, with the GM's `final_status` rendered as the day's primary visual — the player sees "what days the GM committed to," with their own NA-locked / NP-locked / submitted status as a secondary indicator).
- A "View All" link to `/characters/$id/schedules` (full list, sorted future-then-past).

**Rationale**:
1. Per FR-039: "current month" = the calendar month containing today; past schedules don't appear in the widget regardless of post date.
2. Showing the calendar inline (vs. a one-line summary) gives the player immediate visual confirmation of the posted days, which is the value of the schedule.
3. "View All" lives at `/characters/$id/schedules` (one nesting level deeper) rather than a global `/schedules` to keep the per-character mental model the spec specified.

**Alternatives considered**:
- **Aggregate all characters' schedules under one global player route**: rejected per Q11 — the user chose the per-character view explicitly.

## §11. Authorization edges: the player removal race

**Decision**: All player-side reads of a schedule join through `participants` and then `players`, so a player who has been removed from the game in the same request cycle as they're trying to view a schedule fails the policy on the standard `player.user_id == ^actor(:id)` clause (the `Player` row no longer exists). The request returns 404 with the standard "schedule not found" message — never "you've been removed from the game" (which would leak game membership).

**Rationale**: deny-by-default + opaque 404 is the standard pattern from feature 002.

## §12. The "type `delete` to confirm" action argument

**Decision**: `Schedule.delete` declares an action argument `confirmation :: :string` and an `Ash.Resource.Validation` that asserts `confirmation == "delete"` (case-sensitive). The validation runs before policies. The frontend dialog enables the destructive button only when the input matches.

**Rationale**:
1. Server-side validation is the source of truth — disabling the button alone is not enough.
2. The case-sensitive match matches feature 001's typed-confirmation pattern (typing the game name to delete a game) and feature 002's typed-confirmation revoke (typing the invitee email).

## §13. Concurrency: GM-NA cascade and last-write-wins on Final values

**Decision**:
- The `update_gm_day` action wraps the GM status update + the cascade overwrite of every `participant_day` for that day in a single Ash multitenant-safe `transaction: true` block (Ash domain default in this project). Players cannot observe a partial cascade because the transaction commits atomically.
- The Final column in the Scheduling View is last-write-wins: each cell click is one `update_schedule_day_final` call; concurrent edits between two GM tabs converge on the most recent commit. No optimistic-concurrency token is added in v1; this is acceptable because schedules are owned by a single GM.

**Rationale**: simplest mental model that satisfies the spec. Any future multi-GM-co-owner feature (out of scope) would require revisiting.

## §14. Indexes

**Decision** — composite indexes:
- `schedules(game_id, year DESC, month DESC)` — View Game schedules table sort.
- `schedules(game_id, status)` — partial-index candidate if we see hot reads filtering by status; deferred unless telemetry shows need.
- `schedule_days(schedule_id, day)` — every read of a schedule fans this out.
- `schedule_participants(schedule_id, np_only, submitted_at, joined_at)` — submission count + reminder list + roster sort.
- `schedule_participants(player_id, schedule_id)` — player-side reverse lookup.
- `participant_days(participant_id, day)` — per-cell reads.
- Unique: `schedules(game_id, year, month)` enforces the spec's "one schedule per game per month" rule (FR-002).
- Unique: `schedule_days(schedule_id, day)`.
- Unique: `schedule_participants(schedule_id, player_id)`.
- Unique: `participant_days(participant_id, day)`.

## §15. Deletion cascade (FR-044)

**Decision**: At the data layer, `participant_days.participant_id` and `participant_days.schedule_id` (denormalised — see §16) both have `ON DELETE CASCADE`. `schedule_participants.schedule_id` has `ON DELETE CASCADE`. `schedule_days.schedule_id` has `ON DELETE CASCADE`. `notifications` rows whose `subject_type = "schedule"` and `subject_id = <deleted schedule id>` are removed by the `Schedule.delete` action's `change` callback after the schedule itself is destroyed.

**Rationale**: DB-level cascade is the safety net; the action callback handles the polymorphic notification cleanup that the FK can't see.

## §16. Schema denormalisation — `participant_days.schedule_id`

**Decision**: `participant_days` carries both `participant_id` (FK to `schedule_participants`) and `schedule_id` (FK to `schedules`). The latter is denormalised for two reasons:
1. The most common read ("load all participant_days for a schedule") becomes a single index hit rather than a join.
2. The cascade-on-delete works at the DB layer for both axes.

A `change_participant_id` validation asserts on insert that `participant.schedule_id == schedule_id` so the denormalisation can never disagree.

**Rationale**: trades a small write-side validation for a large read-side simplification. The cost is tested.

## §17. Test data builders

**Decision**: Add `GameNight.SchedulesFixtures` to `test/support/` with helpers `schedule_for/2` (creates a `preparing` schedule), `ready_schedule_for/3` (transitions to ready and links N players), `posted_schedule_for/3` (full lifecycle to posted with deterministic per-day data). Mirrors the `GameNight.GamesFixtures` and `GameNight.NotificationsFixtures` patterns from features 001/002.

**Rationale**: every test that touches a schedule needs a same-shape builder; centralising prevents drift in test setup.

## §18. Rejected: storing the participant's "submitted at any non-default value" flag

**Considered**: a `has_modified_any_day :: :boolean` flag on `ScheduleParticipant` to gate the "submitted" status (FR-022) on at-least-one-cell-touched.

**Rejected**: the user explicitly chose the simpler rule — "all-NA is a valid submission." Submission is gated only on the user clicking "Set Availability," tracked via `submitted_at :: :utc_datetime_usec`. No content gate.

---

## Open questions deferred to `/speckit.tasks`

(None block planning. Surfaced here so the next phase considers them.)

- **Email templating** — concrete subject lines and body copy will be drafted alongside `senders/*.ex` files in tasks. The spec is silent on the exact wording; copy review per Principle V applies.
- **Bell badge count semantics** — feature 002's bell already counts unread invitations. Should schedule notifications increment the same badge or get their own segmented count? Default to "single unread badge across all kinds" because that matches the existing implementation; revisit if user testing surfaces confusion.
- **Calendar week-start** — Sunday-first vs Monday-first. Default Sunday-first to match the desktop-planner aesthetic; a future locale-aware setting can override.
