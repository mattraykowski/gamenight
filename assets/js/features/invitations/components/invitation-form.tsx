import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invitationFormSchema, type InvitationFormValues } from "../schemas";

export interface InvitationFormProps {
  /** Initial field values — typically all-empty for invite create. */
  defaultValues?: Partial<InvitationFormValues>;
  /** Submission handler — receives validated values. */
  onSubmit: (values: InvitationFormValues) => Promise<void> | void;
  /** Top-of-form error banner. */
  formError?: string | null;
  /** Disables the form while a parent-owned mutation is in flight. */
  isSubmitting?: boolean;
  /** Submit button label; defaults to "Send invitation". */
  submitLabel?: string;
}

/**
 * GM-side form for inviting a new player to a game. Rendered
 * inside `<InvitePlayerDialog />` on `/games/:id` (triggered from
 * the Players section header). Mirrors the field order the spec
 * describes (email, character name, summary, GM notes) and uses the
 * Shadcn primitives + RHF + Zod stack established by the auth and
 * games forms.
 */
export function InvitationForm({
  defaultValues,
  onSubmit,
  formError,
  isSubmitting: parentSubmitting,
  submitLabel = "Send invitation",
}: InvitationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: internalSubmitting },
  } = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: defaultValues?.email ?? "",
      characterName: defaultValues?.characterName ?? "",
      characterSummary: defaultValues?.characterSummary ?? "",
      gmNotes: defaultValues?.gmNotes ?? "",
    },
    mode: "onTouched",
  });

  const submitting = parentSubmitting ?? internalSubmitting;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      aria-describedby={formError ? "invitation-form-error" : undefined}
      data-testid="invitation-form"
    >
      {formError ? (
        <p
          id="invitation-form-error"
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="invitation-email">Email</Label>
        <Input
          id="invitation-email"
          type="email"
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "invitation-email-error" : "invitation-email-hint"}
          {...register("email")}
        />
        {errors.email ? (
          <p id="invitation-email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : (
          <p id="invitation-email-hint" className="text-sm text-muted-foreground">
            We&apos;ll email a link the invitee can use to accept.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invitation-character-name">Character name</Label>
        <Input
          id="invitation-character-name"
          type="text"
          autoComplete="off"
          aria-invalid={errors.characterName ? true : undefined}
          aria-describedby={
            errors.characterName ? "invitation-character-name-error" : undefined
          }
          {...register("characterName")}
        />
        {errors.characterName ? (
          <p id="invitation-character-name-error" className="text-sm text-destructive">
            {errors.characterName.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invitation-character-summary">Character summary</Label>
        <Textarea
          id="invitation-character-summary"
          rows={4}
          aria-invalid={errors.characterSummary ? true : undefined}
          aria-describedby={
            errors.characterSummary
              ? "invitation-character-summary-error"
              : "invitation-character-summary-hint"
          }
          {...register("characterSummary")}
        />
        {errors.characterSummary ? (
          <p
            id="invitation-character-summary-error"
            className="text-sm text-destructive"
          >
            {errors.characterSummary.message}
          </p>
        ) : (
          <p
            id="invitation-character-summary-hint"
            className="text-sm text-muted-foreground"
          >
            Optional. Up to 4,000 characters.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invitation-gm-notes">GM notes (private)</Label>
        <Textarea
          id="invitation-gm-notes"
          rows={3}
          aria-invalid={errors.gmNotes ? true : undefined}
          aria-describedby={
            errors.gmNotes ? "invitation-gm-notes-error" : "invitation-gm-notes-hint"
          }
          {...register("gmNotes")}
        />
        {errors.gmNotes ? (
          <p id="invitation-gm-notes-error" className="text-sm text-destructive">
            {errors.gmNotes.message}
          </p>
        ) : (
          <p id="invitation-gm-notes-hint" className="text-sm text-muted-foreground">
            Visible only to you. Up to 4,000 characters.
          </p>
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? `${submitLabel}…` : submitLabel}
      </Button>
    </form>
  );
}
