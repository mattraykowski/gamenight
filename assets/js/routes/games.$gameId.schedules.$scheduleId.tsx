import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { MonthCalendar, type DayCell } from "@/features/schedules/components/month-calendar";
import { ScheduleStatusBadge } from "@/features/schedules/components/schedule-status-badge";
import { TransitionToReadyButton } from "@/features/schedules/components/transition-to-ready-button";
import {
  useGetScheduleForGame,
  useSetScheduleGmDay,
  useTransitionScheduleToReady,
  type ScheduleDay,
} from "@/features/schedules/hooks";
import { AVAILABILITY_CYCLE, type AvailabilityStatus } from "@/features/schedules/kinds";
import { useToasts } from "@/features/toasts/toast-provider";

export const Route = createFileRoute("/games/$gameId/schedules/$scheduleId")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: ScheduleDetailRoute,
});

function ScheduleDetailRoute() {
  const { gameId, scheduleId } = Route.useParams();
  const schedule = useGetScheduleForGame({ id: scheduleId, gameId });
  const setGmDay = useSetScheduleGmDay();
  const transitionToReady = useTransitionScheduleToReady();
  const { push } = useToasts();

  async function onTransitionToReady() {
    try {
      await transitionToReady.mutateAsync({ scheduleId, gameId });
      push({
        title: "Schedule sent to players for availability.",
        variant: "success",
      });
    } catch {
      push({
        title:
          "Could not send the schedule. Please refresh and try again.",
        variant: "error",
      });
    }
  }

  const cells = useMemo<DayCell[]>(() => {
    if (!schedule.data) return [];
    return schedule.data.scheduleDays
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((d: ScheduleDay) => ({
        day: d.day,
        status: d.gmStatus ?? "NA",
        gmLockedNa: false,
      }));
  }, [schedule.data]);

  function nextStatus(current: AvailabilityStatus): AvailabilityStatus {
    const idx = AVAILABILITY_CYCLE.indexOf(current);
    return AVAILABILITY_CYCLE[(idx + 1) % AVAILABILITY_CYCLE.length] ?? "NA";
  }

  async function onCycle(day: number) {
    if (!schedule.data) return;
    const cell = cells.find((c) => c.day === day);
    if (!cell) return;
    const target = nextStatus(cell.status as AvailabilityStatus);
    try {
      await setGmDay.mutateAsync({
        scheduleId,
        day,
        status: target,
      });
    } catch {
      push({
        title: "Could not update availability. Please try again.",
        variant: "error",
      });
    }
  }

  if (schedule.isPending) {
    return (
      <main className="container mx-auto py-8" id="main-content">
        <p>Loading schedule…</p>
      </main>
    );
  }

  if (schedule.isError || !schedule.data) {
    return (
      <main className="container mx-auto py-8" id="main-content">
        <h1 data-route-heading className="text-2xl font-semibold">
          Schedule not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          The schedule you&apos;re looking for either doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/games/$id" params={{ id: gameId }}>
            Back to game
          </Link>
        </Button>
      </main>
    );
  }

  const data = schedule.data;
  const calendarMode =
    data.status === "preparing" || data.status === "ready_for_availability"
      ? ("gm-edit" as const)
      : ("read-only" as const);

  return (
    <main className="container mx-auto max-w-5xl py-8" id="main-content">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-route-heading>
            {data.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <ScheduleStatusBadge status={data.status} />
            <span className="text-sm text-muted-foreground">
              Click each day to cycle through Not Available → Ideal → Available → Available If.
            </span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/games/$id" params={{ id: gameId }}>
            Back to game
          </Link>
        </Button>
      </header>

      <MonthCalendar
        year={data.year}
        month={data.month}
        cells={cells}
        mode={calendarMode}
        onCycle={onCycle}
        ariaLabel={`${data.name} calendar`}
      />

      <div className="mt-6 flex flex-wrap gap-3">
        {data.status === "preparing" ? (
          <TransitionToReadyButton
            onConfirm={onTransitionToReady}
            isPending={transitionToReady.isPending}
          />
        ) : null}
        {/* US4 — placeholder */}
        <Button type="button" variant="outline" disabled aria-label="Scheduling View (coming in US4)">
          Scheduling View
        </Button>
        {/* US8 — placeholder */}
        <Button type="button" variant="outline" disabled aria-label="Delete (coming in US8)">
          Delete
        </Button>
      </div>
    </main>
  );
}
