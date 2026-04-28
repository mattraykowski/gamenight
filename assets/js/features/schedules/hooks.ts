import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getScheduleForGame,
  initiateSchedule,
  listSchedulesForGame,
  listSchedulesForGameTopSix,
  setScheduleGmDay,
  type AshRpcError,
  type GetScheduleForGameInput,
  type InitiateScheduleInput,
  type ScheduleDayResourceSchema,
  type ScheduleResourceSchema,
  type SetScheduleGmDayInput,
} from "@/ash_rpc";
import { getClientOptions } from "@/lib/api/client";
import { narrowApiError, type ApiError } from "@/lib/api/errors";

/**
 * Schedule projection used by the SPA — fields the GM views need.
 * Adding fields here is intentional, not silent — pulling extra
 * columns into the SPA payload should be a deliberate decision.
 *
 * `gameId` is included manually because it's serialized as a JSON:API
 * relationship rather than an attribute on `ScheduleResourceSchema`,
 * but the wire response includes it via `default_fields`.
 */
export type Schedule = Pick<
  ScheduleResourceSchema,
  | "id"
  | "month"
  | "year"
  | "startTime"
  | "endTime"
  | "timeZone"
  | "status"
  | "postedAt"
  | "name"
> & {
  gameId: string;
};

const SCHEDULE_FIELDS = [
  "id",
  "month",
  "year",
  "startTime",
  "endTime",
  "timeZone",
  "status",
  "postedAt",
  "name",
] as const;

export type ScheduleDay = Pick<
  ScheduleDayResourceSchema,
  "id" | "day" | "gmStatus" | "finalStatus"
> & {
  scheduleId: string;
};

const SCHEDULE_DAY_FIELDS = [
  "id",
  "day",
  "gmStatus",
  "finalStatus",
] as const;

export type ScheduleWithDays = Schedule & {
  scheduleDays: ScheduleDay[];
};

export const schedulesKeys = {
  all: ["schedules"] as const,
  byGame: (gameId: string) => [...schedulesKeys.all, "byGame", gameId] as const,
  topSixForGame: (gameId: string) =>
    [...schedulesKeys.all, "byGame", gameId, "topSix"] as const,
  detail: (id: string) => [...schedulesKeys.all, "detail", id] as const,
};

async function runRpc<T>(
  call: Promise<
    { success: true; data: T } | { success: false; errors: AshRpcError[] }
  >,
): Promise<T> {
  const result = await call;
  if (result.success) return result.data;
  throw narrowApiError(result.errors);
}

/** GM-only — top-6 most recent schedules for the View Game widget. */
export function useListSchedulesForGameTopSix(
  gameId: string,
): UseQueryResult<Schedule[], ApiError> {
  return useQuery({
    queryKey: schedulesKeys.topSixForGame(gameId),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule[]>(
        listSchedulesForGameTopSix({
          input: { gameId },
          fields: SCHEDULE_FIELDS as unknown as Array<
            ScheduleResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Schedule[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    enabled: gameId.length > 0,
  });
}

/** GM-only — every schedule for a game (the View All page). */
export function useListSchedulesForGame(
  gameId: string,
): UseQueryResult<Schedule[], ApiError> {
  return useQuery({
    queryKey: schedulesKeys.byGame(gameId),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule[]>(
        listSchedulesForGame({
          input: { gameId },
          fields: SCHEDULE_FIELDS as unknown as Array<
            ScheduleResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Schedule[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    enabled: gameId.length > 0,
  });
}

/**
 * GM-only — fetch one schedule by id, scoped to a game, with
 * `schedule_days` loaded so the calendar can render in one round
 * trip.
 */
export function useGetScheduleForGame(
  input: GetScheduleForGameInput,
): UseQueryResult<ScheduleWithDays, ApiError> {
  return useQuery({
    queryKey: [...schedulesKeys.detail(input.id), input],
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<ScheduleWithDays>(
        getScheduleForGame({
          input,
          fields: [
            ...SCHEDULE_FIELDS,
            { scheduleDays: SCHEDULE_DAY_FIELDS },
          ] as unknown as Array<ScheduleResourceSchema["__primitiveFields"]>,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: ScheduleWithDays }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    enabled: input.id.length > 0 && input.gameId.length > 0,
  });
}

/** GM-only — initiate a new monthly schedule. */
export function useInitiateSchedule(): UseMutationResult<
  Schedule,
  ApiError,
  InitiateScheduleInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InitiateScheduleInput) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        initiateSchedule({
          input,
          fields: SCHEDULE_FIELDS as unknown as Array<
            ScheduleResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Schedule }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(created.gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.topSixForGame(created.gameId),
      });
      queryClient.setQueryData(schedulesKeys.detail(created.id), created);
    },
  });
}

/** GM-only — toggle a single GM day's availability status. */
export type SetScheduleGmDayArgs = SetScheduleGmDayInput & {
  scheduleId: string;
};

export function useSetScheduleGmDay(): UseMutationResult<
  Schedule,
  ApiError,
  SetScheduleGmDayArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, ...input }: SetScheduleGmDayArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        setScheduleGmDay({
          identity: scheduleId,
          input,
          fields: SCHEDULE_FIELDS as unknown as Array<
            ScheduleResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Schedule }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.detail(vars.scheduleId),
      });
    },
  });
}
