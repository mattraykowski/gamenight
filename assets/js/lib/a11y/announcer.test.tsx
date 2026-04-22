import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect } from "react";
import { expectNoAxeViolations } from "@/test/a11y";
import { A11yAnnouncer, useAnnounce } from "./announcer";

function AnnouncerConsumer({ message, priority }: { message: string; priority?: "polite" | "assertive" }) {
  const announce = useAnnounce();
  useEffect(() => {
    announce(message, priority);
  }, [announce, message, priority]);
  return null;
}

describe("A11yAnnouncer", () => {
  it("renders one polite and one assertive aria-live region", async () => {
    const { container } = render(
      <A11yAnnouncer>
        <p>content</p>
      </A11yAnnouncer>,
    );

    const polite = screen.getByTestId("announcer-polite");
    const assertive = screen.getByTestId("announcer-assertive");

    expect(polite).toHaveAttribute("aria-live", "polite");
    expect(polite).toHaveAttribute("aria-atomic", "true");
    expect(assertive).toHaveAttribute("aria-live", "assertive");
    expect(assertive).toHaveAttribute("aria-atomic", "true");

    await expectNoAxeViolations(container);
  });

  it("renders both regions with an sr-only-equivalent class so they stay visually hidden", () => {
    render(
      <A11yAnnouncer>
        <p>content</p>
      </A11yAnnouncer>,
    );

    expect(screen.getByTestId("announcer-polite").className).toMatch(/sr-only/);
    expect(screen.getByTestId("announcer-assertive").className).toMatch(/sr-only/);
  });

  it("routes messages with default priority to the polite region", async () => {
    render(
      <A11yAnnouncer>
        <AnnouncerConsumer message="Navigated to Dashboard" />
      </A11yAnnouncer>,
    );

    await act(async () => {});
    expect(screen.getByTestId("announcer-polite")).toHaveTextContent("Navigated to Dashboard");
    expect(screen.getByTestId("announcer-assertive")).toHaveTextContent("");
  });

  it("routes explicit assertive messages to the assertive region", async () => {
    render(
      <A11yAnnouncer>
        <AnnouncerConsumer message="Session expired" priority="assertive" />
      </A11yAnnouncer>,
    );

    await act(async () => {});
    expect(screen.getByTestId("announcer-assertive")).toHaveTextContent("Session expired");
    expect(screen.getByTestId("announcer-polite")).toHaveTextContent("");
  });

  it("useAnnounce throws when called outside an <A11yAnnouncer>", () => {
    const consoleErrorSpy = vitestStubConsoleError();
    try {
      expect(() => render(<AnnouncerConsumer message="unused" />)).toThrow(
        /must be used within an <A11yAnnouncer>/,
      );
    } finally {
      consoleErrorSpy.restore();
    }
  });
});

// React logs errors to console when a render throws; silence for the expected-throw test.
function vitestStubConsoleError() {
  const original = console.error;
  console.error = () => {};
  return {
    restore: () => {
      console.error = original;
    },
  };
}
