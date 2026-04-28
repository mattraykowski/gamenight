import { useCallback, useMemo, useRef, useState } from "react";

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

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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

// Tailwind classes per status — the icon prefix means we satisfy
// WCAG 1.4.1 (Use of Color) without relying on hue alone.
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
  /** Calendar year (e.g. 2026). */
  year: number;
  /** 1-indexed month (1 = January). */
  month: number;
  /** One cell per day in the month, in day order (1..N). */
  cells: DayCell[];
  /** GM edit, player edit, or read-only display. */
  mode: CalendarMode;
  /** Called with the day number when the user clicks/Enter-cycles an interactive cell. */
  onCycle?: (day: number) => void;
  /** Accessible label for the grid (e.g. "October 2026 schedule calendar"). */
  ariaLabel: string;
}

/**
 * Bespoke desktop-planner-style month calendar (T041).
 *
 * Renders a `role="grid"` of seven columns (Sun-first per
 * research.md §3) × N week-rows. Each interactive cell is a
 * `role="gridcell"` button with roving tabindex, arrow-key
 * navigation, and Enter/Space cycling. Locked NA cells (player
 * view, GM-marked NA day) render `aria-disabled` and are skipped
 * by arrow-key focus traversal.
 *
 * Status visualisation pairs a status icon (✓ / ★ / ✕ / ?) with a
 * Tailwind background tint so colour-blind readers still get the
 * signal (Constitution Principle IV; WCAG 1.4.1).
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
  // 0 = Sunday, 6 = Saturday — JS Date.getDay() convention, which
  // matches our Sunday-first layout exactly.
  const firstDayWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = cells.length;

  // Precompute the grid: an array of week rows, each a 7-cell array
  // where each cell is either a DayCell or null (a leading/trailing
  // blank).
  const weeks = useMemo(() => buildWeeks(firstDayWeekday, daysInMonth, cells), [
    firstDayWeekday,
    daysInMonth,
    cells,
  ]);

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
      // Clamp; skip locked NA cells in player-edit mode.
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
    <div role="grid" aria-label={ariaLabel} className="w-full">
      <div role="row" className="grid grid-cols-7">
        {DAY_HEADERS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="p-1 text-center text-xs font-semibold uppercase text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} role="row" className="grid grid-cols-7">
          {week.map((cell, dayIdx) => {
            if (cell === null) {
              return (
                <div
                  key={`blank-${weekIdx}-${dayIdx}`}
                  role="presentation"
                  aria-hidden="true"
                  className="border border-border/40 bg-muted/30"
                />
              );
            }

            const interactiveCell = isInteractive(cell);
            const lockedNa = cell.gmLockedNa === true && mode !== "gm-edit";
            // GM-locked NA reads as "Host Unavailable" so the player
            // sees that the day is blocked by the GM, not by their
            // own choice. (The cell's underlying status is :NA via
            // the GM-NA cascade, but the cause is the GM, not the
            // player.)
            const statusLabel = lockedNa
              ? "Host Unavailable"
              : STATUS_LABEL[cell.status];
            const label = `${monthName} ${cell.day}, ${statusLabel}`;

            return (
              <button
                key={cell.day}
                ref={(node) => {
                  if (node) cellRefs.current.set(cell.day, node);
                  else cellRefs.current.delete(cell.day);
                }}
                role="gridcell"
                type="button"
                tabIndex={cell.day === focusedDay && interactiveCell ? 0 : -1}
                aria-label={label}
                aria-disabled={!interactiveCell ? true : undefined}
                disabled={!interactiveCell && mode !== "read-only"}
                onClick={() => interactiveCell && onCycle?.(cell.day)}
                onKeyDown={(e) => interactiveCell && handleKeyDown(e, cell.day)}
                onFocus={() => setFocusedDay(cell.day)}
                className={cn(
                  "flex h-20 flex-col items-start gap-1 border p-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  interactiveCell && "hover:brightness-110 cursor-pointer",
                  !interactiveCell && "cursor-not-allowed opacity-60",
                  lockedNa
                    ? "border-muted-foreground/20 bg-muted text-muted-foreground"
                    : `${STATUS_CLASS[cell.status]}`,
                )}
              >
                <span className="text-sm font-semibold">{cell.day}</span>
                <span className="flex items-center gap-1 text-xs">
                  <span aria-hidden="true">{STATUS_ICON[cell.status]}</span>
                  <span>{statusLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function buildWeeks(
  firstDayWeekday: number,
  daysInMonth: number,
  cells: DayCell[],
): Array<Array<DayCell | null>> {
  const weeks: Array<Array<DayCell | null>> = [];
  let currentWeek: Array<DayCell | null> = Array.from(
    { length: firstDayWeekday },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = cells[day - 1] ?? { day, status: "NA" };
    currentWeek.push(cell);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}
