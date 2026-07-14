import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SpecialsSlider } from "@/components/menu/SpecialsSlider";

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
    return <img data-testid="slider-image" {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

const baseSpecial = {
  id: "special-1",
  title: "Half-price wings",
  description: "Crispy wings on special.",
  image_url: null,
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
  specials: [baseSpecial],
  restaurantSlug: "testaurant",
  menuSlug: "dinner",
  items: [{ id: "item-1", name: "Buffalo Wings" }],
};

describe("SpecialsSlider", () => {
  it("renders specials with heading", () => {
    render(<SpecialsSlider {...baseProps} />);
    expect(screen.getByText("Specials")).toBeInTheDocument();
    expect(screen.getByText("Half-price wings")).toBeInTheDocument();
  });

  it("opens the detail sheet when a special card is clicked", () => {
    render(<SpecialsSlider {...baseProps} />);
    fireEvent.click(screen.getByLabelText("View details for Half-price wings"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("50% off")).toBeInTheDocument();
  });

  it("passes target items through to the sheet", () => {
    render(
      <SpecialsSlider
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
