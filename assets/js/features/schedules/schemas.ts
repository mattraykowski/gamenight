import { z } from "zod";
import type { InitiateScheduleInput } from "@/ash_rpc";

/**
 * Form-shape Zod schema for `<InitiateScheduleDialog>`. The HTML
 * `<input type="month">` returns a `"YYYY-MM"` string; the
 * `<input type="time">` returns `"HH:MM"`. We split / pad those into
 * the wire-shape integers / `"HH:MM:SS"` strings the Ash action
 * expects.
 *
 * Validation mirrors the resource constraints
 * (`min: 2024 <= year <= 2100`, `1 <= month <= 12`, IANA timezone
 * accepted). Past-month rejection runs on the server using the GM's
 * timezone — we do NOT duplicate that check here because the client
 * may not know the GM's timezone reliably.
 */
export const initiateScheduleFormSchema = z.object({
  monthYear: z
    .string()
    .regex(/^\d{4}-\d{2}$/u, "Pick a month")
    .refine((value) => {
      const [yearStr, monthStr] = value.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      return year >= 2024 && year <= 2100 && month >= 1 && month <= 12;
    }, "Month must be between 2024 and 2100"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/u, "Start time is required (HH:MM)"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/u, "End time is required (HH:MM)")
    .refine((value) => value.length === 5, "End time is required (HH:MM)"),
  timeZone: z
    .string()
    .min(1, "Timezone is required")
    .max(64, "Timezone is too long"),
  gameId: z.string().uuid(),
});

export type InitiateScheduleFormValues = z.infer<
  typeof initiateScheduleFormSchema
>;

/**
 * Convert form values into the wire shape `initiateSchedule` expects:
 * `month` and `year` as integers, times as `HH:MM:SS`.
 */
export function toInitiateScheduleInput(
  values: InitiateScheduleFormValues,
): InitiateScheduleInput {
  const [yearStr, monthStr] = values.monthYear.split("-");
  return {
    month: Number(monthStr),
    year: Number(yearStr),
    startTime: `${values.startTime}:00`,
    endTime: `${values.endTime}:00`,
    timeZone: values.timeZone,
    gameId: values.gameId,
  };
}
