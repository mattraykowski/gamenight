import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { EventCalendar } from "@/features/calendar/components/event-calendar";
import {
  useListCalendarEventDays,
  type CalendarEventDay,
} from "@/features/calendar/hooks";

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

const calendarSearchSchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const Route = createFileRoute("/calendar")({
  validateSearch: calendarSearchSchema,
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: CalendarRoute,
});

function CalendarRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const { year, month, isCurrent } = useMemo(() => {
    const y = search.year ?? today.getFullYear();
    const m = search.month ?? today.getMonth() + 1;
    const isCurrent =
      y === today.getFullYear() && m === today.getMonth() + 1;
    return { year: y, month: m, isCurrent };
  }, [search.year, search.month, today]);

  const events = useListCalendarEventDays(year, month);

  function gotoMonth(deltaMonths: number) {
    let nextMonth = month + deltaMonths;
    let nextYear = year;
    while (nextMonth > 12) {
      nextMonth -= 12;
      nextYear += 1;
    }
    while (nextMonth < 1) {
      nextMonth += 12;
      nextYear -= 1;
    }
    void navigate({
      to: "/calendar",
      search: { year: nextYear, month: nextMonth },
    });
  }

  function gotoToday() {
    void navigate({
      to: "/calendar",
      search: {},
    });
  }

  function onOpenEvent(event: CalendarEventDay) {
    if (event.role === "gm") {
      void navigate({
        to: "/games/$gameId/schedules/$scheduleId",
        params: { gameId: event.gameId, scheduleId: event.scheduleId },
      });
    } else if (event.characterId) {
      void navigate({
        to: "/characters/$characterId/schedules/$scheduleId",
        params: {
          characterId: event.characterId,
          scheduleId: event.scheduleId,
        },
      });
    }
  }

  const monthName = MONTH_NAMES[month - 1] ?? "";
  const eventList = events.data ?? [];

  return (
    <main className="container mx-auto max-w-6xl py-8" id="main-content">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-2xl font-semibold"
        >
          {monthName} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous month"
            onClick={() => gotoMonth(-1)}
            data-testid="calendar-prev-month"
          >
            ‹
          </Button>
          {!isCurrent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={gotoToday}
              data-testid="calendar-today"
            >
              Today
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next month"
            onClick={() => gotoMonth(1)}
            data-testid="calendar-next-month"
          >
            ›
          </Button>
        </div>
      </header>

      {events.isError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          We couldn&apos;t load events for this month. Please refresh.
        </div>
      ) : null}

      <EventCalendar
        year={year}
        month={month}
        events={eventList}
        onOpenEvent={onOpenEvent}
        ariaLabel={`${monthName} ${year} calendar`}
      />

      {events.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
          Loading events…
        </p>
      ) : eventList.length === 0 ? (
        <p
          className="mt-3 text-sm text-muted-foreground"
          data-testid="calendar-empty-helper"
        >
          No game days planned this month.
        </p>
      ) : null}
    </main>
  );
}
