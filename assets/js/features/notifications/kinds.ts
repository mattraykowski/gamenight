/**
 * Discriminated union of notification kinds the SPA renders.
 *
 * Adding a new variant here narrows `describeNotification`'s switch
 * statement at compile time — the TypeScript exhaustiveness check
 * forces every renderer to handle every kind.
 */

export type NotificationKind =
  | "game_invitation"
  | "schedule_ready_for_availability"
  | "schedule_posted"
  | "schedule_updated"
  | "schedule_reminder";

/**
 * Payload a schedule-kind notification carries. The fan-out path
 * fills these fields at insert time so the bell + /notifications
 * page can render without a follow-up fetch. See
 * specs/003-game-schedule/contracts/rpc.md §ScheduleNotificationPayload.
 */
export interface ScheduleNotificationPayload {
  schedule_id: string;
  schedule_name: string;
  game_id: string;
  game_name: string;
  gm_display_name: string;
}

export interface NotificationDescriptor {
  /** The notification's primary text — what to render in the bell row. */
  title: string;
  /** Path the row's "Open" link points at. */
  href: string;
}

/**
 * Convert a notification's `kind` + `subjectId` into renderable
 * copy. Kept tiny on purpose — additional kinds extend the switch.
 *
 * Schedule-kind notifications carry a `payload` of type
 * `ScheduleNotificationPayload`; the renderer is responsible for
 * passing it as `extra` so titles like "Wednesday Night Heroes —
 * October 2026 7:00 PM – 11:00 PM" can be composed without a
 * round-trip.
 */
export function describeNotification(
  kind: NotificationKind,
  _subjectId: string,
  extra?: ScheduleNotificationPayload,
): NotificationDescriptor {
  switch (kind) {
    case "game_invitation":
      return {
        title: "You have a new game invitation",
        href: "/invitations",
      };

    case "schedule_ready_for_availability":
      return scheduleDescriptor(
        extra,
        (p) => `${p.game_name} schedule for ${p.schedule_name} is ready for your availability`,
      );

    case "schedule_posted":
      return scheduleDescriptor(
        extra,
        (p) => `${p.game_name} schedule for ${p.schedule_name} has been posted`,
      );

    case "schedule_updated":
      return scheduleDescriptor(
        extra,
        (p) => `${p.game_name} schedule for ${p.schedule_name} was updated`,
      );

    case "schedule_reminder":
      return scheduleDescriptor(
        extra,
        (p) =>
          `Reminder: ${p.gm_display_name} is waiting on your availability for ${p.schedule_name}`,
      );
  }
}

function scheduleDescriptor(
  payload: ScheduleNotificationPayload | undefined,
  titleFn: (p: ScheduleNotificationPayload) => string,
): NotificationDescriptor {
  if (!payload) {
    return { title: "Schedule update", href: "/notifications" };
  }
  return {
    title: titleFn(payload),
    // Player-side deep link — the per-character schedule view is
    // resolved by the consumer using the player's character id from
    // their session; the bell row follows /notifications and the
    // /notifications page handles the deep-link math.
    href: "/notifications",
  };
}
