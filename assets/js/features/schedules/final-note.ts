// Feature 003 — Game Schedule.
// Pure TS mirror of `GameNight.Schedules.Calculations.FinalNoteKind`.
// Drives the GM Scheduling View's per-day Final Note rendering.
//
// The truth-table fixture at __fixtures__/final-note-truth-table.json
// is byte-equivalent to the Elixir fixture at
// test/support/fixtures/schedule_final_note_fixtures.ex; both
// implementations are tested against the same rows, so any drift
// between server and client classification fails CI.

import type { AvailabilityStatus, FinalNoteKind } from "./kinds";

export interface FinalNoteResult {
  kind: FinalNoteKind;
  /** IF participant names (and "GM" if the GM is :IF). Sorted. */
  ifNames: string[];
}

/** Pure classifier matching FinalNoteKind.classify/3. */
export function classifyFinalNote(
  gm: AvailabilityStatus,
  participants: AvailabilityStatus[],
  ifParticipantNames: string[] = [],
): FinalNoteResult {
  const n = participants.length;
  const threshold = Math.floor(n / 5);
  const naOrIfCount = participants.filter(
    (s) => s === "NA" || s === "IF",
  ).length;
  const hasParticipantIf = participants.some((s) => s === "IF");
  const gmIsIf = gm === "IF";

  if (gm === "NA") {
    return { kind: "bad_day", ifNames: [] };
  }

  if (
    (gm === "I" || gm === "A") &&
    participants.every((s) => s === "I" || s === "A")
  ) {
    return { kind: "good_day", ifNames: [] };
  }

  if (hasParticipantIf || gmIsIf) {
    const names = [...ifParticipantNames];
    if (gmIsIf) names.push("GM");
    names.sort();
    return { kind: "maybe_with_if", ifNames: names };
  }

  if (naOrIfCount > threshold) {
    return { kind: "bad_day", ifNames: [] };
  }

  if (naOrIfCount > 0) {
    return { kind: "maybe", ifNames: [] };
  }

  if (n === 0 && (gm === "I" || gm === "A")) {
    return { kind: "good_day", ifNames: [] };
  }

  return { kind: "bad_day", ifNames: [] };
}

/** Build the human-readable label string for a Final Note. */
export function finalNoteLabel(result: FinalNoteResult): string {
  switch (result.kind) {
    case "good_day":
      return "Good Day";
    case "maybe":
      return "Maybe";
    case "bad_day":
      return "Bad Day";
    case "maybe_with_if":
      return result.ifNames.length > 0
        ? `Maybe, talk to ${result.ifNames.join(", ")}`
        : "Maybe";
  }
}
