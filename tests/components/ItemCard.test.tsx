import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemCard } from "@/components/menu/ItemCard";

vi.mock("@/lib/analytics/track", () => ({
  trackEvent: vi.fn(),
}));

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
    return <img data-testid="item-image" {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

import { trackEvent } from "@/lib/analytics/track";

const baseItem = {
  id: "item-1",
  name: "Margherita Pizza",
  description: "Tomato, mozzarella, basil",
  price_cents: 12550,
  image_url: "https://example.com/pizza.png",
  image_urls: [],
  labels: ["vegetarian"],
};

const baseProps = {
  item: baseItem,
  restaurantSlug: "testaurant",
  menuSlug: "dinner",
  menuId: "menu-1",
};

describe("ItemCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to the item detail page", () => {
    render(<ItemCard {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/m/testaurant/dinner/item/item-1");
  });

  it("renders name, deterministic price and labels", () => {
    render(<ItemCard {...baseProps} />);
    expect(screen.getByText("Margherita Pizza")).toBeInTheDocument();
    expect(screen.getByText("R 125.50")).toBeInTheDocument();
    expect(screen.getByText("vegetarian")).toBeInTheDocument();
  });

  it("wraps the fill image in a positioned (relative) container", () => {
    render(<ItemCard {...baseProps} />);
    const image = screen.getByTestId("item-image");
    // next/image with `fill` requires a positioned parent; without it the
    // image escapes the card and renders at full size (regression test).
    expect(image.parentElement?.className).toContain("relative");
    expect(image.parentElement?.className).toContain("aspect-[4/3]");
    expect(image.parentElement?.className).toContain("overflow-hidden");
  });

  it("does not render the image in compact mode", () => {
    render(<ItemCard {...baseProps} compact />);
    expect(screen.queryByTestId("item-image")).not.toBeInTheDocument();
  });

  it("tracks a click event when the card is clicked", () => {
    render(<ItemCard {...baseProps} />);
    fireEvent.click(screen.getByRole("link"));
    expect(trackEvent).toHaveBeenCalledWith({
      menuId: "menu-1",
      itemId: "item-1",
      eventType: "click",
    });
  });
});
