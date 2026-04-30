# Phase 0 Research: Full Calendar

This file records the research findings that resolved the technical
unknowns flagged in `plan.md`'s Technical Context. Every section
follows the format: **Decision · Rationale · Alternatives considered**.

---

## §1. Calendar rendering — bespoke vs. library

**Decision**: Bespoke. Extract a `<CalendarGrid>` primitive from the
existing `<MonthCalendar>` and build a new `<EventCalendar>` on top.

**Rationale**:

1. The app already ships an accessible Sunday-first 7×N grid with
   roving tabindex, Arrow / Home / End / Enter navigation, route-change
   focus management, and an icon-paired status palette — every piece
   of work the spec calls for has already been done once. Pulling in
   a library would re-implement (and ship a second copy of) the same
   chrome.
2. Bundle size: extracting + extending stays at ≤ 8 KB gzipped for
   the new route. Pulling in FullCalendar adds ~80 KB gzipped just
   for what we'd use; that's ~10× the budget for one route.
3. Visual / a11y consistency: every other calendar surface in the
   app (`/games/:gameId/schedules/:scheduleId`,
   `/characters/:id/schedules/:scheduleId`) uses `<MonthCalendar>`
   with one specific palette and keyboard model. Mixing in a
   second calendar idiom would degrade the cross-surface mental
   model.
4. The transformation is small. Today `<MonthCalendar>` accepts
   `cells: DayCell[]` (one cell per day, one status per cell). The
   shared primitive accepts a render function `renderCell(date)` and
   the rest is the consumer's job. `<MonthCalendar>` keeps its
   current public API by passing the existing renderer; the new
   `<EventCalendar>` passes a different renderer that lays out
   event pills.

**Alternatives considered**:

- **shadcn's `Calendar` component (built on `react-day-picker`)** —
  it's a date *picker*, not an event calendar. Rendering N events
  per day requires customising `DayContent` with our own DOM
  anyway, so the library's value-add evaporates while we still pay
  the dependency cost.
- **FullCalendar** — industry standard for "events on a grid", but
  it has its own DOM model, ships its own CSS scope, and doesn't
  compose with shadcn / Radix idiomatically. Bundle ~80 KB
  gzipped. Would also force a second mental model into the app
  (different keyboard handling, different focus semantics) which
  conflicts with Constitution IV.
- **react-big-calendar / schedule-x / tui-calendar** — same
  trade-offs as FullCalendar, with smaller communities.

---

## §2. Per-cell event marker styling

**Decision**: Compact pill — role icon + truncated game title,
max 3 visible per cell, overflow collapses to `+N more` chip that
opens a popover listing every event for the day.

**Rationale**:

1. Information density. Pills with text give the user enough signal
   to identify each event at a glance, matching the Google Calendar
   / Outlook mental model people arrive with.
2. Color independence (Constitution IV). Each pill leads with a
   role icon: `🎲` (or a `Crown`-equivalent lucide icon) for GM /
   host events, `★` (or `Star` lucide icon) for player / attendee
   events. Locked here so T010 can assert the glyph in test, and so
   T016 doesn't ad-lib. If the design pass picks different glyphs,
   update both this section and T010 / T016 in the same commit.
3. Truncation behaviour: pill content is `text-overflow: ellipsis`
   on the title so a long game title doesn't blow up the cell.
4. Mobile: below the `sm` breakpoint, pills shrink to ~2 dot-with-icon
   chips per cell + `+N more`. Tapping the cell (not just the chip)
   opens the same overflow popover so the touch target is forgiving.

**Alternatives considered**:

- **Dot-only** (no text) — clean visually but forces tooltip / tap to
  identify each event. Slower scan; tooltip is hover-only (fails
  WCAG 2.5.7 / 2.5.8 on touch).
- **First-letter chip** — saves space but requires the user to
  remember which letter is which game. Doesn't scale past a couple
  of games whose titles share an initial.
- **Full-row event bars** spanning multiple days (à la Outlook) —
  not applicable here because every event is exactly one day.

---

## §3. URL state — query-string vs. in-memory

**Decision**: Query-string params. The visible month lives at
`/calendar?year=YYYY&month=MM`. Each prev / next / today click pushes
a history entry.

**Rationale**:

1. Refresh keeps the user on the same month — matches every other
   page in the app.
2. Deep-linkable: a user can paste `/calendar?year=2026&month=11`
   into a URL bar.
3. Browser back-button steps month-by-month, which matches users'
   "I clicked next twice; let me go back" mental model.
4. TanStack Router's search-param API gives us strong typing on the
   parsed values (Zod schema → `{ year: number; month: number }`).
5. Defensive defaulting: a missing or malformed param falls back to
   the current month silently — never throws.

**Alternatives considered**:

- **In-memory only** — simpler, but breaks refresh and deep-linking.
  A user navigating around the calendar then accidentally hitting
  Cmd-R loses their place.
