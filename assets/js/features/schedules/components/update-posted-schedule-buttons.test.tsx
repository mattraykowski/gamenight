import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UpdatePostedScheduleButtons } from "./update-posted-schedule-buttons";

describe("<UpdatePostedScheduleButtons> (T132)", () => {
  it("disables both buttons when there are no changes", () => {
    render(
      <UpdatePostedScheduleButtons
        hasChanges={false}
        onUpdate={() => undefined}
        onUpdateAndNotify={() => undefined}
        isUpdatePending={false}
        isNotifyPending={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /update schedule/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /update and notify/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/toggle a final value to enable/i),
    ).toBeInTheDocument();
  });

  it("Update schedule fires the silent handler", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateAndNotify = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <UpdatePostedScheduleButtons
        hasChanges
        onUpdate={onUpdate}
        onUpdateAndNotify={onUpdateAndNotify}
        isUpdatePending={false}
        isNotifyPending={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /update schedule/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdateAndNotify).not.toHaveBeenCalled();
  });

  it("Update and notify fires the notify handler", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onUpdateAndNotify = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <UpdatePostedScheduleButtons
        hasChanges
        onUpdate={onUpdate}
        onUpdateAndNotify={onUpdateAndNotify}
        isUpdatePending={false}
        isNotifyPending={false}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /update and notify/i }),
    );

    await waitFor(() => expect(onUpdateAndNotify).toHaveBeenCalledTimes(1));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("disables both during a pending mutation", () => {
    render(
      <UpdatePostedScheduleButtons
        hasChanges
        onUpdate={() => undefined}
        onUpdateAndNotify={() => undefined}
        isUpdatePending
        isNotifyPending={false}
      />,
    );
    expect(screen.getByRole("button", { name: /updating…/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /update and notify/i }),
    ).toBeDisabled();
  });
});
