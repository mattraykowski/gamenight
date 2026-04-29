# Implementation Plan: Full Calendar

**Branch**: `004-full-calendar` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-full-calendar/spec.md`

---

## Summary

Add an authenticated **Calendar** route that renders a month-grid view of every "game on" day across every game the current user is connected to (as GM or seated player). Forward / backward / today navigation; one event marker per (date × schedule × role); click → per-role schedule page.

**Technical approach** (resolved via the grilling round):

- **No new calendar library.** Extract a generic `<CalendarGrid>` primitive from the existing `<MonthCalendar>` and build a new `<EventCalendar>` on top. Reuses Sunday-first layout, roving tabindex, Arrow / Home / End keyboard navigation, and the icon-paired status palette already shipped in feature 003.
- **One new Ash read action.** `Schedule.list_calendar_event_days_for_month(year, month)` returns the `CalendarEventDay` projection — one row per `:posted` Final-A day on a schedule the user is connected to. Computed from existing tables; no schema changes.
- **Query-string state.** Visible month is encoded as `/calendar?year=YYYY&month=MM` so refresh, deep-link, and the browser back-button all behave naturally.
- **Compact event pills** — role icon + truncated game title, up to 3 per cell, overflow collapses to a `+N more` popover.

This feature ships with **zero new persisted data**, **zero schema migrations**, and **zero new write paths**. It is a pure read-side projection over existing `Schedule`, `ScheduleDay`, `Game`, and `ScheduleParticipant` rows.

## Technical Context

**Language/Version**: Elixir 1.18 / Erlang/OTP 27; TypeScript 5.7
**Primary Dependencies**: Ash 3.x, ash_postgres, ash_json_api, ash_typescript on the backend; React 19, TanStack Router/Query, Tailwind v4, shadcn (Radix primitives) on the frontend. **No new runtime dependencies.**
**Storage**: Postgres (read-only access — no migrations).
**Testing**: ExUnit (backend action + policy + JSON:API request); Vitest + React Testing Library + vitest-axe (frontend component + hook + a11y); Playwright is in scope for an end-to-end smoke but not blocking the gate (matches the feature 003 posture).
**Target Platform**: Modern evergreen browsers; SPA — pure client-rendered.
**Project Type**: Web app (Phoenix backend + React/TanStack SPA), already established.
**Performance Goals**: SC-001 (≤ 1 s first paint with at least one event), SC-005 (≤ 200 ms inter-month nav). The per-month query reads at most ~31 schedule days × N posted schedules; query plan stays bounded.
**Constraints**: WCAG 2.2 AA (Constitution IV), color-blind-safe (icon + tint), keyboard-only navigable. Bundle delta budget: ≤ 8 KB gzipped for the route chunk (matches the GM schedules-list budget from feature 003 / T155).
**Scale/Scope**: One new route, one new Ash read action, one new RPC binding, one extracted primitive (`<CalendarGrid>`), one new SPA component (`<EventCalendar>`), one navbar link.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First Development (NON-NEGOTIABLE)** — **PASS**.
  - ExUnit: `Schedule.list_calendar_event_days_for_month/2` action test (happy + edge: NP-only filter, deleted schedule, non-posted excluded, Final-NA excluded); policy test (non-owner / non-participant sees nothing).
  - Vitest: `<CalendarGrid>` (extracted) + `<EventCalendar>` component tests; `useListCalendarEventDays` hook test (queryKey, invalidation).
  - vitest-axe: a11y assertions on the route component.
  - Route-level test: query-string round-trip (year/month parsing, today-button visibility).
  - Every test goes RED first per the existing speckit-implement gate.

- **II. Security & Authorization by Default (NON-NEGOTIABLE)** — **PASS**.
  - One new action on `GameNight.Schedules.Schedule`: `:list_calendar_event_days_for_month`. Policy: `authorize_if expr(game.owner_id == ^actor(:id))` OR `authorize_if expr(exists(participants, player.user_id == ^actor(:id) and np_only == false))`. Anonymous → forbidden. Late-joiner / np_only participants are excluded by the relationship filter.
  - No new write paths, no new secrets, no `Ecto.Repo` direct access.
  - No authentication flow changes.

- **III. API Contract via JSON:API (NON-NEGOTIABLE)** — **PASS**.
  - One new RPC binding `list_calendar_event_days_for_month`. JSON:API exposes the action with default fields covering the projection. `mix ash.codegen --check` and `mix ash_typescript.codegen` both required to be clean before merge.
  - Pure SPA: no SSR / RSC.

- **IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)** — **PASS**.
  - axe-core via vitest-axe in the route's component test.
  - Route-change focus management: focus moves to `<h1 data-route-heading>` on mount (already the project pattern).
  - WCAG 2.2 AA new criteria:
    - 2.4.11 (Focus Not Obscured): event pills focus inside the cell with a visible ring; the sticky navbar already accounts for this on every other route.
    - 2.5.7 (Dragging Movements): no drag interactions.
    - 2.5.8 (Target Size ≥ 24×24 CSS px): event pills sized at min 28 px tall; +N more chip and prev/next/today controls all ≥ 24 px.
  - Manual keyboard / screen-reader smoke before release (recorded in notes per feature 003 pattern).

- **V. UX for Non-Technical Operators** — **PASS**.
  - Loading state: subtle "loading events…" overlay, not a full-page spinner.
  - Empty state: grid renders fully + helper line "No game days planned this month" (FR-012).
  - Error state: rounded destructive alert with actionable copy.
  - No destructive actions on this surface.
  - Copy: plain-language ("Today", "No game days planned this month").

- **VI. Performance Discipline** — **PASS**.
  - Targets: SC-001 ≤ 1 s first paint, SC-005 ≤ 200 ms inter-month transitions.
  - Bundle: ≤ 8 KB gzipped route chunk; size-limit budget added per feature 003 / T155 pattern.
  - Telemetry: the read action emits a `[:game_night, :schedules, :list_calendar_event_days_for_month]` span; p95 ≤ 50 ms target.
  - **SC-001 measurement caveat**: direct LCP / first-paint capture is proxied by the bundle-size budget (≤ 8 KB gz route chunk + the existing initial-bundle cap). A direct Lighthouse CI run is deferred until cross-feature `lhci` infrastructure lands; if SC-001 ever regresses in user-perceived terms, raise it as an explicit Polish task.
  - **SC-005 measurement**: direct inter-month timing not automated; covered by the manual quickstart smoke (T034). If perceived perf regresses, add a React Profiler measurement task to Polish.

**Result**: All six principles PASS. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-full-calendar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (read-only projection)
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── rpc.md           # Phase 1 output (one new RPC binding)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code

**Backend** (one new action on an existing resource — no new resources, no migrations):

```text
lib/game_night/
├── schedules/
│   └── schedule.ex                 # add :list_calendar_event_days_for_month read action
└── schedules.ex                    # add rpc_action binding

