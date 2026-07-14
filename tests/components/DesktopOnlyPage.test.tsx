import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DesktopOnlyPage } from "@/components/dashboard/DesktopOnlyPage";

describe("DesktopOnlyPage", () => {
  it("renders children in a desktop-only container and a mobile fallback card", () => {
    render(
      <DesktopOnlyPage
        title="Branding"
        seeCurrentHref="/m/testaurant"
        seeCurrentLabel="see current branding"
        mobileExtra={<div data-testid="mobile-extra">Read-only grid</div>}
      >
        <div data-testid="desktop-content">Branding editor</div>
      </DesktopOnlyPage>
    );

    const desktopContainer = screen.getByTestId("desktop-content").parentElement;
    expect(desktopContainer).toHaveClass("hidden", "lg:block");

    expect(screen.getByText("Branding")).toBeInTheDocument();
    expect(
      screen.getByText(/the branding editor needs a bigger screen/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) =>
        node?.textContent ===
        "You can see current branding or manage this from a desktop."
      )
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /see current branding/i });
    expect(link).toHaveAttribute("href", "/m/testaurant");

    expect(screen.getByTestId("mobile-extra")).toBeInTheDocument();
  });

  it("falls back to a plain message when no current-link is provided", () => {
    render(
      <DesktopOnlyPage title="Media Library">
        <div data-testid="desktop-content">Media editor</div>
      </DesktopOnlyPage>
    );

    expect(
      screen.getByText(/the media library editor needs a bigger screen/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/please manage this from a desktop/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
