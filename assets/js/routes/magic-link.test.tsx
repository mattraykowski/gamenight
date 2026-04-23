import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { expectNoAxeViolations } from "@/test/a11y";
import { AuthProvider, type AuthContextValue } from "@/lib/auth/auth-context";
import { MagicLinkRequestRoute } from "./magic-link";

type RequestHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: RequestHandler = () => new HttpResponse(null, { status: 200 });

const server = setupServer(
  http.post("*/auth/user/magic_link/request", ({ request }) => latestHandler(request)),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

beforeEach(() => {
  latestHandler = () => new HttpResponse(null, { status: 200 });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function renderMagicLinkRequest() {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const magicLinkRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/magic-link",
    component: MagicLinkRequestRoute,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([magicLinkRoute]),
    history: createMemoryHistory({ initialEntries: ["/magic-link"] }),
    context: { auth: undefined },
  });

  function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
          },
        }),
    );
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialState={{ user: null }}>
          {children}
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(<></>, { wrapper: Providers });
}

describe("/magic-link route", () => {
  it("renders the request form with no axe violations", async () => {
    const { container } = renderMagicLinkRequest();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /sign in with a magic link/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("shows the ambiguous confirmation on successful submission", async () => {
    renderMagicLinkRequest();
    await waitFor(() => screen.getByRole("button", { name: /send sign-in link/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "whoever@example.com");
    await user.click(screen.getByRole("button", { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /check your email/i }),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces 429 inline instead of flipping to the confirmation", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: null,
              message: "Too many attempts. Try again in 60s.",
              code: "rate_limited",
            },
          ],
        },
        { status: 429 },
      );

    renderMagicLinkRequest();
    await waitFor(() => screen.getByRole("button", { name: /send sign-in link/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "rate@example.com");
    await user.click(screen.getByRole("button", { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i),
    );
    expect(
      screen.queryByRole("heading", { level: 1, name: /check your email/i }),
    ).not.toBeInTheDocument();
  });
});
