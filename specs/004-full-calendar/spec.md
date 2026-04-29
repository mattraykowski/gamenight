# Feature Specification: Full Calendar

**Feature Branch**: `004-full-calendar`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Full Calendar: As a user I want to be able to click Calendar on the top navigation when logged in and have it bring me to a calendar view. When I first arrive it should default to a monthly calendar of the current month with the ability to navigate forward, backward, and back to 'today' when I am not on the current month. Any days that I am either a GM for or have a Character for a schedule it should show an event. Clicking on the event should bring me to the correct schedule page."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Player or GM lands on the current month calendar (Priority: P1) 🎯 MVP

When an authenticated user clicks **Calendar** in the top navigation, they arrive on a month-grid view of the current month. Every day on which one of their schedules has an event is decorated with a clickable marker. Clicking the marker takes them to the correct schedule page (GM Schedule Detail when they're the GM; Player Schedule View when they're a player on that schedule).

**Why this priority**: This is the entire feature. Without it, the user cannot see "what's coming up" without drilling into each game / character one at a time. The Next Game callout already covers a single near-term game; this view gives a unified, scannable picture across **every** game the user is connected to.

**Independent Test**: A user with at least one posted schedule clicks Calendar, sees the current month with at least one event on the expected day, clicks the event, and lands on the right per-role schedule detail page.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no schedules of any kind, **When** they click Calendar, **Then** they see the current month grid with no events and a friendly empty-state line beneath the grid.
2. **Given** a signed-in user who is the GM of a game with a posted schedule for the current month, **When** they click Calendar, **Then** every game-day on that posted schedule renders an event labeled with the game's title; clicking the event navigates to that schedule's GM Schedule Detail page.
3. **Given** a signed-in user who plays a character on a different game's posted schedule for the current month, **When** they click Calendar, **Then** every game-day on that schedule renders an event labeled with the game's title; clicking it navigates to the Player Schedule View for the user's character on that schedule.
4. **Given** a signed-in user who is both the GM of game A and a player on game B and both have a posted schedule for the same month with overlapping game-days, **When** they view the calendar, **Then** each day with overlapping events shows both events stacked, each visually distinguishing the user's role on it.

---

### User Story 2 — Navigate forward, backward, and back to today (Priority: P1)

The calendar lets the user move between months one at a time. When they're on a non-current month, a **Today** control returns them to the current month in one click.

**Why this priority**: Forward/backward navigation is what makes a calendar useful beyond "the next few days". Without it, the calendar is no better than the Next Game callout it complements.

**Independent Test**: From the current month, click "next month" → grid advances one month and the heading updates. Click "previous month" twice → grid moves back two months and a **Today** control becomes visible. Click **Today** → grid snaps back to the current month and the **Today** control hides.

**Acceptance Scenarios**:

1. **Given** the user is on the current month, **When** they click "next month", **Then** the grid advances to the next month and the heading updates.
2. **Given** the user is on a month other than the current month, **When** they click **Today**, **Then** the grid snaps back to the current month.
3. **Given** the user is on the current month, **Then** the **Today** control is not visible (or is disabled / styled inactive).
4. **Given** the user navigates forward across a year boundary (e.g., from December to January), **Then** the year in the heading updates accordingly.

---

### User Story 3 — Multiple events on the same day (Priority: P2)

When more than one schedule has a game-day on the same calendar day, the user sees one event marker per schedule, each independently clickable.

**Why this priority**: Common in active groups (e.g., the user runs one campaign on Tuesdays and plays in another that also lands on the same date). Without this, one of the two events would be hidden.

**Independent Test**: Create two posted schedules whose game-days overlap on Day X. View the calendar for that month. The cell for Day X renders both events; clicking each navigates to its own schedule page.

**Acceptance Scenarios**:

1. **Given** two posted schedules with a shared game-day, **When** the user views that day, **Then** both events are visible without truncation up to a reasonable on-cell limit.
2. **Given** more events on a day than fit on the cell, **Then** the cell shows the first N and a `+M more` affordance whose interaction surfaces the rest. *(See Assumptions for default N.)*
3. **Given** a user is the GM on schedule A and a player on schedule B for the same day, **Then** each event is labeled to make the user's role clear at a glance.

