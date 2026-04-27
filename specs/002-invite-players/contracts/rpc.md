# Contract: `ash_typescript` RPC surface for Invite Players

**Feature**: 002-invite-players
**Data model**: [../data-model.md](../data-model.md)
**Sibling**: [json-api.md](./json-api.md)

This document describes the `AshTypescript.Rpc` bindings generated
for the new resources. The SPA consumes this surface via the
`createResourceHooks` factory pattern established by feature 001.

## Domain wiring

### `GameNight.Games`

```elixir
typescript_rpc do
  resource GameNight.Games.Game do
    rpc_action :list_mine_active, :list_mine_active
    rpc_action :list_mine, :list_mine
    rpc_action :get_mine, :get_mine
    rpc_action :register_game, :register
    rpc_action :update_game, :update
    rpc_action :destroy_game, :destroy
  end

  resource GameNight.Games.Player do
    rpc_action :list_players_for_game, :list_for_game
    rpc_action :list_players_for_gm,   :list_for_gm
    rpc_action :list_my_characters,    :list_mine
    rpc_action :update_player,         :update
  end

  resource GameNight.Games.Invitation do
    rpc_action :list_pending_invitations_for_game, :list_pending_for_game
    rpc_action :list_my_pending_invitations,       :list_pending_for_me
    rpc_action :preview_invitation,                :preview_with_token
    rpc_action :create_invitation,                 :create_for_game
    rpc_action :accept_invitation,                 :accept_with_token
    rpc_action :decline_invitation,                :decline_with_token
    rpc_action :revoke_invitation,                 :revoke
  end
end
```

### `GameNight.Notifications`

```elixir
typescript_rpc do
  resource GameNight.Notifications.Notification do
    rpc_action :list_my_notifications, :list_mine
    rpc_action :count_my_unread,       :count_unread
    rpc_action :mark_notification_read,:mark_read
  end
end
```

System actions (`:create_for_invitation`, `:resolve_for_subject`)
are **not** declared in `typescript_rpc` — they are internal.

## Route

All RPC calls land at the existing `POST /rpc/run`. No new Phoenix
routes.

## Generated client shape

After `mix ash_typescript.codegen`, `assets/js/ash_rpc.ts` exports:

```ts
// Players
export async function listPlayersForGame(config: {
  input: { game_id: string };
  fields: ReadonlyArray<"id" | "character_name" | "character_summary" | "status" | "user" | "game" | "inserted_at" | "updated_at">;
  …
}): Promise<{ success: true; data: Player[] } | { success: false; errors: AshRpcError[] }>;

export async function listPlayersForGm(config: {
  input: { game_id: string };
  fields: ReadonlyArray<"id" | "character_name" | "character_summary" | "status" | "visible_gm_notes" | "user" | "game" | "inserted_at" | "updated_at">;
  …
}): Promise<{ success: true; data: PlayerWithGmNotes[] } | { success: false; errors: AshRpcError[] }>;

export async function listMyCharacters(config: {
  fields: ReadonlyArray<"id" | "character_name" | "character_summary" | "status" | "game" | "updated_at">;
  …
}): Promise<{ success: true; data: Player[] } | { success: false; errors: AshRpcError[] }>;

export async function updatePlayer(config: {
  input: {
    id: string;
    character_name?: string;
    character_summary?: string | null;
    gm_notes?: string | null;
    status?: PlayerStatus;
  };
  fields: …;
  …
}): Promise<…>;

// Invitations
export async function createInvitation(config: {
  input: {
    game_id: string;
    email: string;
    character_name: string;
    character_summary?: string | null;
    gm_notes?: string | null;
  };
  fields: …;
  …
}): Promise<{ success: true; data: Invitation } | { success: false; errors: AshRpcError[] }>;

export async function listPendingInvitationsForGame(config: {
  input: { game_id: string };
  fields: …;
  …
}): Promise<…>;

export async function listMyPendingInvitations(config: {
  fields: …;
  …
}): Promise<…>;

export async function previewInvitation(config: {
  input: { token: string };
  …
}): Promise<{
  success: true;
  data: {
    id: string;
    game_title: string;
    inviter_email: string;
    character_name: string;
    expires_at: string;
  };
} | { success: false; errors: AshRpcError[] }>;

export async function acceptInvitation(config: {
  input: { id: string; token: string };
  fields: …;
  …
}): Promise<…>;

export async function declineInvitation(config: {
  input: { id: string; token: string };
  fields: …;
  …
}): Promise<…>;

export async function revokeInvitation(config: {
  input: { id: string };
  …
}): Promise<…>;

// Notifications
export async function listMyNotifications(config: {
  input?: { unread_only?: boolean };
  fields: ReadonlyArray<"id" | "kind" | "subject_type" | "subject_id" | "read_at" | "resolved_at" | "inserted_at">;
  …
}): Promise<{ success: true; data: Notification[] } | { success: false; errors: AshRpcError[] }>;

export async function countMyUnread(config: {
  …
}): Promise<{ success: true; data: { count: number } } | { success: false; errors: AshRpcError[] }>;

export async function markNotificationRead(config: {
  input: { id: string };
  …
}): Promise<…>;
```

