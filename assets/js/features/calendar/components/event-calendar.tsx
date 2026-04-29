import { useMemo } from "react";

import { CalendarGrid } from "@/components/calendar-grid";
import { cn } from "@/lib/utils";
import type { CalendarEventDay } from "../hooks";
import { DayEventsPopover } from "./day-events-popover";

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

const ROLE_ICON: Record<CalendarEventDay["role"], string> = {
  gm: "🎲",
  player: "★",
};

const ROLE_LABEL: Record<CalendarEventDay["role"], string> = {
  gm: "Game Master",
  player: "Player",
};

const ROLE_PILL_CLASS: Record<CalendarEventDay["role"], string> = {
  gm: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/25 dark:text-emerald-300",
  player:
    "bg-amber-500/15 text-amber-700 border-amber-500/40 hover:bg-amber-500/25 dark:text-amber-300",
};

const MAX_PILLS_PER_CELL = 3;

export interface EventCalendarProps {
  year: number;
  month: number;
  events: CalendarEventDay[];
  onOpenEvent: (event: CalendarEventDay) => void;
  ariaLabel: string;
}

/**
 * Cross-schedule month calendar for feature 004. Renders one pill
 * per `CalendarEventDay` on the matching cell, capped at 3 visible
 * pills with a `+N more` chip for overflow (US3 hooks the chip into
 * a popover; v1 of US1 just renders the chip as a button).
 */
export function EventCalendar({
  year,
  month,
  events,
  onOpenEvent,
  ariaLabel,
}: EventCalendarProps) {
  const monthName = MONTH_NAMES[month - 1] ?? "";

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventDay[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  return (
    <CalendarGrid
      year={year}
      month={month}
      ariaLabel={ariaLabel}
      renderCell={(date) => {
        const dateKey = formatDateKey(date);
        const dayEvents = eventsByDate.get(dateKey) ?? [];
        const visible = dayEvents.slice(0, MAX_PILLS_PER_CELL);
        const overflow = dayEvents.length - visible.length;
        const day = date.getDate();

        return (
          <div
            role="gridcell"
            data-testid={`event-calendar-cell-${dateKey}`}
            className="flex h-24 flex-col gap-1 border border-border/60 bg-background p-1.5"
          >
            <span className="text-xs font-semibold text-muted-foreground">
              {day}
            </span>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              {visible.map((event) => (
                <button
                  key={event.scheduleId}
                  type="button"
                  data-testid={`event-pill-${event.scheduleId}`}
                  aria-label={`${monthName} ${day}, ${event.gameTitle}, ${ROLE_LABEL[event.role]}`}
                  onClick={() => onOpenEvent(event)}
                  className={cn(
                    "flex min-h-7 items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    ROLE_PILL_CLASS[event.role],
                  )}
                >
                  <span aria-hidden="true">{ROLE_ICON[event.role]}</span>
                  <span className="truncate">{event.gameTitle}</span>
                </button>
              ))}
              {overflow > 0 ? (
                <DayEventsPopover
                  date={dateKey}
                  events={dayEvents}
                  onOpenEvent={onOpenEvent}
                >
                  <button
                    type="button"
                    data-testid={`event-overflow-${dateKey}`}
                    aria-label={`${monthName} ${day}, ${overflow} more event${overflow === 1 ? "" : "s"}`}
                    className="flex min-h-7 items-center justify-start rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  >
                    +{overflow} more
                  </button>
                </DayEventsPopover>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}

function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
