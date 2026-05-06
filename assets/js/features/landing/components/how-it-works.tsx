import { Dices, Mail, ScrollText } from "lucide-react";

const STEPS = [
  {
    title: "Register your game.",
    body: "Give it a name, set the cadence, and you're the GM.",
    icon: ScrollText,
    iconBg: "bg-primary-fixed-dim",
    iconColor: "text-primary",
  },
  {
    title: "Invite your players.",
    body: "Send invitations by email. Players join with a single click and bring their characters.",
    icon: Mail,
    iconBg: "bg-tertiary-fixed",
    iconColor: "text-tertiary",
  },
  {
    title: "Schedule the month.",
    body: "You mark your availability, your players mark theirs, GameNight surfaces the days that work.",
    icon: Dices,
    iconBg: "bg-secondary-fixed-dim",
    iconColor: "text-secondary",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="border-y-2 border-border bg-card/40 px-6 py-20"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="how-it-works-heading"
          className="text-center font-serif text-3xl font-bold tracking-tight text-primary sm:text-4xl"
        >
          How it works
        </h2>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 text-center shadow-[4px_4px_0px_rgba(0,0,0,0.05)] transition-all hover:shadow-[6px_6px_0px_rgba(161,64,9,0.1)]"
              >
                <div
                  className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-black/10 shadow-[0_4px_0_rgba(115,92,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)] transition-transform group-hover:scale-110 ${step.iconBg}`}
                >
                  <Icon
                    className={`h-7 w-7 ${step.iconColor}`}
                    aria-hidden="true"
                  />
                </div>
                <strong className="font-serif text-xl font-semibold text-primary">
                  {step.title}
                </strong>
                <p className="mt-3 text-sm text-muted-foreground">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
