---

description: "Task list for feature 003 — Game Schedule"
---

# Tasks: Game Schedule

**Input**: Design documents from `/specs/003-game-schedule/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: MANDATORY per Constitution Principle I (Test-First Development, NON-NEGOTIABLE). Every user story MUST have failing tests written and verified RED before any implementation task in the same story begins. Each commit that introduces behavior ships its failing test in the same commit (or in the immediately preceding commit) per the `/tdd` skill procedure.

**Organization**: Tasks are grouped by user story. Each story is independently testable and shippable as an MVP increment. The four P1 stories (US1–US4) form the schedule lifecycle and SHOULD be shipped together; the P2/P3 stories add value but do not block the lifecycle.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[Story]**: User-story tag (US1–US9). Setup, Foundational, and Polish phases have no story tag.
- File paths are exact; agents executing tasks should not need to discover them.

## Path Conventions

- Backend (Elixir/Phoenix/Ash): source in `lib/`, tests in `test/` and `test/support/`. Migrations under `priv/repo/migrations/`. Resource snapshots under `priv/resource_snapshots/repo/`.
- Frontend (React/TanStack/Shadcn): source in `assets/js/`, route files under `assets/js/routes/`, feature folders under `assets/js/features/`. Component tests colocated. Playwright specs under `assets/e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project plumbing required by every subsequent phase.

- [X] T001 Create the `GameNight.Schedules` Ash domain stub in [lib/game_night/schedules.ex](lib/game_night/schedules.ex) with `use Ash.Domain` and an empty `resources do ... end` block; declare `extensions: [AshJsonApi.Domain, AshTypescript.Rpc]` and an empty `typescript_rpc do ... end` block ready for action registrations. Also register the domain in [config/config.exs](config/config.exs) `:ash_domains` (required for codegen to discover resources — codebase convention).
- [X] T002 Register the new domain in [lib/game_night_web/ash_json_api_router.ex](lib/game_night_web/ash_json_api_router.ex) by appending `GameNight.Schedules` to the `domains:` list.
- [ ] T003 ~~[P]~~ Add `has_many :schedules, GameNight.Schedules.Schedule` to [lib/game_night/games/game.ex](lib/game_night/games/game.ex). **DEFERRED to Phase 2 alongside T008** — adding a `has_many` to a not-yet-defined module breaks compilation. Will land in the same commit as T008.
- [X] T004 [P] Extend the `kind` attribute constraint on [lib/game_night/notifications/notification.ex](lib/game_night/notifications/notification.ex) with `:schedule_ready_for_availability`, `:schedule_posted`, `:schedule_updated`, `:schedule_reminder`.
- [X] T005 [P] Create the frontend feature folder scaffold at [assets/js/features/schedules/](assets/js/features/schedules/) with empty `hooks.ts`, `kinds.ts`, `final-note.ts`, `schemas.ts`, `components/` directory, plus a placeholder `index.ts` re-exporting nothing (so subsequent tasks have a stable path). Also created the `__fixtures__/` subdir for the truth-table JSON fixture from T018.
- [X] T006 [P] Add an empty test-support module [test/support/fixtures/schedules_fixtures.ex](test/support/fixtures/schedules_fixtures.ex) (`defmodule GameNight.SchedulesFixtures do; end`) ready for fixture helpers. **Path corrected**: codebase convention places fixtures at `test/support/fixtures/`, not `test/support/`. Tests alias this module explicitly — no auto-import via `data_case.ex` (matches existing `AccountsFixtures` pattern from feature 001).

**Checkpoint**: Domain registered (in both the JSON:API router and `config :ash_domains`), notification kind enum extended, frontend folder + fixtures stub exist. T003 deferred to Phase 2 because Schedule resource doesn't exist yet. Codebase compiles cleanly with `--warnings-as-errors` and frontend typechecks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Resource shapes, migrations, generated types, and the shared truth-table fixture that every user story depends on. **No user-story work begins until this phase is complete.**

### Foundational tests (RED first)

- [X] T007 Write [test/game_night/notifications/notification_test.exs](test/game_night/notifications/notification_test.exs) additions asserting the four new `kind` atoms are accepted by `Notification.create` and rejected when an unknown atom is passed; verify RED before T008.

### Resource skeletons + migration

- [X] T008 Create [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) with attributes (`id`, `game_id`, `month`, `year`, `start_time`, `end_time`, `time_zone`, `status` default `:preparing`, `posted_at`, timestamps) per [data-model.md](./data-model.md), the `unique_per_game_month` identity, `belongs_to :game`, and an empty `actions` block. Register in `GameNight.Schedules.resources` (T001).
- [X] T009 Create [lib/game_night/schedules/schedule_day.ex](lib/game_night/schedules/schedule_day.ex) with attributes and `unique_per_schedule_day` identity per data-model; `belongs_to :schedule`; empty actions. Register in domain.
- [X] T010 Create [lib/game_night/schedules/schedule_participant.ex](lib/game_night/schedules/schedule_participant.ex) with attributes (`is_late_join?`, `np_only?`, `submitted_at`, `joined_at`), `unique_per_schedule_player` identity, `belongs_to :schedule`, `belongs_to :player`. Register in domain.
- [X] T011 Create [lib/game_night/schedules/participant_day.ex](lib/game_night/schedules/participant_day.ex) with attributes (incl. denormalised `schedule_id`), `unique_per_participant_day` identity, validation `participant.schedule_id == schedule_id`, `belongs_to :participant`, `belongs_to :schedule`. Register in domain.
- [X] T012 Run `mix ash.codegen create_schedule_resources` and commit the generated migration to [priv/repo/migrations/](priv/repo/migrations/) and resource snapshots to [priv/resource_snapshots/repo/{schedules,schedule_days,schedule_participants,participant_days}/](priv/resource_snapshots/repo/).
- [X] T013 Run `mix ecto.migrate` locally; verify the four tables exist with correct FKs and unique indexes. (No code change — this is a verification gate.) If `mix ash.codegen --check` is not clean, return to T012 and regenerate.
- [X] T014 Add manual composite indexes to a hand-written migration appended to the generated one — `schedules(game_id, year DESC, month DESC)`, `schedule_participants(schedule_id, np_only, submitted_at, joined_at)`, `schedule_participants(player_id, schedule_id)`, `participant_days(participant_id, day)` — per [research.md §14](./research.md). Permitted under Constitution II clause "(a) hand-written data migrations in `priv/repo/migrations/`" — annotate the migration file with a top-of-file comment citing this clause.

### Generated client + fixtures + truth table

