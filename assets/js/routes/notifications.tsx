import { createFileRoute, redirect } from "@tanstack/react-router";
import { NotificationsList } from "@/features/notifications/components/notifications-list";

export const Route = createFileRoute("/notifications")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: NotificationsRoute,
});

export function NotificationsRoute() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-4xl font-bold tracking-tight"
      >
        Notifications
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything we&apos;ve sent you, newest first.
      </p>

      <div className="mt-8">
        <NotificationsList />
      </div>
    </main>
  );
}
