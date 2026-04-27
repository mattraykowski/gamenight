import { useEffect, useState, type ReactNode } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RevokeInvitationDialogProps {
  /** The invitation being revoked. The invited email is the typed-confirmation value. */
  invitation: { id: string; email: string; characterName: string };
  /** Fires when the GM confirms after typing the invited email exactly. */
  onConfirm: () => void | Promise<void>;
  /** True while the parent's revoke mutation is in flight. */
  isPending?: boolean;
  /** Trigger control. */
  children: ReactNode;
}

/**
 * Typed-confirmation modal for revoking a pending invitation.
 * Mirrors `<DeleteGameDialog />`: GM types the invitee's email
 * exactly to arm the confirm button. Case-sensitive, no whitespace
 * trimming.
 */
export function RevokeInvitationDialog({
  invitation,
  onConfirm,
  isPending = false,
  children,
}: RevokeInvitationDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const armed = typed === invitation.email;

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke invitation</DialogTitle>
          <DialogDescription>
            This will close the invitation for{" "}
            <span className="font-medium text-foreground">{invitation.characterName}</span>{" "}
            and prevent the recipient from accepting it. They&apos;ll see the link as no
            longer valid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="revoke-confirmation-input">
            Type{" "}
            <span className="font-mono font-semibold">{invitation.email}</span> to confirm
          </Label>
          <Input
            id="revoke-confirmation-input"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            data-testid="revoke-invitation-confirmation-input"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="revoke-invitation-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!armed || isPending}
            onClick={handleConfirm}
            data-testid="revoke-invitation-confirm"
          >
            {isPending ? "Revoking…" : "Revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
