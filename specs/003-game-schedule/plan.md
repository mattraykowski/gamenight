# Implementation Plan: Game Schedule

**Branch**: `003-game-schedule` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-game-schedule/spec.md`

## Summary

Add a new `GameNight.Schedules` Ash domain with four resources — `Schedule`, `ScheduleDay`, `ScheduleParticipant`, `ParticipantDay` — that model month-aligned scheduling for an existing `GameNight.Games.Game`. The schedule's display name (e.g. `October 2026 7:00 PM – 11:00 PM`) is **derived** via an Ash `calculate` expression, not a stored column, per the user's directive: derived presentation values live as `calculate` blocks on the resource so they participate in JSON:API/RPC payloads, are testable, and stay drift-free with the underlying month/year/time-slot fields. The same approach is applied to the per-day "Final Note" classification (`:good_day | :maybe | :maybe_with_if | :host_unavailable | :bad_day`) on `ScheduleDay`.

The frontend gains a custom **desktop-planner-style month calendar** (`<MonthCalendar>`) used for the GM's preparation view and the player's availability view — week-row × day-cell grid with leading/trailing month spacers, click-to-cycle status on each interactive cell, GM-NA cells visibly grayed for players. The "Scheduling View" used to compute the Final column is intentionally a different shape — a `<DayMatrixTable>` (one row per day, columns: Final | per-player … | Final Note) — because aggregating per-day input across players is a tabular task. This split is explicit per the user's directive that only the final scheduling stage looks like a table.

Notifications use the polymorphic `GameNight.Notifications.Notification` resource shipped in feature 002 with two new `kind` values (`schedule_ready_for_availability`, `schedule_posted`, `schedule_updated`, `schedule_reminder`) and the existing Swoosh sender pipeline, mirroring the `SendInvitationEmail` pattern. All work proceeds TDD per the constitution; each of the spec's nine user stories is delivered as an independently testable tracer-bullet phase.

## Technical Context

**Language/Version**: Elixir ~> 1.15 (backend), TypeScript 5.7 / React 19 (frontend). Constitutional baseline.
**Primary Dependencies**: `ash ~> 3.0`, `ash_postgres`, `ash_json_api`, `ash_authentication`, `ash_typescript`, `open_api_spex`, `swoosh`, Phoenix ~> 1.8, Bandit. Frontend: TanStack Router/Query, React Hook Form + Zod, Shadcn primitives (existing — `dialog`, `dropdown-menu`, `popover`, `badge`, `select` already added in feature 002; **no new Shadcn primitives anticipated** — the month grid is a bespoke component using only Tailwind + existing button/badge primitives because react-day-picker's date-picker mental model does not match click-to-cycle availability), MSW, Playwright. **No new top-level dependencies anticipated** — schedule notifications ride existing `GameNight.Notifications` and `GameNight.Mailer`.
**Storage**: PostgreSQL via `ash_postgres`. Four new tables: `schedules`, `schedule_days`, `schedule_participants`, `participant_days`. The schedule's display name and per-day Final Note classification are not stored — they are Ash calculations resolved at query time.
**Testing**: ExUnit (resource, action, policy, JSON:API request, RPC binding tests). Each new action has authorized + unauthorized + anonymous cases per constitution. Calculation tests for `Schedule.name` and `ScheduleDay.final_note_kind`. State-machine tests for the `preparing → ready_for_availability → posted` transitions including the GM-mid-flow-NA cascade and the late-joiner `np_only` linkage. Vitest + RTL + `vitest-axe` for components/hooks (the `<MonthCalendar>` gets a dedicated keyboard-navigation test). Playwright + `@axe-core/playwright` for E2E with the existing `TestMailboxController` reused to assert schedule emails. No direct `Ecto.Repo` writes anywhere.
**Target Platform**: Linux server (Phoenix/Bandit); SPA in latest-2 stable desktop and mobile browsers per constitution.
**Project Type**: Web application (Elixir/Phoenix backend + React SPA under `assets/`).
**Performance Goals**: A typical schedule has ≤ 31 days × ≤ 8 participants = ≤ 248 `ParticipantDay` rows. The Scheduling View loads in one round-trip (`Schedule` + `schedule_days` + `participants` + `participant_days`) and renders within 1 s on a standard desktop connection. Read actions p95 ≤ 200 ms. `Schedule.transition_to_ready_for_availability` and `Schedule.post` are budgeted ≤ 400 ms p95 because they fan out to insert participants/days and enqueue notifications + emails (email send is async via Swoosh adapter on production; sync local-mailbox in test). `ParticipantDay.set_status` ≤ 100 ms p95.
**Constraints**: Bundle delta ≤ 60 KB gzipped across the new routes combined (each route chunk lazy-loaded). Deny-by-default policies on every action. Cross-game leakage is the chief risk — every Schedule action policy bottoms out on `schedule.game.owner_id == ^actor(:id)` (GM) or `exists(schedule.participants, player.user_id == ^actor(:id))` (linked player) and is policy-tested in both directions. The GM-NA-cascade rule (FR-011) MUST be enforced atomically via a single Ash multitenant-safe transaction so a player cannot observe a partial cascade.
**Scale/Scope**: 4 new Ash resources + 1 new Ash domain (`GameNight.Schedules`) + 1 expanded resource (`Notification` gains four `kind` constants). ~22 actions across the new resources. 4 new SPA routes (`/games/$gameId/schedules/$scheduleId`, `/games/$gameId/schedules`, `/characters/$id`, `/characters/$id/schedules/$scheduleId`) + 2 updated routes (`/games/$id` schedule table, `/dashboard` My Characters character-link target). 9 user stories, 47 functional requirements, 11 success criteria. Approximately 4 weeks of focused TDD work across 9 phases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First Development (NON-NEGOTIABLE)**: **PASS**.
  - ExUnit: action + policy tests for `GameNight.Schedules.Schedule`, `ScheduleDay`, `ScheduleParticipant`, `ParticipantDay` (each action has authorized, unauthorized, and anonymous cases per constitution). Dedicated tests for: the `Schedule.name` calculation (asserts month/year/time-slot composition for am/pm and midnight-crossing slots); the `ScheduleDay.final_note_kind` calculation (one test per branch: good day, maybe, maybe_with_if, bad day, including the < 5 participant edge case); the `transition_to_ready_for_availability` action (creates exactly one `ScheduleParticipant` per accepted Player; emits notifications + emails; idempotent under retry); the `post` action (treats blank Final values as NA; emits notifications + emails; flips submissions read-only); the `update_gm_day` action's NA-cascade (asserts every linked `ParticipantDay` for the same day is overwritten to NA inside one transaction); the `add_late_joiner` flow (post-state schedules get `np_only: true` participants whose every day is NP); the typed-`delete` confirmation policy (asserts the Ash action does **not** delete without the `confirmation: "delete"` argument and cascades on success).
  - Vitest: colocated tests for the new `<MonthCalendar>`, `<DayMatrixTable>`, `<ScheduleStatusBadge>`, `<InitiateScheduleDialog>`, `<DeleteScheduleDialog>`, `<SchedulesTable>`, plus each new feature hook (`useScheduleForCalendar`, `useSetGmDay`, `useSetParticipantDay`, `useTransitionScheduleToReady`, `usePostSchedule`, `useUpdatePostedSchedule`, `useDeleteSchedule`, `useSendReminder`). The `<MonthCalendar>` test must include keyboard navigation (arrow keys move focus across cells; Enter cycles status), aria-roving-tabindex correctness, and `expectNoAxeViolations`.
  - Playwright: one E2E spec per priority-bearing story (US1 GM initiates + sets availability, US2 ready-for-availability triggers email + bell, US3 player marks availability, US4 GM posts via Scheduling View, US6 GM submission tracking + reminder, US8 typed-`delete` deletion). US7 update-and-notify and US9 NP-late-joiner share specs with US4 and US2 respectively. The new-user-late-join spec exercises the real `TestMailboxController` to verify schedule emails.
  - Every commit that introduces behaviour ships its failing test first per `/tdd` skill procedure. No scaffolding-only commits.

- **II. Security & Authorization by Default (NON-NEGOTIABLE)**: **PASS**.
  - **New resources** (all deny-by-default; see [data-model.md](./data-model.md) for the full action × policy matrix):
    - `Schedule`: `:initiate`, `:set_gm_day`, `:list_for_game`, `:get_for_game`, `:transition_to_ready_for_availability`, `:post`, `:update_final_days`, `:update_final_days_and_notify`, `:delete` admit only `game.owner_id == ^actor(:id)`. `:list_for_player_character` and `:get_for_player_character` admit `exists(participants, player.user_id == ^actor(:id))` with a separate filter that excludes `preparing` schedules from any non-GM read. Player removal does not cascade to `ScheduleParticipant` via the FK (`player_id` is `ON DELETE RESTRICT`); the cascade is performed by a `Player.destroy` `before_action` that branches on `schedule.status` — see [research.md §6](./research.md) and [data-model.md §ScheduleParticipant Player-removal handling](./data-model.md).
    - `ScheduleDay`: `:set_gm_status` is delegated to from `Schedule.set_gm_day` and admits only the GM. Reads ride the parent `Schedule` policies (no independent `:list` action exposed).
    - `ScheduleParticipant`: `:list_for_schedule` admits the GM and the participant; `:send_reminder` admits only the GM.
    - `ParticipantDay`: `:set_status` admits only the actor whose `participant.player.user_id == ^actor(:id)` AND the parent schedule is `ready_for_availability` (not `preparing` and not `posted`). Reads ride the parent participant policies.
  - **System actions**: the cascade flows (link participants on transition, overwrite NA on GM-NA cascade, mark every day NP on late-joiner-after-post, materialise notifications, enqueue emails) execute as `system` actions inside `GameNight.Schedules.System`, a clearly named internal context with a top-of-module `@moduledoc` comment justifying the policy bypass and listing every entry point. Existing pattern from `GameNight.Notifications.System`.
  - **Trust boundaries**: every action's `accept` list is restricted to user-mutable attributes (`month`, `year`, `start_time`, `end_time`, `time_zone` on `:initiate`; `status` on day-toggle actions; `confirmation` on delete; `final_status` on post and update). `String.to_atom/1` is not used on input — statuses go through `Ash.Type.Atom` constraints. Month/year are validated as integers with bounds.
  - **No direct Repo access**: every read and write goes through Ash code interfaces on `GameNight.Schedules` or `GameNight.Notifications`. No exceptions.
  - **CI security gates**: Trivy / Sobelow / mix_audit / npm audit / gitleaks all run on every PR per constitution; no new dependencies expected. Sobelow `--strict` reads the new email senders for HTML-injection patterns — schedule emails reuse the same template helpers as the magic-link and invitation senders.
  - **Token & session storage**: unchanged from feature 002; this feature introduces no new auth flows.

- **III. API Contract via JSON:API (NON-NEGOTIABLE)**: **PASS**.
  - All four new resources declare `json_api do … end` blocks. Schedule exposes `:initiate`, `:list_for_game`, `:get_for_game`, `:list_for_player_character`, `:get_for_player_character`, `:set_gm_day`, `:transition_to_ready_for_availability`, `:post`, `:update_final_days`, `:update_final_days_and_notify`, `:delete`. ScheduleParticipant exposes `:list_for_schedule`, `:send_reminder`. ParticipantDay exposes `:set_status`. ScheduleDay's mutations are routed through Schedule actions (no public `ScheduleDay` mutation surface), but it has a public read so the Scheduling View can include `:schedule_days` as a relationship.
  - The new domain is registered in `GameNightWeb.AshJsonApiRouter` (`domains: [GameNight.Telemetry, GameNight.Games, GameNight.Notifications, GameNight.Schedules]`).
  - `open_api_spex` regenerates and the spec is committed; the drift gate catches any divergence.
  - `AshTypescript.Rpc` regenerates typed client functions; the SPA consumes the RPC surface via `createResourceHooks`-style feature hooks at `assets/js/features/schedules/hooks.ts`.
  - `mix ash.codegen --check` and the `ash_typescript.codegen` drift gate run on every PR.
  - Pure-SPA boundary unchanged: no RSC, no SSR.

- **IV. Accessibility — WCAG 2.2 AA (NON-NEGOTIABLE)**: **PASS**.
  - Four new SPA routes (`/games/$gameId/schedules`, `/games/$gameId/schedules/$scheduleId`, `/characters/$id`, `/characters/$id/schedules/$scheduleId`) each render a `<h1 data-route-heading>` consumed by `useFocusOnRouteChange`. Route-change announcements use the shared `A11yAnnouncer`.
  - `axe-core` runs against each route in Playwright and against each component test in Vitest (via `expectNoAxeViolations`).
  - **The `<MonthCalendar>` is the highest-risk a11y component in this feature** and gets dedicated treatment: roving-tabindex across day cells, arrow-key navigation (Up/Down move ±7 days, Left/Right ±1 day), Enter/Space cycles status, aria-label on each cell describing the date and current status (`October 5, 2026, Available`), focus visible per Tailwind ring tokens, NA-locked cells render with `aria-disabled="true"` and are skipped by arrow nav. Status changes trigger an `aria-live="polite"` announcement.
  - The `<DayMatrixTable>` (Scheduling View) uses native `<table>`/`<thead>`/`<tbody>` markup with `<th scope="row">` per day and `<th scope="col">` per participant. The Final column toggle is a `<button>` with explicit `aria-label="Final availability for October 5: Available, click to change to Not Available"`. Final Note cells use `aria-describedby` to attach the human-readable classification ("Maybe, talk to Anne") to the row.
  - WCAG 2.2 new AA criteria: (2.4.11) the calendar's focus ring is never obscured by the sticky navbar (verified at the route level); (2.5.7) no drag interactions — explicitly the user's directive that the calendar styles like a desktop planner does **not** introduce drag, only click/keyboard cycle; (2.5.8) every interactive cell is ≥ 44 × 44 CSS px on desktop and ≥ 44 × 44 on mobile (the planner aesthetic affords generous cells). The Final-toggle button in the Scheduling View is sized to ≥ 32 × 24 (well above the 24 × 24 floor).
  - Per-release manual audit covers each new route and the calendar/table interactions (keyboard, screen reader, contrast — note that the Final Note's red/yellow/green backgrounds need a non-color cue: each cell prepends an icon or text label so the classification is conveyed without color).

- **V. UX for Non-Technical Operators**: **PASS**.
  - Every form has explicit loading, empty, and error states. The View Game schedules table has a discriminated empty state ("No schedules yet — initiate one to plan a game night"). The player's character view has an empty state when no schedules exist.
  - Destructive actions: deletion uses the typed-confirmation `<Dialog>` from feature 001 (typing `delete` confirms). Post Schedule shows a soft confirm — "Posting will lock player edits and send notifications. Continue?" — but does not require typed input because it is reversible via Update.
  - Error messages in plain language: "There's already a schedule for October 2026. Delete it first to start over." rather than constraint-name leakage. The "schedule month is in the past" path reads "You can only schedule the current month or later." with the GM's effective timezone shown.
  - Forms use Shadcn's `<Form>` + `FormField`/`FormMessage` with `mode: "onTouched"` validation. The month/year/time-slot picker on `<InitiateScheduleDialog>` uses native `<input type="month">` and `<input type="time">` for the broadest accessibility.
  - Toast feedback for schedule-initiated / ready-for-availability / posted / updated / deleted / reminder-sent rides the existing `TOAST_MESSAGES` whitelist, extended with the new keys.
  - Copy review: avoid "schedule resource", "preparing state". Use "draft", "ready for availability", "posted".

- **VI. Performance Discipline**: **PASS**.
  - New route chunks are lazy-loaded; total delta ≤ 60 KB gzipped. The `size-limit` config gains entries for `/games/$gameId/schedules/$scheduleId` (≤ 22 KB — includes the bespoke MonthCalendar + DayMatrixTable), `/games/$gameId/schedules` (≤ 8 KB), `/characters/$id` (≤ 12 KB), `/characters/$id/schedules/$scheduleId` (≤ 16 KB — MonthCalendar only).
  - Ash actions emit `:telemetry` automatically. Hot reads:
    - `Schedule.list_for_game` (View Game schedule table) — composite index `schedules(game_id, year DESC, month DESC)`.
    - `Schedule.get_for_game` with `schedule_days`, `participants`, `participant_days` loaded — composite indexes `schedule_days(schedule_id, day)`, `schedule_participants(schedule_id, player_id)`, `participant_days(participant_id, day)`.
    - `ScheduleParticipant.list_for_schedule` — `schedule_participants(schedule_id, submitted_at, joined_at)`.
    - `Schedule.list_for_player_character` — `schedule_participants(player_id, schedule_id)` plus filter on `schedules.status != :preparing`.
  - Backend p95 budget: read actions ≤ 200 ms; transition + post + update-and-notify ≤ 400 ms; `set_status` (single-cell click) ≤ 100 ms.
  - Lighthouse CI runs against `/games/$id`, `/games/$gameId/schedules/$scheduleId`, and `/characters/$id/schedules/$scheduleId` on every PR.

All six principles pass. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-game-schedule/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── json-api.md      # JSON:API surface for Schedule, ScheduleDay, ScheduleParticipant, ParticipantDay
│   └── rpc.md           # ash_typescript RPC surface (SPA-facing)
├── checklists/
│   └── requirements.md  # Produced by /speckit.specify
└── tasks.md             # Produced by /speckit.tasks (later)
```

