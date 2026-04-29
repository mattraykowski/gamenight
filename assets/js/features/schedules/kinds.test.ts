import { describe, expect, it } from "vitest";

import {
  AVAILABILITY_CYCLE,
  AVAILABILITY_STATUSES,
  FINAL_CYCLE,
  FINAL_NOTE_KINDS,
  FINAL_STATUSES,
  PARTICIPANT_DAY_STATUSES,
  SCHEDULE_STATUSES,
} from "./kinds";

describe("Schedule kind enums (T016)", () => {
  it("schedule statuses match the Ash resource constraint", () => {
    expect(SCHEDULE_STATUSES).toEqual([
      "preparing",
      "ready_for_availability",
      "posted",
    ]);
  });

  it("availability statuses match the GM/player input set", () => {
    expect(AVAILABILITY_STATUSES).toEqual(["NA", "I", "A", "IF"]);
  });

  it("participant-day statuses include NP for late joiners", () => {
    expect(PARTICIPANT_DAY_STATUSES).toEqual(["NA", "I", "A", "IF", "NP"]);
  });

  it("final statuses are limited to NA and A (FR-027)", () => {
    expect(FINAL_STATUSES).toEqual(["NA", "A"]);
  });

  it("final-note kinds are the five classification atoms", () => {
    expect(FINAL_NOTE_KINDS).toEqual([
      "good_day",
      "maybe",
      "maybe_with_if",
      "host_unavailable",
      "bad_day",
    ]);
  });

  it("availability cycle is NA → I → A → IF (FR-009/020)", () => {
    expect(AVAILABILITY_CYCLE).toEqual(["NA", "I", "A", "IF"]);
  });

  it("final cycle is NA ↔ A (FR-027)", () => {
    expect(FINAL_CYCLE).toEqual(["NA", "A"]);
  });
});
