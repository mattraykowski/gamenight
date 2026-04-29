import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PostScheduleDialog } from "./post-schedule-dialog";
import { Button } from "@/components/ui/button";

describe("<PostScheduleDialog> (T095)", () => {
  it("opens the dialog when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PostScheduleDialog onConfirm={() => undefined} isPending={false}>
        <Button>Post schedule</Button>
      </PostScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /post schedule/i }));
    expect(
      await screen.findByText(/lock player edits and email/i),
    ).toBeInTheDocument();
  });

  it("calls onConfirm when the GM clicks the dialog's confirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <PostScheduleDialog onConfirm={onConfirm} isPending={false}>
        <Button>Post schedule</Button>
      </PostScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /^post schedule$/i }));
    await user.click(
      await screen.findByRole("button", { name: /^post schedule$/i }),
    );

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("disables the confirm button while pending", async () => {
    const user = userEvent.setup();
    render(
      <PostScheduleDialog onConfirm={() => undefined} isPending>
        <Button>Post schedule</Button>
      </PostScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /^post schedule$/i }));
    const confirm = await screen.findByRole("button", { name: /posting…/i });
    expect(confirm).toBeDisabled();
  });
});
