import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { DayMatrixTable, type DayMatrixDay } from "@/features/schedules/components/day-matrix-table";
import { PostScheduleDialog } from "@/features/schedules/components/post-schedule-dialog";
import {
  useGetScheduleForGame,
  usePostSchedule,
  useUpdateScheduleFinalDay,
} from "@/features/schedules/hooks";
import type {
  AvailabilityStatus,
  FinalStatus,
  ParticipantDayStatus,
} from "@/features/schedules/kinds";
import { useToasts } from "@/features/toasts/toast-provider";

export const Route = createFileRoute(
  "/games/$gameId/schedules/$scheduleId_/scheduling",
)({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: SchedulingViewRoute,
});

function SchedulingViewRoute() {
  const { gameId, scheduleId } = Route.useParams();
  const schedule = useGetScheduleForGame({ id: scheduleId, gameId });
  const updateFinalDay = useUpdateScheduleFinalDay();
  const post = usePostSchedule();
  const { push } = useToasts();
  const navigate = useNavigate();

  const matrix = useMemo(() => {
    if (!schedule.data) return null;

    // The GET payload doesn't load participants/participantDays
    // for the GM Scheduling View by default — story phases will
    // wire that. For now we present whatever schedule_days we
    // have plus an empty participant list (computes the Final Note
    // from gm_status alone).
    const days: DayMatrixDay[] = (schedule.data.scheduleDays ?? [])
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((sd) => ({
        day: sd.day,
        gmStatus: (sd.gmStatus ?? "NA") as AvailabilityStatus,
        finalStatus: sd.finalStatus as FinalStatus | null,
        participantStatuses: {} as Record<string, ParticipantDayStatus>,
      }));

    return { days, participants: [] };
  }, [schedule.data]);

  async function onCycleFinal(day: number, next: FinalStatus) {
    try {
      await updateFinalDay.mutateAsync({
        scheduleId,
        gameId,
        day,
        status: next,
      });
    } catch {
      push({
        title: "Could not update Final value. Please try again.",
        variant: "error",
      });
    }
  }

  async function onPost() {
    try {
      await post.mutateAsync({ scheduleId, gameId });
      push({ title: "Schedule posted.", variant: "success" });
    } catch {
      push({
        title: "Could not post the schedule. Please try again.",
        variant: "error",
      });
    }
  }

  if (schedule.isPending) {
    return (
      <main className="container mx-auto py-8" id="main-content">
        <p>Loading scheduling view…</p>
      </main>
    );
  }

  if (schedule.isError || !schedule.data || !matrix) {
    return (
      <main className="container mx-auto py-8" id="main-content">
        <h1 className="text-2xl font-semibold" data-route-heading>
          Schedule not found
        </h1>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() =>
            void navigate({
              to: "/games/$gameId/schedules/$scheduleId",
              params: { gameId, scheduleId },
            })
          }
        >
          Back to schedule
        </Button>
      </main>
    );
  }

  const data = schedule.data;
  const isReady = data.status === "ready_for_availability";
  const isPosted = data.status === "posted";
  const canPost = isReady;

  return (
    <main className="container mx-auto max-w-6xl py-8" id="main-content">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-route-heading>
            Scheduling View — {data.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isReady
              ? "Toggle Final values to NA or A. We'll commit them when you click Post Schedule."
              : isPosted
                ? "Schedule is posted. Final values can still be edited; players see the latest."
                : "This schedule isn't ready for the Scheduling View yet."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigate({
              to: "/games/$gameId/schedules/$scheduleId",
              params: { gameId, scheduleId },
            })
          }
        >
          Back to schedule
        </Button>
      </header>

      <DayMatrixTable
        participants={matrix.participants}
        days={matrix.days}
        onCycleFinal={onCycleFinal}
        isPending={updateFinalDay.isPending}
      />

      {canPost ? (
        <div className="mt-6">
          <PostScheduleDialog onConfirm={onPost} isPending={post.isPending}>
            <Button type="button" variant="default">
              Post schedule
            </Button>
          </PostScheduleDialog>
        </div>
      ) : null}
    </main>
  );
}
