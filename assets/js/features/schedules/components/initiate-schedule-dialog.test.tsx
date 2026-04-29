import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InitiateScheduleDialog } from "./initiate-schedule-dialog";

describe("<InitiateScheduleDialog> (T029)", () => {
  it("opens when the trigger is clicked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <InitiateScheduleDialog
        gameId="00000000-0000-0000-0000-000000000001"
        onSubmit={onSubmit}
      >
        <button type="button">Initiate</button>
      </InitiateScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /^initiate$/i }));
    expect(await screen.findByText(/initiate a schedule/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/month/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create schedule/i }),
    ).toBeInTheDocument();
  });

  it("submitting an empty form does not call onSubmit and shows validation errors", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <InitiateScheduleDialog
        gameId="00000000-0000-0000-0000-000000000001"
        onSubmit={onSubmit}
      >
        <button type="button">Initiate</button>
      </InitiateScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /^initiate$/i }));
    await user.click(
      await screen.findByRole("button", { name: /create schedule/i }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/pick a month/i)).toBeInTheDocument();
  });

  it("disables the submit button while a parent's mutation is pending", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <InitiateScheduleDialog
        gameId="00000000-0000-0000-0000-000000000001"
        onSubmit={onSubmit}
        isPending
      >
        <button type="button">Initiate</button>
      </InitiateScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /^initiate$/i }));
    const submit = await screen.findByRole("button", { name: /creating…/i });
    expect(submit).toBeDisabled();
  });
});
