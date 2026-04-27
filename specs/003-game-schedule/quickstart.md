# Quickstart — Game Schedule

A focused walkthrough of the feature for a developer or reviewer who has cloned the branch and wants to drive each user story end-to-end. Assumes feature 002 has been run at least once locally so the dashboard's "My Characters" table is populated.

## 0. One-time prep

```bash
mix deps.get
mix ash.codegen --check        # should be clean before you start
mix ecto.migrate
mix test                       # baseline green
cd assets && bun install && cd ..
```

Run the dev stack:

```bash
mix phx.server                 # backend on http://localhost:4000
# in a second terminal:
cd assets && bun run dev       # SPA bundler
```

The SPA serves at `http://localhost:4000` (Phoenix forwards). The local mailbox is at `http://localhost:4000/dev/mailbox`.

## 1. Sign in as a GM and seed a game with players

Use the dev seed task (existing from feature 002):

```bash
mix run priv/repo/dev_seed.exs --gm gm@example.com --players p1@example.com,p2@example.com,p3@example.com
```

This produces:
- A user `gm@example.com` who owns one game `Wednesday Night Heroes`.
- Three accepted players (`p1`, `p2`, `p3`), each with one character.

Sign in as `gm@example.com` (the magic-link arrives in the mailbox) and you should see the game on the dashboard.

## 2. US1 — Initiate a schedule

1. Click into the game `Wednesday Night Heroes` from the dashboard.
2. The Schedules section is empty — click **Initiate Schedule**.
3. Fill the dialog:
   - Month: pick next month.
   - Year: current year.
   - Start time: `7:00 PM`.
   - End time: `11:00 PM`.
4. Submit. You're taken to the Schedule Detail page, status `Preparing`.
5. The calendar is a desktop-planner-style month grid: every day's cell is a button, every cell starts at NA (red dot indicator), the day number is in the top-left of each cell.
6. Click around — each click cycles `NA → I → A → IF → NA`. Use ← → ↑ ↓ to move focus; Enter cycles status; Tab moves out.
7. Try to initiate **another** schedule for the same month — confirmation message: `"There's already a schedule for <Month>. Delete it first to start over."`
8. Try to initiate a schedule for the previous month — `"You can only schedule the current month or later."`

**Tests covering this story**: `test/game_night/schedules/schedule_test.exs::"initiate"`, Vitest `month-calendar.test.tsx`, Playwright `schedule-initiate.spec.ts`.

## 3. US2 — Transition to Ready for Availability

1. From the same Schedule Detail page, click **Ready for Availability**.
2. Confirm the soft confirmation dialog.
3. The status pill flips to `Ready for Availability`. Three `ScheduleParticipant` rows are created (one per accepted player). The roster section shows them with "Not yet submitted."
4. Open the dev mailbox (`/dev/mailbox`) — three emails are queued, subject `"Wednesday Night Heroes schedule for <Month Year> is ready for your availability"`.
5. As any player, opening the SPA shows a new bell badge (count = 1). Clicking the bell shows the schedule notification.

**Tests**: `schedule_test.exs::"transition"`, `schedule_participant_test.exs::"link on transition"`, Playwright `schedule-ready-for-availability.spec.ts`.

## 4. US3 — Player marks availability

1. Sign out, sign in as `p1@example.com`.
2. From the dashboard's My Characters table, click into `p1`'s character. You land on `/characters/$id`.
3. The Schedules section shows the schedule. Click into it; you land on `/characters/$id/schedules/$scheduleId`.
4. The same desktop-planner-style calendar renders. Days the GM marked NA are visibly grayed and uninteractive (try to click — nothing happens). Other days start at NA. Click some days to cycle.
5. Click **Set Availability**. The view becomes read-only with an Edit button.
6. Click Edit; the calendar re-enables. Toggle a day; click Set Availability again.

**Tests**: `participant_day_test.exs::"set_status"`, Vitest `month-calendar.test.tsx::"locked NA cells"`, Playwright `schedule-player-availability.spec.ts`.

## 5. US4 — Post the schedule

