import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { InvitePlayerDialog } from "./invite-player-dialog";

describe("InvitePlayerDialog", () => {
  it("opens the modal from the trigger and closes after a successful submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <InvitePlayerDialog onSubmit={onSubmit}>
        <Button data-testid="trigger">Invite player</Button>
      </InvitePlayerDialog>,
    );

    expect(screen.queryByTestId("invite-player-dialog")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("trigger"));

    expect(await screen.findByTestId("invite-player-dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /invite a player/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), "newperson@example.com");
    await user.type(screen.getByLabelText(/character name/i), "Mira Stoneheart");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      email: "newperson@example.com",
      characterName: "Mira Stoneheart",
    });

    await waitFor(() => {
      expect(screen.queryByTestId("invite-player-dialog")).not.toBeInTheDocument();
    });
  });

  it("does not submit when validation fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <InvitePlayerDialog onSubmit={onSubmit}>
        <Button data-testid="trigger">Invite player</Button>
      </InvitePlayerDialog>,
    );

    await user.click(screen.getByTestId("trigger"));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("invite-player-dialog")).toBeInTheDocument();
  });
});
