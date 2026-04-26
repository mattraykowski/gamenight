import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buildCSRFHeaders } from "@/ash_rpc";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/auth-state";
import { currentUserKeys } from "@/features/current-user/hooks";

/**
 * SPA-facing contract for `AuthController` responses.
 *
 * JSON success: `{user: {id, email}}` (every flow that produces a user).
 * JSON failure: `{errors: [{field, message, code}]}`.
 *
 * Status codes map to {@link AuthErrorKind} so consumers can branch
 * without string-matching: 401 → `invalid_credentials`, 422 →
 * `validation`, 429 → `rate_limited`, 403 → `forbidden`, anything
 * else → `unknown`.
 */
export interface AuthFieldError {
  field: string | null;
  message: string;
  code: string;
}

export type AuthErrorKind =
  | "invalid_credentials"
  | "validation"
  | "rate_limited"
  | "forbidden"
  | "network"
  | "unknown";

export interface AuthError {
  kind: AuthErrorKind;
  status: number;
  message: string;
  fieldErrors: AuthFieldError[];
  retryAfterSeconds?: number;
}

export interface SignInInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignInSuccess {
  user: AuthUser;
}

/**
 * Wrapper around `fetch` that posts form data to one of the
 * `auth_routes` endpoints. Attaches `X-CSRF-Token` (from the meta tag
 * rendered by the SPA shell), requests JSON, and forwards cookies
 * same-origin so the session cookie round-trip works.
 *
 * Callers supply the endpoint path and a body object. Non-JSON
 * responses and network failures are funnelled into the
 * {@link AuthError} shape so UI code never touches raw `fetch`
 * semantics.
 */
export async function postAuth(
  path: string,
  body: Record<string, unknown>,
): Promise<SignInSuccess> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: buildCSRFHeaders({
        accept: "application/json",
        "content-type": "application/json",
      }),
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw {
      kind: "network",
      status: 0,
      message:
        cause instanceof Error ? cause.message : "Network request failed.",
      fieldErrors: [],
    } satisfies AuthError;
  }

  const payload = await parseJsonSafe(response);

  if (response.ok) {
    if (isUserPayload(payload)) {
      return { user: payload.user };
    }
    throw {
      kind: "unknown",
      status: response.status,
      message: "Unexpected response from the server.",
      fieldErrors: [],
    } satisfies AuthError;
  }

  throw toAuthError(response, payload);
}

export async function deleteAuth(path: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "DELETE",
      credentials: "same-origin",
      headers: buildCSRFHeaders({ accept: "application/json" }),
    });
  } catch (cause) {
    throw {
      kind: "network",
      status: 0,
      message:
        cause instanceof Error ? cause.message : "Network request failed.",
      fieldErrors: [],
    } satisfies AuthError;
  }

  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    throw toAuthError(response, payload);
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toAuthError(response: Response, payload: unknown): AuthError {
  const fieldErrors = extractFieldErrors(payload);
  const firstMessage = fieldErrors[0]?.message ?? "Something went wrong.";
  const firstCode = fieldErrors[0]?.code ?? "unknown";

  const kind: AuthErrorKind = (() => {
    if (response.status === 429) return "rate_limited";
    if (response.status === 403) return "forbidden";
    if (response.status === 401) return "invalid_credentials";
    if (response.status === 422) return "validation";
    if (response.status === 0) return "network";
    return "unknown";
  })();

  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds =
    retryAfter !== null && retryAfter.length > 0 && Number.isFinite(Number(retryAfter))
      ? Number(retryAfter)
      : undefined;

  return {
    kind,
    status: response.status,
    message: firstMessage,
    fieldErrors,
    ...(retryAfterSeconds !== undefined
      ? { retryAfterSeconds }
      : {}),
    // Retain the code on the top-level for consumers that branch on
    // it even after classifying by `kind` (e.g. the register form's
    // "taken" branch).
    ...(firstCode !== "unknown" ? { code: firstCode } : {}),
  } as AuthError;
}

function extractFieldErrors(payload: unknown): AuthFieldError[] {
  if (!payload || typeof payload !== "object") return [];
  const errorsValue = (payload as Record<string, unknown>).errors;
  if (!Array.isArray(errorsValue)) return [];
  return errorsValue
    .map((raw): AuthFieldError | null => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const field = typeof record.field === "string" ? record.field : null;
      const message =
        typeof record.message === "string" ? record.message : "is invalid";
      const code = typeof record.code === "string" ? record.code : "unknown";
      return { field, message, code };
    })
    .filter((value): value is AuthFieldError => value !== null);
}

