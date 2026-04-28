import { describe, expect, it } from "vitest";

import {
  classifyFinalNote,
  finalNoteLabel,
} from "./final-note";
import type { AvailabilityStatus } from "./kinds";
import truthTable from "./__fixtures__/final-note-truth-table.json";

interface TruthRow {
  name: string;
  gm: AvailabilityStatus;
  participants: AvailabilityStatus[];
  if_player_names: string[];
  expected_kind: "good_day" | "maybe" | "maybe_with_if" | "bad_day";
  expected_label: string;
}

describe("classifyFinalNote / finalNoteLabel (T091)", () => {
  for (const row of truthTable.rows as TruthRow[]) {
    it(row.name, () => {
      const result = classifyFinalNote(
        row.gm,
        row.participants,
        row.if_player_names,
      );
      expect(result.kind).toBe(row.expected_kind);
      expect(finalNoteLabel(result)).toBe(row.expected_label);
    });
  }
});
