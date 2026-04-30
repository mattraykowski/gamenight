import { createFileRoute, redirect } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { z } from "zod";
import { CornerOrnament } from "@/components/ui/corner-ornament";
import { useCurrentUser } from "@/features/current-user/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { MyGamesColumn } from "@/features/games/components/my-games-column";
import { MyCharactersColumn } from "@/features/players/components/my-characters-column";
import { useConsumeToastParam } from "@/features/toasts/toast-provider";

const dashboardSearchSchema = z.object({
  toast: z.string().optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: dashboardSearchSchema,
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: DashboardRoute,
});

/**
 * Exported so unit tests can render the component without going through
 * TanStack Router's lazy/suspense wrapping (which `autoCodeSplitting`
 * applies to `Route.options.component`).
 */
export function DashboardRoute() {
  const auth = useAuth();
  const search = Route.useSearch();
  const { data, isPending, isError, error } = useCurrentUser();

  useConsumeToastParam(search.toast);

  const displayName = data?.email ?? auth.user?.email ?? "";
  const friendlyName = displayName.split("@")[0] || "Adventurer";

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* Hero — serif headline + descriptive subtitle, with a corner
         wax-seal ornament in the top-left for the tactile flourish
         called out in the design brief ("decorative borders ...
         occasionally breaking the border with a gold ornament"). */}
      <header
        aria-labelledby="dashboard-heading"
        className="relative mb-12 border-b border-border pb-6"
      >
        <CornerOrnament icon={Sparkles} />
        <h1
          id="dashboard-heading"
          data-route-heading
          tabIndex={-1}
          className="font-serif text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {isPending ? (
            "Welcome back."
          ) : (
            <>
              Welcome back,{" "}
              <span data-testid="current-user-email">{friendlyName}</span>.
            </>
          )}
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          {isPending
            ? "Loading your account…"
            : isError
              ? `We couldn't load your account (${error.kind}).`
              : "The candles are lit, the dice are cold, and your fellowship awaits your command."}
        </p>
      </header>

      <div
        className="grid grid-cols-1 gap-12 lg:grid-cols-2"
        data-testid="dashboard-columns"
      >
        <MyCharactersColumn />
        <MyGamesColumn />
      </div>
    </main>
  );
}
