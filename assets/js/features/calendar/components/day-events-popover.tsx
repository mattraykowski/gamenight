import { useState, type ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CalendarEventDay } from "../hooks";

const ROLE_ICON: Record<CalendarEventDay["role"], string> = {
  gm: "🎲",
  player: "★",
};

const ROLE_LABEL: Record<CalendarEventDay["role"], string> = {
  gm: "Game Master",
  player: "Player",
};

const ROLE_PILL_CLASS: Record<CalendarEventDay["role"], string> = {
  gm: "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
  player:
    "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300",
};

export interface DayEventsPopoverProps {
  /** Date string in YYYY-MM-DD form. */
  date: string;
  events: CalendarEventDay[];
  onOpenEvent: (event: CalendarEventDay) => void;
  /** The trigger element — typically the `+N more` chip. */
  children: ReactNode;
}

/**
 * Overflow popover for day cells with more events than the calendar
 * cell can host. Lists every event for one date as a vertical stack
 * of clickable rows. Closes itself after firing onOpenEvent so the
 * route navigation actually moves focus to the next page.
 */
export function DayEventsPopover({
  date,
  events,
  onOpenEvent,
  children,
}: DayEventsPopoverProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(event: CalendarEventDay) {
    setOpen(false);
    onOpenEvent(event);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-2"
        data-testid={`day-events-popover-${date}`}
      >
        <p className="px-2 py-1 text-sm font-semibold">{formatDate(date)}</p>
        <ul className="mt-1 flex flex-col gap-1">
          {events.map((event) => (
            <li key={`${date}-${event.scheduleId}`}>
              <button
                type="button"
                onClick={() => handleSelect(event)}
                aria-label={`${formatDate(date)}, ${event.gameTitle}, ${ROLE_LABEL[event.role]}`}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  ROLE_PILL_CLASS[event.role],
                )}
              >
                <span className="flex items-center gap-1 text-sm font-medium">
                  <span aria-hidden="true">{ROLE_ICON[event.role]}</span>
                  <span className="truncate">{event.gameTitle}</span>
                </span>
                <span className="text-xs opacity-80">
                  {event.timeSlotLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

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

function formatDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return iso;
  }
  const monthName = MONTH_NAMES[month - 1] ?? "";
  return `${monthName} ${day}, ${year}`;
}
