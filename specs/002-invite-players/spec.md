# Feature Specification: Invite Players

**Feature Branch**: `002-invite-players`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Invite Players: As a GM I want to be able to invite players to my games. If these players do not already have an account it will guide them through the registration process and once registered and logged in they will be able to accept their invitation to the game. The GM will want to be able to see a list of players for their games. Players will have a character name, character summary, a status (active, inactive, and done), GM notes, and it should belong to the user account of the player individual. I would like to see the players associated with a game on the game view screen."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GM invites a new player by email (Priority: P1)

A Game Master (GM) opens one of their games and invites a person by email address. The invitee does not yet have an account. The system emails them a link that walks them through registration. After they finish registering and log in, they see the pending invitation and can accept it, which adds them to the GM's game as a Player. The GM has already filled in the Player's character name, character summary, and any private GM notes when sending the invitation.

**Why this priority**: This is the core of the feature — without it, GMs have no way to bring outside friends into their games. It also exercises the full "stranger to seated player" funnel (email → register → log in → accept), which is the riskiest path and the strongest demo of value.

**Independent Test**: A GM can invite an email that has no existing account, the recipient receives an email, completes registration through a guided link, logs in, sees the pending invitation, accepts it, and then appears as an active Player on the GM's game. Delivers the full "GM grows their table from a contact list" outcome on its own.

**Acceptance Scenarios**:

1. **Given** a GM is viewing a game they own, **When** they submit an invitation with an email, character name, character summary, and optional GM notes, **Then** an invitation is recorded as pending and an email is sent to that address.
2. **Given** an invited person has no existing account, **When** they open the link in the invitation email, **Then** they are guided through registration with the invitation context preserved.
3. **Given** a newly registered invitee logs in for the first time, **When** they land in the app, **Then** they see the invitation in their notifications list and can accept it.
4. **Given** an invitee accepts an invitation, **When** the acceptance succeeds, **Then** a Player record is created linking that user to the GM's game with the GM-provided character name, summary, and notes, and status defaulting to active.
5. **Given** the GM views the game, **When** the page loads after acceptance, **Then** the new Player appears in the players list for that game.

---

### User Story 2 - GM invites an existing user by email (Priority: P1)

The GM enters the email of someone who already has an account. That person sees the invitation in their in-app notifications list (and receives an email) without going through registration. They accept and are added as a Player.

**Why this priority**: Most invitations after the initial growth period will be to existing users; without this path, the feature is incomplete for the steady-state experience. It is grouped with Story 1 at P1 because the GM-side flow is the same and the invitee-side path is a strict subset of the registration flow.

**Independent Test**: With one pre-existing user account, a GM can invite that user's email, the user sees a pending invitation in their in-app notifications list, accepts it, and appears on the game's player list.

**Acceptance Scenarios**:

1. **Given** the invited email matches an existing user account, **When** the GM sends the invitation, **Then** the invitation is recorded as pending, an email is sent, and a notification appears in that user's in-app notifications list.
2. **Given** the existing user is logged in, **When** they open their notifications list, **Then** the pending invitation is shown with the inviting GM and game name.
3. **Given** the existing user accepts the invitation, **When** the acceptance succeeds, **Then** a Player record is created and the invitation is marked accepted.

---

### User Story 3 - GM views and manages their game's player roster (Priority: P1)

On the game view screen, the GM sees the list of accepted Players (character name, summary, status) and a separate, GM-only section listing pending invitations. The GM can edit any Player's character name, summary, GM notes, and status (active, inactive, done), and can revoke any pending invitation.

**Why this priority**: Without a roster view and basic editing, the GM cannot run their game once players have accepted. It is the natural completion of the invitation loop and is the screen the GM will look at most often.

**Independent Test**: With at least one accepted Player and one pending invitation on a game, a GM can open the game view, see both groups in their respective sections, change the accepted Player's status from active to done, edit the GM notes, and revoke the pending invitation, with all changes reflected on reload.

**Acceptance Scenarios**:

1. **Given** a game has accepted Players and pending invitations, **When** the GM views the game, **Then** accepted Players are listed in a section visible to anyone who can see the game, and pending invitations are listed in a separate section visible only to the GM.
2. **Given** a non-GM viewer (a Player or other allowed viewer) opens the same game view, **When** the page renders, **Then** they see only the accepted-Player roster, with no pending-invitation section.
3. **Given** the GM is editing a Player, **When** they change status to inactive or done and save, **Then** the new status is persisted and shown.
4. **Given** the GM revokes a pending invitation, **When** the recipient later opens the link or their notifications list, **Then** the invitation is no longer accept-able and is shown as revoked or removed.

