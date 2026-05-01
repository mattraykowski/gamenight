import { useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Invitation } from "../hooks";
import { PendingInvitationsList } from "./pending-invitations-list";

export interface PendingInvitationsDialogProps {
  invitations: ReadonlyArray<Invitation>;
  isPending?: boolean;
  isError?: boolean;
  renderActions?: (invitation: Invitation) => ReactNode;
  /** Trigger control supplied by the caller. */
  children: ReactNode;
}

/**
 * Modal wrapper around `<PendingInvitationsList />`. Triggered from
 * the GM's `/games/:id` view via a "Pending invitations" button next
 * to "Invite player". The list is GM-only chrome that doesn't need
 * to occupy permanent vertical space on the page.
 */
export function PendingInvitationsDialog({
  invitations,
  isPending,
  isError,
  renderActions,
  children,
}: PendingInvitationsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent data-testid="pending-invitations-dialog">
        <DialogHeader>
          <DialogTitle>Pending invitations</DialogTitle>
          <DialogDescription>Visible only to you.</DialogDescription>
        </DialogHeader>
        {isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading invitations…
          </p>
        ) : isError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            We couldn&apos;t load pending invitations. Please refresh.
          </p>
        ) : (
          <PendingInvitationsList
            invitations={invitations}
            renderActions={renderActions}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