- [X] T015 [P] Run `mix ash_typescript.codegen` and commit the regenerated [assets/js/ash_rpc.ts](assets/js/ash_rpc.ts) and [assets/js/ash_types.ts](assets/js/ash_types.ts). The four resources should appear with empty action surfaces (added per story).
- [X] T016 [P] In [assets/js/features/schedules/kinds.ts](assets/js/features/schedules/kinds.ts), define and export `ScheduleStatus`, `AvailabilityStatus`, `ParticipantDayStatus`, `FinalStatus`, `FinalNoteKind` per [contracts/rpc.md](./contracts/rpc.md). Add a Vitest snapshot test [assets/js/features/schedules/kinds.test.ts](assets/js/features/schedules/kinds.test.ts) asserting the enum values match.
- [X] T017 [P] In [assets/js/features/notifications/kinds.ts](assets/js/features/notifications/kinds.ts), extend the `NotificationKind` discriminated union with the four new schedule kinds and add `ScheduleNotificationPayload`. Update the existing kinds test to cover them.
- [X] T018 Add the shared Final-Note truth-table fixture at [test/support/schedule_final_note_fixtures.exs](test/support/schedule_final_note_fixtures.exs) — defines a list of `{gm, participants, expected_kind, expected_label_template}` rows from [contracts/rpc.md §Final Note Truth Table](./contracts/rpc.md). Mirror the same fixture as a JSON file at [assets/js/features/schedules/__fixtures__/final-note-truth-table.json](assets/js/features/schedules/__fixtures__/final-note-truth-table.json) so Vitest reads identical input.
- [X] T019 [P] Add fixture helpers to [test/support/schedules_fixtures.ex](test/support/schedules_fixtures.ex): `build_schedule_attrs/1`, `system_create_preparing_schedule/2` (uses Ash with `actor: %{_internal?: true}`), `add_player_link/3`, `system_transition_to_ready/1`, `system_post_schedule/2`. Each helper has a doctest asserting shape.
- [X] T020 Stub the `GameNight.Schedules.System` module at [lib/game_night/schedules/system.ex](lib/game_night/schedules/system.ex) with a `@moduledoc` justifying the policy bypass per Constitution II, and empty function shells for `transition_to_ready/1`, `post/1`, `add_late_joiner/2`, `cascade_gm_na/3`, `fan_out_notification/3`, `handle_player_destroy/1` — to be implemented per story.
- [X] T020.5 Update [lib/game_night/games/player.ex](lib/game_night/games/player.ex) `:destroy` action with a `before_action` that delegates to `GameNight.Schedules.System.handle_player_destroy/1`. The `handle_player_destroy/1` function shell already exists in T020 — at this task it remains a no-op stub with a `@doc` describing the contract from [data-model.md §ScheduleParticipant Player-removal handling](./data-model.md). Full implementation lands in T151.5 (US9).
- [X] T020.6 Add the test for player-removal cascade at [test/game_night/schedules/system_test.exs](test/game_night/schedules/system_test.exs): three cases — Player destroyed while linked to a `:preparing` schedule (participant + days deleted), `:ready_for_availability` schedule (same), `:posted` schedule (participant preserved with `np_only: true`, `submitted_at: nil`, every `participant_day.status` set to `:NP`). Verify RED (the stub from T020.5 does not yet implement the branching); test goes GREEN at T151.5.

**Checkpoint**: Resources exist with no actions, migrations applied, generated types include the resource shapes, fixtures and truth-table fixtures are committed, player-removal cascade hook is wired (stubbed). Foundation ready.

---

## Phase 3: User Story 1 — GM initiates a schedule and sets availability (Priority: P1) 🎯 MVP

**Goal**: A GM can pick month/year/time-slot, initiate a `preparing` schedule, see a desktop-planner-style month calendar, and click each day to cycle through NA → I → A → IF.

