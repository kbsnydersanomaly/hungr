import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RestaurantBreadcrumb } from "@/components/dashboard/RestaurantBreadcrumb";

const RESTAURANT_ID_1 = "11111111-1111-1111-1111-111111111111";
const RESTAURANT_ID_2 = "22222222-2222-2222-2222-222222222222";

let mockPathname = `/restaurants/${RESTAURANT_ID_1}`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/auth/active-restaurant", () => ({
  setActiveRestaurant: vi.fn(),
}));

const restaurants = [
  { id: RESTAURANT_ID_1, name: "Bistro One", slug: "bistro-one" },
  { id: RESTAURANT_ID_2, name: "Bistro Two", slug: "bistro-two" },
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
  beforeEach(() => {
    mockPathname = `/restaurants/${RESTAURANT_ID_1}`;
  });

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

  it("renders Org → Restaurant → Section on restaurant-scoped paths", () => {
    mockPathname = `/restaurants/${RESTAURANT_ID_1}/team`;
    render(<RestaurantBreadcrumb {...baseProps} canAddRestaurant />);
    expect(screen.getAllByText("Acme Inc.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bistro One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team").length).toBeGreaterThan(0);
  });

  it("renders Org → Section on non-restaurant-scoped paths", () => {
    mockPathname = "/settings/team";
    render(<RestaurantBreadcrumb {...baseProps} canAddRestaurant />);
    expect(screen.getAllByText("Acme Inc.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bistro One")).not.toBeInTheDocument();
  });

  it("does not treat /restaurants/new as restaurant-scoped", () => {
    mockPathname = "/restaurants/new";
    render(<RestaurantBreadcrumb {...baseProps} canAddRestaurant />);
    expect(screen.getAllByText("Acme Inc.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New restaurant").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bistro One")).not.toBeInTheDocument();
  });
});
