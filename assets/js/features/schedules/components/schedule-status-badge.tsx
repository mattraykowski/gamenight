import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScheduleStatus } from "../kinds";

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  preparing: "Preparing",
  ready_for_availability: "Ready for Availability",
  posted: "Posted",
};

// Adventurer's Journal — wax-seal palettes per status.
//   preparing                → muted parchment seal (not yet committed)
//   ready_for_availability   → burnt-orange seal (action requested)
//   posted                   → forest-green seal (committed / official)
const STATUS_CLASS: Record<ScheduleStatus, string> = {
  preparing:
    "bg-muted text-muted-foreground border-muted-foreground/40",
  ready_for_availability:
    "bg-secondary text-secondary-foreground border-secondary",
  posted: "bg-primary text-primary-foreground border-primary",
};

interface ScheduleStatusBadgeProps {
  status: ScheduleStatus;
}

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
  const label = STATUS_LABEL[status];
  return (
    <Badge
      variant="waxSeal"
      className={cn(STATUS_CLASS[status])}
      aria-label={`Schedule status: ${label}`}
    >
      {label}
    </Badge>
  );
}
