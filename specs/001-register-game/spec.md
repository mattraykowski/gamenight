# Feature Specification: Register Game

**Feature Branch**: `001-register-game`
**Created**: 2026-04-22
**Status**: Draft
**Input**: User description: "Register Game: As a Game Master I want to register and manage my games. I want to be able to create a new game with a title, description, and status (Active, Paused, Cancelled, Completed). I want to see a table of my active games on the dashboard. The table should show title, description, and actions where actions are view and delete (with a confirmation modal requiring me to type a confirmation code such as 'delete'). An empty table should have an empty state encouraging me to create a new game with a link to the create game form. The header of the table should show 'My Active Games' on the left and a button to create a new game as well as a link to View All Games that shows a comprehensive list of my games. The view should show a summary of the game fields and have two actions - edit and delete. Again all deletes should have that confirmation modal. The edit form should mimic the locations of the fields on the view page so that changing from view to edit is not visibly jarring."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Register a game and see it on the dashboard (Priority: P1)

A signed-in Game Master (GM) opens the dashboard and sees a clear way to register a new game. They click the "Create new game" button in the "My Active Games" header, fill in a title, description, and choose a status, then save. The dashboard immediately reflects the new game in the Active games table if its status is Active. If the GM has not yet registered any games, the dashboard shows an encouraging empty state with a link to the create form.

**Why this priority**: Without the ability to register a game and see it on the dashboard, there is no feature. This is the MVP — the smallest slice that delivers the feature's core promise to the user.

**Independent Test**: A GM with no prior games signs in, sees the empty state on the dashboard, clicks through to the create form, submits valid values, and returns to the dashboard where the new Active game appears as a row in the table. No other user's games appear.

**Acceptance Scenarios**:

1. **Given** a signed-in GM with no games, **When** they visit the dashboard, **Then** they see a "My Active Games" section with an empty state that includes a prominent link to the create-game form.
2. **Given** a signed-in GM on the create-game form, **When** they submit a valid title, description, and status of Active, **Then** the game is saved and they are returned to the dashboard with the new game visible in the Active games table.
3. **Given** a signed-in GM who has just created a game with status Paused, **When** they view the dashboard, **Then** the game does NOT appear in the "My Active Games" table (only Active games are shown there).
4. **Given** two GMs each with their own games, **When** GM A views their dashboard, **Then** GM A sees only their own games and never any of GM B's games.
5. **Given** a signed-in GM viewing the dashboard table, **When** they look at the section header, **Then** they see "My Active Games" on the left and a "Create new game" primary action plus a "View All Games" link on the right.
6. **Given** a signed-in GM submitting the create form with a missing title, **When** they submit, **Then** they see an inline validation error and the form stays open with their existing input preserved.

---

### User Story 2 — View an individual game's details (Priority: P2)

From the dashboard or the all-games list, a GM clicks the view action for a game and lands on a detail page that summarizes the game's title, description, and status in a stable, predictable layout. The view page offers two actions: edit and delete.

**Why this priority**: Once games exist, the GM needs a place to inspect a single game's details before editing or deleting it. The detail page also anchors the edit-mirrors-view layout contract (story 3) and the delete action (story 4).

**Independent Test**: A GM creates a game (story 1), clicks view, and reads the game's title, description, and status on a dedicated page. Edit and delete actions are visible on that page.

**Acceptance Scenarios**:

1. **Given** a GM with at least one Active game, **When** they click the view action in the dashboard table row, **Then** they land on a detail page that shows the game's title, description, and status.
2. **Given** a GM on the detail page for one of their games, **When** they look for actions, **Then** they see exactly two: edit and delete.
3. **Given** a GM attempting to view a game that does not belong to them (e.g., via a guessed URL), **When** the page loads, **Then** they see a not-found or forbidden response and no game data.
4. **Given** a GM on a detail page, **When** they look at the field layout, **Then** the title, description, and status occupy visually distinct, labeled regions matching the layout used on the edit form (so toggling between view and edit does not visibly shift field positions).

---

### User Story 3 — Edit a game (Priority: P3)

From the detail page, a GM clicks edit. The edit form uses the same visual layout as the view page (same label placements, same field order, same spacing), so the transition feels like putting the view into an editable mode rather than navigating to a different page. The GM changes fields, saves, and returns to the updated view.

