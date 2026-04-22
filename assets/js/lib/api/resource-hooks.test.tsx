import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AshRpcError } from "@/ash_rpc";
import { createResourceHooks, createResourceKeys } from "./resource-hooks";

type Widget = { id: string; name: string };

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

beforeEach(() => {
  // CSRF meta tag used by ash_rpc's buildCSRFHeaders helper
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf-token" />';
});

afterEach(() => {
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("createResourceKeys", () => {
  it("emits stable hierarchical keys for invalidation", () => {
    const keys = createResourceKeys("widget");
    expect(keys.all).toEqual(["widget"]);
    expect(keys.lists()).toEqual(["widget", "list"]);
    expect(keys.list({ q: "a" })).toEqual(["widget", "list", { q: "a" }]);
    expect(keys.details()).toEqual(["widget", "detail"]);
    expect(keys.detail("abc")).toEqual(["widget", "detail", "abc"]);
  });
});

describe("createResourceHooks.useGet", () => {
  it("unwraps the ash_typescript { success: true, data } envelope", async () => {
    const getFn = vi.fn().mockResolvedValue({
      success: true,
      data: { id: "1", name: "Widget One" },
    });
    const resource = createResourceHooks<Widget, Widget, string[]>(
      { get: getFn },
      { name: "widget", defaultFields: ["id", "name"] },
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => resource.useGet({ identity: "1" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "1", name: "Widget One" });
    expect(getFn).toHaveBeenCalledTimes(1);
  });

  it("throws a narrowed ApiError when the envelope is { success: false }", async () => {
    const errors: AshRpcError[] = [
      {
        type: "network_error",
        message: "boom",
        shortMessage: "boom",
        vars: {},
        fields: [],
        path: [],
        details: { statusCode: 503 },
      },
    ];
    const getFn = vi.fn().mockResolvedValue({ success: false, errors });
    const resource = createResourceHooks<Widget, Widget, string[]>(
      { get: getFn },
      { name: "widget", defaultFields: ["id"] },
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => resource.useGet({ identity: "1" }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: "network", status: 503 });
  });
});

describe("createResourceHooks.useCreate", () => {
  it("sends the x-csrf-token header on mutation requests", async () => {
    const createFn = vi.fn().mockResolvedValue({
      success: true,
      data: { id: "1", name: "new" },
    });
    const resource = createResourceHooks<Widget, Widget, string[]>(
      { create: createFn },
      { name: "widget", defaultFields: ["id"] },
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => resource.useCreate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "new" });
    });

    const call = createFn.mock.calls[0]![0];
    expect(call.headers).toMatchObject({ "X-CSRF-Token": "test-csrf-token" });
    expect(call.input).toEqual({ name: "new" });
  });

  it("invalidates list queries after a successful create", async () => {
    const createFn = vi.fn().mockResolvedValue({
      success: true,
      data: { id: "1", name: "new" },
    });
    const resource = createResourceHooks<Widget, Widget, string[]>(
      { create: createFn },
      { name: "widget", defaultFields: ["id"] },
    );

    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => resource.useCreate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "new" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: resource.keys.lists() });
  });

  it("throws ValidationError for invalid_attribute envelopes and exposes affected fields", async () => {
    const createFn = vi.fn().mockResolvedValue({
      success: false,
      errors: [
        {
          type: "invalid_attribute",
          message: "is required",
          shortMessage: "required",
          vars: { field: "name" },
          fields: ["name"],
          path: [],
        },
      ],
    });
    const resource = createResourceHooks<Widget, Widget, string[]>(
      { create: createFn },
      { name: "widget", defaultFields: ["id"] },
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => resource.useCreate(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({})).rejects.toMatchObject({
        kind: "validation",
        fields: ["name"],
      });
    });
  });
});
