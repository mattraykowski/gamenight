import { buildCSRFHeaders } from "@/ash_rpc";

/**
 * Module-level references that let `createResourceHooks` call into
 * React-bound behavior (auth failure handlers, router-aware fetch)
 * without importing React. The SPA root installs these once on boot
 * via `configureApiClient` after `<AuthProvider>` and `<RouterProvider>`
 * have mounted; tests can swap them between cases.
 *
 * Keeping the glue here — and not inside the hook factory — means the
 * factory stays pure and testable with simple MSW mocks.
 */
let customFetch: typeof fetch | undefined;

export interface ApiClientConfig {
  customFetch?: typeof fetch;
}

export function configureApiClient(config: ApiClientConfig): void {
  customFetch = config.customFetch;
}

export function resetApiClient(): void {
  customFetch = undefined;
}

export function getClientOptions(): {
  customFetch?: typeof fetch;
  headers: Record<string, string>;
} {
  return {
    customFetch,
    headers: buildCSRFHeaders(),
  };
}
