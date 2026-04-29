import { Button } from "@/components/ui/button";

export interface UpdatePostedScheduleButtonsProps {
  /** True when there are pending Final-value edits to commit. */
  hasChanges: boolean;
  /** Silent mutation handler — no notifications. */
  onUpdate: () => Promise<void> | void;
  /** Notify mutation handler — fans out :schedule_updated. */
  onUpdateAndNotify: () => Promise<void> | void;
  isUpdatePending: boolean;
  isNotifyPending: boolean;
}

/**
 * Dual-save row rendered on the Scheduling View when a schedule is
 * `:posted`. The GM can either commit silently (no notifications)
 * or commit + notify every linked player by email + bell entry.
 */
export function UpdatePostedScheduleButtons({
  hasChanges,
  onUpdate,
  onUpdateAndNotify,
  isUpdatePending,
  isNotifyPending,
}: UpdatePostedScheduleButtonsProps) {
  const anyPending = isUpdatePending || isNotifyPending;
  const disabled = !hasChanges || anyPending;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => void onUpdate()}
        disabled={disabled}
        data-testid="update-posted-schedule"
      >
        {isUpdatePending ? "Updating…" : "Update schedule"}
      </Button>
      <Button
        type="button"
        variant="default"
        onClick={() => void onUpdateAndNotify()}
        disabled={disabled}
        data-testid="update-posted-schedule-and-notify"
      >
        {isNotifyPending ? "Updating + notifying…" : "Update and notify"}
      </Button>
      {!hasChanges ? (
        <p className="text-xs text-muted-foreground">
          Toggle a Final value to enable.
        </p>
      ) : null}
    </div>
  );
}
