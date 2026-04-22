import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { expectNoAxeViolations } from "@/test/a11y";
import { AuthProvider } from "@/lib/auth/auth-context";
import { DashboardRoute } from "./dashboard";

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "read_current_user") {
      return HttpResponse.json({
        success: true,
        data: { id: "u1", email: "player@example.com" },
      });
    }
    return HttpResponse.json({
      success: false,
      errors: [
        {
          type: "unknown",
          message: `unhandled: ${body.action}`,
          shortMessage: "unhandled",
          vars: {},
          fields: [],
          path: [],
        },
      ],
    });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
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
      <AuthProvider initialState={{ user: { id: "u1", email: "player@example.com" } }}>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}

const DashboardComponent = DashboardRoute;

describe("/dashboard route", () => {
  it("renders 'Welcome, {email}' after the RPC resolves", async () => {
    const { container } = render(<DashboardComponent />, { wrapper: Providers });

    await waitFor(() => {
      expect(screen.getByTestId("current-user-email")).toHaveTextContent(
        "player@example.com",
      );
    });

    expect(
      screen.getByRole("heading", { level: 1, name: /dashboard/i }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("renders a loading announcement before the RPC resolves", () => {
    render(<DashboardComponent />, { wrapper: Providers });

    expect(screen.getByText(/loading your account/i)).toBeInTheDocument();
  });

  it("has a focusable h1 carrying the data-route-heading contract", async () => {
    render(<DashboardComponent />, { wrapper: Providers });

    await waitFor(() => screen.getByRole("heading", { level: 1, name: /dashboard/i }));
    const heading = screen.getByRole("heading", { level: 1, name: /dashboard/i });
    expect(heading).toHaveAttribute("data-route-heading");
    expect(heading).toHaveAttribute("tabIndex", "-1");
  });
});
