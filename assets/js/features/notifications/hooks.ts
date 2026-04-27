import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  countMyUnread,
  listMyNotifications,
  markNotificationRead,
  type AshRpcError,
  type NotificationResourceSchema,
} from "@/ash_rpc";
import { invitationsKeys } from "@/features/invitations/hooks";
import { getClientOptions } from "@/lib/api/client";
import { narrowApiError, type ApiError } from "@/lib/api/errors";

/**
 * Notification row shape the SPA passes around. Picked explicitly
 * from the generated schema so adding columns to the resource
 * doesn't silently widen the SPA type.
 */
export type Notification = Pick<
  NotificationResourceSchema,
  "id" | "kind" | "subjectType" | "subjectId" | "readAt" | "resolvedAt" | "insertedAt"
>;

const NOTIFICATION_FIELDS = [
  "id",
  "kind",
  "subjectType",
  "subjectId",
  "readAt",
  "resolvedAt",
  "insertedAt",
] as const;

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationsKeys.all, "list"] as const,
  unreadCount: () => [...notificationsKeys.all, "unreadCount"] as const,
};

async function runRpc<T>(
  call: Promise<{ success: true; data: T } | { success: false; errors: AshRpcError[] }>,
): Promise<T> {
  const result = await call;
  if (result.success) return result.data;
  throw narrowApiError(result.errors);
}

/**
 * Lists the current user's notifications, newest first.
 */
export function useMyNotifications(): UseQueryResult<Notification[], ApiError> {
  return useQuery({
    queryKey: notificationsKeys.list(),
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Notification[]>(
        listMyNotifications({
          fields: NOTIFICATION_FIELDS as unknown as Array<
            "id" | "kind" | "subjectType" | "subjectId" | "readAt" | "resolvedAt" | "insertedAt"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Notification[] }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Polls the unread+unresolved count for the bell badge. Refetches
 * every 60s while the tab is visible (TanStack Query pauses
 * `refetchInterval` automatically when the tab is hidden) and on
 * window focus.
 */
export function useUnreadCount(): UseQueryResult<number, ApiError> {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<number>(
        countMyUnread({
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: number }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
  });
}

/**
 * Marks a single notification as read. Invalidates both the
 * notifications list and the unread-count badge query so the bell's
 * badge clears alongside the list.
 */
export function useMarkRead(): UseMutationResult<Notification, ApiError, { id: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { customFetch, headers } = getClientOptions();
      return runRpc<Notification>(
        markNotificationRead({
          identity: id,
          fields: NOTIFICATION_FIELDS as unknown as Array<
            "id" | "kind" | "subjectType" | "subjectId" | "readAt" | "resolvedAt" | "insertedAt"
          >,
          headers,
          ...(customFetch !== undefined ? { customFetch } : {}),
        }) as Promise<
          | { success: true; data: Notification }
          | { success: false; errors: AshRpcError[] }
        >,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
      // Pending-invitation list mirrors the bell's surface, so refresh
      // it too — once US6's bell wires accept/decline through this
      // mutation the cascade keeps both views consistent.
      void queryClient.invalidateQueries({ queryKey: invitationsKeys.all });
    },
  });
}