function isUserPayload(
  payload: unknown,
): payload is { user: AuthUser } {
  if (!payload || typeof payload !== "object") return false;
  const user = (payload as Record<string, unknown>).user;
  if (!user || typeof user !== "object") return false;
  const id = (user as Record<string, unknown>).id;
  const email = (user as Record<string, unknown>).email;
  return typeof id === "string" && typeof email === "string";
}

/**
 * Sign-in hook.
 *
 * Posts email/password to `/auth/user/password/sign_in`, installs the
 * user into the auth context, primes the `useCurrentUser` query cache
 * so the dashboard does not flicker between "authed" and "who am I",
 * and returns a mutation handle the sign-in form can drive.
 */
export function useSignIn() {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SignInInput) => {
      // `remember_me` lives at the top level of the request — it is
      // consumed by the `remember_me` add-on's dispatcher hook, not
      // by the password action itself, which only declares `email`
      // and `password` as arguments. Nesting it under `user` causes
      // the password action to reject the unknown argument.
      return postAuth("/auth/user/password/sign_in", {
        user: {
          email: input.email,
          password: input.password,
        },
        ...(input.rememberMe !== undefined ? { remember_me: input.rememberMe } : {}),
      });
    },
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.setQueryData(currentUserKeys.detail("self"), user);
    },
  });
}

/**
 * Sign-out hook. Fetches `DELETE /sign-out` with JSON accept, clears
 * auth state on success, and invalidates every cached query so stale
 * authed data does not bleed into the post-sign-out view.
 */
export function useSignOut() {
  const { clearAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAuth("/sign-out"),
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

export interface RegisterInput {
  email: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * Registration hook. Posts to `/auth/user/password/register`; the
 * controller auto-signs the user in on success (see Phase 1 decisions
 * in the plan), so we follow the same auth-state update pattern as
 * {@link useSignIn}.
 */
export function useRegister() {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      return postAuth("/auth/user/password/register", {
        user: {
          email: input.email,
          password: input.password,
          password_confirmation: input.passwordConfirmation,
        },
      });
    },
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.setQueryData(currentUserKeys.detail("self"), user);
    },
  });
}

/**
 * Confirms an email via `POST /auth/user/confirm_new_user`. The
 * controller responds with `{user}` on success; the SPA route using
 * this hook is responsible for updating auth state and navigating.
 */
export function useConfirmNewUser() {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      return postAuth("/auth/user/confirm_new_user", { confirm: token });
    },
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.setQueryData(currentUserKeys.detail("self"), user);
    },
  });
}

/**
 * Overloaded auth mutations that do not sign the caller in — used by
 * request-style endpoints (`reset_request`, `magic_link/request`).
 * The server intentionally does not return a user here (both actions
 * hide enumeration by always succeeding), so the hook surfaces the
 * success/error state without touching auth context.
 */
async function postAuthRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: buildCSRFHeaders({
        accept: "application/json",
        "content-type": "application/json",
      }),
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw {
      kind: "network",
      status: 0,
      message:
        cause instanceof Error ? cause.message : "Network request failed.",
      fieldErrors: [],
    } satisfies AuthError;
  }

  if (response.ok) return;

  const payload = await parseJsonSafe(response);
  throw toAuthError(response, payload);
}

/**
 * Requests a password-reset email. Hides enumeration — the backend
 * responds 200 whether or not the email exists, and the SPA always
 * renders the same "check your email" confirmation regardless of the
 * real outcome.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      return postAuthRequest("/auth/user/password/reset_request", {
        user: { email },
      });
    },
  });
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * Completes a password reset. Signs the caller in on success (this
 * matches the existing `reset_password_with_token` action's
 * `GenerateTokenChange`).
 */
export function useResetPassword() {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      return postAuth("/auth/user/password/reset", {
        user: {
          reset_token: input.token,
          password: input.password,
          password_confirmation: input.passwordConfirmation,
        },
      });
    },
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.setQueryData(currentUserKeys.detail("self"), user);
    },
  });
}

/**
 * Requests a magic-link email. Same enumeration-hiding contract as
 * {@link useRequestPasswordReset} — backend returns 200 whether or
 * not the email exists.
 */
export function useRequestMagicLink() {
  return useMutation({
    mutationFn: async (email: string) => {
      return postAuthRequest("/auth/user/magic_link/request", {
        user: { email },
      });
    },
  });
}

/**
 * Consumes a magic-link token to sign the user in. The magic-link
 * strategy has `registration_enabled? true`, so this action may
 * upsert the user record on first sign-in.
 */
export function useSignInWithMagicLink() {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      return postAuth("/auth/user/magic_link", { token });
    },
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.setQueryData(currentUserKeys.detail("self"), user);
    },
  });
}
