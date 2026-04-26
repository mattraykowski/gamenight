import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import {
  useSignInWithMagicLink,
  type AuthError,
  type AuthFieldError,
} from "@/features/auth/hooks";
import { emailFromToken } from "@/lib/auth/jwt";

export const Route = createFileRoute("/magic_link/$token")({
  component: MagicLinkLandingRoute,
});

export function MagicLinkLandingRoute() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const signIn = useSignInWithMagicLink();
  const auth = useAuth();
  const [invalid, setInvalid] = useState(false);

  const tokenEmail = useMemo(() => emailFromToken(token), [token]);
  const currentEmail = auth.user?.email;
  const accountSwitch =
    currentEmail !== undefined && tokenEmail !== null && currentEmail !== tokenEmail;

  async function onSignIn() {
    try {
      await signIn.mutateAsync(token);
      await navigate({ to: "/dashboard", search: { toast: "signed_in" } });
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
          Sign-in link is invalid
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This sign-in link is no longer valid. It may have expired or already been used.
        </p>
        <div className="mt-6 flex gap-3">
          <a
            href="/magic-link"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Request a new link
          </a>
          <a
            href="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Use a password instead
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
        Sign in to Game Night
      </h1>
      {tokenEmail ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="magic-link-banner">
          Signing in as <span className="font-medium text-foreground">{tokenEmail}</span>.
        </p>
      ) : null}
      {accountSwitch ? (
        <p
          className="mt-4 rounded-md border border-muted bg-muted px-3 py-2 text-sm text-foreground"
          role="status"
          data-testid="account-switch-banner"
        >
          You are currently signed in as <span className="font-medium">{currentEmail}</span>.
          Continuing will switch accounts.
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-6 w-full"
        onClick={onSignIn}
        disabled={signIn.isPending}
      >
        {signIn.isPending ? "Signing in…" : "Sign in to Game Night"}
      </Button>
    </main>
  );
}
