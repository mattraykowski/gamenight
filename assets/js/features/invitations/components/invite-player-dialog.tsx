import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InvitationForm } from "./invitation-form";
import type { InvitationFormValues } from "../schemas";

export interface InvitePlayerDialogProps {
  /** Called with validated form values; the dialog awaits the result. */
  onSubmit: (values: InvitationFormValues) => Promise<void> | void;
  /** True while the parent's create mutation is in flight. */
  isPending?: boolean;
  /** Trigger control supplied by the caller (button next to the Players header). */
  children: ReactNode;
}

/**
 * Modal wrapper around `<InvitationForm />`. Triggered from the
 * GM's `/games/:id` view via an "Invite player" button next to the
 * Players section heading. Closes on a successful submit; the
 * caller is responsible for refreshing the surrounding data via
 * its mutation's invalidations.
 */
export function InvitePlayerDialog({
  onSubmit,
  isPending,
  children,
}: InvitePlayerDialogProps) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(values: InvitationFormValues) {
    await onSubmit(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent data-testid="invite-player-dialog">
        <DialogHeader>
          <DialogTitle>Invite a player</DialogTitle>
          <DialogDescription>
            Send an invitation. We&apos;ll email a link the invitee can use to accept and
            join your roster.
          </DialogDescription>
        </DialogHeader>
        <InvitationForm
          key={open ? "open" : "closed"}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
