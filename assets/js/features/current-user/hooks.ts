import { readCurrentUser, type ReadCurrentUserFields } from "@/ash_rpc";
import { createResourceHooks } from "@/lib/api/resource-hooks";
import { getClientOptions } from "@/lib/api/client";

const DEFAULT_FIELDS: ReadCurrentUserFields = ["id", "email"];

export type CurrentUser = { id: string; email: string };

/**
 * Feature-level hooks for the authenticated user. Wraps the generated
 * `readCurrentUser` action per the constitution's API-client rules —
 * components import `useCurrentUser` and never touch `readCurrentUser`
 * directly.
 */
const resource = createResourceHooks<CurrentUser, CurrentUser, ReadCurrentUserFields>(
  {
    get: (config) =>
      readCurrentUser({
        fields: (config.fields as ReadCurrentUserFields) ?? DEFAULT_FIELDS,
        ...(config.headers !== undefined && { headers: config.headers as Record<string, string> }),
        ...(config.customFetch !== undefined && { customFetch: config.customFetch as typeof fetch }),
      }) as Promise<
        | { success: true; data: CurrentUser }
        | { success: false; errors: import("@/ash_rpc").AshRpcError[] }
      >,
  },
  {
    name: "currentUser",
    defaultFields: DEFAULT_FIELDS,
    clientOptions: getClientOptions,
  },
);

export const currentUserKeys = resource.keys;

export function useCurrentUser() {
  return resource.useGet({ identity: "self" });
}
