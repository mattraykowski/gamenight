/**
 * Discriminated union of notification kinds the SPA renders.
 *
 * Today only `:game_invitation` exists; the type is shaped so a
 * future kind (comments, announcements, etc.) lands as a new
 * variant + a switch arm in the renderers without touching the
 * data layer.
 */

export type NotificationKind = "game_invitation";

export interface NotificationDescriptor {
  /** The notification's primary text — what to render in the bell row. */
  title: string;
  /** Path the row's "Open" link points at. */
  href: string;
}

/**
 * Convert a notification's `kind` + `subjectId` into renderable
 * copy. Kept tiny on purpose — additional kinds extend the switch.
 */
export function describeNotification(kind: NotificationKind, _subjectId: string): NotificationDescriptor {
  switch (kind) {
    case "game_invitation":
      return {
        title: "You have a new game invitation",
        href: "/invitations",
      };
    default:
      // Unreachable today — `kind` is `"game_invitation"` only.
      // Adding a new kind to the union surfaces a TS narrowing
      // error here forcing this switch to grow.
      return { title: "Notification", href: "/notifications" };
  }
}
