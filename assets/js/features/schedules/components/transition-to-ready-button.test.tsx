import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransitionToReadyButton } from "./transition-to-ready-button";

describe("<TransitionToReadyButton> (T056)", () => {
  it("renders a trigger button labeled 'Ready for Availability'", () => {
    render(
      <TransitionToReadyButton
        onConfirm={async () => undefined}
        isPending={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /ready for availability/i }),
    ).toBeInTheDocument();
  });

  it("opens a confirmation dialog when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TransitionToReadyButton
        onConfirm={async () => undefined}
        isPending={false}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /ready for availability/i }),
    );

    expect(
      await screen.findByText(/email and notify every player/i),
    ).toBeInTheDocument();
  });

  it("calls onConfirm when the dialog's confirm button is clicked", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TransitionToReadyButton onConfirm={onConfirm} isPending={false} />);

    await user.click(
      screen.getByRole("button", { name: /ready for availability/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /^send to players$/i }),
    );

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("disables the confirm button while the parent's mutation is pending", async () => {
    const user = userEvent.setup();
    render(<TransitionToReadyButton onConfirm={async () => undefined} isPending />);

    await user.click(
      screen.getByRole("button", { name: /ready for availability/i }),
    );

    const confirm = await screen.findByRole("button", {
      name: /sending…/i,
    });
    expect(confirm).toBeDisabled();
  });
});
