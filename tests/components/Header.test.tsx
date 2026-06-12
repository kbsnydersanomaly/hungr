import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/menu/Header";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, sizes, ...rest } = props as {
      fill?: boolean;
      priority?: boolean;
      sizes?: string;
      [key: string]: unknown;
    };
    void fill;
    void priority;
    void sizes;
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

const baseProps = {
  restaurantName: "Testaurant",
  restaurantSlug: "testaurant",
  currentMenuSlug: "dinner",
};

describe("Header", () => {
  it("uses the nav bar color and contrast foreground CSS variables", () => {
    render(<Header {...baseProps} />);
    const header = screen.getByRole("banner");
    expect(header.style.backgroundColor).toBe("var(--color-nav-bar, #fff)");
    // Icons render with currentColor, so this var flips them between black
    // and white based on the configured nav bar color's luminance.
    expect(header.style.color).toBe("var(--color-nav-bar-foreground, #181818)");
  });

  it("renders the logo when a logo URL is provided", () => {
    render(<Header {...baseProps} logoUrl="https://example.com/logo.png" />);
    const logo = screen.getByAltText("Testaurant");
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("falls back to a letter avatar without a logo", () => {
    render(<Header {...baseProps} />);
    expect(screen.queryByAltText("Testaurant")).not.toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders the restaurant name and the about link", () => {
    render(<Header {...baseProps} />);
    expect(
      screen.getByRole("heading", { name: "Testaurant" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "About Testaurant" })
    ).toHaveAttribute("href", "/m/testaurant/about");
  });
});
