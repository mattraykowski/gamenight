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

const CONFIRMATION_CODE = "delete";

export interface DeleteScheduleDialogProps {
  scheduleName: string;
  onConfirm: (confirmation: string) => void | Promise<void>;
  isPending?: boolean;
  children: ReactNode;
}

export function DeleteScheduleDialog({
  scheduleName,
  onConfirm,
  isPending = false,
  children,
}: DeleteScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const armed = typed === CONFIRMATION_CODE;

  async function handleConfirm() {
    await onConfirm(typed);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete schedule</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">{scheduleName}</span>{" "}
            along with every player&apos;s availability for that month. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-schedule-confirmation-input">
            Type{" "}
            <span className="font-mono font-semibold">{CONFIRMATION_CODE}</span>{" "}
            to confirm
          </Label>
          <Input
            id="delete-schedule-confirmation-input"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            data-testid="delete-schedule-confirmation-input"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="delete-schedule-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!armed || isPending}
            onClick={handleConfirm}
            data-testid="delete-schedule-confirm"
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
