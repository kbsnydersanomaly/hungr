import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { OrgRole } from "@/lib/auth/role";
import type { RestaurantBillingContext } from "@/lib/billing/pricing";
import {
  AddRestaurantButton,
  getAddRestaurantTitle,
} from "@/components/dashboard/AddRestaurantButton";

const plan = {
  id: "plan-1",
  slug: "pro",
  name: "Pro",
  description: null,
  pricing_model: "flat_includes_n" as const,
  base_price_cents: 99900,
  additional_discount_pct: 0,
  included_restaurants: 10,
  max_restaurants: 10,
  features: {},
  contact_only: false,
  is_public: true,
  active: true,
  sort_order: 2,
};

function renderButton(role: OrgRole, billing: RestaurantBillingContext | null) {
  return render(<AddRestaurantButton role={role} billing={billing} />);
}

describe("AddRestaurantButton", () => {
  it("renders for owners and admins", () => {
    renderButton("owner", { state: "included", plan });
    expect(
      screen.getByRole("link", { name: /Add restaurant/i })
    ).toHaveAttribute("href", "/restaurants/new");
  });

  it("is hidden for managers and staff", () => {
    const { rerender } = renderButton("manager", { state: "included", plan });
    expect(
      screen.queryByRole("link", { name: /Add restaurant/i })
    ).not.toBeInTheDocument();

    rerender(<AddRestaurantButton role="staff" billing={{ state: "included", plan }} />);
    expect(
      screen.queryByRole("link", { name: /Add restaurant/i })
    ).not.toBeInTheDocument();
  });

  it("shows an included title when the next restaurant is covered", () => {
    renderButton("admin", { state: "included", plan });
    expect(screen.getByRole("link", { name: /Add restaurant/i })).toHaveAttribute(
      "title",
      "This restaurant is included in your current plan — no extra charge."
    );
  });

  it("shows a per-restaurant price title", () => {
    renderButton("admin", {
      state: "checkout",
      plan: { ...plan, pricing_model: "per_restaurant", base_price_cents: 14900 },
      priceCents: 14900,
      restaurantIndex: 1,
      perRestaurant: true,
    });
    expect(screen.getByRole("link", { name: /Add restaurant/i })).toHaveAttribute(
      "title",
      "This restaurant will be billed at R 149.00/month."
    );
  });

  it("shows a flat-plan subscription price title", () => {
    renderButton("admin", {
      state: "checkout",
      plan,
      priceCents: 99900,
      restaurantIndex: 1,
      perRestaurant: false,
    });
    expect(screen.getByRole("link", { name: /Add restaurant/i })).toHaveAttribute(
      "title",
      "Start your Pro subscription at R 999.00/month."
    );
  });

  it("shows a limit-reached title", () => {
    renderButton("admin", { state: "limit_reached", plan, maxRestaurants: 10 });
    expect(screen.getByRole("link", { name: /Add restaurant/i })).toHaveAttribute(
      "title",
      "Plan limit reached. Your plan supports up to 10 restaurants. Upgrade to add more."
    );
  });

  it("shows a custom/enterprise title", () => {
    renderButton("admin", { state: "custom", plan });
    expect(screen.getByRole("link", { name: /Add restaurant/i })).toHaveAttribute(
      "title",
      "Enterprise plans must be set up by support."
    );
  });

  it("shows a no-plan title", () => {
    renderButton("admin", { state: "no_plan" });
    expect(screen.getByRole("link", { name: /Add restaurant/i })).toHaveAttribute(
      "title",
      "Choose a plan first to add a restaurant."
    );
  });
});

describe("getAddRestaurantTitle", () => {
  it("falls back to a no-plan message for a null billing context", () => {
    expect(getAddRestaurantTitle(null)).toBe(
      "Choose a plan first to add a restaurant."
    );
  });
});
