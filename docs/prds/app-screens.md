# Game Night — Screen Inventory PRD

**Purpose**: Brief a UI designer (or Google Stitch) on every screen
that exists in the Game Night SPA today. Each section is
self-contained — copy a single section into Stitch and you have
enough to ideate.

**Audience**: A designer who has never seen the app. No code
references; describes information architecture, content blocks,
states, and CTAs.

---

## 1. Product context

**Game Night** is a web app for tabletop / role-playing game
groups. A **Game Master (GM)** runs a campaign ("game") with a
**roster of players**, each of whom plays a **character**. The GM
**schedules sessions** one month at a time: GM marks their own
availability, players mark theirs, then the GM posts the final
list of "game on" days. The schedule lifecycle is the heart of
the product.

Three top-level nouns: **Game**, **Character**, **Schedule**.

Two primary roles: **GM** (creates games, runs schedules) and
**Player** (joins games via invite, plays a character, submits
availability). A user can be both at once (different role per
game).

---

## 2. Personas & permission summary

| Persona | What they see |
| --- | --- |
| **Anonymous visitor** | Marketing landing page; sign-in / register / magic-link / password-reset flows; can preview an invitation token if shared. |
| **Authenticated player** | Personal dashboard, all characters, character detail, character schedule views, notifications. |
| **Authenticated GM** | Everything a player sees, plus: game register / edit / detail / delete; schedule initiate / set availability / track submissions / post / update / delete; player invite / revoke. |

---

## 3. Global chrome (every authenticated screen)

A sticky top navbar spans the full width with a backdrop blur and a
light bottom border. The shell is **header + main content** — there
is no footer.

**Desktop layout (≥ small breakpoint):**

- Left: GameNight wordmark (links to `/dashboard` for authenticated,
  `/` for anonymous).
- Center: primary nav (text links) — **Dashboard**, **All Games**.
  Authenticated only.
- Right: notifications bell (unread badge), user menu dropdown
  (email + sign-out). Anonymous visitors see **Sign in** and
  **Register** buttons instead.

**Mobile layout (< small breakpoint):** primary nav collapses into
a hamburger button that opens a side sheet with the same links.

**Toast region**: bottom-right. Success / info / error toasts surface
mutation outcomes on most pages.

---

## 4. Information architecture

```
/                                              Marketing landing
/sign-in                                       Sign in
/register                                      Register
/magic-link                                    Request magic link
/magic_link/:token                             Confirm magic-link sign-in
/reset                                         Request password reset
/password-reset/:token                         Set new password
/confirm_new_user/:token                       Confirm account email

/dashboard                                     Authenticated home
/notifications                                 Bell-page list

/invitations                                   My pending invitations
/invitations/:token                            Invitation preview / accept

/games                                         All games (GM-side list)
/games/new                                     Register a new game
/games/:id                                     Game detail (GM controls + roster + schedules sidebar)
/games/:id/edit                                Edit game

/games/:gameId/schedules                       All schedules for a game
/games/:gameId/schedules/:scheduleId           GM Schedule Detail (calendar + roster)
/games/:gameId/schedules/:scheduleId/scheduling  Scheduling View matrix (set Final + post)

/characters                                    My characters
/characters/:id                                Character detail (player-side)
/characters/:id/schedules                      All posted schedules for a character
/characters/:id/schedules/:scheduleId          Player Schedule View (calendar + submit)
```

---

## 5. Cross-cutting design language

These patterns recur on multiple screens — Stitch should establish
them once, then reuse.

### 5.1 Status badges

- **Game status**: `active`, `paused`, `cancelled`, `completed`.
  Pill-shaped, color-coded.
- **Schedule status**: `preparing`, `ready_for_availability`,
  `posted`. Pill-shaped, color-coded.
- **Player / character status**: `active`, `paused`, `retired
  (Done)`.

### 5.2 Calendar (`MonthCalendar`)

