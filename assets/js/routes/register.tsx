import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister, type AuthError, type AuthFieldError } from "@/features/auth/hooks";
import { parseRedirectTarget } from "@/lib/auth/redirect";

const registerSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/register")({
  validateSearch: registerSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: parseRedirectTarget(search.redirect) });
    }
  },
  component: RegisterRoute,
});

const registerSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirmation: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const register = useRegister();
  const [takenEmail, setTakenEmail] = useState<string | null>(null);

  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      await register.mutateAsync(values);
      const target = parseRedirectTarget(search.redirect);
      await navigate({ to: target });
    } catch (rawError) {
      applyAuthErrorToForm(rawError, values.email, setError, setTakenEmail);
    }
  }

  const formError = resolveFormError(register.error);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight"
      >
        Create your account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Already have an account?{" "}
        <a
          href="/sign-in"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </a>
        .
      </p>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-4"
        aria-describedby={formError ? "register-form-error" : undefined}
      >
        {formError ? (
          <p
            id="register-form-error"
            role="alert"
            className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={
              errors.email
                ? "register-email-error"
                : takenEmail === null
                  ? undefined
                  : "register-email-taken"
            }
            {...registerField("email")}
          />
          {errors.email ? (
            <p id="register-email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
          {takenEmail ? (
            <p id="register-email-taken" className="text-sm text-destructive">
              That email is already registered.{" "}
              <a
                href={`/sign-in?email=${encodeURIComponent(takenEmail)}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                Sign in
              </a>{" "}
              or{" "}
              <a
                href={`/reset?email=${encodeURIComponent(takenEmail)}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                reset your password
              </a>{" "}
              instead.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "register-password-error" : "register-password-hint"}
            {...registerField("password")}
          />
          {errors.password ? (
            <p id="register-password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p id="register-password-hint" className="text-sm text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password-confirmation">Confirm password</Label>
          <Input
            id="register-password-confirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.passwordConfirmation ? true : undefined}
            aria-describedby={
              errors.passwordConfirmation ? "register-password-confirmation-error" : undefined
            }
            {...registerField("passwordConfirmation")}
          />
          {errors.passwordConfirmation ? (
            <p
              id="register-password-confirmation-error"
              className="text-sm text-destructive"
            >
              {errors.passwordConfirmation.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </main>
  );
}

function applyAuthErrorToForm(
  raw: unknown,
  submittedEmail: string,
  setError: ReturnType<typeof useForm<RegisterFormValues>>["setError"],
  setTakenEmail: (email: string | null) => void,
) {
  const err = raw as AuthError | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) {
    setError("root", { message: "Something went wrong. Please try again." });
    return;
  }

  const fieldErrors = Array.isArray(err.fieldErrors) ? err.fieldErrors : [];
  const takenError = fieldErrors.find(
    (fieldError: AuthFieldError) =>
      fieldError.field === "email" &&
      (fieldError.code === "taken" ||
        /already been taken|already exists|already registered/i.test(fieldError.message)),
  );
  if (takenError) {
    setTakenEmail(submittedEmail);
    return;
  }

  const topLevel = fieldErrors.find(
    (fieldError: AuthFieldError) => fieldError.field === null,
  );
  for (const fieldError of fieldErrors) {
    if (fieldError.field === "email") {
      setError("email", { message: fieldError.message });
    } else if (fieldError.field === "password") {
      setError("password", { message: fieldError.message });
    } else if (fieldError.field === "password_confirmation") {
      setError("passwordConfirmation", { message: fieldError.message });
    }
  }
  if (topLevel || (err.kind !== "validation" && fieldErrors.length === 0)) {
    setError("root", { message: topLevel?.message ?? err.message });
  }
}

function resolveFormError(mutationError: unknown): string | null {
  const err = mutationError as AuthError | null | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) return null;
  if (err.kind === "rate_limited") {
    return err.message;
  }
  const topLevel = Array.isArray(err.fieldErrors)
    ? err.fieldErrors.find((fieldError: AuthFieldError) => fieldError.field === null)
    : undefined;
  return topLevel?.message ?? null;
}
