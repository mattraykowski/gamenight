import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CornerOrnamentProps {
  /** Lucide icon component to render inside the seal. */
  icon: LucideIcon;
  /**
   * Color theme — picks the wax-seal palette. `secondary` is the
   * default attention color (burnt orange), `tertiary` is gilded
   * gold for premium / "rare" surfaces, `primary` is forest green
   * for committed / "official" surfaces.
   */
  tone?: "secondary" | "tertiary" | "primary";
  /** Override the default `-top-4 -left-4` placement when the
   *  parent isn't `relative` or wants a different anchor. */
  className?: string;
}

const TONE_CLASSES = {
  secondary: "bg-secondary text-secondary-foreground",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  primary: "bg-primary text-primary-foreground",
} as const;

/**
 * Adventurer's Journal — decorative wax-seal corner ornament for
 * page hero blocks. Per the design brief:
 *
 *   "Decorative Borders: Use 1px solid borders ... occasionally
 *    breaking the border with a gold ornament in the corner for
 *    higher-importance containers."
 *
 * Renders as a 48px round wax-seal disc rotated -12° with the
 * supplied lucide icon centered inside. Parent must be
 * `position: relative` for the default `-top-4 -left-4` placement
 * to anchor correctly.
 *
 * Decorative only — `aria-hidden`. Page heading semantics belong
 * on the sibling `<h1>`.
 */
export function CornerOrnament({
  icon: Icon,
  tone = "secondary",
  className,
}: CornerOrnamentProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "wax-seal absolute -top-4 -left-4 flex size-12 -rotate-12 items-center justify-center rounded-full",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}