**Independent Test**: Per [spec.md US1 acceptance scenarios](./spec.md#user-story-1---gm-initiates-a-schedule-and-sets-their-own-availability-priority-p1) — sign in as GM, click Initiate Schedule on View Game, fill the form, see the calendar, click a day and verify the cycle, return to View Game and confirm the schedule appears in the table at status `Preparing`.

### Tests for US1 (RED first) ⚠️

- [X] T021 [P] [US1] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) covering `:initiate` happy path (creates Schedule + 28/29/30/31 ScheduleDay rows with `gm_status: :NA`), validation: month-in-past rejected (`time_zone` arg drives the comparison; cover GM in `America/Los_Angeles` near midnight), duplicate month rejected, unknown timezone rejected, midnight-crossing time slot accepted.
- [X] T022 [P] [US1] Calculation test [test/game_night/schedules/calculations/name_test.exs](test/game_night/schedules/calculations/name_test.exs) covering `Schedule.name`: `October 2026 7:00 PM – 11:00 PM`, AM slot, midnight-crossing slot (`10:00 PM – 2:00 AM`), single-digit minute (`7:05 PM`).
- [X] T023 [P] [US1] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:set_gm_day` cycling NA → I → A → IF → NA on the same day; asserts cascade does **not** fire while status is `:preparing`; asserts the action rejects with the plain-language message `"GM availability is locked once a schedule is posted."` when status is `:posted` (state guard per FR-010).
- [X] T024 [P] [US1] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:list_for_game`, `:list_for_game_top_six` (returns at most 6 ordered year DESC, month DESC), `:get_for_game` (loads schedule_days).
- [X] T025 [P] [US1] Policy test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) covering `:initiate`/`:list_for_game`/`:set_gm_day` for authorized (GM), unauthorized (different user), and anonymous actors.
- [X] T026 [P] [US1] JSON:API request test [test/game_night_web/controllers/schedules_request_test.exs](test/game_night_web/controllers/schedules_request_test.exs) covering POST `/api/json/schedules` (initiate), GET `?filter[game_id]=`, GET `/:id`, PATCH `/:id` for `:set_gm_day`. Assert 422 with plain-language detail messages per [contracts/json-api.md](./contracts/json-api.md).
- [X] T027 [P] [US1] Vitest test [assets/js/features/schedules/components/month-calendar.test.tsx](assets/js/features/schedules/components/month-calendar.test.tsx) covering: render 28-day Feb 2026, render 31-day Oct 2026, click cycles status, arrow-key roving-tabindex (↑/↓ ±7, ←/→ ±1), Enter cycles, locked-NA cells skipped by arrow nav, `aria-disabled="true"` on locked cells, aria-live announcement on status change, `expectNoAxeViolations`. Asserts the first column header is Sunday and that days laid out match a Sunday-first calendar for both the 28-day Feb 2026 case and the 31-day Oct 2026 case.
- [X] T028 [P] [US1] Vitest test [assets/js/features/schedules/components/schedule-status-badge.test.tsx](assets/js/features/schedules/components/schedule-status-badge.test.tsx) covering each status pill render + a11y label.
- [X] T029 [P] [US1] Vitest test [assets/js/features/schedules/components/initiate-schedule-dialog.test.tsx](assets/js/features/schedules/components/initiate-schedule-dialog.test.tsx) covering form validation (Zod), past-month error display, duplicate-month error display, success closes dialog and invalidates query.
- [X] T030 [P] [US1] Vitest test [assets/js/features/schedules/components/schedules-table.test.tsx](assets/js/features/schedules/components/schedules-table.test.tsx) covering 6-row cap, "View All" link, empty state copy, sort order, status badge per row.
- [X] T031 [P] [US1] Vitest test [assets/js/features/schedules/hooks.test.ts](assets/js/features/schedules/hooks.test.ts) covering MSW-mocked `useInitiateSchedule`, `useListSchedulesForGameTopSix`, `useListSchedulesForGame`, `useGetScheduleForGame`, `useSetGmDay` (success + error narrowing).
- [X] T032 [US1] Playwright spec [assets/e2e/schedule-initiate.spec.ts](assets/e2e/schedule-initiate.spec.ts) covering [spec.md US1 acceptance scenarios 1–6](./spec.md#user-story-1---gm-initiates-a-schedule-and-sets-their-own-availability-priority-p1). Run all the tests above and confirm they FAIL with the expected reason before implementing.

### Implementation for US1

- [X] T033 [US1] Implement `Schedule.initiate` create action in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex): accept `month`, `year`, `start_time`, `end_time`, `time_zone`; validations chain (timezone-known, month-not-in-past-given-tz, integer bounds); after-action hook creates one `ScheduleDay` per day in the month with `gm_status: :NA`. Use `Ash.Changeset.manage_relationship/4` with `type: :create` for the days, or call `ScheduleDay.create_for_schedule!/2` from a `change` module.
- [X] T034 [P] [US1] Implement validation modules: [lib/game_night/schedules/validations/timezone_known.ex](lib/game_night/schedules/validations/timezone_known.ex) (delegates to `Tzdata.zone_exists?/1`) and [lib/game_night/schedules/validations/month_not_in_past.ex](lib/game_night/schedules/validations/month_not_in_past.ex) (uses `time_zone` arg, computes `current_month_year/1`, integer-compares).
- [X] T035 [P] [US1] Implement [lib/game_night/schedules/calculations/name.ex](lib/game_night/schedules/calculations/name.ex) using `Calendar.strftime/2` for the month name and a hand-rolled `format_time/1` for AM/PM with single-digit handling.
- [X] T036 [US1] Add `Schedule.set_gm_day` update action in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) (`day` and `status` args; resolves the matching ScheduleDay; calls `ScheduleDay.set_gm_status` internally; cascade gated by `schedule.status == :ready_for_availability` — no-op for `:preparing`). Add a validation that rejects when `schedule.status == :posted` with the message `"GM availability is locked once a schedule is posted."` (per FR-010).
- [X] T037 [US1] Add `Schedule.list_for_game`, `:list_for_game_top_six` (with `prepare build(limit: 6, sort: [year: :desc, month: :desc])`), `:get_for_game` (with `load: [schedule_days: ...]`) read actions in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex).
- [X] T038 [US1] Add `ScheduleDay.set_gm_status` internal update action and `:read` action in [lib/game_night/schedules/schedule_day.ex](lib/game_night/schedules/schedule_day.ex). `:read` rides parent policies (no list endpoint).
- [X] T039 [US1] Implement `Schedule` policies in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) for `:initiate`, `:list_for_game`, `:list_for_game_top_six`, `:get_for_game`, `:set_gm_day` — all `authorize_if expr(game.owner_id == ^actor(:id))`. Add the `_internal?` bypass at the top.
- [X] T040 [US1] Add `:json_api` block to [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) exposing the actions above with appropriate routes; add `:typescript_rpc` entries via `GameNight.Schedules.typescript_rpc`. Run `mix ash_json_api.codegen` and `mix ash_typescript.codegen`; commit regenerated [priv/static/openapi.json](priv/static/openapi.json), [assets/js/ash_rpc.ts](assets/js/ash_rpc.ts), [assets/js/ash_types.ts](assets/js/ash_types.ts).
- [X] T041 [US1] Implement [assets/js/features/schedules/components/month-calendar.tsx](assets/js/features/schedules/components/month-calendar.tsx) — `role="grid"` desktop-planner layout (week rows × day cells), props `{ year, month, cells: DayCell[], onCycle: (day) => void, mode: 'gm-edit' | 'player-edit' | 'read-only', ariaLabelledBy }`. Implement roving-tabindex + arrow keys + Enter cycle + aria-live announcement. Locked NA cells (`mode: 'player-edit'` + `cell.gmLockedNa`) render with `aria-disabled` and skipped focus. Per-status icon prefix (✓/⚠/✕) for color-independence (Principle IV). Week starts Sunday-first per [research.md §3](./research.md); a future locale prop is out of scope for v1.
- [X] T042 [US1] Implement [assets/js/features/schedules/components/schedule-status-badge.tsx](assets/js/features/schedules/components/schedule-status-badge.tsx) using existing Shadcn `<Badge>`; map status → variant + label.
- [X] T043 [US1] Implement [assets/js/features/schedules/schemas.ts](assets/js/features/schedules/schemas.ts) — Zod schema for InitiateSchedule (month 1..12, year ≥ 2024, `start_time`/`end_time` HH:MM, `time_zone` IANA-shaped string).
- [X] T044 [US1] Implement [assets/js/features/schedules/components/initiate-schedule-dialog.tsx](assets/js/features/schedules/components/initiate-schedule-dialog.tsx) using existing Shadcn `<Dialog>` + `<Form>`; native `<input type="month">` and `<input type="time">`; submit disabled with visible reason; toast feedback via existing `TOAST_MESSAGES` (extend whitelist with `schedule_initiated`).
- [X] T045 [US1] Implement [assets/js/features/schedules/components/schedules-table.tsx](assets/js/features/schedules/components/schedules-table.tsx) using existing Shadcn `<Table>`; props `{ schedules: Schedule[], gameId, onInitiate, viewAllLink }`; empty-state copy `"No schedules yet — initiate one to plan a game night."`.
- [X] T046 [US1] Implement TanStack-Query hooks in [assets/js/features/schedules/hooks.ts](assets/js/features/schedules/hooks.ts): `useListSchedulesForGameTopSix`, `useListSchedulesForGame`, `useGetScheduleForGame`, `useInitiateSchedule`, `useSetGmDay` with optimistic local update on the calendar cell; `narrowApiError` for plain-language errors. Define `schedulesKeys` helper.
- [X] T047 [US1] Add route [assets/js/routes/games.$gameId.schedules.index.tsx](assets/js/routes/games.$gameId.schedules.index.tsx) — the View All schedules list (no 6-row cap). Auth guard via `beforeLoad`. `<h1 data-route-heading>`.
- [X] T048 [US1] Add route [assets/js/routes/games.$gameId.schedules.$scheduleId.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.tsx) — GM Schedule Detail. Loads schedule via `useGetScheduleForGame`, renders header (name + status badge), `<MonthCalendar mode="gm-edit">` wired to `useSetGmDay`, secondary action area with placeholder buttons for "Ready for Availability" (US2), "Scheduling View" (US4), "Delete" (US8) — disabled in this story.
- [X] T049 [US1] Update [assets/js/routes/games.$id.index.tsx](assets/js/routes/games.$id.index.tsx) to render `<SchedulesTable>` with `useListSchedulesForGameTopSix`, an "Initiate Schedule" button that opens `<InitiateScheduleDialog>`, and a "View All" link to `/games/$id/schedules`. Update [assets/js/routes/games.$id.index.test.tsx](assets/js/routes/games.$id.index.test.tsx) accordingly.
- [X] T050 [US1] Run `mix precommit`, `mix credo --strict`, `mix dialyzer`, `bun run typecheck && bun run lint && bun run test` and the new Playwright spec. All previously-RED tests now GREEN; nothing else regressed.

**Checkpoint**: US1 complete. A GM can initiate a schedule, see a desktop-planner-style calendar, and toggle their per-day availability. The View Game schedules table shows the new schedule.

---

## Phase 4: User Story 2 — Transition to Ready for Availability (Priority: P1)

**Goal**: GM transitions a `preparing` schedule to `ready_for_availability`; every accepted player is linked, emailed, and notified in-app. Late-joining accepted players are linked retroactively.

