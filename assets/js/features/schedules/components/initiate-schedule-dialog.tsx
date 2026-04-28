import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initiateScheduleFormSchema,
  toInitiateScheduleInput,
  type InitiateScheduleFormValues,
} from "../schemas";
import type { InitiateScheduleInput } from "@/ash_rpc";

export interface InitiateScheduleDialogProps {
  /** Game id the new schedule will belong to. */
  gameId: string;
  /** Submission handler — receives the wire-shape input. */
  onSubmit: (input: InitiateScheduleInput) => Promise<void> | void;
  /** True while the parent's mutation is in flight. */
  isPending?: boolean;
  /** Trigger control supplied by the caller. */
  children: ReactNode;
}

/**
 * Modal wrapper around the initiate-schedule form. Native
 * `<input type="month">` and `<input type="time">` give us
 * accessible pickers without a third-party dependency. The
 * timezone defaults to the user's browser tz; story-scale
 * accuracy is acceptable.
 */
export function InitiateScheduleDialog({
  gameId,
  onSubmit,
  isPending,
  children,
}: InitiateScheduleDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Initiate a schedule</DialogTitle>
          <DialogDescription>
            Pick the month, time slot, and timezone — players will mark availability
            after you set yours.
          </DialogDescription>
        </DialogHeader>
        <InitiateScheduleForm
          key={open ? "open" : "closed"}
          gameId={gameId}
          isPending={isPending}
          onSubmit={async (values) => {
            await onSubmit(toInitiateScheduleInput(values));
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface InitiateScheduleFormProps {
  gameId: string;
  isPending?: boolean;
  onSubmit: (values: InitiateScheduleFormValues) => Promise<void>;
}

function InitiateScheduleForm({
  gameId,
  isPending,
  onSubmit,
}: InitiateScheduleFormProps) {
  const browserTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC"
      : "Etc/UTC";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InitiateScheduleFormValues>({
    resolver: zodResolver(initiateScheduleFormSchema),
    defaultValues: {
      monthYear: "",
      startTime: "",
      endTime: "",
      timeZone: browserTz,
      gameId,
    },
    mode: "onTouched",
  });

  const submitting = isPending ?? isSubmitting;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      data-testid="initiate-schedule-form"
    >
      <div className="space-y-2">
        <Label htmlFor="initiate-schedule-month">Month</Label>
        <Input
          id="initiate-schedule-month"
          type="month"
          aria-invalid={errors.monthYear ? true : undefined}
          {...register("monthYear")}
        />
        {errors.monthYear ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.monthYear.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="initiate-schedule-start-time">Start time</Label>
          <Input
            id="initiate-schedule-start-time"
            type="time"
            aria-invalid={errors.startTime ? true : undefined}
            {...register("startTime")}
          />
          {errors.startTime ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.startTime.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="initiate-schedule-end-time">End time</Label>
          <Input
            id="initiate-schedule-end-time"
            type="time"
            aria-invalid={errors.endTime ? true : undefined}
            {...register("endTime")}
          />
          {errors.endTime ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.endTime.message}
            </p>
          ) : null}
        </div>
      </div>

      <input type="hidden" {...register("timeZone")} />
      <input type="hidden" {...register("gameId")} />

      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create schedule"}
        </Button>
      </DialogFooter>
    </form>
  );
}
