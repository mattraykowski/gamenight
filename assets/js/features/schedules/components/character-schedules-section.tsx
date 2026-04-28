import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CharacterSchedule } from "../hooks";
import { ScheduleStatusBadge } from "./schedule-status-badge";

export type SchedulesSectionAudience =
  | { kind: "character"; characterId: string }
  | { kind: "game"; gameId: string };

export interface CharacterSchedulesSectionProps {
  audience: SchedulesSectionAudience;
  schedules: CharacterSchedule[];
  /** Hide the "Posted schedules" header — used when the section is
   *  embedded as a sidebar that already lives under a higher-level
   *  heading (e.g. the View Game summary). */
  hideHeader?: boolean;
}

interface MonthYear {
  year: number;
  month: number;
}

function currentMonthYear(now: Date = new Date()): MonthYear {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function nextMonthYear({ year, month }: MonthYear): MonthYear {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

function isInMonthYear(schedule: CharacterSchedule, target: MonthYear): boolean {
  return schedule.year === target.year && schedule.month === target.month;
}

function nextGameDate(
  schedule: CharacterSchedule,
  now: Date = new Date(),
): Date | null {
  const todayDay =
    now.getFullYear() === schedule.year &&
    now.getMonth() + 1 === schedule.month
      ? now.getDate()
      : 1;
  const upcoming = (schedule.scheduleDays ?? [])
    .filter((sd) => sd.finalStatus === "A" && sd.day >= todayDay)
    .map((sd) => sd.day)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return null;
  return new Date(schedule.year, schedule.month - 1, upcoming[0] as number);
}

function formatNextGame(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * US5 — splits the player's posted schedules into "current month",
 * "upcoming month", and "everything else" buckets and renders the
 * first two inline. The "View all" link routes to the full posted
 * list (sorted future-then-past) for that character.
 */
export function CharacterSchedulesSection({
  audience,
  schedules,
  hideHeader = false,
}: CharacterSchedulesSectionProps) {
  const navigate = useNavigate();

  const posted = schedules.filter((s) => s.status === "posted");
  const current = currentMonthYear();
  const upcoming = nextMonthYear(current);
  const currentSchedules = posted.filter((s) => isInMonthYear(s, current));
  const upcomingSchedules = posted.filter((s) => isInMonthYear(s, upcoming));
  const hasOtherPosted = posted.length > currentSchedules.length + upcomingSchedules.length;

  function navigateToList() {
    if (audience.kind === "character") {
      void navigate({
        to: "/characters/$characterId/schedules",
        params: { characterId: audience.characterId },
      });
    } else {
      void navigate({
        to: "/games/$gameId/schedules",
        params: { gameId: audience.gameId },
      });
    }
  }

  return (
    <section
      className={hideHeader ? undefined : "mt-10"}
      aria-labelledby="character-schedules-heading"
      data-testid="character-schedules-section"
    >
      {hideHeader ? null : (
        <header className="flex items-end justify-between gap-4">
          <h2
            id="character-schedules-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Posted schedules
          </h2>
          {hasOtherPosted ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="character-schedules-view-all"
              onClick={navigateToList}
            >
              View all
            </Button>
          ) : null}
        </header>
      )}

      <div
        className={cn(
          "grid gap-4",
          hideHeader ? "" : "mt-4",
          "md:grid-cols-2",
        )}
      >
        <ScheduleBucket
          headingId="character-schedules-current"
          title="This month"
          audience={audience}
          schedules={currentSchedules}
          emptyText="No posted schedule for the current month."
          showNextGame
        />
        <ScheduleBucket
          headingId="character-schedules-upcoming"
          title="Next month"
          audience={audience}
          schedules={upcomingSchedules}
          emptyText="Nothing posted for next month yet."
        />
      </div>
    </section>
  );
}

interface ScheduleBucketProps {
  headingId: string;
  title: string;
  audience: SchedulesSectionAudience;
  schedules: CharacterSchedule[];
  emptyText: string;
  showNextGame?: boolean;
}

function ScheduleBucket({
  headingId,
  title,
  audience,
  schedules,
  emptyText,
  showNextGame = false,
}: ScheduleBucketProps) {
  const navigate = useNavigate();

  function open(scheduleId: string) {
    if (audience.kind === "character") {
      void navigate({
        to: "/characters/$characterId/schedules/$scheduleId",
        params: { characterId: audience.characterId, scheduleId },
      });
    } else {
      void navigate({
        to: "/games/$gameId/schedules/$scheduleId",
        params: { gameId: audience.gameId, scheduleId },
      });
    }
  }

  return (
    <div className="rounded-md border p-4" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </h3>
      {schedules.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          {showNextGame ? (
            <NextGameCallout schedules={schedules} />
          ) : null}
          <ul className="mt-3 space-y-3">
            {schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex items-center justify-between gap-3"
                data-testid={`character-schedule-${schedule.id}`}
              >
                <div>
                  <p className="font-medium">{schedule.name}</p>
                  <ScheduleStatusBadge status={schedule.status} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => open(schedule.id)}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NextGameCallout({ schedules }: { schedules: CharacterSchedule[] }) {
  const next = schedules
    .map((s) => nextGameDate(s))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div
      className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3"
      data-testid="character-schedules-next-game"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Next Game
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {next ? formatNextGame(next) : "None remaining this month"}
      </p>
    </div>
  );
}
