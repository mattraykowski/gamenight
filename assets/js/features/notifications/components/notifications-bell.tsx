import { Link, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useListMyPendingInvitations,
  useAcceptInvitationForMe,
  useDeclineInvitationForMe,
  type Invitation,
} from "@/features/invitations/hooks";
import { useUnreadCount } from "../hooks";
import { useToasts } from "@/features/toasts/toast-provider";

/**
 * Navbar bell — unread badge + dropdown of pending invitations
 * with inline accept/decline. Polls the unread count every 60s
 * (driven by `useUnreadCount`'s `refetchInterval`).
 *
 * Renders nothing when not authenticated — the parent (`<NavBar>`)
 * already gates this on `isAuthenticated`, but a local guard keeps
 * the component self-contained for tests.
 */
export function NotificationsBell() {
  const unread = useUnreadCount();
  const pending = useListMyPendingInvitations();
  const accept = useAcceptInvitationForMe();
  const decline = useDeclineInvitationForMe();
  const navigate = useNavigate();
  const { push } = useToasts();

  const count = unread.data ?? 0;
  const hasUnread = count > 0;

  async function handleAccept(invitation: Invitation) {
    try {
      await accept.mutateAsync({ id: invitation.id });
      push({ title: "Invitation accepted.", variant: "success" });
      await navigate({ to: "/dashboard", search: {} });
    } catch {
      push({
        title: "Could not accept the invitation. Please try again.",
        variant: "error",
      });
    }
  }

  async function handleDecline(invitation: Invitation) {
    try {
      await decline.mutateAsync({ id: invitation.id });
      push({ title: "Invitation declined.", variant: "info" });
    } catch {
      push({
        title: "Could not decline the invitation. Please try again.",
        variant: "error",
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            hasUnread
              ? `Notifications, ${count} unread`
              : "Notifications"
          }
          data-testid="notifications-bell-trigger"
          className="relative"
        >
          <BellIcon />
          {hasUnread ? (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-[1rem] justify-center px-1 text-[10px]"
              data-testid="notifications-bell-badge"
            >
              {count > 99 ? "99+" : String(count)}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80"
        data-testid="notifications-bell-menu"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {pending.isPending ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : pending.isError ? (
          <DropdownMenuItem disabled className="text-destructive">
            Couldn&apos;t load notifications.
          </DropdownMenuItem>
        ) : !pending.data || pending.data.length === 0 ? (
          <DropdownMenuItem disabled data-testid="notifications-bell-empty">
            You&apos;re all caught up.
          </DropdownMenuItem>
        ) : (
          pending.data.slice(0, 10).map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-col gap-2 px-2 py-2"
              data-testid={`notifications-bell-row-${invitation.id}`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {invitation.characterName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Invitation pending
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  disabled={accept.isPending}
                  onClick={() => {
                    void handleAccept(invitation);
                  }}
                  data-testid={`notifications-bell-accept-${invitation.id}`}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={decline.isPending}
                  onClick={() => {
                    void handleDecline(invitation);
                  }}
                  data-testid={`notifications-bell-decline-${invitation.id}`}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to="/notifications"
            className="w-full text-center text-sm font-medium"
            data-testid="notifications-bell-view-all"
          >
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BellIcon() {
  // Inline SVG so the bell doesn't depend on lucide-react being
  // imported elsewhere; matches the icon-button sizing already
  // expected by Shadcn's `<Button size="icon-sm">`.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
