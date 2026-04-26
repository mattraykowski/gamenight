import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  gameFormSchema,
  GAME_STATUSES,
  type GameFormValues,
  type GameStatus,
} from "../schemas";

const STATUS_LABELS: Record<GameStatus, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
};

export interface GameFormProps {
  /** Initial field values — used by both create and edit flows. */
  defaultValues?: Partial<GameFormValues>;
  /** What to do with the validated submission. */
  onSubmit: (values: GameFormValues) => Promise<void> | void;
  /** Copy for the primary action button. Defaults to "Save". */
  submitLabel?: string;
  /** Additional top-of-form error (banner) rendered above the fields. */
  formError?: string | null;
  /** Disables the form while a parent-owned mutation is in flight. */
  isSubmitting?: boolean;
}

/**
 * The shared Game form used by both the create and edit surfaces.
 * Validation is shared via the Zod schema in `../schemas.ts`; the
 * field order, spacing, and typography match the view page's
 * `<GameFieldRow>` primitive so the edit page does not visibly shift
 * fields relative to the detail page (FR-013 / SC-004).
 */
export function GameForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  formError,
  isSubmitting: parentSubmitting,
}: GameFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: internalSubmitting },
  } = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      status: defaultValues?.status ?? "active",
    },
    mode: "onTouched",
  });

  const submitting = parentSubmitting ?? internalSubmitting;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-describedby={formError ? "game-form-error" : undefined}
    >
      {formError ? (
        <p
          id="game-form-error"
          role="alert"
          data-testid="auth-form-error"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="game-title">Title</Label>
        <Input
          id="game-title"
          type="text"
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "game-title-error" : undefined}
          {...register("title")}
        />
        {errors.title ? (
          <p id="game-title-error" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="game-description">Description</Label>
        <Textarea
          id="game-description"
          rows={5}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description ? "game-description-error" : "game-description-hint"
          }
          {...register("description")}
        />
        {errors.description ? (
          <p id="game-description-error" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        ) : (
          <p id="game-description-hint" className="text-sm text-muted-foreground">
            Optional. Up to 2,000 characters.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="game-status">Status</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="game-status"
                aria-invalid={errors.status ? true : undefined}
              >
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                {GAME_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.status ? (
          <p id="game-status-error" className="text-sm text-destructive">
            {errors.status.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? `${submitLabel}…` : submitLabel}
      </Button>
    </form>
  );
}
