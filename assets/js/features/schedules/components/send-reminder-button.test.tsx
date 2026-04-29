import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SendReminderButton } from "./send-reminder-button";

describe("<SendReminderButton> (T120)", () => {
  it("renders 'Send reminder' and calls onSend on click", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendReminderButton onSend={onSend} isPending={false} />);

    const button = screen.getByRole("button", { name: /send reminder/i });
    await user.click(button);

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  });

  it("disables the button while pending and shows pending copy", () => {
    render(<SendReminderButton onSend={() => undefined} isPending />);

    const button = screen.getByRole("button", { name: /sending…/i });
    expect(button).toBeDisabled();
  });

  it("can be clicked repeatedly (no rate-limit gate at the component level)", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SendReminderButton onSend={onSend} isPending={false} />);

    const button = screen.getByRole("button", { name: /send reminder/i });
    await user.click(button);
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(3));
  });
});