**Why this priority**: Games evolve (status changes from Active to Paused, description updates as the campaign progresses). Editing is the second most common management action after creating.

**Independent Test**: A GM views one of their games, clicks edit, changes the status from Active to Paused, saves, and sees the updated status on both the view page and the dashboard (the game should disappear from "My Active Games" because it is no longer Active).

**Acceptance Scenarios**:

1. **Given** a GM on the view page for their game, **When** they click edit, **Then** they see a form with the game's current values pre-filled and the field layout visibly matches the view page.
2. **Given** a GM on the edit form, **When** they change the title and click save, **Then** the change is persisted and they are returned to the view page showing the new title.
3. **Given** a GM on the edit form, **When** they clear the title and click save, **Then** they see an inline validation error and the form stays open with their other edits intact.
4. **Given** a GM who edits a game's status from Active to Completed, **When** they return to the dashboard, **Then** the game no longer appears in "My Active Games" but is still visible in "View All Games".
5. **Given** a GM attempting to edit a game that does not belong to them (guessed URL), **When** the edit page loads, **Then** they see a not-found or forbidden response and cannot submit changes.

---

### User Story 4 — Delete a game with typed confirmation (Priority: P4)

Any delete action (from the dashboard row or the view page) opens a confirmation modal that requires the GM to type a confirmation code (the literal word "delete") before the delete button becomes enabled. This friction prevents accidental deletions.

**Why this priority**: Deletion is destructive and rare but important. The typed-confirmation gate prevents an accidental click from wiping out a game the GM might care about. Shipping delete without the typed gate would be riskier than deferring delete entirely.

**Independent Test**: A GM creates a game, clicks delete from the dashboard, sees the confirmation modal, attempts to click delete without typing the code (disabled), types "delete" and the button enables, clicks delete, and observes the game removed from the dashboard and from "View All Games".

**Acceptance Scenarios**:

1. **Given** a GM on the dashboard with at least one Active game, **When** they click the delete action in the row, **Then** a modal appears asking them to type the confirmation code "delete" and showing which game is being deleted.
2. **Given** the delete confirmation modal is open, **When** the typed input does not exactly match "delete", **Then** the confirm button is disabled.
3. **Given** the delete confirmation modal is open, **When** the GM types "delete" exactly, **Then** the confirm button enables and clicking it removes the game.
4. **Given** the delete confirmation modal is open, **When** the GM clicks cancel or closes the modal, **Then** the game is not deleted and they return to the previous screen unchanged.
5. **Given** a GM on the detail page, **When** they click delete, **Then** the same typed-confirmation modal appears with the same behavior as from the dashboard.
6. **Given** a GM who just deleted a game from the detail page, **When** deletion completes, **Then** they are returned to the dashboard (not left on a 404 detail page).

---

### User Story 5 — View all games in a comprehensive list (Priority: P5)

From the dashboard's "View All Games" link, a GM navigates to a page that lists every game they own regardless of status. This is the escape hatch for finding Paused, Completed, or Cancelled games that are no longer on the dashboard.

**Why this priority**: Useful but orthogonal to the core loop. Most active work happens from the dashboard; the all-games view mainly supports recovery ("where did my Paused campaign go?") and history.

**Independent Test**: A GM with games in multiple statuses visits the "View All Games" page and sees every one of their games, including non-Active ones. Each row offers the same view/delete actions with the same typed-confirmation modal.

**Acceptance Scenarios**:

1. **Given** a GM with games in Active, Paused, and Completed statuses, **When** they click "View All Games" from the dashboard, **Then** they see every one of their games listed, each with its status visible.
2. **Given** a GM on the "View All Games" page with no games at all, **When** the page loads, **Then** they see an empty state that links back to the create-game form (consistent with the dashboard empty state).
3. **Given** a GM on the "View All Games" page, **When** they click the view action on any row, **Then** they land on that game's detail page (same page as from the dashboard).

### Edge Cases

