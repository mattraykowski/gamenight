import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { GameForm } from "@/features/games/components/game-form";
import { toRegisterGameInput, type GameFormValues } from "@/features/games/schemas";
import { useRegisterGame } from "@/features/games/hooks";
import { useToasts } from "@/features/toasts/toast-provider";
import type { ApiError } from "@/lib/api/errors";
import type { UseFormSetError } from "react-hook-form";

export const Route = createFileRoute("/games/new")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: RegisterGameRoute,
});

export function RegisterGameRoute() {
  const navigate = useNavigate();
  const registerGame = useRegisterGame();
  const { push } = useToasts();

  async function onSubmit(
    values: GameFormValues,
    setError?: UseFormSetError<GameFormValues>,
  ) {
    try {
      await registerGame.mutateAsync(toRegisterGameInput(values));
      push({ title: "Game registered.", variant: "success" });
      await navigate({ to: "/dashboard", search: {} });
    } catch (rawError) {
      applyApiErrorToForm(rawError, setError);
    }
  }

  const topLevelError = resolveFormError(registerGame.error);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="font-serif text-3xl font-bold tracking-tight"
      >
        Register a new game
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add a game to your dashboard. You can always change the status later.
      </p>

      <div className="mt-8">
        <GameForm
          onSubmit={(values) => onSubmit(values)}
          submitLabel="Register game"
          formError={topLevelError}
        />
      </div>
    </main>
  );
}

function applyApiErrorToForm(
  raw: unknown,
  setError?: UseFormSetError<GameFormValues>,
) {
  if (!setError) return;
  const err = raw as ApiError | undefined;
  if (!err || typeof err !== "object" || !("kind" in err)) return;
  if (err.kind === "validation") {
    for (const field of err.fields) {
      if (field === "title" || field === "description" || field === "status") {
        setError(field, { message: err.message });
      }
    }
  }
}

function resolveFormError(err: unknown): string | null {
  const apiErr = err as ApiError | null | undefined;
  if (!apiErr || typeof apiErr !== "object" || !("kind" in apiErr)) return null;
  if (apiErr.kind === "network") {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (apiErr.kind === "auth") {
    return "Your session has expired. Please sign in again.";
  }
  if (apiErr.kind === "validation" && apiErr.fields.length === 0) {
    return apiErr.message;
  }
  if (apiErr.kind === "unknown") {
    return "Something went wrong. Please try again.";
  }
  return null;
}
