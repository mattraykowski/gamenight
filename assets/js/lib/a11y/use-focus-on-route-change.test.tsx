import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { A11yAnnouncer } from "./announcer";
import { useFocusOnRouteChange } from "./use-focus-on-route-change";

function FocusManager() {
  useFocusOnRouteChange();
  return null;
}

function RootLayout() {
  return (
    <A11yAnnouncer>
      <FocusManager />
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </A11yAnnouncer>
  );
}

function makeRouter() {
  const rootRoute = createRootRoute({ component: RootLayout });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <h1 data-route-heading tabIndex={-1}>
        Home page
      </h1>
    ),
  });

  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/about",
    component: () => (
      <h1 data-route-heading tabIndex={-1}>
        About page
      </h1>
    ),
  });

  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, aboutRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

describe("useFocusOnRouteChange", () => {
  it("moves focus to the destination page's heading after navigation", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={makeRouter()} />);

    await waitFor(() => screen.getByRole("heading", { name: "Home page" }));

    await user.click(screen.getByRole("link", { name: "About" }));

    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: "About page" });
      expect(document.activeElement).toBe(heading);
    });
  });

  it("announces the destination heading text via the polite live region", async () => {
    const user = userEvent.setup();
    render(<RouterProvider router={makeRouter()} />);

    await waitFor(() => screen.getByRole("heading", { name: "Home page" }));

    await user.click(screen.getByRole("link", { name: "About" }));

    await waitFor(() => {
      expect(screen.getByTestId("announcer-polite")).toHaveTextContent("About page");
    });
  });
});
