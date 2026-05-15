import { Bell, CalendarDays, EyeOff, Users } from "lucide-react";

const HIGHLIGHTS = [
  {
    title: "Monthly scheduling.",
    body: "Plan one month at a time. See everyone's availability at a glance, post the final list when you're ready.",
    icon: CalendarDays,
  },
  {
    title: "Rosters & characters.",
    body: "Each game has a roster. Each player brings a character. Switch contexts without losing the thread.",
    icon: Users,
  },
  {
    title: "Player-side availability.",
    body: "Players submit their availability without seeing each other's, so nobody anchors to the GM's calendar.",
    icon: EyeOff,
  },
  {
    title: "Notifications.",
    body: "Players hear about new schedules; you hear about late submissions and changes — without checking twelve different chats.",
    icon: Bell,
  },
] as const;

export function FeatureHighlights() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto max-w-5xl px-6 py-20"
    >
      <div className="text-center">
        <h2
          id="features-heading"
          className="font-serif text-3xl font-bold tracking-tight text-primary sm:text-4xl"
        >
          Designed for GMs,{" "}
          <span className="font-serif italic text-secondary">
            built for the table
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          The tools you actually need to keep a campaign on the rails — without
          the sprawl of a dozen apps.
        </p>
      </div>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2">
        {HIGHLIGHTS.map((h) => {
          const Icon = h.icon;
          return (
            <li
              key={h.title}
              data-testid="feature-highlight"
              className="flex gap-5 rounded-xl border border-border bg-card/60 p-6 shadow-[4px_4px_0px_rgba(45,90,39,0.08)] transition-shadow hover:shadow-[6px_6px_0px_rgba(161,64,9,0.12)] motion-reduce:transition-none"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black/10 bg-primary-fixed-dim shadow-[0_4px_0_rgba(115,92,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)]">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <strong className="block font-serif text-lg font-semibold text-primary">
                  {h.title}
                </strong>
                <p className="mt-2 text-sm text-muted-foreground">{h.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
