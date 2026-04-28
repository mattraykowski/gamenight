import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { CharacterSchedule } from "../hooks";
import { ScheduleStatusBadge } from "./schedule-status-badge";

export interface CharacterSchedulesSectionProps {
  characterId: string;
  schedules: CharacterSchedule[];
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

/**
 * US5 — splits the player's posted schedules into "current month",
 * "upcoming month", and "everything else" buckets and renders the
 * first two inline. The "View all" link routes to the full posted
 * list (sorted future-then-past) for that character.
 */
export function CharacterSchedulesSection({
  characterId,
  schedules,
}: CharacterSchedulesSectionProps) {
  const navigate = useNavigate();

  const posted = schedules.filter((s) => s.status === "posted");
  const current = currentMonthYear();
  const upcoming = nextMonthYear(current);
  const currentSchedules = posted.filter((s) => isInMonthYear(s, current));
  const upcomingSchedules = posted.filter((s) => isInMonthYear(s, upcoming));
  const hasOtherPosted = posted.length > currentSchedules.length + upcomingSchedules.length;

  return (
    <section
      className="mt-10"
      aria-labelledby="character-schedules-heading"
      data-testid="character-schedules-section"
    >
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
            onClick={() =>
              void navigate({
                to: "/characters/$characterId/schedules",
                params: { characterId },
              })
            }
          >
            View all
          </Button>
        ) : null}
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ScheduleBucket
          headingId="character-schedules-current"
          title="This month"
          characterId={characterId}
          schedules={currentSchedules}
          emptyText="No posted schedule for the current month."
        />
        <ScheduleBucket
          headingId="character-schedules-upcoming"
          title="Next month"
          characterId={characterId}
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
  characterId: string;
  schedules: CharacterSchedule[];
  emptyText: string;
}

function ScheduleBucket({
  headingId,
  title,
  characterId,
  schedules,
  emptyText,
}: ScheduleBucketProps) {
  const navigate = useNavigate();

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
                onClick={() =>
                  void navigate({
                    to: "/characters/$characterId/schedules/$scheduleId",
                    params: { characterId, scheduleId: schedule.id },
                  })
                }
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
