import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useRequestPasswordReset,
  type AuthError,
  type AuthFieldError,
} from "@/features/auth/hooks";

const resetSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/reset")({
  validateSearch: resetSearchSchema,
  beforeLoad: ({ context }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ResetRequestRoute,
});

const resetRequestSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type ResetRequestValues = z.infer<typeof resetRequestSchema>;

export function ResetRequestRoute() {
  const search = Route.useSearch();
  const requestReset = useRequestPasswordReset();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: search.email ?? "" },
  });

  async function onSubmit(values: ResetRequestValues) {
    try {
      await requestReset.mutateAsync(values.email);
      setSubmitted(true);
    } catch (rawError) {
      const err = rawError as AuthError | undefined;
      if (err?.kind === "rate_limited") {
        setError("root", { message: err.message });
        return;
      }
      // Any other unexpected error still shows the ambiguous success
      // page — the whole point of the endpoint is to hide the outcome.
      setSubmitted(true);
    }
  }

  const rateLimitMessage = resolveRateLimitMessage(requestReset.error);

  if (submitted) {
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight"
        >
          Check your email
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          If that email has an account with us, we&apos;ve sent reset instructions. The link
          will expire shortly for your security.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <a
            href="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight"
      >
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email address associated with your account. We&apos;ll send a link to reset
        your password.
      </p>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-4"
        aria-describedby={rateLimitMessage ? "reset-form-error" : undefined}
      >
        {rateLimitMessage ? (
          <p
            id="reset-form-error"
            role="alert"
            data-testid="auth-form-error"
            className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {rateLimitMessage}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "reset-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="reset-email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </main>
  );
}

function resolveRateLimitMessage(mutationError: unknown): string | null {
  const err = mutationError as AuthError | null | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) return null;
  if (err.kind !== "rate_limited") return null;
  const topLevel = Array.isArray(err.fieldErrors)
    ? err.fieldErrors.find((fieldError: AuthFieldError) => fieldError.field === null)
    : undefined;
  return topLevel?.message ?? err.message;
}
