// Feature 003 — Game Schedule.
// Status / availability / final-note enums shared between the calendar
// and the day-matrix table. Mirrors the constraints declared on the
// Ash resources (lib/game_night/schedules/*.ex). Kept in sync by
// virtue of being a small surface — see specs/003-game-schedule/
// contracts/rpc.md.

export const SCHEDULE_STATUSES = [
  "preparing",
  "ready_for_availability",
  "posted",
] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const AVAILABILITY_STATUSES = ["NA", "I", "A", "IF"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const PARTICIPANT_DAY_STATUSES = [
  "NA",
  "I",
  "A",
  "IF",
  "NP",
] as const;
export type ParticipantDayStatus = (typeof PARTICIPANT_DAY_STATUSES)[number];

export const FINAL_STATUSES = ["NA", "A"] as const;
export type FinalStatus = (typeof FINAL_STATUSES)[number];

export const FINAL_NOTE_KINDS = [
  "good_day",
  "maybe",
  "maybe_with_if",
  "host_unavailable",
  "bad_day",
] as const;
export type FinalNoteKind = (typeof FINAL_NOTE_KINDS)[number];

// The cycle order for the calendar's click-to-cycle interaction
// (FR-009 GM, FR-020 player). NA → I → A → IF → NA.
export const AVAILABILITY_CYCLE: AvailabilityStatus[] = [
  "NA",
  "I",
  "A",
  "IF",
];

// Final column toggles only between NA and A (FR-027).
export const FINAL_CYCLE: FinalStatus[] = ["NA", "A"];