**Independent Test**: Per [spec.md US2 acceptance scenarios](./spec.md#user-story-2---gm-transitions-schedule-to-ready-for-availability-priority-p1).

### Tests for US2 (RED first) ⚠️

- [X] T051 [P] [US2] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:transition_to_ready_for_availability` — creates one ScheduleParticipant per accepted Player with `np_only: false`, `is_late_join: false`, every `participant_day` defaulted to NA; flips `status: :ready_for_availability`; asserts retry is idempotent (no duplicate participants).
- [X] T052 [P] [US2] System test [test/game_night/schedules/system_test.exs](test/game_night/schedules/system_test.exs) covering `transition_to_ready/1` end-to-end: links participants, fans out notifications + emails, telemetry span emitted. Asserts policy bypass is confined.
- [X] T053 [P] [US2] Action test in [test/game_night/schedules/schedule_participant_test.exs](test/game_night/schedules/schedule_participant_test.exs) for `add_late_joiner/2` against a `:ready_for_availability` schedule — creates a new participant with `is_late_join: true, np_only: false`, NA per-day rows, fires the same notification + email.
- [X] T054 [P] [US2] Email-rendering test [test/game_night/schedules/senders/send_schedule_ready_email_test.exs](test/game_night/schedules/senders/send_schedule_ready_email_test.exs) using Swoosh's `assert_email_sent` against the local mailbox; asserts subject + body include game name and schedule name.
- [X] T055 [P] [US2] Policy test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) — non-GM cannot call `:transition_to_ready_for_availability`; anonymous forbidden.
- [X] T056 [P] [US2] Vitest test [assets/js/features/schedules/components/transition-to-ready-button.test.tsx](assets/js/features/schedules/components/transition-to-ready-button.test.tsx) covering soft-confirm, success toast, error narrowing.
- [X] T057 [US2] Playwright spec [assets/e2e/schedule-ready-for-availability.spec.ts](assets/e2e/schedule-ready-for-availability.spec.ts) covering full flow including `TestMailboxController` assertion of 3 emails and bell badge increment for each player. Run all the new tests; verify RED.

### Implementation for US2

- [X] T058 [US2] Implement `Schedule.transition_to_ready_for_availability` update action in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex). Use `change build(set_attribute: :status, ...)` and a `change` module that delegates to `GameNight.Schedules.System.transition_to_ready/1`. Asserts current status is `:preparing` (validation).
- [X] T059 [US2] Implement [lib/game_night/schedules/changes/link_active_players.ex](lib/game_night/schedules/changes/link_active_players.ex) — fetches all accepted `Player` rows for the schedule's game and creates `ScheduleParticipant` + per-day NA `ParticipantDay` rows in one transaction.
- [X] T059.5 [US2] Notification payload includes `gm_display_name` resolved from `schedule.game.owner.display_name` (falling back to `email` if no display_name set). Update the contract reference in [contracts/rpc.md §ScheduleNotificationPayload](./contracts/rpc.md) reflects this; ensure T060 propagates the field. Add an assertion to T052 that the inserted `Notification` row's `payload` contains the resolved `gm_display_name`.
- [X] T060 [US2] Implement `GameNight.Schedules.System.fan_out_notification/3` in [lib/game_night/schedules/system.ex](lib/game_night/schedules/system.ex) — inserts one `Notification` per recipient (payload `{schedule_id, schedule_name, game_id, game_name, gm_display_name}`) and enqueues one Swoosh email; emits `:telemetry.span([:game_night, :schedules, :fan_out], ...)`.
- [X] T061 [P] [US2] Implement Swoosh sender [lib/game_night/schedules/senders/send_schedule_ready_email.ex](lib/game_night/schedules/senders/send_schedule_ready_email.ex) mirroring `SendInvitationEmail` shape. Subject template per [research.md §9](./research.md).
- [X] T062 [US2] Implement `GameNight.Schedules.System.add_late_joiner/2` in [lib/game_night/schedules/system.ex](lib/game_night/schedules/system.ex) — branches on schedule status; for `:ready_for_availability`, creates participant with `is_late_join: true` + NA days + fans out notification.
- [X] T063 [US2] Wire late-join hook: in [lib/game_night/games/player.ex](lib/game_night/games/player.ex) (or the existing `Invitation.accept` flow), add an `after_action` on player creation that finds non-posted schedules for the game and calls `GameNight.Schedules.System.add_late_joiner/2` for each. Add a test in [test/game_night/games/invitation_test.exs](test/game_night/games/invitation_test.exs) asserting acceptance during `:ready_for_availability` triggers the late-join.
- [X] T064 [US2] Add `Schedule.transition_to_ready_for_availability` to JSON:API + RPC blocks. Run codegen and commit.
- [X] T065 [US2] Implement [assets/js/features/schedules/components/transition-to-ready-button.tsx](assets/js/features/schedules/components/transition-to-ready-button.tsx) — soft-confirm dialog (`<Dialog>`); on confirm calls `useTransitionScheduleToReady`; toast on success; navigates back to detail.
- [X] T066 [US2] Add `useTransitionScheduleToReady` hook in [assets/js/features/schedules/hooks.ts](assets/js/features/schedules/hooks.ts); invalidate detail + list keys.
- [X] T067 [US2] Update [assets/js/routes/games.$gameId.schedules.$scheduleId.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.tsx) to enable the "Ready for Availability" action when status is `:preparing`. Update its test.
- [X] T068 [US2] Run full gate (precommit/credo/dialyzer/typecheck/lint/test/playwright). Confirm GREEN.

**Checkpoint**: US2 complete. Transitioning emits emails + bell notifications, late joiners get linked.

---

## Phase 5: User Story 3 — Player marks availability (Priority: P1)

**Goal**: A linked player visits `/characters/$id/schedules/$scheduleId`, sees the calendar (with GM-NA days locked), cycles their per-day status, and submits.

**Independent Test**: Per [spec.md US3 acceptance scenarios](./spec.md#user-story-3---player-marks-their-availability-priority-p1).

### Tests for US3 (RED first) ⚠️

- [X] T069 [P] [US3] Action test [test/game_night/schedules/participant_day_test.exs](test/game_night/schedules/participant_day_test.exs) for `:set_status` happy path; rejects when participant `np_only?: true`, when schedule status is not `:ready_for_availability`, when matching `ScheduleDay.gm_status == :NA`.
- [X] T070 [P] [US3] Cascade test in [test/game_night/schedules/schedule_day_test.exs](test/game_night/schedules/schedule_day_test.exs): GM flips a day to `:NA` while schedule is `:ready_for_availability`; every linked `ParticipantDay` for that day overwrites to NA in the same transaction. Asserts a player observing mid-cascade cannot see partial state.
- [X] T071 [P] [US3] Action test [test/game_night/schedules/schedule_participant_test.exs](test/game_night/schedules/schedule_participant_test.exs) for `:set_submission` setting `submitted_at` once (idempotent on second call). Add an explicit case where the participant calls `:set_submission` immediately after linkage with no prior `:set_status` calls — asserts the submission succeeds and counts toward `submission_count`, encoding FR-022 ("a submission with every day at NA is valid").
- [X] T072 [P] [US3] Policy test [test/game_night/schedules/participant_day_test.exs](test/game_night/schedules/participant_day_test.exs) — `:set_status` allowed for the participant's user, forbidden for the GM, forbidden for unrelated user, forbidden for anonymous.
- [X] T073 [P] [US3] Field-policy test [test/game_night/schedules/schedule_day_test.exs](test/game_night/schedules/schedule_day_test.exs) — non-GM read of `gm_status` returns `nil`; `gm_locked_na` returns the correct boolean.
- [X] T074 [P] [US3] JSON:API request test [test/game_night_web/controllers/participant_days_request_test.exs](test/game_night_web/controllers/participant_days_request_test.exs) covering PATCH `/api/json/participant_days/:id` for each rejection branch with the plain-language messages from [contracts/json-api.md](./contracts/json-api.md).
- [X] T075 [P] [US3] Vitest test [assets/js/features/schedules/components/month-calendar.test.tsx](assets/js/features/schedules/components/month-calendar.test.tsx) extension — `mode: "player-edit"` renders gm-locked-NA cells correctly and Set-Availability button appears at the right time.
- [X] T076 [P] [US3] Vitest test [assets/js/features/schedules/hooks.test.ts](assets/js/features/schedules/hooks.test.ts) extension covering `useGetScheduleForCharacter`, `useSetParticipantDay`, `useSetParticipantSubmission`.
- [X] T077 [US3] Playwright spec [assets/e2e/schedule-player-availability.spec.ts](assets/e2e/schedule-player-availability.spec.ts) covering [spec.md US3 acceptance scenarios 1–4](./spec.md#user-story-3---player-marks-their-availability-priority-p1). Verify RED.

### Implementation for US3

- [X] T078 [US3] Implement `ParticipantDay.set_status` update action in [lib/game_night/schedules/participant_day.ex](lib/game_night/schedules/participant_day.ex) with the three validations and the policy from [data-model.md](./data-model.md). Add `:list_for_participant` read.
- [X] T079 [US3] Implement `ScheduleParticipant.set_submission` update action in [lib/game_night/schedules/schedule_participant.ex](lib/game_night/schedules/schedule_participant.ex). Add `:list_for_schedule` read with the GM-or-self policy.
- [X] T080 [US3] Implement [lib/game_night/schedules/changes/cascade_gm_na.ex](lib/game_night/schedules/changes/cascade_gm_na.ex) — when `Schedule.set_gm_day` flips a `ScheduleDay.gm_status` to `:NA` while parent status is `:ready_for_availability`, calls `ParticipantDay.bulk_set_to_na/3` (system action) for the same `(schedule_id, day)` inside the same Ash transaction. Update T036's `set_gm_day` action to wire this change in.
- [X] T081 [US3] Implement `ParticipantDay.bulk_set_to_na` system action in [lib/game_night/schedules/participant_day.ex](lib/game_night/schedules/participant_day.ex) (bypassed via `_internal?: true` actor).
- [X] T082 [US3] Add field policy on `ScheduleDay.gm_status` and `:gm_locked_na` calculation in [lib/game_night/schedules/schedule_day.ex](lib/game_night/schedules/schedule_day.ex).
- [X] T083 [US3] Update `Schedule.get_for_player_character` and `Schedule.list_for_player_character` actions in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) with the participant filter and the `status != :preparing` filter. Add policies.
- [X] T084 [US3] Add the player-side actions to JSON:API + RPC blocks; run codegen.
- [X] T085 [US3] Add `useGetScheduleForCharacter`, `useSetParticipantDay` (optimistic), `useSetParticipantSubmission` hooks in [assets/js/features/schedules/hooks.ts](assets/js/features/schedules/hooks.ts).
- [X] T086 [US3] Add route [assets/js/routes/characters.$id.tsx](assets/js/routes/characters.$id.tsx) — per-character "View Game" page. Renders the same fields as the dashboard My Characters row plus a "Schedules" section listing `useListSchedulesForCharacter`. (Schedules list only; the inline current/upcoming widget arrives in US5.)
- [X] T087 [US3] Add route [assets/js/routes/characters.$id.schedules.$scheduleId.tsx](assets/js/routes/characters.$id.schedules.$scheduleId.tsx) — player's per-schedule view. `<MonthCalendar mode="player-edit">` wired to `useSetParticipantDay`; "Set Availability" button calls `useSetParticipantSubmission`; afterward the calendar switches to read-only with an "Edit" button (allowed only while schedule is `:ready_for_availability`).
- [X] T088 [US3] Add `useListSchedulesForCharacter` hook (filter to `status != :preparing`).
- [X] T089 [US3] Run full gate. Confirm GREEN.

**Checkpoint**: US3 complete. Players see and submit availability; GM-NA cascade is observable end-to-end.

---

## Phase 6: User Story 4 — Post the schedule via Scheduling View (Priority: P1)

**Goal**: GM opens Scheduling View; sees the day-matrix table with Final column pre-filled by truth-table rule; toggles Final values (NA/A only); clicks Post Schedule. Players are emailed + notified; submissions become read-only.

**Independent Test**: Per [spec.md US4 acceptance scenarios](./spec.md#user-story-4---gm-posts-the-final-schedule-via-the-scheduling-view-priority-p1).

### Tests for US4 (RED first) ⚠️

- [X] T090 [P] [US4] Calculation test [test/game_night/schedules/calculations/final_note_kind_test.exs](test/game_night/schedules/calculations/final_note_kind_test.exs) — drives ALL rows from [test/support/schedule_final_note_fixtures.exs](test/support/schedule_final_note_fixtures.exs) with one `test "row N: ..."` per row. Asserts `kind` and `label` (with IF names where applicable).
- [X] T091 [P] [US4] Vitest test [assets/js/features/schedules/final-note.test.ts](assets/js/features/schedules/final-note.test.ts) — drives ALL rows from [assets/js/features/schedules/__fixtures__/final-note-truth-table.json](assets/js/features/schedules/__fixtures__/final-note-truth-table.json). Server fixture and client fixture are byte-identical (asserted by a Vitest test that imports the JSON and a parsed copy of the .exs).
- [X] T092 [P] [US4] Action test [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:post`: pre-fills null `final_status` per truth-table rule; flips status to `:posted`; sets `posted_at`; fan-out emits one notification + one email per linked participant (excluding `np_only`). Subsequent player `:set_status` is rejected.
- [X] T093 [P] [US4] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:post` blank-Final-as-NA invariant — leave one day's final null, post, reload, assert `final_status: :NA`.
- [X] T094 [P] [US4] Vitest test [assets/js/features/schedules/components/day-matrix-table.test.tsx](assets/js/features/schedules/components/day-matrix-table.test.tsx) covering: render with sample schedule (5 participants × 28 days), Final cell click cycles NA↔A only, per-cell aria-label, Final Note color + icon + label, screen-reader-readable ("Maybe, talk to Anne"), `expectNoAxeViolations`.
- [X] T095 [P] [US4] Vitest test [assets/js/features/schedules/components/post-schedule-dialog.test.tsx](assets/js/features/schedules/components/post-schedule-dialog.test.tsx) covering soft-confirm, success/error.
- [X] T096 [P] [US4] JSON:API request test additions in [test/game_night_web/controllers/schedules_request_test.exs](test/game_night_web/controllers/schedules_request_test.exs) for the `:post` action.
- [X] T097 [US4] Playwright spec [assets/e2e/schedule-post.spec.ts](assets/e2e/schedule-post.spec.ts) covering the full posting flow + verifying player receives both email and bell notification + verifying player view becomes read-only. Verify RED.

### Implementation for US4

- [X] T098 [US4] Implement [lib/game_night/schedules/calculations/final_note_kind.ex](lib/game_night/schedules/calculations/final_note_kind.ex) — Ash calculation module. Loads `participant_days` filtered by `(schedule_id, day)`, excludes `np_only` participants, applies the truth-table rule. Returns a struct or tuple `{kind, if_player_names}` consumed by the `final_note_label` calc.
- [X] T099 [US4] Implement `final_note_label` calculation in [lib/game_night/schedules/schedule_day.ex](lib/game_night/schedules/schedule_day.ex) (composes the label string from the kind + IF names). Add both calcs to JSON:API/RPC.
- [X] T100 [US4] Implement [assets/js/features/schedules/final-note.ts](assets/js/features/schedules/final-note.ts) — pure TS function with the same contract as the Elixir calc. Drives off the shared truth table.
- [X] T101 [US4] Implement [lib/game_night/schedules/changes/compute_final_default.ex](lib/game_night/schedules/changes/compute_final_default.ex) — for every `ScheduleDay` of a schedule with null `final_status`, compute `final_note_kind` and set `final_status` to `:A` if `:good_day` else `:NA`.
- [X] T102 [US4] Implement `Schedule.post` update action in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex). Asserts current status `:ready_for_availability`. Wires `ComputeFinalDefault` → fan-out (`fan_out_notification(:schedule_posted)`) → set `status: :posted`, `posted_at: DateTime.utc_now()`. Add a sender [lib/game_night/schedules/senders/send_schedule_posted_email.ex](lib/game_night/schedules/senders/send_schedule_posted_email.ex).
- [X] T103 [US4] Add `Schedule.post` to JSON:API + RPC. Codegen.
- [X] T104 [US4] Implement [assets/js/features/schedules/components/day-matrix-table.tsx](assets/js/features/schedules/components/day-matrix-table.tsx) — native `<table>` with `<th scope="row">` per day and `<th scope="col">` per participant; Final cell `<button>` with explicit aria-label; Final Note cell renders the kind icon + label + `aria-describedby`. Driven by `useGetScheduleForGame` payload.
- [X] T105 [US4] Implement [assets/js/features/schedules/components/post-schedule-dialog.tsx](assets/js/features/schedules/components/post-schedule-dialog.tsx) — soft-confirm copy; on confirm calls `usePostSchedule`.
- [X] T106 [US4] Add `usePostSchedule` hook + a per-Final-cell `useUpdateScheduleFinalDay` mutation hook that wraps `updateScheduleFinalDays` with a single-element `finalDays` array. No optimistic update — server commit drives the Final Note color change. Hook is used in both `:ready_for_availability` (pre-post Scheduling View) and `:posted` (silent post-edit) modes.
- [X] T106.5 [US4] In [assets/js/routes/games.$gameId.schedules.$scheduleId.scheduling.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.scheduling.tsx), wire the `<DayMatrixTable>`'s Final cell `onChange` to `useUpdateScheduleFinalDay` (single-element wrapper around `useUpdateScheduleFinalDays` from T106). Add a Vitest assertion to [day-matrix-table.test.tsx](assets/js/features/schedules/components/day-matrix-table.test.tsx) covering the pre-post path (status `:ready_for_availability`).
- [X] T107 [US4] Add route [assets/js/routes/games.$gameId.schedules.$scheduleId.scheduling.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.scheduling.tsx) — Scheduling View. Renders `<DayMatrixTable>` and the Post button. Allowed only when status is `:ready_for_availability` (or `:posted`, for US7).
- [X] T108 [US4] Update [assets/js/routes/games.$gameId.schedules.$scheduleId.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.tsx) — enable the "Scheduling View" link when status is `:ready_for_availability` or `:posted`.
- [X] T109 [US4] Run full gate. Confirm GREEN.

**Checkpoint**: US4 complete. The full P1 lifecycle (initiate → ready → submit → post) works end-to-end. **MVP is shippable here.**

---

## Phase 7: User Story 5 — Player views posted schedules from dashboard (Priority: P2)

**Goal**: On `/characters/$id`, render current and upcoming posted schedules inline as compact `<MonthCalendar mode="read-only">`s; "View All" lands on a sorted full list.

**Independent Test**: Per [spec.md US5 acceptance scenarios](./spec.md#user-story-5---players-view-posted-schedules-from-the-dashboard-priority-p2).

### Tests for US5 (RED first) ⚠️

- [X] T110 [P] [US5] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:list_for_player_character` — only returns non-`:preparing` schedules; sort order future → past; correct filter when player has no participation in some game schedules.
- [X] T111 [P] [US5] Vitest test [assets/js/features/schedules/components/character-schedules-section.test.tsx](assets/js/features/schedules/components/character-schedules-section.test.tsx) — current month, upcoming month, View All link, empty state when none.
- [X] T112 [US5] Playwright extension within [assets/e2e/schedule-post.spec.ts](assets/e2e/schedule-post.spec.ts) covering the player-view assertion (no separate spec needed). Verify RED.

### Implementation for US5

- [X] T113 [US5] Implement [assets/js/features/schedules/components/character-schedules-section.tsx](assets/js/features/schedules/components/character-schedules-section.tsx) — splits posted schedules into `currentMonth`, `upcomingMonth`, `older`; renders the first two inline; renders "View All" link.
- [X] T114 [US5] Update [assets/js/routes/characters.$id.tsx](assets/js/routes/characters.$id.tsx) (from US3) to render `<CharacterSchedulesSection>` instead of the bare list.
- [X] T115 [US5] Add route [assets/js/routes/characters.$id.schedules.index.tsx](assets/js/routes/characters.$id.schedules.index.tsx) — full posted-schedules list, sorted future → current → past.
- [X] T116 [US5] Run full gate. Confirm GREEN.

**Checkpoint**: US5 complete.

---

## Phase 8: User Story 6 — GM tracks submissions and sends reminders (Priority: P2)

**Goal**: View Game schedule rows show `submitted/total`; the Schedule Detail page lists each linked player; non-submitted players have a Send Reminder button (no rate limit; email + in-app).

**Independent Test**: Per [spec.md US6 acceptance scenarios](./spec.md#user-story-6---gm-tracks-submissions-and-sends-reminders-priority-p2).

### Tests for US6 (RED first) ⚠️

- [X] T117 [P] [US6] Calculation test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `submission_count` and `participant_count` — excludes `np_only`, includes only `submitted_at not nil` for submission_count.
- [X] T118 [P] [US6] Action test [test/game_night/schedules/schedule_participant_test.exs](test/game_night/schedules/schedule_participant_test.exs) for `:send_reminder` — GM-only; rejected if participant already submitted; rejected if `np_only`; no rate limit (multiple successful calls). Asserts a notification + email per call.
- [X] T119 [P] [US6] Email-rendering test [test/game_night/schedules/senders/send_schedule_reminder_email_test.exs](test/game_night/schedules/senders/send_schedule_reminder_email_test.exs) asserting the rendered subject is `"Reminder: <gm_display_name> is waiting on your availability for <Month Year>"` — driven from the notification payload's `gm_display_name`, not a re-query of the schedule's owner.
- [X] T120 [P] [US6] Vitest test [assets/js/features/schedules/components/send-reminder-button.test.tsx](assets/js/features/schedules/components/send-reminder-button.test.tsx) — visible only for unsubmitted non-NP participants; success toast.
- [X] T121 [P] [US6] Vitest test [assets/js/features/schedules/components/schedules-table.test.tsx](assets/js/features/schedules/components/schedules-table.test.tsx) extension — submission count column renders `3/5` correctly. Verify RED.
- [X] T122 [US6] Playwright spec [assets/e2e/schedule-gm-tracking.spec.ts](assets/e2e/schedule-gm-tracking.spec.ts).

### Implementation for US6

- [X] T123 [US6] Implement `Schedule.submission_count` and `Schedule.participant_count` calculations in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex). Expose in JSON:API/RPC.
- [X] T124 [US6] Implement `ScheduleParticipant.send_reminder` action in [lib/game_night/schedules/schedule_participant.ex](lib/game_night/schedules/schedule_participant.ex) — calls `System.fan_out_notification(:schedule_reminder, [participant])`.
- [X] T125 [US6] Implement [lib/game_night/schedules/senders/send_schedule_reminder_email.ex](lib/game_night/schedules/senders/send_schedule_reminder_email.ex).
- [X] T126 [US6] Implement [assets/js/features/schedules/components/send-reminder-button.tsx](assets/js/features/schedules/components/send-reminder-button.tsx) and `useSendReminder` hook.
- [X] T127 [US6] Update [assets/js/features/schedules/components/schedules-table.tsx](assets/js/features/schedules/components/schedules-table.tsx) to render `submission_count`/`participant_count`.
- [X] T128 [US6] Update [assets/js/routes/games.$gameId.schedules.$scheduleId.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.tsx) to render the per-participant roster with `<SendReminderButton>` per non-submitted, non-NP participant.
- [X] T129 [US6] Run full gate. Confirm GREEN.

**Checkpoint**: US6 complete.

---

## Phase 9: User Story 7 — GM updates a posted schedule (Priority: P3)

**Goal**: After posting, GM can edit Final values; two save buttons (Update vs Update-and-Notify); player columns stay read-only.

**Independent Test**: Per [spec.md US7 acceptance scenarios](./spec.md#user-story-7---gm-updates-a-posted-schedule-priority-p3).

### Tests for US7 (RED first) ⚠️

- [X] T130 [P] [US7] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) for `:update_final_days` when status is `:posted` (silent — same shape as the pre-post path tested in US4) and `:update_final_days_and_notify` (allowed only in `:posted`; fans out `:schedule_updated`). Asserts player columns are not mutable from these actions and that `:update_final_days_and_notify` rejects when status is `:ready_for_availability`.
- [X] T131 [P] [US7] Email test [test/game_night/schedules/senders/send_schedule_updated_email_test.exs](test/game_night/schedules/senders/send_schedule_updated_email_test.exs).
- [X] T132 [P] [US7] Vitest test [assets/js/features/schedules/components/update-posted-schedule-buttons.test.tsx](assets/js/features/schedules/components/update-posted-schedule-buttons.test.tsx) — both buttons fire correct mutation; toast variants. Verify RED.

### Implementation for US7

- [X] T133 [US7] Implement `Schedule.update_final_days` (state in `[:ready_for_availability, :posted]`) and `Schedule.update_final_days_and_notify` (state == `:posted`) actions in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex). Expose both in JSON:API/RPC; codegen and commit.
- [X] T134 [US7] Implement [lib/game_night/schedules/senders/send_schedule_updated_email.ex](lib/game_night/schedules/senders/send_schedule_updated_email.ex).
- [X] T135 [US7] Implement [assets/js/features/schedules/components/update-posted-schedule-buttons.tsx](assets/js/features/schedules/components/update-posted-schedule-buttons.tsx) and `useUpdateScheduleFinalDays` (silent — also reused by the pre-post per-cell hook from T106) + `useUpdateScheduleFinalDaysAndNotify` (notify; allowed only in `:posted`) hooks.
- [X] T136 [US7] Update [assets/js/routes/games.$gameId.schedules.$scheduleId.scheduling.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.scheduling.tsx) — when status is `:posted`, swap Post button for the dual Update buttons.
- [X] T137 [US7] Run full gate. Confirm GREEN.

