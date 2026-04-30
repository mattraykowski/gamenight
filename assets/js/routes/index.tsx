import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 data-route-heading tabIndex={-1} className="font-serif text-4xl font-bold tracking-tight">
        GameNight
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Organize your game groups, schedule sessions, and manage players.
      </p>
      <div className="mt-8 flex gap-4">
        {isAuthenticated ? (
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        ) : (
          <Button asChild>
            <a href="/sign-in">Sign in</a>
          </Button>
        )}
      </div>
    </main>
  );
}
