import { z } from "zod";
import type { CreateInvitationInput, AcceptInvitationInput } from "@/ash_rpc";

/**
 * Shared Zod schema used by `<InvitationForm />` (the GM-side
 * invite form on `/games/:id`). Mirrors the `:create_for_game`
 * action's accept list + arguments and the constraints declared on
 * `GameNight.Games.Invitation`.
 *
 * Empty optional strings are normalised to `null` at the wire
 * boundary in `toCreateInvitationInput/2` so we don't persist
 * whitespace-only values.
 */
export const invitationFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
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
});

export type InvitationFormValues = z.infer<typeof invitationFormSchema>;

export function toCreateInvitationInput(
  values: InvitationFormValues,
  gameId: string,
): CreateInvitationInput {
  return {
    gameId,
    email: values.email,
    characterName: values.characterName,
    characterSummary: values.characterSummary.length === 0 ? null : values.characterSummary,
    gmNotes: values.gmNotes.length === 0 ? null : values.gmNotes,
  };
}

/**
 * Body shape for `useAcceptInvitation`. Accepts the path-supplied
 * invitation id plus the token from the URL. Exists as a typed
 * alias of the generated input type so the SPA's call sites read
 * naturally.
 */
export type AcceptInvitationArgs = AcceptInvitationInput;
