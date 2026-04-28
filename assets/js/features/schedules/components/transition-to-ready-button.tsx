import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface TransitionToReadyButtonProps {
  /** Mutation handler — fires when the GM confirms. */
  onConfirm: () => Promise<void> | void;
  /** True while the parent's mutation is in flight. */
  isPending: boolean;
}

/**
 * Soft-confirm dialog that wraps the "Ready for Availability"
 * transition. Sets up the GM for the side effect ("we'll email
 * every player") so they aren't surprised when notifications go
 * out.
 */
export function TransitionToReadyButton({
  onConfirm,
  isPending,
}: TransitionToReadyButtonProps) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="default">
          Ready for Availability
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this schedule to players?</DialogTitle>
          <DialogDescription>
            This will email and notify every player on the game so they can
            mark their availability. You can still tweak your own days
            afterward.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Sending…" : "Send to players"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
