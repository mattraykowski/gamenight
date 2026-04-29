import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { DeleteScheduleDialog } from "@/features/schedules/components/delete-schedule-dialog";
import { MonthCalendar, type DayCell } from "@/features/schedules/components/month-calendar";
import { ScheduleStatusBadge } from "@/features/schedules/components/schedule-status-badge";
import { SendReminderButton } from "@/features/schedules/components/send-reminder-button";
import { TransitionToReadyButton } from "@/features/schedules/components/transition-to-ready-button";
import {
  useDeleteSchedule,
  useGetScheduleForScheduling,
  useSendReminder,
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
  const schedule = useGetScheduleForScheduling({ id: scheduleId, gameId });
  const setGmDay = useSetScheduleGmDay();
  const transitionToReady = useTransitionScheduleToReady();
  const sendReminder = useSendReminder();
  const destroy = useDeleteSchedule();
  const { push } = useToasts();
  const navigate = useNavigate();

  async function onDelete(confirmation: string) {
    try {
      await destroy.mutateAsync({ scheduleId, gameId, confirmation });
      push({ title: "Schedule deleted.", variant: "success" });
      await navigate({ to: "/games/$id", params: { id: gameId } });
    } catch {
      push({
        title: "Could not delete the schedule. Please try again.",
        variant: "error",
      });
    }
  }

  async function onSendReminder(participantId: string) {
    try {
      await sendReminder.mutateAsync({ participantId, scheduleId, gameId });
      push({ title: "Reminder sent.", variant: "success" });
    } catch {
      push({
        title: "Could not send the reminder. Please try again.",
        variant: "error",
      });
    }
  }

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
    const isPosted = schedule.data.status === "posted";
    return schedule.data.scheduleDays
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((d: ScheduleDay) => ({
        day: d.day,
        status: isPosted ? (d.finalStatus ?? "NA") : (d.gmStatus ?? "NA"),
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

      {data.status !== "preparing" ? (
        <section className="mt-10" aria-labelledby="schedule-roster-heading">
          <h2
            id="schedule-roster-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Roster
          </h2>
          {(data.participants ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No players linked to this schedule yet.
            </p>
          ) : (
            <ul
              className="mt-4 divide-y rounded-md border"
              data-testid="schedule-roster"
            >
              {(data.participants ?? [])
                .filter((p) => !p.npOnly)
                .map((participant) => {
                  const submitted =
                    participant.submittedAt != null &&
                    participant.submittedAt !== "";
                  return (
                    <li
                      key={participant.id}
                      className="flex items-center justify-between gap-3 p-4"
                      data-testid={`schedule-roster-row-${participant.id}`}
                    >
                      <div>
                        <p className="font-medium">
                          {participant.player?.characterName ?? "Player"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {submitted
                            ? `Submitted ${formatDate(participant.submittedAt)}`
                            : "Awaiting availability"}
                        </p>
                      </div>
                      {!submitted &&
                      data.status === "ready_for_availability" ? (
                        <SendReminderButton
                          onSend={() => onSendReminder(participant.id)}
                          isPending={sendReminder.isPending}
                        />
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {data.status === "preparing" ? (
          <TransitionToReadyButton
            onConfirm={onTransitionToReady}
            isPending={transitionToReady.isPending}
          />
        ) : null}
        {data.status === "ready_for_availability" || data.status === "posted" ? (
          <Button
            type="button"
            variant="outline"
            data-testid="open-scheduling-view"
            onClick={() =>
              void navigate({
                to: "/games/$gameId/schedules/$scheduleId/scheduling",
                params: { gameId, scheduleId },
              })
            }
          >
            Scheduling View
          </Button>
        ) : null}
        <DeleteScheduleDialog
          scheduleName={data.name ?? "this schedule"}
          onConfirm={onDelete}
          isPending={destroy.isPending}
        >
          <Button
            type="button"
            variant="outline"
            data-testid="delete-schedule-trigger"
          >
            Delete
          </Button>
        </DeleteScheduleDialog>
      </div>
    </main>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString();
}
