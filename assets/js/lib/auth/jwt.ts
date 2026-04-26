/**
 * Decodes a JWT's payload (the middle segment) without verifying its
 * signature. Safe for purely-informational UI use — e.g. showing the
 * email claim on a confirmation landing page before the token has been
 * consumed server-side. Never treat the decoded payload as trusted
 * input.
 *
 * Returns `null` when the token is missing, malformed, or its payload
 * is not valid JSON.
 */
export function decodeJwtPayload(token: string | undefined | null): Record<string, unknown> | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const segments = token.split(".");
  if (segments.length < 2) return null;
  const payload = segments[1];
  if (!payload) return null;

  try {
    const json = atob(base64UrlToBase64(payload));
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Convenience accessor: pulls an email claim off the decoded JWT
 * payload if present and a string. Ash embeds the target email in
 * different claims depending on the strategy:
 *
 * - Confirmation tokens use `email`.
 * - Magic-link tokens use `identity`.
 * - Older versions or custom setups may nest it under `act.email`.
 *
 * We check all three locations so the informational banner on the
 * confirm / magic-link landing pages works regardless of which
 * strategy minted the token.
 */
export function emailFromToken(token: string | undefined | null): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  for (const key of ["email", "identity"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.includes("@")) return value;
  }
  const act = payload["act"];
  if (act && typeof act === "object") {
    const inner = (act as Record<string, unknown>)["email"];
    if (typeof inner === "string" && inner.includes("@")) return inner;
  }
  return null;
}

function base64UrlToBase64(value: string): string {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}
