import { useState, type ReactNode } from "react";

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

export interface PostScheduleDialogProps {
  /** Mutation handler — fires when the GM confirms. */
  onConfirm: () => Promise<void> | void;
  /** True while the parent's mutation is in flight. */
  isPending: boolean;
  /** Custom trigger control supplied by the caller. */
  children: ReactNode;
}

/**
 * Soft-confirm dialog for posting a schedule. Sets up the GM for
 * the side effects ("we'll lock player edits + email everyone")
 * before the action fires.
 */
export function PostScheduleDialog({
  onConfirm,
  isPending,
  children,
}: PostScheduleDialogProps) {
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
          <DialogTitle>Post this schedule?</DialogTitle>
          <DialogDescription>
            Posting will lock player edits and email every linked player. You
            can still adjust Final values afterward, but players can&apos;t
            change their availability anymore.
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
            {isPending ? "Posting…" : "Post schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
