import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

describe("<Card> primitive", () => {
  it("renders as a div with the card data-slot", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Quest Log</CardTitle>
        </CardHeader>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-slot", "card");
  });

  it("CardTitle defaults to the serif (Noto Serif) font family", () => {
    render(<CardTitle data-testid="title">Curse of Strahd</CardTitle>);
    expect(screen.getByTestId("title").className).toMatch(/\bfont-serif\b/);
  });

  it("CardDescription uses muted-foreground for hierarchy", () => {
    render(
      <CardDescription data-testid="desc">Side quest details</CardDescription>,
    );
    expect(screen.getByTestId("desc").className).toMatch(
      /\btext-muted-foreground\b/,
    );
  });

  it("composes header + content + title into the right outer slot", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Content body</CardContent>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Content body")).toBeInTheDocument();
  });
});