### Source Code (repository root)

```text
lib/
├── game_night/
│   ├── schedules.ex                                # NEW: Ash domain (AshJsonApi + AshTypescript.Rpc)
│   ├── schedules/
│   │   ├── schedule.ex                             # NEW: month/year/time-slot/timezone/status; calculate :name
│   │   ├── schedule_day.ex                         # NEW: per (schedule, day) gm_status + final_status; calculate :final_note_kind
│   │   ├── schedule_participant.ex                 # NEW: per (schedule, player) submitted_at + joined_at + np_only?
│   │   ├── participant_day.ex                      # NEW: per (participant, day) status (NA/I/A/IF/NP)
│   │   ├── system.ex                               # NEW: internal context for cascade/transition flows; bypassed policies justified in @moduledoc
│   │   ├── changes/
│   │   │   ├── cascade_gm_na.ex                    # NEW: Ash change — when gm_status flips to NA, set every linked participant_day for that day to NA
│   │   │   ├── link_active_players.ex              # NEW: Ash change — on transition_to_ready_for_availability, create ScheduleParticipant per accepted Player
│   │   │   ├── mark_days_np.ex                     # NEW: Ash change — on add_late_joiner against a posted schedule, default every participant_day to NP
│   │   │   └── compute_final_default.ex            # NEW: Ash change — on Scheduling View load, pre-fill ScheduleDay.final_status when null
│   │   ├── calculations/
│   │   │   ├── name.ex                             # NEW: Ash calculation module — Schedule.name from month/year/start_time/end_time
│   │   │   └── final_note_kind.ex                  # NEW: Ash calculation module — ScheduleDay.final_note_kind from gm_status + participant_days
│   │   └── senders/
│   │       ├── send_schedule_ready_email.ex        # NEW: Swoosh sender (mirrors SendInvitationEmail)
│   │       ├── send_schedule_posted_email.ex       # NEW
│   │       ├── send_schedule_updated_email.ex      # NEW
│   │       └── send_schedule_reminder_email.ex     # NEW
│   ├── notifications/
│   │   └── notification.ex                         # UPDATED: extend kind enum with :schedule_ready_for_availability, :schedule_posted, :schedule_updated, :schedule_reminder
│   └── games/
│       └── game.ex                                 # UPDATED: has_many :schedules
└── game_night_web/
    └── ash_json_api_router.ex                      # UPDATED: add GameNight.Schedules to :domains

priv/
├── repo/migrations/
│   └── <ts>_create_schedule_resources.exs          # NEW (mix ash.codegen) — schedules, schedule_days, schedule_participants, participant_days; FK order matters
└── resource_snapshots/
    └── repo/
        ├── schedules/                              # NEW
        ├── schedule_days/                          # NEW
        ├── schedule_participants/                  # NEW
        └── participant_days/                       # NEW

test/
├── game_night/
│   ├── schedules/
│   │   ├── schedule_test.exs                       # NEW (initiate, list, get, transition, post, update, delete, name calculation)
│   │   ├── schedule_day_test.exs                   # NEW (set_gm_status + cascade + final_note_kind calculation)
│   │   ├── schedule_participant_test.exs           # NEW (link on transition, late join NP, send_reminder)
│   │   ├── participant_day_test.exs                # NEW (set_status, locked-when-not-ready, np-cells-not-editable)
│   │   └── system_test.exs                         # NEW (cascade flows isolated from policies)
│   └── notifications/
│       └── notification_test.exs                   # UPDATED: cover the four new schedule kinds
└── game_night_web/
    └── controllers/
        ├── schedules_request_test.exs              # NEW (JSON:API surface)
        └── participant_days_request_test.exs       # NEW (JSON:API surface)

assets/
├── js/
│   ├── ash_rpc.ts                                  # REGENERATED by ash_typescript.codegen
│   ├── ash_types.ts                                # REGENERATED
│   ├── components/
│   │   └── ui/
│   │       └── (no new shadcn primitives)
│   ├── features/
│   │   ├── schedules/
│   │   │   ├── hooks.ts                            # NEW: useListSchedulesForGame, useGetScheduleForGame, useGetScheduleForCharacter, useInitiateSchedule, useSetGmDay, useTransitionScheduleToReady, usePostSchedule, useUpdatePostedSchedule, useDeleteSchedule, useSetParticipantDay, useSendReminder, useListSchedulesForCharacter
│   │   │   ├── hooks.test.ts
│   │   │   ├── kinds.ts                            # NEW: status/availability/final-note enums shared between calendar + table
│   │   │   ├── final-note.ts                       # NEW: pure-fn computeFinalNote(gmStatus, participantStatuses) → {kind, label, tone} mirroring Schedules.Calculations.FinalNoteKind for fast UI computation; one ExUnit-equivalent vitest unit-test file
│   │   │   ├── final-note.test.ts
│   │   │   ├── components/
│   │   │   │   ├── month-calendar.tsx              # NEW: bespoke desktop-planner month grid; click-to-cycle; arrow-key roving-tabindex; aria-live announcements; locked NA cells; per-cell status visualization
│   │   │   │   ├── month-calendar.test.tsx
│   │   │   │   ├── day-matrix-table.tsx            # NEW: Scheduling View table — Final | per-participant | Final Note
│   │   │   │   ├── day-matrix-table.test.tsx
│   │   │   │   ├── schedule-status-badge.tsx       # NEW: pill for schedule.status
│   │   │   │   ├── schedule-status-badge.test.tsx
│   │   │   │   ├── schedules-table.tsx             # NEW: View Game schedules table (top 6 + view-all link)
│   │   │   │   ├── schedules-table.test.tsx
│   │   │   │   ├── initiate-schedule-dialog.tsx    # NEW: month/year/time-slot picker
│   │   │   │   ├── initiate-schedule-dialog.test.tsx
│   │   │   │   ├── delete-schedule-dialog.tsx      # NEW: typed-`delete` confirmation
│   │   │   │   ├── delete-schedule-dialog.test.tsx
│   │   │   │   ├── post-schedule-dialog.tsx        # NEW: soft confirm
│   │   │   │   ├── post-schedule-dialog.test.tsx
│   │   │   │   ├── update-posted-schedule-buttons.tsx  # NEW: dual-button row for Update vs Update-and-Notify
│   │   │   │   ├── update-posted-schedule-buttons.test.tsx
│   │   │   │   ├── send-reminder-button.tsx        # NEW: per-participant reminder button on Schedule Detail
│   │   │   │   └── send-reminder-button.test.tsx
│   │   │   └── schemas.ts                          # NEW: shared Zod for month/year/time-slot
│   │   └── notifications/
│   │       └── kinds.ts                            # UPDATED: extend discriminated union with the four new schedule kinds
│   └── routes/
│       ├── games.$id.index.tsx                     # UPDATED: render <SchedulesTable> with top-6 + Initiate button + view-all link
│       ├── games.$id.index.test.tsx                # UPDATED
│       ├── games.$gameId.schedules.index.tsx       # NEW: full schedules list (View All)
│       ├── games.$gameId.schedules.index.test.tsx
│       ├── games.$gameId.schedules.$scheduleId.tsx # NEW: GM Schedule Detail (calendar at top + roster below + scheduling-view link + delete + transition buttons)
│       ├── games.$gameId.schedules.$scheduleId.test.tsx
│       ├── games.$gameId.schedules.$scheduleId.scheduling.tsx       # NEW: Scheduling View (DayMatrixTable + Post / Update buttons)
│       ├── games.$gameId.schedules.$scheduleId.scheduling.test.tsx
│       ├── characters.$id.tsx                      # NEW: per-character "View Game" page (player-side)
│       ├── characters.$id.test.tsx
│       ├── characters.$id.schedules.$scheduleId.tsx                 # NEW: player Schedule view (MonthCalendar with NA-locked cells)
│       └── characters.$id.schedules.$scheduleId.test.tsx
└── e2e/
    ├── schedule-initiate.spec.ts                   # NEW: US1
    ├── schedule-ready-for-availability.spec.ts     # NEW: US2 (TestMailboxController + bell)
    ├── schedule-player-availability.spec.ts        # NEW: US3
    ├── schedule-post.spec.ts                       # NEW: US4 (also exercises US7 update + US9 NP rendering for a late joiner)
    ├── schedule-gm-tracking.spec.ts                # NEW: US6 (reminder)
    └── schedule-delete.spec.ts                     # NEW: US8 (typed-`delete`)
```

