import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MenuBanner } from "@/components/menu/MenuBanner";

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="swiper-slide">{children}</div>
  ),
}));

vi.mock("swiper/modules", () => ({
  Pagination: "Pagination",
  Autoplay: "Autoplay",
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
    return <img data-testid="banner-image" {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

const baseSpecial = {
  id: "special-1",
  title: "Half-price wings",
  description: "Crispy wings on special.",
  image_url: "https://example.com/wings.png",
  kind: "item_discount" as const,
  discount_type: "percentage" as const,
  discount_pct: 50,
  discount_amount_cents: null,
  combo_price_cents: null,
  date_from: null,
  date_to: null,
  time_from: null,
  time_to: null,
  selected_days: null,
  special_targets: [],
};

const baseProps = {
  bannerImageUrls: ["https://example.com/banner.png"],
  specials: [baseSpecial],
  restaurantSlug: "testaurant",
  menuSlug: "dinner",
  items: [{ id: "special-1", name: "Buffalo Wings" }],
};

describe("MenuBanner", () => {
  it("renders image and special slides", () => {
    render(<MenuBanner {...baseProps} />);
    const images = screen.getAllByTestId("banner-image");
    expect(images).toHaveLength(2);
    expect(screen.getByText("Half-price wings")).toBeInTheDocument();
  });

  it("opens the detail sheet when a special slide is clicked", () => {
    render(<MenuBanner {...baseProps} />);
    fireEvent.click(screen.getByLabelText("View details for Half-price wings"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("50% off")).toBeInTheDocument();
    expect(within(dialog).getByText("Half-price wings")).toBeInTheDocument();
  });

  it("does not open the sheet when an image slide is clicked", () => {
    render(<MenuBanner {...baseProps} specials={[]} />);
    const image = screen.getByAltText("Restaurant banner");
    expect(image).toBeInTheDocument();
    expect(screen.queryByText("50% off")).not.toBeInTheDocument();
  });

  it("passes target items through to the sheet", () => {
    render(
      <MenuBanner
        {...baseProps}
        specials={[
          {
            ...baseSpecial,
            special_targets: [
              {
                item_id: "item-1",
                category_id: null,
                menu_items: { name: "Buffalo Wings" },
              },
            ],
          },
        ]}
      />
    );
    fireEvent.click(screen.getByLabelText("View details for Half-price wings"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Buffalo Wings")).toBeInTheDocument();
  });
});
