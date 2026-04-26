import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GameFieldRowProps {
  /** Unique DOM id for the label/value pair — also used as test scaffolding. */
  id: string;
  /** Human-readable label for the field. */
  label: string;
  /** Additional class names applied to the outer wrapper. */
  className?: string;
  /**
   * View mode renders static text. Edit mode renders the form
   * control the parent form has wired up (typically a Shadcn
   * `FormField`). Both modes share the same grid + spacing so
   * toggling from detail to edit does not shift field positions
   * (FR-013 / SC-004).
   */
  children: ReactNode;
}

/**
 * Shared labelled-region primitive for the detail and edit surfaces
 * of a Game. The view page renders three of these with static text
 * children; the edit form renders three of these with input controls
 * as children. Because both sides use the same wrapper element and
 * spacing, the user's transition from view to edit does not produce
 * a visible shift in field positions.
 *
 * Enforced by `game-field-row.mirror.test.tsx` in Phase 5 (US3) —
 * that test renders both the detail-page and edit-form trees and
 * asserts the layout fingerprints match.
 */
export function GameFieldRow({ id, label, className, children }: GameFieldRowProps) {
  return (
    <div
      data-testid={`game-field-${id}`}
      data-slot="game-field-row"
      className={cn("space-y-2", className)}
    >
      <div
        id={`${id}-label`}
        data-slot="game-field-row-label"
        className="text-sm font-medium leading-none"
      >
        {label}
      </div>
      <div data-slot="game-field-row-value">{children}</div>
    </div>
  );
}
