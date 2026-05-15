import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const VALUE_PROPS = [
  {
    title: "Schedule the month, together.",
    body: "Set your availability, your players set theirs, you publish the final game-on days.",
  },
  {
    title: "Keep the roster organized.",
    body: "Track every player, every character, across every campaign you run.",
  },
  {
    title: "No more messy group chats.",
    body: "Notifications, invitations, and confirmations all in one place.",
  },
];

export function LandingHero() {
  return (
    <header className="relative overflow-hidden px-6 pt-16 pb-20 sm:pt-24">
      <div className="mx-auto max-w-4xl text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border-2 border-tertiary/30 bg-tertiary-fixed px-4 py-1.5 text-on-tertiary-fixed shadow-[0_4px_0_rgba(115,92,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-widest uppercase">
            The Adventure Awaits
          </span>
        </div>

        <h1
          data-route-heading
          tabIndex={-1}
          className="mt-6 font-serif text-5xl font-bold tracking-tight text-primary sm:text-6xl"
        >
          GameNight
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Run your tabletop campaign with confidence. Register a game, invite
          your players, and schedule the month —{" "}
          <span className="font-serif italic text-secondary">together</span>.
        </p>

        <ul
          data-testid="hero-value-props"
          className="mx-auto mt-12 grid max-w-3xl gap-4 text-left sm:grid-cols-3"
        >
          {VALUE_PROPS.map((vp) => (
            <li
              key={vp.title}
              className="rounded-xl border border-border bg-card/60 p-5 shadow-[4px_4px_0px_rgba(45,90,39,0.08)]"
            >
              <strong className="block font-serif text-base font-semibold text-primary">
                {vp.title}
              </strong>
              <span className="mt-2 block text-sm text-muted-foreground">
                {vp.body}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="group shadow-[4px_4px_0px_rgba(21,66,18,0.25)] active:translate-y-0.5 active:shadow-[2px_2px_0px_rgba(21,66,18,0.25)]"
          >
            <Link to="/register" search={(prev) => prev}>
              <span>Register</span>
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-2 border-secondary text-secondary hover:bg-secondary-container/20 hover:text-secondary"
          >
            <Link to="/sign-in" search={(prev) => prev}>
              <BookOpen className="mr-1 h-4 w-4" aria-hidden="true" />
              <span>Sign in</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
