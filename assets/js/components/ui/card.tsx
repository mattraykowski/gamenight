import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Adventurer's Journal — character-rich card primitive.
 *
 * Per the design brief: "Cards represent character items or quest
 * logs. They feature a thin decorative border and a header section
 * using Noto Serif." This is the standard shadcn Card API with two
 * project-specific tweaks:
 *
 *   1. `<CardTitle>` defaults to `font-serif` (Noto Serif) so every
 *      card header reads as a chapter heading.
 *   2. The base radius is `rounded-lg` (1rem per the design system's
 *      "Large Radius for main containers and modals") rather than
 *      shadcn's default `rounded-xl`.
 *
 * Migration target: most `assets/js/features/**` files inline
 * `rounded-md border p-4` patterns; converting them to `<Card>` /
 * `<CardHeader>` / `<CardContent>` is gradual — start with the
 * highest-visibility surfaces (dashboard, character detail, schedule
 * cards) and convert as you touch them.
 */

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-lg border py-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-serif text-xl leading-tight font-semibold",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
