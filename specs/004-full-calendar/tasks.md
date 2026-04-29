---

description: "Task list for feature 004 — Full Calendar"
---

# Tasks: Full Calendar

**Input**: Design documents from `/specs/004-full-calendar/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rpc.md](./contracts/rpc.md), [quickstart.md](./quickstart.md)

**Tests**: MANDATORY per Constitution Principle I (Test-First Development, NON-NEGOTIABLE). Each user story has its own RED-first test phase before implementation tasks may begin.

**Organization**: Grouped by user story so each story can be implemented, tested, and delivered as an independent MVP increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Setup, Foundational, and Polish phases have no story tag.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working tree is clean and ready for the feature.

- [ ] T001 Verify the branch `004-full-calendar` is checked out and the gate passes on `main` (`mix test`, `bun run typecheck`, `bun run lint`, `bunx vitest run js/features/schedules/`). No code changes — just sanity.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the shared `<CalendarGrid>` primitive that both the existing `<MonthCalendar>` and the new `<EventCalendar>` will consume.

**⚠️ CRITICAL**: No user-story phase may begin until the existing `<MonthCalendar>` tests still pass against the refactored consumer.

### Tests for the foundational extraction (RED first) ⚠️

- [ ] T002 [P] Vitest test [assets/js/components/calendar-grid.test.tsx](assets/js/components/calendar-grid.test.tsx) — for a given (year, month, mode), the grid renders 7 column headers (Sun-first), the right number of `gridcell` rows for the month (28 / 29 / 30 / 31), accepts a `renderCell(date)` render-prop, supports roving tabindex + Arrow/Home/End keyboard nav, has zero axe violations. Verify RED.

### Implementation of the foundational extraction

- [ ] T003 Implement [assets/js/components/calendar-grid.tsx](assets/js/components/calendar-grid.tsx) — generic Sunday-first 7×N grid with the keyboard / roving-tabindex / focus-management contract from the existing `<MonthCalendar>`. Accepts a `renderCell(date) => ReactNode` render-prop. No status palette, no event marker logic.
- [ ] T004 Refactor [assets/js/features/schedules/components/month-calendar.tsx](assets/js/features/schedules/components/month-calendar.tsx) to consume `<CalendarGrid>` while keeping its public props identical. Status-cell rendering moves into the `renderCell` callback. Existing `<MonthCalendar>` tests must continue to pass without modification.
- [ ] T005 Run the existing schedule vitest suite (`bunx vitest run js/features/schedules/`) and confirm GREEN. **Checkpoint** — Foundational extraction complete.

---

## Phase 3: User Story 1 — Lands on current month with events (Priority: P1) 🎯 MVP

**Goal**: Authenticated user clicks Calendar in the navbar, lands on the current month with events for every Final-A day on every posted schedule they're connected to. Click an event → correct per-role schedule page.

**Independent Test**: Per [spec.md US1 acceptance scenarios](./spec.md#user-story-1--player-or-gm-lands-on-the-current-month-calendar-priority-p1--mvp).

### Tests for US1 (RED first) ⚠️

- [ ] T006 [P] [US1] Action test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) — `:list_calendar_event_days_for_month(year, month)` returns one row per Final-A day for posted schedules where (a) the actor owns the parent game, OR (b) the actor has a non-`np_only` participant. Asserts: `:preparing` and `:ready_for_availability` schedules contribute zero rows; Final-NA days contribute zero rows; deleted schedules contribute zero rows; np_only late-joiners excluded; **game status (`paused` / `cancelled` / `completed`) does NOT filter the projection — events still surface (FR-019)**. Asserts row shape matches the projection in [data-model.md §1](./data-model.md). Verify RED.
- [ ] T007 [P] [US1] Policy test in [test/game_night/schedules/schedule_test.exs](test/game_night/schedules/schedule_test.exs) — anonymous actor → empty list (no leak); non-owner / non-participant actor → empty list; system actor bypass works for fixtures. Verify RED.
- [ ] T008 [P] [US1] JSON:API request test [test/game_night_web/controllers/schedules_calendar_request_test.exs](test/game_night_web/controllers/schedules_calendar_request_test.exs) — round-trip of the new RPC binding; verifies fields and authorization. Verify RED.
- [ ] T009 [P] [US1] Vitest test [assets/js/features/calendar/hooks.test.ts](assets/js/features/calendar/hooks.test.ts) — `useListCalendarEventDays(year, month)` produces the expected `queryKey` (`["schedules", "calendar", actorId, year, month]`), is `enabled` only when authenticated, and returns the projection rows. Verify RED.
- [ ] T010 [P] [US1] Vitest test [assets/js/features/calendar/components/event-calendar.test.tsx](assets/js/features/calendar/components/event-calendar.test.tsx) — given a list of `CalendarEventDay`s for a month, renders one pill per event on the matching cell (up to 3); each pill shows the role icon + truncated game title; click pill → calls the `onOpenEvent` callback with the right event. axe-clean. Verify RED.
- [ ] T011 [P] [US1] Vitest test [assets/js/routes/calendar.test.tsx](assets/js/routes/calendar.test.tsx) — anonymous user is redirected to `/sign-in?redirect=/calendar`; authenticated user with no events sees the empty-state helper line; authenticated user with events sees pills; `data-route-heading` is focused on mount. Verify RED.

### Implementation for US1

- [ ] T012 [US1] Implement `Schedule.list_calendar_event_days_for_month/2` action on [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex). Generic action returning `{:array, :map}` with the projection shape from [data-model.md §1](./data-model.md). Joins schedules → schedule_days → game; filters per [data-model.md §2](./data-model.md). Loads `game.title` and `game.owner_id` for projection. Use `format_time_slot/2` (per [data-model.md §3](./data-model.md)) to build `time_slot_label`. Sorted by `(date, game_title)`.
- [ ] T013 [US1] Add policy block on [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) for the new action: `authorize_if expr(game.owner_id == ^actor(:id))` + `authorize_if expr(exists(participants, player.user_id == ^actor(:id) and np_only == false))`. Anonymous → forbidden by absence of any matching clause.
- [ ] T014 [US1] Expose the new action via the JSON:API routes block on [lib/game_night/schedules/schedule.ex](lib/game_night/schedules/schedule.ex) and add `rpc_action :list_schedules_for_calendar_month, :list_calendar_event_days_for_month` in [lib/game_night/schedules.ex](lib/game_night/schedules.ex). Add a `[:game_night, :schedules, :list_calendar_event_days_for_month]` telemetry span on the action. Run `mix ash_typescript.codegen` and confirm `assets/js/ash_rpc.ts` updated cleanly.
- [ ] T015 [US1] Implement [assets/js/features/calendar/hooks.ts](assets/js/features/calendar/hooks.ts) — `useListCalendarEventDays(year, month)` with the queryKey + auth-gated enabled flag from T009. Export `calendarKeys.byMonth(actorId, year, month)`.
- [ ] T016 [US1] Implement [assets/js/features/calendar/components/event-calendar.tsx](assets/js/features/calendar/components/event-calendar.tsx) — wraps `<CalendarGrid>` with a `renderCell` that lays out up to 3 event pills (role icon + truncated game title). Pills are buttons that fire `onOpenEvent(event)`. `data-testid="event-calendar"`.
- [ ] T017 [US1] Add the `Calendar` link to the global navbar shell (`__root.tsx` or shared `<NavBar>` component) — placed between **Dashboard** and **All Games**, hidden for anonymous users. Mobile sheet entry too.
- [ ] T018 [US1] Implement [assets/js/routes/calendar.tsx](assets/js/routes/calendar.tsx) — TanStack Router file route at `/calendar`. `beforeLoad` redirects anonymous to `/sign-in?redirect=/calendar`. Reads `?year` / `?month` search params via `validateSearch` (Zod schema → `{ year: number; month: number }`); when missing or malformed, defaults to the current month in the user's local zone. Route component invokes `useListCalendarEventDays` and renders `<EventCalendar>`. Loading: subtle "Loading events…" line below the grid. Empty: "No game days planned this month." Error: destructive alert with retry. Click handler navigates per `event.targetRoute` with the right params.
- [ ] T019a [P] [US1] Vitest test in [assets/js/features/schedules/hooks.test.ts](assets/js/features/schedules/hooks.test.ts) (or a sibling test file) — for each of `useUpdateScheduleFinalDay`, `useUpdateScheduleFinalDaysBatch`, `useUpdateScheduleFinalDaysAndNotify`, `usePostSchedule`, `useDeleteSchedule`, assert that a successful mutation calls `invalidateQueries` with a queryKey shaped `["schedules", "calendar", ...]` so any cached calendar query is freshened. Verify RED.
- [ ] T019b [US1] Extend the five feature-003 mutation hooks in [assets/js/features/schedules/hooks.ts](assets/js/features/schedules/hooks.ts) so each `onSuccess` also invalidates `calendarKeys.byMonth(actorId)` (prefix match). Confirms T019a GREEN.
- [ ] T020 [US1] Run full gate: `mix test`, `bun run typecheck`, `bun run lint`, `bunx vitest run`. Confirm GREEN.

**Checkpoint**: US1 complete — MVP is shippable here. The user can navigate to `/calendar` for the current month, see their events, and click through to the right schedule page.

---

## Phase 4: User Story 2 — Navigate forward / backward / today (Priority: P1)

**Goal**: Prev / next month chevrons; **Today** button hidden on current month, visible otherwise; query-string round-trip on every navigation.

**Independent Test**: Per [spec.md US2 acceptance scenarios](./spec.md#user-story-2--navigate-forward-backward-and-back-to-today-priority-p1).

### Tests for US2 (RED first) ⚠️

- [ ] T021 [P] [US2] Vitest route test in [assets/js/routes/calendar.test.tsx](assets/js/routes/calendar.test.tsx) extension — clicking next-month chevron pushes a `?year=…&month=…` history entry with the next month; previous-month chevron does the inverse; **Today** is hidden on the current month and visible otherwise; clicking **Today** snaps back to the current month; year boundary (Dec → Jan and back) works. Verify RED.
- [ ] T022 [P] [US2] Vitest test in [assets/js/routes/calendar.test.tsx](assets/js/routes/calendar.test.tsx) extension — directly visiting `/calendar?year=2027&month=3` lands on March 2027 with **Today** visible; refreshing keeps the user on the same month. Verify RED.

### Implementation for US2

- [ ] T023 [US2] Add a `<CalendarHeader>` block to the route component in [assets/js/routes/calendar.tsx](assets/js/routes/calendar.tsx) — month-and-year heading, prev/next chevron buttons (with `aria-label`), and a **Today** button conditionally rendered when the visible month differs from the current month. Buttons mutate the URL via `navigate({ search })`, never local state — the URL is the source of truth.
- [ ] T024 [US2] Run `bunx vitest run js/routes/calendar.test.tsx` and confirm GREEN. **Checkpoint** — US2 complete.

---

## Phase 5: User Story 3 — Multiple events on the same day (Priority: P2)

**Goal**: When a day has more events than fit on the cell (default cap = 3), the cell renders the first 3 + a `+N more` chip; the chip opens a popover listing every event for that day, each independently clickable.

**Independent Test**: Per [spec.md US3 acceptance scenarios](./spec.md#user-story-3--multiple-events-on-the-same-day-priority-p2).

### Tests for US3 (RED first) ⚠️

- [ ] T025 [P] [US3] Vitest test in [assets/js/features/calendar/components/event-calendar.test.tsx](assets/js/features/calendar/components/event-calendar.test.tsx) extension — when a day has 4 events, the cell renders 3 pills + a `+1 more` chip; when it has 7 events, the chip reads `+4 more`. Verify RED.
- [ ] T026 [P] [US3] Vitest test [assets/js/features/calendar/components/day-events-popover.test.tsx](assets/js/features/calendar/components/day-events-popover.test.tsx) — given a date and N events, the popover lists every event with role icon + game title + time-slot label; clicking an event row fires `onOpenEvent` with the right one; popover is keyboard-dismissable; axe-clean. Verify RED.

### Implementation for US3

- [ ] T027 [P] [US3] Implement [assets/js/features/calendar/components/day-events-popover.tsx](assets/js/features/calendar/components/day-events-popover.tsx) — a Radix `Popover` listing every event for one date as a vertical list of buttons, each calling the parent's `onOpenEvent`. Header line: the formatted date.
- [ ] T028 [US3] Update [assets/js/features/calendar/components/event-calendar.tsx](assets/js/features/calendar/components/event-calendar.tsx) — when a cell has > 3 events, render only the first 3 + a `+N more` chip whose trigger opens the `<DayEventsPopover>` for that date. Below the `sm` breakpoint, scale pills down (or collapse to dot-mode) and surface the same overflow chip; tapping the cell itself also opens the popover for forgiveness on touch.
- [ ] T029 [US3] Run `bunx vitest run js/features/calendar/` and confirm GREEN. **Checkpoint** — US3 complete; all 9 functional requirements with non-deferred behavior shipped.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and post-merge prep aligned with feature 003's polish phase pattern.

- [ ] T030 [P] Add a `size-limit` entry for the `/calendar` route chunk in [assets/.size-limit.cjs](assets/.size-limit.cjs) — budget **8 KB gzipped**. Use the existing `maybeRouteChunkFile` guard so the budget pre-lands cleanly before a fresh `bun run build`.
- [ ] T031 [P] Add a route-level vitest-axe assertion in [assets/js/routes/calendar.test.tsx](assets/js/routes/calendar.test.tsx) — render the route with at least one event and assert (a) zero serious / critical axe violations and (b) **WCAG 2.5.8 (target size)**: every event pill, the prev/next chevron buttons, the Today button, and the `+N more` chip render with bounding boxes ≥ 24×24 CSS px (use `getBoundingClientRect()` against jsdom, or pin the relevant Tailwind class names — whichever is reliable in jsdom).
- [ ] T032 [P] Manual keyboard-only audit of `<EventCalendar>` per Constitution IV; record results in [specs/004-full-calendar/notes.md](specs/004-full-calendar/notes.md).
- [ ] T033 Manual screen-reader smoke test (NVDA on Windows or VoiceOver on macOS) on `/calendar`; record in `notes.md` — confirm each pill announces date + game + role.
- [ ] T034 Run the full [quickstart.md](./quickstart.md) smoke checklist on a clean dev DB.
- [ ] T035 Confirm `mix ash.codegen --check` is clean and `mix ash_typescript.codegen` + `git diff --exit-code` produces no diff. PR-ready.
- [ ] T036 Run the complete gate one last time: `mix test`, `bun run typecheck`, `bun run lint`, `bunx vitest run`, `bun run size-limit`. Confirm GREEN.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Phase 1. Blocks every user story (the `<CalendarGrid>` primitive is consumed by both the existing `<MonthCalendar>` after refactor and by the new `<EventCalendar>`).
- **US1 (Phase 3)**: depends on Phase 2. **🎯 MVP gate.** Independently shippable.
- **US2 (Phase 4)**: depends on US1 (uses the route + `<CalendarHeader>` introduced in T018 / T023).
- **US3 (Phase 5)**: depends on US1 (extends `<EventCalendar>`'s rendering); independent of US2.
- **Polish (Phase 6)**: depends on every preceding phase being GREEN.

### Suggested MVP scope

Phase 1 → Phase 2 → Phase 3 (US1 only). At that point the user can use the calendar productively for the current month — every other improvement is incremental.

### Parallel execution opportunities

Within US1 (Phase 3):

- T006, T007, T008, T009, T010, T011 are six [P] test files that can be drafted in parallel before any T012-onward implementation begins.

Within US3 (Phase 5):

- T025 and T026 are independent test files; T027 is independent of T028.

Within Polish (Phase 6):

- T030, T031, T032 are independent and can run in parallel.

---

## Implementation Strategy

1. **MVP first** — finish Phase 3 (US1) and ship. Defer US2 / US3 if needed; the calendar is useful for the current month even without navigation.
2. **Layer US2 next** — month navigation without the multi-event cap is still usable for the common case (one schedule per game, ≤ 3 games per user).
3. **Land US3 last** — the overflow pattern only matters when a user has > 3 overlapping schedules in a single day; uncommon but real.
4. **Polish in one pass** at the end, mirroring feature 003's Phase 12 cadence.

---

## Story / requirement coverage

| Story / FR | Covered by tasks |
| --- | --- |
| US1 (FR-001, FR-002, FR-006, FR-007, FR-008, FR-009, FR-010, FR-012, FR-014, FR-017, FR-019) | T002–T020 (16 tasks incl. T019a/T019b split) |
| US2 (FR-003, FR-004, FR-005, FR-013, FR-015, FR-016) | T021–T024 |
| US3 (FR-011) | T025–T029 |
| FR-018 (month-only) | satisfied by what we **don't** build (week / day / agenda) |
| Polish / SCs (SC-001, SC-004, SC-005) | T030–T036 |

Total tasks: **37** (across 6 phases).