---

### User Story 4 - Invitee declines an invitation (Priority: P2)

An invited person — registered or not — chooses to decline the invitation rather than accept. The invitation is closed and the GM can see that it was declined.

**Why this priority**: Important for politeness and clean roster state, but the GM can already work around its absence by ignoring stale pending invitations. Ships after the core accept path.

**Independent Test**: Given a pending invitation, the invitee clicks decline, the invitation moves to a declined state, no Player record is created, and the invitation no longer appears as pending on the GM's game view.

**Acceptance Scenarios**:

1. **Given** an invitee has a pending invitation, **When** they decline it, **Then** no Player record is created and the invitation is marked declined.
2. **Given** an invitation has been declined, **When** the GM views the game, **Then** the invitation no longer appears in the pending-invitations section.

---

### User Story 5 - Player finds their games on the dashboard (Priority: P2)

A logged-in user opens the dashboard and sees a "My Characters" section listing every game in which they are an accepted Player, alongside the existing "My Games" section that lists games they GM. The dashboard arranges these as two side-by-side columns — My Characters on the left, My Games on the right — so the user can navigate from the dashboard to either role's games in one click.

**Why this priority**: Without this, players have no obvious place to return to a game once they've accepted an invitation; they would have to keep the original email or notification handy. It is P2 because the immediate accept loop (Stories 1–3) already gets a player into a game; the dashboard listing is the steady-state navigation surface.

**Independent Test**: With at least one game where the user is the GM and at least one game where the user is an accepted Player, the user opens the dashboard and sees both sections populated in the two-column arrangement, and clicking a Player entry navigates to that game's view.

**Acceptance Scenarios**:

