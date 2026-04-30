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

function normalizeRow(row: Record<string, unknown>): CalendarEventDay {
  const get = (camel: string, snake: string): unknown =>
    row[camel] !== undefined ? row[camel] : row[snake];
  return {
    date: String(get("date", "date") ?? ""),
    scheduleId: String(get("scheduleId", "schedule_id") ?? ""),
    gameId: String(get("gameId", "game_id") ?? ""),
    gameTitle: String(get("gameTitle", "game_title") ?? ""),
    timeSlotLabel: String(get("timeSlotLabel", "time_slot_label") ?? ""),
    role: get("role", "role") as "gm" | "player",
    characterId:
      (get("characterId", "character_id") as string | null | undefined) ??
      null,
    targetRoute: String(get("targetRoute", "target_route") ?? ""),
  };
}

/**
 * The five feature-003 mutation hooks
 * (`useUpdateScheduleFinalDay`, `useUpdateScheduleFinalDaysBatch`,
 * `useUpdateScheduleFinalDaysAndNotify`, `usePostSchedule`,
 * `useDeleteSchedule`) invalidate `calendarKeys.all` rather than
 * `calendarKeys.forActor(actorId)`. That's intentional: the
 * QueryClient is per-tab / per-session, and `clearAuth()` (sign-out)
 * destroys it before the next user signs in — multiple actors never
 * share a cache. Threading `actorId` through every mutation's args
 * just to satisfy `forActor` would couple every schedule hook to the
 * auth surface for a scoping benefit that doesn't materialise in
 * practice. If we ever introduce shared / multi-actor caching, switch
 * to the `forActor` variant.
 */
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
      // Server returns the projection with snake_case keys (generic
      // action returning `{:array, :map}` doesn't go through the
      // camelCase-on-wire converter that resource attributes do).
      return (result.data as Array<Record<string, unknown>>).map(
        normalizeRow,
      );
    },
    enabled: actorId.length > 0,
  });
}

