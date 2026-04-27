import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AcceptInvitationCard } from "@/features/invitations/components/accept-invitation-card";
import { DeclineInvitationConfirm } from "@/features/invitations/components/decline-invitation-confirm";
import { Button } from "@/components/ui/button";
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInvitationPreview,
} from "@/features/invitations/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { useToasts } from "@/features/toasts/toast-provider";

const invitationsTokenSearchSchema = z.object({});

export const Route = createFileRoute("/invitations/$token")({
  validateSearch: invitationsTokenSearchSchema,
  component: InvitationsTokenRoute,
});

export function InvitationsTokenRoute() {
  const { token } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const { push } = useToasts();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();

  async function handleAccept() {
    if (!preview.data) return;
    try {
      await accept.mutateAsync({ id: preview.data.id, token });
      push({ title: "Invitation accepted.", variant: "success" });
      await navigate({ to: "/dashboard" });
    } catch {
      // The hook throws an ApiError; the inline alert block below
      // surfaces the failure. No toast — keeps the in-place state
      // authoritative.
    }
  }

  async function handleDecline() {
    if (!preview.data) return;
    try {
      await decline.mutateAsync({ id: preview.data.id, token });
      push({ title: "Invitation declined.", variant: "info" });
      await navigate({ to: "/dashboard" });
    } catch {
      // Inline alert below surfaces failure.
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight"
      >
        You&apos;ve been invited
      </h1>

      <div className="mt-8">
        {preview.isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading the invitation…
          </p>
        ) : preview.isError ? (
          <div
            className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <p className="font-medium">This invitation link is no longer valid.</p>
            <p className="mt-1">Ask the GM to send a new one.</p>
          </div>
        ) : preview.data ? (
          <>
            <AcceptInvitationCard
              preview={preview.data}
              isAuthenticated={auth.isAuthenticated}
              isAccepting={accept.isPending}
              onAccept={() => {
                void handleAccept();
              }}
              onDecline={
                auth.isAuthenticated
                  ? () => {
                      // The card renders the trigger; we render a
                      // sibling `<DeclineInvitationConfirm>` below
                      // so the confirm flow lives outside the card.
                    }
                  : undefined
              }
              token={token}
            />

            {auth.isAuthenticated ? (
              <DeclineInvitationConfirm
                characterName={preview.data.characterName}
                isPending={decline.isPending}
                onConfirm={handleDecline}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  disabled={accept.isPending}
                  data-testid="invitation-decline-trigger"
                >
                  Decline invitation
                </Button>
              </DeclineInvitationConfirm>
            ) : null}

            {accept.isError ? (
              <p
                className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
                data-testid="invitation-accept-error"
              >
                We couldn&apos;t accept this invitation. The link may have expired or been
                revoked. Ask the GM to send a new one.
              </p>
            ) : null}

            {decline.isError ? (
              <p
                className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
                data-testid="invitation-decline-error"
              >
                We couldn&apos;t decline this invitation. Please refresh and try again.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
