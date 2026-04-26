import { z } from "zod";
import type { RegisterGameInput } from "@/ash_rpc";

export const GAME_STATUSES = ["active", "paused", "cancelled", "completed"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

/**
 * Shared Zod schema used by both the create form (`/games/new`) and
 * the edit form (`/games/:id/edit`). Matches the accept list on the
 * `:register` and `:update` actions (title + description + status)
 * and the constraints declared on the Ash resource.
 */
export const gameFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title is too long (120 characters max)"),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long (2000 characters max)"),
  status: z.enum(GAME_STATUSES),
});

export type GameFormValues = z.infer<typeof gameFormSchema>;

/**
 * Shape the hook layer passes to the generated `registerGame`
 * function. Description is optional on the wire (Ash attribute
 * allows nil); an empty string from the form is normalised to `null`
 * so the server doesn't persist whitespace-only descriptions.
 */
export function toRegisterGameInput(values: GameFormValues): RegisterGameInput {
  return {
    title: values.title,
    description: values.description.length === 0 ? null : values.description,
    status: values.status,
  };
}
