import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  classifyFinalNote,
  finalNoteLabel,
  type FinalNoteResult,
} from "../final-note";
import {
  type AvailabilityStatus,
  type FinalNoteKind,
  type FinalStatus,
  type ParticipantDayStatus,
} from "../kinds";

const FINAL_KIND_CLASS: Record<FinalNoteKind, string> = {
  good_day: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maybe: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  maybe_with_if: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  host_unavailable: "bg-muted text-muted-foreground",
  bad_day: "bg-destructive/15 text-destructive",
};

const FINAL_KIND_ICON: Record<FinalNoteKind, string> = {
  good_day: "✓",
  maybe: "⚠",
  maybe_with_if: "⚠",
  host_unavailable: "—",
  bad_day: "✕",
};

const STATUS_LABEL: Record<ParticipantDayStatus, string> = {
  NA: "Not Available",
  I: "Ideal",
  A: "Available",
  IF: "Available If",
  NP: "Not Present",
};

const STATUS_SHORT: Record<ParticipantDayStatus, string> = {
  NA: "NA",
  I: "I",
  A: "A",
  IF: "IF",
  NP: "NP",
};

export interface DayMatrixParticipant {
  id: string;
  characterName: string;
  npOnly: boolean;
}

export interface DayMatrixDay {
  /** Day-of-month (1..31). */
  day: number;
  /** GM's per-day status (only meaningful for the row's classification). */
  gmStatus: AvailabilityStatus;
  /** Current persisted Final value for the day (null = unset; UI shows pre-fill). */
  finalStatus: FinalStatus | null;
  /** Map of participant id → participant's status for this day. */
  participantStatuses: Record<string, ParticipantDayStatus>;
}

export interface DayMatrixTableProps {
  participants: DayMatrixParticipant[];
  days: DayMatrixDay[];
  /** Called when the GM toggles the Final column for a day. */
  onCycleFinal: (day: number, next: FinalStatus) => void;
  /** True while a per-cell Final mutation is in flight (disables clicks). */
  isPending?: boolean;
}

/**
 * Scheduling View matrix — one row per day, columns: Final |
 * per-participant statuses | Final Note. Renders as a real
 * `<table>` so screen readers can navigate it row-by-row /
 * column-by-column. The Final cell button cycles NA ↔ A only
 * (FR-027). Participant columns are read-only.
 */
export function DayMatrixTable({
  participants,
  days,
  onCycleFinal,
  isPending,
}: DayMatrixTableProps) {
  const visibleParticipants = useMemo(
    () => participants.filter((p) => !p.npOnly),
    [participants],
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full caption-bottom text-sm">
        <thead className="bg-muted/50 [&_tr]:border-b">
          <tr>
            <th
              scope="col"
              className="h-10 px-3 text-left align-middle font-medium text-muted-foreground"
            >
              Day
            </th>
            <th
              scope="col"
              className="h-10 px-3 text-left align-middle font-medium text-muted-foreground"
            >
              Final
            </th>
            <th
              scope="col"
              className="h-10 px-3 text-left align-middle font-medium text-muted-foreground"
            >
              Note
            </th>
            {visibleParticipants.map((participant) => (
              <th
                key={participant.id}
                scope="col"
                className="h-10 px-3 text-left align-middle font-medium text-muted-foreground"
              >
                {participant.characterName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {days.map((day) => {
            const allStatuses = visibleParticipants.map(
              (p) => (day.participantStatuses[p.id] ?? "NA") as ParticipantDayStatus,
            );
            const participantStatuses: AvailabilityStatus[] = allStatuses.filter(
              (s): s is AvailabilityStatus => s !== "NP",
            );
            const ifNames = visibleParticipants
              .filter((p) => day.participantStatuses[p.id] === "IF")
              .map((p) => p.characterName);

            const note: FinalNoteResult = classifyFinalNote(
              day.gmStatus,
              participantStatuses,
              ifNames,
            );
            const noteLabel = finalNoteLabel(note);

            // Pre-fill the displayed Final value per the truth-table
            // rule for cells the GM hasn't explicitly set. The
            // server's ComputeFinalDefault will commit this on Post.
            const displayedFinal: FinalStatus =
              day.finalStatus ?? (note.kind === "good_day" ? "A" : "NA");

            return (
              <tr
                key={day.day}
                data-testid={`day-matrix-row-${day.day}`}
                className="border-b hover:bg-muted/20"
              >
                <th
                  scope="row"
                  className="h-12 px-3 text-left align-middle font-medium"
                >
                  {day.day}
                </th>
                <td className="h-12 px-3 align-middle">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    aria-label={`Final availability for day ${day.day}: ${displayedFinal === "A" ? "Available" : "Not Available"}, click to change`}
                    onClick={() =>
                      onCycleFinal(day.day, displayedFinal === "A" ? "NA" : "A")
                    }
                    data-testid={`day-matrix-final-${day.day}`}
                  >
                    {displayedFinal === "A" ? "✓ A" : "✕ NA"}
                  </Button>
                </td>
                <td
                  className={cn(
                    "h-12 px-3 align-middle font-medium",
                    FINAL_KIND_CLASS[note.kind],
                  )}
                  data-testid={`day-matrix-note-${day.day}`}
                >
                  <span aria-hidden="true">{FINAL_KIND_ICON[note.kind]}</span>{" "}
                  {noteLabel}
                </td>
                {visibleParticipants.map((p) => {
                  const status = (day.participantStatuses[p.id] ?? "NA") as ParticipantDayStatus;
                  return (
                    <td
                      key={p.id}
                      className="h-12 px-3 align-middle text-muted-foreground"
                      aria-label={`${p.characterName} on day ${day.day}: ${STATUS_LABEL[status]}`}
                    >
                      {STATUS_SHORT[status]}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
