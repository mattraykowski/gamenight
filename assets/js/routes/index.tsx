import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 data-route-heading tabIndex={-1} className="text-4xl font-bold tracking-tight">
        GameNight
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Organize your game groups, schedule sessions, and manage players.
      </p>
      <div className="mt-8">
        <Button>Get started</Button>
      </div>
    </main>
  );
}
