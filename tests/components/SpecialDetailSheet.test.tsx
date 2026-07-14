import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpecialDetailSheet } from "@/components/menu/SpecialDetailSheet";

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
    return <img data-testid="special-image" {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => {
    const { href, children, ...rest } = props as {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    };
    return (
      <a data-testid="item-link" href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

const baseSpecial = {
  id: "special-1",
  title: "Half-price wings",
  description: "Crispy wings on special.",
  custom_promotional_text: "Tasty Tuesday wings!",
  image_url: "https://example.com/wings.png",
  kind: "item_discount",
  discount_type: "percentage" as const,
  discount_pct: 50,
  discount_amount_cents: null,
  combo_price_cents: null,
  date_from: "2026-06-01",
  date_to: "2026-06-30",
  time_from: "17:00",
  time_to: "20:00",
  selected_days: ["tue"],
  special_targets: [
    {
      item_id: "item-1",
      category_id: null,
      menu_items: { name: "Buffalo Wings" },
    },
    {
      item_id: "item-2",
      category_id: null,
      menu_items: { name: "Lemon & Herb Wings" },
    },
    {
      item_id: "item-99",
      category_id: null,
      menu_items: { name: "Off-menu Wings" },
    },
  ],
};

const baseProps = {
  special: baseSpecial,
  open: true,
  onOpenChange: vi.fn(),
  restaurantSlug: "testaurant",
  menuSlug: "dinner",
  items: [
    { id: "item-1", name: "Buffalo Wings" },
    { id: "item-2", name: "Lemon & Herb Wings" },
  ],
};

describe("SpecialDetailSheet", () => {
  it("renders title, promotional text and deal", () => {
    render(<SpecialDetailSheet {...baseProps} />);
    expect(screen.getByText("Half-price wings")).toBeInTheDocument();
    expect(screen.getByText("Tasty Tuesday wings!")).toBeInTheDocument();
    expect(screen.getByText("50% off")).toBeInTheDocument();
  });

  it("falls back to description when promotional text is absent", () => {
    render(<SpecialDetailSheet
      {...baseProps}
      special={{ ...baseSpecial, custom_promotional_text: null }}
    />);
    expect(screen.getByText("Crispy wings on special.")).toBeInTheDocument();
  });

  it("renders the schedule", () => {
    render(<SpecialDetailSheet {...baseProps} />);
    expect(screen.getByText("2026-06-01 to 2026-06-30")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("17:00 – 20:00")).toBeInTheDocument();
  });

  it("links target items that are on the current menu", () => {
    render(<SpecialDetailSheet {...baseProps} />);
    const links = screen.getAllByTestId("item-link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/m/testaurant/dinner/item/item-1");
    expect(links[1]).toHaveAttribute("href", "/m/testaurant/dinner/item/item-2");
  });

  it("does not link target items that are not on the current menu", () => {
    render(<SpecialDetailSheet {...baseProps} />);
    expect(screen.getByText("Off-menu Wings")).toBeInTheDocument();
    const links = screen.queryAllByTestId("item-link");
    expect(links).toHaveLength(2);
  });

  it("renders category targets", () => {
    render(
      <SpecialDetailSheet
        {...baseProps}
        special={{
          ...baseSpecial,
          special_targets: [
            {
              item_id: null,
              category_id: "cat-1",
              categories: { name: "Mains" },
            },
          ],
        }}
      />
    );
    expect(screen.getByText("Mains")).toBeInTheDocument();
  });

  it("closes the sheet when a target link is clicked", () => {
    const onOpenChange = vi.fn();
    render(<SpecialDetailSheet {...baseProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getAllByTestId("item-link")[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