- **Empty dashboard, non-empty all-games**: A GM whose only games are Paused, Cancelled, or Completed sees the dashboard empty state ("no Active games") and reaches their other games via "View All Games". The empty state copy differentiates between "no games at all" and "no Active games" to avoid sending the GM to the create form when they already have games.
- **Status change during edit**: If a GM edits an Active game to any other status, it must immediately disappear from the dashboard table on the next page load. Conversely, editing a Paused game back to Active must make it reappear.
- **Very long title or description**: The dashboard table must remain readable when a GM enters a 120-character title or a multi-paragraph description. Long values are truncated with an ellipsis in the table row; the full text is visible on the view page.
- **Accidental close of delete modal**: Closing the confirmation modal (Escape key, backdrop click, or explicit cancel) must cancel the delete without side effects. Closing it after the confirm button has been clicked (but before the request completes) must not double-delete or leave the modal in an inconsistent state.
- **Deleting the last game**: After deleting the last (or last Active) game, the GM sees the same empty state they would see as a new user — not an awkward "table with zero rows" UI.
- **Guessed URL for another GM's game**: Direct navigation to another GM's game detail or edit URL must not reveal any data; the response must be a not-found or forbidden message identical for both "does not exist" and "exists but belongs to someone else" (to avoid leaking existence).
- **Concurrent edits**: If a GM edits the same game in two tabs, the second save overwrites the first. A warning about lost changes is out of scope for v1.
- **Slow network during save or delete**: The GM sees a loading indicator on the submit button and cannot double-submit. On failure, they see an error message and can retry without losing their form input.

## Requirements *(mandatory)*

### Functional Requirements

#### Creating games

- **FR-001**: Signed-in GMs MUST be able to register a new game via a dedicated create-game form reached from the dashboard (primary button) or the all-games empty state.
- **FR-002**: The create form MUST capture a title, a description, and a status chosen from the closed set `{Active, Paused, Cancelled, Completed}`. A missing title MUST fail validation with an inline error and preserve the rest of the form's input.
- **FR-003**: A newly created game MUST be owned by the GM who created it. No other user MUST be able to read, edit, or delete it.
- **FR-004**: After a successful create, the GM MUST be returned to the dashboard. If the new game's status is Active, it MUST appear in the "My Active Games" table on that dashboard load.

#### Dashboard and active-games table

- **FR-005**: The dashboard MUST display a section titled "My Active Games" that lists only the signed-in GM's games whose status is Active. Games with any other status MUST NOT appear in this table.
- **FR-006**: The "My Active Games" section header MUST show the title "My Active Games" on the left and, on the right, a primary action to create a new game plus a link to the "View All Games" page.
- **FR-007**: Each row in the "My Active Games" table MUST show at minimum the game's title, description, and a set of actions containing exactly "view" and "delete".
- **FR-008**: When the signed-in GM has no Active games, the "My Active Games" section MUST display an empty state that (a) clearly conveys that no Active games exist, and (b) contains a call-to-action linking to the create-game form. If the GM has zero games of any status, the empty-state copy MUST encourage them to create their first game. If the GM has non-Active games, the empty-state copy MUST point them to "View All Games" as well as offering to create a new one.

#### Viewing a game

- **FR-009**: The view action on any game row MUST take the GM to a detail page that displays the game's title, description, and status.
- **FR-010**: The detail page MUST offer exactly two actions for the GM: edit and delete.
- **FR-011**: A GM attempting to access the detail page for a game they do not own MUST receive a response indistinguishable from a non-existent game (single "not found" response).

#### Editing a game

- **FR-012**: The edit action on a game MUST take the GM to a form with all current field values pre-filled.
- **FR-013**: The edit form's visual layout MUST mirror the detail page's layout for the fields they share: same field order, same labels, and comparable positioning, so that toggling from view to edit does not produce a visibly jarring shift in field positions.
- **FR-014**: Validation rules for editing MUST match those for creating (e.g., a missing title fails). On success the GM MUST be returned to the detail page showing the updated values.
- **FR-015**: A GM attempting to edit a game they do not own MUST receive the same not-found response described in FR-011 and MUST NOT be able to submit changes.

#### Deleting a game

- **FR-016**: Every delete action (from the dashboard row, the detail page, or the all-games list) MUST open a confirmation modal identifying the game being deleted and requiring the GM to type the confirmation code `delete` before the confirm button is enabled.
- **FR-017**: The confirm button MUST remain disabled until the typed value exactly matches `delete` (case-sensitive, no leading or trailing whitespace trimmed from the comparison). The GM MUST be able to dismiss the modal via cancel, Escape, or a backdrop click and the game MUST remain unchanged.
- **FR-018**: A successful delete from the detail page MUST return the GM to the dashboard. A successful delete from the dashboard or all-games list MUST leave the GM on that same page with the deleted row removed.
- **FR-019**: The GM MUST NOT be able to delete a game they do not own. Any such attempt MUST receive the same not-found response as FR-011.

