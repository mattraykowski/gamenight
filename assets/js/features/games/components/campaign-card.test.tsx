import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { RouterContext } from "@/routes/__root";
import { CampaignCard } from "./campaign-card";
import type { Game } from "../hooks";

function buildGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    title: "Curse of Strahd",
    description: "The fog thickens. Strahd watches from the high tower.",
    status: "active",
    isOwner: true,
    ...overrides,
  };
}

function renderInRouter(ui: ReactNode) {
  const queryClient = new QueryClient();
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });
  const cardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{ui}</>,
  });
  const gameRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/games/$id",
    component: () => <div data-testid="game-detail">detail</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([cardRoute, gameRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { auth: undefined, queryClient },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("<CampaignCard>", () => {
  it("renders the game title in the serif card title", async () => {
    renderInRouter(<CampaignCard game={buildGame()} />);
    const title = await screen.findByTestId("campaign-card-title");
    expect(title).toHaveTextContent("Curse of Strahd");
    expect(title.className).toMatch(/\bfont-serif\b/);
  });

  it("renders the description with a 2-line clamp", async () => {
    renderInRouter(<CampaignCard game={buildGame()} />);
    const desc = await screen.findByTestId("campaign-card-description");
    expect(desc).toHaveTextContent(/the fog thickens/i);
    expect(desc.className).toMatch(/\bline-clamp-2\b/);
  });

  it("omits the description block when game.description is null", async () => {
    renderInRouter(<CampaignCard game={buildGame({ description: null })} />);
    expect(
      screen.queryByTestId("campaign-card-description"),
    ).not.toBeInTheDocument();
  });

  it("renders the status as a wax-seal badge", async () => {
    renderInRouter(
      <CampaignCard game={buildGame({ status: "paused" })} />,
    );
    const badge = await screen.findByTestId("campaign-card-status");
    expect(badge).toHaveTextContent("Paused");
    // Wax-seal variant pill is fully rounded.
    expect(badge.className).toMatch(/\brounded-full\b/);
  });

  it("links to the game detail page", async () => {
    renderInRouter(<CampaignCard game={buildGame({ id: "abc" })} />);
    const link = await screen.findByTestId("campaign-card-view-abc");
    // Button asChild + Link merges into a single <a>.
    expect(link).toHaveAttribute("href", "/games/abc");
  });
});