**Checkpoint**: US7 complete.

---

## Phase 10: User Story 8 — GM deletes a schedule (Priority: P3)

**Goal**: Type-`delete` confirmation dialog; cascades; allows re-initiating the same month afterward.

**Independent Test**: Per [spec.md US8 acceptance scenarios](./spec.md#user-story-8---gm-deletes-a-schedule-priority-p3).

### Tests for US8 (RED first) ⚠️

- [X] T138 [P] [US8] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) — `:delete` requires `confirmation: "delete"` (case-sensitive); other values rejected; cascade removes schedule_days, participants, participant_days, related notifications. Asserts no `Notification` rows are inserted by the delete action and `assert_no_email_sent/0` holds across the action call (encodes FR-045 negative space).
- [X] T139 [P] [US8] Vitest test [assets/js/features/schedules/components/delete-schedule-dialog.test.tsx](assets/js/features/schedules/components/delete-schedule-dialog.test.tsx) — confirm button stays disabled until input matches; case-sensitive. Verify RED.
- [ ] T140 [US8] Playwright spec [assets/e2e/schedule-delete.spec.ts](assets/e2e/schedule-delete.spec.ts).

### Implementation for US8

- [X] T141 [US8] Implement `Schedule.delete` destroy action in [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) with the typed-confirmation validation; cascade DDL is in place from foundational migrations; the action callback removes related `Notification` rows (polymorphic — not FK-cascaded).
- [X] T142 [US8] Expose `Schedule.delete` via JSON:API/RPC.
- [X] T143 [US8] Implement [assets/js/features/schedules/components/delete-schedule-dialog.tsx](assets/js/features/schedules/components/delete-schedule-dialog.tsx) — mirrors the feature-001 typed-confirmation pattern.
- [X] T144 [US8] Add `useDeleteSchedule` hook (invalidates list/detail keys; navigates back on success).
- [X] T145 [US8] Update [assets/js/routes/games.$gameId.schedules.$scheduleId.tsx](assets/js/routes/games.$gameId.schedules.$scheduleId.tsx) — wire the Delete button to the dialog.
- [X] T146 [US8] Run full gate. Confirm GREEN.

