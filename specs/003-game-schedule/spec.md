# Feature Specification: Game Schedule

**Feature Branch**: `003-game-schedule`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "Initiate Schedule: As a GM I want to be able to schedule games."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GM initiates a schedule and sets their own availability (Priority: P1)

A Game Master decides to plan their game for a given month. They pick the month, year, and a time slot (start and end time). The system creates a `preparing` schedule attached to the GM's game and shows them a calendar of every day in that month. Each day starts as **Not Available (NA)**. The GM clicks days to cycle through statuses — NA → Ideal (I) → Available (A) → Available If (IF) — recording when they personally could run the game.

**Why this priority**: This is the foundation of the whole feature. Without it, no schedule exists, no players can be invited to mark availability, and no posting can happen. It is also independently valuable: even before player-side flows ship, a GM can document their own availability for a month and delete/recreate it.

**Independent Test**: Sign in as a GM with at least one game, navigate to View Game, click "Initiate Schedule," choose a month/year/time slot, and verify a calendar appears with every day defaulting to NA and clicking a day cycles through the four statuses. The GM should be able to leave and return to the same calendar with their toggles persisted.

**Acceptance Scenarios**:

1. **Given** a GM is on the View Game screen for a game with no schedule for next month, **When** they click "Initiate Schedule" and choose next month / year / 7:00 PM – 11:00 PM, **Then** a new schedule is created in `preparing` status, named `<Month> <Year> 7:00 PM – 11:00 PM`, and a calendar of that month is shown with every day defaulting to NA.
2. **Given** a GM is viewing the calendar for a `preparing` schedule, **When** they click the same day four times, **Then** the day cycles NA → I → A → IF → NA.
3. **Given** a GM has already initiated a schedule for October 2026 (in any state), **When** they try to initiate another schedule for October 2026 on the same game, **Then** the action is blocked and they are told they must delete the existing October 2026 schedule first.
4. **Given** today is in May 2026 in the GM's local timezone, **When** they try to initiate a schedule for April 2026, **Then** the action is blocked because the month is in the past.
5. **Given** today is May 30, 2026 in the GM's local timezone, **When** they initiate a schedule for May 2026, **Then** it is allowed (the current month is always allowed).
6. **Given** a GM enters a time slot crossing midnight (e.g., 10:00 PM – 2:00 AM), **When** they save, **Then** the schedule is created and each calendar day represents the day the slot **starts in**.

---

### User Story 2 - GM transitions schedule to "Ready for Availability" (Priority: P1)

When the GM is satisfied with their own availability, they click **Ready for Availability**. The schedule's status moves from `preparing` to `ready_for_availability`. Every player currently in the game is linked to the schedule; each linked player receives an email **and** an in-app notification telling them a new schedule is ready for them. The schedule now appears on each player's per-character "View Game" page.

**Why this priority**: Without this transition, players never see the schedule. It is the bridge between GM-only setup and player participation, and it is the second-most critical workflow.

**Independent Test**: As a GM with a `preparing` schedule and at least one accepted player, click "Ready for Availability." Verify status flips, all current players are linked, each linked player has both an email queued and an in-app notification, and the schedule appears in the player's character "View Game" page.

**Acceptance Scenarios**:

1. **Given** a `preparing` schedule with three accepted players in the game, **When** the GM clicks "Ready for Availability," **Then** the schedule status becomes `ready_for_availability`, three player-schedule links are created, three emails are queued, and three in-app notifications are created.
2. **Given** a player joins the game **after** the schedule entered `ready_for_availability` (and before posting), **When** the player accepts the invite, **Then** they are linked to the open schedule and receive the same email + in-app notification.
3. **Given** a player is removed from the game while a schedule is `ready_for_availability`, **When** the GM looks at the schedule, **Then** the removed player no longer appears in the submission count or the Scheduling View columns, and any availability they previously submitted for that schedule is removed along with their link.

---