- **Path-based** (`/calendar/2026/11`) — most "designed-looking" URLs
  but the file-based router prefers query params for view state, and
  path segments would conflict with future drill-in routes (e.g.
  `/calendar/:eventId`).

---

## §4. Data model — derived vs. persisted

**Decision**: Derived projection only. No new entities, no new
columns, no new migrations. Every "event" the calendar shows is
computed at read time from existing rows.

**Rationale**:

1. The spec's edge cases (deleted schedule, removed player,
   late-joiner) are all already handled by the source-of-truth
   tables — derivation inherits that correctness for free.
2. No write paths means no double-write reconciliation, no
   triggers, no eventual consistency.
3. Per-month bounded read keeps query cost trivial (~31 days × N
   posted schedules where N is small).

**Alternatives considered**:

- **Materialised `calendar_events` table** kept in sync via
  triggers / after_actions — overkill for the data volumes
  involved, doubles the surface area for bugs, and the source
  rows already give us the answer in one query.

---

## §5. Per-month query shape

**Decision**: One Ash read action on the existing `Schedule`
resource: `:list_calendar_event_days_for_month(year, month)`.
Returns a flat list of rows shaped per `CalendarEventDay`.

**Rationale**:

1. Single round trip; no N+1 risk.
2. Authorisation is a single policy on a single action — easy to
   reason about and test.
3. The query reads the schedules the user is connected to (GM via
   `game.owner_id == ^actor(:id)`, or non-`np_only` participant via
   `exists(participants, …)`) for the requested month, joins their
   `schedule_days` filtered to `final_status == :A`, and projects
   the row shape the SPA needs.
4. The action returns the projection directly — no calculations on
   the resource, no separate aggregate. The calendar surface is
   read-only, so flat rows are the right shape.

**Alternatives considered**:

- **Two actions** (list-as-GM + list-as-player), merge SPA-side —
  doubles the round trips and forces dedupe in the client for the
  edge case where a user is somehow both. Reject.
- **Live denormalised "calendar feed" SQL view** — premature, no
  perf data motivates it, harder to test than a plain action.

---

## §6. Loading / empty / error UX

**Decision**:

- **Loading**: render the grid chrome (heading, week-day headers,
  empty 7×N cells) immediately. Show a small "loading events…"
  helper line below the grid. Don't gate the whole page on the
  query — chrome should never flicker on prev / next click.
- **Empty**: grid renders fully + helper line "No game days planned
  this month."
- **Error**: rounded destructive alert above the grid: "We couldn't
  load events for this month. Please refresh." with a retry button
  that re-runs the query.

**Rationale**: matches the loading / empty / error pattern across
the rest of the app (Constitution V — UX for non-technical
operators) and keeps the navigation responsive even on a slow
network.

---

## §7. Test plan (TDD per Constitution I)

| Layer | Coverage | Tool |
| --- | --- | --- |
| Action | `Schedule.list_calendar_event_days_for_month` returns posted Final-A days for GM-owned games AND non-NP participant schedules; excludes `:preparing` and `:ready_for_availability`; excludes Final-NA days; excludes deleted schedules. | ExUnit |
| Policy | Anonymous → forbidden. Non-owner / non-participant → empty list (no leakage). NP-only participant → their schedule excluded. | ExUnit |
| JSON:API request | Round-trip via the RPC client returns the expected projection. | ExUnit (controller test) |
| Hook | `useListCalendarEventDays(year, month)` produces the right `queryKey`, `enabled` flag, and refetch behaviour. | Vitest |
| Component (`<CalendarGrid>`) | Renders the right number of cells, correct first-day-of-week, keyboard navigation works, no a11y violations. | Vitest + vitest-axe |
| Component (`<EventCalendar>`) | Renders ≤ 3 pills per day, overflow shows `+N more` chip, role-icon visible, click pill → router navigation, no a11y violations. | Vitest + vitest-axe |
| Route | Query-string round-trip (year/month parsing + defaulting), Today button hidden on current month, Today click resets to current month. | Vitest + Testing Library |

Each layer goes RED first per the Phase 1 / 2 / etc. cadence.

---

## §8. Performance budget

| Metric | Target | How we'll know |
| --- | --- | --- |
| First paint (calendar route) | ≤ 1 s on a cold cache (SC-001) | size-limit + Lighthouse CI (when wired) |
| Inter-month nav | ≤ 200 ms (SC-005) | Manual smoke test; React Profiler if regressions surface |
| Read-action p95 latency | ≤ 50 ms | Telemetry span on `:list_calendar_event_days_for_month` |
| Route bundle | ≤ 8 KB gzipped | `assets/.size-limit.cjs` (extends feature 003's pattern) |

If `<EventCalendar>` ends up exceeding 8 KB once it lands, lazy-load
`<DayEventsPopover>` so the popover code only enters the bundle when
the user opens an overflow.

---

## §9. Resolved unknowns summary

Everything from the plan's Technical Context is resolved here. No
`NEEDS CLARIFICATION` markers remain.
