import { Button } from "@/components/ui/button";
import { useMyNotifications, useMarkRead, type Notification } from "../hooks";
import { describeNotification, type NotificationKind } from "../kinds";

/**
 * Full-page list of the actor's notifications. Renders both
 * unread + resolved entries; the bell shows only unread ones.
 *
 * Each row's "Mark read" action invalidates both the list and the
 * unread-count cache so the bell badge updates atomically with the
 * user's perception.
 */
export function NotificationsList() {
  const notifications = useMyNotifications();
  const markRead = useMarkRead();

  if (notifications.isPending) {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Loading your notifications…
      </p>
    );
  }

  if (notifications.isError) {
    return (
      <p
        className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        role="alert"
      >
        We couldn&apos;t load your notifications. Please refresh.
      </p>
    );
  }

  const rows = notifications.data ?? [];

  if (rows.length === 0) {
    return (
      <p
        className="rounded-md border bg-muted px-4 py-6 text-center text-sm text-muted-foreground"
        data-testid="notifications-list-empty"
      >
        You don&apos;t have any notifications yet.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border" data-testid="notifications-list">
      {rows.map((row) => (
        <NotificationRow
          key={row.id}
          row={row}
          onMarkRead={() => {
            void markRead.mutate({ id: row.id });
          }}
          isMarking={markRead.isPending}
        />
      ))}
    </ul>
  );
}

function NotificationRow({
  row,
  onMarkRead,
  isMarking,
}: {
  row: Notification;
  onMarkRead: () => void;
  isMarking: boolean;
}) {
  const descriptor = describeNotification(row.kind as NotificationKind, row.subjectId);
  const isUnread = row.readAt === null && row.resolvedAt === null;

  return (
    <li
      className="flex items-start justify-between gap-4 p-4"
      data-testid={`notifications-list-row-${row.id}`}
    >
      <div className="min-w-0">
        <p
          className={
            isUnread
              ? "font-semibold text-foreground"
              : "font-medium text-muted-foreground"
          }
          data-testid="notifications-list-title"
        >
          {descriptor.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.resolvedAt
            ? "Resolved"
            : row.readAt
              ? "Read"
              : "Unread"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isUnread ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMarking}
            onClick={onMarkRead}
            data-testid={`notifications-list-mark-read-${row.id}`}
          >
            Mark read
          </Button>
        ) : null}
      </div>
    </li>
  );
}
