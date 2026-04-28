import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ScheduleStatusBadge } from "./schedule-status-badge";

describe("<ScheduleStatusBadge> (T028)", () => {
  it("renders 'Preparing' for the :preparing status", () => {
    render(<ScheduleStatusBadge status="preparing" />);
    expect(screen.getByText("Preparing")).toBeInTheDocument();
  });

  it("renders 'Ready for Availability' for :ready_for_availability", () => {
    render(<ScheduleStatusBadge status="ready_for_availability" />);
    expect(screen.getByText("Ready for Availability")).toBeInTheDocument();
  });

  it("renders 'Posted' for :posted", () => {
    render(<ScheduleStatusBadge status="posted" />);
    expect(screen.getByText("Posted")).toBeInTheDocument();
  });

  it("provides an accessible label describing the schedule status", () => {
    render(<ScheduleStatusBadge status="ready_for_availability" />);
    expect(
      screen.getByLabelText(/schedule status: ready for availability/i),
    ).toBeInTheDocument();
  });
});