A desktop-planner-style month grid. Sunday-first, 7 columns × 5–6
week rows, each cell ~80 px tall. Cells render a **status icon +
short label** so the signal isn't color-only:

| Status | Icon | Label |
| --- | --- | --- |
| Not Available (NA) | ✕ | "Not Available" |
| Ideal (I) | ★ | "Ideal" |
| Available (A) | ✓ | "Available" |
| Available If (IF) | ? | "Available If" |
| Not Present (NP) | — | "Not Present" |
| Host Unavailable (GM-locked NA from player POV) | ✕ | "Host Unavailable" (gray, uninteractive) |

Three modes:

- **`gm-edit`**: every cell clickable, cycles status on click.
- **`player-edit`**: every cell clickable except GM-locked NA
  (which renders gray + "Host Unavailable").
- **`read-only`**: all cells display only.

Keyboard: roving tabindex, Arrow / Home / End to navigate,
Enter / Space to cycle.

### 5.3 Day-matrix table (`DayMatrixTable`)

Used on the Scheduling View (GM finalisation step). Wide table
(scroll-x on mobile):

- **Rows**: each day of the month (1..N).
- **Columns**: (1) `Final` toggle button (NA / A) — GM clickable;
  (2) `Note` cell that auto-classifies as `good_day` /
  `host_unavailable` / `maybe` / `maybe_with_if` / `bad_day` and
  shows a colored chip; (3) one column per participant showing
  that participant's submitted status with the same icon palette
  as the calendar.

### 5.4 Typed-confirmation dialog

For destructive actions (delete game, delete schedule). User must
type the literal word **"delete"** (case-sensitive) before the
red Delete button arms. Modal with: title, description naming the
target, an input field, **Cancel** + **Delete** buttons.

### 5.5 Empty / loading / error states

Every list view follows the same pattern:

- **Loading**: muted-tone single line ("Loading schedules…" /
  "Loading roster…").
- **Error**: rounded alert box, destructive tint, actionable copy
  ("We couldn't load schedules. Please refresh.").
- **Empty**: dashed-border box with a sentence + a primary CTA
  pointing the user toward the action that would create the first
  item.

---

# Screen-by-screen briefs

Each section is the brief for one screen. Format: **path**,
**audience**, **goal**, **layout**, **content blocks**, **primary
actions**, **states**, **navigation out**.

---

## Marketing & auth

### `/` — Landing page

- **Audience**: anyone (the only screen anonymous and authenticated
  share equally).
- **Goal**: One-line pitch + a single call-to-action that adapts to
  auth state.
- **Layout**: centered hero. Big "GameNight" wordmark, one-line
  tagline ("Organize your game groups, schedule sessions, and
  manage players."), a single primary button.
- **CTA copy**: "Sign in" (anonymous) or "Go to dashboard"
  (authenticated).
- **States**: none — purely static.
- **Navigation out**: `/sign-in` or `/dashboard`.

### `/sign-in`

- **Audience**: anonymous (authenticated users redirect to
  `/dashboard`).
- **Goal**: Sign in with email + password, optionally remember the
  device.
- **Layout**: narrow centered card, ≤ 480 px wide.
- **Content**: "Sign in" heading; subtitle "Don't have an account?
  Register" with link; form with **Email**, **Password** (with a
  small "Forgot?" link in the field's top-right going to `/reset`),
  **Keep me signed in on this device** checkbox; primary "Sign in"
  button.
- **Inline errors** under each field; **form-level error alert**
  above the form when the credentials don't match (generic
  message — never reveals which field is wrong).
- **Navigation out**: `/register`, `/reset`, `/dashboard` on success
  (with optional `?redirect=` param honored).

### `/register`

- **Audience**: anonymous.
- **Goal**: Create a new account with email + password.
- **Layout**: same narrow card pattern as sign-in.
- **Content**: "Create your account" heading; "Already have an
  account? Sign in" link; **Email**, **Password** (helper text
  "min 8 characters"), **Confirm password**; primary "Create
  account" button.