### User Story 3 - Player marks their availability (Priority: P1)

A player sees on their dashboard's "My Characters" table that one of their characters has a schedule waiting. They click into that character's per-game "View Game" page (a new screen that shows the same fields as their dashboard row plus the game's schedules). They open the schedule and see the same month calendar the GM saw, but **days the GM marked NA are grayed out and uninteractive**. Every available day starts at NA for the player. The player toggles statuses (NA → I → A → IF → NA) on the days they want to change, then clicks **Set Availability**. The schedule view becomes read-only until the player clicks **Edit**.

**Why this priority**: Player participation is the whole point of the schedule once initiated. Without this, the GM cannot make a final decision based on real input.

**Independent Test**: As a player whose character is in a game with a `ready_for_availability` schedule, navigate from the dashboard My Characters row → character View Game → schedule. Confirm GM-NA days are grayed, click some available days to cycle statuses, click Set Availability, and confirm the view becomes read-only with an Edit button that returns to editable mode.

**Acceptance Scenarios**:

1. **Given** a player is viewing a `ready_for_availability` schedule and the GM marked October 5 as NA, **When** the player views October 5, **Then** the day is visibly grayed and clicking it does nothing.
2. **Given** a player has every day at the default NA, **When** they click "Set Availability," **Then** the submission is accepted (a fully-NA submission is valid and means "I am unavailable that month") and the player is counted as a submitter.
3. **Given** a player has clicked "Set Availability," **When** they reload the page, **Then** they see a read-only view of their submission with an "Edit" button, and clicking Edit returns to an editable calendar.
4. **Given** the GM toggles October 5 from "A" to "NA" while the schedule is `ready_for_availability`, **When** any linked player views the schedule next, **Then** October 5 is grayed for them and any non-NA value they had on October 5 has been overwritten to NA.

---

### User Story 4 - GM posts the final schedule via the Scheduling View (Priority: P1)

Once the GM is ready, they open **Scheduling View** for the schedule. Each row is a day of the month and the columns are: **Final**, one column per player (read-only, showing their submission), and a **Final Note** column that the system computes per day. The Final column toggles only between **NA** and **A** (a smaller set than the input statuses). It is pre-filled per row using the same rule as the Final Note: days computed as "Good Day" pre-fill `A`, all other days pre-fill `NA`. The GM adjusts as desired, then clicks **Post Schedule**. The schedule status becomes `posted`. Every linked player receives an email and an in-app notification. Players' submission views become permanently read-only (no further Edit). Each player's character "View Game" page now shows the posted days.

**Why this priority**: Posting is the payoff — the moment the schedule becomes a committed plan players act on. Without this, no game session ever gets confirmed.

**Independent Test**: With a `ready_for_availability` schedule that has at least one player submission, the GM opens Scheduling View, confirms Final values are pre-populated by rule, toggles a few, clicks Post Schedule, and verifies status is `posted`, players received both notification channels, and the player view shows the posted days.

**Acceptance Scenarios**:

1. **Given** a schedule day where every linked player and the GM are I or A, **When** the Scheduling View renders, **Then** the Final Note for that day shows **"Good Day"** with a green background and the Final column is pre-filled `A`.
2. **Given** a schedule day where exactly one out of five players is NA or IF and no player is IF, **When** the Scheduling View renders, **Then** the Final Note shows **"Maybe"** with a yellow background and Final pre-fills `NA`.
3. **Given** a schedule day where one or more players are IF, **When** the Scheduling View renders, **Then** the Final Note shows **"Maybe, talk to <Player Name>"** (listing each IF player's name) with a yellow background.
4. **Given** a schedule day where more than one-fifth of linked players are NA or IF, **When** the Scheduling View renders, **Then** the Final Note shows **"Bad Day"** with a red background and Final pre-fills `NA`.
5. **Given** a Scheduling View where the GM left some Final values blank, **When** they click "Post Schedule," **Then** any blank Final value is treated as `NA` on post, the schedule status becomes `posted`, and every linked player receives both an email and an in-app notification.
6. **Given** a `posted` schedule, **When** a linked player reopens their submission, **Then** they see read-only data with no Edit button.

---

### User Story 5 - Players view posted schedules from the dashboard (Priority: P2)

After posting, each player can see the days the GM committed to. From the dashboard's My Characters table, each character row links to a per-character "View Game" page. The schedule section on that page shows the **current month** schedule (the calendar month containing today) and the **upcoming month** schedule, if posted. A "View All" link leads to a full list of posted schedules sorted future-then-past (future schedules first, then current, then past).

**Why this priority**: Players need a reliable surface to find committed dates. Important, but the system is functionally usable once Stories 1–4 ship — players could still receive the posted-schedule email.

**Independent Test**: As a player on the dashboard, click any character row → View Game → confirm the page shows the current month and any upcoming-month posted schedule. Click "View All" and confirm the full list ordering.

**Acceptance Scenarios**:

1. **Given** a player has one character in a game with a posted schedule for the current month and one for next month, **When** they open that character's View Game page, **Then** both schedules are shown.
2. **Given** a player has a character in a game with a schedule that was posted yesterday but is for *last* month, **When** they open the character's View Game page, **Then** that past schedule does **not** appear in the current/upcoming widget. It is reachable only via "View All."
3. **Given** a player opens "View All Posted Schedules" for a character, **When** the list renders, **Then** future-month schedules appear first (newest future first), then the current month, then past months (most recent first).

---

### User Story 6 - GM tracks submissions and sends reminders (Priority: P2)

On the View Game screen the GM sees a table listing the game's schedules. Each row shows: name (derived from month, year, time slot), status, submission count in the form `submitted/total` (e.g., `3/5`), and an actions column with a **View** button. The list is sorted by scheduled month/year descending; only the top 6 schedules are shown by default, with "View All Schedules" linking to the full list. The View button opens a Schedule Detail page that shows the GM's calendar at the top, each player's submission below, and — for any linked player who has not yet submitted — a **Send Reminder** button that sends both an email and an in-app notification.

**Why this priority**: Useful for keeping schedules moving, but the GM can already manage the workflow via the Ready/Post buttons; reminders are an accelerator.

**Independent Test**: With a schedule in `ready_for_availability` and a mix of submitted/not-submitted players, the GM opens the View Game schedule table, clicks View on the schedule, sees per-player submission status, and clicks "Send Reminder" for one outstanding player. Verify the email and the in-app notification are both delivered.

**Acceptance Scenarios**:

1. **Given** a game with eight schedules across various months, **When** the GM views the View Game screen, **Then** the schedule table shows the six schedules with the most recent scheduled month/year first and a "View All Schedules" link.
2. **Given** a `ready_for_availability` schedule with five linked players and three submissions so far, **When** the GM views the schedule row, **Then** the count column reads `3/5`.
3. **Given** a schedule where two players have not submitted, **When** the GM clicks "Send Reminder" on one of them, **Then** that player receives both an email and an in-app notification immediately, and the GM may click again any number of times (no rate-limit in v1).

---

### User Story 7 - GM updates a posted schedule (Priority: P3)

After posting, the GM may need to adjust the Final column (e.g., a planned game day falls through). They reopen the Scheduling View and toggle Final values. Two save buttons are offered: **Update Schedule** (silent) and **Update and Notify** (saves and sends every linked player both an email and an in-app notification informing them the schedule has changed). Player submissions remain read-only throughout.

**Why this priority**: Real-life plans change, but this is rare relative to the initial flow and most updates can be handled by the GM messaging the group out-of-band in v1 if needed.

**Independent Test**: Open a posted schedule's Scheduling View, change a Final value, click "Update and Notify," and verify each linked player receives both channels of notification. Repeat with "Update Schedule" and verify no notification is sent.

**Acceptance Scenarios**:

1. **Given** a posted schedule, **When** the GM opens Scheduling View, **Then** the Final column is editable (NA/A toggle) but every player column remains read-only.
2. **Given** the GM has edited Final values, **When** they click "Update and Notify," **Then** changes persist and each linked player gets a "schedule updated" email and in-app notification.
3. **Given** the GM has edited Final values, **When** they click "Update Schedule," **Then** changes persist and no notifications are sent.

---

### User Story 8 - GM deletes a schedule (Priority: P3)

A GM may delete any schedule regardless of status. The action requires a confirmation dialog where the GM must type `delete` to proceed. Confirmation cascades: the schedule, all per-day GM availability, all linked-player records, all player submissions, and all derived data are removed. After deletion, the GM is free to initiate a new schedule for that month.

**Why this priority**: Needed for the "must delete first to re-initiate" rule and for cleaning up mistakes, but uncommon.

**Independent Test**: Initiate a schedule in any state, click Delete, type `delete` into the confirmation, confirm. Verify the schedule and all dependent data are gone and that a new schedule can be initiated for the same month.

**Acceptance Scenarios**:

1. **Given** a `posted` schedule with five player submissions, **When** the GM types `delete` and confirms, **Then** the schedule and all five submissions are removed.
2. **Given** the GM clicks Delete and types something other than `delete`, **When** they try to confirm, **Then** the action remains disabled.
3. **Given** a GM just deleted October 2026's schedule, **When** they click "Initiate Schedule" for October 2026 again, **Then** it is allowed.

---

### User Story 9 - Players who joined late see "Not Present" on past schedules (Priority: P3)

A player who joins a game after a schedule was already posted should still be able to see that schedule from their character's View Game page, but the calendar should make clear they were not part of that decision. Days are shown grayed with status **Not Present (NP)** for that player.

**Why this priority**: Edge-case but important for consistency: once a player is in a game, all of that game's schedules are reachable from their character's view; the NP status preserves historical truth without pretending the player participated.

**Independent Test**: Post a schedule for October 2026, add a new player to the game in November, open the new player's character View Game page, and confirm the October 2026 posted schedule is visible with every day marked NP and grayed.

**Acceptance Scenarios**:

1. **Given** a `posted` schedule for October 2026 and a player who joined the game in November 2026, **When** the player opens that schedule, **Then** every day is visibly grayed with status NP.
2. **Given** the same player views a schedule that was still `ready_for_availability` when they joined, **When** they open it, **Then** the calendar is fully interactive (they are linked normally) — NP applies only to schedules already posted at the time they joined.

---

### Edge Cases

- **GM toggles their own NA mid-flow.** When the GM marks a day NA after `ready_for_availability`, that day is locked NA for every player (including any past non-NA value the player had submitted, which is overwritten to NA).
- **All-NA player submission.** Counts as a valid, complete submission.
- **Removed player.** When a player is removed from a game, their link to any non-posted schedule and their submitted availability for those schedules are deleted. The submission count denominator decreases accordingly.
- **Late joiner on an in-progress schedule.** Linked retroactively to any non-posted schedule and emailed/notified just like an original member.
- **Late joiner on an already-posted schedule.** Linked but with all days as NP (read-only, grayed).
- **Time slot crossing midnight.** Each day's availability applies to the day the slot **starts in**.
- **Current month, late in the month.** A schedule for the current month is always allowed even if only one day remains.
- **Past-month check at month boundaries.** "Past" is judged using the GM's local timezone (the timezone stored on the schedule at initiation).
- **Deleting a posted schedule that already drove real-world plans.** Allowed, gated only by the typed-`delete` confirmation. No automatic notification on delete in v1.
- **Reminder spam.** No rate-limiting in v1; clicking Send Reminder multiple times sends multiple notifications.
- **Concurrent edits.** Last-write-wins on Final values. Players cannot edit their own submission once the schedule is `posted`.

## Requirements *(mandatory)*

### Functional Requirements

#### Initiating a schedule

- **FR-001**: A GM MUST be able to initiate a new schedule on any game they own, choosing a month, year, start time, and end time.
- **FR-002**: The system MUST reject schedule initiation for any month/year that already has a schedule on the same game in any status; the GM MUST be told to delete the existing schedule first.
- **FR-003**: The system MUST reject schedule initiation for any month strictly earlier than the current month, judged in the GM's local timezone. The current month MUST be allowed regardless of how few days remain.
- **FR-004**: The system MUST persist the GM's local timezone on the schedule at initiation, so times can later be localized for players.
- **FR-005**: A schedule's display name MUST be derived from its month, year, and time slot (e.g., `October 2026 7:00 PM – 11:00 PM`).
- **FR-006**: A schedule MUST start in status `preparing` upon initiation.
- **FR-007**: The system MUST allow time slots that cross midnight; the day a slot "belongs to" MUST be the calendar day the slot **starts in**.

#### GM availability calendar

- **FR-008**: The system MUST present a calendar of every day in the schedule's month for the GM, with each day defaulting to **NA**.
- **FR-009**: Clicking a day MUST cycle the GM's status for that day in the order **NA → I → A → IF → NA**.
- **FR-010**: GM availability changes MUST persist immediately and remain editable while the schedule is in `preparing` or `ready_for_availability`.
- **FR-011**: When the GM changes a day to **NA** after the schedule has reached `ready_for_availability`, the system MUST overwrite every linked player's status for that day to **NA** as well.

#### Status transitions and player linkage

- **FR-012**: A GM MUST be able to transition a schedule from `preparing` to `ready_for_availability` via a "Ready for Availability" action.
- **FR-013**: On entering `ready_for_availability`, the system MUST link every player currently in the game to the schedule.
- **FR-014**: On entering `ready_for_availability` (and on each subsequent late-join linkage), the system MUST send each newly linked player both an email and an in-app notification announcing the schedule is ready for their availability.
- **FR-015**: When a player joins the game while a schedule is `ready_for_availability`, the system MUST link them to that schedule and notify them as in FR-014.
- **FR-016**: When a player joins the game while a schedule is already `posted`, the system MUST link them to that schedule with **every** day's player status set to **Not Present (NP)** and the calendar rendered as read-only/grayed.
- **FR-017**: When a player is removed from the game, the system MUST remove their link and any submitted availability for non-posted schedules, and decrement the submission denominator accordingly.

#### Player availability submission

- **FR-018**: Every linked player MUST be able to view a per-character "View Game" page for the game, reachable from the dashboard's My Characters table, showing the same fields as the dashboard row plus the game's schedules.
- **FR-019**: A linked player MUST see the schedule's calendar with every day defaulting to **NA**, except days the GM marked **NA**, which MUST be visibly grayed and uninteractive (locked at NA).
- **FR-020**: Clicking an interactive day MUST cycle the player's status in the order **NA → I → A → IF → NA**.
- **FR-021**: A "Set Availability" action MUST persist the player's submission, mark them as a submitter, and switch the page to a read-only view.
- **FR-022**: A submission with every day at **NA** MUST be a valid, complete submission.
- **FR-023**: A read-only submission MUST offer an "Edit" action that returns the page to the editable calendar — only while the schedule is **not** `posted`.
- **FR-024**: When a schedule is `posted`, player submissions MUST become permanently read-only (no Edit).

#### Scheduling View, Final column, and Final Note rule

- **FR-025**: The GM MUST be able to open a "Scheduling View" for any schedule in `ready_for_availability` or `posted` status.
- **FR-026**: The Scheduling View MUST render one row per day of the schedule's month with columns: **Final** (editable by GM), one read-only column per linked player showing that player's submitted status (or **NP** for late-joiners on a posted schedule), and a system-computed **Final Note** column.
- **FR-027**: The Final column MUST cycle only between **NA** and **A** (a smaller set than input statuses).
- **FR-028**: For each day, the system MUST compute the Final Note using the linked players' and GM's statuses for that day:
  - All **I** or **A**: Final Note = "Good Day" (green background).
  - One or more linked players are **IF**: Final Note = "Maybe, talk to <Player Name>" listing each IF player (yellow background).
  - At most one-fifth of linked players are **NA** or **IF** and none are IF: Final Note = "Maybe" (yellow background).
  - More than one-fifth of linked players are **NA** or **IF**: Final Note = "Bad Day" (red background).
- **FR-029**: When the Scheduling View first opens, the Final column MUST be pre-filled per day: **A** when the Final Note rule produces "Good Day," and **NA** otherwise.
- **FR-030**: A "Post Schedule" action MUST transition the schedule to `posted`. Any blank Final value at the moment of posting MUST be treated as **NA**.
- **FR-031**: On `posted` transition, the system MUST send every linked player both an email and an in-app notification that the schedule has been posted.

#### Update after posting

- **FR-032**: After posting, the GM MUST be able to edit Final column values via the Scheduling View. All player columns MUST remain read-only.
- **FR-033**: The GM MUST be presented with two save actions on a posted schedule's Scheduling View: **Update Schedule** (saves silently) and **Update and Notify** (saves and sends every linked player both an email and an in-app notification of the change).

#### View Game schedule listing

- **FR-034**: The View Game screen MUST display a table of the game's schedules with columns: name, status, submission count (`submitted/total`), and actions (View).
- **FR-035**: The schedule table MUST be sorted by scheduled month/year descending and limited to the six most recent rows by default, with a "View All Schedules" link to a full list.
- **FR-036**: The submission count `submitted/total` MUST use as denominator the count of currently linked players (excluding any removed since linking).
- **FR-037**: Each row's View action MUST open a Schedule Detail page that displays the GM's calendar at the top and each linked player's submission below; for any linked player who has not yet submitted (excluding NP late-joiners), a **Send Reminder** button MUST be shown that, on click, sends that player both an email and an in-app notification.
- **FR-038**: Send Reminder MUST have no rate limit in v1; the GM may click it any number of times.

#### Player-facing posted-schedule view

- **FR-039**: A player's per-character "View Game" page MUST show, for every game they have a character in, the **posted** schedule for the current calendar month (containing today) and the next calendar month, when those exist.
- **FR-040**: A "View All" action on the per-character "View Game" page MUST open the full list of posted schedules for that character/game, sorted future-first then past (future months descending toward current, then past months descending).
- **FR-041**: Past-month posted schedules MUST NOT appear on the current/upcoming widget regardless of their post date.

#### Deletion

- **FR-042**: A GM MUST be able to delete any schedule on a game they own, regardless of status.
- **FR-043**: The delete action MUST be guarded by a confirmation dialog requiring the GM to type the literal word `delete` before the confirm button is enabled.
- **FR-044**: Deleting a schedule MUST cascade-remove all GM availability records, player links, player submissions, and any derived data tied to that schedule.
- **FR-045**: Deletion MUST NOT trigger any automatic notifications to players in v1.

#### Permissions

- **FR-046**: All schedule mutations (initiate, GM availability changes, transition, post, update, delete, send reminder) MUST be restricted to the GM who owns the game.
- **FR-047**: Player availability submission MUST be restricted to the player whose character is linked to the schedule.

### Key Entities

- **Schedule**: Belongs to a Game. Holds month, year, start_time, end_time, GM timezone (captured at initiation), status (`preparing` | `ready_for_availability` | `posted`), derived display name, and a posted_at timestamp when applicable. Uniqueness: at most one schedule per game per month/year.
- **GM Day Availability**: Per (Schedule, day-of-month) GM status drawn from {NA, I, A, IF}. Default NA.
- **Player Schedule Link**: Links a Player (via their character in the game) to a Schedule. Created on transition to `ready_for_availability` or on late-join (with a flag distinguishing posted-late-join NP linkage). Tracks whether the player has submitted.
- **Player Day Availability**: Per (Player Schedule Link, day-of-month) status drawn from {NA, I, A, IF, NP}. NP only for posted-schedule late-joiners. NA for any day the GM has marked NA.
- **Schedule Final Day**: Per (Schedule, day-of-month) the GM's Final decision drawn from {NA, A}. Pre-filled by rule, blanks treated as NA on post.
- **Schedule Notification**: A record of an email + in-app notification fired for a given (Schedule, Player, event) where event is one of `ready_for_availability`, `reminder`, `posted`, `updated`. Existence supports auditing and the in-app notification feed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GM can initiate a new schedule, set per-day availability for the entire month, and click "Ready for Availability" in under 3 minutes for a typical 30-day month.
- **SC-002**: 100% of currently-in-game players receive both an email and an in-app notification within 60 seconds of a schedule entering `ready_for_availability`, `posted`, `updated-and-notify`, or a per-player `reminder` event.
- **SC-003**: A player can locate their pending schedule from the dashboard, mark availability for every day, and click "Set Availability" in under 2 minutes for a typical 30-day month.
- **SC-004**: 100% of in-progress schedules in `ready_for_availability` automatically link any player who joins the game after the transition, with no manual GM step.
- **SC-005**: 100% of late-joining players, when opening a posted-before-they-joined schedule, see every day status as NP and are unable to interact with it.
- **SC-006**: The View Game schedule table for a game with 12 historical schedules shows exactly the 6 most recent (by month/year) by default; "View All Schedules" exposes the remaining 6.
- **SC-007**: When a GM toggles a day to NA on a `ready_for_availability` schedule, every linked player's status for that day is overwritten to NA before the GM's next page load.
- **SC-008**: Attempting to initiate a second schedule for the same game/month is blocked 100% of the time with a message naming the conflicting schedule.
- **SC-009**: The Final Note classification ("Good Day" / "Maybe" / "Maybe, talk to …" / "Bad Day") and its background color match the rule for every day of every schedule the GM views.
- **SC-010**: Posting a schedule with any blank Final values stores those days as NA — verified by reopening the Scheduling View after posting.
- **SC-011**: Deleting a schedule removes 100% of its dependent records (GM availability, player links, player submissions, final days, related notifications) with no orphans.

## Assumptions

- Schedules are always month-aligned and have a single, fixed time slot for the entire month. Variable-length periods and per-day time slots are out of scope for v1.
- The GM's local timezone is captured at schedule initiation and stored on the schedule. v1 assumes all players are in the same timezone as the GM; multi-timezone localization is out of scope for v1 but the stored GM timezone preserves the option.
- "Current month" everywhere means the calendar month containing **today**, judged in the GM's stored timezone for GM-facing views and in the player's session/local time for player-facing widget rendering, with the underlying schedule month being the source of truth.
- The dashboard "My Characters" table from feature 002 already exists; this feature adds a new per-character "View Game" page reachable from each character row.
- The notification bell from feature 002 (US6) is the in-app notification surface for all schedule events. Email delivery uses the same transactional pipeline as feature 002's invite emails.
- Game ownership and player-of-game membership are established by features 001 and 002; this feature consumes them and does not redefine them.
- "One-fifth" in the Final Note rule means a strict mathematical fraction of *linked* players (excluding the GM). With fewer than 5 linked players, "more than one-fifth" effectively means "1 or more" non-A/non-I players unless every linked player is I/A.
- v1 has no rate-limiting on Send Reminder, no notification on delete, no edit history on Final values, and no automatic posting (the GM always posts manually).
- Players cannot leave free-text notes alongside an "Available If" status in v1; resolution of IF conditions happens out-of-band between GM and player.