1. **Given** a user is an accepted Player on one or more games, **When** they open the dashboard, **Then** the "My Characters" section lists each of those games (showing at least the game name and the user's character name on that game).
2. **Given** the same user owns one or more games as GM, **When** they open the dashboard, **Then** the "My Games" section lists those games to the right of "My Characters".
3. **Given** a user has no Player records, **When** they open the dashboard, **Then** the "My Characters" section shows a clear empty state rather than being absent.
4. **Given** a user is both a GM on some games and a Player on others, **When** they open the dashboard, **Then** both sections are populated with their respective entries and a game does not appear in both (a user cannot be GM and Player on the same game in this feature's scope).
5. **Given** a Player's status on a game is `inactive`, **When** they view their dashboard, **Then** that game appears in "My Characters" (status alone does not remove the dashboard entry); **and given** a Player's status is `done`, **When** they view their dashboard, **Then** the game does NOT appear in "My Characters" but IS reachable via the "View all" link to `/characters`, which lists every Player record regardless of status.

---

### User Story 6 - In-app notifications list (Priority: P2)

A logged-in user has a notifications list in the app. Pending game invitations appear there alongside (future) other notifications, with a clear call to action to accept or decline.

**Why this priority**: Email alone is sufficient for the MVP loop, but most users will discover invitations faster through in-app notifications, and this list is intended to grow beyond invitations. It ships after the email-driven flow is working end-to-end.

**Independent Test**: A user with at least one pending invitation can open the notifications list and see the invitation listed, with accept and decline actions inline.

**Acceptance Scenarios**:

1. **Given** a user has one or more pending invitations, **When** they open the notifications list, **Then** each pending invitation is listed with the inviting GM, game name, and accept/decline actions.
2. **Given** a user accepts or declines from the notifications list, **When** the action completes, **Then** the entry is removed from the pending list (or moved to a resolved state) without a full page reload being necessary.

---

### Edge Cases

- The GM tries to invite an email that already has a pending or accepted invitation for the same game: the system rejects the duplicate and informs the GM.
- The GM tries to invite their own email: the system rejects the attempt.
- The GM revokes a pending invitation; the invitee then opens the email link or notifications entry: the system shows that the invitation is no longer valid rather than allowing acceptance.
- The invitee registers with a different email address than the one invited: the original invitation remains pending and is not auto-matched; only an account whose primary email matches the invited address sees the invitation in-app. (Email link continues to work because it carries an invitation token.)
- Two different GMs invite the same person to two different games: the invitee sees two distinct pending invitations and can accept or decline each independently.
- An accepted Player's user account is deleted: the Player record is removed from the game's roster (or otherwise resolved) and no longer appears.
- The same user accepts, the GM later marks them done, and then the GM wants to bring them back: the GM edits the existing Player's status back to active rather than re-inviting (one Player per user per game is enforced).
- The invitation email fails to deliver: the GM sees the invitation as pending in the GM-only section so they can follow up out-of-band; in-app notifications still surface for existing users.

## Requirements *(mandatory)*

### Functional Requirements

**Invitation creation (GM side)**

- **FR-001**: A GM MUST be able to invite a person to a game they own by providing the invitee's email address, a character name, a character summary, and optional private GM notes.
- **FR-002**: The system MUST reject an invitation when the email already has a pending or accepted Player relationship to the same game, and MUST report this to the GM.
- **FR-003**: The system MUST reject an invitation when the email belongs to the inviting GM's own account.
- **FR-004**: Only the GM who owns a game MUST be able to create, revoke, or otherwise manage invitations for that game.

**Invitation delivery**

- **FR-005**: The system MUST send an email to the invited address containing a link that allows the recipient to act on the invitation.
- **FR-006**: The invitation link MUST identify the specific invitation such that opening it after registration leads the recipient directly to accepting (or declining) it without needing to know the game's identity in advance.
- **FR-007**: When the invited email matches an existing user account, the system MUST also surface the invitation in that user's in-app notifications list.

**Registration flow for new users**

- **FR-008**: When the invitation link is opened by a person without an account, the system MUST guide them through registration while preserving the invitation context, so that after registration and login they are returned to a place where they can accept the invitation.
- **FR-009**: After a new user finishes registration and logs in via an invitation link, the system MUST present the pending invitation for acceptance.

**Acceptance and decline**

- **FR-010**: A logged-in user MUST be able to accept a pending invitation addressed to them, which MUST create exactly one Player record linking that user account to the GM's game.
- **FR-011**: A logged-in user MUST be able to decline a pending invitation addressed to them, after which the invitation MUST NOT be accept-able and MUST NOT create a Player record.
- **FR-012**: The system MUST prevent acceptance of an invitation that has been revoked, already accepted, declined, or otherwise resolved.
- **FR-013**: On acceptance, the resulting Player MUST inherit the character name, character summary, and GM notes provided by the GM at invitation time, and MUST default to status active.

**Player records**

- **FR-014**: A Player record MUST belong to exactly one user account and exactly one game; the system MUST enforce that a given user has at most one Player record per game.
- **FR-015**: Only the GM who owns the game MUST be able to edit a Player's character name, character summary, GM notes, or status.
- **FR-016**: A Player's status MUST be one of exactly three values: active, inactive, done.
- **FR-017**: The system MUST not delete a Player record when their status changes to inactive or done; status changes MUST be reversible by the GM.

**Game view**

- **FR-018**: The game view screen MUST display the list of accepted Players for that game, including each Player's character name, character summary, and status, to anyone who is permitted to view the game.
- **FR-019**: The game view screen MUST display a list of pending invitations for that game (with at least the invited email and character name) only to the GM who owns the game.
- **FR-020**: GM notes on a Player MUST be visible only to the GM who owns the game and MUST NOT be exposed to the player whom the notes are about or to any other viewer.

**GM management actions**

- **FR-021**: The GM MUST be able to revoke any pending invitation on their game; revoked invitations MUST move out of the pending list and MUST NOT be accept-able afterward.
- **FR-022**: Once a Player has accepted, the GM MUST manage their continued participation through status changes (active, inactive, done) rather than removal; the system does not provide a "remove accepted Player" action in this feature.

**In-app notifications**

- **FR-023**: A logged-in user MUST have access to an in-app notifications list that includes their pending game invitations.
- **FR-024**: The notifications list MUST allow the user to accept or decline a pending invitation directly, and MUST update to reflect the resolved state after the action.

**Dashboard**

- **FR-025**: The dashboard MUST include a "My Characters" section listing every game in which the current user is an accepted Player, showing at least the game name and the user's character name on that game, with each entry linking to the game's view.
- **FR-026**: The dashboard MUST include a "My Games" section listing every game the current user owns as GM (this section may already exist; this feature ensures it coexists with "My Characters").
- **FR-027**: On a viewport wide enough to show two columns side by side, the dashboard MUST present "My Characters" as the left column and "My Games" as the right column.
- **FR-028**: When the current user has no Player records, the "My Characters" section MUST render an explicit empty state rather than being hidden; the same applies to "My Games" when the user owns no games.
- **FR-029**: A Player record's visibility on the dashboard's "My Characters" section is determined by status: records with status `active` or `inactive` MUST appear on the dashboard; records with status `done` MUST be hidden from the dashboard but MUST remain accessible via the "View all" link to the `/characters` route, which lists every Player record regardless of status. Status alone never deletes the underlying Player record.

### Key Entities *(include if feature involves data)*

- **Invitation**: A pending offer from a specific GM, on a specific game, to a specific email address, carrying the GM-provided character name, character summary, and GM notes that will become the Player's record on acceptance. Has a lifecycle state of pending, accepted, declined, or revoked. Belongs to one game; references one inviting GM (a user) and one invited email; on acceptance, links to the resulting Player.
- **Player**: A person seated at a specific game, identified by their user account. Carries a character name, character summary, GM notes (private to the GM), and a status (active, inactive, done). Belongs to one game and one user account; unique per (game, user).
- **Notification**: An in-app entry shown to a specific user. For this feature, the entry represents a pending invitation and links to the actions to accept or decline it. The notifications list is designed to accept other entry types in the future.
- **Game** (existing): The thing being prepared/run by a GM. Owns a roster of Players and a set of Invitations. The GM is the user who owns the game.
- **User** (existing): An account with an email address used for login. Can be the GM of zero or more games and a Player in zero or more games.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GM can send an invitation from their game in under 60 seconds from start (opening the game) to confirmation (invitation marked pending).
- **SC-002**: An invited person who does not yet have an account can go from clicking the email link to being a seated Player on the GM's game in under 3 minutes, including registration.
- **SC-003**: An invited person with an existing account can accept an invitation in under 30 seconds from opening the email or notifications list.
- **SC-004**: At least 90% of accepted invitations result in the new Player appearing on the GM's game view on the next page load, with no manual refresh or intervention required.
- **SC-005**: 0% of pending invitations are visible to viewers other than the GM who owns the game; GM notes are visible to 0% of viewers other than that GM. (Verified by access checks; any breach is a feature-blocking defect.)
- **SC-006**: 0% of accepted invitations result in more than one Player record for the same (user, game) pair, even under concurrent acceptance attempts.
- **SC-007**: GMs can locate the pending-invitation section and the accepted-player roster on the game view without prior training in fewer than 10 seconds in usability testing (proxy: both sections are visually distinct and labelled on the game view).
- **SC-008**: 100% of accepted Player records for the logged-in user appear in the "My Characters" dashboard section on the next dashboard load after acceptance, with no manual refresh beyond opening the page.
- **SC-009**: A user can navigate from the dashboard to any of their games (as GM or Player) in a single click from the relevant section.

## Assumptions

- The existing user-registration flow can be entered through a link that carries an invitation token and returned-to after login; we do not need a parallel registration system.
- The application already has, or will reuse, an email-sending capability suitable for transactional invitation emails; building a new email infrastructure is out of scope for this feature.
- "GM" is the existing notion of a game's owner; permission checks for managing a game's invitations and Players reuse the same ownership rule used for editing the game itself.
- A user's primary login email is the same address an invitation is matched against for in-app notification surfacing; alternate or secondary emails are out of scope.
- One Player per (user, game) is the desired model; games where a single human plays multiple characters are out of scope for this feature.
- Status values are exactly active, inactive, done — no additional states (e.g., "guest", "NPC") in this feature.
- Removal of an accepted Player from a game (as opposed to status changes) is intentionally out of scope; if needed, it will be a follow-up feature.
- In-app notifications are a generic list intended to grow beyond invitations; this feature establishes the list and adds the invitation entry type, but does not need to ship other notification types.
- Email delivery is best-effort; the GM-visible pending list is the source of truth for what is outstanding, so undelivered emails do not silently lose state.
- "Two columns on the left, My Games on the right" is interpreted as a two-column dashboard layout — "My Characters" occupies the left column as a single list and "My Games" occupies the right column as a single list — not as a 2-column sub-grid within "My Characters".
- The dashboard's "My Characters" section deliberately hides `done` players to keep the dashboard focused on currently-engaged characters; the complete list (all statuses) lives at `/characters`. This filter was finalised during the planning grilling round (option C).
- The "My Games" section already exists from the prior feature; this feature's responsibility is to add "My Characters" alongside it and ensure the two-column arrangement on wide viewports.
- Narrow-viewport (mobile) layout is left to standard responsive behavior — the two columns may stack with "My Characters" above "My Games" — and is not specified in detail here.
- A user is not expected to be both GM and Player on the same game; if that case arises in the future it is out of scope for this feature.
