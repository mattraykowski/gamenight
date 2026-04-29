# Quickstart: Full Calendar

A 5-minute end-to-end walkthrough on a clean dev DB. Use this as the
manual smoke checklist for the Polish phase, and as the lens the
Phase-2 task generator should use when ordering work.

---

## Setup (one-time)

1. `mix ecto.reset && mix run priv/repo/seeds.exs` — clean DB.
2. Register two users via `/register`: one will be a **GM**, one a
   **player**.
3. Sign in as the GM. Register a game (`/games/new`).
4. Invite the second user to play (game detail → "Invite player").
5. Sign in as the player; accept the invitation.

(Everything above is feature-002 territory; included for context.)

---

## Walk the calendar

1. **As the GM**:
   - Initiate a schedule for the current month (game detail → "Initiate
     schedule"). Set day 5, day 12, and day 19 to `:A` (Available);
     leave the rest as default (NA).
   - Click "Ready for Availability". The player gets a notification
     + email.

2. **As the player**:
   - From `/dashboard`, open the character. Open the schedule.
   - Set day 5 to `:I`, day 12 to `:A`, day 19 to `:IF`. Click
     "Set Availability".

3. **As the GM**:
   - Open the schedule's Scheduling View. Toggle Final to `:A` for
     days 5 and 12; leave 19 as default. Click **Post Schedule**
     and confirm.

4. **As any user**:
   - Click **Calendar** in the navbar.
   - **Expected**: the current month grid renders. Day 5 shows one
     event pill labelled with the game title. Day 12 shows the same
     pill. Day 19 shows nothing (Final = NA).
   - Sign in as the GM and visit the same route — the pills look the
     same, but their **role icon differs** (GM icon vs player icon)
     and clicking lands on the GM Schedule Detail page rather than
     the player's character schedule view.

5. **Navigate forward / backward**:
   - Click the next-month chevron — grid advances; **Today** button
     appears.
   - Click prev-month twice — grid retreats two months; **Today**
     remains visible.
   - Click **Today** — grid snaps to current month; **Today** hides.

6. **Deep-link**:
   - Copy the URL while viewing some non-current month (e.g.
     `/calendar?year=2027&month=3`).
   - Open it in a fresh tab — same view loads, same Today button
     visible.

7. **Multi-event day** (optional):
   - Register a second game as the GM, schedule it on the same date
     as game 1's day 5, and post.
   - **Expected**: day 5 now shows two pills, each click goes to a
     different schedule.

8. **Overflow** (optional):
   - Schedule four games such that day 5 has four Final-A events.
   - **Expected**: day 5 shows three pills + a `+1 more` chip;
     clicking the chip opens a popover listing every event for that
     day, each with its own click target.

9. **Empty month**:
   - Navigate to a month no schedule covers (e.g. five years from
     now).
   - **Expected**: full grid, no pills, helper line "No game days
     planned this month" beneath.

10. **Anonymous gate**:
    - Sign out. Try `/calendar` directly.
    - **Expected**: redirect to `/sign-in?redirect=/calendar`. Sign in
      → land back on the calendar.

---

## Smoke checklist (tick during the Polish phase)

- [ ] Calendar nav entry visible only when authenticated.
- [ ] Default month = current month in the user's local browser zone.
- [ ] Forward / backward / Today navigation works in all four
      directions, including across year boundaries (Dec 2027 →
      Jan 2028 and back).
- [ ] Today button hidden / inactive on the current month.
- [ ] Each event pill displays role icon + game title; truncates
      gracefully on narrow cells.
- [ ] Click event → correct per-role schedule page (GM → GM Schedule
      Detail; player → Player Schedule View).
- [ ] +N more chip surfaces every overflowed event.
- [ ] Keyboard-only navigation: Tab into grid, Arrow keys move focus
      between days, Enter activates focused event pill, Tab reaches
      prev/next/today controls.
- [ ] Screen-reader: each pill announces date + game + role.
- [ ] Empty month shows the helper line, not a spinner.
- [ ] Refreshing on a non-current month preserves the URL params.
- [ ] Posting / updating / deleting a schedule from a feature-003
      surface invalidates the calendar's cache (no stale events).
- [ ] axe-core: zero serious / critical violations on `/calendar`.

---

## Out-of-scope (do NOT test in this feature)

- Week / day / agenda views (FR-018).
- Drag-to-reschedule / inline event editing.
- Cross-user calendars / team calendars.
- ICS / Google Calendar export.