#### All-games view

- **FR-020**: The "View All Games" link MUST take the GM to a page listing every game they own regardless of status, with the status visible on each row and actions containing view and delete.
- **FR-021**: The all-games page MUST show the same empty-state pattern as the dashboard when the GM has no games of any status.

#### Cross-cutting

- **FR-022**: All create, edit, and delete operations MUST provide visible progress feedback while the request is in flight (loading state on the submit/confirm button) and MUST surface errors (e.g., network failure, validation mismatch) with a message that does not discard the GM's input.
- **FR-023**: All forms and navigation MUST preserve the project's route-change accessibility contract: each distinct page has a focusable heading that receives focus on arrival, and status announcements (toast or live region) reach assistive technologies.

### Key Entities

- **Game**: A registered game night context owned by one GM. Carries a human-readable title, a free-form description (multi-line text, optional), and a status from the closed set `{Active, Paused, Cancelled, Completed}`. Each game belongs to exactly one GM (its owner) and is visible only to that owner in this feature's surfaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A GM can go from an empty dashboard to seeing their first game listed in "My Active Games" in under 60 seconds of interaction time, including reading labels.
- **SC-002**: 100% of deletions are gated by the typed-confirmation modal. Measured by spot-checking the delete surfaces (dashboard row, detail page, all-games row) for modal presence and code-match behaviour.
- **SC-003**: On a dashboard load with 50 Active games, the GM sees the full list in under 2 seconds of page-ready time on a standard desktop connection.
- **SC-004**: When a GM toggles from the detail page to the edit form for the same game, no field position shifts by more than a small visual offset relative to the page (title, description, and status labels stay in the same region). Verified by side-by-side comparison.
- **SC-005**: Zero cross-tenant data exposure: no GM can reach another GM's game via a direct URL. Verified by an end-to-end test that attempts direct navigation with a known other-owner game ID and asserts a not-found response.
- **SC-006**: Users who land on the dashboard empty state successfully create their first game on the first attempt in at least 9 out of 10 observed sessions (measured via usability testing or funnel analytics).
- **SC-007**: Accidental deletions (GM deletes the wrong game) occur in fewer than 1% of delete events, measured by undo requests, support tickets, or re-creations within 60 seconds of a delete.

## Assumptions

- **Auth and ownership**: The feature assumes the existing SPA authentication flow is in place. "Signed-in GM" means the currently authenticated user; games belong to the user who created them and only that user's games are visible in this feature's surfaces. Collaboration and sharing are out of scope for v1.
- **Status is freely editable**: A GM can change a game's status to any of the four values at any time. There is no enforced lifecycle (e.g., no rule that Completed games cannot return to Active). The data supports any transition.
- **Field lengths**: Title is limited to 120 characters. Description is limited to 2,000 characters. These are soft guardrails with inline counters; the limits were not specified by the user and can be revisited in planning.
- **No soft-delete**: Delete is permanent for v1. An archive or restore workflow is out of scope; the Cancelled and Completed statuses are the recommended way to retain a record of a finished or abandoned game.
- **Pagination**: The dashboard and all-games views present games as a simple list. Pagination and search/filter are deferred to a future increment; the performance target (SC-003) assumes a normal-sized personal library of at most a few dozen games.
- **Sort order**: Both the dashboard "My Active Games" table and the "View All Games" page default to showing most-recently-updated games first. No user-selectable sort in v1.
- **Confirmation code**: The literal string `delete` is used as the typed-confirmation code for every delete (consistent across the dashboard, detail page, and all-games list). Copy may be localized later; the code itself is treated as an English keyword in v1 to match the user's request.
- **Empty-state copy differentiation**: The dashboard empty state distinguishes between "you have no games at all" and "you have no Active games" — both link to the create form, but the latter also points to "View All Games".
- **Accessibility**: Inherits the project's existing WCAG 2.2 AA commitments and route-change focus contract. All new forms, modals, and tables comply.
- **Platform**: The feature is delivered in the React SPA. Phoenix LiveView is not used for any user-facing game management surface in this feature.
