const SAFE_FALLBACK = "/dashboard";

/**
 * Normalises a user-controllable `?redirect=` query string into a
 * safe same-origin path. Guards against protocol-relative (`//evil.com`),
 * backslash-tricked (`/\evil.com`), and fully-qualified external URLs
 * that the browser would otherwise follow away from our origin.
 *
 * Returns the fallback when the input is missing, empty, or unsafe.
 * Callers should pass the raw `search.redirect` from TanStack Router.
 */
export function parseRedirectTarget(
  raw: string | undefined | null,
  fallback: string = SAFE_FALLBACK,
): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (!raw.startsWith("/")) return fallback;
  // Protocol-relative URLs: `//evil.com/foo` — browsers treat these as
  // cross-origin, so any leading `//` (or `/\`, which some parsers
  // normalise to `//`) must be rejected.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Defensive: reject anything that parses as an absolute URL with a
  // scheme even after the leading slash check (paranoia, since a path
  // starting with `/` cannot contain a scheme colon before the first
  // `/`, but cheap to verify).
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;
  return raw;
}
