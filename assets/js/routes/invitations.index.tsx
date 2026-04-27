import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useListMyPendingInvitations } from "@/features/invitations/hooks";

export const Route = createFileRoute("/invitations/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: InvitationsIndexRoute,
});

export function InvitationsIndexRoute() {
  const pending = useListMyPendingInvitations();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight"
      >
        My invitations
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pending invitations sent to your email address.
      </p>

      <section className="mt-8" aria-labelledby="pending-invitations-heading">
        <h2 id="pending-invitations-heading" className="sr-only">
          Pending invitations
        </h2>

        {pending.isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading your invitations…
          </p>
        ) : pending.isError ? (
          <p
            className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            We couldn&apos;t load your invitations. Please refresh.
          </p>
        ) : pending.data && pending.data.length > 0 ? (
          <ul
            className="divide-y rounded-md border"
            data-testid="my-pending-invitations-list"
          >
            {pending.data.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground" data-testid="my-pending-character-name">
                    {invitation.characterName}
                  </p>
                  {invitation.characterSummary ? (
                    <p
                      className="mt-1 truncate text-sm text-muted-foreground"
                      data-testid="my-pending-character-summary"
                    >
                      {invitation.characterSummary}
                    </p>
                  ) : null}
                </div>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  data-testid="my-pending-open-link"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            You don&apos;t have any pending invitations right now.
          </p>
        )}
      </section>
    </main>
  );
}