**Checkpoint**: US8 complete.

---

## Phase 11: User Story 9 — Late-joining player sees NP on posted schedules (Priority: P3)

**Goal**: A player who joins a game after a schedule is posted sees that schedule with every day grayed at status NP.

**Independent Test**: Per [spec.md US9 acceptance scenarios](./spec.md#user-story-9---players-who-joined-late-see-not-present-on-past-schedules-priority-p3).

### Tests for US9 (RED first) ⚠️

- [ ] T147 [P] [US9] System test [test/game_night/schedules/system_test.exs](test/game_night/schedules/system_test.exs) extension — `add_late_joiner/2` against a `:posted` schedule yields `np_only: true` participant with every `participant_day.status == :NP`; no notification fired.
- [ ] T148 [P] [US9] Action test [test/game_night/schedules/participant_day_test.exs](test/game_night/schedules/participant_day_test.exs) — `:set_status` rejected for `np_only` participants.
- [ ] T149 [P] [US9] Vitest test [assets/js/features/schedules/components/month-calendar.test.tsx](assets/js/features/schedules/components/month-calendar.test.tsx) extension — when every cell carries `status: "NP"`, calendar renders fully grayed and uninteractive. Verify RED.

### Implementation for US9

- [ ] T150 [US9] Implement [lib/game_night/schedules/changes/mark_days_np.ex](lib/game_night/schedules/changes/mark_days_np.ex) and `ParticipantDay.bulk_set_to_np` system action.
- [ ] T151 [US9] Update `GameNight.Schedules.System.add_late_joiner/2` (T062) to handle the `:posted` branch using `MarkDaysNp`. No notification fan-out.
- [ ] T151.5 [US9] Implement `GameNight.Schedules.System.handle_player_destroy/1` per the contract from [data-model.md §ScheduleParticipant Player-removal handling](./data-model.md): for each of the player's `ScheduleParticipant` rows, branch on `schedule.status` — destroy when `:preparing`/`:ready_for_availability`, otherwise update `np_only: true`, `submitted_at: nil` and call `bulk_set_to_np` for every day. Wired in T020.5; this completes the previously stubbed function. Verifies T020.6 GREEN.
- [ ] T152 [US9] Update [assets/js/features/schedules/components/month-calendar.tsx](assets/js/features/schedules/components/month-calendar.tsx) to render NP cells correctly (gray, no hover, `aria-disabled`, `aria-label="<date>, Not Present"`).
- [ ] T153 [US9] Run full gate. Confirm GREEN.

**Checkpoint**: US9 complete. All nine user stories shipped.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and cross-story improvements.

- [ ] T154 [P] Add Lighthouse CI budget entries for `/games/$gameId/schedules/$scheduleId` and `/characters/$id/schedules/$scheduleId`. Run a baseline pass and commit budget thresholds aligned with [plan.md §VI](./plan.md#vi-performance-discipline).
- [ ] T154.5 [P] Add a backend benchmark test [test/game_night/schedules/fan_out_perf_test.exs](test/game_night/schedules/fan_out_perf_test.exs) that creates a 10-player schedule, calls `Schedule.transition_to_ready_for_availability`, and asserts the wall-clock time from action start to last `Notification` row visibility is ≤ 60 s under the standard test runner (encodes SC-002 quantitatively). Tagged `:perf`; runs in CI's nightly slot, not on every PR.
- [ ] T155 [P] Add `size-limit` config entries for the four new route bundles (≤ 22 KB GM detail, ≤ 8 KB schedules list, ≤ 12 KB character view, ≤ 16 KB character schedule view).
- [ ] T156 [P] Run `@axe-core/playwright` against every new route. Resolve any severity ≥ serious; document any deferred lower-severity items in [specs/003-game-schedule/notes.md](specs/003-game-schedule/notes.md).
- [ ] T157 [P] Manual keyboard-only audit of `<MonthCalendar>` and `<DayMatrixTable>` per Constitution IV; record results in [specs/003-game-schedule/notes.md](specs/003-game-schedule/notes.md).
- [ ] T158 Manual screen-reader smoke test (NVDA on Windows or VoiceOver on macOS) on the GM Schedule Detail and Player Schedule views; record in notes.md.
- [ ] T159 [P] Add `mix sobelow --strict` exclusion review for the four new senders (HTML-injection clearance) and document.
- [ ] T160 Run the full [quickstart.md](./quickstart.md) walkthrough end-to-end on a clean dev DB; check off the smoke checklist.
- [ ] T161 [P] Extend the dev seed task [priv/repo/dev_seed.exs](priv/repo/dev_seed.exs) so re-running it produces a sample schedule per game (helpful for next feature spec work).
- [ ] T162 Confirm `mix ash.codegen --check` and `mix ash_typescript.codegen` + `git diff --exit-code` are clean. PR-ready.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1. Blocks all user stories.
- **US1 (Phase 3)**: Depends on Phase 2. No story dependencies. **🎯 MVP gate.**
- **US2 (Phase 4)**: Depends on US1 (the GM Schedule Detail page from US1 hosts the "Ready for Availability" button).
- **US3 (Phase 5)**: Depends on US2 (players are linked only once a schedule is `:ready_for_availability`).
- **US4 (Phase 6)**: Depends on US3 (the Scheduling View renders participant submissions). The full P1 lifecycle is shippable at this checkpoint.
- **US5 (Phase 7)**: Depends on US4 (posted schedules required).
- **US6 (Phase 8)**: Depends on US3 (submission tracking requires linked participants and submissions).
- **US7 (Phase 9)**: Depends on US4 (only posted schedules can be updated).
- **US8 (Phase 10)**: Depends on US1 only (deletion works in any state) — but realistically demoed after US4.
- **US9 (Phase 11)**: Depends on US4 (posted-schedule late-join is the case under test). Foundational `add_late_joiner` for the `:ready` case is delivered in US2.
- **Polish (Phase 12)**: Depends on US4 minimum; full polish requires all desired stories.

### Within Each User Story

- Tests written + verified RED before implementation (Constitution Principle I).
- Models/resources before services before endpoints before frontend.
- One commit per task or logical group; commit message references the task ID.

### Parallel Opportunities

- All `[P]` tasks within Setup can run in parallel.
- Within Foundational, T015 / T016 / T017 / T019 are `[P]`-eligible after T014 lands.
- Within each user story, all "Tests for US N" tasks marked `[P]` can run in parallel before any implementation begins.
- Models/changes that touch different files within a story can run in parallel; actions that mutate the same resource file (`schedule.ex`) must be sequential within a story.
- Stories US1 → US2 → US3 → US4 are a dependency chain; parallelisation within the P1 chain is limited. US5 and US6 can be developed in parallel after US4. US7, US8, US9 can each proceed in parallel after their dependencies (US4 / US1 / US4).

---

## Parallel Example: User Story 1 (tests phase)

```bash
# Launch all RED tests for US1 together; verify they all FAIL before any implementation:
Task: "Action test for Schedule.initiate happy + validation paths in test/game_night/schedules/schedule_test.exs"
Task: "Calculation test for Schedule.name in test/game_night/schedules/calculations/name_test.exs"
Task: "Action test for Schedule.set_gm_day cycle in test/game_night/schedules/schedule_test.exs"
Task: "Vitest test for <MonthCalendar> in assets/js/features/schedules/components/month-calendar.test.tsx"
Task: "Vitest test for <ScheduleStatusBadge> in assets/js/features/schedules/components/schedule-status-badge.test.tsx"
Task: "Vitest test for <InitiateScheduleDialog> in assets/js/features/schedules/components/initiate-schedule-dialog.test.tsx"
Task: "Vitest test for <SchedulesTable> in assets/js/features/schedules/components/schedules-table.test.tsx"
```

Within US1 implementation, the following are parallelizable after T033 lands:

```bash
Task: "Validation modules — timezone-known + month-not-in-past"
Task: "Schedule.name calculation module"
Task: "<MonthCalendar> component (longest single-task; start early)"
Task: "<ScheduleStatusBadge> component"
```

---

## Implementation Strategy

### MVP First (P1 lifecycle)

1. Complete Phase 1: Setup (T001–T006).
2. Complete Phase 2: Foundational (T007–T020). **Blocks everything.**
3. Complete Phase 3: US1 (T021–T050). 🎯 First demoable increment — GM can initiate.
4. Complete Phase 4: US2 (T051–T068). Schedule becomes player-visible.
5. Complete Phase 5: US3 (T069–T089). Players submit availability.
6. Complete Phase 6: US4 (T090–T109). GM posts. **MVP shippable here — the full lifecycle works.**
7. **STOP and validate**: Run [quickstart.md](./quickstart.md) US1–US4 end-to-end on staging.
8. Decide whether to ship MVP now or roll P2/P3 stories into the same release.

### Incremental Delivery

- After MVP, the P2 stories (US5, US6) are independent and can ship in either order.
- The P3 stories (US7, US8, US9) are smaller and can ship together as a "completeness pass."
- Each story keeps the lifecycle working — no story breaks an earlier one.

### Parallel Team Strategy

- **Backend pair**: progresses through US1 → US2 → US3 → US4 actions/policies/tests on the resource files.
- **Frontend pair**: in parallel with US1 backend, develops `<MonthCalendar>` (T041) — the highest-risk component — and the schemas/dialogs. Once US1 backend lands, wires it up.
- After US4 lands, two pairs can split: one on US5/US6 (P2), one on US7/US8/US9 (P3) plus polish.

---

## Summary

- **Total tasks**: 168 (162 original + 6 inserted via remediation: T020.5, T020.6, T059.5, T106.5, T151.5, T154.5).
- **By phase**:
  - Setup: 6 (T001–T006).
  - Foundational: 16 (T007–T020, T020.5, T020.6).
  - US1: 30 (T021–T050).
  - US2: 19 (T051–T068, plus T059.5).
  - US3: 21 (T069–T089).
  - US4: 21 (T090–T109, plus T106.5).
  - US5: 7 (T110–T116).
  - US6: 13 (T117–T129).
  - US7: 8 (T130–T137).
  - US8: 9 (T138–T146).
  - US9: 8 (T147–T153, plus T151.5).
  - Polish: 10 (T154–T162, plus T154.5).
- **Independent test criteria** are documented per story in their phase header and reference the matching [spec.md](./spec.md) acceptance scenarios.
- **Suggested MVP**: complete through Phase 6 (US4) — the schedule lifecycle is functional end-to-end.
- **Format validation**: every task above starts with `- [ ]`, has a `T###` ID (including the inserted `T###.5` sub-IDs), includes the `[P]` marker only when parallelizable, has a `[USx]` story label only inside user-story phases, and includes an exact file path.
