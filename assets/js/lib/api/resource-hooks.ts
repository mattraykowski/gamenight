import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { buildCSRFHeaders, type AshRpcError } from "@/ash_rpc";
import { narrowApiError, type ApiError } from "./errors";

/**
 * The envelope returned by every `ash_typescript`-generated RPC function.
 * `createResourceHooks` unwraps it so that React components receive plain
 * data on success or throw a narrowed {@link ApiError} on failure.
 */
export type AshResult<T> =
  | { success: true; data: T; metadata?: Record<string, unknown> }
  | { success: false; errors: AshRpcError[] };

export type ActionFn<TData, TConfig> = (config: TConfig) => Promise<AshResult<TData>>;

/**
 * A subset of the functions produced by `mix ash_typescript.codegen` for a
 * single resource. Consumers pass only the actions they exposed on the
 * Elixir side; the factory no-ops the rest.
 */
export interface GeneratedActions<TList = unknown, TItem = unknown> {
  list?: ActionFn<TList[], Record<string, unknown>>;
  get?: ActionFn<TItem, Record<string, unknown>>;
  create?: ActionFn<TItem, Record<string, unknown>>;
  update?: ActionFn<TItem, Record<string, unknown>>;
  destroy?: ActionFn<unknown, Record<string, unknown>>;
}

export interface ResourceHooksOptions<TFields> {
  /** Stable, hierarchical namespace for every query key this resource produces. */
  name: string;
  /** Default `fields` selection sent with every read unless the caller overrides. */
  defaultFields?: TFields;
  /**
   * Returns the per-request client overrides merged into every generated
   * action's config — typically used to inject an `authedFetch`
   * `customFetch` and shared headers. The function is called on every
   * request so the CSRF token stays live even if Phoenix rotates it.
   */
  clientOptions?: () => {
    customFetch?: typeof fetch;
    headers?: Record<string, string>;
  };
}

/**
 * Creates the hierarchical query-key factory for a given resource. Kept
 * separate so tests and non-hook code paths can build keys without
 * importing React.
 *
 * Layout:
 *   [name]                       - everything for this resource
 *   [name, 'list']               - every list query
 *   [name, 'list', params]       - a specific list query (for invalidation)
 *   [name, 'detail']             - every detail query
 *   [name, 'detail', identity]   - a specific detail query
 */
export function createResourceKeys(name: string) {
  const all = [name] as const;
  const lists = () => [...all, "list"] as const;
  const list = (params?: unknown) => [...lists(), params ?? null] as const;
  const details = () => [...all, "detail"] as const;
  const detail = (identity: unknown) => [...details(), identity] as const;
  return { all, lists, list, details, detail };
}

export type ResourceKeys = ReturnType<typeof createResourceKeys>;

