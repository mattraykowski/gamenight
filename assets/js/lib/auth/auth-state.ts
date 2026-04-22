export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthState {
  user: AuthUser | null;
}

/**
 * Reads the SPA's initial auth state from the `<script id="auth-state">`
 * island embedded in `spa_root.html.heex`. Returning `{ user: null }`
 * when the island is missing keeps unit tests that render components in
 * isolation from crashing — it models an anonymous session.
 */
export function readInitialAuthState(): AuthState {
  if (typeof document === "undefined") return { user: null };
  const el = document.getElementById("auth-state");
  if (!el?.textContent) return { user: null };
  try {
    const parsed = JSON.parse(el.textContent) as Partial<AuthState>;
    return { user: parsed.user ?? null };
  } catch {
    return { user: null };
  }
}
