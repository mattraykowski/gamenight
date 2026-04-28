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

import { CharacterSchedulesSection } from "./character-schedules-section";
import type { CharacterSchedule } from "../hooks";

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

const TODAY = new Date();
const CURRENT_MONTH = TODAY.getMonth() + 1;
const CURRENT_YEAR = TODAY.getFullYear();
const NEXT_MONTH = CURRENT_MONTH === 12 ? 1 : CURRENT_MONTH + 1;
const NEXT_YEAR = CURRENT_MONTH === 12 ? CURRENT_YEAR + 1 : CURRENT_YEAR;

function buildSchedule(overrides: Partial<CharacterSchedule>): CharacterSchedule {
  return {
    id: "schedule-id",
    gameId: "game-id",
    month: CURRENT_MONTH,
    year: CURRENT_YEAR,
    startTime: "19:00:00",
    endTime: "23:00:00",
    timeZone: "America/Chicago",
    status: "posted",
    postedAt: TODAY.toISOString(),
    name: "Test schedule",
    submissionCount: 0,
    participantCount: 0,
    ...overrides,
  };
}

describe("<CharacterSchedulesSection> (T111)", () => {
  it("renders empty states when no schedules match", async () => {
    renderInRouter(
      <CharacterSchedulesSection characterId="char-1" schedules={[]} />,
    );
    expect(
      await screen.findByText(/no posted schedule for the current month/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/nothing posted for next month yet/i),
    ).toBeInTheDocument();
  });

  it("renders the current-month schedule in the 'This month' bucket", async () => {
    const current = buildSchedule({
      id: "current-schedule-id",
      name: "This month's session",
      month: CURRENT_MONTH,
      year: CURRENT_YEAR,
    });
    renderInRouter(
      <CharacterSchedulesSection characterId="char-1" schedules={[current]} />,
    );

    expect(await screen.findByText("This month's session")).toBeInTheDocument();
    expect(
      screen.getByTestId(`character-schedule-${current.id}`),
    ).toBeInTheDocument();
  });

  it("renders the next-month schedule in the 'Next month' bucket", async () => {
    const upcoming = buildSchedule({
      id: "upcoming-schedule-id",
      name: "Next month's session",
      month: NEXT_MONTH,
      year: NEXT_YEAR,
    });
    renderInRouter(
      <CharacterSchedulesSection characterId="char-1" schedules={[upcoming]} />,
    );

    expect(
      await screen.findByText("Next month's session"),
    ).toBeInTheDocument();
  });

  it("filters out :ready_for_availability schedules — only posted", async () => {
    const ready = buildSchedule({
      id: "ready-schedule",
      name: "Not posted yet",
      status: "ready_for_availability",
    });
    renderInRouter(
      <CharacterSchedulesSection characterId="char-1" schedules={[ready]} />,
    );
    // Wait for the section to mount, then assert the absence.
    await screen.findByText(/posted schedules/i);
    expect(screen.queryByText("Not posted yet")).not.toBeInTheDocument();
  });

  it("renders View all link only when other posted schedules exist", async () => {
    const otherPosted = buildSchedule({
      id: "old-posted",
      name: "Last month",
      // Past month — not in current or upcoming bucket.
      month: 1,
      year: 2024,
    });
    renderInRouter(
      <CharacterSchedulesSection characterId="char-1" schedules={[otherPosted]} />,
    );

    expect(
      await screen.findByTestId("character-schedules-view-all"),
    ).toBeInTheDocument();
  });

  it("does not render View all when all posted schedules are in current+upcoming", async () => {
    const current = buildSchedule({
      id: "c",
      month: CURRENT_MONTH,
      year: CURRENT_YEAR,
    });
    renderInRouter(
      <CharacterSchedulesSection characterId="char-1" schedules={[current]} />,
    );

    await screen.findByText("Test schedule");
    expect(
      screen.queryByTestId("character-schedules-view-all"),
    ).not.toBeInTheDocument();
  });
});
