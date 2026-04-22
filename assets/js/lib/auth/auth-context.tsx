import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { readInitialAuthState, type AuthState, type AuthUser } from "./auth-state";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  initialState?: AuthState;
}

/**
 * Provides the shared auth context. The default `initialState` is read
 * from the `<script id="auth-state">` JSON island that `spa_root.html.heex`
 * renders server-side, which means unauthenticated vs. authenticated
 * renders are decided synchronously on first paint — no flash of
 * protected content.
 *
 * Tests pass an explicit `initialState` to avoid relying on jsdom's
 * `document` state.
 */
export function AuthProvider({ children, initialState }: AuthProviderProps) {
  const [user, setUserState] = useState<AuthUser | null>(
    () => (initialState ?? readInitialAuthState()).user,
  );

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isAuthenticated: user !== null,
      setUser: setUserState,
      clearAuth: () => setUserState(null),
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}

/**
 * Non-throwing variant of {@link useAuth} for components that render in
 * both authenticated SPA contexts and isolated unit tests. Returns
 * `null` when no `<AuthProvider>` is mounted instead of crashing.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
