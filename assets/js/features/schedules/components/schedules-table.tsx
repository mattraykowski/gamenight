import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ScheduleStatusBadge } from "./schedule-status-badge";
import type { Schedule } from "../hooks";

export interface SchedulesTableProps {
  schedules: Schedule[];
  /** The game id; threads through to the per-row View link target. */
  gameId: string;
}

/**
 * Schedule list rendered on the View Game page (top-6 widget) and on
 * the View All Schedules page (full list). Empty-state copy guides
 * the GM toward the Initiate Schedule button.
 */
export function SchedulesTable({ schedules, gameId }: SchedulesTableProps) {
  if (schedules.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No schedules yet — initiate one to plan a game night.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Schedule</TableHead>
          <TableHead className="w-[180px]">Status</TableHead>
          <TableHead className="w-[100px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <TableRow key={schedule.id} data-testid={`schedule-row-${schedule.id}`}>
            <TableCell className="font-medium">
              <span className="line-clamp-1">{schedule.name}</span>
            </TableCell>
            <TableCell>
              <ScheduleStatusBadge status={schedule.status} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                asChild
                variant="outline"
                size="sm"
                data-testid={`schedule-row-view-${schedule.id}`}
              >
                <Link
                  to="/games/$gameId/schedules/$scheduleId"
                  params={{ gameId, scheduleId: schedule.id }}
                >
                  View
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
