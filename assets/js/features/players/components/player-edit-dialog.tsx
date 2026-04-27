import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLAYER_STATUSES,
  playerEditFormSchema,
  type PlayerEditFormValues,
  type PlayerStatus,
} from "../schemas";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  done: "Done",
};

export interface PlayerEditDialogProps {
  /** The player being edited (with the GM-visible gm_notes). */
  player: {
    id: string;
    characterName: string;
    characterSummary: string | null;
    visibleGmNotes: string | null;
    status: PlayerStatus;
  };
  /** GM submits the form. */
  onSubmit: (values: PlayerEditFormValues) => Promise<void> | void;
  /** True while the parent's update mutation is in flight. */
  isPending?: boolean;
  /** Trigger control. */
  children: ReactNode;
}

/**
 * Modal form for the GM to edit a single Player's character data
 * and status. Reuses the auth + games form stack (Shadcn `<Form>`,
 * RHF, Zod, `mode: "onTouched"`). Closes on a successful submit.
 */
export function PlayerEditDialog({
  player,
  onSubmit,
  isPending = false,
  children,
}: PlayerEditDialogProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlayerEditFormValues>({
    resolver: zodResolver(playerEditFormSchema),
    defaultValues: {
      characterName: player.characterName,
      characterSummary: player.characterSummary ?? "",
      gmNotes: player.visibleGmNotes ?? "",
      status: player.status,
    },
    mode: "onTouched",
  });

  // Reset the form when the dialog reopens so any inflight edits
  // from a previous open don't leak in if the GM cancelled.
  useEffect(() => {
    if (open) {
      reset({
        characterName: player.characterName,
        characterSummary: player.characterSummary ?? "",
        gmNotes: player.visibleGmNotes ?? "",
        status: player.status,
      });
    }
  }, [open, player, reset]);

  async function handleFormSubmit(values: PlayerEditFormValues) {
    await onSubmit(values);
    setOpen(false);
  }

  const submitting = isPending || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit player</DialogTitle>
          <DialogDescription>
            Update <span className="font-medium text-foreground">{player.characterName}</span>
            ’s character information and status.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-4"
          data-testid="player-edit-form"
        >
          <div className="space-y-2">
            <Label htmlFor="player-edit-character-name">Character name</Label>
            <Input
              id="player-edit-character-name"
              type="text"
              autoComplete="off"
              aria-invalid={errors.characterName ? true : undefined}
              aria-describedby={
                errors.characterName ? "player-edit-character-name-error" : undefined
              }
              {...register("characterName")}
            />
            {errors.characterName ? (
              <p
                id="player-edit-character-name-error"
                className="text-sm text-destructive"
              >
                {errors.characterName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-edit-character-summary">Character summary</Label>
            <Textarea
              id="player-edit-character-summary"
              rows={3}
              aria-invalid={errors.characterSummary ? true : undefined}
              aria-describedby={
                errors.characterSummary ? "player-edit-character-summary-error" : undefined
              }
              {...register("characterSummary")}
            />
            {errors.characterSummary ? (
              <p
                id="player-edit-character-summary-error"
                className="text-sm text-destructive"
              >
                {errors.characterSummary.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-edit-gm-notes">GM notes (private)</Label>
            <Textarea
              id="player-edit-gm-notes"
              rows={3}
              aria-invalid={errors.gmNotes ? true : undefined}
              aria-describedby={
                errors.gmNotes ? "player-edit-gm-notes-error" : "player-edit-gm-notes-hint"
              }
              {...register("gmNotes")}
            />
            {errors.gmNotes ? (
              <p id="player-edit-gm-notes-error" className="text-sm text-destructive">
                {errors.gmNotes.message}
              </p>
            ) : (
              <p
                id="player-edit-gm-notes-hint"
                className="text-sm text-muted-foreground"
              >
                Visible only to you.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="player-edit-status">Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="player-edit-status"
                    aria-invalid={errors.status ? true : undefined}
                  >
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status ? (
              <p className="text-sm text-destructive">{errors.status.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="player-edit-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} data-testid="player-edit-save">
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