- **Special case**: if email is already taken, the inline error
  reads "That email is already registered" and offers two links:
  "Sign in instead" and "Reset your password".
- **Navigation out**: `/sign-in`, `/reset`, `/dashboard` on success.

### `/magic-link`

- **Audience**: anonymous.
- **Goal**: Request a passwordless sign-in link via email.
- **Layout**: narrow card, two-stage.
- **Stage 1**: heading "Sign in with a magic link", explanatory
  paragraph, **Email** input, "Send sign-in link" button.
- **Stage 2** (after submit): heading "Check your email",
  confirmation paragraph, link "Use a password instead" → `/sign-in`.
- **States**: rate-limit error surfaces as a form alert at the top.

### `/magic_link/:token`

- **Audience**: anyone (token-bearing).
- **Goal**: Confirm the magic-link sign-in.
- **Layout**: narrow card.
- **Content**: heading "Sign in to Game Night", optional
  "Signing in as `email@x.com`" line if the token can be decoded,
  optional **account-switch warning** if a different user is
  already signed in, single primary "Sign in to Game Night" button.
- **Error state**: heading "Sign-in link is invalid or expired",
  two links — "Request a new link" → `/magic-link` and "Use a
  password instead" → `/sign-in`.
- **Navigation out**: `/dashboard` on success.

### `/reset`

- **Audience**: anonymous.
- **Goal**: Request a password-reset email.
- **Layout**: same two-stage card pattern as `/magic-link`.
- **Stage 1**: heading "Reset your password", instructions, **Email**
  input, "Send reset link" button.
- **Stage 2**: heading "Check your email", confirmation paragraph,
  "Back to sign in" link.

### `/password-reset/:token`

- **Audience**: anyone.
- **Goal**: Set a new password using a token from the email.
- **Layout**: narrow card.
- **Content**: heading "Choose a new password", **New password** +
  **Confirm new password** fields with the 8-char hint, "Reset
  password" button.
- **Error state**: token-invalid alert with "Request a new link"
  link → `/reset`.
- **Navigation out**: `/dashboard` on success with a "Password
  updated" toast.

### `/confirm_new_user/:token`

- **Audience**: anyone (token-bearing).
- **Goal**: Confirm a newly registered account's email.
- **Layout**: narrow card.
- **Content**: heading "Confirm your email", optional "Confirming
  `email@x.com`" line, "Confirm email address" button.
- **Error state**: "Confirmation link is invalid or expired" with
  "Sign in" and "Register again" links.

---

## Authenticated home

### `/dashboard`

- **Audience**: authenticated (player and / or GM).
- **Goal**: One screen that shows everything that needs the
  current user's attention.
- **Layout**: page heading + welcome line, then a **two-column
  responsive grid** (stacks on mobile).
- **Content blocks**:
  - **Left column — My Characters**: cards for every active
    character the user plays. Each card shows character name, the
    game's title, status badge, and a "View" button → character
    detail.
  - **Right column — My Games**: cards for every game the user
    owns or co-runs. Each card shows game title, status badge,
    short description, and a "View" button → game detail. GM-only
    column.
- **States**: spinner / muted line while loading; empty card with
  CTA when the user has no characters or games yet.

### `/notifications`

- **Audience**: authenticated.
- **Goal**: Browse every notification ever sent to this user.
- **Layout**: standard list page.
- **Content**: heading "Notifications"; subtitle "Everything we've
  sent you, newest first."; vertically-stacked list of notification
  rows (icon, title, timestamp, optional CTA link to the related
  subject).
- **Empty state**: "No notifications yet."

### `/invitations`

- **Audience**: authenticated.
- **Goal**: Show every invitation that has been sent to **the
  current user's email** but isn't yet accepted.
- **Layout**: standard list page.
- **Content**: heading "My invitations"; subtitle "Pending
  invitations sent to your email address."; list of invitation
  rows (character name, optional summary, "Open" link → full
  preview at `/invitations/:token`).
- **Empty state**: "You don't have any pending invitations right
  now."

