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

/**
 * The literal string the GM must type to arm the destructive confirm.
 * Case-sensitive, no whitespace trimming (FR-017).
 */
const CONFIRMATION_CODE = "delete";

export interface DeleteGameDialogProps {
  /** Title of the game being deleted — surfaced in the dialog copy. */
  gameTitle: string;
  /** Fires when the GM clicks the confirm button after typing `"delete"`. */
  onConfirm: () => void | Promise<void>;
  /** `true` while the parent's delete mutation is in flight. Keeps the
   *  confirm button disabled to prevent double-submit (FR-017 + U7). */
  isPending?: boolean;
  /** The control that opens the dialog. Rendered inside a DialogTrigger. */
  children: ReactNode;
}

/**
 * Typed-confirmation modal for destructive game operations. Used by
 * both the dashboard row's Delete button and the detail page's Delete
 * button. Radix <Dialog> provides focus trap, Escape-to-close,
 * backdrop dismiss, and focus restoration to the trigger on close —
 * no custom a11y plumbing required (constitution Principle IV).
 *
 * The confirm button is disabled until the typed value exactly
 * matches `"delete"` (FR-017), and stays disabled while the
 * mutation is in flight to prevent double-submit.
 */
export function DeleteGameDialog({
  gameTitle,
  onConfirm,
  isPending = false,
  children,
}: DeleteGameDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  // Reset the typed input when the dialog closes so reopening starts
  // fresh. Running in an effect lets Radix's own close-animation
  // complete before the state change.
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const armed = typed === CONFIRMATION_CODE;

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete game</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">{gameTitle}</span>. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-confirmation-input">
            Type{" "}
            <span className="font-mono font-semibold">{CONFIRMATION_CODE}</span>{" "}
            to confirm
          </Label>
          <Input
            id="delete-confirmation-input"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            data-testid="delete-game-confirmation-input"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="delete-game-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!armed || isPending}
            onClick={handleConfirm}
            data-testid="delete-game-confirm"
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
