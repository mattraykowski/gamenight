import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import {
  useDeleteSchedule,
  usePostSchedule,
  useUpdateScheduleFinalDay,
  useUpdateScheduleFinalDaysAndNotify,
  useUpdateScheduleFinalDaysBatch,
} from "./hooks";

// Generic success envelope — every schedule mutation under test
// returns either a Schedule or `{}`; the calendar key invalidation
// fires identically in onSuccess regardless of payload shape.
const okSchedule = HttpResponse.json({
  success: true,
  data: { id: "sched-1", gameId: "game-1" },
});

const server = setupServer(
  http.post("*/rpc/run", () => okSchedule.clone()),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { Wrapper, spy };
}

function expectCalendarInvalidation(spy: { mock: { calls: unknown[][] } }) {
  const calls = spy.mock.calls.map((args) => args[0]);
  const matched = calls.some((arg) => {
    const key =
      arg && typeof arg === "object"
        ? (arg as { queryKey?: unknown[] }).queryKey
        : undefined;
    return (
      Array.isArray(key) && key[0] === "schedules" && key[1] === "calendar"
    );
  });
  expect(
    matched,
    `expected an invalidateQueries call with a key starting [schedules, calendar, ...]; got: ${JSON.stringify(
      calls,
    )}`,
  ).toBe(true);
}

describe("schedule mutation hooks invalidate the calendar query key (T019a / US1)", () => {
  it("useUpdateScheduleFinalDay invalidates the calendar key on success", async () => {
    const { Wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useUpdateScheduleFinalDay(), {
      wrapper: Wrapper,
    });
    await result.current.mutateAsync({
      scheduleId: "sched-1",
      gameId: "game-1",
      day: 5,
      status: "A",
    });
    await waitFor(() => expectCalendarInvalidation(spy));
  });

  it("useUpdateScheduleFinalDaysBatch invalidates the calendar key on success", async () => {
    const { Wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useUpdateScheduleFinalDaysBatch(), {
      wrapper: Wrapper,
    });
    await result.current.mutateAsync({
      scheduleId: "sched-1",
      gameId: "game-1",
      finalDays: [{ day: 5, status: "A" }],
    });
    await waitFor(() => expectCalendarInvalidation(spy));
  });

  it("useUpdateScheduleFinalDaysAndNotify invalidates the calendar key on success", async () => {
    const { Wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useUpdateScheduleFinalDaysAndNotify(), {
      wrapper: Wrapper,
    });
    await result.current.mutateAsync({
      scheduleId: "sched-1",
      gameId: "game-1",
      finalDays: [{ day: 5, status: "A" }],
    });
    await waitFor(() => expectCalendarInvalidation(spy));
  });

  it("usePostSchedule invalidates the calendar key on success", async () => {
    const { Wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => usePostSchedule(), {
      wrapper: Wrapper,
    });
    await result.current.mutateAsync({
      scheduleId: "sched-1",
      gameId: "game-1",
    });
    await waitFor(() => expectCalendarInvalidation(spy));
  });

  it("useDeleteSchedule invalidates the calendar key on success", async () => {
    const { Wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useDeleteSchedule(), {
      wrapper: Wrapper,
    });
    await result.current.mutateAsync({
      scheduleId: "sched-1",
      gameId: "game-1",
      confirmation: "delete",
    });
    await waitFor(() => expectCalendarInvalidation(spy));
  });
});
