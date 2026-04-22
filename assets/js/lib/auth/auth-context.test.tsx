import { describe, it, expect, afterEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { AuthProvider, useAuth, useOptionalAuth } from "./auth-context";

afterEach(() => {
  document.getElementById("auth-state")?.remove();
});

describe("AuthProvider", () => {
  it("hydrates from an explicit initialState (preferred in tests)", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialState={{ user: { id: "u1", email: "player@example.com" } }}>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({ id: "u1", email: "player@example.com" });
  });

  it("falls back to the #auth-state JSON island when no initialState is given", () => {
    const island = document.createElement("script");
    island.id = "auth-state";
    island.type = "application/json";
    island.textContent = JSON.stringify({
      user: { id: "u42", email: "island@example.com" },
    });
    document.body.appendChild(island);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.user).toEqual({ id: "u42", email: "island@example.com" });
  });

  it("models anonymous sessions with `user: null`", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialState={{ user: null }}>{children}</AuthProvider>
      ),
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("clearAuth() transitions the context to anonymous", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider initialState={{ user: { id: "u1", email: "x@example.com" } }}>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current.isAuthenticated).toBe(true);
    act(() => result.current.clearAuth());
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe("useOptionalAuth", () => {
  it("returns null outside an AuthProvider without throwing", () => {
    function Probe() {
      const auth = useOptionalAuth();
      return <span data-testid="probe">{auth === null ? "no-provider" : "provider"}</span>;
    }

    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("no-provider");
  });
});
