import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DeclineInvitationConfirmProps {
  /** The character name that's about to be declined — surfaced in the copy. */
  characterName: string;
  /** Fires when the user clicks the confirm button. */
  onConfirm: () => void | Promise<void>;
  /** True while the parent's decline mutation is in flight. */
  isPending?: boolean;
  /** The control that opens the dialog. */
  children: ReactNode;
}

/**
 * Lightweight confirm modal for declining an invitation. Single
 * primary button (no typed-confirmation) per spec — declining is
 * recoverable in the sense that the GM can always re-invite, so
 * the friction of a typed-confirmation step would be over the top.
 *
 * Reuses Radix `<Dialog>` so the focus-trap / Escape-to-close /
 * focus-restoration story comes for free (Constitution Principle
 * IV).
 */
export function DeclineInvitationConfirm({
  characterName,
  onConfirm,
  isPending = false,
  children,
}: DeclineInvitationConfirmProps) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline this invitation?</DialogTitle>
          <DialogDescription>
            You&apos;re about to decline the invitation to play as{" "}
            <span className="font-medium text-foreground">{characterName}</span>. The link
            will become invalid; the GM can always send you a new invitation.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="decline-invitation-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
            data-testid="decline-invitation-confirm"
          >
            {isPending ? "Declining…" : "Decline invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
