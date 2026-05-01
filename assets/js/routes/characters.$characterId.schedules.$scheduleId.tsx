import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CornerOrnament } from "@/components/ui/corner-ornament";
import {
  MonthCalendar,
  type DayCell,
} from "@/features/schedules/components/month-calendar";
import { ScheduleStatusBadge } from "@/features/schedules/components/schedule-status-badge";
import {
  useGetScheduleForCharacter,
  useSetParticipantDayStatus,
  useSetScheduleParticipantSubmission,
  type ParticipantDay,
} from "@/features/schedules/hooks";
import {
  AVAILABILITY_CYCLE,
  type AvailabilityStatus,
  type ParticipantDayStatus,
} from "@/features/schedules/kinds";
import { useToasts } from "@/features/toasts/toast-provider";

export const Route = createFileRoute("/characters/$characterId/schedules/$scheduleId")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: CharacterScheduleRoute,
});

function nextStatus(current: AvailabilityStatus): AvailabilityStatus {
  const idx = AVAILABILITY_CYCLE.indexOf(current);
  return AVAILABILITY_CYCLE[(idx + 1) % AVAILABILITY_CYCLE.length] ?? "NA";
}

function CharacterScheduleRoute() {
  // The file's URL pattern uses `$characterId` (rather than `$id`)
  // to avoid TanStack Router's file-based router treating
  // `characters.$id.*` as a shared layout namespace alongside
  // `characters.$id.index.tsx`. See the `games.$id.*` /
  // `games.$gameId.*` split for the same pattern.
  const { characterId, scheduleId } = Route.useParams();
  const schedule = useGetScheduleForCharacter({
    id: scheduleId,
    playerId: characterId,
  });
  const setStatus = useSetParticipantDayStatus();
  const setSubmission = useSetScheduleParticipantSubmission();
  const { push } = useToasts();
  const [editing, setEditing] = useState(false);

  const myParticipant = useMemo(() => {
    return schedule.data?.participants?.find((p) => p.playerId === characterId);
  }, [schedule.data, characterId]);

  const cells = useMemo<DayCell[]>(() => {
    if (!schedule.data) return [];
    const isPostedSchedule = schedule.data.status === "posted";
    const dayMap = new Map<number, ParticipantDay>();
    for (const pd of myParticipant?.participantDays ?? []) {
      dayMap.set(pd.day, pd);
    }

    return (schedule.data.scheduleDays ?? [])
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((sd): DayCell => {
        if (isPostedSchedule) {
          // Posted view shows the GM's Final decision (A = game runs,
          // NA = no game), not the player's submitted availability.
          return {
            day: sd.day,
            status: (sd.finalStatus ?? "NA") as ParticipantDayStatus,
            gmLockedNa: false,
          };
        }
        const pd = dayMap.get(sd.day);
        const status = (pd?.status ?? "NA") as ParticipantDayStatus;
        return {
          day: sd.day,
          status,
          gmLockedNa: sd.gmLockedNa === true,
        };
      });
  }, [schedule.data, myParticipant]);

  const isPosted = schedule.data?.status === "posted";
  const isReady = schedule.data?.status === "ready_for_availability";
  const hasSubmitted =
    myParticipant?.submittedAt != null && myParticipant.submittedAt !== "";

  const calendarMode =
    isReady && (editing || !hasSubmitted) ? "player-edit" : "read-only";

  async function onCycle(day: number) {
    if (calendarMode !== "player-edit") return;
    const cell = cells.find((c) => c.day === day);
    if (!cell || cell.gmLockedNa) return;

    const target = nextStatus(cell.status as AvailabilityStatus);
    const pd = myParticipant?.participantDays?.find((p) => p.day === day);
    if (!pd) return;

    try {
      await setStatus.mutateAsync({
        participantDayId: pd.id,
        scheduleId,
        playerId: characterId,
        status: target,
      });
    } catch {
      push({
        title: "Could not update your availability. Please try again.",
        variant: "error",
      });
    }
  }

  async function onSetAvailability() {
    if (!myParticipant) return;
    try {
      await setSubmission.mutateAsync({
        participantId: myParticipant.id,
        scheduleId,
        playerId: characterId,
      });
      setEditing(false);
      push({
        title: "Availability submitted.",
        variant: "success",
      });
    } catch {
      push({
        title: "Could not submit your availability. Please try again.",
        variant: "error",
      });
    }
  }

  if (schedule.isPending) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12" id="main-content">
        <p>Loading schedule…</p>
      </main>
    );
  }

  if (schedule.isError || !schedule.data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12" id="main-content">
        <h1 data-route-heading className="font-serif text-3xl font-bold tracking-tight">
          Schedule not found
        </h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/characters/$id" params={{ id: characterId }}>
            Back to character
          </Link>
        </Button>
      </main>
    );
  }

  const data = schedule.data;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 2xl:max-w-[88rem]" id="main-content">
      <header className="relative mb-6 flex items-start justify-between gap-4">
        <CornerOrnament icon={CalendarClock} tone="primary" />
        <div>
          <h1
            data-route-heading
            tabIndex={-1}
            className="font-serif text-3xl font-bold tracking-tight"
          >
            {data.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <ScheduleStatusBadge status={data.status} />
            <span className="text-sm text-muted-foreground">
              {calendarMode === "player-edit"
                ? "Click each day to cycle availability."
                : isPosted
                  ? "This schedule has been posted."
                  : hasSubmitted
                    ? "You've submitted your availability."
                    : "Calendar is read-only."}
            </span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/characters/$id" params={{ id: characterId }}>
            Back to character
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

      {isReady ? (
        <div className="mt-6 flex items-center gap-3">
          {hasSubmitted && !editing ? (
            <>
              <p className="text-sm text-muted-foreground">
                You submitted on {formatDate(myParticipant?.submittedAt)}.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={onSetAvailability}
              disabled={setSubmission.isPending}
            >
              {setSubmission.isPending ? "Saving…" : "Set Availability"}
            </Button>
          )}
        </div>
      ) : null}
    </main>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString();
}
