import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { InvitationPreview } from "../hooks";

export interface AcceptInvitationCardProps {
  /** The preview returned by `useInvitationPreview`. */
  preview: InvitationPreview;
  /** True when the viewer is logged in — controls which CTAs render. */
  isAuthenticated: boolean;
  /** True while the accept mutation is in flight. */
  isAccepting?: boolean;
  /** Called when the user clicks Accept. */
  onAccept: () => void;
  /** Called when the user clicks Decline (US4 wires this in). */
  onDecline?: () => void;
  /** Token preserved through the register/sign-in round-trip. */
  token: string;
}

/**
 * Renders the invitation accept screen at `/invitations/:token`.
 *
 * - When the viewer is authenticated, shows Accept / Decline.
 * - When anonymous, shows two CTAs that carry the invitation URL
 *   through `?redirect=/invitations/<token>` so the auth flow
 *   returns the user to this same page after registering or
 *   signing in.
 */
export function AcceptInvitationCard({
  preview,
  isAuthenticated,
  isAccepting,
  onAccept,
  onDecline,
  token,
}: AcceptInvitationCardProps) {
  const redirectTarget = `/invitations/${encodeURIComponent(token)}`;

  return (
    <section
      className="space-y-6"
      aria-labelledby="accept-invitation-summary"
      data-testid="accept-invitation-card"
    >
      <div className="rounded-md border bg-card p-6 shadow-sm">
        <h2 id="accept-invitation-summary" className="font-serif text-xl font-semibold tracking-tight">
          {preview.gameTitle}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Invited by <span data-testid="invitation-inviter-email">{preview.inviterEmail}</span>{" "}
          to play as{" "}
          <span data-testid="invitation-character-name" className="font-medium text-foreground">
            {preview.characterName}
          </span>
          .
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Expires <time dateTime={preview.expiresAt}>{formatExpiresAt(preview.expiresAt)}</time>.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onAccept}
            disabled={isAccepting}
            data-testid="invitation-accept-button"
          >
            {isAccepting ? "Accepting…" : "Accept invitation"}
          </Button>
          {onDecline ? (
            <Button
              type="button"
              variant="outline"
              onClick={onDecline}
              disabled={isAccepting}
              data-testid="invitation-decline-button"
            >
              Decline
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to accept your invitation. We&apos;ll bring you back
            here as soon as you&apos;re signed in.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link
                to="/register"
                search={{ redirect: redirectTarget }}
                data-testid="invitation-register-cta"
              >
                Create account
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                to="/sign-in"
                search={{ redirect: redirectTarget }}
                data-testid="invitation-signin-cta"
              >
                I already have an account
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function formatExpiresAt(value: string): string {
  // Best-effort human-friendly format. Falls back to the raw ISO
  // string if parsing fails — the time element above keeps the
  // precise value available for assistive tech.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}
