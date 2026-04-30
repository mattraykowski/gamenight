import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GameForm } from "@/features/games/components/game-form";
import { useGame, useUpdateGame } from "@/features/games/hooks";
import { useToasts } from "@/features/toasts/toast-provider";
import type { GameFormValues } from "@/features/games/schemas";
import type { ApiError } from "@/lib/api/errors";
import type { UseFormSetError } from "react-hook-form";

export const Route = createFileRoute("/games/$id/edit")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: GameEditRoute,
});

export function GameEditRoute() {
  const { id } = Route.useParams();
  const game = useGame(id);
  const update = useUpdateGame();
  const navigate = useNavigate();
  const { push } = useToasts();

  async function onSubmit(
    values: GameFormValues,
    setError?: UseFormSetError<GameFormValues>,
  ) {
    try {
      await update.mutateAsync({
        id,
        title: values.title,
        description: values.description.length === 0 ? null : values.description,
        status: values.status,
      });
      push({ title: "Game updated.", variant: "success" });
      await navigate({ to: "/games/$id", params: { id } });
    } catch (rawError) {
      applyApiErrorToForm(rawError, setError);
    }
  }

  if (game.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1
          data-route-heading
          tabIndex={-1}
          className="font-serif text-3xl font-bold tracking-tight"
        >
          Loading game…
        </h1>
      </main>
    );
  }

  if (game.isError || !game.data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1
          data-route-heading
          tabIndex={-1}
          className="font-serif text-3xl font-bold tracking-tight"
        >
          Game not found
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          We couldn&apos;t find that game. It may have been deleted, or it belongs to someone
          else.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link to="/dashboard" search={{}}>
              Back to dashboard
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const { data: entry } = game;
  const formError = resolveFormError(update.error);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1
          data-route-heading
          tabIndex={-1}
          className="font-serif text-3xl font-bold tracking-tight"
        >
          Edit: {entry.title}
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/games/$id" params={{ id }}>
            Cancel
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <GameForm
          defaultValues={{
            title: entry.title,
            description: entry.description ?? "",
            status: entry.status,
          }}
          onSubmit={(values) => onSubmit(values)}
          submitLabel="Save changes"
          formError={formError}
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
