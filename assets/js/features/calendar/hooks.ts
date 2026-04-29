import {
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import { listSchedulesForCalendarMonth } from "@/ash_rpc";
import { useOptionalAuth } from "@/lib/auth/auth-context";
import { getClientOptions } from "@/lib/api/client";
import { narrowApiError, type ApiError } from "@/lib/api/errors";

export type CalendarEventDay = {
  date: string;
  scheduleId: string;
  gameId: string;
  gameTitle: string;
  timeSlotLabel: string;
  role: "gm" | "player";
  characterId: string | null;
  targetRoute: string;
};

export const calendarKeys = {
  all: ["schedules", "calendar"] as const,
  byMonth: (actorId: string, year: number, month: number) =>
    [...calendarKeys.all, actorId, year, month] as const,
  forActor: (actorId: string) => [...calendarKeys.all, actorId] as const,
};

/**
 * Read the `CalendarEventDay` projection for the actor's connected
 * schedules in the visible (year, month). Disabled when no actor is
 * present.
 */
export function useListCalendarEventDays(
  year: number,
  month: number,
): UseQueryResult<CalendarEventDay[], ApiError> {
  const auth = useOptionalAuth();
  const actorId = auth?.user?.id ?? "";

  return useQuery({
    queryKey: actorId
      ? calendarKeys.byMonth(actorId, year, month)
      : ([...calendarKeys.all, "anonymous", year, month] as const),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      const result = await listSchedulesForCalendarMonth({
        input: { year, month },
        headers,
        ...(customFetch !== undefined ? { customFetch } : {}),
      });
      if (!result.success) throw narrowApiError(result.errors);
      return result.data as CalendarEventDay[];
    },
    enabled: actorId.length > 0,
  });
}

