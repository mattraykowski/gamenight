import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AcceptInvitationCard } from "@/features/invitations/components/accept-invitation-card";
import { useAcceptInvitation, useInvitationPreview } from "@/features/invitations/hooks";
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

  async function handleAccept() {
    if (!preview.data) return;
    try {
      await accept.mutateAsync({ id: preview.data.id, token });
      push({ title: "Invitation accepted.", variant: "success" });
      await navigate({ to: "/dashboard" });
    } catch {
      // The hook surface throws an `ApiError`; render the error in
      // place via the preview/error blocks below. The mutation's
      // `error` is reflected in the form's banner. No toast for the
      // failure case — keeps the empty/error state authoritative.
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
          <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
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
              token={token}
            />
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
          </>
        ) : null}
      </div>
    </main>
  );
}