`PlayerStatus` is a string-literal union `"active" | "inactive" | "done"`.

## Feature-level hook shape

Per AGENTS.md the SPA wraps generated functions. Hooks live in
three new feature folders.

### `assets/js/features/players/hooks.ts`

```ts
export const playersKeys = {
  all: ["players"] as const,
  forGame: (gameId: string) => [...playersKeys.all, "byGame", gameId] as const,
  forGm: (gameId: string) => [...playersKeys.all, "byGame", gameId, "gm"] as const,
  mine: () => [...playersKeys.all, "mine"] as const,
};

export function useListPlayersForGame(gameId: string): UseQueryResult<Player[], ApiError>;
export function useListPlayersForGm(gameId: string): UseQueryResult<PlayerWithGmNotes[], ApiError>;
export function useListMyCharacters(): UseQueryResult<Player[], ApiError>;

export function useUpdatePlayer(): UseMutationResult<Player, ApiError, UpdatePlayerInput>;
```

### `assets/js/features/invitations/hooks.ts`

```ts
export const invitationsKeys = {
  all: ["invitations"] as const,
  pendingForGame: (gameId: string) => [...invitationsKeys.all, "pending", "byGame", gameId] as const,
  myPending: () => [...invitationsKeys.all, "pending", "mine"] as const,
  preview: (token: string) => [...invitationsKeys.all, "preview", token] as const,
};

export function useListPendingInvitationsForGame(gameId: string): UseQueryResult<Invitation[], ApiError>;
export function useListMyPendingInvitations(): UseQueryResult<Invitation[], ApiError>;
export function useInvitationPreview(token: string): UseQueryResult<InvitationPreview, ApiError>;

export function useCreateInvitation(): UseMutationResult<Invitation, ApiError, CreateInvitationInput>;
export function useAcceptInvitation(): UseMutationResult<Invitation, ApiError, AcceptInvitationInput>;
export function useDeclineInvitation(): UseMutationResult<Invitation, ApiError, DeclineInvitationInput>;
export function useRevokeInvitation(): UseMutationResult<Invitation, ApiError, { id: string }>;
```

### `assets/js/features/notifications/hooks.ts`

```ts
export const notificationsKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly: boolean) => [...notificationsKeys.all, "list", unreadOnly] as const,
  unreadCount: () => [...notificationsKeys.all, "unreadCount"] as const,
};

export function useMyNotifications(opts?: { unreadOnly?: boolean }): UseQueryResult<Notification[], ApiError>;
export function useUnreadCount(): UseQueryResult<number, ApiError>;
export function useMarkRead(): UseMutationResult<Notification, ApiError, { id: string }>;
```

The `useUnreadCount` hook sets `refetchInterval: 60_000` and
`refetchOnWindowFocus: true`. The bell renders the count from this
hook directly; mutation handlers (accept/decline/revoke) invalidate
both the count and the notifications list keys to keep the badge
honest.

## Mutation invalidation summary

| Mutation                  | Invalidates                                                                                       |
|---------------------------|---------------------------------------------------------------------------------------------------|
| `useCreateInvitation`     | `invitationsKeys.pendingForGame(gameId)`; `notificationsKeys.all` (server may have created one).  |
| `useAcceptInvitation`     | `invitationsKeys.all`; `notificationsKeys.all`; `playersKeys.mine()`; `playersKeys.forGame(gameId)`; `gamesKeys.detail(gameId)`. |
| `useDeclineInvitation`    | `invitationsKeys.myPending()`; `notificationsKeys.all`.                                           |
| `useRevokeInvitation`     | `invitationsKeys.pendingForGame(gameId)`; `notificationsKeys.all`.                                |
| `useUpdatePlayer`         | `playersKeys.forGame(gameId)`; `playersKeys.forGm(gameId)`; `playersKeys.mine()`.                  |
| `useMarkRead`             | `notificationsKeys.list(*)`; `notificationsKeys.unreadCount()`.                                   |

## Errors

`narrowApiError` from `assets/js/lib/api/errors.ts` extends with one
new branch:

- `kind: "invalid_token"` for `invalid_token` error code (token
  expired/revoked/malformed). The accept/decline/preview UIs render
  a specific friendly message ("This invitation link is no longer
  valid…") rather than the generic validation copy.

All other branches (`validation`, `auth`, `network`, `unknown`,
`conflict`) are reused.

## Test strategy

- **Contract tests** (per domain): assert
  `AshTypescript.Rpc.actions_for(GameNight.Games)` and
  `AshTypescript.Rpc.actions_for(GameNight.Notifications)` list
  exactly the actions declared above. Fails loudly on drift.
- **Hook tests** (`assets/js/features/{players,invitations,notifications}/hooks.test.ts`):
  MSW mocks `/rpc/run` per action; each hook's happy path and
  primary error branch is tested. The
  `useAcceptInvitation`/`useDeclineInvitation` tests assert the
  invalidation cascade by spying on the QueryClient's
  `invalidateQueries` method.
- **Generated-client drift**: `mix ash_typescript.codegen` +
  `git diff --exit-code` is the constitution gate.
