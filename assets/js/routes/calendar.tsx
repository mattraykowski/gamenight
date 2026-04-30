import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Dices, Star } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      {/* Hero — eyebrow + big serif title + atmospheric subtitle.
         Matches the "Availability Scroll" pattern from the Stitch
         Schedule View. */}
      <header className="mb-10 flex flex-col gap-2">
        <span className="font-serif italic text-secondary">
          Campaign Logistics
        </span>
        <h1
          data-route-heading
          tabIndex={-1}
          className="font-serif text-4xl font-bold tracking-tight text-primary sm:text-5xl"
        >
          {monthName} {year}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Mark your stars and align the moon — every game day across every
          campaign you&apos;re sworn to, gathered onto a single page of the
          journal.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {events.isError ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              We couldn&apos;t load events for this month. Please refresh.
            </div>
          ) : null}

          <Card className="gap-6 px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Previous month"
                  onClick={() => gotoMonth(-1)}
                  data-testid="calendar-prev-month"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Next month"
                  onClick={() => gotoMonth(1)}
                  data-testid="calendar-next-month"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
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
            </div>

            <CardContent className="px-0">
              <EventCalendar
                year={year}
                month={month}
                events={eventList}
                onOpenEvent={onOpenEvent}
                ariaLabel={`${monthName} ${year} calendar`}
              />

              {events.isPending ? (
                <p
                  className="mt-3 text-sm text-muted-foreground"
                  aria-live="polite"
                >
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
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar — Legend of Symbols. Static panel; no
           dynamic data. */}
        <aside aria-labelledby="calendar-legend-heading" className="xl:sticky xl:top-20 xl:self-start">
          <Card className="gap-4 px-5 py-5">
            <h2
              id="calendar-legend-heading"
              className="font-serif text-lg font-semibold"
            >
              Legend of Symbols
            </h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <Dices className="size-3.5" />
                </span>
                <div>
                  <p className="font-semibold">Game Master</p>
                  <p className="text-muted-foreground">
                    Sessions you&apos;re running for your fellowship.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  <Star className="size-3.5" />
                </span>
                <div>
                  <p className="font-semibold">Player</p>
                  <p className="text-muted-foreground">
                    Sessions where one of your characters is seated.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 shrink-0 items-center justify-center rounded-md border border-muted-foreground/30 bg-muted px-2 text-[10px] font-semibold text-muted-foreground"
                >
                  +N
                </span>
                <div>
                  <p className="font-semibold">Overflow</p>
                  <p className="text-muted-foreground">
                    Tap to see every session for a busy day.
                  </p>
                </div>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </main>
  );
}
