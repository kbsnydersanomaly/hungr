import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MenuBackLink } from "@/components/menu/MenuBackLink";

describe("MenuBackLink", () => {
  it("renders a back link with the provided href", () => {
    render(<MenuBackLink href="/m/cafe/dinner" />);
    const link = screen.getByRole("link", { name: "Back to menu" });
    expect(link).toHaveAttribute("href", "/m/cafe/dinner");
  });

  it("supports a custom label", () => {
    render(<MenuBackLink href="/m/cafe" label="Return to menu" />);
    expect(screen.getByRole("link", { name: "Return to menu" })).toBeInTheDocument();
  });
});