test/game_night/schedules/
├── schedule_test.exs               # extend with :list_calendar_event_days_for_month coverage
└── (no other backend test files needed)
```

**Frontend** (one extracted primitive, one new component, one new hook, one new route):

```text
assets/js/
├── components/calendar-grid.tsx              # extracted Sunday-first 7×N grid primitive
├── components/calendar-grid.test.tsx
├── features/calendar/
│   ├── components/event-calendar.tsx         # new — renders events on the grid
│   ├── components/event-calendar.test.tsx
│   ├── components/day-events-popover.tsx     # +N more overflow popover
│   ├── components/day-events-popover.test.tsx
│   ├── hooks.ts                              # useListCalendarEventDays (TanStack Query)
│   └── hooks.test.ts
├── features/schedules/components/month-calendar.tsx   # refactor to consume <CalendarGrid>
└── routes/calendar.tsx                                # new route
```

The existing `<MonthCalendar>` is refactored to consume the extracted `<CalendarGrid>` primitive; its public props don't change. Tests on `<MonthCalendar>` continue to pass without modification.

---

## Phase 0 — Outline & Research

See [research.md](./research.md). Resolutions in summary:

- **R1 (calendar library)**: bespoke — extract `<CalendarGrid>`, build `<EventCalendar>` on top.
- **R2 (event marker styling)**: compact pill with role icon + truncated game title, max 3 / cell, overflow `+N more`.
- **R3 (URL state)**: query-string params `?year=YYYY&month=MM`.
- **R4 (data model)**: derived projection only — no new persisted entities.
- **R5 (per-month query shape)**: single Ash read action returning the projection.
- **R6 (mobile / overflow)**: same `+N more` chip, scaled-down pills below the `sm` breakpoint.

## Phase 1 — Design & Contracts

See [data-model.md](./data-model.md), [contracts/rpc.md](./contracts/rpc.md), and [quickstart.md](./quickstart.md).

**Re-evaluate Constitution Check** post-design:

| Principle | Status | Note |
| --- | --- | --- |
| I. TDD | PASS | Test plan in research.md §7 covers all five layers. |
| II. Security | PASS | New action's policy gates by ownership / non-NP participation. |
| III. JSON:API | PASS | One new RPC binding; codegen drift check enforced. |
| IV. Accessibility | PASS | `<CalendarGrid>` extraction inherits the existing component's a11y test coverage. |
| V. UX | PASS | Loading / empty / error states defined in spec + research §6. |
| VI. Performance | PASS | Bundle budget + per-action telemetry defined in §VI of this plan. |

No regressions; all six principles still PASS.

---

## Out of scope (explicit non-goals)

These are deliberately deferred:

- Week, day, and agenda views (FR-018 — month-only in v1).
- Drag-to-reschedule / inline event editing.
- ICS / Google Calendar feed export.
- Cross-user calendars or team calendars.
- Email digests built off the calendar.
- Recurring-event abstraction beyond the existing month-bound `Schedule` model.
- Adjacent-month prefetching for snappier nav (revisit if SC-005 fails in practice).

If the user later asks for any of these, they're separate features.
