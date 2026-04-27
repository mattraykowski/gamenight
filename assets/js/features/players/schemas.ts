import { z } from "zod";
import type { UpdatePlayerInput } from "@/ash_rpc";

/**
 * Player status values mirror the resource constraints
 * (`:active | :inactive | :done`).
 */
export const PLAYER_STATUSES = ["active", "inactive", "done"] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

/**
 * Form schema for the GM's `<PlayerEditDialog />`. Mirrors the
 * `:update` action's accept list and the resource constraints.
 */
export const playerEditFormSchema = z.object({
  characterName: z
    .string()
    .trim()
    .min(1, "Character name is required")
    .max(120, "Character name is too long (120 characters max)"),
  characterSummary: z
    .string()
    .trim()
    .max(4000, "Character summary is too long (4,000 characters max)"),
  gmNotes: z
    .string()
    .trim()
    .max(4000, "GM notes are too long (4,000 characters max)"),
  status: z.enum(PLAYER_STATUSES),
});

export type PlayerEditFormValues = z.infer<typeof playerEditFormSchema>;

/**
 * Coerce form values to the `UpdatePlayerInput` shape — the wire
 * type ash_typescript expects. Empty optional strings collapse to
 * `null` so we don't persist whitespace-only values.
 */
export function toUpdatePlayerInput(
  values: PlayerEditFormValues,
): Omit<UpdatePlayerInput, "id"> {
  return {
    characterName: values.characterName,
    characterSummary: values.characterSummary.length === 0 ? null : values.characterSummary,
    gmNotes: values.gmNotes.length === 0 ? null : values.gmNotes,
    status: values.status,
  };
}
