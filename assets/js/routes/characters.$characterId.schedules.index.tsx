import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { ScheduleStatusBadge } from "@/features/schedules/components/schedule-status-badge";
import { useListSchedulesForCharacter, type CharacterSchedule } from "@/features/schedules/hooks";

export const Route = createFileRoute("/characters/$characterId/schedules/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: CharacterSchedulesIndexRoute,
});

interface MonthYear {
  year: number;
  month: number;
}

function compareMonthYearDesc(a: MonthYear, b: MonthYear): number {
  if (a.year !== b.year) return b.year - a.year;
  return b.month - a.month;
}

function compareMonthYearAsc(a: MonthYear, b: MonthYear): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function CharacterSchedulesIndexRoute() {
  const { characterId } = Route.useParams();
  const schedules = useListSchedulesForCharacter(characterId);
  const navigate = useNavigate();

  const sorted = useMemo(() => {
    if (!schedules.data) return null;
    const now = new Date();
    const currentKey = now.getFullYear() * 100 + now.getMonth() + 1;

    const future: CharacterSchedule[] = [];
    const past: CharacterSchedule[] = [];

    for (const schedule of schedules.data) {
      const key = schedule.year * 100 + schedule.month;
      if (key >= currentKey) {
        future.push(schedule);
      } else {
        past.push(schedule);
      }
    }

    // Future: ascending so "current" appears first.
    future.sort(compareMonthYearAsc);
    // Past: descending so the most recent past appears first.
    past.sort(compareMonthYearDesc);

    return [...future, ...past];
  }, [schedules.data]);

  if (schedules.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p>Loading schedules…</p>
      </main>
    );
  }

  if (schedules.isError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-destructive" role="alert">
          We couldn&apos;t load schedules. Please refresh.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1
            data-route-heading
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight"
          >
            All schedules
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Future months first, then past months. The current month is
            grouped with future months.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigate({
              to: "/characters/$id",
              params: { id: characterId },
            })
          }
        >
          Back to character
        </Button>
      </header>

      {sorted && sorted.length > 0 ? (
        <ul
          className="mt-8 divide-y rounded-md border"
          data-testid="character-all-schedules-list"
        >
          {sorted.map((schedule) => (
            <li
              key={schedule.id}
              className="flex items-center justify-between gap-3 p-4"
              data-testid={`character-all-schedules-row-${schedule.id}`}
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
      ) : (
        <p className="mt-8 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No schedules yet.
        </p>
      )}
    </main>
  );
}
