import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  deleteSchedule,
  getScheduleForCharacter,
  getScheduleForGame,
  initiateSchedule,
  listSchedulesForCharacter,
  listSchedulesForGame,
  listSchedulesForGameTopSix,
  postSchedule,
  sendScheduleReminder,
  setParticipantDayStatus,
  setScheduleGmDay,
  setScheduleParticipantSubmission,
  transitionScheduleToReady,
  updateScheduleFinalDays,
  updateScheduleFinalDaysAndNotify,
  type AshRpcError,
  type GetScheduleForCharacterInput,
  type GetScheduleForGameInput,
  type InitiateScheduleInput,
  type ScheduleDayResourceSchema,
  type ScheduleParticipantResourceSchema,
  type ScheduleResourceSchema,
  type SetParticipantDayStatusInput,
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
  | "submissionCount"
  | "participantCount"
> & {
  gameId: string;
};

const SCHEDULE_FIELDS = [
  "id",
  "gameId",
  "month",
  "year",
  "startTime",
  "endTime",
  "timeZone",
  "status",
  "postedAt",
  "name",
  "submissionCount",
  "participantCount",
] as const;

export type ScheduleDay = Pick<
  ScheduleDayResourceSchema,
  "id" | "day" | "gmStatus" | "finalStatus" | "gmLockedNa"
> & {
  scheduleId: string;
};

const SCHEDULE_DAY_FIELDS = [
  "id",
  "scheduleId",
  "day",
  "gmStatus",
  "finalStatus",
  "gmLockedNa",
] as const;

// Player-side projection — gm_status is field-policy-stripped to nil
// for non-GMs, so the SPA reads `gmLockedNa` instead.
const PLAYER_SCHEDULE_DAY_FIELDS = [
  "id",
  "scheduleId",
  "day",
  "finalStatus",
  "gmLockedNa",
] as const;

export type ScheduleParticipant = Pick<
  ScheduleParticipantResourceSchema,
  "id" | "isLateJoin" | "npOnly" | "submittedAt" | "joinedAt"
> & {
  scheduleId: string;
  playerId: string;
};

const SCHEDULE_PARTICIPANT_FIELDS = [
  "id",
  "scheduleId",
  "playerId",
  "isLateJoin",
  "npOnly",
  "submittedAt",
  "joinedAt",
] as const;

export type ScheduleWithDays = Schedule & {
  scheduleDays: ScheduleDay[];
};

/**
 * GM Scheduling View payload shape — schedule + every linked
 * participant + each participant's player.characterName + every
 * participant's per-day status.
 */
export type ScheduleForScheduling = ScheduleWithDays & {
  participants: Array<
    ScheduleParticipant & {
      player: { id: string; characterName: string } | null;
      participantDays: Array<{ id: string; day: number; status: string }>;
    }
  >;
};

