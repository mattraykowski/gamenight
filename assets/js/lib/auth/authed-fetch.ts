export interface AuthInterceptorOptions {
  /**
   * Called after the interceptor has exhausted its one refresh attempt and
   * a second 401 still came back. Implementations typically clear the
   * in-memory auth state and navigate to `/sign-in`.
   */
  onAuthFailed: (info: { currentPath: string }) => void;

  /**
   * Attempts a silent refresh of the session. Return `true` on success so
   * the original request is retried; `false` means give up and call
   * `onAuthFailed`. Defaults to always-false (no refresh mechanism) —
   * our session-cookie auth has no refresh-token exchange, so the
   * interceptor effectively bails on the first 401. The hook exists so a
   * future bearer/refresh flow can opt in without touching callers.
   */
  attemptRefresh?: () => Promise<boolean>;

  /** Escape hatch for tests — defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;

  /** Escape hatch for tests — defaults to reading `window.location.pathname`. */
  getCurrentPath?: () => string;
}

/**
 * Produces a drop-in `fetch` function that implements the constitution's
 * 401 interceptor contract: one silent refresh attempt, then clear auth
 * state and redirect to `/sign-in` preserving the original path in
 * `?redirect=`.
 *
 * Pass the returned function to `ash_typescript`-generated actions via
 * their `customFetch` option so every RPC call honors it.
 */
export function createAuthedFetch(options: AuthInterceptorOptions): typeof fetch {
  const baseFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const getCurrentPath =
    options.getCurrentPath ?? (() => (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"));

  const authedFetch: typeof fetch = async (input, init) => {
    const requestInit: RequestInit = { credentials: "same-origin", ...init };
    const first = await baseFetch(input as RequestInfo, requestInit);
    if (first.status !== 401) return first;

    const refreshed = await (options.attemptRefresh?.() ?? Promise.resolve(false));
    if (!refreshed) {
      options.onAuthFailed({ currentPath: getCurrentPath() });
      return first;
    }

    const second = await baseFetch(input as RequestInfo, requestInit);
    if (second.status === 401) {
      options.onAuthFailed({ currentPath: getCurrentPath() });
    }
    return second;
  };

  return authedFetch;
}
