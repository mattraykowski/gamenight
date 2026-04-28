import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createRootRouteWithContext,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { SchedulesTable } from "./schedules-table";
import type { Schedule } from "../hooks";

interface RouterContext {
  queryClient: QueryClient;
}

function renderInRouter(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => ui,
  });

  const router = createRouter({
    routeTree: rootRoute,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function buildSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "00000000-0000-0000-0000-000000000111",
    gameId: "00000000-0000-0000-0000-000000000001",
    month: 10,
    year: 2099,
    startTime: "19:00:00",
    endTime: "23:00:00",
    timeZone: "America/Chicago",
    status: "preparing",
    postedAt: null,
    name: "October 2099 7:00 PM – 11:00 PM",
    ...overrides,
  };
}

describe("<SchedulesTable> (T030)", () => {
  it("renders the schedule's name + status pill in each row", async () => {
    renderInRouter(
      <SchedulesTable
        schedules={[buildSchedule()]}
        gameId="00000000-0000-0000-0000-000000000001"
      />,
    );

    expect(
      await screen.findByText("October 2099 7:00 PM – 11:00 PM"),
    ).toBeInTheDocument();
    expect(screen.getByText("Preparing")).toBeInTheDocument();
  });

  it("renders an empty-state message when no schedules exist", async () => {
    renderInRouter(
      <SchedulesTable
        schedules={[]}
        gameId="00000000-0000-0000-0000-000000000001"
      />,
    );
    expect(await screen.findByText(/no schedules yet/i)).toBeInTheDocument();
  });

  it("renders a View link for each row", async () => {
    const schedule = buildSchedule();
    renderInRouter(
      <SchedulesTable schedules={[schedule]} gameId={schedule.gameId} />,
    );

    const link = await screen.findByRole("link", { name: /view/i });
    // The href is computed from TanStack Router; assert the element
    // exists and has the schedule id in its href.
    expect(link).toHaveAttribute("href", expect.stringContaining(schedule.id));
  });
});
