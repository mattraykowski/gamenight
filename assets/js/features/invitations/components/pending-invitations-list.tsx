import type { ReactNode } from "react";
import type { Invitation } from "../hooks";

export interface PendingInvitationsListProps {
  invitations: ReadonlyArray<Invitation>;
  /** Optional cell at the end of each row — typically a Revoke control. */
  renderActions?: (invitation: Invitation) => ReactNode;
}

/**
 * GM-only list of pending invitations on a game. Renders a clear
 * empty state when there are none, so the section is always
 * present alongside the roster (Constitution Principle V — no
 * blank waiting screens).
 */
export function PendingInvitationsList({
  invitations,
  renderActions,
}: PendingInvitationsListProps) {
  if (invitations.length === 0) {
    return (
      <p
        className="rounded-md border bg-muted px-4 py-6 text-center text-sm text-muted-foreground"
        data-testid="pending-invitations-empty"
      >
        No pending invitations.
      </p>
    );
  }

  return (
    <ul
      className="divide-y rounded-md border"
      data-testid="pending-invitations-list"
    >
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex items-center justify-between gap-4 p-4"
          data-testid={`pending-invitation-${invitation.id}`}
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground" data-testid="pending-character-name">
              {invitation.characterName}
            </p>
            <p
              className="mt-1 truncate text-sm text-muted-foreground"
              data-testid="pending-email"
            >
              {invitation.email}
            </p>
          </div>
          {renderActions ? (
            <div className="shrink-0">{renderActions(invitation)}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