export interface ListArgs<TFields> {
  fields?: TFields;
  filter?: Record<string, unknown>;
  sort?: string | string[];
  page?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

export interface GetArgs<TFields> {
  fields?: TFields;
  input?: Record<string, unknown>;
  identity?: unknown;
}

/**
 * Wraps `ash_typescript`-generated action functions in TanStack Query
 * hooks. Every component hook shares:
 *
 *   - a hierarchical query-key factory (see {@link createResourceKeys})
 *   - envelope normalization — `{ success: true, data }` unwraps to `data`;
 *     `{ success: false, errors }` throws a narrowed {@link ApiError} so
 *     components can `switch(error.kind)` without string-matching
 *   - automatic CSRF header injection on every mutation via
 *     `buildCSRFHeaders()`
 *   - conventional cache invalidation on mutation success
 *
 * Components never import the generated RPC functions directly; instead
 * they compose these hooks per the constitution's API-client integration
 * rules (see AGENTS.md → "API client integration").
 */
export function createResourceHooks<TList, TItem, TFields>(
  actions: GeneratedActions<TList, TItem>,
  options: ResourceHooksOptions<TFields>,
) {
  const keys = createResourceKeys(options.name);

  async function runAction<T>(
    fn: ActionFn<T, Record<string, unknown>> | undefined,
    action: string,
    config: Record<string, unknown>,
  ): Promise<T> {
    if (!fn) {
      throw Object.assign(new Error(`${options.name}: ${action} action not provided`), {
        kind: "unknown",
      });
    }
    const shared = options.clientOptions?.() ?? {};
    const mergedHeaders = {
      ...(shared.headers ?? {}),
      ...((config.headers as Record<string, string> | undefined) ?? {}),
    };
    const merged: Record<string, unknown> = { ...config };
    if (shared.customFetch !== undefined) merged.customFetch = shared.customFetch;
    if (Object.keys(mergedHeaders).length > 0) merged.headers = mergedHeaders;

    const result = await fn(merged);
    if (result.success) return result.data;
    throw narrowApiError(result.errors);
  }

  function useList(
    args?: ListArgs<TFields>,
    queryOptions?: Omit<
      UseQueryOptions<TList[], ApiError, TList[], ReturnType<typeof keys.list>>,
      "queryKey" | "queryFn"
    >,
  ) {
    // `runAction`, `actions.list`, and `options.defaultFields` are all
    // captured once when the factory is instantiated — they are stable
    // by construction, not per render — so the exhaustive-deps rule's
    // warning is a false positive.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    return useQuery<TList[], ApiError, TList[], ReturnType<typeof keys.list>>({
      queryKey: keys.list(args ?? null),
      queryFn: () =>
        runAction<TList[]>(actions.list, "list", {
          fields: args?.fields ?? options.defaultFields,
          ...(args?.filter !== undefined && { filter: args.filter }),
          ...(args?.sort !== undefined && { sort: args.sort }),
          ...(args?.page !== undefined && { page: args.page }),
          ...(args?.input !== undefined && { input: args.input }),
        }),
      ...queryOptions,
    });
  }

  function useGet(
    args?: GetArgs<TFields>,
    queryOptions?: Omit<
      UseQueryOptions<TItem, ApiError, TItem, ReturnType<typeof keys.detail>>,
      "queryKey" | "queryFn"
    >,
  ) {
    const identity = args?.identity ?? args?.input ?? null;
    // See useList — the closure's dependencies are factory-scoped, not
    // render-scoped, so the exhaustive-deps rule would force us to leak
    // implementation details into the queryKey.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    return useQuery<TItem, ApiError, TItem, ReturnType<typeof keys.detail>>({
      queryKey: keys.detail(identity),
      queryFn: () =>
        runAction<TItem>(actions.get, "get", {
          fields: args?.fields ?? options.defaultFields,
          ...(args?.input !== undefined && { input: args.input }),
          ...(args?.identity !== undefined && { identity: args.identity }),
        }),
      ...queryOptions,
    });
  }

  function useCreate(
    mutationOptions?: Omit<
      UseMutationOptions<TItem, ApiError, Record<string, unknown>>,
      "mutationFn"
    > & { fields?: TFields },
  ) {
    const queryClient = useQueryClient();
    const { fields, ...rest } = mutationOptions ?? {};
    return useMutation<TItem, ApiError, Record<string, unknown>>({
      mutationFn: (input) =>
        runAction<TItem>(actions.create, "create", {
          fields: fields ?? options.defaultFields,
          input,
          headers: buildCSRFHeaders(),
        }),
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: keys.lists() });
        rest.onSuccess?.(data, variables, onMutateResult, context);
      },
      ...rest,
    });
  }

  function useUpdate(
    mutationOptions?: Omit<
      UseMutationOptions<TItem, ApiError, { identity: unknown; input: Record<string, unknown> }>,
      "mutationFn"
    > & { fields?: TFields },
  ) {
    const queryClient = useQueryClient();
    const { fields, ...rest } = mutationOptions ?? {};
    return useMutation<TItem, ApiError, { identity: unknown; input: Record<string, unknown> }>({
      mutationFn: ({ identity, input }) =>
        runAction<TItem>(actions.update, "update", {
          fields: fields ?? options.defaultFields,
          identity,
          input,
          headers: buildCSRFHeaders(),
        }),
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: keys.detail(variables.identity) });
        queryClient.invalidateQueries({ queryKey: keys.lists() });
        rest.onSuccess?.(data, variables, onMutateResult, context);
      },
      ...rest,
    });
  }

  function useDelete(
    mutationOptions?: Omit<UseMutationOptions<unknown, ApiError, unknown>, "mutationFn">,
  ) {
    const queryClient = useQueryClient();
    return useMutation<unknown, ApiError, unknown>({
      mutationFn: (identity) =>
        runAction<unknown>(actions.destroy, "destroy", {
          identity,
          headers: buildCSRFHeaders(),
        }),
      onSuccess: (data, identity, onMutateResult, context) => {
        queryClient.removeQueries({ queryKey: keys.detail(identity) });
        queryClient.invalidateQueries({ queryKey: keys.lists() });
        mutationOptions?.onSuccess?.(data, identity, onMutateResult, context);
      },
      ...mutationOptions,
    });
  }

  return {
    keys,
    useList,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}
