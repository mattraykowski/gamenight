import { Badge } from "@/components/ui/badge";
import type { ScheduleStatus } from "../kinds";

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  preparing: "Preparing",
  ready_for_availability: "Ready for Availability",
  posted: "Posted",
};

const STATUS_VARIANT: Record<ScheduleStatus, "default" | "secondary" | "outline"> = {
  preparing: "outline",
  ready_for_availability: "secondary",
  posted: "default",
};

interface ScheduleStatusBadgeProps {
  status: ScheduleStatus;
}

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
  const label = STATUS_LABEL[status];
  return (
    <Badge variant={STATUS_VARIANT[status]} aria-label={`Schedule status: ${label}`}>
      {label}
    </Badge>
  );
}
