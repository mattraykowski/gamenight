import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  destroyGame,
  getMine,
  listMine,
  listMineActive,
  registerGame,
  updateGame,
  type AshRpcError,
  type GameResourceSchema,
  type RegisterGameInput,
  type UpdateGameInput,
} from "@/ash_rpc";
import { getClientOptions } from "@/lib/api/client";
import { narrowApiError, type ApiError } from "@/lib/api/errors";

/**
 * Shape the SPA passes around. Matches the generated
 * `GameResourceSchema` projected to the field list the feature
 * currently asks for — pick this explicitly so adding new columns
 * to the resource doesn't silently widen the SPA type.
 */
export type Game = Pick<GameResourceSchema, "id" | "title" | "description" | "status" | "isOwner">;

const GAME_FIELDS = ["id", "title", "description", "status", "isOwner"] as const;

export const gamesKeys = {
  all: ["games"] as const,
  active: () => [...gamesKeys.all, "active"] as const,
  mine: () => [...gamesKeys.all, "mine"] as const,
  detail: (id: string) => [...gamesKeys.all, "detail", id] as const,
};

async function runRpc<T>(
  call: Promise<{ success: true; data: T } | { success: false; errors: AshRpcError[] }>,
): Promise<T> {
  const result = await call;
  if (result.success) return result.data;
  throw narrowApiError(result.errors);
}

/**
 * Fetches the actor's Active games, sorted newest-updated first.
 * Backed by the `list_mine_active` named action; policy filters
 * ensure only the actor's rows are returned regardless of what the
 * client asks for.
 */
export function useListMineActive(): UseQueryResult<Game[], ApiError> {
  return useQuery({
    queryKey: gamesKeys.active(),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Game[]>(
        listMineActive({
          fields: GAME_FIELDS as unknown as Array<"id" | "title" | "description" | "status" | "isOwner">,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Game[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Fetches every one of the actor's games regardless of status.
 * Used by the "View All Games" page.
 */
export function useListMine(): UseQueryResult<Game[], ApiError> {
  return useQuery({
    queryKey: gamesKeys.mine(),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Game[]>(
        listMine({
          fields: GAME_FIELDS as unknown as Array<"id" | "title" | "description" | "status" | "isOwner">,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Game[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Fetches a single game owned by the current actor. Cross-tenant
 * access produces a not-found error the SPA renders as a dedicated
 * empty state.
 */
export function useGame(id: string): UseQueryResult<Game, ApiError> {
  return useQuery({
    queryKey: gamesKeys.detail(id),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Game>(
        getMine({
          input: { id },
          fields: GAME_FIELDS as unknown as Array<"id" | "title" | "description" | "status" | "isOwner">,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Game }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Registers a new game owned by the current actor. Invalidates the
 * games list queries so the dashboard picks up the new row on the
 * next render.
 */
export function useRegisterGame(): UseMutationResult<Game, ApiError, RegisterGameInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterGameInput) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Game>(
        registerGame({
          input,
          fields: GAME_FIELDS as unknown as Array<"id" | "title" | "description" | "status" | "isOwner">,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Game }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamesKeys.all });
    },
  });
}

/**
 * Updates an existing game. Invalidates both the detail cache entry
 * for the game and all list queries so the dashboard / all-games
 * table reflect the change (including status transitions like
 * Active → Paused, which should make the game disappear from
 * "My Active Games").
 */
export type UpdateGameArgs = UpdateGameInput & { id: string };

export function useUpdateGame(): UseMutationResult<Game, ApiError, UpdateGameArgs> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateGameArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Game>(
        updateGame({
          identity: id,
          input,
          fields: GAME_FIELDS as unknown as Array<"id" | "title" | "description" | "status" | "isOwner">,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Game }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(gamesKeys.detail(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: gamesKeys.all });
    },
  });
}

/**
 * Destroys a game owned by the current actor. On success the detail
 * cache entry is removed and all list queries are invalidated so the
 * row disappears from the dashboard and all-games table.
 */
export function useDestroyGame(): UseMutationResult<void, ApiError, { id: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { customFetch, headers } = getClientOptions();
      const result = await destroyGame({
        identity: id,
        headers,
        ...(customFetch !== undefined ? { customFetch } : {}),
      });
      if (!result.success) {
        throw narrowApiError(result.errors);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.removeQueries({ queryKey: gamesKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: gamesKeys.all });
    },
  });
}
