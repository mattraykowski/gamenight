import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-cta-heading"
      className="relative overflow-hidden bg-primary px-6 py-24 text-primary-foreground"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary-container opacity-25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-tertiary opacity-20 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <h2
          id="closing-cta-heading"
          className="font-serif text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Ready to run your{" "}
          <span className="font-serif italic text-tertiary-fixed-dim">
            next session?
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-primary-fixed">
          Set up your first game in under five minutes — no credit card, no
          setup fee.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="group bg-tertiary-fixed text-on-tertiary-fixed shadow-[4px_4px_0px_rgba(0,0,0,0.2)] hover:bg-tertiary-fixed-dim active:translate-y-0.5 active:shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
          >
            <Link to="/register" search={(prev) => prev}>
              <span>Register</span>
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-2 border-primary-fixed bg-transparent text-primary-fixed hover:bg-primary-container/40 hover:text-primary-foreground"
          >
            <Link to="/sign-in" search={(prev) => prev}>
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
