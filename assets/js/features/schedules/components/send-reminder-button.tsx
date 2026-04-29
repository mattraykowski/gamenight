import { Button } from "@/components/ui/button";

export interface SendReminderButtonProps {
  /** Mutation handler — fires on each click. No rate limit (FR-038). */
  onSend: () => Promise<void> | void;
  /** True while the parent's mutation is in flight. */
  isPending: boolean;
}

/**
 * Per-participant "Send reminder" button rendered next to a
 * non-submitted, non-NP roster row on the GM Schedule Detail page.
 * Per FR-038 there's no client- or server-side rate limit; the
 * GM can click many times and each click materialises another
 * email + bell entry.
 */
export function SendReminderButton({
  onSend,
  isPending,
}: SendReminderButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => void onSend()}
    >
      {isPending ? "Sending…" : "Send reminder"}
    </Button>
  );
}
