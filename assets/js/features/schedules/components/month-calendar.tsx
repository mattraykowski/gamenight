import { useCallback, useRef, useState } from "react";

import { CalendarGrid } from "@/components/calendar-grid";
import { cn } from "@/lib/utils";
import type { ParticipantDayStatus } from "../kinds";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const STATUS_LABEL: Record<ParticipantDayStatus, string> = {
  NA: "Not Available",
  I: "Ideal",
  A: "Available",
  IF: "Available If",
  NP: "Not Present",
};

const STATUS_ICON: Record<ParticipantDayStatus, string> = {
  NA: "✕",
  I: "★",
  A: "✓",
  IF: "?",
  NP: "—",
};

const STATUS_CLASS: Record<ParticipantDayStatus, string> = {
  NA: "bg-destructive/10 text-destructive border-destructive/30",
  I: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  IF: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300",
  NP: "bg-muted text-muted-foreground border-muted-foreground/20",
};

export type CalendarMode = "gm-edit" | "player-edit" | "read-only";

export interface DayCell {
  day: number;
  status: ParticipantDayStatus;
  /** Player view — true when the GM marked this day NA; the cell is uninteractive. */
  gmLockedNa?: boolean;
}

export interface MonthCalendarProps {
  year: number;
  month: number;
  cells: DayCell[];
  mode: CalendarMode;
  onCycle?: (day: number) => void;
  ariaLabel: string;
}

/**
 * Per-schedule month calendar. Consumes `<CalendarGrid>` for layout
 * and owns its own keyboard / focus model + status palette.
 */
export function MonthCalendar({
  year,
  month,
  cells,
  mode,
  onCycle,
  ariaLabel,
}: MonthCalendarProps) {
  const monthName = MONTH_NAMES[month - 1] ?? "";
  const daysInMonth = cells.length;

  const [focusedDay, setFocusedDay] = useState<number>(1);
  const cellRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const interactive = mode !== "read-only";

  const isInteractive = useCallback(
    (cell: DayCell) => interactive && !(mode === "player-edit" && cell.gmLockedNa),
    [interactive, mode],
  );

  const focusDay = useCallback((day: number) => {
    const el = cellRefs.current.get(day);
    if (el) {
      el.focus();
      setFocusedDay(day);
    }
  }, []);

  const moveFocus = useCallback(
    (currentDay: number, delta: number) => {
      let next = currentDay + delta;
      while (next >= 1 && next <= daysInMonth) {
        const cell = cells[next - 1];
        if (cell && isInteractive(cell)) {
          focusDay(next);
          return;
        }
        next += delta > 0 ? 1 : -1;
      }
    },
    [cells, daysInMonth, focusDay, isInteractive],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, day: number) => {
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          moveFocus(day, 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveFocus(day, -1);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveFocus(day, 7);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveFocus(day, -7);
          break;
        case "Home":
          event.preventDefault();
          focusDay(1);
          break;
        case "End":
          event.preventDefault();
          focusDay(daysInMonth);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          onCycle?.(day);
          break;
      }
    },
    [moveFocus, focusDay, daysInMonth, onCycle],
  );

  return (
    <CalendarGrid
      year={year}
      month={month}
      ariaLabel={ariaLabel}
      renderCell={(date) => {
        const day = date.getDate();
        const cell = cells[day - 1] ?? { day, status: "NA" as const };
        const interactiveCell = isInteractive(cell);
        const lockedNa = cell.gmLockedNa === true && mode !== "gm-edit";
        const statusLabel = lockedNa
          ? "Host Unavailable"
          : STATUS_LABEL[cell.status];
        const label = `${monthName} ${day}, ${statusLabel}`;

        return (
          <button
            ref={(node) => {
              if (node) cellRefs.current.set(day, node);
              else cellRefs.current.delete(day);
            }}
            role="gridcell"
            type="button"
            tabIndex={day === focusedDay && interactiveCell ? 0 : -1}
            aria-label={label}
            aria-disabled={!interactiveCell ? true : undefined}
            disabled={!interactiveCell && mode !== "read-only"}
            onClick={() => interactiveCell && onCycle?.(day)}
            onKeyDown={(e) => interactiveCell && handleKeyDown(e, day)}
            onFocus={() => setFocusedDay(day)}
            className={cn(
              "flex h-20 flex-col items-start gap-1 border p-2 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              interactiveCell && "hover:brightness-110 cursor-pointer",
              !interactiveCell && "cursor-not-allowed opacity-60",
              lockedNa
                ? "border-muted-foreground/20 bg-muted text-muted-foreground"
                : STATUS_CLASS[cell.status],
            )}
          >
            <span className="text-sm font-semibold">{day}</span>
            <span className="flex items-center gap-1 text-xs">
              <span aria-hidden="true">{STATUS_ICON[cell.status]}</span>
              <span>{statusLabel}</span>
            </span>
          </button>
        );
      }}
    />
  );
}
