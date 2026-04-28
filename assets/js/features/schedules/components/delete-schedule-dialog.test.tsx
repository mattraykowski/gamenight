import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "@/components/ui/button";
import { DeleteScheduleDialog } from "./delete-schedule-dialog";

describe("<DeleteScheduleDialog> (T139)", () => {
  it("keeps the confirm button disabled until the typed input matches 'delete' exactly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DeleteScheduleDialog scheduleName="October 2099" onConfirm={onConfirm}>
        <Button type="button">Delete</Button>
      </DeleteScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));

    const confirm = await screen.findByTestId("delete-schedule-confirm");
    expect(confirm).toBeDisabled();

    const input = await screen.findByTestId(
      "delete-schedule-confirmation-input",
    );

    await user.type(input, "DELETE");
    expect(confirm).toBeDisabled();

    await user.clear(input);
    await user.type(input, "Delete");
    expect(confirm).toBeDisabled();

    await user.clear(input);
    await user.type(input, "delete");
    expect(confirm).not.toBeDisabled();
  });

  it("invokes onConfirm with the typed value once armed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DeleteScheduleDialog scheduleName="October 2099" onConfirm={onConfirm}>
        <Button type="button">Delete</Button>
      </DeleteScheduleDialog>,
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));
    await user.type(
      await screen.findByTestId("delete-schedule-confirmation-input"),
      "delete",
    );
    await user.click(screen.getByTestId("delete-schedule-confirm"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("delete"));
  });

  it("disables both buttons while a delete mutation is pending", async () => {
    const user = userEvent.setup();
    render(
      <DeleteScheduleDialog
        scheduleName="October 2099"
        onConfirm={() => undefined}
        isPending
      >
        <Button type="button">Delete</Button>
      </DeleteScheduleDialog>,
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await user.type(
      await screen.findByTestId("delete-schedule-confirmation-input"),
      "delete",
    );
    expect(screen.getByTestId("delete-schedule-confirm")).toBeDisabled();
    expect(screen.getByTestId("delete-schedule-confirm")).toHaveTextContent(
      /deleting…/i,
    );
  });
});