---

### Edge Cases

- **Month with no events**: the grid renders fully but with no markers; a brief helper line (e.g., "No game days planned this month") appears beneath the grid.
- **Pre-feature-launch months**: if the user navigates to a month before any schedule existed, the grid renders empty.
- **Schedules in non-posted states**: by FR-007, `:preparing` and `:ready_for_availability` schedules contribute no calendar events. Their existence is surfaced on the dashboard / character / game pages and via notifications — not here.
- **Late-joiner / NP participants**: a player who joined a posted schedule late is `np_only` for that schedule and sees every day as Not Present. Their calendar view should **not** mark those days as events (they have no game on those days).
- **Removed character / removed player**: if a player is no longer seated on a game, their character no longer contributes events on that game's schedules from the day of removal forward. Past posted schedules continue to show because the participant row is preserved.
- **GM-deleted schedule**: deleting a schedule removes every event it contributed from the calendar immediately (the corresponding subject is gone).
- **Cross-month game-days**: schedules are bound to one calendar month already (feature 003 invariant), so an event never spans months.
- **Time-zone boundaries**: the calendar grid uses the user's local browser time zone; an event scheduled for late-night in a different zone could land on a different day for a viewer in a far-away zone. *See Assumptions.*

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An authenticated user MUST see a **Calendar** entry in the global top navigation that, when clicked, opens the calendar route.
- **FR-002**: The calendar route MUST default to a month-grid view of the **current month** in the user's local time zone.
- **FR-003**: The user MUST be able to navigate to the next month via a clearly labeled control (e.g., a `>` button labeled "Next month" for assistive tech).
- **FR-004**: The user MUST be able to navigate to the previous month via a clearly labeled control.
- **FR-005**: When the user is on a month other than the current month, a **Today** control MUST be visible and MUST snap the grid back to the current month when clicked. When the user is on the current month, the **Today** control MUST be hidden, disabled, or visually inactive.
- **FR-006**: For every day in the visible month that has one or more "event-days" the user is connected to, the calendar MUST render one event marker per such event-day on that day's cell.
- **FR-007**: An event-day is **a day on a `:posted` schedule whose `Final` status is `A`** ("game runs"). Schedules in `:preparing` or `:ready_for_availability` contribute **no** events to the calendar — they surface elsewhere (dashboard, character / game pages, notifications). Final-NA days on posted schedules also contribute no events (no game that day). Every event marker on the calendar therefore means "the game is on this day."
- **FR-008**: A user is "connected to" a schedule when (a) they own the parent game (GM role), or (b) they have at least one non-`np_only` `ScheduleParticipant` row on that schedule (player role).
- **FR-009**: Each event marker MUST display, at minimum, the game's title. Where space allows, the marker SHOULD additionally surface the schedule's time slot (e.g., `7-11p`) and a role indicator distinguishing GM events from player events.
- **FR-010**: Clicking (or activating via keyboard) an event marker MUST navigate the user to the appropriate per-role schedule page:
  - GM role → the GM Schedule Detail page for that schedule.
  - Player role → the Player Schedule View page for the user's character on that schedule.
  - Both roles on the same schedule (edge case): GM route wins. *(See Assumptions.)*
