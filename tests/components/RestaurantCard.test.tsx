import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RestaurantCard,
  AddRestaurantCard,
} from "@/components/dashboard/RestaurantCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const restaurant = {
  id: "rest-1",
  name: "The Hungry Fox",
  slug: "hungry-fox",
  status: "active",
  street: "12 Main St",
  city: "Cape Town",
  province: "Western Cape",
};

describe("RestaurantCard", () => {
  it("renders the name, status and address", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("The Hungry Fox")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(
      screen.getByText("12 Main St, Cape Town, Western Cape")
    ).toBeInTheDocument();
  });

  it("hides the address when no address fields are set", () => {
    render(
      <RestaurantCard
        restaurant={{ ...restaurant, street: null, city: null, province: null }}
      />
    );
    expect(
      screen.queryByText(/Main St|Cape Town|Western Cape/)
    ).not.toBeInTheDocument();
  });

  it("shows the menu slug", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("Slug: /m/hungry-fox")).toBeInTheDocument();
  });

  it("links the card to the restaurant overview", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    const link = screen.getByRole("link", { name: /The Hungry Fox/i });
    expect(link).toHaveAttribute("href", "/restaurants/rest-1");
  });

  it("renders quick links to menus, branding and reviews", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByRole("link", { name: "Menus" })).toHaveAttribute(
      "href",
      "/restaurants/rest-1/menus"
    );
    expect(screen.getByRole("link", { name: "Branding" })).toHaveAttribute(
      "href",
      "/restaurants/rest-1/branding"
    );
    expect(screen.getByRole("link", { name: "Reviews" })).toHaveAttribute(
      "href",
      "/restaurants/rest-1/reviews"
    );
  });

  it("renders a secondary badge for non-active restaurants", () => {
    render(<RestaurantCard restaurant={{ ...restaurant, status: "draft" }} />);
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("offers a more-actions menu with a link to delete", async () => {
    render(<RestaurantCard restaurant={restaurant} />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(await screen.findByText("Delete…")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});

describe("AddRestaurantCard", () => {
  it("links to the new restaurant page", () => {
    render(<AddRestaurantCard />);
    expect(
      screen.getByRole("link", { name: /Add restaurant/i })
    ).toHaveAttribute("href", "/restaurants/new");
  });
});
