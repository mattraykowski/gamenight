# Contract: `ash_typescript` RPC surface for Game

**Feature**: 001-register-game
**Data model**: [../data-model.md](../data-model.md)
**Sibling**: [json-api.md](./json-api.md)

This document describes the `AshTypescript.Rpc` bindings generated
for the Game resource. The SPA consumes this surface via the
`createResourceHooks` factory (established by the auth work), so
this contract is what feature-level hooks (`useGame`,
`useListMineActive`, etc.) wrap.

## Domain wiring

```elixir
# lib/game_night/games.ex
defmodule GameNight.Games do
  use Ash.Domain,
    otp_app: :game_night,
    extensions: [AshJsonApi.Domain, AshTypescript.Rpc]

  typescript_rpc do
    resource GameNight.Games.Game do
      rpc_action :list_mine_active, :list_mine_active
      rpc_action :list_mine, :list_mine
      rpc_action :get_mine, :get_mine
      rpc_action :register_game, :register
      rpc_action :update_game, :update
      rpc_action :destroy_game, :destroy
    end
  end

  resources do
    resource GameNight.Games.Game
  end
end
```

The RPC names are chosen for readable client call sites
(`registerGame(…)` beats `register(…)` which reads like a React
Router utility). The underscore-to-camel-case conversion is applied
by `ash_typescript`.

## Route

All RPC calls land at `POST /rpc/run` with the body:

```json
{
  "action": "list_mine_active",
  "input": {},
  "fields": ["id", "title", "description", "status", "updated_at"]
}
```

Same endpoint currently used by `readCurrentUser`. No new Phoenix
routes; `ash_typescript` registers the Game resource with the
existing `AshTypescriptRpcController`.

## Generated client shape

After running `mix ash_typescript.codegen`, `assets/js/ash_rpc.ts`
exports the following functions:

```ts
export async function listMineActive(config: {
  fields: ReadonlyArray<"id" | "title" | "description" | "status" | "inserted_at" | "updated_at" | "owner">;
  headers?: Record<string, string>;
  customFetch?: typeof fetch;
  // …standard AshTypescript config options
}): Promise<
  | { success: true; data: Game[] }
  | { success: false; errors: AshRpcError[] }
>;

export async function listMine(config: { …same shape… }): Promise<…>;
export async function getMine(config: {
  input: { id: string };
  fields: …;
  …;
}): Promise<{ success: true; data: Game } | { success: false; errors: AshRpcError[] }>;

export async function registerGame(config: {
  input: { title: string; description?: string | null; status: GameStatus };
  fields: …;
  …;
}): Promise<…>;

export async function updateGame(config: {
  input: { id: string; title?: string; description?: string | null; status?: GameStatus };
  fields: …;
  …;
}): Promise<…>;

export async function destroyGame(config: {
  input: { id: string };
  …;
}): Promise<{ success: true } | { success: false; errors: AshRpcError[] }>;
```

`GameStatus` is a string-literal union `"active" | "paused" |
"cancelled" | "completed"` generated from the `constraints one_of`
atom list (lowercased per existing convention).

## Feature-level hook shape

Per AGENTS.md the SPA wraps generated functions. The hooks live in
`assets/js/features/games/hooks.ts`:

```ts
export const gamesKeys = {
  all: ["games"] as const,
  active: () => [...gamesKeys.all, "active"] as const,
  mine: () => [...gamesKeys.all, "mine"] as const,
  detail: (id: string) => [...gamesKeys.all, "detail", id] as const,
};

export function useListMineActive(): UseQueryResult<Game[], ApiError>;
export function useListMine():        UseQueryResult<Game[], ApiError>;
export function useGame(id: string):  UseQueryResult<Game, ApiError>;

export function useRegisterGame():    UseMutationResult<Game, ApiError, RegisterGameInput>;
export function useUpdateGame():      UseMutationResult<Game, ApiError, UpdateGameInput>;
export function useDestroyGame():     UseMutationResult<void,  ApiError, { id: string }>;
```

- Queries use the existing `createResourceHooks` factory pattern for
  envelope normalisation and error-narrowing.
- Mutations invalidate the appropriate keys on success:
  `useRegisterGame` invalidates `gamesKeys.all`; `useUpdateGame`
  invalidates the specific `detail(id)` key and `gamesKeys.all`;
  `useDestroyGame` removes the `detail(id)` key and invalidates
  `gamesKeys.all`.
- Post-mutation toasts ride the toast provider added in the auth
  work: `game_created`, `game_updated`, `game_deleted` added to
  the `TOAST_MESSAGES` whitelist.

## Errors surfaced by the hooks

`narrowApiError` (existing helper in `assets/js/lib/api/errors.ts`)
maps the raw `AshRpcError[]` into the discriminated `ApiError` union
the SPA already understands:

- `kind: "validation"` for `invalid_attribute` (e.g., empty title).
  The component maps the error to React Hook Form's `setError`.
- `kind: "auth"` (401) for an expired session — the existing
  `createAuthedFetch` interceptor handles the redirect.
- `kind: "network"` for a failed fetch; the UI shows a retry state.
- `kind: "unknown"` as the fallback.

`forbidden` (403) does not appear — the ownership policy produces
`not_found` at the Ash layer and `404` at the transport.

## Test strategy

- **Contract test** (`test/game_night/games/game_test.exs`): assert
  `AshTypescript.Rpc.actions_for(GameNight.Games)` lists exactly the
  six actions we declared. This fails loudly if someone drops or
  renames an RPC binding without updating the SPA.
- **Unit tests** in `assets/js/features/games/hooks.test.ts`:
  MSW mocks `/rpc/run` with per-action responses; each hook's
  happy path and primary error branch is tested.
- **Generated-client drift**: `mix ash_typescript.codegen` +
  `git diff --exit-code` is the constitution's gate. The Games
  domain and resource must be checked in before hook code compiles.