- **FR-011**: When a single day has more events than a reasonable on-cell limit, the cell MUST surface an overflow affordance (e.g., `+M more`) that exposes the remaining events without breaking layout. Default on-cell limit: **3 events**.
- **FR-012**: When the visible month has zero events, the grid MUST still render fully (empty days are valid) and the surface MUST include a brief, friendly helper line beneath the grid (e.g., "No game days planned this month"). It MUST NOT render an "error" or "missing data" message.
- **FR-013**: The calendar MUST be navigable by keyboard alone — Tab into the grid, Arrow keys to move focus between days, Enter / Space to activate the focused event marker, Tab to reach the navigation controls.
- **FR-014**: Status / role styling MUST NOT rely on color alone (Constitution Principle IV). Each event marker pairs an icon or short label with any color tint.
- **FR-015**: The calendar MUST handle navigation across year boundaries (December → January and back) without losing context.
- **FR-016**: Month navigation is **unbounded** — the user may move to any year, past or future. The previous-month and next-month controls are always enabled; the only month-scoped query loaded by the surface is the visible month, so there is no perf cost to deep history navigation.
- **FR-017**: An anonymous (signed-out) user MUST NOT see the Calendar nav entry. Direct navigation to the calendar route by an anonymous user MUST redirect to the sign-in page (with the calendar URL preserved as the post-sign-in redirect target), consistent with the rest of the app's auth gate.
- **FR-018**: v1 ships **month-view only**. Week / day / agenda view modes are explicitly out of scope and may be revisited in a later iteration. Reusing the existing `MonthCalendar` mental model keeps this surface consistent with the per-schedule calendars users already know.
- **FR-019**: A schedule's parent **game status (`active` / `paused` / `cancelled` / `completed`)** does NOT filter the calendar. Any posted schedule's Final-A days surface as events regardless of the game's current status — the calendar reflects the historical / committed truth of when sessions ran, not the live state of the campaign. (A "cancelled" campaign that ran two sessions before being cancelled still shows those two sessions on the calendar. A campaign that was scheduled but never ran any sessions yields no events because there are no Final-A days.)

### Key Entities

- **CalendarEventDay**: A derived (read-only) projection — for the visible month and the current user, "every (date, schedule, role) triple where this user has a game running that day". Computed from existing data; nothing new is persisted. Shape per row: `{ date, schedule_id, game_id, game_title, time_slot_label, role: :gm | :player, target_route, target_params }`.

---

## Success Criteria *(mandatory)*

- **SC-001**: A user with at least one posted schedule sees their next game-day on the Calendar within **1 second** of clicking the Calendar nav entry (cold cache, typical broadband).
- **SC-002**: 100% of event markers, when activated by mouse or keyboard, navigate to the correct per-role schedule page on the first attempt (zero misroutes across the test matrix).
- **SC-003**: Users can visually scan a month grid and identify their next game-day in **under 3 seconds** in user testing (qualitative — verified during the Polish phase manual review).
- **SC-004**: The calendar surface meets WCAG 2.2 AA — every interactive element has a visible focus ring, every event marker has an accessible name announcing date + game + role, and color is never the sole signal.
- **SC-005**: Past and future month navigation feels instant — within **200 ms** the new month renders for any month within the supported range.
- **SC-006**: Across a population of users with a mix of GM-only, player-only, and dual roles, **zero** events ever surface for schedules the user is not connected to (privacy / scoping correctness).

---

## Assumptions

- **Time zone**: the calendar grid is rendered in the **user's local browser time zone** (matching the dashboard / character views). A schedule whose time slot crosses midnight is owned by the day it **starts in** (consistent with the existing Schedule resource invariant).
- **Default on-cell event cap (FR-011)**: 3 events; more than 3 collapses behind a `+M more` affordance.
- **Both-roles tiebreaker (FR-010)**: a user who is somehow both the GM and a seated player on the same schedule has the click-target route to GM Schedule Detail. This is a true edge case (the registration flows do not currently allow it) but the spec defines the resolution explicitly.
- **No new persisted data**: events are derived on read from existing `Schedule`, `ScheduleDay`, and `ScheduleParticipant` rows. No new database tables or new write paths.
- **No event editing on the calendar**: this surface is **read + navigate only**. Setting GM availability, submitting player availability, posting, or deleting all stay on their existing per-schedule pages.
- **Visual styling**: follows the existing per-schedule `MonthCalendar` palette — status icon + tint + text label (Constitution Principle IV).
- **Empty months are not errors**: a fully empty grid is valid output (e.g., a brand-new user, or a user who scrolled into a far-future month before any schedule reaches it).
- **Late-joiner / NP participant filter**: the FR-008 "non-`np_only`" clause excludes participants who joined a posted schedule late and have every day flagged Not Present — they should not see events for days they were never around for.

---

## Dependencies

- Feature 003 (Game Schedule) provides every data source the calendar reads from. No work in this feature changes the schedule lifecycle, role model, or notification fan-out.
- The global navbar (`__root.tsx` shell) gains one new entry. No other navigation surfaces change.