1. Sign back in as the GM.
2. From the View Game schedules table, click View on the schedule. The detail page now shows submissions: `1/3` if only `p1` submitted; `3/3` if all did.
3. Click **Scheduling View**. The page renders the `<DayMatrixTable>` — one row per day, columns: Final | p1 | p2 | p3 | Final Note.
4. The Final column is pre-filled per the truth table:
   - "Good Day" rows pre-fill `A`.
   - All others pre-fill `NA`.
5. Adjust as desired. Each Final-toggle cycle flips between `NA` and `A` only.
6. Click **Post Schedule**. Soft confirm.
7. Schedule status flips to `Posted`. Three more emails arrive at `/dev/mailbox` ("schedule posted"). Player submission views become read-only with no Edit.

**Tests**: `schedule_test.exs::"post"`, `final_note_kind_test.exs` (one test per truth-table row), Vitest `day-matrix-table.test.tsx`, Playwright `schedule-post.spec.ts`.

## 6. US5 — Player views the posted schedule

1. As `p1`, open the dashboard. Click into the same character.
2. The Schedules section now shows the posted month inline (calendar with the GM's `final_status` on each day; no clicks).
3. If a posted schedule for the next month also exists, both render.
4. Click **View All** to see the full list at `/characters/$id/schedules` sorted future-then-past.

**Tests**: `schedule_test.exs::"list_for_player_character"`, Vitest `month-calendar.test.tsx::"read-only posted view"`.

## 7. US6 — GM tracks submissions and sends reminders

1. As the GM, return to a schedule that has at least one player who hasn't submitted.
2. The Schedule Detail page lists every linked player. For non-submitted players, a **Send Reminder** button is visible.
3. Click it. The player receives an email + an in-app notification immediately. No rate-limit — clicking again sends another.

**Tests**: `schedule_participant_test.exs::"send_reminder"`, Playwright `schedule-gm-tracking.spec.ts`.

## 8. US7 — Update a posted schedule

1. From a posted schedule's Scheduling View, change a Final value.
2. Two save buttons appear: **Update Schedule** (silent) and **Update and Notify** (sends "schedule updated" notifications).
3. Use Update and Notify; verify the notification arrives.

**Tests**: `schedule_test.exs::"update_final_days_and_notify"`, Vitest `update-posted-schedule-buttons.test.tsx`.

## 9. US8 — Delete a schedule

1. From the Schedule Detail page, click **Delete**.
2. The dialog requires you to type the literal word `delete`. Try other inputs — Confirm stays disabled.
3. Type `delete`, confirm. The schedule and all its dependent rows are gone.
4. Initiate again for the same month — now allowed.

**Tests**: `schedule_test.exs::"delete cascades"`, Playwright `schedule-delete.spec.ts`.

## 10. US9 — Late-joining player sees NP

1. As GM, post a schedule (steps 2–5 above).
2. Then invite a new player and have them accept (use the feature-002 flow). They become a `Player` of the game.
3. Sign in as the new player and open the posted schedule. Every day is grayed with status NP.
4. If you instead invite the player **before** posting, they see a fully interactive calendar (US2 retro-link path).

**Tests**: `schedule_participant_test.exs::"late join after posted yields np_only"`, Playwright `schedule-post.spec.ts` (covers this case in the same flow).

---

## Smoke checklist before you ship

- [ ] `mix precommit` clean (format + tests + warnings-as-errors).
- [ ] `mix credo --strict` clean.
- [ ] `mix dialyzer` clean.
- [ ] `mix ash.codegen --check` shows no drift.
- [ ] `mix ash_typescript.codegen && git diff --exit-code assets/js/ash_rpc.ts assets/js/ash_types.ts` shows no drift.
- [ ] `cd assets && bun run typecheck && bun run lint && bun run test` clean.
- [ ] `cd assets && bun run e2e` runs the schedule specs green.
- [ ] Lighthouse CI for `/games/$id`, `/games/$gameId/schedules/$scheduleId`, `/characters/$id/schedules/$scheduleId` passes the budgets.
- [ ] `axe-core` violations for each new route are zero at severity ≥ serious.
- [ ] Manual keyboard pass on the `<MonthCalendar>` and `<DayMatrixTable>` (per Principle IV).
- [ ] All four notification kinds render correctly in the bell and on `/notifications`.
- [ ] The typed-`delete` confirmation cannot be bypassed (server-side validation enforced; tested).
