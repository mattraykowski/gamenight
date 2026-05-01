import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Stamp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CornerOrnament } from "@/components/ui/corner-ornament";
import {
  DayMatrixTable,
  type DayMatrixDay,
  type DayMatrixParticipant,
} from "@/features/schedules/components/day-matrix-table";
import { PostScheduleDialog } from "@/features/schedules/components/post-schedule-dialog";
import { UpdatePostedScheduleButtons } from "@/features/schedules/components/update-posted-schedule-buttons";
import {
  useGetScheduleForScheduling,
  usePostSchedule,
  useUpdateScheduleFinalDay,
  useUpdateScheduleFinalDaysAndNotify,
  useUpdateScheduleFinalDaysBatch,
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
  const schedule = useGetScheduleForScheduling({ id: scheduleId, gameId });
  const updateFinalDay = useUpdateScheduleFinalDay();
  const updateFinalDaysBatch = useUpdateScheduleFinalDaysBatch();
  const updateFinalDaysAndNotify = useUpdateScheduleFinalDaysAndNotify();
  const post = usePostSchedule();
  const { push } = useToasts();
  const navigate = useNavigate();

  const [pendingFinalEdits, setPendingFinalEdits] = useState<
    Map<number, FinalStatus>
  >(new Map());

  const isPosted = schedule.data?.status === "posted";

  const matrix = useMemo(() => {
    if (!schedule.data) return null;

    const allParticipants = schedule.data.participants ?? [];

    const participants: DayMatrixParticipant[] = allParticipants.map((p) => ({
      id: p.id,
      characterName: p.player?.characterName ?? "Player",
      npOnly: p.npOnly === true,
    }));

    // Build a (participantId × day) → status map up front so the
    // per-row lookups stay O(1).
    const statusByParticipantDay = new Map<string, ParticipantDayStatus>();
    for (const participant of allParticipants) {
      for (const pd of participant.participantDays ?? []) {
        statusByParticipantDay.set(
          `${participant.id}:${pd.day}`,
          pd.status as ParticipantDayStatus,
        );
      }
    }

    const days: DayMatrixDay[] = (schedule.data.scheduleDays ?? [])
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((sd) => {
        const participantStatuses: Record<string, ParticipantDayStatus> = {};
        for (const p of allParticipants) {
          participantStatuses[p.id] =
            statusByParticipantDay.get(`${p.id}:${sd.day}`) ?? "NA";
        }
        const persisted = sd.finalStatus as FinalStatus | null;
        const overlay = pendingFinalEdits.get(sd.day);
        return {
          day: sd.day,
          gmStatus: (sd.gmStatus ?? "NA") as AvailabilityStatus,
          finalStatus: overlay ?? persisted,
          participantStatuses,
        };
      });

    return { days, participants };
  }, [schedule.data, pendingFinalEdits]);

  async function onCycleFinal(day: number, next: FinalStatus) {
    if (isPosted) {
      setPendingFinalEdits((prev) => {
        const newMap = new Map(prev);
        const persisted =
          (schedule.data?.scheduleDays.find((d) => d.day === day)
            ?.finalStatus as FinalStatus | null) ?? null;
        if (persisted === next) {
          newMap.delete(day);
        } else {
          newMap.set(day, next);
        }
        return newMap;
      });
      return;
    }

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

  function pendingFinalDays(): Array<{ day: number; status: FinalStatus }> {
    return Array.from(pendingFinalEdits.entries()).map(([day, status]) => ({
      day,
      status,
    }));
  }

  async function onUpdatePosted() {
    const finalDays = pendingFinalDays();
    if (finalDays.length === 0) return;
    try {
      await updateFinalDaysBatch.mutateAsync({
        scheduleId,
        gameId,
        finalDays,
      });
      setPendingFinalEdits(new Map());
      push({ title: "Schedule updated.", variant: "success" });
    } catch {
      push({
        title: "Could not update the schedule. Please try again.",
        variant: "error",
      });
    }
  }

  async function onUpdatePostedAndNotify() {
    const finalDays = pendingFinalDays();
    if (finalDays.length === 0) return;
    try {
      await updateFinalDaysAndNotify.mutateAsync({
        scheduleId,
        gameId,
        finalDays,
      });
      setPendingFinalEdits(new Map());
      push({
        title: "Schedule updated and players notified.",
        variant: "success",
      });
    } catch {
      push({
        title: "Could not update and notify. Please try again.",
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
        <h1 className="font-serif text-2xl font-semibold" data-route-heading>
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
  const canPost = isReady;
  const hasPendingChanges = pendingFinalEdits.size > 0;
  const isMatrixPending =
    updateFinalDay.isPending ||
    updateFinalDaysBatch.isPending ||
    updateFinalDaysAndNotify.isPending;

  return (
    <main className="container mx-auto max-w-6xl py-8 2xl:max-w-[88rem]" id="main-content">
      <header className="relative mb-6 flex items-start justify-between gap-4">
        <CornerOrnament icon={Stamp} tone="secondary" />
        <div>
          <h1 className="font-serif text-2xl font-semibold" data-route-heading>
            Scheduling View — {data.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isReady
              ? "Toggle Final values to NA or A. We'll commit them when you click Post Schedule."
              : isPosted
                ? "Schedule is posted. Toggle Final values to stage edits, then choose Update schedule (silent) or Update and notify."
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
        isPending={isMatrixPending}
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

      {isPosted ? (
        <div className="mt-6">
          <UpdatePostedScheduleButtons
            hasChanges={hasPendingChanges}
            onUpdate={onUpdatePosted}
            onUpdateAndNotify={onUpdatePostedAndNotify}
            isUpdatePending={updateFinalDaysBatch.isPending}
            isNotifyPending={updateFinalDaysAndNotify.isPending}
          />
        </div>
      ) : null}
    </main>
  );
}