export const schedulesKeys = {
  all: ["schedules"] as const,
  byGame: (gameId: string) => [...schedulesKeys.all, "byGame", gameId] as const,
  topSixForGame: (gameId: string) =>
    [...schedulesKeys.all, "byGame", gameId, "topSix"] as const,
  detail: (id: string) => [...schedulesKeys.all, "detail", id] as const,
  byCharacter: (playerId: string) =>
    [...schedulesKeys.all, "byCharacter", playerId] as const,
  characterDetail: (playerId: string, scheduleId: string) =>
    [...schedulesKeys.all, "byCharacter", playerId, scheduleId] as const,
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
): UseQueryResult<CharacterSchedule[], ApiError> {
  return useQuery({
    queryKey: schedulesKeys.topSixForGame(gameId),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<CharacterSchedule[]>(
        listSchedulesForGameTopSix({
          input: { gameId },
          fields: [
            ...SCHEDULE_FIELDS,
            { scheduleDays: ["day", "finalStatus"] },
          ] as unknown as Array<
            ScheduleResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: CharacterSchedule[] }
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

/**
 * GM-only — fetch the schedule with participants + each
 * participant's character name + participant_days, for the
 * Scheduling View matrix.
 */
export function useGetScheduleForScheduling(
  input: GetScheduleForGameInput,
): UseQueryResult<ScheduleForScheduling, ApiError> {
  return useQuery({
    queryKey: [...schedulesKeys.detail(input.id), "scheduling", input],
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<ScheduleForScheduling>(
        getScheduleForGame({
          input,
          fields: [
            ...SCHEDULE_FIELDS,
            { scheduleDays: SCHEDULE_DAY_FIELDS },
            {
              participants: [
                ...SCHEDULE_PARTICIPANT_FIELDS,
                { player: ["id", "characterName"] },
                { participantDays: ["id", "day", "status"] },
              ],
            },
          ] as unknown as Array<ScheduleResourceSchema["__primitiveFields"]>,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: ScheduleForScheduling }
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

/** GM-only — transition a :preparing schedule to :ready_for_availability. */
export function useTransitionScheduleToReady(): UseMutationResult<
  Schedule,
  ApiError,
  { scheduleId: string; gameId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId }: { scheduleId: string; gameId: string }) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        transitionScheduleToReady({
          identity: scheduleId,
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
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.topSixForGame(vars.gameId),
      });
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

// ──────────────────────────────────────────────────────────────────────
// Player-side hooks (US3)
// ──────────────────────────────────────────────────────────────────────

export type CharacterScheduleDay = {
  day: number;
  finalStatus: "NA" | "A" | null;
};

export type CharacterSchedule = Schedule & {
  scheduleDays: CharacterScheduleDay[];
};

export type CharacterScheduleDetail = Schedule & {
  scheduleDays: Array<Pick<ScheduleDayResourceSchema, "id" | "day" | "finalStatus" | "gmLockedNa"> & { scheduleId: string }>;
  participants: Array<ScheduleParticipant & { participantDays: ParticipantDay[] }>;
};

export type ParticipantDay = {
  id: string;
  participantId: string;
  scheduleId: string;
  day: number;
  status: "NA" | "I" | "A" | "IF" | "NP";
};

const PARTICIPANT_DAY_FIELDS = [
  "id",
  "participantId",
  "scheduleId",
  "day",
  "status",
] as const;

/** List every non-:preparing schedule the character is linked to. */
export function useListSchedulesForCharacter(
  playerId: string,
): UseQueryResult<CharacterSchedule[], ApiError> {
  return useQuery({
    queryKey: schedulesKeys.byCharacter(playerId),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<CharacterSchedule[]>(
        listSchedulesForCharacter({
          input: { playerId },
          fields: [
            ...SCHEDULE_FIELDS,
            { scheduleDays: ["day", "finalStatus"] },
          ] as unknown as Array<
            ScheduleResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: CharacterSchedule[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    enabled: playerId.length > 0,
  });
}

/** Get one schedule + the actor's participant + days (player-side). */
export function useGetScheduleForCharacter(
  input: GetScheduleForCharacterInput,
): UseQueryResult<CharacterScheduleDetail, ApiError> {
  return useQuery({
    queryKey: [...schedulesKeys.characterDetail(input.playerId, input.id), input],
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<CharacterScheduleDetail>(
        getScheduleForCharacter({
          input,
          fields: [
            ...SCHEDULE_FIELDS,
            { scheduleDays: PLAYER_SCHEDULE_DAY_FIELDS },
            {
              participants: [
                ...SCHEDULE_PARTICIPANT_FIELDS,
                { participantDays: PARTICIPANT_DAY_FIELDS },
              ],
            },
          ] as unknown as Array<ScheduleResourceSchema["__primitiveFields"]>,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: CharacterScheduleDetail }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    enabled: input.id.length > 0 && input.playerId.length > 0,
  });
}

/** Player toggles their per-day availability status. */
export type SetParticipantDayStatusArgs = SetParticipantDayStatusInput & {
  participantDayId: string;
  scheduleId: string;
  playerId: string;
};

export function useSetParticipantDayStatus(): UseMutationResult<
  ParticipantDay,
  ApiError,
  SetParticipantDayStatusArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: SetParticipantDayStatusArgs) => {
      const { participantDayId, status } = args;
      const { customFetch, headers } = getClientOptions();
      return runRpc<ParticipantDay>(
        setParticipantDayStatus({
          identity: participantDayId,
          input: { status },
          fields: PARTICIPANT_DAY_FIELDS as unknown as Array<
            "id" | "participantId" | "scheduleId" | "day" | "status"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: ParticipantDay }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.characterDetail(vars.playerId, vars.scheduleId),
      });
    },
  });
}

/** Player marks their availability submitted (FR-021). */
export function useSetScheduleParticipantSubmission(): UseMutationResult<
  ScheduleParticipant,
  ApiError,
  { participantId: string; scheduleId: string; playerId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ participantId }) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<ScheduleParticipant>(
        setScheduleParticipantSubmission({
          identity: participantId,
          fields: SCHEDULE_PARTICIPANT_FIELDS as unknown as Array<
            ScheduleParticipantResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: ScheduleParticipant }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.characterDetail(vars.playerId, vars.scheduleId),
      });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// US4 hooks (Scheduling View + Post)
// ──────────────────────────────────────────────────────────────────────

export interface UpdateScheduleFinalDayArgs {
  scheduleId: string;
  gameId: string;
  day: number;
  status: "NA" | "A";
}

/**
 * GM-only — set the Final value for a single day. Wraps the
 * batch `updateScheduleFinalDays` action with a single-element
 * `finalDays` list so the per-cell toggle in the Scheduling View
 * has a clean API. Allowed in `:ready_for_availability` (pre-post)
 * and in `:posted` (silent post-edit).
 */
export function useUpdateScheduleFinalDay(): UseMutationResult<
  Schedule,
  ApiError,
  UpdateScheduleFinalDayArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, day, status }: UpdateScheduleFinalDayArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        updateScheduleFinalDays({
          identity: scheduleId,
          input: { finalDays: [{ day, status }] },
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
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
    },
  });
}

/** GM-only — transition a `:ready_for_availability` schedule to `:posted`. */
export function usePostSchedule(): UseMutationResult<
  Schedule,
  ApiError,
  { scheduleId: string; gameId: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId }: { scheduleId: string; gameId: string }) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        postSchedule({
          identity: scheduleId,
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
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.topSixForGame(vars.gameId),
      });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// US8 hooks (Delete schedule)
// ──────────────────────────────────────────────────────────────────────

export interface DeleteScheduleArgs {
  scheduleId: string;
  gameId: string;
  confirmation: string;
}

/**
 * GM-only — destroy a Schedule (typed-confirmation gated). The
 * schedule_days/participants/participant_days rows cascade via the
 * DB FKs, and `Notification` rows for this subject are wiped in the
 * action's before_action callback.
 */
export function useDeleteSchedule(): UseMutationResult<
  void,
  ApiError,
  DeleteScheduleArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, confirmation }: DeleteScheduleArgs) => {
      const { customFetch, headers } = getClientOptions();
      const result = await deleteSchedule({
        identity: scheduleId,
        input: { confirmation },
        headers,
        ...(customFetch !== undefined ? { customFetch } : {}),
      });
      if (!result.success) {
        throw narrowApiError(result.errors);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.removeQueries({
        queryKey: schedulesKeys.detail(vars.scheduleId),
      });
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.topSixForGame(vars.gameId),
      });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// US6 hooks (Reminders)
// ──────────────────────────────────────────────────────────────────────

export interface SendReminderArgs {
  participantId: string;
  scheduleId: string;
  gameId: string;
}

/**
 * GM-only — fan out a `:schedule_reminder` notification + email
 * to a single non-submitted participant. No rate limit (FR-038);
 * every click materialises another bell entry.
 */
export function useSendReminder(): UseMutationResult<
  ScheduleParticipant,
  ApiError,
  SendReminderArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ participantId }: SendReminderArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<ScheduleParticipant>(
        sendScheduleReminder({
          identity: participantId,
          fields: SCHEDULE_PARTICIPANT_FIELDS as unknown as Array<
            ScheduleParticipantResourceSchema["__primitiveFields"]
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: ScheduleParticipant }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: (_data, vars) => {
      // Invalidate the detail key so the roster re-renders the
      // updated submitted_at / button state.
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.detail(vars.scheduleId),
      });
      void queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// US7 hooks (Update posted schedule)
// ──────────────────────────────────────────────────────────────────────

export interface UpdateScheduleFinalDaysBatchArgs {
  scheduleId: string;
  gameId: string;
  finalDays: Array<{ day: number; status: "NA" | "A" }>;
}

/**
 * GM-only — silent batch update of Final values on a posted (or
 * ready-for-availability) schedule. No notifications.
 */
export function useUpdateScheduleFinalDaysBatch(): UseMutationResult<
  Schedule,
  ApiError,
  UpdateScheduleFinalDaysBatchArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      finalDays,
    }: UpdateScheduleFinalDaysBatchArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        updateScheduleFinalDays({
          identity: scheduleId,
          input: { finalDays },
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
    onSuccess: async (_data, vars) => {
      // Await the refetch so the route's `mutateAsync` doesn't resolve
      // until the cache holds the new Final values. Otherwise clearing
      // local pending overlays flashes the stale persisted values.
      await queryClient.invalidateQueries({
        queryKey: schedulesKeys.detail(vars.scheduleId),
      });
      await queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
    },
  });
}

/**
 * GM-only — same shape as `useUpdateScheduleFinalDaysBatch`, but
 * fans out the `:schedule_updated` notification + email per
 * linked participant. Posted-only per the action's state guard.
 */
export function useUpdateScheduleFinalDaysAndNotify(): UseMutationResult<
  Schedule,
  ApiError,
  UpdateScheduleFinalDaysBatchArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      finalDays,
    }: UpdateScheduleFinalDaysBatchArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Schedule>(
        updateScheduleFinalDaysAndNotify({
          identity: scheduleId,
          input: { finalDays },
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
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: schedulesKeys.detail(vars.scheduleId),
      });
      await queryClient.invalidateQueries({
        queryKey: schedulesKeys.byGame(vars.gameId),
      });
    },
  });
}