**Structure Decision**: Web-application layout (existing pattern preserved). New backend files live under a new `GameNight.Schedules` domain — Schedule has four cooperating resources, multiple cascade flows, and four notification kinds, which is sufficient bounded concern to justify a dedicated domain (matches the precedent set by feature 002 splitting `Notifications` out for the same reason). Frontend files follow feature-folder conventions established by feature 002: one feature folder per concern, colocated Vitest tests, route files named to match URL segments. The bespoke `<MonthCalendar>` lives in `features/schedules/components` because it is conceptually a feature primitive, not a reusable UI primitive — feature 002's `<NotificationsBell>` set the same precedent for a feature-specific Shadcn-composed component.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — all six principles pass on the initial check. Two non-default choices are documented in research.md rather than as constitutional violations:

- **Bespoke `<MonthCalendar>` rather than adopting `react-day-picker` via Shadcn's Calendar primitive** — see [research.md §3](./research.md). Rationale: the day-picker's mental model is "select a date or range," not "click each cell to cycle through a four-state availability." The accessibility contract (roving tabindex + arrow-key nav + aria-live status announcement) is identical, but the click semantics differ enough that adapting the primitive costs more than building the grid directly with Tailwind + the existing `<button>` primitive.
- **Final-note classification computed twice — once as an Ash calculation (server) and once as a TS pure function (client)** — see [research.md §4](./research.md). Rationale: the table view in the Scheduling View already loads every participant's day status, so client-side computation is free; the server-side calculation is needed only for the player-side "current/upcoming" widget where a small payload is preferable. The two implementations are kept honest by a shared truth table that drives both an ExUnit test and a Vitest test, asserting identical output across the same input grid.
