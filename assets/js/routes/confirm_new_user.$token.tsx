import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmNewUser, type AuthError, type AuthFieldError } from "@/features/auth/hooks";
import { emailFromToken } from "@/lib/auth/jwt";

export const Route = createFileRoute("/confirm_new_user/$token")({
  component: ConfirmNewUserRoute,
});

export function ConfirmNewUserRoute() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const confirm = useConfirmNewUser();
  const [invalid, setInvalid] = useState(false);

  const email = useMemo(() => emailFromToken(token), [token]);

  async function onConfirm() {
    try {
      await confirm.mutateAsync(token);
      await navigate({ to: "/dashboard", search: { toast: "email_confirmed" } });
    } catch (rawError) {
      const err = rawError as AuthError | undefined;
      if (err && typeof err === "object" && "fieldErrors" in err) {
        const tokenError = err.fieldErrors.find(
          (fieldError: AuthFieldError) =>
            fieldError.code === "invalid_token" ||
            fieldError.code === "expired" ||
            fieldError.message.toLowerCase().includes("token"),
        );
        if (tokenError || err.status === 422 || err.status === 401) {
          setInvalid(true);
          return;
        }
      }
      setInvalid(true);
    }
  }

  if (invalid) {
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight"
        >
          Confirmation link is invalid
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This confirmation link is no longer valid. It may have expired or already been used.
        </p>
        <div className="mt-6 flex gap-3">
          <a
            href="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Register again
          </a>
        </div>
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
        Confirm your email
      </h1>
      {email ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="confirm-banner">
          Confirming email for <span className="font-medium text-foreground">{email}</span>.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Confirming your email address.</p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Click the button below to confirm your email address and finish setting up your account.
      </p>
      <Button
        type="button"
        className="mt-6 w-full"
        onClick={onConfirm}
        disabled={confirm.isPending}
      >
        {confirm.isPending ? "Confirming…" : "Confirm email address"}
      </Button>
    </main>
  );
}
