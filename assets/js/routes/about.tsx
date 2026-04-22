import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  component: AboutRoute,
});

function AboutRoute() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 data-route-heading tabIndex={-1} className="text-4xl font-bold tracking-tight">
        About GameNight
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        GameNight helps Game Masters schedule sessions and manage players across multiple games.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
