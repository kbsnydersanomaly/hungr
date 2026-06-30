import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RestaurantBreadcrumb } from "@/components/dashboard/RestaurantBreadcrumb";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth/active-restaurant", () => ({
  setActiveRestaurant: vi.fn(),
}));

const restaurants = [
  { id: "r1", name: "Bistro One", slug: "bistro-one" },
  { id: "r2", name: "Bistro Two", slug: "bistro-two" },
];

const baseProps = {
  restaurants,
  activeRestaurant: restaurants[0],
  orgName: "Acme Inc.",
};

function openDropdown() {
  const triggers = screen.getAllByRole("button", { name: /Bistro One/i });
  fireEvent.click(triggers[0]);
}

describe("RestaurantBreadcrumb", () => {
  it("does not render a rename option", () => {
    render(<RestaurantBreadcrumb {...baseProps} canAddRestaurant />);
    openDropdown();
    expect(screen.queryByText(/Rename/i)).not.toBeInTheDocument();
  });

  it("shows Add restaurant for owners/admins", () => {
    render(<RestaurantBreadcrumb {...baseProps} canAddRestaurant />);
    openDropdown();
    expect(screen.getByText("Add restaurant")).toBeInTheDocument();
  });

  it("hides Add restaurant for non-admins", () => {
    render(<RestaurantBreadcrumb {...baseProps} canAddRestaurant={false} />);
    openDropdown();
    expect(screen.queryByText("Add restaurant")).not.toBeInTheDocument();
  });
});
