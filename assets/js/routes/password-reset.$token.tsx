import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useResetPassword,
  type AuthError,
  type AuthFieldError,
} from "@/features/auth/hooks";

export const Route = createFileRoute("/password-reset/$token")({
  component: PasswordResetRoute,
});

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirmation: z.string().min(1, "Please confirm your new password"),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function PasswordResetRoute() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const resetPassword = useResetPassword();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    try {
      await resetPassword.mutateAsync({
        token,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      });
      await navigate({ to: "/dashboard", search: { toast: "password_reset" } });
    } catch (rawError) {
      applyAuthErrorToForm(rawError, setError);
    }
  }

  const formError = resolveFormError(resetPassword.error);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight"
      >
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter a new password for your account.
      </p>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-4"
        aria-describedby={formError ? "reset-password-form-error" : undefined}
      >
        {formError ? (
          <p
            id="reset-password-form-error"
            role="alert"
            className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}{" "}
            <a
              href="/reset"
              className="font-medium underline-offset-4 hover:underline"
            >
              Request a new link
            </a>
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "reset-password-error" : "reset-password-hint"}
            {...register("password")}
          />
          {errors.password ? (
            <p id="reset-password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p id="reset-password-hint" className="text-sm text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-password-confirmation">Confirm new password</Label>
          <Input
            id="reset-password-confirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.passwordConfirmation ? true : undefined}
            aria-describedby={
              errors.passwordConfirmation ? "reset-password-confirmation-error" : undefined
            }
            {...register("passwordConfirmation")}
          />
          {errors.passwordConfirmation ? (
            <p
              id="reset-password-confirmation-error"
              className="text-sm text-destructive"
            >
              {errors.passwordConfirmation.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Resetting password…" : "Reset password"}
        </Button>
      </form>
    </main>
  );
}

function applyAuthErrorToForm(
  raw: unknown,
  setError: ReturnType<typeof useForm<ResetPasswordValues>>["setError"],
) {
  const err = raw as AuthError | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) {
    setError("root", { message: "Something went wrong. Please try again." });
    return;
  }

  const fieldErrors = Array.isArray(err.fieldErrors) ? err.fieldErrors : [];
  for (const fieldError of fieldErrors) {
    if (fieldError.field === "password") {
      setError("password", { message: fieldError.message });
    } else if (fieldError.field === "password_confirmation") {
      setError("passwordConfirmation", { message: fieldError.message });
    }
  }

  const tokenError = fieldErrors.find(
    (fieldError: AuthFieldError) =>
      fieldError.field === "reset_token" ||
      fieldError.code === "invalid_token" ||
      fieldError.code === "expired",
  );
  const topLevel = fieldErrors.find(
    (fieldError: AuthFieldError) => fieldError.field === null,
  );
  if (tokenError || topLevel) {
    setError("root", {
      message: tokenError?.message ?? topLevel?.message ?? err.message,
    });
  }
}

function resolveFormError(mutationError: unknown): string | null {
  const err = mutationError as AuthError | null | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) return null;
  if (err.kind === "validation" || err.kind === "rate_limited") {
    const tokenError = Array.isArray(err.fieldErrors)
      ? err.fieldErrors.find(
          (fieldError: AuthFieldError) =>
            fieldError.field === "reset_token" ||
            fieldError.code === "invalid_token" ||
            fieldError.code === "expired",
        )
      : undefined;
    if (tokenError) return tokenError.message;
    const topLevel = Array.isArray(err.fieldErrors)
      ? err.fieldErrors.find(
          (fieldError: AuthFieldError) => fieldError.field === null,
        )
      : undefined;
    return topLevel?.message ?? null;
  }
  return null;
}
