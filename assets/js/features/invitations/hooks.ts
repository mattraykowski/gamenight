import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  acceptInvitation,
  createInvitation,
  listMyPendingInvitations,
  previewInvitation,
  type AcceptInvitationInput,
  type AshRpcError,
  type CreateInvitationInput,
  type InvitationResourceSchema,
  type PreviewInvitationInput,
} from "@/ash_rpc";
import { gamesKeys } from "@/features/games/hooks";
import { getClientOptions } from "@/lib/api/client";
import { narrowApiError, type ApiError } from "@/lib/api/errors";

/**
 * Pending-invitation row shape the SPA passes around. Picked
 * explicitly from the generated schema so adding columns to the
 * resource doesn't silently widen the SPA type.
 */
export type Invitation = Pick<
  InvitationResourceSchema,
  "id" | "email" | "characterName" | "characterSummary" | "status" | "expiresAt"
>;

/**
 * Token-preview shape returned by `previewInvitation`. The SPA's
 * `/invitations/:token` route renders the accept screen from this.
 */
export interface InvitationPreview {
  id: string;
  gameTitle: string;
  inviterEmail: string;
  characterName: string;
  expiresAt: string;
}

/**
 * Result shape of `acceptInvitation` — a small action map (see
 * `lib/game_night/games/invitation/actions/accept_invitation.ex`).
 */
export interface AcceptInvitationResult {
  id: string;
  status: string;
  acceptedPlayerId: string | null;
}

const INVITATION_FIELDS = [
  "id",
  "email",
  "characterName",
  "characterSummary",
  "status",
  "expiresAt",
] as const;

const PREVIEW_FIELDS = [
  "id",
  "gameTitle",
  "inviterEmail",
  "characterName",
  "expiresAt",
] as const;

const ACCEPT_FIELDS = ["id", "status", "acceptedPlayerId"] as const;

export const invitationsKeys = {
  all: ["invitations"] as const,
  preview: (token: string) => [...invitationsKeys.all, "preview", token] as const,
  myPending: () => [...invitationsKeys.all, "myPending"] as const,
};

async function runRpc<T>(
  call: Promise<{ success: true; data: T } | { success: false; errors: AshRpcError[] }>,
): Promise<T> {
  const result = await call;
  if (result.success) return result.data;
  throw narrowApiError(result.errors);
}

/**
 * GM-side mutation that creates an invitation for one of their games.
 * On success, invalidates game queries so the GM-facing pending list
 * (added in US3) and the dashboard reflect any state changes that
 * derive from the new invitation.
 */
export function useCreateInvitation(): UseMutationResult<
  Invitation,
  ApiError,
  CreateInvitationInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Invitation>(
        createInvitation({
          input,
          fields: INVITATION_FIELDS as unknown as Array<
            "id" | "email" | "characterName" | "characterSummary" | "status" | "expiresAt"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Invitation }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: () => {
      // Refresh anything that surfaces invitations alongside game data —
      // the game-detail screen's roster + pending list (US3) and the
      // dashboard. Specific notification + my-pending invalidations
      // land with US2 / US6 once those query keys exist.
      void queryClient.invalidateQueries({ queryKey: gamesKeys.all });
    },
  });
}

/**
 * Lists the current actor's pending invitations (matched by their
 * primary email). Drives the `/invitations` index route — the
 * recipient-facing view of "what's waiting for me".
 */
export function useListMyPendingInvitations(): UseQueryResult<Invitation[], ApiError> {
  return useQuery({
    queryKey: invitationsKeys.myPending(),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Invitation[]>(
        listMyPendingInvitations({
          fields: INVITATION_FIELDS as unknown as Array<
            "id" | "email" | "characterName" | "characterSummary" | "status" | "expiresAt"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Invitation[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Resolves a preview from a token without authenticating the caller.
 * Used by the `/invitations/:token` route to render the accept
 * screen for both anonymous and signed-in viewers.
 */
export function useInvitationPreview(token: string): UseQueryResult<InvitationPreview, ApiError> {
  return useQuery({
    queryKey: invitationsKeys.preview(token),
    enabled: token.length > 0,
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      const input: PreviewInvitationInput = { token };
      return runRpc<InvitationPreview>(
        previewInvitation({
          input,
          fields: PREVIEW_FIELDS as unknown as Array<
            "id" | "gameTitle" | "inviterEmail" | "characterName" | "expiresAt"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: InvitationPreview }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Accepts an invitation — backed by the generic-action wrapper that
 * lets a recipient with any email accept via the token they hold.
 * On success invalidates game queries so the new game shows up on
 * the dashboard / "My Characters" surfaces in subsequent stories.
 */
export function useAcceptInvitation(): UseMutationResult<
  AcceptInvitationResult,
  ApiError,
  AcceptInvitationInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AcceptInvitationInput) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<AcceptInvitationResult>(
        acceptInvitation({
          input,
          fields: ACCEPT_FIELDS as unknown as Array<"id" | "status" | "acceptedPlayerId">,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: AcceptInvitationResult }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamesKeys.all });
      void queryClient.invalidateQueries({ queryKey: invitationsKeys.all });
    },
  });
}
