import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignIn, type AuthError, type AuthFieldError } from "@/features/auth/hooks";
import { parseRedirectTarget } from "@/lib/auth/redirect";

const signInSearchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
  email: z.string().optional(),
  // Threaded through from landing-page CTAs so an invitation-driven
  // arrival (`/?invite=…`) survives the click into sign-in.
  invite: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: signInSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: parseRedirectTarget(search.redirect) });
    }
  },
  component: SignInRoute,
});

const signInSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const signIn = useSignIn();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: search.email ?? "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(values: SignInFormValues) {
    try {
      await signIn.mutateAsync(values);
      const target = parseRedirectTarget(search.redirect);
      await navigate({ to: target });
    } catch (rawError) {
      applyAuthErrorToForm(rawError, setError);
    }
  }

  const formError = resolveFormError(signIn.error, search.error);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight"
      >
        Sign in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <a
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Register
        </a>
        .
      </p>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-4"
        aria-describedby={formError ? "sign-in-form-error" : undefined}
      >
        {formError ? (
          <p
            id="sign-in-form-error"
            role="alert"
            data-testid="auth-form-error"
            className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="sign-in-email">Email</Label>
          <Input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "sign-in-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="sign-in-email-error" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="sign-in-password">Password</Label>
            <a
              href="/reset"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot?
            </a>
          </div>
          <Input
            id="sign-in-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "sign-in-password-error" : undefined}
            {...register("password")}
          />
          {errors.password ? (
            <p id="sign-in-password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <Controller
          control={control}
          name="rememberMe"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="sign-in-remember-me"
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
                onBlur={field.onBlur}
                ref={field.ref}
              />
              <Label htmlFor="sign-in-remember-me" className="text-sm font-normal">
                Keep me signed in on this device
              </Label>
            </div>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

/**
 * Maps the {@link AuthError} thrown by {@link useSignIn} onto either
 * per-field react-hook-form errors (via `setError`) or the top-level
 * `root` error that the banner above the form renders. Top-level
 * errors are stored on react-hook-form's virtual `root` key and
 * surfaced by {@link resolveFormError}.
 */
function applyAuthErrorToForm(
  raw: unknown,
  setError: ReturnType<typeof useForm<SignInFormValues>>["setError"],
) {
  const err = raw as AuthError | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) {
    setError("root", { message: "Something went wrong. Please try again." });
    return;
  }

  const fieldErrors = Array.isArray(err.fieldErrors) ? err.fieldErrors : [];
  const topLevel = fieldErrors.find(
    (fieldError: AuthFieldError) => fieldError.field === null,
  );
  const emailError = fieldErrors.find(
    (fieldError: AuthFieldError) => fieldError.field === "email",
  );
  const passwordError = fieldErrors.find(
    (fieldError: AuthFieldError) => fieldError.field === "password",
  );

  if (emailError) {
    setError("email", { message: emailError.message });
  }
  if (passwordError) {
    setError("password", { message: passwordError.message });
  }

  if (topLevel || err.kind === "invalid_credentials" || err.kind === "rate_limited") {
    setError("root", { message: topLevel?.message ?? err.message });
  } else if (!emailError && !passwordError) {
    setError("root", { message: err.message });
  }
}

function resolveFormError(mutationError: unknown, searchError: string | undefined): string | null {
  const err = mutationError as AuthError | null | undefined;
  if (err && typeof err === "object" && "message" in err && "kind" in err) {
    const topLevel = Array.isArray(err.fieldErrors)
      ? err.fieldErrors.find((fieldError: AuthFieldError) => fieldError.field === null)
      : undefined;
    return topLevel?.message ?? err.message;
  }
  if (searchError === "generic") {
    return "Something went wrong. Please try signing in again.";
  }
  return null;
}
