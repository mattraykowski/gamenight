import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  listMyCharacters,
  listPlayersForGame,
  listPlayersForGm,
  updatePlayer,
  type AshRpcError,
  type PlayerResourceSchema,
  type UpdatePlayerInput,
} from "@/ash_rpc";
import { gamesKeys } from "@/features/games/hooks";
import { getClientOptions } from "@/lib/api/client";
import { narrowApiError, type ApiError } from "@/lib/api/errors";

/**
 * Public roster shape — no `visibleGmNotes`. Used by both seated
 * players and the GM when the GM wants the lighter payload.
 */
export type Player = Pick<
  PlayerResourceSchema,
  "id" | "characterName" | "characterSummary" | "status"
>;

/**
 * GM-side roster shape — includes `visibleGmNotes`. The field's
 * value is `null` for any non-GM caller (the field policy gates
 * it), so this type is a strict superset; the SPA branches on the
 * route's hook (`useListPlayersForGm` vs `useListPlayersForGame`)
 * rather than on the field's nullity.
 */
export type PlayerWithGmNotes = Pick<
  PlayerResourceSchema,
  "id" | "characterName" | "characterSummary" | "status" | "visibleGmNotes"
>;

const PLAYER_FIELDS = ["id", "characterName", "characterSummary", "status"] as const;

const PLAYER_GM_FIELDS = [
  "id",
  "characterName",
  "characterSummary",
  "status",
  "visibleGmNotes",
] as const;

export const playersKeys = {
  all: ["players"] as const,
  forGame: (gameId: string) => [...playersKeys.all, "byGame", gameId] as const,
  forGm: (gameId: string) => [...playersKeys.all, "byGame", gameId, "gm"] as const,
  mine: () => [...playersKeys.all, "mine"] as const,
};

async function runRpc<T>(
  call: Promise<{ success: true; data: T } | { success: false; errors: AshRpcError[] }>,
): Promise<T> {
  const result = await call;
  if (result.success) return result.data;
  throw narrowApiError(result.errors);
}

/**
 * Lists the seated players on a game. Admits the GM and any seated
 * player; does not include `visibleGmNotes`.
 */
export function useListPlayersForGame(gameId: string): UseQueryResult<Player[], ApiError> {
  return useQuery({
    queryKey: playersKeys.forGame(gameId),
    enabled: gameId.length > 0,
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Player[]>(
        listPlayersForGame({
          input: { gameId },
          fields: PLAYER_FIELDS as unknown as Array<
            "id" | "characterName" | "characterSummary" | "status"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Player[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * GM-only roster including `visibleGmNotes`. The SPA mounts this
 * hook only on the GM-owned `/games/:id` view; for non-GM viewers,
 * the lighter `useListPlayersForGame` is used.
 */
export function useListPlayersForGm(gameId: string): UseQueryResult<PlayerWithGmNotes[], ApiError> {
  return useQuery({
    queryKey: playersKeys.forGm(gameId),
    enabled: gameId.length > 0,
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<PlayerWithGmNotes[]>(
        listPlayersForGm({
          input: { gameId },
          fields: PLAYER_GM_FIELDS as unknown as Array<
            "id" | "characterName" | "characterSummary" | "status" | "visibleGmNotes"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: PlayerWithGmNotes[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Lists the actor's own Player rows. Drives the dashboard's "My
 * Characters" column (US5) and the `/characters` route.
 */
export function useListMyCharacters(): UseQueryResult<Player[], ApiError> {
  return useQuery({
    queryKey: playersKeys.mine(),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Player[]>(
        listMyCharacters({
          fields: PLAYER_FIELDS as unknown as Array<
            "id" | "characterName" | "characterSummary" | "status"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Player[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * GM-only update of a player's character data and status.
 * Invalidates both the player-side and GM-side roster caches plus
 * the games query (status changes can affect dashboard sections).
 *
 * The id is taken via `identity` per ash_typescript's update-action
 * convention; the `input` carries only mutable attributes.
 */
export type UpdatePlayerArgs = UpdatePlayerInput & { id: string };

export function useUpdatePlayer(): UseMutationResult<
  PlayerWithGmNotes,
  ApiError,
  UpdatePlayerArgs
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePlayerArgs) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<PlayerWithGmNotes>(
        updatePlayer({
          identity: id,
          input,
          fields: PLAYER_GM_FIELDS as unknown as Array<
            "id" | "characterName" | "characterSummary" | "status" | "visibleGmNotes"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: PlayerWithGmNotes }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: playersKeys.all });
      void queryClient.invalidateQueries({ queryKey: gamesKeys.all });
    },
  });
}