### `/invitations/:token`

- **Audience**: anyone with a valid token (anonymous or
  authenticated).
- **Goal**: Preview the invitation and accept / decline.
- **Layout**: narrow centered card.
- **Content**: heading "You've been invited"; preview card showing
  game title, character name, character summary, the GM's display
  name; primary **Accept** button. Authenticated users also see a
  **Decline invitation** secondary button under the card.
- **Special cases**: if anonymous, accept routes them through
  sign-in / register first; if logged in as the wrong account,
  show an account-switch warning before accepting.
- **Errors**: invalid / expired token alert; accept and decline
  failures shown inline.

---

## Game (GM-facing) screens

### `/games`

- **Audience**: authenticated GM.
- **Goal**: List every game this user owns / co-runs.
- **Layout**: page heading + actions row + table.
- **Content**:
  - Heading **All games**.
  - Top-right: secondary **Dashboard** button + primary **Create
    new game** button.
  - **Games table** with columns: Title, Status (badge),
    Description (truncated), and a row "View" link.
- **Empty state**: dashed-border block "You haven't registered a
  game yet" + primary "Create new game" button.

### `/games/new`

- **Audience**: authenticated.
- **Goal**: Register a new game.
- **Layout**: narrow card / form page.
- **Content**: heading "Register a new game"; subtitle "Add a
  game to your dashboard. You can always change the status
  later."; form with **Title**, **Description** (textarea, optional),
  **Status** (select with values active / paused / cancelled /
  completed); primary "Register game" button.
- **Navigation out**: `/dashboard` on success.

### `/games/:id`

- **Audience**: authenticated. Owner sees full controls; non-owner
  (seated player) sees a read-only subset.
- **Goal**: One-stop view of a game and everything attached to it.
- **Layout**: full-width container, ≤ 5xl. Two-column grid on
  large screens (left: game summary, right: schedule sidebar).
- **Sections**:
  1. **Title bar**: H1 with game title; owner-only **Edit** and
     **Delete** buttons top-right.
  2. **Summary column (left)**: Title row, Description row, Status
     row — each rendered as a label / value pair.
  3. **Schedule sidebar (right)** — owner only: re-uses the same
     This Month / Next Month cards from the player view, with a
     prominent **Next Game: \<date\>** callout (emerald-tinted block,
     `text-2xl font-bold` date) above the This Month list.
  4. **Players section**: heading "Players", primary "Invite
     player" button (owner only). Roster table — owner sees a
     row-per-player table with character name, summary, status,
     visible-GM-notes, and an **Edit** button per row; non-owner
     sees a slimmer roster with no notes column.
  5. **Pending invitations** (owner only): heading + subtitle
     "Visible only to you", list of pending invites each with a
     **Revoke** button.
  6. **Schedules section** (owner only): heading "Schedules";
     top-right: primary **Initiate schedule** + secondary **View
     all schedules**. Below: top-6 schedules table with columns
     for Schedule name (month + year + time slot), Status badge,
     "Players ready" (e.g. "3 / 5"), and a row "Open" action.
- **Mutations** (owner): edit game, delete game, invite player,
  revoke invitation, edit player, initiate schedule.

### `/games/:id/edit`

- **Audience**: authenticated owner.
- **Goal**: Update game title / description / status.
- **Layout**: page-card.
- **Content**: heading "Edit: \<title\>"; **Cancel** button
  top-right; same form fields as `/games/new`; primary "Save
  changes" button.
- **Navigation out**: `/games/:id` on save or cancel.

### `/games/:gameId/schedules`

- **Audience**: authenticated. Owner sees all schedules; player sees
  the subset they're linked to (non-`:preparing`).
- **Goal**: Full list of schedules — beyond the top-6 sidebar on
  the game detail.
- **Layout**: page heading + table.
- **Content**: heading "All schedules"; subtitle "Every schedule on
  this game, newest first."; **Back to game** button top-right;
  schedules table identical to the top-6 widget on the game detail.
