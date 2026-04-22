import type { AshRpcError } from "@/ash_rpc";

/**
 * Discriminated error union surfaced to components by {@link createResourceHooks}.
 * The `queryFn` / `mutationFn` narrows the opaque `AshRpcError[]` envelope
 * returned by `ash_typescript` into one of these cases so callers can
 * `switch(error.kind)` instead of string-matching on `error.type`.
 */
export type ApiError =
  | NetworkError
  | ValidationError
  | AuthError
  | UnknownError;

export interface NetworkError {
  kind: "network";
  message: string;
  status?: number;
  cause: AshRpcError;
}

export interface ValidationError {
  kind: "validation";
  message: string;
  errors: AshRpcError[];
  fields: string[];
}

export interface AuthError {
  kind: "auth";
  status: 401 | 403;
  message: string;
  cause: AshRpcError;
}

export interface UnknownError {
  kind: "unknown";
  message: string;
  errors: AshRpcError[];
}

const VALIDATION_TYPES = new Set([
  "invalid_changes",
  "invalid_attribute",
  "invalid_argument",
  "required",
]);

/**
 * Narrows a raw `AshRpcError[]` envelope into the discriminated `ApiError`.
 * The `type` field from `AshRpcError` is the primary signal; `details.statusCode`
 * is the fallback for HTTP-level classifications that fall through to the
 * executor without a semantic Ash error.
 */
export function narrowApiError(errors: AshRpcError[]): ApiError {
  const first = errors[0];
  if (!first) {
    return { kind: "unknown", message: "Unknown error", errors };
  }

  const status =
    typeof first.details?.statusCode === "number" ? first.details.statusCode : undefined;

  // Auth classification must come before the generic network fallback so
  // a 401/403 that surfaces as the `network_error` wrapper still lands in
  // the AuthError branch — components rely on `kind: "auth"` to trigger
  // the interceptor's redirect flow.
  if (
    status === 401 ||
    status === 403 ||
    first.type === "forbidden" ||
    first.type === "unauthorized"
  ) {
    const resolvedStatus: 401 | 403 =
      status === 403 || first.type === "forbidden" ? 403 : 401;
    return {
      kind: "auth",
      status: resolvedStatus,
      message: first.message,
      cause: first,
    };
  }

  if (first.type === "network_error") {
    return {
      kind: "network",
      message: first.message,
      status,
      cause: first,
    };
  }

  if (VALIDATION_TYPES.has(first.type) || errors.some((e) => e.fields.length > 0)) {
    const fields = Array.from(new Set(errors.flatMap((e) => e.fields)));
    return {
      kind: "validation",
      message: first.message,
      errors,
      fields,
    };
  }

  return {
    kind: "unknown",
    message: first.message ?? "Unknown error",
    errors,
  };
}