- **Empty state**: "No schedules yet — initiate one to plan a game
  night."

### `/games/:gameId/schedules/:scheduleId` — GM Schedule Detail

This is the main GM workhorse during the planning lifecycle.
What's visible depends on the schedule's `status`.

- **Audience**: authenticated GM (read access also for any seated
  player; the action surface stays GM-only).
- **Goal**: GM sets their own availability, watches submissions
  arrive, and pivots to the Scheduling View when ready.
- **Layout**: page heading + status row + calendar + roster +
  action bar.
- **Content blocks**:
  1. **Header**: schedule name (e.g. "October 2099 7:00 PM –
     11:00 PM") + status badge + a one-line instruction ("Click
     each day to cycle through Not Available → Ideal → Available
     → Available If"). **Back to game** button top-right.
  2. **Month calendar**:
     - In `:preparing` and `:ready_for_availability`: `gm-edit`
       mode — GM clicks each day to cycle their availability.
     - In `:posted`: `read-only` mode — cells now show the
       **Final** decision per day (A or NA), not the GM's prep
       status.
  3. **Roster section** (only when `status != :preparing`):
     heading "Roster", a divided list of participants. Each row
     shows character name + a sub-line ("Submitted Mar 5, 2026"
     or "Awaiting availability"). For non-submitted players in
     `:ready_for_availability`, a **Send reminder** button.
  4. **Action bar** (bottom):
     - **Transition to Ready** button (only when `:preparing`),
       opens a typed-confirmation dialog.
     - **Scheduling View** button (when `:ready_for_availability`
       or `:posted`) → `/games/:gameId/schedules/:scheduleId/scheduling`.
     - **Delete** button (always) → typed-confirmation dialog.

### `/games/:gameId/schedules/:scheduleId/scheduling` — Scheduling View

- **Audience**: authenticated GM.
- **Goal**: Decide which days the game runs (Final = A or NA), then
  post.
- **Layout**: page heading + day-matrix table + action bar.
- **Header**: "Scheduling View — \<schedule name\>" with one-line
  copy that adapts to status:
  - `:ready_for_availability`: "Toggle Final values to NA or A.
    We'll commit them when you click Post Schedule."
  - `:posted`: "Schedule is posted. Toggle Final values to stage
    edits, then choose Update schedule (silent) or Update and
    notify."
- **DayMatrixTable** (see §5.3): one row per day, columns Final +
  Note + one column per participant. Each participant column is
  color-coded with the calendar palette (✓ A / ★ I / ✕ NA / ?
  IF / — NP).
- **Action bar**:
  - When `:ready_for_availability`: primary **Post schedule**
    button (opens typed-confirmation dialog).
  - When `:posted`: dual buttons — **Update schedule** (silent
    save) and **Update and notify** (silent save + emails every
    linked, non-NP participant). Both disabled when the GM has no
    pending edits in the buffer; a small helper line reads
    "Toggle a Final value to enable."
- **Empty / pending state**: "No participants linked yet" if for
  some reason the schedule has no roster.

---

## Character (player-facing) screens

### `/characters`

- **Audience**: authenticated player.
- **Goal**: Show every character the user plays — including
  retired ones that are hidden from the dashboard.
- **Layout**: page heading + grid of character cards.
- **Content**: heading "My characters"; subtitle "Every character
  you've been seated as, across every game — including retired
  ('Done') characters that are hidden from the dashboard."; grid
  of character cards (one per character — same component as the
  dashboard's My Characters column).
- **Empty state**: "You don't play any characters yet."

### `/characters/:id` — Character Detail

- **Audience**: the character's own user.
- **Goal**: One screen for everything attached to a single
  character.
- **Layout**: heading + action row + posted schedules section +
  awaiting-availability section.
- **Content**:
  1. **Header**: character name (H1), character summary line,
     character status badge. **Back to my characters** button
     top-right.
  2. **Posted schedules section**: This Month / Next Month cards
     with the Next Game callout (see §5 — same component as the
     GM detail sidebar, in player audience). Header line "Posted
     schedules"; if there are more posted schedules outside those
     two buckets, a small **View all** button → all-schedules
     list.
  3. **Awaiting your availability** section: a separate list of
     non-posted schedules the player needs to act on (each card
     shows schedule name, status badge, "Open" button →
     `/characters/:id/schedules/:scheduleId`).

### `/characters/:characterId/schedules`

- **Audience**: authenticated player who owns the character.
- **Goal**: Full list of every schedule this character is linked
  to (posted, ready, etc.), sorted future-first.
- **Layout**: page heading + list.
- **Content**: heading "All schedules"; subtitle "Future months
  first, then past months. The current month is grouped with
  future months."; **Back to character** button top-right; list of
  schedule rows (name + status badge + "Open" button).
- **Empty state**: "No schedules yet."

### `/characters/:characterId/schedules/:scheduleId` — Player Schedule View

This is the main player-side calendar interaction.

- **Audience**: authenticated player (the participant).
- **Goal**: Submit availability while the schedule is open, view
  the Final decision once it's posted.
- **Layout**: page heading + status row + month calendar + action
  bar.
- **Content blocks**:
  1. **Header**: schedule name (H1) + status badge + a
     mode-dependent helper line ("Click each day to cycle
     availability." / "You've submitted your availability." /
     "This schedule has been posted."). **Back to character**
     button top-right.
  2. **Month calendar**:
     - When `status == :ready_for_availability` and the player
       hasn't submitted (or has clicked **Edit**): `player-edit`
       mode — the player cycles their per-day availability.
       GM-NA days render gray with the label **Host Unavailable**
       and ignore clicks.
     - Once submitted (or `:posted`): `read-only` mode.
     - When `:posted`: the cells show the **Final** schedule (A
       or NA from the GM's decision), not the player's submitted
       availability.
  3. **Action bar**:
     - When ready and not submitted: primary **Set Availability**
       button.
     - When ready and already submitted: small "You submitted on
       \<date\>" + **Edit** button to re-enter edit mode.
     - When posted: action bar collapses (read-only).
- **NP late-joiner edge case**: if the player joined the game
  *after* this schedule was posted, every cell shows
  **Not Present** (gray, uninteractive) — the historical truth
  that they weren't around for it.

---

## 6. Notable interaction primitives to reuse in Stitch

- **Dialogs** (Radix-style modals): used for **typed-confirmation**
  destructive actions and for the **Post schedule** confirmation.
  Always centered, max-w ~480 px, with focus trap + Escape close.
- **Toasts**: bottom-right, three variants — `success`, `info`,
  `error`. Auto-dismiss after a few seconds.
- **Cards**: rounded-md borders, soft hairline. Used for character
  cards, schedule buckets, dashboard columns.
- **Tables**: thin borders, sticky-ish header, row hover background.
  Action column right-aligned.
- **Form fields**: label above input, helper text below in muted
  color, error in destructive color. Inputs have a visible border
  and a focus ring (Tailwind `--ring`).
- **Buttons**: three variants — `default` (filled primary),
  `outline` (bordered), `destructive` (red). Sizes `sm` and
  `default`.

---

## 7. Open design questions for Stitch

These are intentionally underspecified in code today; the design
exploration should make a call:

1. **Brand identity** — there's no logo wordmark beyond "GameNight"
   text. Open to a mark + palette.
2. **Empty states** — copy is consistent but the illustrations are
   unset.
3. **Bell / notification surface** — currently a count badge + a
   linked page; could be a popover preview.
4. **Mobile schedule matrix** — the day-matrix table relies on
   horizontal scroll on small screens. Worth ideating a
   stacked / accordion alternative for mobile.
5. **Status badge palette** — currently semantic Tailwind tints
   (emerald / amber / muted / destructive). Stitch should define
   the canonical badge palette.

---

*Last updated: 2026-04-28 — covers every route through merge of
feature 003 (Game Schedule). Refresh whenever a new route is
added.*
